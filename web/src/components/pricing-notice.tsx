import type { Model } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
const statusLabels: Record<string, [string, string, string]> = {
  'not-offered': [
    'Not offered by Naoshengyun',
    '脑生云未提供此模型',
    'Naoshengyun では提供していません',
  ],
  'not-selected': [
    'Price reference · selection required',
    '区域价目参考 · 未选定同步',
    '地域別参考料金・同期対象外',
  ],
  deferred: ['Review deferred', '核价已获准延期', '料金確認を延期'],
  excluded: ['Price source excluded', '价目来源不符合规则', '料金ソースは対象外'],
  subscription: [
    'Subscription pricing is out of scope',
    '订阅套餐价格不纳入核价',
    'サブスクリプション料金は確認対象外です',
  ],
  withdrawn: ['Official price withdrawn', '官方价目已撤回', '公式料金を撤回済み'],
  deprecated: ['Model deprecated', '已废弃', '廃止済み'],
  'pending-effective': ['Awaiting effective date', '等待官方价目生效', '公式料金の発効待ち'],
  'validation-held': [
    'Sync held pending billing verification',
    '实际计费待验证 · 暂停同步',
    '実課金の検証待ち・同期保留',
  ],
};
export function PricingNotice({ model }: { model: Model }) {
  const { locale } = useI18n();
  const p = model.cnyPrice;
  if (!p) return null;
  const zh = locale === 'zh',
    ja = locale === 'ja';
  const status =
    statusLabels[p.status]?.[zh ? 1 : ja ? 2 : 0] ??
    (p.status === 'missing'
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
              : 'Regional price information; API uses selected endpoint');
  return (
    <p
      className="text-muted-foreground my-2 text-xs break-words whitespace-normal"
      data-price-status={p.status}
    >
      {status}
      {p.exported && p.sourceCurrency && p.sourceCurrency !== 'CNY'
        ? ` · ${p.sourceCurrency} → CNY`
        : ''}
      {p.reason && !['not-offered', 'subscription', 'deprecated'].includes(p.status)
        ? ` · ${p.reason}`
        : ''}
    </p>
  );
}
