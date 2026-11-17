import { createHash } from 'node:crypto';
import { verifyPublicationSnapshot, type PublicationSnapshot } from './publication-promotion.js';
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function buildPublicationSite(snapshot: PublicationSnapshot) {
  const { pointer, target } = verifyPublicationSnapshot(snapshot);
  const base = './' + pointer.fixedBase;
  const links = [
    ['原生模型价格 API', './api/newapi/ratio_config.json'],
    ['当前版本指针', './current.json'],
    ['固定模型 JSON', base + 'ratio_config.json'],
    ['版本 Manifest', base + 'manifest.json'],
    ['来源与未覆盖', base + 'publication-record.json'],
    ['覆盖参考', base + 'coverage.json'],
    ['运营说明', base + 'OPERATIONS.md'],
    ['插件价格', base + 'plugin_prices.json'],
    ['工具官方报价参考', base + 'tool_prices.json'],
    ['站点完整性清单', './site-manifest.json'],
  ];
  const model = JSON.parse(target.files['ratio_config.json']!).data;
  const rows = target.manifest.selection.models
    .map(
      (name) =>
        `<tr><th scope="row">${escape(name)}</th><td><code>${escape(model.billing_expr[name])}</code></td></tr>`,
    )
    .join('');
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>脑生云 · CNY 官方价格源</title><style>body{font:16px/1.7 system-ui,sans-serif;max-width:1050px;margin:auto;padding:24px;color:#172033;background:#fafbfc}a{color:#1557ab}code{overflow-wrap:anywhere;font-size:.86em}nav{display:flex;flex-wrap:wrap;gap:12px}table{border-collapse:collapse;width:100%;table-layout:fixed}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #cbd1d9}th{width:30%}.identity{overflow-wrap:anywhere} @media(prefers-color-scheme:dark){body{background:#141820;color:#e6e9ef}a{color:#93bbff}}@media(max-width:600px){body{padding:16px}th,td{display:block;width:auto}}</style></head><body><header><p>NAOSHENGYUN / PRICE SOURCE</p><h1>脑生云 CNY 官方价格源</h1><p>官方基准报价 · 部分覆盖（partial） · 完整包 complete=${pointer.complete}</p></header><main><p>国产原始 CNY 保持；国外原始 USD 固定 ×7 一次。原始核价日期保留，发布不代表重新核价或全136可售。</p><p>这是静态价格数据读取接口，不提供推理或动态后台。模型 API 使用 success/data 原生 envelope；插件与工具分别交付，不由模型 URL 自动应用。</p><p><strong>工具对客附加费政策：目标全部有效键显式0。</strong>非零工具文件仅为官方报价参考，不是采购成本或客户应用值。任何实例配置仍需独立确认。</p><div class="identity"><p>Release：<code>${pointer.releaseId}</code></p><p>Manifest SHA256：<code>${pointer.manifestSha256}</code></p><p>源码：<code>${target.manifest.sourceSha}</code></p><p>本版：${target.manifest.selection.models.length} 模型，${Object.values(target.manifest.selection.plugins).reduce((n, p) => n + p.length, 0)} 插件项，${target.manifest.selection.tools.length} 工具项。覆盖参考136条；用户报告141差5仅资料注记。</p></div><nav aria-label="数据下载">${links.map(([name, url]) => `<a href="${url}">${name}</a>`).join('')}</nav><h2>模型基准表达式</h2><p>金额口径 CNY；Token 单价按每百万 Token。应用期间推荐固定版本 URL/hash，目标需 USDExchangeRate=1、QuotaPerUnit=500000；分组倍率独立配置。缓存/阶梯条件以表达式和来源记录为准。</p><table><thead><tr><th>原生模型名</th><td>计费表达式</td></tr></thead><tbody>${rows}</tbody></table><h2>使用边界</h2><p>下载、配置保存、调用计费和可售批准分别验收。源回退不恢复实例；缓存可能造成跨请求版本差异，严格核对固定链接与hash。原始来源、排除项和未选原因均随固定包保留。</p></main></body></html>`;
  const files = { ...snapshot.files, 'index.html': html };
  const manifest = {
    schemaVersion: 1,
    releaseId: pointer.releaseId,
    manifestSha256: pointer.manifestSha256,
    snapshotRevision: snapshot.revision,
    files: Object.fromEntries(
      Object.entries(files).map(([p, s]) => [
        p,
        { sha256: createHash('sha256').update(s).digest('hex'), bytes: Buffer.byteLength(s) },
      ]),
    ),
  };
  return {
    files: { ...files, 'site-manifest.json': JSON.stringify(manifest, null, 2) + '\n' },
    manifest,
  };
}
