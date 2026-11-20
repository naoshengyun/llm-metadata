import {
  decode,
  htmlText,
  number,
  only,
  standardTarget,
  tables,
  tariff,
} from './lib/domestic-tables.mjs';

const docs = 'https://help.aliyun.com/zh/model-studio/';
const beijing = {
  id: 'alibaba-wan-cn',
  url: docs + 'model-pricing.md',
  tab: '华北2（北京）',
  provider: 'alibaba-cn',
  host: 'dashscope.aliyuncs.com',
  list: 'cn-beijing',
  currency: 'CNY',
};
const singapore = {
  id: 'alibaba-wan-sg',
  url: 'https://docs.modelstudio.console.alibabacloud.com/en/model-studio/model-pricing.md',
  tab: 'Singapore',
  provider: 'alibaba',
  host: 'dashscope-intl.aliyuncs.com',
  list: 'sg-international',
  currency: 'USD',
};
const resolutions = ['720P', '1080P'];
const outputTerms = [
  '输入不计费，输出按成功生成的 视频秒数 计费。',
  'Input is not billed; output is billed by the seconds of video successfully generated.',
];
const families = [
  {
    sections: ['wan30video_cn_h3', 'wan30video_intl_h3'],
    models: ['wan3.0-video', 'wan3.0-video-prime'],
    resolutions: ['480P', ...resolutions],
    basis: 'input-and-output-seconds',
    terms: [
      '计费时长 = 输入视频时长 + 输出视频时长。',
      'Billable duration = Input video duration + Output video duration.',
    ],
  },
  {
    sections: ['ba6f7744d5e0o', '86ece99b2f50f'],
    models: ['wan2.7-t2v', 'wan2.7-t2v-2026-04-25', 'wan2.7-t2v-2026-06-12'],
    resolutions,
    basis: 'output-seconds',
    terms: outputTerms,
  },
  {
    sections: ['e715eca061ba4', 'c0aa9e71a7o7e'],
    models: ['wan2.7-i2v', 'wan2.7-i2v-2026-04-25'],
    resolutions,
    basis: 'output-seconds',
    terms: outputTerms,
    videoType: true,
  },
  {
    sections: ['5c3d28ad8a4x8', 'dd0b9a92689i4'],
    models: ['wan2.7-r2v', 'wan2.7-r2v-2026-06-12'],
    resolutions,
    basis: 'input-and-output-seconds',
    terms: [
      '计费时长 = 输入视频时长（上限 5 秒）+ 输出视频时长。',
      'Billable duration = Input video duration (up to 5 seconds) + Output video duration.',
    ],
    videoType: true,
    inputLimitSeconds: 5,
    referenceOnlyReason: 'Alibaba New API plugin has no route for this reference-to-video model',
  },
  {
    sections: ['89e9be041ek81', 'd8f6ea7b9coxw'],
    models: ['wan2.7-videoedit'],
    resolutions,
    basis: 'input-and-output-seconds',
    terms: [
      'wan2.7-videoedit 的输入视频和输出视频均按 视频秒数 计费',
      'For wan2.7-videoedit, both the input video and the output video are billed by video seconds',
    ],
    referenceOnlyReason: 'Alibaba New API plugin has no route for this video editing model',
  },
  {
    sections: ['e2540d71a2utl', 'e1f7b437f6wye'],
    models: ['wan2.7-image', 'wan2.7-image-pro'],
    basis: 'output-images',
    terms: ['仅输出计费', 'For billing rules, see [Image Generation]'],
  },
];

function registrations(region) {
  return families.flatMap((family) =>
    family.models.map((model) => {
      const list = region.list + '-task-online-original';
      const target = standardTarget(
        region.provider,
        'https://' + region.host + '/api/v1',
        model,
        list,
        'dashscope--' + model + '--' + list,
      );
      return {
        family,
        target: {
          ...target,
          currency: region.currency,
          referenceOnlyReason: family.referenceOnlyReason,
        },
      };
    }),
  );
}

