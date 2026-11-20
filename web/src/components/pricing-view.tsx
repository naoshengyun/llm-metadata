import type { ReactNode } from 'react';

import { DetailSection } from '@/components/detail-section';
import { OfficialCheckNotice, QuoteOfficialCheck } from '@/components/official-check';
import { Badge } from '@/components/ui/badge';
import type { DisplayPriceQuote, DisplayPriceRow, PricingView } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useI18n, type Locale } from '@/lib/i18n';
import { officialCheckKey, type OfficialCheckView } from '@/lib/official-check';
import {
  localizePrice,
  priceCondition,
  priceLabels,
  priceUnit,
  priceUsage,
  quoteStatus,
} from '@/lib/pricing-display-labels';

type Label = keyof typeof priceLabels;

function msg(locale: Locale, key: Label, values: Record<string, string | number> = {}) {
  return localizePrice(priceLabels[key], locale).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? ''),
  );
}

const moneySymbols: Record<string, string> = { CNY: '¥', USD: '$', EUR: '€' };
const exactMoney = (amount: number, currency: string | null) =>
  `${currency ? (moneySymbols[currency] ?? currency + ' ') : ''}${String(amount)}`;

export function PricingViewSummary({
  view,
  table = false,
}: {
  view: PricingView;
  table?: boolean;
}) {
  const { locale } = useI18n();
  const summary = view.summary;
  const amount = (value: number | null) => (value === null ? '—' : formatMoney('¥', value));
  let price: ReactNode;
  let unit: string | undefined;
  let hint: string | undefined;
  if ('quoteId' in summary) {
    unit = priceUnit(summary.unit, locale);
    if (summary.kind === 'fixed') price = amount(summary.amount);
    else if (summary.kind === 'range') {
      price =
        summary.minimum === summary.maximum
          ? amount(summary.minimum)
          : `${amount(summary.minimum)}–${amount(summary.maximum)}`;
      if (summary.resolutions?.length)
        price = (
          <>
            {price} · {summary.resolutions.join(' / ')}
          </>
        );
    } else {
      if (!table)
        price = (
          <>
            {msg(locale, 'input')} {amount(summary.input)} · {msg(locale, 'output')}{' '}
            {amount(summary.output)}
          </>
        );
    }
    if (summary.kind === 'token-tiers') hint = msg(locale, 'tiered');
    else if (summary.kind === 'range' && summary.hasAdditionalUnits)
      hint = msg(locale, 'moreUnits');
    if (summary.hasMoreConditions && summary.kind !== 'token-tiers') {
      hint = [hint, msg(locale, 'more')].filter(Boolean).join(' · ');
    }
  } else if ('units' in summary) {
    price = msg(locale, 'multi');
    unit = summary.units.map((value) => priceUnit(value, locale)).join(' / ');
  } else {
    price = msg(locale, summary.kind === 'reference-only' ? 'reference' : 'unavailable');
  }

  return (
    <div
      data-pricing-summary={summary.kind}
      data-pricing-provider={view.providerId}
      data-pricing-model={view.modelId}
      className="min-w-0 text-xs leading-relaxed break-words whitespace-normal"
    >
      {price && <span className="font-medium tabular-nums">{price}</span>}
      {unit && (
        <span className="text-muted-foreground">
          {price ? ' · ' : ''}
          {unit}
        </span>
      )}
      {hint && <span className="text-muted-foreground"> · {hint}</span>}
    </div>
  );
}

const columns = {
  input: 'input',
  output: 'output',
  cacheRead: 'cache_read',
  cacheWrite: 'cache_write',
};
export function PricingViewCell({
  view,
  column,
}: {
  view: PricingView;
  column: keyof typeof columns;
}) {
  const { summary } = view;
  if (!('input' in summary)) return <>—</>;
  if (column === 'input' || column === 'output') {
    const value = summary[column];
    return <>{value === null ? '—' : formatMoney('¥', value)}</>;
  }
  const row = view.groups
    .flatMap(({ quotes }) => quotes)
    .find(({ quoteId }) => quoteId === view.selectedQuoteId)
    ?.displayRows.find(
      ({ rowId, usageKey }) => usageKey === columns[column] && rowId === 'cost:' + usageKey,
    );
  return <>{row?.cnyAmount == null ? '—' : formatMoney('¥', row.cnyAmount)}</>;
}

