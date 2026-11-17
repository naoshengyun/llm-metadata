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
            ? '43 项固定官方基准报价 · 部分覆盖（partial），完整包 complete=false。'
            : '43 fixed official base-price entries · partial coverage · complete=false.'}
        </p>
        <p>
          {zh
            ? '原始核价日期：2026-11-16。国产 CNY 保持，国外 USD ×7 一次。缓存、阶梯和多模态条件见模型详情。'
            : 'Prices checked: 2026-11-16. Original CNY retained; USD ×7 once. See model details for cache, tier and modality conditions.'}
        </p>
        <p>USDExchangeRate=1 · QuotaPerUnit=500000</p>
        <p>
          {zh
            ? '配置来自固定快照，分组倍率独立配置；不在浏览器重新换汇或生成另一套价格。插件/工具未选择；官方工具报价不等于对客附加费或实例已清零。'
            : 'Configuration comes from the fixed snapshot. Group ratios are independent. Plugins/tools are not selected. Official tool references do not establish customer surcharges or instance settings.'}
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
