import { readFileSync } from 'node:fs';

const fixture = readFileSync(
  new URL('../tests/fixtures/openai-background-windows-2026-11-24.md', import.meta.url),
  'utf8',
);
const comment = (name) => new RegExp(`<!-- ${name}: (.+) -->`).exec(fixture)?.[1];
export const backgroundEvidence = {
  pricing: { url: comment('pricing-url'), sha256: comment('pricing-sha256'), checkedAt: comment('checked-at') },
  flexGuide: { url: comment('flex-guide-url'), sha256: comment('flex-guide-sha256'), checkedAt: comment('checked-at') },
  backgroundGuide: { url: comment('background-guide-url'), sha256: comment('background-guide-sha256'), checkedAt: comment('checked-at') },
};

export function openAiBackgroundRows() {
  const start = fixture.indexOf('### Standard base pricing data');
  const end = fixture.indexOf('\n### ', start + 4);
  const body = fixture.slice(start, end);
  const models = [];
  for (const line of body.split('\n')) {
    if (!line.startsWith('| gpt-')) continue;
    const cells = line.split('|').map((cell) => cell.trim());
    const amounts = cells.slice(2, 12).map((value) => Number(value.replace(/[$,]/g, '')));
    const model = cells[1];
    models.push({
      model,
      baseQuoteId: model.startsWith('gpt-6.2-') ? `us-openai-${model}-global-standard` : `us-openai-${model}-standard`,
      short: amounts.slice(0, 5),
      long: amounts.slice(5, 10),
    });
  }
  if (models.length !== 4) throw new Error(`Expected four official background models, got ${models.length}`);
  const rows = [];
  for (const base of models)
    for (const [completionWindow, officialMultiplier] of [['2h', 0.7], ['8h', 0.6]])
      rows.push({
        ...base,
        id: `openai-${base.model}-standard-background-${completionWindow}-global-reference`,
        completionWindow,
        officialMultiplier,
        priceList: `OpenAI API / Standard / global / background ${completionWindow}`,
        priceRole: 'background-reference',
        conditions: {
          processing: 'standard',
          api: 'responses',
          completionWindow,
          completionTarget: 'accepted-initial-response',
          officialMultiplier,
          background: true,
          serviceTier: 'default',
          autoServiceTier: 'only-standard-eligible',
          stream: false,
          rateLimit: 'batch-background-shared',
          inputTokenAccounting: 'at-submission',
          followUpDiscount: 'eligible-requests-including-follow-ups',
          followUpIdentity: 'same-project-model-tier-window-continuation',
          cacheReuse: 'outside-window-disabled',
          rateDerivation: 'meter-specific-application-unverified',
          baseQuoteId: base.baseQuoteId,
        },
      });
  return rows;
}
