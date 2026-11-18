import { decode, number, only, standardTarget, tariff } from './lib/domestic-tables.mjs';

const models = ['step-3.5-flash', 'step-3.5-flash-2603', 'step-3.7-flash', 'step-5-preview'];
const upstreamPriceList = 'fixed upstream primary or original CNY sheet';
const targets = models.map((model) =>
  standardTarget(
    'stepfun',
    'https://api.stepfun.com/v1',
    model,
    model === 'step-5-preview' ? 'StepFun China online pay-as-you-go' : upstreamPriceList,
    model === 'step-5-preview'
      ? 'cn-stepfun-' + model + '-standard'
      : `upstream:stepfun:${model}:CNY`,
    'text-tokens',
  ),
);

const audioTarget = {
  ...standardTarget(
    'stepfun',
    'https://api.stepfun.com/v1',
    'stepaudio-2.5-asr',
    upstreamPriceList,
    'upstream:stepfun:stepaudio-2.5-asr:unknown',
  ),
  baselineIdentity: { currency: null },
  referenceOnlyReason: 'Native model prices cannot represent SSE input audio hours',
};

function audioTariff(source, audio) {
  const future =
    /调整后的价格同样自北京时间 (\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日 中午 (\d{2}:\d{2}:\d{2}) 起生效。收费币种为人民币。/.exec(
      source,
    );
  const next = /^\| `stepaudio-2\.5-asr` \| (\d+(?:\.\d+)?) 元／小时 \|$/m.exec(source);
  const previous = /一次性提交（SSE）API 定价 (\d+(?:\.\d+)?) 元 \/ 小时/.exec(audio);
  if (
    !future ||
    !next ||
    !previous ||
    !audio.includes('一次性提交（SSE，模型字符串 `stepaudio-2.5-asr`）')
  ) {
    throw Error('Incomplete StepFun ASR current and future timing evidence');
  }
  const [, year, month, day, time] = future;
  return {
    ...tariff(
      audioTarget,
      { amount: number(next[1]) },
      {
        transport: 'SSE',
        beforeEffectiveRate: { amount: number(previous[1]), unit: 'per_audio_hour' },
      },
      'per_audio_hour',
    ),
    effectiveAt: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${time}+08:00`,
  };
}

export const adapter = {
  id: 'stepfun-cn',
  url: 'https://platform.stepfun.com/docs/zh/guides/pricing/details.md',
  supplemental: [
    { id: 'audio', url: 'https://platform.stepfun.com/docs/zh/guides/models/audio.md' },
  ],
  targets: [...targets, audioTarget],
  parse({ body, supplemental }) {
    const source = decode(body);
    const text = /^## 文本与多模态模型\s*$([^]*?)^## 语音模型\s*$/m.exec(source)?.[1];
    if (
      !text?.includes('单位：元／百万 tokens。') ||
      !text.includes('| Model ID | 输入价格（缓存未命中） | 输入价格（缓存命中） | 输出价格 |') ||
      !source.includes('单价以人民币计价')
    )
      throw Error('Missing StepFun CNY token table');
    const rates = new Map(
      targets.map((target) => {
        const rows = text
          .split('\n')
          .filter((line) => line.startsWith('| `' + target.modelId + '` |'));
        const row = only(rows, target.modelId)
          .split('|')
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (row.length !== 4) throw Error('Incomplete StepFun token row');
        const [, input, hit, output] = row;
        const result = tariff(
          target,
          {
            input: number(input),
            output: number(output),
            cache_read: number(hit),
          },
          {},
        );
        if (target.modelId === 'step-5-preview') {
          const announcement =
            /Step 5 Preview 的缓存命中输入价格自北京时间 (\d{4}) 年 (\d{2}) 月 (\d{2}) 日 (\d{2}:\d{2}) 起由 (\d+\.\d+) 元／百万 tokens 调整为 (\d+\.\d+) 元／百万 tokens。在该时间之前已通过按量付费 API 调用过 Step 5 Preview 的用户，继续适用 (\d+\.\d+) 元／百万 tokens。/.exec(
              text,
            );
          if (
            !announcement ||
            number(announcement[6]) !== result.sourcePrice.cache_read ||
            number(announcement[5]) !== number(announcement[7])
          )
            throw Error('Unverified Step 5 eligibility conditions');
          result.effectiveAt = `${announcement[1]}-${announcement[2]}-${announcement[3]}T${announcement[4]}:00+08:00`;
          result.conditions.legacyCacheHit = {
            amount: number(announcement[7]),
            eligibility:
              'Used Step 5 Preview through the pay-as-you-go API before the effective time',
            unit: 'per_million_tokens',
          };
        }
        return [target.quoteId, result];
      }),
    );
    try {
      rates.set(audioTarget.quoteId, audioTariff(source, decode(supplemental.get('audio').body)));
    } catch (error) {
      rates.set(audioTarget.quoteId, { error: error.message });
    }
    return rates;
  },
};
