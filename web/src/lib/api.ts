/** 静态 API 数据访问层（相对路径，兼容子路径与根路径部署） */

import type { ModelCost, ProviderBillingRule } from '@billing/cost';

import type { Locale } from './i18n';

export type { ModelCost, ProviderBillingRule };

/** 推理强度选项（models.dev reasoning_options） */
export interface ReasoningOption {
  type: string;
  values?: unknown[];
}

export interface TaskTier {
  name: string;
  when?: Record<string, string | boolean>;
  charges: {
    usageKey: string;
    amount: number;
    unit: string;
    currency: string;
    freeQuantity?: number;
  }[];
  notApplicable?: Record<string, string>;
}

export interface PriceQuote {
  quoteId: string;
  priceList: string;
  endpoint?: string | null;
  nativeKey: string | null;
  /** 官方模型来源身份；可能与对客 nativeKey 不同。 */
  modelId?: string;
  sourceCurrency?: string | null;
  sourceUnit?: string | null;
  sourcePrice?: unknown;
  originalCurrencyEligible?: boolean;
  cnyCost?: ModelCost;
  cnyTaskTiers?: TaskTier[];
  usagePlugin?: string;
  source: { url?: string | null; checkedAt?: string | null; snapshotAt?: string };
  originalQuote?: { description?: string; conditions?: unknown; unit?: string };
  conditions?: unknown;
  status: string;
  reason?: string | null;
  syncable: boolean;
  verification?: {
    decision: string;
    officialPrice: boolean;
    modelExpressionImportEvidence: string;
    actual4kBillingVerified: boolean;
  };
}

export interface DisplayPriceRow {
  rowId: string;
  usageKey: string;
  amount: number | null;
  sourceValue?: string;
  approximate?: boolean;
  currency: string | null;
  unit: string | null;
  cnyAmount: number | null;
  cnyCurrency: string | null;
  conditions: Record<string, unknown>;
  tier?: { size: number; type?: string; comparison?: 'gte' };
}

type SelectedSummary = {
  quoteId: string;
  currency: 'CNY';
  unit: string;
  hasMoreConditions: boolean;
};
export type PricingSummary =
  | (SelectedSummary & {
      kind: 'single-token' | 'token-tiers';
      input: number | null;
      output: number | null;
    })
  | (SelectedSummary & { kind: 'fixed'; amount: number })
  | (SelectedSummary & {
      kind: 'range';
      minimum: number;
      maximum: number;
      resolutions?: string[];
      hasAdditionalUnits: boolean;
    })
  | { kind: 'multiple-units' | 'invalid-primary-unit'; units: string[] }
  | { kind: 'reference-only' | 'unavailable'; status: string };

export interface DisplayPriceQuote extends PriceQuote {
  providerId: string;
  modelId: string;
  selected: boolean;
  outputKind: string;
  sourceRecordId: string;
  displayRows: DisplayPriceRow[];
  displayFeeTerms?: { usageKey: string; retentionMinutes?: number; condition?: string }[];
  displayExamples?: {
    resolution: string;
    inputSeconds: number;
    outputSeconds: number;
    amount: number;
    currency: string;
  }[];
  source: PriceQuote['source'] & { sha256?: string; recordSha256?: string; upstreamSha?: string };
  originalQuote?: NonNullable<PriceQuote['originalQuote']> & {
    officialServiceTier?: string;
    officialRegion?: string;
    priceRole?:
      | 'service-reference'
      | 'official-list'
      | 'promotion-reference'
      | 'background-reference';
    completionWindow?: '2h' | '8h';
    baseQuoteId?: string;
    effectiveAt?: string;
    region?: string;
    toolCondition?: string;
    resolutionNote?: string;
    contextNote?: string;
    cache?: { reason?: string };
  };
}

export interface PricingView {
  schemaVersion: 1;
  providerId: string;
  /** 公开模型身份；officialModelId 保留官方来源身份，nativeKey 是对外计费键。 */
  modelId: string;
  officialModelId?: string;
  nativeKey?: string;
  status: string;
  reason: string | null;
  selectedQuoteId: string | null;
  summary: PricingSummary;
  groups: { groupId: string; kind: string; quotes: DisplayPriceQuote[] }[];
}

export interface Model {
  pricing_view?: PricingView;
  cnyPrice?: {
    status: string;
    reason?: string | null;
    sourceCurrency?: string | null;
    exported?: boolean;
    exportReason?: string;
    outputKind?: string;
    selectedQuoteId?: string | null;
    quotes?: PriceQuote[];
  };
  sourceCost?: ModelCost;
  publication?: {
    quoteId: string;
    sourceCurrency: string;
    source: { url: string; checkedAt: string };
    priceList: string;
    feeDeclarations: unknown[];
  };
  id: string;
  /** 仅用于把旧详情链接重定向到当前对外 ID，不参与搜索或计费。 */
  legacyIds?: string[];
  officialModelId?: string;
  name?: string;
  description?: string;
  /** 模型系列（如 "qwen"） */
  family?: string;
  /** 生命周期状态（"deprecated" / "beta"），缺省为正常可用 */
  status?: string;
  release_date?: string;
  last_updated?: string;
  /** 知识截止日期（ISO） */
  knowledge?: string;
  reasoning?: boolean;
  reasoning_options?: ReasoningOption[];
  tool_call?: boolean;
  structured_output?: boolean;
  attachment?: boolean;
  temperature?: boolean;
  open_weights?: boolean;
  limit?: { context?: number; input?: number; output?: number };
  modalities?: { input?: string[]; output?: string[] };
  cost?: ModelCost;
}

