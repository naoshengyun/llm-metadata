import type { Locale } from './i18n';
import { localizePrice } from './pricing-display-labels';

// Exact source descriptions: changed or unknown text remains visible until reviewed.
const descriptions: Record<string, readonly [string, string, string]> = {
  'Original USD for https://api.x.ai/v1/videos/generations. Rates are assigned by generated video resolution; media input charges retain their own units.':
    [
      'Video rates depend on output resolution. Media inputs are charged separately in their listed units.',
      '视频费率按输出分辨率确定；媒体输入按各自列明的单位另行计费。',
      '動画料金は出力解像度によって決まり、メディア入力は記載の単位で別途課金されます。',
    ],
  'First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.':
    [
      'Standard global API pricing per million tokens. Cache writes last 5 minutes or 1 hour; reads refresh that lifetime. Thinking output, tool content and image inputs count toward billed tokens.',
      '全球 Standard API 按百万 Token 计费。缓存写入有效期为 5 分钟或 1 小时，读取会刷新有效期；思考输出、工具内容和图像输入均计入 Token 用量。',
      'グローバル Standard API の百万トークン単価です。キャッシュ書込は5分または1時間有効で、読取で有効期間が更新されます。思考出力、ツール内容、画像入力も課金対象です。',
    ],
  'First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. Entire request uses high rates iff prompt >100,000 tokens, counting ordinary input plus cache reads and writes.':
    [
      'Standard global API pricing per million tokens. Cache writes last 5 minutes or 1 hour; reads refresh that lifetime. Thinking output, tool content and image inputs count toward billed tokens. Above 100,000 prompt tokens, including cache reads and writes, the whole request uses higher rates.',
      '全球 Standard API 按百万 Token 计费。缓存写入有效期为 5 分钟或 1 小时，读取会刷新有效期；思考输出、工具内容和图像输入均计入 Token 用量。 提示词超过 100,000 Token（含缓存读写）时，整次请求适用高档价。',
      'グローバル Standard API の百万トークン単価です。キャッシュ書込は5分または1時間有効で、読取で有効期間が更新されます。思考出力、ツール内容、画像入力も課金対象です。 キャッシュ読書込を含むプロンプトが100,000トークンを超えると全体に高単価が適用されます。',
    ],
  'First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. The earlier planned September 2026 price increase was cancelled; $2/$10 is now standard, not an expired introductory price.':
    [
      'Standard global API pricing per million tokens. Cache writes last 5 minutes or 1 hour; reads refresh that lifetime. Thinking output, tool content and image inputs count toward billed tokens. The planned September 2026 increase was cancelled; $2/$10 is the standard price.',
      '全球 Standard API 按百万 Token 计费。缓存写入有效期为 5 分钟或 1 小时，读取会刷新有效期；思考输出、工具内容和图像输入均计入 Token 用量。 原定 2026 年 9 月涨价已取消，$2/$10 为标准价。',
      'グローバル Standard API の百万トークン単価です。キャッシュ書込は5分または1時間有効で、読取で有効期間が更新されます。思考出力、ツール内容、画像入力も課金対象です。 2026年9月予定の値上げは撤回され、$2/$10が標準料金です。',
    ],
  'First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. Deprecated but available on checked date; retirement November 30, 2026; 200K context. The dated ID and convenience alias are explicitly documented.':
    [
      'Standard global API pricing per million tokens. Cache writes last 5 minutes or 1 hour; reads refresh that lifetime. Thinking output, tool content and image inputs count toward billed tokens. Deprecated, with retirement on November 30, 2026 and a 200K context limit.',
      '全球 Standard API 按百万 Token 计费。缓存写入有效期为 5 分钟或 1 小时，读取会刷新有效期；思考输出、工具内容和图像输入均计入 Token 用量。 已废弃，退役日期为 2026 年 11 月 30 日，上下文上限 200K。',
      'グローバル Standard API の百万トークン単価です。キャッシュ書込は5分または1時間有効で、読取で有効期間が更新されます。思考出力、ツール内容、画像入力も課金対象です。 非推奨で2026年11月30日提供終了、コンテキスト上限は200Kです。',
    ],
  'First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.':
    [
      'Standard global API pricing per million tokens. Input above 272,000 tokens applies higher rates to the whole request: input and cache ×2, output ×1.5. Cache writes replace input charges and last 30 minutes or 12 hours; 12-hour caching requires Responses. Reasoning counts as output; optional tools cost extra.',
      '全球 Standard API 按百万 Token 计费。输入超过 272,000 Token 时整次请求适用高档价：输入和缓存为 2 倍，输出为 1.5 倍。缓存写入替代普通输入收费，有效期为 30 分钟或 12 小时，12 小时缓存限 Responses；推理按输出计费，可选工具另收费。',
      'グローバル Standard API の百万トークン単価です。入力が272,000を超えるとリクエスト全体で入力・キャッシュは2倍、出力は1.5倍です。キャッシュ書込は通常入力料金を置き換え、有効期間は30分または12時間（Responses限定）。推論は出力課金、任意ツールは別料金です。',
    ],
  'First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate. $4/$20 promotional pricing is published only through November30,2026; no later rate inferred.':
    [
      'Standard global API pricing per million tokens. Input above 272,000 tokens applies higher rates to the whole request: input and cache ×2, output ×1.5. Cache writes replace input charges and last 30 minutes or 12 hours; 12-hour caching requires Responses. Reasoning counts as output; optional tools cost extra. The $4/$20 promotion is published only through November 30, 2026; later rates are unknown.',
      '全球 Standard API 按百万 Token 计费。输入超过 272,000 Token 时整次请求适用高档价：输入和缓存为 2 倍，输出为 1.5 倍。缓存写入替代普通输入收费，有效期为 30 分钟或 12 小时，12 小时缓存限 Responses；推理按输出计费，可选工具另收费。 $4/$20 促销价仅公布至 2026 年 11 月 30 日，后续价格未定。',
      'グローバル Standard API の百万トークン単価です。入力が272,000を超えるとリクエスト全体で入力・キャッシュは2倍、出力は1.5倍です。キャッシュ書込は通常入力料金を置き換え、有効期間は30分または12時間（Responses限定）。推論は出力課金、任意ツールは別料金です。 $4/$20の割引は2026年11月30日まで公表済みで、以降の料金は未定です。',
    ],
  'Original USD per1M tokens. Direct /v1/images/generations or /edits, raster image output only. Text input5; image input8; image-only usage.output_tokens30 (ordinary c meter), not an assumed img_o count. The official guide expressly excludes direct Images API from cached rates for2/2.5. Resolution/quality changes token consumption, not this per-token rate. Each partial image adds100 charged output tokens. Responses tool path and SVG are excluded separately.':
    [
      'Direct Images generation/editing only; raster images, excluding Responses and SVG. Per million tokens: text input $5, image input $8, image output $30. No cached rate applies. Resolution and quality affect token usage, not unit price; each partial image adds 100 billed output tokens.',
      '仅适用于 Images 直接生成或编辑位图，不含 Responses 和 SVG。每百万 Token：文本输入 $5、图像输入 $8、图像输出 $30，不适用缓存价。分辨率和质量影响 Token 用量而非单价；每张中间图像增加 100 个计费输出 Token。',
      'Images APIでの直接生成・編集（ラスター画像）専用で、ResponsesとSVGは対象外です。百万トークン当たりテキスト入力$5、画像入力$8、画像出力$30。キャッシュ料金は適用されません。解像度・品質は単価ではなく使用量に影響し、中間画像ごとに出力100トークンが加算されます。',
    ],
  'Original USD per1M tokens. Direct /v1/images/generations or /edits, raster image output only. Text input5; image input8; image-only usage.output_tokens30 (ordinary c meter), not an assumed img_o count. The official guide expressly excludes direct Images API from cached rates for2/2.5. Resolution/quality changes token consumption, not this per-token rate. Each partial image adds100 charged output tokens. Responses tool path and SVG are excluded separately. Official model is deprecated; default snapshot gpt-image-2-2026-04-21.':
    [
      'Direct Images generation/editing only; raster images, excluding Responses and SVG. Per million tokens: text input $5, image input $8, image output $30. No cached rate applies. Resolution and quality affect token usage, not unit price; each partial image adds 100 billed output tokens. The model is deprecated; its default snapshot is gpt-image-2-2026-04-21.',
      '仅适用于 Images 直接生成或编辑位图，不含 Responses 和 SVG。每百万 Token：文本输入 $5、图像输入 $8、图像输出 $30，不适用缓存价。分辨率和质量影响 Token 用量而非单价；每张中间图像增加 100 个计费输出 Token。 该模型已废弃，默认快照为 gpt-image-2-2026-04-21。',
      'Images APIでの直接生成・編集（ラスター画像）専用で、ResponsesとSVGは対象外です。百万トークン当たりテキスト入力$5、画像入力$8、画像出力$30。キャッシュ料金は適用されません。解像度・品質は単価ではなく使用量に影響し、中間画像ごとに出力100トークンが加算されます。 非推奨モデルで、既定スナップショットはgpt-image-2-2026-04-21です。',
    ],
  'Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. Cache-write is 5-minute TTL; cache_write_1h is 1-hour TTL. Default automatic caching uses 5m; a cache hit does not incur another write fee. No context-price tiers published.':
    [
      'Standard synchronous pay-as-you-go CNY rates per million tokens. Cache writes last 5 minutes or 1 hour; automatic caching defaults to 5 minutes. Cache hits do not incur another write fee. No context price tiers are published.',
      '标准同步按量人民币价，单位为百万 Token。缓存写入有效期为 5 分钟或 1 小时，自动缓存默认 5 分钟；命中缓存不重复收写入费。未公布上下文阶梯价。',
      '標準同期の従量制人民元料金（百万トークン単位）です。キャッシュ書込は5分または1時間有効で、自動キャッシュは既定で5分。ヒット時に書込料は再課金されません。コンテキスト段階料金は未公表です。',
    ],
  'Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. K2 models remain available only to existing users; official pages say no new users from October 31 / before November 1, 2026, with full retirement planned by end December. K2 has no separately published cache-write price in this table.':
    [
      'Synchronous CNY rates per million tokens. K2 is limited to existing users: new access ended around October 31 / November 1, 2026; full retirement is planned by the end of December. No separate cache-write price is published.',
      '同步人民币价，单位为百万 Token。K2 仅限存量用户，2026 年 10 月 31 日／11 月 1 日前后停止新增用户，计划于 12 月底全面退役；未单独公布缓存写入价。',
      '同期の人民元料金（百万トークン単位）です。K2は既存ユーザー限定で、2026年10月31日／11月1日前後に新規利用を終了、12月末までに全面提供終了予定です。個別のキャッシュ書込料金は未公表です。',
    ],
  'Separate asynchronous Batch API price list; never select for synchronous requests. Cache hit best-effort. For K3, separate 5m / 1h writes apply. For K2.7-code, both write columns show dash (not a declared zero price); existing-user retirement condition remains.':
    [
      'Asynchronous Batch only, not synchronous requests. Cache hits are best effort. K3 has separate 5-minute and 1-hour write rates. K2.7-code write prices are unpublished, not zero; existing-user retirement restrictions still apply.',
      '仅适用于异步 Batch，不适用于同步请求。缓存命中不保证；K3 分别提供 5 分钟和 1 小时写入价。K2.7-code 写入价未公布，不代表免费，仍受存量用户及退役限制。',
      '非同期Batch専用で、同期リクエストには適用されません。キャッシュヒットは保証されません。K3は5分・1時間の書込料を別途設定。K2.7-codeの書込料は未公表で無料ではなく、既存ユーザー・提供終了の制限も適用されます。',
    ],
  'Published standard API list, excluding GLM Coding Plan and resource packs. Reasoning tokens count as output; cache storage is temporarily free, with no post-promotion price or end date published. No cache-write token fee is invented. For GLM-5.3-Flash, model-guide marketing mentions a limited discount but the current pricing table publishes 0.8/2.8/0.23; this record preserves the actual price-list figures and does not infer an extra discount.':
    [
      'Standard API rates, excluding Coding Plan and resource packs. Reasoning is billed as output. Cache storage is temporarily free; no end date or later price is published. No separate cache-write fee or extra Flash promotional discount is assumed.',
      '标准 API 价，不含 Coding Plan 和资源包；推理按输出计费。缓存存储暂时免费，未公布结束日期或后续价格。不额外推定缓存写入费或 Flash 促销折扣。',
      '標準API料金で、Coding Plan・リソースパックは対象外。推論は出力課金です。キャッシュ保存は一時無料で、終了日・以降の料金は未公表。個別の書込料やFlashの追加割引は推定していません。',
    ],
  'Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.':
    [
      'Beijing online rates without the Plus 20% promotional discount. Cache modes are separate tariffs. Reasoning and answer output share the output rate; maximum input is 1,000,000 tokens. Optional tools are charged separately.',
      '北京在线价，不叠加 Plus 八折促销；不同缓存模式为独立价目。思考和回答输出采用相同输出费率，最大输入为 1,000,000 Token；可选工具另行计费。',
      '北京オンライン料金で、Plusの20%割引は適用していません。キャッシュモード別の料金表です。思考・回答出力は同じ出力単価、最大入力は1,000,000トークン。任意ツールは別料金です。',
    ],
  'Mainland Ark regular online inference, implicit cache only. Exact Model ID verified against official model-list family. Explicit Responses caching is a separate excluded shape; raw storage rate retained. Do not add explicit storage cost to this implicit list. Optional server-side tools require separate matching meters.':
    [
      'Mainland online inference with implicit caching only. Explicit Responses caching and its storage charges are separate and excluded here. Optional server-side tools require separate billing support.',
      '中国大陆在线推理，仅含隐式缓存；Responses 显式缓存及其存储费另列，不计入此价目。可选服务端工具需单独计费支持。',
      '中国本土のオンライン推論・暗黙キャッシュ専用です。Responsesの明示キャッシュと保存料は別扱いで、この料金表には含みません。任意のサーバーツールには個別の課金対応が必要です。',
    ],
  'Official model-list exact ID; only online task token fee. Offline inference has separate 7.50 CNY/M tokens; not included in this online list. Upcoming deprecation noted by model list.':
    [
      'Online task token pricing only. Offline inference costs ¥7.50 per million tokens and is excluded here. The model is scheduled for retirement.',
      '仅列在线任务 Token 价；离线推理为 ¥7.50／百万 Token，不含在此价目内。该模型已公告即将退役。',
      'オンラインタスクのトークン料金のみです。オフライン推論は百万トークン当たり¥7.50で、この料金表の対象外です。提供終了予定が公表されています。',
    ],
  'Native doubao task, exact official ID. tokens must be API usage.completion_tokens (billable usage includes video-input minimum), not an estimate from seconds. Official price page uses 4K; fixed schema condition is lower-case 4k. Failed generations free. Last unconditional fallback handles remaining supported 480p/720p no-input-video cases.':
    [
      'Charged per million reported output tokens, not estimated video seconds. Input video includes a minimum token charge. Failed generations are free; rates vary by resolution and whether input video is supplied.',
      '按接口返回的输出 Token 数、以百万 Token 为单位计费，不按视频秒数估算。输入视频包含最低 Token 计费量；生成失败不收费，费率按分辨率及是否输入视频区分。',
      '返された出力トークン数を百万トークン単位で課金し、動画秒数からは推定しません。入力動画には最低トークン課金量があります。生成失敗は無料で、解像度と入力動画の有無で単価が異なります。',
    ],
  'Official Ark online rates for 480p, 720p and 1080p. Billing uses the API completion token count. With input video, the count includes the minimum token charge.':
    [
      'Online rates for 480p, 720p and 1080p, charged per million reported output tokens. Input video includes a minimum token charge.',
      '在线价适用于 480p、720p、1080p，按接口返回的输出 Token 数、以百万 Token 为单位计费；输入视频包含最低 Token 计费量。',
      '480p・720p・1080pのオンライン料金です。返された出力トークン数を百万トークン単位で課金し、入力動画には最低トークン課金量があります。',
    ],
  'Exact official Model ID from live model list; 5-0-260128 explicitly also supports 5-0-lite-260128. All successful output images share flat price; input images explicitly free. Only native image counters declared by the fixed per-model profile are used. Models 5.0 lite/5.0/4.5/4.0 are marked upcoming retirement by current model list.':
    [
      'Each successfully generated image has a flat price; input images are free. Seedream 5.0 Lite, 5.0, 4.5 and 4.0 are scheduled for retirement.',
      '每张成功生成的图像按固定单价计费，输入图像免费。Seedream 5.0 Lite、5.0、4.5、4.0 已公告即将退役。',
      '生成に成功した画像ごとの固定単価で、入力画像は無料です。Seedream 5.0 Lite・5.0・4.5・4.0は提供終了予定です。',
    ],
  'Official legacy Hunyuan price page updated2026-06-26 publishes0.5/2 CNY/M tokens. This is a published legacy quote, not an availability claim: official announcement says original Hunyuan platform shutdown2026-09-30. Current TokenHub price list has no a13b row.':
    [
      'Historical Hunyuan rates: ¥0.5 input / ¥2 output per million tokens. The original platform shut down on September 30, 2026; this is not an availability claim. TokenHub has no current A13B price.',
      '历史混元价：输入 ¥0.5、输出 ¥2／百万 Token。原平台于 2026 年 9 月 30 日关闭，此报价不表示仍可用；TokenHub 暂无 A13B 现行价。',
      '旧混元の参考料金は百万トークン当たり入力¥0.5・出力¥2です。旧基盤は2026年9月30日に終了しており、利用可能性を示しません。TokenHubに現行A13B料金はありません。',
    ],
  'Separate Search-Std tool charge; standard model token charges remain additive. Candidate applies only existing search_std native key, not other search engines.':
    [
      'Search-Std is charged separately in addition to model tokens; this tariff does not cover other search engines.',
      'Search-Std 单独收费，模型 Token 费用另计；此价目不含其他搜索引擎。',
      'Search-Stdはモデルのトークン料金に加えて別途課金されます。他の検索エンジンは対象外です。',
    ],
  'Both input and generated video seconds are billed at the output resolution rate. Failed tasks are free.':
    [
      'Input and generated video seconds are both billed at the output resolution rate. Failed tasks are free.',
      '输入和生成视频均按秒计费，采用输出分辨率对应费率；任务失败不收费。',
      '入力・生成動画の両方の秒数を出力解像度の単価で課金します。失敗したタスクは無料です。',
    ],
  'Only successfully generated video seconds are billed at the output resolution rate.': [
    'Only successfully generated video seconds are billed, at the output resolution rate.',
    '仅对成功生成的视频秒数计费，采用输出分辨率对应费率。',
    '生成に成功した動画の秒数のみ、出力解像度の単価で課金します。',
  ],
  'Both input and generated video seconds are billed at the output resolution rate. Failed tasks are free. Input video billing is capped at five seconds. Alibaba New API plugin has no route for this reference-to-video model.':
    [
      'Input and generated video seconds are both billed at the output resolution rate. Failed tasks are free. Input video is billed for at most 5 seconds. Reference-to-video billing integration is not yet supported.',
      '输入和生成视频均按秒计费，采用输出分辨率对应费率；任务失败不收费。 输入视频最多计费 5 秒，参考视频生成的计费适配尚不支持。',
      '入力・生成動画の両方の秒数を出力解像度の単価で課金します。失敗したタスクは無料です。 入力動画の課金は最大5秒です。参照動画からの生成には課金連携が未対応です。',
    ],
  'Both input and generated video seconds are billed at the output resolution rate. Failed tasks are free. Alibaba New API plugin has no route for this video editing model.':
    [
      'Input and generated video seconds are both billed at the output resolution rate. Failed tasks are free. Video editing billing integration is not yet supported.',
      '输入和生成视频均按秒计费，采用输出分辨率对应费率；任务失败不收费。 视频编辑的计费适配尚不支持。',
      '入力・生成動画の両方の秒数を出力解像度の単価で課金します。失敗したタスクは無料です。 動画編集の課金連携には未対応です。',
    ],
  'The original price is per successfully generated image. Any introductory quota is account-specific.':
    [
      'Charged per successfully generated image. Introductory quotas depend on the account.',
      '按成功生成的图像张数计费；新用户赠送额度因账户而异。',
      '生成に成功した画像枚数で課金します。導入時の無料枠はアカウントによって異なります。',
    ],
  'Both input and generated video seconds are billed at the output resolution rate. Failed tasks are free. Singapore International source tariff in USD.':
    [
      'Input and generated video seconds are both billed at the output resolution rate. Failed tasks are free. Singapore international tariff in USD.',
      '输入和生成视频均按秒计费，采用输出分辨率对应费率；任务失败不收费。 新加坡国际站美元价目。',
      '入力・生成動画の両方の秒数を出力解像度の単価で課金します。失敗したタスクは無料です。 シンガポール国際向けの米ドル料金です。',
    ],
  'Only successfully generated video seconds are billed at the output resolution rate. Singapore International source tariff in USD.':
    [
      'Only successfully generated video seconds are billed, at the output resolution rate. Singapore international tariff in USD.',
      '仅对成功生成的视频秒数计费，采用输出分辨率对应费率。 新加坡国际站美元价目。',
      '生成に成功した動画の秒数のみ、出力解像度の単価で課金します。 シンガポール国際向けの米ドル料金です。',
    ],
  'Both input and generated video seconds are billed at the output resolution rate. Failed tasks are free. Input video billing is capped at five seconds. Alibaba New API plugin has no route for this reference-to-video model. Singapore International source tariff in USD.':
    [
      'Input and generated video seconds are both billed at the output resolution rate. Failed tasks are free. Input video is billed for at most 5 seconds. Reference-to-video billing integration is not yet supported. Singapore international tariff in USD.',
      '输入和生成视频均按秒计费，采用输出分辨率对应费率；任务失败不收费。 输入视频最多计费 5 秒，参考视频生成的计费适配尚不支持。 新加坡国际站美元价目。',
      '入力・生成動画の両方の秒数を出力解像度の単価で課金します。失敗したタスクは無料です。 入力動画の課金は最大5秒です。参照動画からの生成には課金連携が未対応です。 シンガポール国際向けの米ドル料金です。',
    ],
  'Both input and generated video seconds are billed at the output resolution rate. Failed tasks are free. Alibaba New API plugin has no route for this video editing model. Singapore International source tariff in USD.':
    [
      'Input and generated video seconds are both billed at the output resolution rate. Failed tasks are free. Video editing billing integration is not yet supported. Singapore international tariff in USD.',
      '输入和生成视频均按秒计费，采用输出分辨率对应费率；任务失败不收费。 视频编辑的计费适配尚不支持。 新加坡国际站美元价目。',
      '入力・生成動画の両方の秒数を出力解像度の単価で課金します。失敗したタスクは無料です。 動画編集の課金連携には未対応です。 シンガポール国際向けの米ドル料金です。',
    ],
  'The original price is per successfully generated image. Any introductory quota is account-specific. Singapore International source tariff in USD.':
    [
      'Charged per successfully generated image. Introductory quotas depend on the account. Singapore international tariff in USD.',
      '按成功生成的图像张数计费；新用户赠送额度因账户而异。 新加坡国际站美元价目。',
      '生成に成功した画像枚数で課金します。導入時の無料枠はアカウントによって異なります。 シンガポール国際向けの米ドル料金です。',
    ],
};

export function priceDescription(description: string, locale: Locale) {
  const summary = descriptions[description];
  return summary ? localizePrice(summary, locale) : description;
}