const quoteOrder = ['standard', 'batch', 'flex', 'fast', 'ultrafast', 'priority'];
const serviceLabel = (quote: DisplayPriceQuote) =>
  quote.originalQuote?.officialServiceTier ??
  quote.priceList
    .split('/')
    .map((part) => part.trim())
    .find((part) => quoteOrder.includes(part.toLowerCase())) ??
  '';
function region(quote: DisplayPriceQuote) {
  const conditions = quote.originalQuote?.conditions ?? quote.conditions;
  return (
    quote.originalQuote?.officialRegion ??
    quote.originalQuote?.region ??
    (conditions && typeof conditions === 'object' && 'region' in conditions
      ? String(conditions.region)
      : '')
  );
}
function serviceOrder(quote: DisplayPriceQuote) {
  const index = quoteOrder.indexOf(serviceLabel(quote).toLowerCase());
  return index < 0 ? quoteOrder.length : index;
}

function conditionValue(value: unknown, locale: Locale, key: string): ReactNode {
  if (value === null || value === undefined) return '—';
  if (key === 'video_input' && ['none', 'video', 'present'].includes(String(value)))
    return priceUsage(value === 'none' ? 'videoInputNone' : 'videoInputPresent', locale);
  if (key === 'basis' && value === 'input-and-output-seconds')
    return localizePrice(
      ['Input and output video seconds', '输入与输出视频秒数', '入力と出力の動画秒数'],
      locale,
    );
  if (key === 'textUnit' || key.endsWith('Unit')) return priceUnit(String(value), locale);
  if (typeof value === 'boolean')
    return value
      ? localizePrice(['Yes', '是', 'はい'], locale)
      : localizePrice(['No', '否', 'いいえ'], locale);
  if (Array.isArray(value) && value.every((part) => part === null || typeof part !== 'object'))
    return value.join(' / ');
  if (Array.isArray(value))
    return (
      <ul className="list-disc pl-4">
        {value.map((item, i) => (
          <li key={i}>{conditionValue(item, locale, key)}</li>
        ))}
      </ul>
    );
  if (typeof value === 'object')
    return <Conditions values={Object.fromEntries(Object.entries(value))} locale={locale} />;
  if (value === 'announced' && key === 'priceState')
    return localizePrice(['Announced', '已公布', '発表済み'], locale);
  return String(value);
}

const freeLabel = (locale: Locale, value: unknown, usage: string) =>
  msg(locale, usage === 'input_images' ? 'freeImages' : 'free', { quantity: Number(value) });

function Conditions({
  values,
  locale,
  usage,
}: {
  values: Record<string, unknown>;
  locale: Locale;
  usage?: string;
}) {
  const entries = Object.entries(values).filter(
    ([, value]) =>
      value !== undefined &&
      !(value && typeof value === 'object' && Object.keys(value).length === 0),
  );
  if (!entries.length) return null;
  return (
    <ul className="space-y-0.5 break-words whitespace-normal">
      {entries.map(([key, value]) => (
        <li key={key} data-condition={key}>
          {key === 'freeQuantity' && usage ? (
            freeLabel(locale, value, usage)
          ) : ['officialCondition', 'condition', 'tierName'].includes(key) ? (
            String(value)
          ) : (
            <>
              <span className="font-medium">{priceCondition(key, locale)}</span>
              {(key !== 'failedTasksFree' && key !== 'videoInputTokenMinimum') || value !== true ? (
                <> · {conditionValue(value, locale, key)}</>
              ) : null}
            </>
          )}
        </li>
      ))}
    </ul>
  );
}

const rateSection = (row: DisplayPriceRow) =>
  typeof row.conditions.serviceTier === 'string' ? row.conditions.serviceTier : '';
const rateScope = (row: DisplayPriceRow) =>
  row.rowId
    .split(':')
    .slice(0, -1)
    .filter((part) => !/^tier-\d+$/.test(part))
    .join(':');
const tierNumber = (row: DisplayPriceRow) =>
  row.tier?.size ?? (typeof row.conditions.above === 'number' ? row.conditions.above : null);

