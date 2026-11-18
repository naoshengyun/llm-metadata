# 全量模型与来源清单

输入上游提交 24d3f35cc82f21bdc2a049888c71af5fb4f4d7b4。逐条数据及输入哈希见 [inventory.json](inventory.json)。供应商标识包含地区和套餐，记录数不能当作厂商家数或可同步价格键数。

| 供应商端点 | 上游记录 | 增补后记录 | 自有已选报价 | 当前缺原始 CNY | 来源研究 |
| --- | ---: | ---: | ---: | ---: | --- |
| alibaba | 50 | 50 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| alibaba-cn | 54 | 54 | 3 | 53 | [domestic.md](domestic.md) |
| alibaba-coding-plan | 6 | 6 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| alibaba-coding-plan-cn | 6 | 6 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| alibaba-token-plan | 14 | 14 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| alibaba-token-plan-cn | 14 | 14 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| anthropic | 18 | 18 | 17 | 0 | [foreign-a.md](foreign-a.md) |
| arcee | 1 | 1 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| bailing | 5 | 5 | 0 | 3 | [domestic.md](domestic.md) |
| cohere | 17 | 17 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| deepseek | 4 | 4 | 0 | 0 | [domestic.md](domestic.md) |
| google | 38 | 38 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| inception | 4 | 4 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| longcat | 2 | 2 | 0 | 2 | [domestic.md](domestic.md) |
| meta | 7 | 7 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| minimax | 18 | 18 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| minimax-cn | 19 | 19 | 0 | 1 | [domestic.md](domestic.md) |
| minimax-cn-coding-plan | 9 | 9 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| minimax-coding-plan | 9 | 9 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| mistral | 36 | 36 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| moonshotai | 6 | 6 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| moonshotai-cn | 6 | 6 | 5 | 2 | [domestic.md](domestic.md) |
| morph | 12 | 12 | 0 | 0 | [foreign-a.md](foreign-a.md) |
| nova | 2 | 2 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| openai | 53 | 55 | 11 | 0 | [foreign-b.md](foreign-b.md) |
| perplexity | 4 | 4 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| poolside | 3 | 3 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| sakana | 4 | 4 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| sarvam | 2 | 2 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| sensenova | 1 | 1 | 0 | 1 | [domestic.md](domestic.md) |
| stepfun | 7 | 7 | 0 | 1 | [domestic.md](domestic.md) |
| stepfun-ai | 7 | 7 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| stepfun-ai-step-plan | 4 | 4 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| stepfun-step-plan | 5 | 5 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| tencent-coding-plan | 5 | 5 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| tencent-token-plan | 15 | 15 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| tencent-tokenhub | 4 | 4 | 0 | 4 | [domestic.md](domestic.md) |
| thinkingmachines | 38 | 38 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| upstage | 5 | 5 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| volcengine | 12 | 22 | 13 | 0 | [domestic.md](domestic.md) |
| volcengine-coding-plan | 6 | 6 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| xai | 13 | 13 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| xiaomi | 6 | 6 | 0 | 6 | [domestic.md](domestic.md) |
| xiaomi-token-plan-ams | 7 | 7 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| xiaomi-token-plan-cn | 7 | 7 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| xiaomi-token-plan-sgp | 7 | 7 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| zai | 18 | 18 | 0 | 0 | [foreign-b.md](foreign-b.md) |
| zai-coding-plan | 7 | 7 | 0 | 0 | [subscriptions.md](subscriptions.md) |
| zhipuai | 17 | 17 | 3 | 3 | [domestic.md](domestic.md) |
| zhipuai-coding-plan | 4 | 4 | 0 | 0 | [subscriptions.md](subscriptions.md) |

## 数量核对

| 项目 | 数量 |
| --- | ---: |
| upstreamProviders | 50 |
| upstreamModelRecords | 618 |
| subscriptionProviders | 16 |
| subscriptionRecords | 125 |
| nonSubscriptionProviders | 34 |
| officialAddedRecords | 11 |
| requestedAddedRecords | 1 |
| inventoryRecords | 630 |
| distinctModelNames | 446 |
| officialQuoteRecords | 62 |
| selectedModelQuotes | 43 |
| selectedTaskQuotes | 9 |
| selectedToolQuotes | 1 |

## 证据边界

官方价格页可访问、全部收费行已核实、自动解析器已实现是三个独立状态。当前矩阵用于定位官方来源，不能当作自动核价完成的证据。补价后的新选中来源继续进入同一矩阵。

历史供应商 dashscope 与上游 alibaba-cn 的对应基于已维护北京端点价目，列为显式映射提案，实施时必须验证端点一致。原始价目身份保留。

订阅记录保留在可视化目录。独立工具价 search_std 单列在 officialQuotes，不计入模型记录总数。Seedance 2.5 记录了点名增补及开放决定。
