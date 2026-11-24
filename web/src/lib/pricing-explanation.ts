import type { Locale } from './i18n';
import { localizePrice } from './pricing-display-labels';

type Explanation = readonly [string, string, string];

// Summarize known review reasons; preserve the exact original in the audit disclosure.
const reasons: Array<[RegExp, Explanation]> = [
  [
    /^missing-original-CNY$/,
    [
      'Official CNY pricing is not yet verified.',
      '尚未核实官方人民币原价。',
      '公式の人民元料金は未確認です。',
    ],
  ],
  [
    /^missing-cost$/,
    [
      'No verified price is available for this tariff.',
      '此价目暂无已核实价格。',
      'この料金表には確認済みの価格がありません。',
    ],
  ],
  [
    /^approved-deferred-model$/,
    [
      'Price verification is deferred until planned integration.',
      '核价已延期，将在计划接入前处理。',
      '料金確認は導入予定時まで延期されています。',
    ],
  ],
  [
    /^approved-deferred-evidence:complete-tariff-requires-source-currency$/,
    [
      'Source currency will be verified before planned integration.',
      '源币种待确认，将在计划接入前核查。',
      '導入予定時に元の通貨を確認します。',
    ],
  ],
  [
    /^approved-deferred-evidence:complete-tariff-requires-cache-usage$/,
    [
      'Cache billing conditions will be verified before planned integration.',
      '缓存计费条件待确认，将在计划接入前核查。',
      '導入予定時にキャッシュの課金条件を確認します。',
    ],
  ],
  [
    /^unsupported-unit:/,
    [
      'This billing unit is not currently supported for price synchronization.',
      '当前价格同步暂不支持此计费单位。',
      '現在の料金同期はこの課金単位に未対応です。',
    ],
  ],
  [
    new RegExp('^plugin/model:'),
    [
      'This model is not yet supported by the task billing integration.',
      '当前任务计费适配尚不支持此型号。',
      '現在のタスク課金連携はこのモデルに未対応です。',
    ],
  ],
  [
    /^seedance-4k-two-target-billing-cases-unverified$/,
    [
      '4K prices are reference only; actual billing verification is still pending.',
      '4K 价格仅供参考，实际计费仍待验证。',
      '4K 料金は参考情報です。実際の課金検証は未完了です。',
    ],
  ],
  [
    /^Separate explicitly selected asynchronous Batch list;/,
    [
      'Batch is a separate reference tariff, not the selected Standard price. Caching conditions also apply.',
      'Batch 是独立参考价目，不是当前选定的 Standard 价格；仍须遵循缓存条件。',
      'Batch は独立した参考料金で、選択中の Standard 料金ではありません。キャッシュ条件も適用されます。',
    ],
  ],
  [
    /^Conditional US-only inference;/,
    [
      'This tariff applies only to US inference, with a 10% increase across token categories.',
      '此价目仅适用于美国区域推理，各类 Token 价格加收 10%。',
      'この料金は米国リージョンの推論専用で、各トークン料金に 10% が加算されます。',
    ],
  ],
  [
    /^Conditional Fast speed[.]/,
    [
      'Fast is a separate tariff and cannot be combined with Batch. Caching and regional conditions still apply.',
      'Fast 为独立价目，不能与 Batch 叠加；仍须遵循缓存和区域条件。',
      'Fast は独立した料金で、Batch とは併用できません。キャッシュとリージョンの条件も適用されます。',
    ],
  ],
  [
    /^(Native weekly schedules|Cannot represent holiday exclusions)/,
    [
      'Holiday off-peak pricing cannot currently be synchronized accurately.',
      '当前尚不能准确同步法定节假日的非高峰价格。',
      '祝日のオフピーク料金は現在正確に同期できません。',
    ],
  ],
  [
    /^Native Gemini model sync has no dedicated audio cache/,
    [
      'Separate audio-cache and cache-storage charges cannot currently be fully synchronized.',
      '独立的音频缓存及缓存存储费用当前尚不能完整同步。',
      '音声キャッシュとキャッシュ保存の個別料金は現在完全には同期できません。',
    ],
  ],
  [
    /^Explicit cache storage charges/,
    [
      'Cache storage is charged by duration and cannot currently be fully synchronized. See the tariff below for the published conditions.',
      '缓存存储按时长另行收费，当前尚不能完整同步；已公布条件见价目明细。',
      'キャッシュ保存は時間に応じて別途課金され、現在は完全な同期に未対応です。公表済みの条件は料金明細をご確認ください。',
    ],
  ],
  [
    /^Original rates are verified; mixed text[+]image output/,
    [
      'Text and image output must be metered separately before this tariff can be synchronized accurately.',
      '文本与图像输出需要分别计量后，才能准确同步此价目。',
      'この料金を正確に同期するには、テキストと画像の出力を別々に計測する必要があります。',
    ],
  ],
  [
    /^Native Gemini model sync has no distinct Live video/,
    [
      'Live video input cannot currently be metered separately for price synchronization.',
      '实时视频输入尚不能独立计量，暂不支持同步此价目。',
      'ライブ動画入力を個別に計測できないため、この料金は同期未対応です。',
    ],
  ],
  [
    /^Native Gemini model sync has no generated-song/,
    [
      'Per-song billing is not currently supported for price synchronization.',
      '当前价格同步暂不支持按歌曲数量计费。',
      '現在の料金同期は楽曲数による課金に未対応です。',
    ],
  ],
  [
    /^(512k not expanded|Exact expansion of K not verified)/,
    [
      'The exact token threshold needs confirmation before this tariff can be synchronized.',
      'Token 门槛的精确数值仍待确认，暂不支持同步此价目。',
      '同期前にトークン境界値の正確な数値を確認する必要があります。',
    ],
  ],
  [
    /^Native Voxtral model pricing/,
    [
      'This tariff combines audio minutes and text tokens; complete synchronization is not currently supported.',
      '此价目同时按音频分钟和文本 Token 计费，当前尚不能完整同步。',
      'この料金は音声の分数とテキストのトークン数を併用し、現在完全な同期に未対応です。',
    ],
  ],
  [
    /^Different service tier,/,
    [
      'This service tier is reference only and must be selected separately. Regional and caching conditions still apply.',
      '此服务档仅供参考，需单独选定；仍须遵循区域和缓存条件。',
      'このサービス階層は参考情報で、別途選択が必要です。リージョンとキャッシュ条件も適用されます。',
    ],
  ],
  [
    /^Published Batch rates retained/,
    [
      'Batch pricing is published, but endpoint and mode support still need confirmation before synchronization.',
      'Batch 报价已公布，但端点及模式支持仍待确认，暂不支持同步。',
      'Batch 料金は公表済みですが、同期前にエンドポイントとモードの対応確認が必要です。',
    ],
  ],
  [
    /^This raw Standard cache-inclusive/,
    [
      'This tariff applies to image generation through Responses, with separate main-model charges. Cache usage cannot yet be fully verified for synchronization.',
      '此价目适用于 Responses 图像生成，主模型另行收费；缓存用量尚不能完整核实，暂不支持同步。',
      'この料金は Responses の画像生成用で、主モデルは別途課金されます。同期に必要なキャッシュ使用量の確認は未完了です。',
    ],
  ],
  [
    /^(Native realtime pricing|Native audio usage)/,
    [
      'Audio-cache usage cannot currently be metered separately for accurate synchronization.',
      '音频缓存用量尚不能独立计量，暂不支持准确同步。',
      '音声キャッシュ使用量を個別に計測できないため、正確な同期に未対応です。',
    ],
  ],
  [
    /^Official original rates are denominated in INR;/,
    [
      'Official prices are in INR, outside the current CNY/USD conversion policy.',
      '官方原价以印度卢比计价，不在当前人民币／美元换算政策范围内。',
      '公式料金はインドルピー建てで、現在の人民元・米ドル換算方針の対象外です。',
    ],
  ],
  [
    /^No matching exact model rate on the official INR tariff;/,
    [
      'No matching official INR price has been verified for this exact model.',
      '尚未核实此精确型号对应的官方印度卢比价格。',
      'この正確なモデルに対応する公式インドルピー料金は未確認です。',
    ],
  ],
  [
    /^Explicit cache additionally bills token-hours,/,
    [
      'Explicit cache storage is charged by duration; complete synchronization is not currently supported.',
      '显式缓存存储按时长另行收费，当前尚不能完整同步。',
      '明示キャッシュ保存は時間に応じて別途課金され、現在完全な同期に未対応です。',
    ],
  ],
  [
    /^Promotional rate reference only;/,
    [
      'This promotion is reference only, not the official base price or a selected synchronization price.',
      '此促销价仅供参考，不是官方基础价，也不是选中的同步价格。',
      'このプロモーション料金は参考情報であり、公式基準価格または選択中の同期料金ではありません。',
    ],
  ],
  [
    /^ModelCost has no cached-audio/,
    [
      'Separate audio-cache and time-based storage charges cannot currently be fully synchronized.',
      '独立音频缓存和按时长计费的存储费用当前尚不能完整同步。',
      '音声キャッシュと時間制の保存料金は現在完全には同期できません。',
    ],
  ],
];

export function priceExplanation(reason: string, locale: Locale) {
  const match = reasons.find(([pattern]) => pattern.test(reason));
  return localizePrice(
    match?.[1] ?? [
      'Additional applicability details are recorded in the original tariff and evidence.',
      '此价目另有适用说明，详见原始价目与核对证据。',
      '追加の適用条件については、元の料金記録と証拠をご確認ください。',
    ],
    locale,
  );
}
