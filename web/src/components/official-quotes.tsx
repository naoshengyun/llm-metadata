import { DetailSection } from '@/components/detail-section';
import type { Model, PriceQuote, TaskTier } from '@/lib/api';
import { useI18n } from '@/lib/i18n';

const messages = {
  en: {
    title: 'Official tariffs',
    source: 'Official source',
    cny: 'CNY base price',
    original: 'Source price',
    reported: 'Upstream reported figure',
    evidence: 'Evidence date',
    snapshot: 'Upstream snapshot',
    unavailable: 'Unavailable',
    native: 'Native billing model',
    selected: 'Selected for sync',
    reference: 'Reference only',
    hasPrice: 'Official price documented',
    expressible: 'Eligible for the native expression',
    saved: 'Save and read-back in the isolated rc.50 acceptance test',
    usage: 'Actual billing awaiting verification',
    seedanceImport: 'Model expression import evidence',
    seedanceUsage: 'Target deployment billing still pending for both 4K cases',
  },
  zh: {
    title: '官方价目',
    source: '官方来源',
    cny: 'CNY 基础价',
    original: '源价格',
    reported: '上游记录值',
    evidence: '证据日期',
    snapshot: '上游快照日期',
    unavailable: '暂无',
    native: '原生计费模型名',
    selected: '已选定同步',
    reference: '仅供参考',
    hasPrice: '官方价格有据可查',
    expressible: '可完整表达并纳入原生同步',
    saved: '隔离 rc.50 原生配置保存与读回验收',
    usage: '实际计费待验证',
    seedanceImport: '模型表达式导入已有证据',
    seedanceUsage: '目标部署的两种 4K 实际计费均待验证',
  },
  ja: {
    title: '公式料金表',
    source: '公式ソース',
    cny: 'CNY 基準価格',
    original: '元の料金',
    reported: '上流の記載値',
    evidence: '証拠の日付',
    snapshot: '上流スナップショットの日付',
    unavailable: '不明',
    native: 'ネイティブ課金モデル名',
    selected: '同期対象',
    reference: '参考のみ',
    hasPrice: '公式料金の資料あり',
    expressible: 'ネイティブ課金式で表現・同期可能',
    saved: '隔離 rc.50 のネイティブ設定の保存・読戻し検証',
    usage: '実際の課金は検証待ち',
    seedanceImport: 'モデル料金式の取り込み実績あり',
    seedanceUsage: '対象環境での 4K 二条件の実課金は検証待ち',
  },
} as const;

function PriceFields({ label, price }: { label: string; price: unknown }) {
  if (price == null) return null;
  return (
    <div className="min-w-0">
      <h4 className="font-medium">{label}</h4>
      <pre className="mt-1 rounded border p-2 text-xs break-all whitespace-pre-wrap">
        {JSON.stringify(price, null, 2)}
      </pre>
    </div>
  );
}

function taskCharges(tiers: TaskTier[]) {
  return tiers.flatMap(({ name, when, charges }) => {
    const condition = Object.entries(when ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    return charges.map(({ usageKey, amount, unit, currency }) => ({
      label: `${name}${condition ? ' · ' + condition : ''} · ${usageKey}`,
      value: `${currency} ${amount} / ${unit.replace(/^per_/, '').replaceAll('_', ' ')}`,
    }));
  });
}

export function TaskPriceSummary({ model }: { model: Model }) {
  const quote = model.cnyPrice?.quotes?.find(({ syncable }) => syncable);
  if (!quote?.cnyTaskTiers) return null;
  return (
    <ul className="text-muted-foreground space-y-0.5 text-xs whitespace-normal">
      {taskCharges(quote.cnyTaskTiers).map(({ label, value }) => (
        <li key={label}>
          {label} · {value}
        </li>
      ))}
    </ul>
  );
}

function Quote({ quote }: { quote: PriceQuote }) {
  const { locale } = useI18n();
  const msg = messages[locale];
  const labelled = quote.source.checkedAt
    ? [msg.evidence, quote.source.checkedAt]
    : [msg.snapshot, quote.source.snapshotAt];
  return (
    <article className="space-y-2 rounded-lg border p-3 text-sm break-words">
      <h3 className="font-semibold">{quote.priceList}</h3>
      <div className="text-muted-foreground">{quote.quoteId}</div>
      {quote.endpoint && <div className="text-muted-foreground">{quote.endpoint}</div>}
      {quote.nativeKey && (
        <div>
          {msg.native} · {quote.nativeKey}
        </div>
      )}
      <div>
        {quote.syncable ? msg.selected : msg.reference}
        {quote.reason && ` · ${quote.reason}`}
      </div>
      <div>
        {labelled[0]} · {labelled[1] ?? msg.unavailable}
        {quote.source.url && (
          <>
            {' '}
            ·{' '}
            <a className="underline" href={quote.source.url} target="_blank" rel="noreferrer">
              {msg.source}
            </a>
          </>
        )}
      </div>
      {quote.originalQuote?.description && <p>{quote.originalQuote.description}</p>}
      {quote.usagePlugin && <p>Plugin · {quote.usagePlugin}</p>}
      {(quote.sourcePrice != null || quote.syncable || quote.verification) && (
        <ul className="list-disc pl-5">
          {quote.sourcePrice != null && quote.originalCurrencyEligible !== false && (
            <li>{msg.hasPrice}</li>
          )}
          {quote.syncable && <li>{msg.expressible}</li>}
          {quote.syncable && (
            <li>
              <a className="underline" href="https://github.com/naoshengyun/llm-metadata/issues/40">
                {msg.saved}
              </a>
            </li>
          )}
          {quote.syncable && <li>{msg.usage}</li>}
          {quote.verification && (
            <>
              <li>
                <a className="underline" href={quote.verification.modelExpressionImportEvidence}>
                  {msg.seedanceImport}
                </a>
              </li>
              <li>
                <a className="underline" href={quote.verification.decision}>
                  {msg.seedanceUsage}
                </a>
              </li>
            </>
          )}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <PriceFields
          label={`${quote.originalCurrencyEligible === false ? msg.reported : msg.original} · ${quote.sourceCurrency ?? msg.unavailable}${quote.sourceUnit ? ' · ' + quote.sourceUnit : ''}`}
          price={quote.sourcePrice}
        />
        <PriceFields
          label={msg.cny}
          price={
            quote.cnyTaskTiers ??
            quote.cnyCost ??
            (quote.verification ? quote.sourcePrice : undefined)
          }
        />
      </div>
    </article>
  );
}

export function OfficialQuotes({ model }: { model: Model }) {
  const { locale } = useI18n();
  const price = model.cnyPrice;
  if (!price?.quotes?.length) return null;
  const { quotes, selectedQuoteId } = price;
  return (
    <DetailSection title={messages[locale].title}>
      <div className="space-y-3">
        {[...quotes]
          .sort(
            (a, b) => Number(b.quoteId === selectedQuoteId) - Number(a.quoteId === selectedQuoteId),
          )
          .map((quote) => (
            <Quote key={quote.quoteId} quote={quote} />
          ))}
      </div>
    </DetailSection>
  );
}
