import type { OfficialCheckView, QuoteCheck } from '@/lib/official-check';
import { INTL_LOCALES } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

const messages = {
  en: {
    version: 'Price version checked',
    latestAttempt: 'Latest attempt',
    latestSuccess: 'Last successful check',
    effective: 'Effective from',
    noResult: 'No check recorded for this tariff',
    loading: 'Loading official check results…',
    unavailable: 'Check results are unavailable',
    'different-release': 'No check results for this published version yet',
    'refresh-failed': 'Could not refresh the check results. Showing the last results received.',
    pending: 'Awaiting review',
    closed: 'Review PR closed',
    statuses: {
      unchanged: 'Checked · no change',
      failed: 'Check failed',
      changed: 'Tariff change found',
      'future-effective': 'Future tariff found',
      withdrawal: 'Official withdrawal found',
      withdrawn: 'Tariff withdrawn',
      restoration: 'Official restoration found',
      deferred: 'Check deferred',
      deprecated: 'Tariff deprecated',
      'not-offered': 'Out of service scope',
      'not-registered': 'Automatic check unavailable',
      unsupported: 'Billing conditions unsupported',
      excluded: 'Excluded from check',
      'tool-reference': 'Tool tariff reference',
    },
  },
  zh: {
    version: '核查对应的价格版本',
    latestAttempt: '最近尝试',
    latestSuccess: '最近成功核查',
    effective: '生效时间',
    noResult: '此价目暂无核查记录',
    loading: '正在加载核查结果…',
    unavailable: '暂时无法读取核查结果',
    'different-release': '当前发布版本暂无核查结果',
    'refresh-failed': '核查状态刷新失败，以下为上次读取的结果。',
    pending: '待审核',
    closed: '审核 PR 已关闭',
    statuses: {
      unchanged: '核查成功 · 价格无变化',
      failed: '核查失败',
      changed: '发现价目变化',
      'future-effective': '发现待生效价目',
      withdrawal: '发现官方撤价',
      withdrawn: '价目已撤回',
      restoration: '发现官方恢复报价',
      deferred: '延期核查',
      deprecated: '价目已废弃',
      'not-offered': '超出服务范围',
      'not-registered': '暂无自动核查',
      unsupported: '计费条件尚未支持',
      excluded: '已排除',
      'tool-reference': '工具参考价目',
    },
  },
  ja: {
    version: '確認対象の料金版',
    latestAttempt: '最新の確認試行',
    latestSuccess: '最後に確認できた日時',
    effective: '適用開始',
    noResult: 'この料金に確認記録はありません',
    loading: '公式料金の確認結果を読み込み中…',
    unavailable: '確認結果を読み込めません',
    'different-release': '現在の公開版には確認結果がありません',
    'refresh-failed': '確認結果を更新できません。前回取得した結果を表示しています。',
    pending: 'レビュー待ち',
    closed: 'レビュー PR は終了',
    statuses: {
      unchanged: '確認済み · 変更なし',
      failed: '確認に失敗',
      changed: '料金の変更を検出',
      'future-effective': '適用前の新料金を検出',
      withdrawal: '公式料金の撤回を検出',
      withdrawn: '料金は撤回済み',
      restoration: '公式料金の復活を検出',
      deferred: '確認を延期',
      deprecated: '料金は廃止済み',
      'not-offered': 'サービス対象外',
      'not-registered': '自動確認は未対応',
      unsupported: '未対応の課金条件',
      excluded: '確認対象外',
      'tool-reference': 'ツール料金の参考情報',
    },
  },
} as const;

export function OfficialCheckNotice({ view }: { view: OfficialCheckView }) {
  const { locale } = useI18n();
  const msg = messages[locale];
  return (
    <div className="text-muted-foreground text-sm" role="status">
      {view.results && (
        <p>
          {msg.version}{' '}
          <a className="font-mono underline" href={`./versions/${view.candidateId}/manifest.json`}>
            {view.candidateId.slice(0, 12)}
          </a>
        </p>
      )}
      {view.state !== 'ready' && <p>{msg[view.state]}</p>}
    </div>
  );
}

export function QuoteOfficialCheck({ result }: { result: QuoteCheck | undefined }) {
  const { locale } = useI18n();
  const msg = messages[locale];
  if (!result) return <p className="text-muted-foreground text-xs">{msg.noResult}</p>;

  const formatter = new Intl.DateTimeFormat(INTL_LOCALES[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  const dates = [
    [msg.latestAttempt, result.latestAttemptedAt],
    [msg.latestSuccess, result.latestSuccessfulAt],
    ...(result.effectiveAt ? [[msg.effective, result.effectiveAt]] : []),
  ] as const;
  return (
    <div
      className="bg-muted/50 space-y-1.5 rounded-md px-3 py-2"
      data-official-check={result.status}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-medium">
        <span>{msg.statuses[result.status]}</span>
        {result.review && (
          <a href={result.review.url} className="underline" target="_blank" rel="noreferrer">
            {result.review.open ? msg.pending : msg.closed}
          </a>
        )}
      </p>
      {result.reason && <p className="text-muted-foreground text-xs">{result.reason}</p>}
      <dl className="text-muted-foreground grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        {dates.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="tabular-nums">
              {value ? (
                <time dateTime={value} title={value}>
                  {formatter.format(Date.parse(value))}
                </time>
              ) : (
                '—'
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
