import type { ReactNode } from 'react';

import { DetailSection } from '@/components/detail-section';
import { OfficialCheckNotice, QuoteOfficialCheck } from '@/components/official-check';
import { Badge } from '@/components/ui/badge';
import type { DisplayPriceQuote, DisplayPriceRow, PricingView } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { priceExplanation } from '@/lib/pricing-explanation';
import { priceDescription } from '@/lib/pricing-description';
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

const serviceTiers = [
  { key: 'standard', name: 'Standard' },
  { key: 'batch', name: 'Batch' },
  { key: 'flex', name: 'Flex' },
  { key: 'fast', name: 'Fast' },
  { key: 'ultrafast', name: 'Ultrafast' },
  { key: 'priority', name: 'Priority' },
];
const quoteOrder = serviceTiers.map(({ key }) => key);
const serviceNames = Object.fromEntries(serviceTiers.map(({ key, name }) => [key, name]));
const isUpstreamQuote = (quote: DisplayPriceQuote) => quote.quoteId.startsWith('upstream:');
const priceListParts = (quote: DisplayPriceQuote) =>
  quote.priceList.split('/').map((part) => part.trim());
const serviceTierKey = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return quoteOrder.find(
    (key) => normalized === key || new RegExp(`\\b${key}\\b`, 'i').test(normalized),
  );
};
function priceListIdentity(quote: DisplayPriceQuote) {
  const parts = priceListParts(quote);
  const serviceIndex = parts.findIndex((part) => serviceTierKey(part));
  const key = serviceIndex < 0 ? undefined : serviceTierKey(parts[serviceIndex]);
  return {
    provider: serviceIndex > 0 ? parts[0] : '',
    serviceName: key ? serviceNames[key] : '',
    qualifier: serviceIndex < 0 ? '' : parts.slice(serviceIndex + 1).join(' / '),
  };
}
const serviceLabel = (quote: DisplayPriceQuote) => {
  const explicit = quote.originalQuote?.officialServiceTier;
  const explicitKey = explicit ? serviceTierKey(explicit) : undefined;
  return explicitKey ? serviceNames[explicitKey] : priceListIdentity(quote).serviceName;
};
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
function priceListScopeQualifier(quote: DisplayPriceQuote) {
  const explicit = region(quote);
  return explicit || priceListIdentity(quote).qualifier;
}
function serviceOrderName(name: string) {
  const key = serviceTierKey(name);
  return key ? quoteOrder.indexOf(key) : quoteOrder.length;
}
const anchorPart = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, '-');

type QuoteEntry = {
  quote: DisplayPriceQuote;
  groupId: string;
  rows: DisplayPriceRow[];
  entryKey: string;
  serviceName: string;
  entryId: string;
  qualifier: string;
  endpoint: string;
};

type QuoteScope = {
  qualifier: string;
  endpoint: string;
  referenceKind: 'official' | 'upstream';
  entries: QuoteEntry[];
};

function entryDisplayName(entry: QuoteEntry, locale: Locale) {
  const upstream = isUpstreamQuote(entry.quote);
  const base = upstream
    ? entry.quote.selected
      ? msg(locale, 'selectedTariff')
      : entry.serviceName === entry.quote.priceList
        ? msg(locale, 'upstreamRecord')
        : entry.serviceName
    : entry.serviceName;
  const role = entry.quote.originalQuote?.priceRole;
  const roleLabel =
    role === 'official-list'
      ? msg(locale, 'listPrice')
      : role === 'promotion-reference'
        ? msg(locale, 'promotionReference')
        : role === 'background-reference'
          ? msg(
              locale,
              entry.quote.originalQuote?.completionWindow === '8h'
                ? 'backgroundWindow8h'
                : 'backgroundWindow2h',
            )
          : '';
  return [base, roleLabel].filter(Boolean).join(' · ');
}

function quoteEntries(groupId: string, quote: DisplayPriceQuote): QuoteEntry[] {
  const base = {
    quote,
    groupId,
    qualifier: priceListScopeQualifier(quote),
    endpoint: quote.endpoint ?? '',
  };
  const serviceSections = new Map<string, DisplayPriceRow[]>();
  const baseRows: DisplayPriceRow[] = [];
  for (const row of quote.displayRows) {
    const section = rateSection(row);
    if (!section) baseRows.push(row);
    else {
      const rows = serviceSections.get(section);
      if (rows) rows.push(row);
      else serviceSections.set(section, [row]);
    }
  }
  const makeEntry = (name: string, rows: DisplayPriceRow[]): QuoteEntry => {
    const key = serviceTierKey(name) ?? 'other';
    return {
      ...base,
      rows,
      entryKey: key,
      serviceName: name || quote.priceList,
      entryId: `${quote.quoteId}::${key}`,
    };
  };
  if (!serviceSections.size)
    return [makeEntry(serviceLabel(quote), quote.displayRows)].map((entry, index) => ({
      ...entry,
      entryId: `${quote.quoteId}::${index + 1}-${entry.entryKey}`,
    }));
  const entries: QuoteEntry[] = [];
  if (baseRows.length) entries.push(makeEntry(serviceLabel(quote), baseRows));
  for (const [name, rows] of serviceSections) entries.push(makeEntry(name, rows));
  return entries.map((entry, index) => ({
    ...entry,
    entryId: `${quote.quoteId}::${index + 1}-${entry.entryKey}`,
  }));
}

