import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateCny, type CnyInput } from './generate.js';
import { buildArtifact, semanticDiff, type FixedArtifact } from './artifact.js';

// Explicit snapshot input; never fetches prices or applies configuration.
const [inputPath, outputPath, previousPath] = process.argv.slice(2);
if (!inputPath || !outputPath)
  throw new Error(
    'Usage: npm run cny:generate -- input.json output-directory [previous-artifact.json]',
  );
const output = resolve(outputPath);
if (output === resolve('dist') || output.startsWith(resolve('dist') + '/'))
  throw new Error('CNY artifacts must be outside upstream dist');
const input = JSON.parse(readFileSync(inputPath, 'utf8')) as CnyInput;
const result = generateCny(input);
const artifact = buildArtifact({
  sourceSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  data: input.upstream,
  quotes: input.records,
  selection: input.selection,
  models: result.models,
  plugins: result.plugins,
  tools: result.tools,
  exclusions: result.diagnostics.filter((d) => d.status !== 'ready'),
});
mkdirSync(output, { recursive: true });
for (const [name, value] of Object.entries({
  artifact,
  catalog: result.catalog,
  diagnostics: result.diagnostics,
  ratio_config: {
    data: {
      billing_mode: Object.fromEntries(
        Object.entries(result.models).map(([key, value]) => [key, value.billing_mode]),
      ),
      billing_expr: Object.fromEntries(
        Object.entries(result.models).map(([key, value]) => [key, value.billing_expr]),
      ),
    },
  },
  plugin_prices: result.plugins,
  tool_prices: { 'tool_price_setting.prices': result.tools },
  ...(previousPath
    ? {
        semantic_diff: semanticDiff(
          JSON.parse(readFileSync(previousPath, 'utf8')) as FixedArtifact,
          artifact,
        ),
      }
    : {}),
}))
  writeFileSync(join(output, `${name}.json`), JSON.stringify(value, null, 2) + '\n');
console.log(
  JSON.stringify({ artifactId: artifact.id, complete: artifact.manifest.complete, output }),
);
