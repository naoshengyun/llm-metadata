import {
  decode,
  number,
  only,
  standardTarget,
  tables,
  tariff,
  withHeader,
} from './lib/domestic-tables.mjs';

const models = ['mimo-v2.6-pro', 'mimo-v2.6-flash', 'mimo-v2.6-pro-ultraspeed'];
const targets = models.map((model) =>
  standardTarget(
    'xiaomi',
    'https://api.xiaomimimo.com/v1',
    model,
    'Xiaomi MiMo China real-time pay-as-you-go',
    'cn-xiaomi-' + model + '-standard',
    'domestic-realtime',
  ),
);

export const adapter = {
  id: 'xiaomi-cn',
  url: 'https://mimo.mi.com/static/docs/price/pay-as-you-go.md',
  targets,
  parse({ body }) {
    const markdown = decode(body);
    const domestic =
      /^(?:### Domestic Pricing of the Model)\s*$([^]*?)^### Overseas Pricing of the Model/m.exec(
        markdown,
      );
    if (
      !domestic ||
      !markdown.includes('China：RMB / M tokens') ||
      !markdown.includes('Cache Write: Limited-time Free')
    ) {
      throw Error('Missing Xiaomi domestic price scope, unit or cache-write condition');
    }
    const table = only(
      withHeader(tables(domestic[1]), [
        'Inference Type',
        'Model Name',
        'Input (Cache Hit)',
        'Input (Cache Miss)',
        'Output',
      ]),
      'Xiaomi domestic language tariff table',
    );
    const rows = table.slice(1);
    if (
      rows[0]?.[0].text !== '**Real-time API**' ||
      !/\browspan="3"/.test(rows[0][0].attrs) ||
      rows[3]?.[0].text !== '**Batch API**'
    )
      throw Error('Unexpected Xiaomi tariff service rows');
    const realTime = [rows[0].slice(1), ...rows.slice(1, 3)];
    return new Map(
      targets.map((target) => {
        const row = only(
          realTime.filter((row) => row[0]?.text === '\`' + target.modelId + '\`'),
          target.modelId + ' real-time tariff',
        );
        if (row.length !== 4) throw Error('Incomplete Xiaomi tariff: ' + target.modelId);
        const [, hit, input, output] = row;
        return [
          target.quoteId,
          tariff(
            target,
            {
              input: number(input.text, '¥'),
              output: number(output.text, '¥'),
              cache_read: number(hit.text, '¥'),
            },
            { cacheWrite: 'limited-time-free' },
          ),
        ];
      }),
    );
  },
};
