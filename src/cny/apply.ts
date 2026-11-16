import { createHash } from 'node:crypto';
import { verifyArtifact, type FixedArtifact } from './artifact.js';

export type FixedApplyArtifact = FixedArtifact;
export interface PriceSelection {
  models: string[];
  plugins: Record<string, string[]>;
  tools: string[];
}
interface PricingEntry {
  model_name: string;
  version: string;
  configured: Record<string, unknown>;
}
interface PricingSnapshot {
  entries: PricingEntry[];
  empty_version: string;
}
interface NativeOption {
  key: string;
  value: string;
}
export interface ApplyPlan {
  id: string;
  target: string;
  artifactId: string;
  artifactHash: string;
  selection: PriceSelection;
  pricing: PricingSnapshot;
  options: NativeOption[];
}
export interface PriceConfirmation {
  confirmed: boolean;
  actor: string;
  target: string;
  artifactId: string;
  planId: string;
}
export interface ApplyItemResult {
  partition: 'models' | 'plugins' | 'tools';
  key: string;
  status: 'applied' | 'conflict' | 'failed' | 'unknown' | 'mismatch';
  message?: string;
}
export interface ApplyResult {
  artifactId: string;
  target: string;
  actor: string;
  success: boolean;
  items: ApplyItemResult[];
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
class NativeRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
/** Authentication stays in the supplied fetch implementation; receipts never contain credentials. */
export class NativePricingAdapter {
  readonly target: string;
  readonly fetcher: typeof fetch;
  constructor(target: string, fetcher: typeof fetch = fetch) {
    const url = new URL(target);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/')
      throw new Error('target must be a credential-free origin');
    this.target = url.origin;
    this.fetcher = fetcher;
  }
  async request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await this.fetcher(`${this.target}${path}`, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const envelope = (await response.json()) as { success: boolean; message?: string; data: T };
    if (!response.ok || envelope.success !== true)
      throw new NativeRequestError(response.status, envelope.message ?? 'native request failed');
    return envelope.data;
  }
}
function validateUnits(options: NativeOption[]): void {
  if (
    Number(options.find((option) => option.key === 'USDExchangeRate')?.value) !== 1 ||
    Number(options.find((option) => option.key === 'QuotaPerUnit')?.value) !== 500000
  )
    throw new Error('target unit settings require USDExchangeRate=1 and QuotaPerUnit=500000');
}
function validateSelection(artifact: FixedApplyArtifact, selection: PriceSelection): void {
  if (
    !selection.models.length &&
    !selection.tools.length &&
    !Object.values(selection.plugins).some((keys) => keys.length)
  )
    throw new Error('select prices before preview');
  for (const model of selection.models)
    if (!Object.hasOwn(artifact.models, model))
      throw new Error(`selected model absent from artifact: ${model}`);
  for (const [model, plugins] of Object.entries(selection.plugins)) {
    for (const plugin of plugins)
      if (!Object.hasOwn(artifact.plugins[model] ?? {}, plugin))
        throw new Error(`selected plugin absent from artifact: ${model}/${plugin}`);
  }
  for (const key of selection.tools)
    if (!Object.hasOwn(artifact.tools, key))
      throw new Error(`selected tool absent from artifact: ${key}`);
}
export async function previewArtifact(
  adapter: NativePricingAdapter,
  artifact: FixedApplyArtifact,
  selection: PriceSelection,
): Promise<ApplyPlan> {
  if (!verifyArtifact(artifact)) throw new Error('invalid fixed artifact identity');
  validateSelection(artifact, selection);
  const pricing = await adapter.request<PricingSnapshot>('/api/option/model_pricing');
  const options = await adapter.request<NativeOption[]>('/api/option/');
  validateUnits(options);
  const content = {
    target: adapter.target,
    artifactId: artifact.id,
    artifactHash: digest(artifact),
    selection: structuredClone(selection),
    pricing,
    options,
  };
  return { ...content, id: digest(content) };
}
export async function applyArtifact(
  adapter: NativePricingAdapter,
  artifact: FixedApplyArtifact,
  plan: ApplyPlan,
  confirmation: PriceConfirmation,
): Promise<ApplyResult> {
  if (!verifyArtifact(artifact))
    throw new Error('confirmation requires valid fixed artifact identity');
  const { id, ...content } = plan;
  if (
    !confirmation.confirmed ||
    !confirmation.actor.trim() ||
    confirmation.target !== adapter.target ||
    plan.target !== adapter.target ||
    confirmation.artifactId !== artifact.id ||
    plan.artifactId !== artifact.id ||
    confirmation.planId !== id ||
    digest(content) !== id ||
    digest(artifact) !== plan.artifactHash
  )
    throw new Error('confirmation must bind the fixed artifact, target and unchanged preview');
  validateSelection(artifact, plan.selection);
  validateUnits(await adapter.request<NativeOption[]>('/api/option/'));
  const items: ApplyItemResult[] = [];
  const selected = plan.selection;
  const names = [
    ...new Set([
      ...selected.models,
      ...Object.entries(selected.plugins)
        .filter(([, keys]) => keys.length > 0)
        .map(([name]) => name),
    ]),
  ];
  for (const name of names) {
    const entry = plan.pricing.entries.find((item) => item.model_name === name);
    const pricing = structuredClone(entry?.configured ?? {});
    const labels: Array<{ partition: 'models' | 'plugins'; key: string }> = [];
    if (selected.models.includes(name)) {
      const price = artifact.models[name];
      if (!price) throw new Error(`selected model absent from artifact: ${name}`);
      pricing['billing_setting.billing_mode'] = price.billing_mode;
      pricing['billing_setting.billing_expr'] = price.billing_expr;
      labels.push({ partition: 'models', key: name });
    }
    if (selected.plugins[name]?.length) {
      const variants = {
        ...((pricing['billing_setting.plugin_billing_expr'] as Record<string, string>) ?? {}),
      };
      for (const plugin of selected.plugins[name]!) {
        const expression = artifact.plugins[name]?.[plugin];
        if (expression === undefined)
          throw new Error(`selected plugin absent from artifact: ${name}/${plugin}`);
        variants[plugin] = expression;
        labels.push({ partition: 'plugins', key: `${name}/${plugin}` });
      }
      pricing['billing_setting.plugin_billing_expr'] = variants;
    }
    let writeError: unknown;
    try {
      await adapter.request('/api/option/model_pricing', 'PATCH', {
        changes: [
          {
            model_name: name,
            expected_version: entry?.version ?? plan.pricing.empty_version,
            pricing,
          },
        ],
      });
    } catch (error) {
      writeError = error;
    }
    try {
      const readback = await adapter.request<PricingSnapshot>('/api/option/model_pricing');
      const actual = readback.entries.find((item) => item.model_name === name)?.configured;
      const status =
        writeError instanceof NativeRequestError && writeError.status === 409
          ? 'conflict'
          : digest(actual ?? {}) === digest(pricing)
            ? 'applied'
            : writeError
              ? 'failed'
              : 'mismatch';
      for (const label of labels) items.push({ ...label, status });
    } catch {
      for (const label of labels)
        items.push({
          ...label,
          status: 'unknown',
          message: 'readback failed; do not retry blindly',
        });
    }
  }
  if (selected.tools.length) {
    try {
      const previous = plan.options.find((option) => option.key === 'tool_price_setting.prices');
      const previousPrices = JSON.parse(previous?.value ?? '{}') as Record<string, number>;
      const liveOptions = await adapter.request<NativeOption[]>('/api/option/');
      validateUnits(liveOptions);
      const prices = JSON.parse(
        liveOptions.find((option) => option.key === 'tool_price_setting.prices')?.value ?? '{}',
      ) as Record<string, number>;
      if (selected.tools.some((key) => previousPrices[key] !== prices[key])) {
        for (const key of selected.tools)
          items.push({
            partition: 'tools',
            key,
            status: 'conflict',
            message: 'tool price changed since preview; preview again',
          });
        return {
          artifactId: artifact.id,
          target: adapter.target,
          actor: confirmation.actor,
          success: false,
          items,
        };
      }
      for (const key of selected.tools) {
        const price = artifact.tools[key];
        if (price === undefined) throw new Error(`selected tool absent from artifact: ${key}`);
        prices[key] = price;
      }
      let writeError: unknown;
      try {
        await adapter.request('/api/option/', 'PUT', {
          key: 'tool_price_setting.prices',
          value: JSON.stringify(prices),
        });
      } catch (error) {
        writeError = error;
      }
      try {
        const options = await adapter.request<NativeOption[]>('/api/option/');
        const actual = JSON.parse(
          options.find((option) => option.key === 'tool_price_setting.prices')?.value ?? '{}',
        ) as Record<string, number>;
        for (const key of selected.tools)
          items.push({
            partition: 'tools',
            key,
            status:
              digest(prices) === digest(actual) ? 'applied' : writeError ? 'failed' : 'mismatch',
          });
      } catch {
        for (const key of selected.tools)
          items.push({
            partition: 'tools',
            key,
            status: 'unknown',
            message: 'readback failed; do not retry blindly',
          });
      }
    } catch {
      for (const key of selected.tools)
        items.push({
          partition: 'tools',
          key,
          status: 'unknown',
          message: 'tool preflight failed; no tool write attempted',
        });
    }
  }
  return {
    artifactId: artifact.id,
    target: adapter.target,
    actor: confirmation.actor,
    success: items.every((item) => item.status === 'applied'),
    items,
  };
}
