import { decode, number, standardTarget, tariff } from './lib/domestic-tables.mjs';

const audioTarget = {
  ...standardTarget(
    'stepfun',
    'https://api.stepfun.com/v1',
    'stepaudio-2.5-asr',
    'fixed upstream primary or original CNY sheet',
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
  id: 'stepfun-cn-asr',
  url: 'https://platform.stepfun.com/docs/zh/guides/pricing/details.md',
  supplemental: [
    { id: 'audio', url: 'https://platform.stepfun.com/docs/zh/guides/models/audio.md' },
  ],
  targets: [audioTarget],
  parse({ body, supplemental }) {
    const observed = audioTariff(decode(body), decode(supplemental.get('audio').body));
    return new Map([[audioTarget.quoteId, observed]]);
  },
};
