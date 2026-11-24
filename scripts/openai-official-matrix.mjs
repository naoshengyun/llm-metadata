import { readFileSync } from 'node:fs';

// Browser expectations come from the independent official evidence excerpt, not pricing_view.
const fixture = readFileSync(
  new URL('../tests/fixtures/openai-pricing-2026-11-24.md', import.meta.url),
  'utf8',
);
const usages = ['input', 'output', 'cache_read', 'cache_write', 'cache_write_12h'];
const sections = {
  Batch: { service: 'Batch', qualifier: '', priceRole: 'service-reference' },
  Fast: { service: 'Fast', qualifier: '', priceRole: 'service-reference' },
  'Ultrafast promotion': {
    service: 'Ultrafast',
    qualifier: 'promotion',
    priceRole: 'promotion-reference',
  },
  'Ultrafast list': { service: 'Ultrafast', qualifier: 'list', priceRole: 'official-list' },
};

export function openAiOfficialRows() {
  const rows = [];
  for (const [heading, identity] of Object.entries(sections)) {
    const start = fixture.indexOf(`### ${heading} pricing data`);
    if (start < 0) throw new Error(`Missing official evidence section: ${heading}`);
    const next = fixture.indexOf('\n### ', start + 4);
    const body = fixture.slice(start, next < 0 ? fixture.length : next);
    for (const line of body.split('\n')) {
      if (!/^\| gpt-6\.2-(?:astra|sol) \|/.test(line)) continue;
      const cells = line.split('|').map((cell) => cell.trim());
      const amounts = cells.slice(2, 12).map((value) => Number(value.replace(/[$,]/g, '')));
      const model = cells[1];
      const short = Object.fromEntries(usages.map((usage, index) => [usage, amounts[index]]));
      const long = Object.fromEntries(usages.map((usage, index) => [usage, amounts[index + 5]]));
      rows.push({
        id: `openai-${model}-${identity.service.toLowerCase()}${identity.qualifier ? `-${identity.qualifier}` : ''}-global-reference`,
        model,
        service: identity.service,
        priceRole: identity.priceRole,
        short,
        long,
      });
    }
  }
  if (rows.length !== 8) throw new Error(`Expected eight official rows, received ${rows.length}`);
  return rows;
}