export interface Provider {
  description?: string;
  id: string;
  name?: string;
  api?: string;
  doc?: string;
  iconURL?: string;
  /** 浏览价目币种（本发布为 CNY 基础价；源币种见 publication） */
  currency?: string;
  /** 订阅套餐端点（Token Plan / Coding Plan）：用量从预付额度抵扣，逐 token 价目不适用 */
  subscription?: boolean;
  /** new-api 计费规则（思考开关、长效缓存写倍数、聚合优先级） */
  billing?: ProviderBillingRule;
  models: Record<string, Model>;
}

export interface ProviderIndexItem {
  description?: string;
  id: string;
  name: string;
  doc?: string;
  iconURL?: string;
  currency?: string;
  subscription?: boolean;
  billing?: ProviderBillingRule;
  modelCount: number;
}

/** 全局模型索引项（index.json），用于跨供应商搜索 */
export interface ModelIndexItem {
  id: string;
  providerId: string;
  name: string;
}

const API_BASE = './api';

async function fetchJSON<T>(path: string, base = API_BASE): Promise<T> {
  const response = await fetch(`${base}/${path}`, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Failed to load ${path} (${response.status})`);
  }
  return response.json() as Promise<T>;
}

/** 与构建器 sanitizeFileSegment 一致的文件名映射 */
function sanitizeFileSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9\-_.]/g, '_');
}

/** 同源镜像的供应商 logo 地址（构建时下载到 dist/api/logos/） */
export function providerLogoURL(id: string): string {
  return `${API_BASE}/logos/${sanitizeFileSegment(id)}.svg`;
}

/** 英文为基准数据（根路径），其余语言走 i18n 子树 */
function localePath(locale: Locale, path: string): string {
  return locale === 'en' ? path : `i18n/${locale}/${path}`;
}

export function fetchProviders(
  locale: Locale,
  base?: string,
): Promise<{ providers: ProviderIndexItem[] }> {
  return fetchJSON(localePath(locale, 'providers.json'), base);
}

const providerCache = new Map<string, Promise<Provider>>();

/** 按需加载单个供应商（含全部模型），按语言维度内存缓存 */
export function fetchProvider(locale: Locale, id: string, base?: string): Promise<Provider> {
  const cacheKey = JSON.stringify([base, locale, id]);
  let cached = providerCache.get(cacheKey);
  if (!cached) {
    cached = fetchJSON<Provider>(
      localePath(locale, `providers/${sanitizeFileSegment(id)}.json`),
      base,
    );
    cached.catch(() => providerCache.delete(cacheKey));
    providerCache.set(cacheKey, cached);
  }
  return cached;
}

const modelIndexCache = new Map<string, Promise<ModelIndexItem[]>>();

/** 全部模型的轻量索引，仅在用户发起全局搜索时按语言懒加载 */
export function fetchModelIndex(locale: Locale, base?: string): Promise<ModelIndexItem[]> {
  const cacheKey = JSON.stringify([base, locale]);
  let cached = modelIndexCache.get(cacheKey);
  if (!cached) {
    cached = fetchJSON<{ models: ModelIndexItem[] }>(localePath(locale, 'index.json'), base).then(
      (index) => index.models,
    );
    cached.catch(() => modelIndexCache.delete(cacheKey));
    modelIndexCache.set(cacheKey, cached);
  }
  return cached;
}

export interface Manifest {
  candidateId?: string;
  sourceSha?: string;
  generatedAt?: string;
  stats?: { providers?: number; models?: number };
  /** 静态 NewAPI 预设的生成假设：非美元价目换算所用汇率（每 1 USD 的货币数量） */
  newapi?: { exchangeRates?: Record<string, number> };
}

export function fetchManifest(): Promise<Manifest | null> {
  return fetchJSON<Manifest>('manifest.json').catch(() => null);
}

let allProvidersCache: Promise<Record<string, Provider>> | null = null;

/** 全部供应商及其模型（all.json，约 0.5 MB），仅在导出聚合 ratio_config 时按需加载 */
export function fetchAllProviders(): Promise<Record<string, Provider>> {
  if (!allProvidersCache) {
    allProvidersCache = fetchJSON<Record<string, Provider>>('all.json');
    allProvidersCache.catch(() => {
      allProvidersCache = null;
    });
  }
  return allProvidersCache;
}
