import type { Model } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
export function PricingNotice({ model }: { model: Model }) {
  const { locale } = useI18n();
  const p = model.cnyPrice;
  if (!p) return null;
  const zh = locale === 'zh',
    ja = locale === 'ja';
  const status =
    p.status === 'missing'
      ? zh
        ? p.reason === 'missing-original-CNY'
          ? '缺少原始 CNY 价格；未导出'
          : '缺少上游源价格；未导出'
        : ja
          ? p.reason === 'missing-original-CNY'
            ? '元の CNY 価格なし・未出力'
            : '上流価格なし・未出力'
          : p.reason === 'missing-original-CNY'
            ? 'Original CNY price unavailable; not exported'
            : 'Upstream source price unavailable; not exported'
      : p.status === 'subscription'
        ? zh
          ? '订阅套餐；不是普通 Token 价'
          : ja
            ? 'サブスクリプション・通常のトークン料金ではありません'
            : 'Subscription plan; not a token tariff'
        : p.status === 'unsupported'
          ? zh
            ? '价格仅供资料；原生计费暂不支持'
            : ja
              ? '参考価格・ネイティブ課金未対応'
              : 'Price information only; native billing unsupported'
          : p.exported
            ? zh
              ? 'CNY 基础价 · 已纳入价格 API'
              : ja
                ? 'CNY 基準価格・API 対象'
                : 'CNY base price · included in API'
            : zh
              ? '区域资料价；API 使用国内/已选端点'
              : ja
                ? '地域別参考価格・API は選択端点を使用'
                : 'Regional price information; API uses selected endpoint';
  return (
    <p
      className="text-muted-foreground my-2 text-xs break-words whitespace-normal"
      data-price-status={p.status}
    >
      {status}
      {p.sourceCurrency ? ` · ${p.sourceCurrency} → CNY` : ''}
      {p.reason ? ` · ${p.reason}` : ''}
    </p>
  );
}
