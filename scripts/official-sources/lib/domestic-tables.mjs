export function htmlText(html) {
  return html
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|nbsp|yen|quot|#\d+|#x[\da-f]+);/gi, (_, entity) => {
      if (entity.startsWith('#')) {
        return String.fromCodePoint(
          entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1)),
        );
      }
      return { amp: '&', lt: '<', gt: '>', nbsp: ' ', yen: '¥', quot: '"' }[entity];
    })
    .replace(/[\s\u200b]+/g, ' ')
    .trim();
}

export function tables(html) {
  return [...html.matchAll(/<table\b[^>]*>([^]*?)<\/table>/gi)].map(([, table]) =>
    [...table.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/gi)].map(([, row]) =>
      [...row.matchAll(/<t([dh])\b([^>]*)>([^]*?)<\/t\1>/gi)].map(([, , attrs, content]) => ({
        attrs,
        content,
        text: htmlText(content),
      })),
    ),
  );
}

export function only(items, label) {
  if (items.length !== 1) throw Error(label + ' missing or ambiguous');
  return items[0];
}

export function withHeader(all, headers) {
  return all.filter(
    ([row]) =>
      row?.length === headers.length &&
      row.every(({ text }, i) => text.replace(/\*\*/g, '') === headers[i]),
  );
}

export function number(text, currency = '') {
  if (!text.startsWith(currency) || !/^\d+(?:\.\d+)?$/.test(text.slice(currency.length))) {
    throw Error('Unexpected official amount: ' + text);
  }
  return Number(text.slice(currency.length));
}

export const decode = (body) => new TextDecoder('utf-8', { fatal: true }).decode(body);

export function standardTarget(providerId, endpoint, modelId, priceList, quoteId, group = modelId) {
  return { quoteId, providerId, endpoint, modelId, priceList, currency: 'CNY', group };
}

export function tariff(target, sourcePrice, conditions, sourceUnit = 'per_million_tokens') {
  const { providerId, endpoint, modelId, priceList, currency } = target;
  return {
    identity: { providerId, endpoint, modelId, priceList, currency },
    sourcePrice,
    sourceUnit,
    required: Object.keys(sourcePrice),
    conditions,
  };
}
