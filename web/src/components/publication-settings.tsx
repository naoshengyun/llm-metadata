import { Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/copy-button';
import { useI18n } from '@/lib/i18n';
import type { PriceQuote } from '@/lib/api';

const labels = {
  en: {
    close: 'Close',
    policy:
      'Original CNY is retained. Original USD amounts are multiplied by 7 once. Use group ratios in New API for discounts.',
    plugin:
      'A plugin-specific override takes precedence. Model price sync keeps existing plugin overrides. With no override, the plugin inherits the model expression.',
    tool: 'Operations policy: tool calls are free. Operators set tool prices to 0 in New API.',
    references: 'Official tool tariff references',
    copy: 'Copy full configuration',
    download: 'Download configuration',
    copyURL: 'Copy price source URL',
    coverage: 'Fixed version, sources and coverage',
    loading: 'Loading references…',
    error: 'Tool references unavailable',
  },
  zh: {
    close: '关闭',
    policy: '官方原始 CNY 保持，原始 USD 金额只乘 7 一次。折扣由运营通过 New API 分组倍率设置。',
    plugin:
      '插件专属覆盖优先。同步模型基础价会保留已有插件覆盖。无覆盖时，任务插件继承模型表达式。',
    tool: '运营政策为工具调用免费。运营在 New API 手动把工具价格设为 0。',
    references: '官方工具价目参考',
    copy: '复制全部配置',
    download: '下载配置',
    copyURL: '复制价格源地址',
    coverage: '固定版本、来源与覆盖清单',
    loading: '正在加载参考价…',
    error: '工具价目参考加载失败',
  },
  ja: {
    close: '閉じる',
    policy:
      '元の CNY 額を維持し、元の USD 額に一度だけ 7 を掛けます。割引は New API のグループ倍率で設定します。',
    plugin:
      'プラグイン固有の設定が優先され、モデル料金の同期時も保持されます。固有の設定がなければモデル料金式を継承します。',
    tool: '運用方針ではツール呼び出しは無料です。運用担当者が New API でツール料金を 0 に設定します。',
    references: '公式ツール料金の参考資料',
    copy: '全設定をコピー',
    download: '設定をダウンロード',
    copyURL: '料金ソース URL をコピー',
    coverage: '固定版・ソース・対象一覧',
    loading: '参考資料を読み込み中…',
    error: 'ツール料金の参考資料を取得できませんでした',
  },
} as const;

interface ToolReferences {
  official: PriceQuote[];
  optional: {
    provider: string;
    region?: string;
    source: string;
    checkedAt?: string;
    currency: string;
    unit: string;
    fees: Record<string, number>;
    note: string;
  }[];
}

function ToolTariffs({ candidateBase }: { candidateBase: string }) {
  const { locale } = useI18n();
  const [data, setData] = useState<ToolReferences | null>(null);
  const [failed, setFailed] = useState(false);
  const msg = labels[locale];
  useEffect(() => {
    const controller = new AbortController();
    fetch(candidateBase + '/api/cny-tools.json', { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error('Tool references unavailable');
        return r.json();
      })
      .then(setData)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [candidateBase]);
  if (failed || !data) return <p role="status">{failed ? msg.error : msg.loading}</p>;
  return (
    <div className="mt-2 space-y-3 text-sm">
      {data.official.map((quote) => (
        <article key={quote.quoteId} className="rounded border p-2">
          <a className="underline" href={quote.source.url ?? undefined}>
            {quote.priceList}
          </a>
          <p>{quote.source.checkedAt}</p>
          {Array.isArray(quote.sourcePrice) &&
            quote.sourcePrice.map((fee) => (
              <p key={fee.key}>
                {fee.key} · {fee.currency} {fee.amount} / {fee.unit}
              </p>
            ))}
        </article>
      ))}
      {data.optional.map((ref) => (
        <article key={ref.source} className="rounded border p-2">
          <a className="underline" href={ref.source}>
            {ref.provider}
          </a>
          {ref.region && ` · ${ref.region}`}
          {ref.checkedAt && ` · ${ref.checkedAt}`}
          <ul>
            {Object.entries(ref.fees).map(([key, amount]) => (
              <li key={key}>
                {key} · {ref.currency} {amount} / {ref.unit}
              </li>
            ))}
          </ul>
          <p>{ref.note}</p>
        </article>
      ))}
    </div>
  );
}

export function NewApiSettings({ candidateBase }: { candidateBase?: string }) {
  const ratioPath = (candidateBase ?? '.') + '/api/newapi/ratio_config.json';
  const { locale } = useI18n();
  const msg = labels[locale];
  const [toolsOpen, setToolsOpen] = useState(false);
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setToolsOpen(false);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="new-api">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={msg.close} className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New API · CNY</DialogTitle>
        </DialogHeader>
        <p>{msg.policy}</p>
        <p>USDExchangeRate=1 · QuotaPerUnit=500000</p>
        {candidateBase && (
          <>
            <p>{msg.plugin}</p>
            <p>{msg.tool}</p>
          </>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton
            label={msg.copy}
            text={async () => {
              const r = await fetch(ratioPath);
              if (!r.ok) throw Error('Configuration unavailable');
              return r.text();
            }}
          />
          <CopyButton label={msg.copyURL} text={new URL(ratioPath, window.location.href).href} />
        </div>
        <a className="underline" href={ratioPath} download="ratio_config.json">
          {msg.download}
        </a>
        <a className="underline" href="./publication.html">
          {msg.coverage}
        </a>
        {candidateBase && (
          <details onToggle={(event) => setToolsOpen(event.currentTarget.open)}>
            <summary>{msg.references}</summary>
            {toolsOpen && <ToolTariffs candidateBase={candidateBase} />}
          </details>
        )}
      </DialogContent>
    </Dialog>
  );
}
