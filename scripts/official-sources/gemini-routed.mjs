import { markdown, requireText, section } from '../official-source-helpers/markdown-table.mjs';
import {
  adapter as standard,
  geminiDeveloperTarget,
  markdocRows,
  standardTariffs,
} from './gemini-developer.mjs';

const routes = new Map([
  ['gemini-3.5-flash', 'gemini-3.6-flash'],
  ['gemini-3.7-flash', 'gemini-3.8-flash'],
]);

export const adapter = {
  id: 'gemini-routed',
  url: standard.url,
  supplemental: [{ id: 'deprecations', url: 'https://aistudio.google.com/docs/deprecations.md' }],
  targets: [...routes.keys()].map((modelId) => ({
    ...geminiDeveloperTarget(modelId),
    referenceOnlyReason:
      'Google documents automatic routing. Billing terms and base rates for the original request ID remain unverified.',
  })),
  parse,
};

function parse({ body, supplemental, evidence }) {
  const read = standardTariffs(markdown(body), evidence.obtainedAt.slice(0, 10));
  const deprecations = markdown(supplemental.get('deprecations').body);
  requireText(deprecations, '# Gemini deprecations');
  const table = section(deprecations, '## Gemini 3 models  {% id="gemini-3-models" %}');
  const rows = [...table.matchAll(/\{% table %\}([\s\S]+?)\{% \/table %\}/g)];
  if (rows.length !== 1) throw Error('Missing or ambiguous Gemini 3 deprecations table');
  const [header, ...models] = markdocRows(rows[0][1]);
  if (header.join('|') !== 'Model|Release date|Shutdown date|Recommended replacement')
    throw Error('Gemini 3 deprecations table columns changed');

  return new Map(
    adapter.targets.map(({ quoteId, modelId }) => {
      try {
        const routedModelId = routes.get(modelId);
        const matches = models.filter(([id]) => id === '`' + modelId + '`');
        const statement =
          `\`${routedModelId}\` (\`${modelId}\` is no longer available in Google AI Studio; ` +
          `the endpoint is not shutting down and automatically routes API requests to \`${routedModelId}\`)`;
        if (
          matches.length !== 1 ||
          matches[0].length !== 4 ||
          matches[0][2] !== 'N/A' ||
          matches[0][3] !== statement
        )
          throw Error('No exact automatic routing documented for Gemini model: ' + modelId);
        const tariff = read(modelId, routedModelId);
        const { cacheMode, explicitCacheStorage } = tariff.conditions;
        if (cacheMode === 'implicit-only' && explicitCacheStorage)
          throw Error(
            'Conflicting explicit cache storage terms for routed Gemini model: ' + modelId,
          );
        if (cacheMode !== 'implicit-only' && !explicitCacheStorage)
          throw Error('Missing explicit cache storage terms for routed Gemini model: ' + modelId);
        return [quoteId, tariff];
      } catch (error) {
        return [quoteId, { error: error.message }];
      }
    }),
  );
}
