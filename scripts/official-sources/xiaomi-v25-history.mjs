import { createHash } from 'node:crypto';
import { tables } from '../official-source-helpers/html-table.mjs';
import { markdown, requireText } from '../official-source-helpers/markdown-table.mjs';

const endpoint = 'https://api.xiaomimimo.com/v1';
const priceList = 'Xiaomi MiMo China real-time pay-as-you-go';
const effectiveAt = '2026-05-27T00:00:00+08:00';
const endOfService = '2026-10-21T10:00:00+08:00';
const imageUrl =
  'https://aistudio-cdn.xiaomimimo.com/xiaomimimo-static/mimo-docs-figures/display/KdqUbJSGzohXwhxRBjEcCQuOn77.webp';
const imageSha = '35e1d42f2d81c94307dff70c6cf75b1c044f3dbe65e10563b5869fb60eaa0d40';

// The original CNY table is an image. Only the reviewed bytes authorize these values.
const transcribed = {
  'mimo-v2.5': {
    replacement: 'mimo-v2.6-flash',
    price: { input: 1, output: 2, cache_read: 0.02 },
    formerPrices: [
      { input: 2.8, output: 14, cache_read: 0.56 },
      { input: 5.6, output: 28, cache_read: 1.12 },
    ],
  },
  'mimo-v2.5-pro': {
    replacement: 'mimo-v2.6-pro',
    price: { input: 3, output: 6, cache_read: 0.025 },
    formerPrices: [
      { input: 7, output: 21, cache_read: 1.4 },
      { input: 14, output: 42, cache_read: 2.8 },
    ],
  },
};

export const adapter = {
  id: 'xiaomi-v25-history',
  url: 'https://mimo.mi.com/docs/zh-CN/news/latest/v2.5-price-update',
  supplemental: [
    { id: 'cny-table', url: imageUrl },
    { id: 'deprecation', url: 'https://mimo.mi.com/static/docs/updates/deprecate.md' },
  ],
  targets: Object.keys(transcribed).map((modelId) => ({
    quoteId: 'upstream:xiaomi:' + modelId + ':USD',
    providerId: 'xiaomi',
    endpoint,
    modelId,
    priceList,
    currency: 'CNY',
    group: modelId,
    baselineIdentity: {
      currency: 'USD',
      priceList: 'fixed upstream primary or original CNY sheet',
    },
    referenceOnlyReason:
      'The exact MiMo V2.5 API ID was decommissioned; this is historical CNY pricing',
  })),
  parse({ body, supplemental, evidence }) {
    const html = markdown(body);
    const announcement = html.split(/<h2[^>]*>MiMo-V2\.5系列API永久降价<\/h2>/);
    if (announcement.length !== 2) throw Error('Missing Xiaomi permanent API adjustment section');
    const section = announcement[1].split(/<h2\b/, 1)[0];
    requireText(section, '<img src="' + imageUrl + '"');
    requireText(section, '不再区分输入长度');
    requireText(html, '2026年5月27日0点');
    const image = supplemental.get('cny-table').body;
    if (createHash('sha256').update(image).digest('hex') !== imageSha)
      throw Error('Xiaomi historical CNY image changed; verify the tariff transcription');

    const lifecycle = markdown(supplemental.get('deprecation').body);
    requireText(lifecycle, 'the name of the old model expires');
    const retirementTables = tables(lifecycle).filter(
      ([head]) =>
        head.map(({ text }) => text).join('|') ===
        'Deprecated Model|Deprecated Time|System replacement time|System Replacement Model|Replacement Impact',
    );
    return new Map(
      adapter.targets.map(({ quoteId, modelId, ...target }) => {
        const { replacement, price, formerPrices } = transcribed[modelId];
        const rows = retirementTables.flatMap((table) =>
          table.slice(1).filter(([id]) => id?.text === modelId),
        );
        if (
          rows.length !== 1 ||
          rows[0][1]?.text !== '10:00, October 21,2026 (UTC+8)' ||
          rows[0][3]?.text !== replacement ||
          Date.parse(evidence.obtainedAt) < Date.parse(endOfService)
        ) {
          return [quoteId, { error: 'Exact MiMo V2.5 API retirement is unverified: ' + modelId }];
        }
        const { providerId, endpoint, priceList, currency } = target;
        return [
          quoteId,
          {
            identity: { providerId, endpoint, modelId, priceList, currency },
            sourcePrice: price,
            sourceUnit: 'per_million_tokens',
            required: Object.keys(price),
            effectiveAt,
            conditions: {
              historical: true,
              endOfService,
              replacementModelId: replacement,
              noContextPricingAfterAdjustment: true,
              beforeAdjustment: {
                thresholdLabel: '256K',
                atOrBelow: formerPrices[0],
                above: formerPrices[1],
              },
            },
          },
        ];
      }),
    );
  },
};