function tierCondition(row: DisplayPriceRow, sectionRows: DisplayPriceRow[], locale: Locale) {
  const related = sectionRows.filter((candidate) => rateScope(candidate) === rateScope(row));
  const thresholds = [...new Set(related.map(tierNumber).filter((n) => n !== null))].sort(
    (a, b) => a - b,
  );
  if (!thresholds.length || !row.rowId.match(/^(?:cost|raw|service|fees):/)) return null;
  const threshold = tierNumber(row);
  const low = threshold === null;
  // Explicit conditional fee descriptions provide their own direction.
  if (low && typeof row.conditions.condition === 'string' && row.rowId.startsWith('fees:'))
    return null;
  const upper = low ? thresholds[0] : thresholds[thresholds.indexOf(threshold) + 1];
  const numbers = low
    ? msg(locale, 'inclusive', { size: upper })
    : upper
      ? msg(locale, 'between', { from: threshold + 1, to: upper })
      : msg(locale, 'over', { size: threshold + 1 });
  const type = row.tier?.type ?? related.find(({ tier }) => tier)?.tier?.type;
  return `${msg(locale, type === 'context' ? 'tokContext' : 'tokInput')} · ${numbers} · ${msg(locale, 'wholeRequest')}`;
}

function defaultCacheTtl(quote: DisplayPriceQuote): string | undefined {
  const declared = quote.originalQuote?.feeDeclarations?.find(
    ({ field }) => field === 'cache_write',
  )?.retention;
  if (declared) return declared;
  const description = quote.originalQuote?.description ?? '';
  return (
    /cache_write\s*(?:=|is)\s*(\d+)(?:\s*[- ]?minutes?\b|m\b)/i.exec(description)?.[1] ??
    /\b(\d+)m\/\d+h writes\b/i.exec(quote.reason ?? '')?.[1]
  );
}

function relatedCacheQuote(quote: DisplayPriceQuote, quotes: DisplayPriceQuote[]) {
  return quotes.find(
    (sibling) =>
      sibling !== quote &&
      sibling.originalQuote &&
      !!quote.source.url &&
      sibling.source.url === quote.source.url &&
      !!defaultCacheTtl(sibling) &&
      ['cache_write_1h', 'cache_write_12h'].some(
        (meter) =>
          quote.displayRows.some(({ usageKey }) => usageKey === meter) &&
          sibling.displayRows.some(({ usageKey }) => usageKey === meter),
      ),
  );
}

