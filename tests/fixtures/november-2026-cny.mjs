import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

const names = ['unified-policy', 'official-catalog', 'proposed-selection', 'coverage-reference'];

export function readHistoricalCny() {
  return names.map((name) =>
    JSON.parse(
      gunzipSync(readFileSync(new URL(`./november-2026-cny/${name}.json.gz`, import.meta.url))),
    ),
  );
}

export function writeHistoricalCny(directory) {
  const values = readHistoricalCny();
  return names.slice(0, 3).map((name, index) => {
    const path = join(directory, name + '.json');
    writeFileSync(path, JSON.stringify(values[index]));
    return path;
  });
}

export function readHistoricalOfficialInputs() {
  const [, catalog, { selection }, reference] = readHistoricalCny();
  return { catalog, selection, reference };
}
