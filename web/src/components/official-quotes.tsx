import type { ReactNode } from 'react';

import { DetailSection } from '@/components/detail-section';
import { OfficialCheckNotice, QuoteOfficialCheck } from '@/components/official-check';
import type { Model, PriceQuote, TaskTier } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { officialCheckKey, type OfficialCheckView } from '@/lib/official-check';

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
    saved: 'Save and read-back awaiting verification for this candidate',
    conditions: 'Charging conditions',
    freeQuantity: (quantity: number, usageKey: string) =>
      `First ${quantity}${usageKey === 'input_images' ? ' images' : ''} free`,
    usage: 'Actual billing awaiting verification',
    seedanceImport: 'Model expression import evidence',
    seedanceUsage: 'Target deployment billing still pending for both 4K cases',
    resolution: 'Resolution',
    withoutVideo: 'Without input video',
    withVideo: 'With input video',
    videoTokenUnit: 'CNY per million billable video tokens',
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
    saved: '当前候选的原生配置保存与读回待验证',
    conditions: '收费条件',
    freeQuantity: (quantity: number, usageKey: string) =>
      `前 ${quantity} ${usageKey === 'input_images' ? '张图片' : '个用量单位'}免费`,
    usage: '实际计费待验证',
    seedanceImport: '模型表达式导入已有证据',
    seedanceUsage: '目标部署的两种 4K 实际计费均待验证',
    resolution: '分辨率',
    withoutVideo: '无视频输入',
    withVideo: '有视频输入',
    videoTokenUnit: 'CNY / 每百万计费视频 Token',
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
    saved: 'この候補のネイティブ設定の保存・読み戻しは検証待ち',
    conditions: '課金条件',
    freeQuantity: (quantity: number, usageKey: string) =>
      `最初の ${quantity} ${usageKey === 'input_images' ? '枚' : '単位'}は無料`,
    usage: '実際の課金は検証待ち',
    seedanceImport: 'モデル料金式の取り込み実績あり',
    seedanceUsage: '対象環境での 4K 二条件の実課金は検証待ち',
    resolution: '解像度',
    withoutVideo: '入力動画なし',
    withVideo: '入力動画あり',
    videoTokenUnit: '100万課金対象動画トークンあたりの CNY',
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

function VideoReferenceRates({ price }: { price: unknown }) {
  const { locale } = useI18n();
  const msg = messages[locale];
  if (!price || typeof price !== 'object' || !('rows' in price) || !Array.isArray(price.rows))
    return <PriceFields label={msg.original} price={price} />;

  return (
    <div className="space-y-2">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="mb-2 text-left font-medium">{msg.videoTokenUnit}</caption>
        <thead className="bg-muted">
          <tr>
            {[msg.resolution, msg.withoutVideo, msg.withVideo].map((label) => (
              <th key={label} scope="col" className="px-2 py-1.5">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {price.rows.map(([resolution, noInput, input]) => (
            <tr key={resolution} className="border-b">
              <th scope="row" className="px-2 py-1.5 text-left font-medium">
                {resolution}
              </th>
              <td className="px-2 py-1.5">{noInput}</td>
              <td className="px-2 py-1.5">{input}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {'minimumUsage' in price && typeof price.minimumUsage === 'string' && (
        <p>{price.minimumUsage}</p>
      )}
      {'draft' in price && typeof price.draft === 'string' && <p>{price.draft}</p>}
    </div>
  );
}

function taskCharges(
  tiers: TaskTier[],
  formatFreeQuantity: (quantity: number, usageKey: string) => string,
) {
  return tiers.flatMap(({ name, when, charges }) => {
    const condition = Object.entries(when ?? {})
      .map(([key, value]) => `${key}=${value}`)
      .join(', ');
    return charges.map(({ usageKey, amount, unit, currency, freeQuantity }) => ({
      label: `${name}${condition ? ' · ' + condition : ''} · ${usageKey}`,
      value: `${currency} ${amount} / ${unit.replace(/^per_/, '').replaceAll('_', ' ')}`,
      free: freeQuantity ? formatFreeQuantity(freeQuantity, usageKey) : null,
    }));
  });
}

export function TaskPriceSummary({ model }: { model: Model }) {
  const { locale } = useI18n();
  const quote = model.cnyPrice?.quotes?.find(({ syncable }) => syncable);
  if (!quote?.cnyTaskTiers) return null;
  return (
    <ul className="text-muted-foreground space-y-0.5 text-xs whitespace-normal">
      {taskCharges(quote.cnyTaskTiers, messages[locale].freeQuantity).map(
        ({ label, value, free }) => (
          <li key={label}>
            {label} · {value}
            {free && ` · ${free}`}
          </li>
        ),
      )}
    </ul>
  );
}

function Quote({ quote, children }: { quote: PriceQuote; children?: ReactNode }) {
  const { locale } = useI18n();
  const msg = messages[locale];
  const labelled = quote.source.checkedAt
    ? [msg.evidence, quote.source.checkedAt]
    : [msg.snapshot, quote.source.snapshotAt];
  const sourceUnit = quote.originalQuote?.unit ?? quote.sourceUnit;
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
      {children}
      {quote.originalQuote?.description && <p>{quote.originalQuote.description}</p>}
      {quote.usagePlugin && <p>Plugin · {quote.usagePlugin}</p>}
      {(quote.sourcePrice != null || quote.syncable || quote.verification) && (
        <ul className="list-disc pl-5">
          {quote.sourcePrice != null && quote.originalCurrencyEligible !== false && (
            <li>{msg.hasPrice}</li>
          )}
          {quote.syncable && <li>{msg.expressible}</li>}
          {quote.syncable && <li>{msg.saved}</li>}
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
      {quote.verification ? (
        <VideoReferenceRates price={quote.sourcePrice} />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          <PriceFields
            label={`${quote.originalCurrencyEligible === false ? msg.reported : msg.original} · ${quote.sourceCurrency ?? msg.unavailable}${sourceUnit ? ' · ' + sourceUnit : ''}`}
            price={quote.sourcePrice}
          />
          <PriceFields label={msg.cny} price={quote.cnyTaskTiers ?? quote.cnyCost} />
        </div>
      )}
      <PriceFields
        label={msg.conditions}
        price={quote.originalQuote?.conditions ?? quote.conditions}
      />
    </article>
  );
}

export function OfficialQuotes({
  model,
  providerId,
  check,
}: {
  model: Model;
  providerId: string;
  check?: OfficialCheckView;
}) {
  const { locale } = useI18n();
  const price = model.cnyPrice;
  if (!price?.quotes?.length) return null;
  const { quotes, selectedQuoteId } = price;
  return (
    <DetailSection title={messages[locale].title}>
      <div className="space-y-3">
        {check && <OfficialCheckNotice view={check} />}
        {[...quotes]
          .sort(
            (a, b) => Number(b.quoteId === selectedQuoteId) - Number(a.quoteId === selectedQuoteId),
          )
          .map((quote) => (
            <Quote key={quote.quoteId} quote={quote}>
              {check?.results && (
                <QuoteOfficialCheck
                  result={check.results.get(officialCheckKey(providerId, model.id, quote.quoteId))}
                />
              )}
            </Quote>
          ))}
      </div>
    </DetailSection>
  );
}