function RateTable({
  rows,
  locale,
  quote,
  ttl,
  cacheDeclarations,
  common,
}: {
  rows: DisplayPriceRow[];
  locale: Locale;
  quote: DisplayPriceQuote;
  ttl?: string;
  cacheDeclarations?: NonNullable<DisplayPriceQuote['originalQuote']>['feeDeclarations'];
  common: Record<string, unknown>;
}) {
  const groupName = rateSection(rows[0]);
  const unitName = priceUnit(rows[0].unit, locale);
  const hasConditions = rows.some(
    (row) =>
      row.tier ||
      cacheDeclarations?.some(({ field, condition }) => field === row.usageKey && condition) ||
      Object.keys(row.conditions).some((key) => !(key in common) && key !== 'serviceTier'),
  );
  return (
    <div className="min-w-0 space-y-2">
      {groupName && (
        <h4 className="text-sm font-medium" data-service-tier={groupName}>
          {groupName}
        </h4>
      )}
      <div
        className="max-w-full overflow-x-auto rounded-md border"
        role="region"
        aria-label={unitName}
        tabIndex={0}
      >
        <table className="w-full text-left text-xs" aria-label={unitName}>
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-2.5 py-2 font-medium" scope="col">
                {msg(locale, 'usage')}
              </th>
              <th className="px-2.5 py-2 font-medium" scope="col">
                {msg(locale, quote.originalCurrencyEligible === false ? 'reported' : 'source')}
              </th>
              <th className="px-2.5 py-2 font-medium" scope="col">
                {msg(locale, 'cny')}
              </th>
              {hasConditions && (
                <th className="min-w-36 px-2.5 py-2 font-medium" scope="col">
                  {msg(locale, 'conditions')}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const conditions = Object.fromEntries(
                Object.entries(row.conditions).filter(
                  ([key, value]) =>
                    !['tier', 'serviceTier', 'above'].includes(key) &&
                    !(key in common && JSON.stringify(common[key]) === JSON.stringify(value)),
                ),
              );
              const label = priceUsage(row.usageKey, locale);
              const tier = tierCondition(row, rows, locale);
              const cacheCondition = cacheDeclarations?.find(
                ({ field, condition }) => field === row.usageKey && condition,
              )?.condition;
              const cacheTtl = row.usageKey === 'cache_write' ? ttl?.replace(/m$/, '') : undefined;
              const ttlLabel =
                cacheTtl && /^\d+$/.test(cacheTtl)
                  ? ` · ${cacheTtl} ${localizePrice(['min', '分钟', '分'], locale)}`
                  : '';
              const source =
                row.amount === null
                  ? (row.sourceValue ?? '—')
                  : exactMoney(row.amount, row.currency);
              return (
                <tr
                  key={row.rowId}
                  data-pricing-row={row.rowId}
                  data-unit={row.unit ?? ''}
                  data-source-currency={row.currency ?? ''}
                  data-source-amount={row.amount ?? ''}
                  data-cny-amount={row.cnyAmount ?? ''}
                  className="border-t align-top"
                >
                  <th className="px-2.5 py-2 text-left font-medium" scope="row">
                    {label}
                    {ttlLabel}
                    <span className="text-muted-foreground block font-normal">{unitName}</span>
                  </th>
                  <td className="px-2.5 py-2 tabular-nums">
                    {source}
                    {row.currency && (
                      <span className="text-muted-foreground block">{row.currency}</span>
                    )}
                  </td>
                  <td className="px-2.5 py-2 tabular-nums">
                    {row.cnyAmount === null ? '—' : exactMoney(row.cnyAmount, row.cnyCurrency)}
                  </td>
                  {hasConditions && (
                    <td className="px-2.5 py-2 space-y-1">
                      {tier && <p>{tier}</p>}
                      {cacheCondition && <p>{cacheCondition}</p>}
                      <Conditions values={conditions} locale={locale} usage={row.usageKey} />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuoteArticle({
  quote,
  groupId,
  cacheQuote,
  children,
}: {
  quote: DisplayPriceQuote;
  groupId: string;
  cacheQuote?: DisplayPriceQuote;
  children?: ReactNode;
}) {
  const { locale } = useI18n();
  const sections = new Map<string, DisplayPriceRow[]>();
  for (const row of quote.displayRows) {
    const key = JSON.stringify([rateSection(row), row.unit]);
    const section = sections.get(key);
    if (section) section.push(row);
    else sections.set(key, [row]);
  }
  const details = quote.originalQuote?.conditions ?? quote.conditions;
  const quoteConditions: Record<string, unknown> = {
    ...(details && typeof details === 'object' ? details : {}),
    ...(typeof details === 'string' ? { officialCondition: details } : {}),
    ...(quote.originalQuote?.effectiveAt ? { effectiveAt: quote.originalQuote.effectiveAt } : {}),
  };
  for (const key of ['minimumUsage', 'draft', 'rounding']) {
    const value = quote.displayRows[0]?.conditions[key];
    if (
      typeof value === 'string' &&
      quote.displayRows.every((row) => row.conditions[key] === value)
    )
      quoteConditions[key] = value;
  }
  const date = quote.source.checkedAt ?? quote.source.snapshotAt;
  const digest = quote.source.recordSha256 ?? quote.source.sha256 ?? quote.source.upstreamSha;
  return (
    <article
      className="min-w-0 rounded-lg border bg-card px-3 py-2.5 sm:px-4"
      data-quote-id={quote.quoteId}
      data-pricing-group={groupId}
      data-syncable={String(quote.syncable)}
      data-quote-status={quote.status}
    >
      <details open={quote.originalCurrencyEligible !== false}>
        <summary className="cursor-pointer leading-relaxed break-words">
          <h3 className="inline text-sm font-semibold">{quote.priceList}</h3>
          <Badge className="ml-2 align-middle" variant={quote.syncable ? 'default' : 'secondary'}>
            {msg(locale, quote.syncable ? 'selected' : 'reference')}
          </Badge>
        </summary>
        <div className="mt-2 space-y-3 text-xs break-words whitespace-normal">
          {quote.displayExamples?.map(
            ({ resolution, inputSeconds, outputSeconds, amount, currency }) => (
              <p
                key={resolution}
                data-price-example={resolution}
                className="rounded-md bg-muted/40 px-2.5 py-2 font-medium"
              >
                {msg(locale, 'example', {
                  resolution,
                  input: inputSeconds,
                  output: outputSeconds,
                  amount: exactMoney(amount, currency),
                })}
              </p>
            ),
          )}
          {[...sections.entries()].map(([key, rows]) => (
            <RateTable
              key={key}
              rows={rows}
              locale={locale}
              quote={quote}
              common={quoteConditions}
              cacheDeclarations={
                quote.originalQuote?.feeDeclarations ?? cacheQuote?.originalQuote?.feeDeclarations
              }
              ttl={defaultCacheTtl(quote) ?? (cacheQuote ? defaultCacheTtl(cacheQuote) : undefined)}
            />
          ))}
          <div className="text-muted-foreground space-y-0.5">
            <p className="font-mono break-all">{quote.quoteId}</p>
            {quote.nativeKey && (
              <p>
                {msg(locale, 'native')} · {quote.nativeKey}
              </p>
            )}
            {quote.endpoint && (
              <p>
                {msg(locale, 'endpoint')} · {quote.endpoint}
              </p>
            )}
            {!!region(quote) && (
              <p>
                {priceCondition('region', locale)} · {region(quote)}
              </p>
            )}
            {date && (
              <p>
                {msg(locale, quote.source.checkedAt ? 'evidence' : 'snapshot')} ·{' '}
                <time dateTime={date}>{date}</time>
              </p>
            )}
            {quote.source.url && (
              <a
                className="underline underline-offset-2"
                href={quote.source.url}
                target="_blank"
                rel="noreferrer"
              >
                {msg(locale, 'sourceLink')}
              </a>
            )}
          </div>
          <div className="space-y-0.5">
            {!['ready', 'reference-only'].includes(quote.status) && (
              <p>{quoteStatus(quote.status, locale)}</p>
            )}
            {quote.reason && <p>{quote.reason}</p>}
            {quote.originalCurrencyEligible === false && <p>{msg(locale, 'missingBasis')}</p>}
            {(quote.syncable || quote.verification?.officialPrice) && (
              <p>{msg(locale, 'hasPrice')}</p>
            )}
            {quote.syncable && (
              <>
                <p>{msg(locale, 'expressible')}</p>
                <p>{msg(locale, 'saved')}</p>
                <p>{msg(locale, 'actual')}</p>
              </>
            )}
            {quote.verification && (
              <ul className="space-y-0.5">
                <li>
                  <a className="underline" href={quote.verification.modelExpressionImportEvidence}>
                    {msg(locale, 'seedanceImport')}
                  </a>
                </li>
                {!quote.verification.actual4kBillingVerified && (
                  <li>
                    <a className="underline" href={quote.verification.decision}>
                      {msg(locale, 'seedanceUsage')}
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>
          {children}
          {quote.originalQuote?.description && <p>{quote.originalQuote.description}</p>}
          {Object.keys(quoteConditions).length > 0 && (
            <div className="space-y-1">
              <h4 className="font-medium">{msg(locale, 'conditions')}</h4>
              <Conditions values={quoteConditions} locale={locale} />
            </div>
          )}
          <details className="text-muted-foreground">
            <summary className="cursor-pointer underline-offset-2 hover:underline">
              {msg(locale, 'audit')}
            </summary>
            {digest && (
              <p className="mt-1 break-all">
                {msg(locale, 'digest')} · {digest}
              </p>
            )}
            <pre className="mt-1 max-h-72 overflow-auto rounded-md border p-2 text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(quote.originalQuote ?? quote.sourcePrice, null, 2)}
            </pre>
          </details>
        </div>
      </details>
    </article>
  );
}

export function PricingViewQuotes({
  view,
  check,
  compact = false,
}: {
  view: PricingView;
  check?: OfficialCheckView;
  compact?: boolean;
}) {
  const { locale } = useI18n();
  const quotes = view.groups
    .flatMap(({ groupId, quotes }) => quotes.map((quote) => ({ groupId, quote })))
    .sort(
      (a, b) =>
        Number(b.quote.selected) - Number(a.quote.selected) ||
        serviceOrder(a.quote) - serviceOrder(b.quote) ||
        region(a.quote).localeCompare(region(b.quote), 'en') ||
        (a.quote.endpoint ?? '').localeCompare(b.quote.endpoint ?? '', 'en') ||
        a.quote.quoteId.localeCompare(b.quote.quoteId, 'en'),
    );
  if (!quotes.length) return null;
  const content = (
    <div className="grid min-w-0 gap-3">
      {check && <OfficialCheckNotice view={check} />}
      {quotes.map(({ quote, groupId }) => {
        const cacheQuote = quote.originalQuote
          ? relatedCacheQuote(
              quote,
              quotes.map((entry) => entry.quote),
            )
          : undefined;
        return (
          <QuoteArticle key={quote.quoteId} quote={quote} groupId={groupId} cacheQuote={cacheQuote}>
            {check?.results && (
              <QuoteOfficialCheck
                result={check.results.get(
                  officialCheckKey(view.providerId, view.modelId, quote.quoteId),
                )}
              />
            )}
          </QuoteArticle>
        );
      })}
    </div>
  );
  return compact ? content : <DetailSection title={msg(locale, 'title')}>{content}</DetailSection>;
}
