import { markdown, requireText, usd } from '../official-source-helpers/markdown-table.mjs';

const providerId = 'sakana';
const endpoint = 'https://api.sakana.ai/v1';
const modelId = 'sakana-namazu';
const priceList = 'Sakana Namazu API / pay-as-you-go';
const currency = 'USD';
const quoteId = 'upstream:sakana:sakana-namazu:USD';
const feeKeys = { Input: 'input', Output: 'output', 'Cached input': 'cache_read' };

export const adapter = {
  id: 'sakana-namazu',
  url: 'https://sakana.ai/namazu/',
  targets: [
    {
      quoteId,
      providerId,
      endpoint,
      modelId,
      priceList,
      currency,
      group: modelId,
      baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
    },
  ],
  parse,
};

function parse({ body }) {
  const html = markdown(body);
  requireText(html, 'Actual billing is in US dollars.');
  requireText(html, '>sakana-namazu</');
  const section = html.split('id="namazu-pricing-update">');
  if (section.length !== 2) throw Error('Missing or ambiguous Namazu published tariff');
  const cards = section[1].split('<div class="fg-pricecell">');
  const currentTariff = {};
  const futureTariff = {};
  const effectiveTimes = new Set();
  for (const card of cards.slice(1, 4)) {
    const label = /<span class="t-en">(Input|Output|Cached input)<\/span>/.exec(card)?.[1];
    const price = /<div class="fg-pricecell__p">(\$[^<]+)<\/div>/.exec(card)?.[1];
    const key = feeKeys[label];
    if (!key || Object.hasOwn(currentTariff, key)) throw Error('Missing or duplicated Namazu fee');
    requireText(card, '<div class="fg-pricecell__n">/ 1M tokens</div>');
    currentTariff[key] = usd(price ?? '');
    if (card.includes('<div class="pricing-future">')) {
      const future =
        /<div class="pricing-future"><span class="t-en">From ([A-Za-z]+ \d{1,2}, \d{4}), (\d\d:\d\d) JST<\/span><span class="t-ja">[^<]*<\/span><strong>(\$[^<]+)<\/strong>/.exec(
          card,
        );
      if (!future) throw Error('Unreadable Namazu formal rate date or timezone');
      const day = new Date(Date.parse(future[1] + ' 00:00:00 UTC')).toISOString().slice(0, 10);
      effectiveTimes.add(day + 'T' + future[2] + ':00+09:00');
      futureTariff[key] = usd(future[3]);
    }
  }
  const required = Object.values(feeKeys);
  if (Object.keys(currentTariff).length !== required.length)
    throw Error('Incomplete Namazu rate table');
  if (
    effectiveTimes.size &&
    (effectiveTimes.size !== 1 || Object.keys(futureTariff).length !== required.length)
  )
    throw Error('Incomplete or inconsistent Namazu future rates');
  const [effectiveAt] = effectiveTimes;
  return new Map([
    [
      quoteId,
      {
        identity: { providerId, endpoint, modelId, priceList, currency },
        recordId: 'us-sakana-namazu-pay-as-you-go',
        required,
        sourceUnit: 'per_million_tokens',
        ...(effectiveAt
          ? { sourcePrice: futureTariff, effectiveAt, conditions: { currentTariff } }
          : { sourcePrice: currentTariff, conditions: {} }),
      },
    ],
  ]);
}
