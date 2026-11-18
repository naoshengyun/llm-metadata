export function tables(html) {
  return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(([, table]) =>
    [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
      [...row.matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi)].map(
        ([, tag, attributes, html]) => ({
          tag,
          html,
          text: textContent(html),
          rowSpan: Number(/\browspan="(\d+)"/i.exec(attributes)?.[1] ?? 1),
        }),
      ),
    ),
  );
}

export function textContent(html) {
  return html
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->|<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
