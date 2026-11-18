export function markdown(body) {
  return new TextDecoder('utf-8', { fatal: true }).decode(body).replace(/\r\n/g, '\n');
}

export function section(text, heading) {
  const starts = [...text.matchAll(/^#{2,6} .+$/gm)];
  const matching = starts.filter((match) => match[0] === heading);
  if (matching.length !== 1) throw Error('Missing or ambiguous pricing section: ' + heading);
  const start = matching[0];
  const end = starts.find((match) => match.index > start.index);
  return text.slice(start.index + heading.length, end?.index);
}

export function table(text, columns) {
  const rows = text
    .split('\n')
    .filter((line) => line.startsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );
  const [header, separator, ...prices] = rows;
  if (
    !header ||
    header.join('|') !== columns.join('|') ||
    separator?.length !== columns.length ||
    separator.some((cell) => !/^:?-+:?$/.test(cell)) ||
    prices.length === 0
  )
    throw Error('Missing or changed pricing table: ' + columns.join(', '));
  return prices;
}

export function exactRow(rows, predicate, id, columns) {
  const matches = rows.filter(predicate);
  if (matches.length !== 1) throw Error('Exact price row missing or ambiguous: ' + id);
  if (matches[0].length !== columns) throw Error('Incomplete price row: ' + id);
  return matches[0];
}

export function usd(cell, pattern = /^\$(\d+(?:\.\d+)?)$/) {
  const result = pattern.exec(cell);
  if (!result) throw Error('Invalid USD price or unit: ' + cell);
  return Number(result[1]);
}

export function requireText(text, evidence) {
  if (!text.includes(evidence)) throw Error('Missing published price condition: ' + evidence);
}
