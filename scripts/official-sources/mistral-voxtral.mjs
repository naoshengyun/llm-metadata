import { tables } from '../official-source-helpers/html-table.mjs';
import {
  exactRow,
  markdown,
  requireText,
  usd,
} from '../official-source-helpers/markdown-table.mjs';

const providerId = 'mistral';
const endpoint = 'https://api.mistral.ai/v1';
const currency = 'USD';
const priceList = 'Mistral API / global standard';
const slug = 'voxtral-small-25-07';
const version = 'voxtral-small-2507';
const models = [version, 'voxtral-small-latest'];

export const adapter = {
  id: 'mistral-voxtral',
  url: 'https://docs.mistral.ai/inference/pricing',
  supplemental: [{ id: 'model', url: 'https://docs.mistral.ai/models/' + slug + '.md' }],
  targets: models.map((modelId) => ({
    quoteId: 'upstream:mistral:' + modelId + ':USD',
    providerId,
    endpoint,
    modelId,
    priceList,
    currency,
    group: modelId,
    baselineIdentity: { endpoint: null, priceList: 'fixed upstream primary or original CNY sheet' },
    referenceOnlyReason:
      'Native Voxtral model pricing cannot combine audio minutes with text tokens',
  })),
  parse({ body, supplemental }) {
    const html = markdown(body);
    requireText(html, 'aria-pressed="true">USD</button>');
    requireText(html, 'aria-pressed="true">Standard</button>');
    const doc = markdown(supplemental.get('model').body);
    const ids = /^- API names: (.+)$/m.exec(doc)?.[1].split(', ') ?? [];
    const tariff =
      /^- Pricing: Input (\$\d+(?:\.\d+)?) \/Min; Input (\$\d+(?:\.\d+)?) \/M Tokens; Output (\$\d+(?:\.\d+)?) \/M Tokens$/m.exec(
        doc,
      );
    if (!ids.includes('`' + version + '`') || !tariff || !/^- Status: GA$/m.test(doc))
      throw Error('Incomplete Voxtral Small mixed-unit API tariff');
    const rows = tables(html)
      .filter(
        ([head]) => head.map((cell) => cell.text).join('|') === 'Model|Input|Cached input|Output',
      )
      .flatMap((table) => table.slice(1));
    const [, audio, cached, output] = exactRow(
      rows,
      ([model]) => model?.html.includes('href="/models/' + slug + '"'),
      version,
      4,
    ).map(({ text }) => text);
    const perMinute = /^\$(\d+(?:\.\d+)?) \/Min$/;
    if (
      usd(audio, perMinute) !== usd(tariff[1]) ||
      usd(output, /^\$(\d+(?:\.\d+)?) \/M Tokens$/) !== usd(tariff[3])
    )
      throw Error('Voxtral Small price list and model card disagree');
    const sourcePrice = {
      input: usd(tariff[2]),
      output: usd(tariff[3]),
      audioInput: { amount: usd(audio, perMinute), unit: 'per_minute' },
      cachedAudioInput: { amount: usd(cached, perMinute), unit: 'per_minute' },
    };
    return new Map(
      adapter.targets.map(({ quoteId, modelId }) => [
        quoteId,
        ids.includes('`' + modelId + '`')
          ? {
              identity: { providerId, endpoint, modelId, priceList, currency },
              sourcePrice,
              sourceUnit: 'mixed',
              required: ['input', 'output', 'audioInput.amount', 'cachedAudioInput.amount'],
              conditions: { pricedVersion: version, textUnit: 'per_million_tokens' },
            }
          : { error: 'Exact Voxtral API ID missing from model card: ' + modelId },
      ]),
    );
  },
};
