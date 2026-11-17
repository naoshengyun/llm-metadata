import { Settings } from 'lucide-react';
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
export function NewApiSettings() {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="new-api">
          <Settings className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={zh ? '关闭' : 'Close'} className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>new-api · CNY</DialogTitle>
        </DialogHeader>
        <p>
          {zh
            ? '上游完整目录 · CNY 默认展示。仅金额 USD ×7 一次，明确原始 CNY 保持。'
            : 'Complete upstream catalog · CNY default. USD monetary amounts ×7 once; original CNY retained.'}
        </p>
        <p>
          {zh
            ? '缺少原始人民币价的国内端点、订阅及不支持项明确标注，不以零补齐；价格 API 只导出全部合格且已选区域的项目。'
            : 'Domestic endpoints without original CNY, subscriptions and unsupported tariffs are marked explicitly, never filled with zero. The API exports all eligible selected-region prices.'}
        </p>
        <p>USDExchangeRate=1 · QuotaPerUnit=500000</p>
        <p>
          {zh
            ? '元数据与上游来源/更新时间保持；快照发布不代表重新核价或实例配置生效。'
            : 'Metadata and upstream dates are preserved. Publishing a snapshot does not reverify prices or apply instance configuration.'}
        </p>
        <CopyButton
          label={zh ? '复制全部配置' : 'Copy full configuration'}
          text={async () => {
            const r = await fetch('./api/newapi/ratio_config.json');
            if (!r.ok) throw Error('configuration unavailable');
            return r.text();
          }}
        />
        <a className="underline" href="./api/newapi/ratio_config.json" download="ratio_config.json">
          {zh ? '下载配置' : 'Download configuration'}
        </a>
        <a className="underline" href="./publication.html">
          {zh ? '固定版本、来源、覆盖与下载' : 'Fixed version, sources, coverage and downloads'}
        </a>
      </DialogContent>
    </Dialog>
  );
}
