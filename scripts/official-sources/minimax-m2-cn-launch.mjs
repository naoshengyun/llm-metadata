import { textContent } from '../official-source-helpers/html-table.mjs';
import { markdown, requireText } from '../official-source-helpers/markdown-table.mjs';

const identity = {
  providerId: 'minimax-cn',
  endpoint: 'https://api.minimax.cn/anthropic/v1',
  modelId: 'MiniMax-M2',
  priceList: 'MiniMax Open Platform / China launch pricing',
  currency: 'CNY',
};
const quoteId = 'upstream:minimax-cn:MiniMax-M2:CNY';

export const adapter = {
  id: 'minimax-m2-cn-launch',
  url: 'https://www.minimax.io/news/minimax-m2',
  targets: [
    {
      quoteId,
      ...identity,
      group: identity.modelId,
      baselineIdentity: { priceList: 'fixed upstream primary or original CNY sheet' },
      referenceOnlyReason:
        'MiniMax announced CNY base rates at launch; the selected endpoint and cache charges are unverified',
    },
  ],
  parse({ body }) {
    const page = textContent(markdown(body).replace(/<script[\s\S]*?<\/script>/g, ''));
    requireText(page, 'The MiniMax-M2 API is available on the MiniMax Open Platform');
    requireText(page, 'free for a limited time');
    const amounts = [
      ...page.matchAll(
        /We have set the API price for the model at \$[\d.]+\s*\/\s*¥(\d+(?:\.\d+)?) RMB per million input tokens and \$[\d.]+\s*\/\s*¥(\d+(?:\.\d+)?) RMB per million output tokens/gi,
      ),
    ];
    if (amounts.length !== 1)
      throw Error('Exact official MiniMax-M2 RMB launch tariff is unverified');
    const [, input, output] = amounts[0];
    return new Map([
      [
        quoteId,
        {
          identity,
          sourcePrice: { input: Number(input), output: Number(output) },
          sourceUnit: 'per_million_tokens',
          required: ['input', 'output'],
          conditions: {
            launchAnnouncement: true,
            endpointBillingUnverified: true,
            cacheRatesUnverified: true,
          },
        },
      ],
    ]);
  },
};