function readTiers(document, family, region, model) {
  const international = region === singapore;
  const sectionId = family.sections[international ? 1 : 0];
  const section = only(
    document.filter((part) => part.split('\n')[0].includes('id="' + sectionId + '"')),
    'Wan official tariff section',
  );
  if (
    !htmlText(section.split('<Tabs>')[0])
      .replace(/ +([。，；])/g, '$1')
      .includes(family.terms[international ? 1 : 0])
  )
    throw Error('Missing or changed Wan billing conditions');
  const [, , tab] = only(
    [...section.matchAll(/<Tab title="([^"]+)">([^]*?)<\/Tab>/g)].filter(
      ([, name]) => name === region.tab,
    ),
    'Wan regional price tab',
  );
  const measuresInput = family.basis === 'input-and-output-seconds';
  const expectedHeader = (
    international
      ? [
          'Model ID',
          'Service Deployment Scope',
          ...(family.videoType ? ['Output video type'] : []),
          ...(family.resolutions ? ['Output video resolution'] : []),
          measuresInput ? 'Input and output unit prices' : 'Output unit price',
          'Free quota (Note) Validity: 90 days from the date you activate Model Studio, the model is released, or your application is approved (whichever is later)',
        ]
      : [
          '模型 ID（Model ID）',
          ...(family.videoType ? ['输出视频类型'] : []),
          ...(family.resolutions ? ['输出视频分辨率'] : []),
          measuresInput ? '输入和输出单价' : '输出单价',
          '免费额度 （注） 有效期：自开通百炼/模型发布/申请通过之日起90天内（以较晚者为准）',
        ]
  ).join('|');
  const [, ...rows] = only(
    tables(tab).filter(([header]) => header.map(({ text }) => text).join('|') === expectedHeader),
    'Wan regional billing table',
  );
  const first = only(
    rows.flatMap((row, index) => (row[0]?.text === model ? [index] : [])),
    'Wan model row',
  );
  const count = family.resolutions?.length ?? 1;
  const bandRows = rows.slice(first, first + count);
  const [modelCell, ...header] = bandRows[0];
  if (count > 1 && !modelCell.attrs.includes('rowSpan={' + count + '}'))
    throw Error('Unexpected Wan resolution count');
  if (international && header.shift()?.text !== 'International')
    throw Error('Unexpected Wan Singapore deployment scope');
  if (
    family.videoType &&
    header.shift()?.text !== (international ? 'Video with audio' : '有声视频')
  )
    throw Error('Unexpected Wan video type');
  header.pop(); // Trial quotas are account-specific, outside the original unit price.
  const image = !family.resolutions;
  return [header, ...bandRows.slice(1)].reverse().map((cells, index, reversed) => {
    const values = cells.map(({ text }) => text);
    const resolution = family.resolutions?.[count - index - 1];
    if (values.length !== (image ? 1 : 2) || (!image && values.shift() !== resolution))
      throw Error('Unexpected Wan resolution tier');
    const rate = international ? values[0].replace('\\$', '$') : values[0];
    const match = (
      international
        ? image
          ? /^\$(\d+(?:\.\d+)?)\/image$/
          : /^(?:Original)?\$(\d+(?:\.\d+)?)\/\s*s(?: \(\d+% off for a limited time\))?$/
        : image
          ? /^(\d+(?:\.\d+)?)元\/张$/
          : /^(?:原价)?(\d+(?:\.\d+)?)元\/秒(?: （限时\d+(?:\.\d+)?折）)?$/
    ).exec(rate);
    if (!match) throw Error('Unexpected Wan original unit price');
    return {
      name: resolution ?? 'per-image',
      ...(resolution &&
        (family.referenceOnlyReason || index < reversed.length - 1) && {
          when: { resolution },
        }),
      charges: [
        {
          usageKey: image ? 'image_count' : 'seconds',
          amount: number(match[1]),
          unit: image ? 'per_count' : 'per_second',
          currency: region.currency,
        },
      ],
    };
  });
}

function source(region) {
  const models = registrations(region);
  return {
    id: region.id,
    url: region.url,
    supplemental: [
      { id: 'activation', url: docs + 'wan-model-activation-usage-and-refund.md' },
      { id: 'wan3-api', url: docs + 'wan3-video-generation-api-reference.md' },
    ],
    targets: models.map(({ target }) => target),
    parse({ body, supplemental }) {
      const document = decode(body).replace(/\r\n/g, '\n').split(/^### /m);
      const active = new Set(
        [...decode(supplemental.get('activation').body).matchAll(/\x60(wan[\w.-]+)\x60/g)].map(
          ([, model]) => model,
        ),
      );
      const wan3 = htmlText(decode(supplemental.get('wan3-api').body));
      return new Map(
        models.map(({ family, target }) => {
          try {
            const model = target.modelId;
            if (!active.has(model))
              throw Error('Wan model ID missing from the official activation list');
            if (
              family.sections[0] === 'wan30video_cn_h3' &&
              !wan3.includes('有输入参考视频时，等于输入视频时长与输出视频时长之和。')
            )
              throw Error('Wan 3.0 API no longer documents input plus output seconds');
            const tiers = readTiers(document, family, region, model);
            const parsed = tariff(
              target,
              tiers,
              {
                region: region.tab,
                basis: family.basis,
                ...(family.resolutions && {
                  resolutions: family.resolutions,
                  failedTasksFree: true,
                }),
                ...(family.videoType && { outputVideoType: 'audio' }),
                ...(family.inputLimitSeconds && { inputLimitSeconds: family.inputLimitSeconds }),
              },
              'per-charge',
            );
            parsed.required = family.referenceOnlyReason
              ? tiers.map((_, index) => index + '.charges.0.amount')
              : [];
            parsed.task = { plugin: 'alibaba', model };
            return [target.quoteId, parsed];
          } catch (error) {
            return [target.quoteId, { error: error.message }];
          }
        }),
      );
    },
  };
}

export const adapter = [source(beijing), source(singapore)];