function conditionValue(value: unknown, locale: Locale, key: string): ReactNode {
  if (value === null || value === undefined) return '—';
  if (key === 'processing' && value === 'standard') return 'Standard';
  if (key === 'serviceTier' && value === 'default') return 'default (Standard)';
  if (key === 'completionWindow' && (value === '2h' || value === '8h'))
    return value === '2h'
      ? localizePrice(['2 hours', '2 小时', '2 時間'], locale)
      : localizePrice(['8 hours', '8 小时', '8 時間'], locale);
  if (key === 'api' && value === 'responses') return 'Responses API';
  if (key === 'completionTarget' && value === 'accepted-initial-response')
    return localizePrice(
      [
        'Starts when the API accepts the initial request',
        '从 API 接受初始请求开始',
        'API が最初のリクエストを受け付けた時点から',
      ],
      locale,
    );
  if (key === 'followUpDiscount' && value === 'eligible-requests-including-follow-ups')
    return localizePrice(
      [
        'Every eligible request, including follow-ups',
        '适用于每个合格请求（含后续请求）',
        'フォローアップを含むすべての対象リクエストに適用',
      ],
      locale,
    );
  if (key === 'autoServiceTier' && value === 'only-standard-eligible')
    return localizePrice(
      [
        'Eligible only if the API selects Standard',
        '仅当 API 选择 Standard 时符合折扣条件',
        'API が Standard を選択した場合のみ割引対象',
      ],
      locale,
    );
  if (key === 'rateLimit' && value === 'batch-background-shared')
    return localizePrice(
      ['Shared with Batch API jobs', '与 Batch API 任务共享', 'Batch API ジョブと共有'],
      locale,
    );
  if (key === 'inputTokenAccounting' && value === 'at-submission')
    return localizePrice(['Counted at submission', '提交时计数', '送信時にカウント'], locale);
  if (key === 'followUpIdentity' && value === 'same-project-model-tier-window-continuation')
    return localizePrice(
      [
        'Same project, model, processing mode, completion window and continuation ID',
        '同一项目、型号、处理模式、完成窗口和 continuation ID',
        '同一プロジェクト・モデル・処理モード・完了期間・continuation ID',
      ],
      locale,
    );
  if (key === 'officialMultiplier' && (value === 0.7 || value === 0.6)) {
    const discount = value === 0.7 ? 30 : 40;
    return localizePrice(
      [
        `${value} (${discount}% below Standard)`,
        `${value}（比 Standard 低 ${discount}%）`,
        `${value}（Standard より ${discount}% 低い）`,
      ],
      locale,
    );
  }
  if (
    key === 'scheduleApplicability' &&
    value === 'weekdays-ignore-chinese-legal-holidays-and-adjusted-workdays'
  )
    return localizePrice(
      [
        'Weekdays only; Chinese statutory holidays and adjusted workdays are ignored',
        '仅按周一至周五周历；忽略中国法定节假日和调休',
        '平日のみの週暦。中国の法定休日・振替勤務は考慮しない',
      ],
      locale,
    );
  if (key === 'cacheMode' && (value === 'explicit' || value === 'implicit'))
    return localizePrice(
      value === 'explicit'
        ? ['Explicit cache', '显式缓存', '明示キャッシュ']
        : ['Implicit cache', '隐式缓存', '暗黙キャッシュ'],
      locale,
    );
  if (key === 'cacheReuse' && value === 'outside-window-disabled')
    return localizePrice(
      [
        'Requests outside discounted windows cannot reuse cache entries created by 2h or 8h background requests',
        '窗口外的 Standard 请求不能复用由 2 小时或 8 小时后台请求创建的缓存条目',
        '割引期間外の Standard リクエストでは、2 時間または 8 時間のバックグラウンドリクエストで作成したキャッシュを再利用できません',
      ],
      locale,
    );
  if (key === 'rateDerivation' && value === 'meter-specific-application-unverified')
    return localizePrice(
      [
        'Not shown · official sources do not itemize applicability to input, output, cache reads, 30m/12h writes, or long-context rates',
        '不显示推导价 · 官方未逐项说明输入、输出、缓存读取、30 分钟/12 小时缓存写入及高上下文费率是否适用该倍率',
        '算出料金は未表示・入力・出力・キャッシュ読取・30 分/12 時間のキャッシュ書込・長コンテキスト料金への適用が公式に項目別で示されていません',
      ],
      locale,
    );
  if (
    key === 'minimumUsage' &&
    value ===
      'Only successful video tasks are billed. Inputs that include video have a minimum token charge based on output resolution, aspect ratio, and duration. The actual charged token usage is API usage.completion_tokens.'
  )
    return localizePrice(
      [
        'Only successful video tasks are billed, using the output token count reported by the API. Video inputs have a minimum token charge based on output resolution, aspect ratio and duration.',
        '仅成功的视频任务收费，按接口返回的输出 Token 数计费。输入视频的最低 Token 计费量取决于输出分辨率、宽高比和时长。',
        '成功した動画タスクのみ、APIが返す出力トークン数で課金します。入力動画の最低トークン課金量は出力解像度・縦横比・時間によって決まります。',
      ],
      locale,
    );
  if (key === 'billingUsage' && value === 'usage.completion_tokens')
    return localizePrice(
      [
        'Output tokens reported by the API',
        '接口返回的输出 Token 数',
        'API が返した出力トークン数',
      ],
      locale,
    );
  if (key === 'fallback' && value === 'off_peak')
    return localizePrice(
      [
        'Off-peak · outside the listed peak times',
        '非高峰 · 所列高峰时段之外',
        'オフピーク・記載のピーク時間帯以外',
      ],
      locale,
    );
  if (key === 'chineseLegalHolidays' && value === 'off_peak')
    return localizePrice(['Off-peak rate', '适用非高峰价', 'オフピーク料金'], locale);
  if (key === 'name' && value === 'peak') return localizePrice(['Peak', '高峰', 'ピーク'], locale);
  if (
    key === 'outsideShortOutput' &&
    typeof value === 'object' &&
    'maxInput' in value &&
    'maxOutput' in value
  ) {
    return localizePrice(
      [
        `Input tokens > ${value.maxInput} or output tokens > ${value.maxOutput}`,
        `输入 Token > ${value.maxInput} 或输出 Token > ${value.maxOutput}`,
        `入力トークン > ${value.maxInput} または出力トークン > ${value.maxOutput}`,
      ],
      locale,
    );
  }
  if (key === 'video_input' && ['none', 'video', 'present'].includes(String(value)))
    return priceUsage(value === 'none' ? 'videoInputNone' : 'videoInputPresent', locale);
  if (key === 'basis' && value === 'input-and-output-seconds')
    return localizePrice(
      ['Input and output video seconds', '输入与输出视频秒数', '入力と出力の動画秒数'],
      locale,
    );
  if (key === 'unit' || key.endsWith('Unit')) return priceUnit(String(value), locale);
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
        <li key={key} data-condition={key} data-condition-value={JSON.stringify(value)}>
          {key === 'freeQuantity' && usage ? (
            freeLabel(locale, value, usage)
          ) : ['officialCondition', 'condition', 'tierName'].includes(key) ? (
            String(value)
          ) : (
            <>
              <span className="font-medium">{priceCondition(key, locale)}</span>
              {!['failedTasksFree', 'videoInputTokenMinimum', 'referenceFee'].includes(key) ||
              value !== true ? (
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
const legacyTier = (row: DisplayPriceRow) => row.rowId.split(':').includes('context_over_200k');
const rateScope = (row: DisplayPriceRow) =>
  row.rowId
    .split(':')
    .slice(0, -1)
    .filter((part) => !/^tier-\d+$/.test(part) && part !== 'context_over_200k')
    .join(':');

function lastLowerBandToken(row: DisplayPriceRow, structuredTiers: boolean) {
  if (row.tier?.size) return row.tier.comparison === 'gte' ? row.tier.size - 1 : row.tier.size;
  if (typeof row.conditions.above === 'number') return row.conditions.above;
  return !structuredTiers && legacyTier(row) ? 200_000 : null;
}

function lastPublishedInputToken({ inputBands, inputOutputBands }: DisplayPriceRow['conditions']) {
  const bands = inputBands ?? inputOutputBands;
  if (!Array.isArray(bands)) return undefined;
  const last: unknown = bands.at(-1);
  if (
    last &&
    typeof last === 'object' &&
    'upper' in last &&
    typeof last.upper === 'number' &&
    Number.isSafeInteger(last.upper)
  )
    return last.upper;
  if (typeof last !== 'string') return undefined;
  const bound = /^输入(?:长度)?\s*\[\d+[KM]?,\s*(\d+)([KM]?)\s*([)\]])$/.exec(last);
  if (!bound) return undefined;
  const [, amount, scale, end] = bound;
  return (
    Number(amount) * (scale === 'K' ? 1000 : scale === 'M' ? 1000000 : 1) - (end === ')' ? 1 : 0)
  );
}

const relatedRateRows = (row: DisplayPriceRow, rows: DisplayPriceRow[]) =>
  rows.filter((candidate) => rateScope(candidate) === rateScope(row));

function tierCondition(row: DisplayPriceRow, sectionRows: DisplayPriceRow[], locale: Locale) {
  const related = relatedRateRows(row, sectionRows);
  const structuredTiers = related.some(({ tier }) => tier?.size);
  const meterRows = related.filter(({ usageKey }) => usageKey === row.usageKey);
  const thresholds = [
    ...new Set(
      meterRows
        .map((entry) => lastLowerBandToken(entry, structuredTiers))
        .filter((n) => n !== null),
    ),
  ].sort((a, b) => a - b);
  if (!thresholds.length) return null;
  const threshold = lastLowerBandToken(row, structuredTiers);
  const low = threshold === null;
  // Explicit conditional fee descriptions provide their own direction.
  if (low && typeof row.conditions.condition === 'string' && row.rowId.startsWith('fees:'))
    return null;
  const type =
    row.tier?.type ??
    related.find(({ tier }) => tier)?.tier?.type ??
    (related.some(legacyTier) ? 'context' : undefined);
  const terminal = type === 'context' ? undefined : lastPublishedInputToken(row.conditions);
  const next = low ? thresholds[0] : thresholds[thresholds.indexOf(threshold) + 1];
  const upper = next ?? terminal;
  const numbers = low
    ? msg(locale, 'inclusive', { size: upper })
    : upper
      ? msg(locale, 'between', { from: threshold + 1, to: upper })
      : msg(locale, 'over', { size: threshold + 1 });
  return `${msg(locale, type === 'context' ? 'tokContext' : 'tokInput')} · ${numbers} · ${msg(locale, 'wholeRequest')}`;
}

function rowDisplayConditions(row: DisplayPriceRow, common: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row.conditions).filter(
      ([key, value]) =>
        !['tier', 'serviceTier', 'above'].includes(key) &&
        !(key in common && JSON.stringify(common[key]) === JSON.stringify(value)),
    ),
  );
}

function RateTable({
  rows,
  locale,
  quote,
  common,
}: {
  rows: DisplayPriceRow[];
  locale: Locale;
  quote: DisplayPriceQuote;
  common: Record<string, unknown>;
}) {
  const groupName = rateSection(rows[0]);
  const unit = rows[0].unit;
  const unitName = unit ? priceUnit(unit, locale) : msg(locale, 'unknownUnit');
  const toolCondition = rows.some(({ rowId }) => rowId.startsWith('tools:'))
    ? quote.originalQuote?.toolCondition
    : undefined;
  const resolutionNote = unit === 'per_image' ? quote.originalQuote?.resolutionNote : undefined;
  const rowModels = rows.map((row, position) => ({
    row,
    position,
    tier: tierCondition(row, rows, locale),
    conditions: rowDisplayConditions(row, common),
  }));
  const hasTiers = rowModels.some(({ tier }) => tier);
  const bandMap = new Map<string, { rows: typeof rowModels; threshold: number | null }>();
  for (const model of rowModels) {
    const { row } = model;
    const related = relatedRateRows(row, rows);
    const structuredTiers = related.some(({ tier }) => tier?.size);
    const threshold = model.tier ? lastLowerBandToken(row, structuredTiers) : null;
    // Hoist a heading only when every enclosed rate has that exact applicability.
    const key = hasTiers ? JSON.stringify([rateScope(row), threshold, model.tier]) : 'all';
    const band = bandMap.get(key);
    if (band) band.rows.push(model);
    else bandMap.set(key, { rows: [model], threshold });
  }
  const rateOrder = ({ row }: (typeof rowModels)[number]): [number, number] => {
    if (row.usageKey === 'input') return [0, 0];
    if (row.usageKey === 'output') return [1, 0];
    if (row.usageKey === 'cache_read') return [2, 0];
    if (row.usageKey === 'cache_write_12h') return [4, 720];
    if (row.usageKey === 'cache_write' || /^cache_write_\d+[hm]$/.test(row.usageKey)) {
      const suffix = /^cache_write_(\d+)([hm])$/.exec(row.usageKey);
      const documented = quote.displayFeeTerms?.find(
        ({ usageKey }) => usageKey === row.usageKey,
      )?.retentionMinutes;
      const minutes = suffix
        ? Number(suffix[1]) * (suffix[2] === 'h' ? 60 : 1)
        : (documented ?? Number.POSITIVE_INFINITY);
      return [3, minutes];
    }
    return [5, 0];
  };
  for (const band of bandMap.values())
    band.rows.sort((a, b) => {
      const [aGroup, aMinutes] = rateOrder(a);
      const [bGroup, bMinutes] = rateOrder(b);
      return aGroup - bGroup || aMinutes - bMinutes || a.position - b.position;
    });
  const bands = [...bandMap.entries()]
    .map(([key, band]) => ({ key, ...band }))
    .sort((a, b) => (a.threshold ?? -1) - (b.threshold ?? -1) || a.key.localeCompare(b.key, 'en'));
  return (
    <div className="min-w-0 space-y-3">
      <Conditions values={{ toolCondition, resolutionNote }} locale={locale} />
      {bands.map((band) => {
        const tier = band.rows.find(({ tier }) => tier)?.tier;
        const hasConditions = band.rows.some(
          ({ row, conditions }) =>
            quote.displayFeeTerms?.some(
              ({ usageKey, condition }) => usageKey === row.usageKey && condition,
            ) || Object.keys(conditions).length > 0,
        );
        return (
          <section
            key={band.key}
            className="min-w-0 border-t pt-3 first:border-t-0 first:pt-0"
            data-rate-band={band.key}
            data-unit={unit ?? ''}
            data-service-tier={groupName}
            aria-label={tier ? `${tier} · ${unitName}` : unitName}
          >
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              {tier ? (
                <>
                  <h4 className="text-sm font-medium" data-tier-condition>
                    {tier}
                  </h4>
                  <p className="text-muted-foreground text-xs">{unitName}</p>
                </>
              ) : (
                <h4 className="text-muted-foreground text-xs font-medium">{unitName}</h4>
              )}
            </div>
            <table className="w-full text-left text-xs max-sm:block" aria-label={unitName}>
              <thead className="text-muted-foreground max-sm:hidden">
                <tr>
                  <th className="px-2.5 py-2 font-medium" scope="col">
                    {msg(locale, 'usage')}
                  </th>
                  <th className="px-2.5 py-2 text-right font-medium" scope="col">
                    {msg(locale, quote.originalCurrencyEligible === false ? 'reported' : 'source')}
                  </th>
                  <th className="px-2.5 py-2 text-right font-medium" scope="col">
                    {msg(locale, 'cny')}
                  </th>
                  {hasConditions && (
                    <th className="min-w-36 px-2.5 py-2 font-medium" scope="col">
                      {msg(locale, 'conditions')}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="max-sm:block">
                {band.rows.map(({ row, conditions }) => {
                  const label = priceUsage(row.usageKey, locale);
                  const term = quote.displayFeeTerms?.find(
                    ({ usageKey }) => usageKey === row.usageKey,
                  );
                  const ttlLabel = /^cache_write_\d+[hm]$/.test(row.usageKey)
                    ? ''
                    : term?.retentionMinutes !== undefined
                      ? ` · ${term.retentionMinutes} ${localizePrice(['min', '分钟', '分'], locale)}`
                      : isUpstreamQuote(quote) && row.usageKey === 'cache_write'
                        ? ` · ${msg(locale, 'cacheTtlUndocumented')}`
                        : '';
                  const amountPrefix = row.approximate ? '≈' : '';
                  const source =
                    row.amount === null
                      ? (row.sourceValue ?? '—')
                      : amountPrefix + exactMoney(row.amount, row.currency);
                  const sourceContent = (
                    <>
                      {row.currency && (
                        <span className="text-muted-foreground mr-1 text-[0.65rem]">
                          {row.currency}
                        </span>
                      )}
                      {source}
                    </>
                  );
                  const cnyContent =
                    row.cnyAmount === null
                      ? '—'
                      : amountPrefix + exactMoney(row.cnyAmount, row.cnyCurrency);
                  return (
                    <tr
                      key={row.rowId}
                      data-pricing-row={row.rowId}
                      data-unit={row.unit ?? ''}
                      data-source-currency={row.currency ?? ''}
                      data-source-amount={row.amount ?? ''}
                      data-cny-amount={row.cnyAmount ?? ''}
                      className="border-t align-top max-sm:grid max-sm:grid-cols-[minmax(0,1fr)_auto] max-sm:gap-x-3 max-sm:px-1 max-sm:py-2"
                    >
                      <th
                        className="px-2.5 py-2 text-left font-medium max-sm:row-span-2 max-sm:px-0 max-sm:py-0"
                        scope="row"
                      >
                        {label}
                        {ttlLabel}
                      </th>
                      <td className="px-2.5 py-2 text-right tabular-nums max-sm:hidden">
                        <span data-price-source>{sourceContent}</span>
                      </td>
                      <td className="px-2.5 py-2 text-right font-medium tabular-nums max-sm:hidden">
                        <span data-price-cny>{cnyContent}</span>
                      </td>
                      <td className="px-1 text-right tabular-nums max-sm:col-start-2 max-sm:row-span-2 max-sm:row-start-1 sm:hidden">
                        <span className="block" data-price-source>
                          {sourceContent}
                        </span>
                        <span className="block font-medium" data-price-cny>
                          {cnyContent}
                        </span>
                      </td>
                      {hasConditions && (
                        <td className="space-y-1 px-2.5 py-2 max-sm:col-span-full max-sm:px-0 max-sm:pt-2">
                          {term?.condition && <p>{term.condition}</p>}
                          <Conditions values={conditions} locale={locale} usage={row.usageKey} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </div>
  );
}

const rowOnlyConditionKeys = new Set([
  'baseQuoteId',
  'cacheHitRenewsTtl',
  'cacheTtl',
  'cacheWriteTtlSeconds',
  'cacheWrite',
  'cacheWriteIncludedInInput',
  'durationSeconds',
  'condition',
  'tierName',
  'when',
  'resolution',
  'amount',
  'currency',
  'unit',
  'referenceFee',
  'maxInput',
  'maxOutput',
  'minOutput',
  'inputBands',
  'inputOutputBands',
]);

function QuoteArticle({
  entry,
  anchorId,
  scopeId,
  baseQuoteAnchorId,
  children,
}: {
  entry: QuoteEntry;
  anchorId: string;
  scopeId: string;
  baseQuoteAnchorId?: string;
  children?: ReactNode;
}) {
  const { quote, groupId, rows: entryRows, serviceName } = entry;
  const { locale } = useI18n();
  const displayName = entryDisplayName(entry, locale);
  const sections = new Map<string, DisplayPriceRow[]>();
  for (const row of entryRows) {
    // Keep legacy fields in the raw audit record, not alongside their authoritative tiers.
    if (
      legacyTier(row) &&
      entryRows.some(
        (candidate) =>
          candidate.tier?.size &&
          rateScope(candidate) === rateScope(row) &&
          rateSection(candidate) === rateSection(row) &&
          candidate.unit === row.unit,
      )
    )
      continue;
    const key = JSON.stringify([rateSection(row), row.unit]);
    const section = sections.get(key);
    if (section) section.push(row);
    else sections.set(key, [row]);
  }
  const details = quote.originalQuote?.conditions ?? quote.conditions;
  const meteredConditions = new Set(
    quote.displayRows
      .filter(({ rowId }) => rowId.startsWith('condition-fee:'))
      .map(({ usageKey }) => usageKey),
  );
  const commonRowConditionKeys = ['minimumUsage', 'draft', 'rounding'];
  const originalConditions = Object.fromEntries([
    ...(details && typeof details === 'object' ? Object.entries(details) : []),
    ...(typeof details === 'string' ? [['officialCondition', details] as const] : []),
    ...(quote.originalQuote?.effectiveAt
      ? [['effectiveAt', quote.originalQuote.effectiveAt] as const]
      : []),
  ]);
  const quoteConditions: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(originalConditions)) {
    if (meteredConditions.has(key) || rowOnlyConditionKeys.has(key)) continue;
    const rowsWithCondition = entryRows.filter((row) => key in row.conditions);
    if (!rowsWithCondition.length) {
      quoteConditions[key] = value;
      continue;
    }
    const first = rowsWithCondition[0].conditions[key];
    if (
      rowsWithCondition.length === entryRows.length &&
      rowsWithCondition.every(
        (row) => JSON.stringify(row.conditions[key]) === JSON.stringify(first),
      )
    )
      quoteConditions[key] = first;
  }
  for (const key of commonRowConditionKeys) {
    if (key in originalConditions || rowOnlyConditionKeys.has(key)) continue;
    const value = entryRows[0]?.conditions[key];
    if (typeof value === 'string' && entryRows.every((row) => row.conditions[key] === value))
      quoteConditions[key] = value;
  }
  const tariffConditions = quoteConditions;
  const baseQuoteId = quote.originalQuote?.baseQuoteId;
  const baseQuoteReference = ['Standard', region(quote), entry.endpoint]
    .filter(Boolean)
    .join(' · ');
  const date = quote.source.checkedAt ?? quote.source.snapshotAt;
  const digest = quote.source.recordSha256 ?? quote.source.sha256 ?? quote.source.upstreamSha;
  const hasRate = entryRows.some(({ amount, sourceValue }) => amount !== null || !!sourceValue);
  const statusLabel = quoteStatus(quote.status, locale);
  const badgeLabel = quote.syncable
    ? msg(locale, 'selected')
    : hasRate
      ? msg(locale, 'reference')
      : statusLabel;
  const hasCommonConditions = Boolean(
    quote.originalQuote?.contextNote ||
      quote.originalQuote?.cache?.reason ||
      quote.originalQuote?.description ||
      Object.keys(tariffConditions).length ||
      baseQuoteId,
  );
  return (
    <article
      id={anchorId}
      tabIndex={-1}
      className="min-w-0 scroll-mt-4 rounded-lg border bg-card px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:px-4"
      data-quote-id={quote.quoteId}
      data-pricing-group={groupId}
      data-pricing-scope={scopeId}
      data-service-entry={entry.entryId}
      data-service-name={serviceName}
      data-service-tier={entry.entryKey}
      data-price-role={quote.originalQuote?.priceRole ?? ''}
      data-completion-window={quote.originalQuote?.completionWindow ?? ''}
      data-syncable={String(quote.syncable)}
      data-quote-status={quote.status}
    >
      <details open>
        <summary className="cursor-pointer leading-relaxed break-words">
          <h3 className="inline text-base font-semibold">{displayName}</h3>
          <Badge className="ml-2 align-middle" variant={quote.syncable ? 'default' : 'secondary'}>
            {badgeLabel}
          </Badge>
        </summary>
        <div className="mt-2 space-y-3 text-xs break-words whitespace-normal">
          {hasCommonConditions && (
            <div className="space-y-2 border-b pb-3" data-common-conditions>
              <h4 className="font-medium">{msg(locale, 'commonConditions')}</h4>
              <Conditions
                values={{
                  contextNote: quote.originalQuote?.contextNote,
                  cacheAvailability: quote.originalQuote?.cache?.reason,
                }}
                locale={locale}
              />
              {quote.originalQuote?.description && (
                <p data-price-description>
                  {priceDescription(quote.originalQuote.description, locale)}
                </p>
              )}
              {Object.keys(tariffConditions).length > 0 && (
                <Conditions values={tariffConditions} locale={locale} />
              )}
              {baseQuoteId && (
                <p data-base-quote-reference>
                  <span className="font-medium">{priceCondition('baseQuoteId', locale)}</span>
                  {' · '}
                  {baseQuoteAnchorId ? (
                    <a
                      className="underline underline-offset-2"
                      href={`#${baseQuoteAnchorId}`}
                      onClick={(event) => {
                        event.preventDefault();
                        const target = document.getElementById(baseQuoteAnchorId);
                        target?.scrollIntoView({ block: 'start' });
                        target?.focus({ preventScroll: true });
                      }}
                    >
                      {baseQuoteReference}
                    </a>
                  ) : (
                    baseQuoteReference
                  )}
                </p>
              )}
            </div>
          )}
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
            />
          ))}
          <div className="text-muted-foreground space-y-0.5">
            {!isUpstreamQuote(quote) && <p data-price-list>{quote.priceList}</p>}
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
            {hasRate && !['ready', 'reference-only'].includes(quote.status) && <p>{statusLabel}</p>}
            {quote.reason && <p data-price-explanation>{priceExplanation(quote.reason, locale)}</p>}
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
          <details className="text-muted-foreground" data-price-audit>
            <summary className="cursor-pointer underline-offset-2 hover:underline">
              {msg(locale, 'audit')}
            </summary>
            {isUpstreamQuote(quote) && (
              <p className="mt-1 break-all" data-audit-price-list>
                {quote.priceList}
              </p>
            )}
            {quote.originalQuote?.description && (
              <p className="mt-1" data-audit-description>
                {quote.originalQuote.description}
              </p>
            )}
            {quote.reason && (
              <p className="mt-1" data-audit-reason>
                {quote.reason}
              </p>
            )}
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
  const entries = view.groups.flatMap(({ groupId, quotes }) =>
    quotes.flatMap((quote) => quoteEntries(groupId, quote)),
  );
  if (!entries.length) return null;
  const navigationName = (entry: QuoteEntry) =>
    isUpstreamQuote(entry.quote)
      ? entryDisplayName(entry, locale)
      : serviceTierKey(entry.serviceName)
        ? entryDisplayName(entry, locale)
        : msg(locale, 'otherTariff');

  const defaultQualifiers = new Map<string, string>();
  for (const entry of entries.filter(({ quote }) => quote.selected))
    if (entry.qualifier) defaultQualifiers.set(entry.endpoint, entry.qualifier);
  for (const entry of entries)
    if (entry.qualifier && !defaultQualifiers.has(entry.endpoint))
      defaultQualifiers.set(entry.endpoint, entry.qualifier);

  const scopeMap = new Map<string, Map<string, QuoteScope>>();
  for (const entry of entries) {
    const qualifier = entry.qualifier || defaultQualifiers.get(entry.endpoint) || '';
    let endpointScopes = scopeMap.get(qualifier);
    if (!endpointScopes) {
      endpointScopes = new Map<string, QuoteScope>();
      scopeMap.set(qualifier, endpointScopes);
    }
    const referenceKind =
      isUpstreamQuote(entry.quote) && !entry.quote.selected ? 'upstream' : 'official';
    const scopeKey = `${referenceKind}\0${entry.endpoint}`;
    let scope = endpointScopes.get(scopeKey);
    if (!scope) {
      scope = {
        qualifier,
        endpoint: entry.endpoint,
        referenceKind,
        entries: [],
      };
      endpointScopes.set(scopeKey, scope);
    }
    scope.entries.push(entry);
  }
  const scopes = [...scopeMap.values()]
    .flatMap((endpointScopes) => [...endpointScopes.values()])
    .sort(
      (a, b) =>
        Number(a.referenceKind === 'upstream') - Number(b.referenceKind === 'upstream') ||
        a.qualifier.localeCompare(b.qualifier, 'en') ||
        a.endpoint.localeCompare(b.endpoint, 'en') ||
        a.entries[0].quote.quoteId.localeCompare(b.entries[0].quote.quoteId, 'en'),
    );
  const viewAnchor = `pricing-${anchorPart(view.providerId)}-${anchorPart(view.modelId)}`;
  const quoteAnchors = new Map<string, string>();
  const content = (
    <div className="grid min-w-0 gap-5">
      {check && <OfficialCheckNotice view={check} />}
      {scopes.map((scope, scopeIndex) => {
        const scopeId = `${viewAnchor}-scope-${scopeIndex + 1}`;
        const scopeEntries = [...scope.entries].sort(
          (a, b) =>
            Number(b.quote.selected) - Number(a.quote.selected) ||
            serviceOrderName(a.serviceName) - serviceOrderName(b.serviceName) ||
            a.quote.quoteId.localeCompare(b.quote.quoteId, 'en') ||
            a.entryId.localeCompare(b.entryId, 'en'),
        );
        const provider =
          scopeEntries.map(({ quote }) => priceListIdentity(quote).provider).find(Boolean) ||
          view.providerId;
        const scopeTitle =
          scope.referenceKind === 'upstream'
            ? msg(locale, 'upstreamReference')
            : [provider, scope.qualifier].filter(Boolean).join(' · ');
        const serviceCounts = new Map<string, number>();
        for (const entry of scopeEntries) {
          const name = navigationName(entry);
          serviceCounts.set(name, (serviceCounts.get(name) ?? 0) + 1);
        }
        scopeEntries.forEach((entry, entryIndex) => {
          if (!quoteAnchors.has(entry.quote.quoteId))
            quoteAnchors.set(entry.quote.quoteId, `${scopeId}-service-${entryIndex + 1}`);
        });
        return (
          <section
            key={scopeId}
            className="min-w-0 space-y-3"
            data-pricing-scope={scopeId}
            data-reference-kind={scope.referenceKind}
            aria-label={scopeTitle}
          >
            <div className="min-w-0">
              <h3 className="text-sm font-semibold" data-scope-title>
                {scopeTitle}
              </h3>
              {scope.endpoint && (
                <p className="text-muted-foreground text-xs break-all">{scope.endpoint}</p>
              )}
            </div>
            {scopeEntries.length > 1 && (
              <nav
                className="flex flex-wrap gap-x-4 gap-y-1 text-xs"
                aria-label={msg(locale, 'serviceNavigation')}
              >
                {scopeEntries.map((entry, entryIndex) => {
                  const anchorId = `${scopeId}-service-${entryIndex + 1}`;
                  const navigationLabel = navigationName(entry);
                  const label =
                    (serviceCounts.get(navigationLabel) ?? 0) > 1
                      ? `${navigationLabel} · ${entry.quote.priceList}`
                      : navigationLabel;
                  return (
                    <a
                      key={entry.entryId}
                      href={`#${anchorId}`}
                      className="underline-offset-4 hover:underline"
                      data-price-anchor-target={entry.entryId}
                      onClick={(event) => {
                        event.preventDefault();
                        const target = document.getElementById(anchorId);
                        target?.scrollIntoView({ block: 'start' });
                        target?.focus({ preventScroll: true });
                      }}
                    >
                      {label}
                    </a>
                  );
                })}
              </nav>
            )}
            <div className="grid min-w-0 gap-3">
              {scopeEntries.map((entry, entryIndex) => (
                <QuoteArticle
                  key={entry.entryId}
                  entry={entry}
                  scopeId={scopeId}
                  anchorId={`${scopeId}-service-${entryIndex + 1}`}
                  baseQuoteAnchorId={quoteAnchors.get(entry.quote.originalQuote?.baseQuoteId ?? '')}
                >
                  {check?.results && (
                    <QuoteOfficialCheck
                      result={check.results.get(
                        officialCheckKey(view.providerId, view.modelId, entry.quote.quoteId),
                      )}
                    />
                  )}
                </QuoteArticle>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
  return compact ? content : <DetailSection title={msg(locale, 'title')}>{content}</DetailSection>;
}
