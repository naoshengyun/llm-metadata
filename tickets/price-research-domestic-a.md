# Original CNY price research: DeepSeek, Kimi, BigModel and MiniMax

Checked 2026-11-16. Primary official sources only; no Exa, model calls, supplier requests, paid API calls, production changes, or commits. Records use canonical local supplier IDs (`moonshotai-cn`, `zhipuai`, `minimax-cn`, `deepseek`); coverage preserves each requested model spelling. Parent integration must retain separate protocol coverage rows.

## Evidence and boundaries

- [DeepSeek China price list](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/): native CNY off-peak/peak rates and holiday exclusion are explicit. Current names are `deepseek-flash` and `deepseek-v4-pro`; the page explicitly accepts legacy `deepseek-v4-flash`, while `deepseek-v4.1-flash` is absent. Holiday-aware billing cannot be flattened into weekdays alone.
- [Kimi China model pricing](https://platform.kimi.com/docs/pricing/chat), [Batch prices](https://platform.kimi.com/docs/pricing/batch), [cache semantics](https://platform.kimi.com/docs/guide/context-caching), and [exact IDs / retirement](https://platform.kimi.com/docs/models): dynamic tables vanish from web Markdown. I read public official HTML with Python urllib and extracted the embedded MDX `DocTable.rows`, including all column names. K3 lists five prices: input, output, cache hit, write5m, write1h. K2 lists three; Batch K2 write columns are dashes. Batch never inherits a highspeed row. Files extraction/storage currently free; tokens sent to a model still charged.
- [BigModel official CNY price list](https://docs.bigmodel.cn/cn/guide/start/pricing): cache storage is temporarily free, in million-token-hours; no end date or post-free rate is disclosed. Do not map storage to `cache_write`. [GLM-5.3 identity / both protocols](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.3), [Flash model code](https://docs.bigmodel.cn/cn/guide/models/vlm/glm-5.3-flash), [5.2](https://docs.bigmodel.cn/cn/guide/models/text/glm-5.2), and [cache usage](https://docs.bigmodel.cn/cn/guide/capabilities/cache) establish exact IDs and output billing for thinking tokens. Flash model-guide marketing references a limited discount without dates/rate-table detail; candidate retains published standard list, not an invented extra discount.
- [MiniMax CNY price list](https://platform.minimax.cn/docs/pricing/overview), [service-tier API](https://platform.minimax.cn/docs/api-reference/text-chat-openai), [cache billing formula](https://platform.minimax.cn/docs/api-reference/text-prompt-caching), and [retirement notice](https://platform.minimax.cn/docs/faq/models): M3 standard/priority differ, as do normal/highspeed historical IDs. Current table omits old M2 prices. The retirement notice and historical status table conflict about whether those models are already offline. Their future retirement date is 2026-11-18. The [M2.5 launch article](https://www.minimax.cn/news/minimax-m25) uses USD examples, insufficient for original CNY.

Kimi ready standard records have no context threshold; TTL charges are complete. BigModel ready records preserve free storage separately in feeDeclarations. M3 and GLM-5.1 require exact numeric threshold proof; neither 512000 nor 32000 from local overrides counts as fresh primary evidence. The repository’s tier expression uses a low-band `len<=threshold`; an official `>=T` high band requires T-1 once T is verified.

Optional separate tools observed: DeepSeek search/fetch each CNY5/1000 calls ([pricing](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)); BigModel Search-Std0.01, Search-Pro0.03, Sogou0.05, Quark0.05 CNY/call ([pricing](https://docs.bigmodel.cn/cn/guide/start/pricing)); MiniMax server web_search0.03 CNY/call ([pricing](https://platform.minimax.cn/docs/pricing/overview)). Kimi dynamic [tool price table](https://platform.kimi.com/docs/pricing/websearch) gives Basic0.01, Pro0.015, fetch0.01 CNY/call, requiring HTTP200 plus nonempty result/content; Formula web-search0.03/execution. These are separate conditional tool charges; model token rates remain additive. No unrelated media or subscription rate is folded into model cost.

## Machine-readable findings

`records` are review-ready OfficialQuote candidates with supplemental audit metadata; only explicit selection should activate a particular list. `excludedQuotes` preserves known original fees without pretending they are executable.

```json
{
  "records": [
    {
      "id": "cn-moonshot-kimi-k3.1-pro-standard",
      "provider": "moonshotai-cn",
      "model": "kimi-k3.1-pro",
      "priceList": "Kimi China standard synchronous pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/chat",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_1h"
      ],
      "cost": {
        "input": 13,
        "output": 68,
        "cache_read": 1.3,
        "cache_write": 13,
        "cache_write_1h": 26
      },
      "description": "Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. Cache-write is 5-minute TTL; cache_write_1h is 1-hour TTL. Default automatic caching uses 5m; a cache hit does not incur another write fee. No context-price tiers published.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k3.1-pro-highspeed-standard",
      "provider": "moonshotai-cn",
      "model": "kimi-k3.1-pro-highspeed",
      "priceList": "Kimi China standard synchronous pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/chat",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_1h"
      ],
      "cost": {
        "input": 26,
        "output": 136,
        "cache_read": 1.3,
        "cache_write": 26,
        "cache_write_1h": 52
      },
      "description": "Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. Cache-write is 5-minute TTL; cache_write_1h is 1-hour TTL. Default automatic caching uses 5m; a cache hit does not incur another write fee. No context-price tiers published.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k3-standard",
      "provider": "moonshotai-cn",
      "model": "kimi-k3",
      "priceList": "Kimi China standard synchronous pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/chat",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_1h"
      ],
      "cost": {
        "input": 20,
        "output": 100,
        "cache_read": 2,
        "cache_write": 20,
        "cache_write_1h": 40
      },
      "description": "Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. Cache-write is 5-minute TTL; cache_write_1h is 1-hour TTL. Default automatic caching uses 5m; a cache hit does not incur another write fee. No context-price tiers published.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k2.7-code-standard",
      "provider": "moonshotai-cn",
      "model": "kimi-k2.7-code",
      "priceList": "Kimi China standard synchronous pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/chat",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 6.5,
        "output": 27,
        "cache_read": 1.3
      },
      "description": "Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. K2 models remain available only to existing users; official pages say no new users from October 31 / before November 1, 2026, with full retirement planned by end December. K2 has no separately published cache-write price in this table.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k2.7-code-highspeed-standard",
      "provider": "moonshotai-cn",
      "model": "kimi-k2.7-code-highspeed",
      "priceList": "Kimi China standard synchronous pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/chat",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 13,
        "output": 54,
        "cache_read": 2.6
      },
      "description": "Standard synchronous pay-as-you-go. All figures are original published CNY, per million tokens. K2 models remain available only to existing users; official pages say no new users from October 31 / before November 1, 2026, with full retirement planned by end December. K2 has no separately published cache-write price in this table.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k3.1-pro-batch",
      "provider": "moonshotai-cn",
      "model": "kimi-k3.1-pro",
      "priceList": "Kimi China Batch API",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/batch",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_1h"
      ],
      "cost": {
        "input": 7.8,
        "output": 40.8,
        "cache_read": 0.78,
        "cache_write": 7.8,
        "cache_write_1h": 15.6
      },
      "description": "Separate asynchronous Batch API price list; never select for synchronous requests. Cache hit best-effort. For K3, separate 5m / 1h writes apply. For K2.7-code, both write columns show dash (not a declared zero price); existing-user retirement condition remains.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k3-batch",
      "provider": "moonshotai-cn",
      "model": "kimi-k3",
      "priceList": "Kimi China Batch API",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/batch",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_1h"
      ],
      "cost": {
        "input": 12,
        "output": 60,
        "cache_read": 1.2,
        "cache_write": 12,
        "cache_write_1h": 24
      },
      "description": "Separate asynchronous Batch API price list; never select for synchronous requests. Cache hit best-effort. For K3, separate 5m / 1h writes apply. For K2.7-code, both write columns show dash (not a declared zero price); existing-user retirement condition remains.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-moonshot-kimi-k2.7-code-batch",
      "provider": "moonshotai-cn",
      "model": "kimi-k2.7-code",
      "priceList": "Kimi China Batch API",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://platform.kimi.com/docs/pricing/batch",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 3.9,
        "output": 16.2,
        "cache_read": 0.78
      },
      "description": "Separate asynchronous Batch API price list; never select for synchronous requests. Cache hit best-effort. For K3, separate 5m / 1h writes apply. For K2.7-code, both write columns show dash (not a declared zero price); existing-user retirement condition remains.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens"
    },
    {
      "id": "cn-zhipu-glm-5.3-standard",
      "provider": "zhipuai",
      "model": "glm-5.3",
      "priceList": "BigModel China standard API pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 8,
        "output": 28,
        "cache_read": 2
      },
      "description": "Published standard API list, excluding GLM Coding Plan and resource packs. Reasoning tokens count as output; cache storage is temporarily free, with no post-promotion price or end date published. No cache-write token fee is invented. For GLM-5.3-Flash, model-guide marketing mentions a limited discount but the current pricing table publishes 0.8/2.8/0.23; this record preserves the actual price-list figures and does not infer an extra discount.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens",
      "feeDeclarations": [
        {
          "key": "cache_storage",
          "price": 0,
          "currency": "CNY",
          "unit": "million-token-hour",
          "conditions": "Temporarily free. Pricing page explicitly withholds post-free-period standard price. No expiry date published. This is storage, not token cache_write.",
          "source": {
            "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
            "checkedAt": "2026-11-16"
          }
        }
      ]
    },
    {
      "id": "cn-zhipu-glm-5.3-flash-standard",
      "provider": "zhipuai",
      "model": "glm-5.3-flash",
      "priceList": "BigModel China standard API pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 0.8,
        "output": 2.8,
        "cache_read": 0.23
      },
      "description": "Published standard API list, excluding GLM Coding Plan and resource packs. Reasoning tokens count as output; cache storage is temporarily free, with no post-promotion price or end date published. No cache-write token fee is invented. For GLM-5.3-Flash, model-guide marketing mentions a limited discount but the current pricing table publishes 0.8/2.8/0.23; this record preserves the actual price-list figures and does not infer an extra discount.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens",
      "feeDeclarations": [
        {
          "key": "cache_storage",
          "price": 0,
          "currency": "CNY",
          "unit": "million-token-hour",
          "conditions": "Temporarily free. Pricing page explicitly withholds post-free-period standard price. No expiry date published. This is storage, not token cache_write.",
          "source": {
            "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
            "checkedAt": "2026-11-16"
          }
        }
      ]
    },
    {
      "id": "cn-zhipu-glm-5.2-standard",
      "provider": "zhipuai",
      "model": "glm-5.2",
      "priceList": "BigModel China standard API pay-as-you-go",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 8,
        "output": 28,
        "cache_read": 2
      },
      "description": "Published standard API list, excluding GLM Coding Plan and resource packs. Reasoning tokens count as output; cache storage is temporarily free, with no post-promotion price or end date published. No cache-write token fee is invented. For GLM-5.3-Flash, model-guide marketing mentions a limited discount but the current pricing table publishes 0.8/2.8/0.23; this record preserves the actual price-list figures and does not infer an extra discount.",
      "officialRegion": "China mainland domestic API",
      "unit": "CNY per 1,000,000 tokens",
      "feeDeclarations": [
        {
          "key": "cache_storage",
          "price": 0,
          "currency": "CNY",
          "unit": "million-token-hour",
          "conditions": "Temporarily free. Pricing page explicitly withholds post-free-period standard price. No expiry date published. This is storage, not token cache_write.",
          "source": {
            "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
            "checkedAt": "2026-11-16"
          }
        }
      ]
    }
  ],
  "coverage": [
    {
      "model": "kimi-k3.1-pro",
      "status": "ready",
      "reason": "Exact official ID and complete standard domestic original CNY token price list. Batch is a separate list only when explicitly published.",
      "quoteIds": [
        "cn-moonshot-kimi-k3.1-pro-standard",
        "cn-moonshot-kimi-k3.1-pro-batch"
      ],
      "sourceUrls": [
        "https://platform.kimi.com/docs/pricing/chat",
        "https://platform.kimi.com/docs/pricing/batch",
        "https://platform.kimi.com/docs/models",
        "https://platform.kimi.com/docs/guide/context-caching"
      ]
    },
    {
      "model": "kimi-k3.1-pro-highspeed",
      "status": "ready",
      "reason": "Exact official ID and complete standard domestic original CNY token price list. Batch is a separate list only when explicitly published.",
      "quoteIds": [
        "cn-moonshot-kimi-k3.1-pro-highspeed-standard"
      ],
      "sourceUrls": [
        "https://platform.kimi.com/docs/pricing/chat",
        "https://platform.kimi.com/docs/pricing/batch",
        "https://platform.kimi.com/docs/models",
        "https://platform.kimi.com/docs/guide/context-caching"
      ]
    },
    {
      "model": "kimi-k3",
      "status": "ready",
      "reason": "Exact official ID and complete standard domestic original CNY token price list. Batch is a separate list only when explicitly published.",
      "quoteIds": [
        "cn-moonshot-kimi-k3-standard",
        "cn-moonshot-kimi-k3-batch"
      ],
      "sourceUrls": [
        "https://platform.kimi.com/docs/pricing/chat",
        "https://platform.kimi.com/docs/pricing/batch",
        "https://platform.kimi.com/docs/models",
        "https://platform.kimi.com/docs/guide/context-caching"
      ]
    },
    {
      "model": "kimi-k2.7-code",
      "status": "ready",
      "reason": "Exact official ID and complete standard domestic original CNY token price list. Batch is a separate list only when explicitly published.",
      "quoteIds": [
        "cn-moonshot-kimi-k2.7-code-standard",
        "cn-moonshot-kimi-k2.7-code-batch"
      ],
      "sourceUrls": [
        "https://platform.kimi.com/docs/pricing/chat",
        "https://platform.kimi.com/docs/pricing/batch",
        "https://platform.kimi.com/docs/models",
        "https://platform.kimi.com/docs/guide/context-caching"
      ]
    },
    {
      "model": "kimi-k2.7-code-highspeed",
      "status": "ready",
      "reason": "Exact official ID and complete standard domestic original CNY token price list. Batch is a separate list only when explicitly published.",
      "quoteIds": [
        "cn-moonshot-kimi-k2.7-code-highspeed-standard"
      ],
      "sourceUrls": [
        "https://platform.kimi.com/docs/pricing/chat",
        "https://platform.kimi.com/docs/pricing/batch",
        "https://platform.kimi.com/docs/models",
        "https://platform.kimi.com/docs/guide/context-caching"
      ]
    },
    {
      "model": "glm-5.3",
      "status": "ready",
      "reason": "Exact official model identity plus complete current CNY standard token fees; separately preserve temporarily-free hourly cache-storage declaration.",
      "quoteIds": [
        "cn-zhipu-glm-5.3-standard"
      ],
      "sourceUrls": [
        "https://docs.bigmodel.cn/cn/guide/start/pricing"
      ]
    },
    {
      "model": "glm-5.3-flash",
      "status": "ready",
      "reason": "Exact official model identity plus complete current CNY standard token fees; separately preserve temporarily-free hourly cache-storage declaration.",
      "quoteIds": [
        "cn-zhipu-glm-5.3-flash-standard"
      ],
      "sourceUrls": [
        "https://docs.bigmodel.cn/cn/guide/start/pricing"
      ]
    },
    {
      "model": "glm-5.2",
      "status": "ready",
      "reason": "Exact official model identity plus complete current CNY standard token fees; separately preserve temporarily-free hourly cache-storage declaration.",
      "quoteIds": [
        "cn-zhipu-glm-5.2-standard"
      ],
      "sourceUrls": [
        "https://docs.bigmodel.cn/cn/guide/start/pricing"
      ]
    },
    {
      "model": "glm-5.1",
      "status": "incomplete",
      "reason": "Official price list gives [0,32K) versus >=32K input-length bands, but inspected live sources do not define K as an exact integer token count. Local override uses 32000, which is not fresh official proof. Preserve original bands; do not silently assume 32000 or 32768. Once exact boundary T is sourced, existing len<= adapter needs tier size T-1 for >=T.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "https://docs.bigmodel.cn/cn/guide/start/model-overview"
      ]
    },
    {
      "model": "MiniMax-M3",
      "status": "incomplete",
      "reason": "Original CNY standard and priority fees fully found, including >512k input band and permanent 50% reduction; live pricing source does not expand 512k into an exact integer token threshold. Local 512000 is not fresh proof. Keep both official service tiers and raw bands separately until boundary verified.",
      "quoteIds": [],
      "sourceUrls": [
        "https://platform.minimax.cn/docs/pricing/overview",
        "https://platform.minimax.cn/docs/api-reference/text-chat-openai",
        "https://platform.minimax.cn/docs/api-reference/text-prompt-caching"
      ]
    },
    {
      "model": "MiniMax-M2.7",
      "status": "missing-source",
      "reason": "Exact historical ID confirmed, but live China price table no longer publishes its original CNY input/output/cache rates. Local overrides are not re-used as fresh proof. Retirement notice says no new API users from October 19, 2026 and service ends November 18, while historical table already labels offline. Do not replace with M3/M3.1 or a normal/highspeed sibling.",
      "quoteIds": [],
      "sourceUrls": [
        "https://platform.minimax.cn/docs/pricing/overview",
        "https://platform.minimax.cn/docs/faq/models",
        "https://www.minimax.cn/news/minimax-m25",
        "https://www.minimax.cn/news/minimax-m27-zh"
      ]
    },
    {
      "model": "MiniMax-M2.7-highspeed",
      "status": "missing-source",
      "reason": "Exact historical ID confirmed, but live China price table no longer publishes its original CNY input/output/cache rates. Local overrides are not re-used as fresh proof. Retirement notice says no new API users from October 19, 2026 and service ends November 18, while historical table already labels offline. Do not replace with M3/M3.1 or a normal/highspeed sibling.",
      "quoteIds": [],
      "sourceUrls": [
        "https://platform.minimax.cn/docs/pricing/overview",
        "https://platform.minimax.cn/docs/faq/models",
        "https://www.minimax.cn/news/minimax-m25",
        "https://www.minimax.cn/news/minimax-m27-zh"
      ]
    },
    {
      "model": "MiniMax-M2.5",
      "status": "missing-source",
      "reason": "Exact historical ID confirmed, but live China price table no longer publishes its original CNY input/output/cache rates. Local overrides are not re-used as fresh proof. Retirement notice says no new API users from October 19, 2026 and service ends November 18, while historical table already labels offline. Do not replace with M3/M3.1 or a normal/highspeed sibling.",
      "quoteIds": [],
      "sourceUrls": [
        "https://platform.minimax.cn/docs/pricing/overview",
        "https://platform.minimax.cn/docs/faq/models",
        "https://www.minimax.cn/news/minimax-m25",
        "https://www.minimax.cn/news/minimax-m27-zh"
      ]
    },
    {
      "model": "MiniMax-M2.5-highspeed",
      "status": "missing-source",
      "reason": "Exact historical ID confirmed, but live China price table no longer publishes its original CNY input/output/cache rates. Local overrides are not re-used as fresh proof. Retirement notice says no new API users from October 19, 2026 and service ends November 18, while historical table already labels offline. Do not replace with M3/M3.1 or a normal/highspeed sibling.",
      "quoteIds": [],
      "sourceUrls": [
        "https://platform.minimax.cn/docs/pricing/overview",
        "https://platform.minimax.cn/docs/faq/models",
        "https://www.minimax.cn/news/minimax-m25",
        "https://www.minimax.cn/news/minimax-m27-zh"
      ]
    },
    {
      "model": "deepseek-v4.1-flash",
      "status": "missing-source",
      "reason": "Exact requested API ID is not in current official model/price list. Official current Flash API ID is deepseek-flash. Do not automatically substitute it.",
      "quoteIds": [],
      "sourceUrls": [
        "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/"
      ]
    },
    {
      "model": "deepseek-v4-pro",
      "status": "unsupported-shape",
      "reason": "Official original CNY prices include off-peak and peak windows, but Chinese statutory holidays are explicitly excluded from peak. Current schedule supports weekday/time only and cannot encode holiday exceptions. Preserve full rule and raw rates. Legacy deepseek-v4-flash is expressly still callable and billed at Flash prices; retain that requested ID.",
      "quoteIds": [],
      "sourceUrls": [
        "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/"
      ]
    },
    {
      "model": "deepseek-v4-flash",
      "status": "unsupported-shape",
      "reason": "Official original CNY prices include off-peak and peak windows, but Chinese statutory holidays are explicitly excluded from peak. Current schedule supports weekday/time only and cannot encode holiday exceptions. Preserve full rule and raw rates. Legacy deepseek-v4-flash is expressly still callable and billed at Flash prices; retain that requested ID.",
      "quoteIds": [],
      "sourceUrls": [
        "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/"
      ]
    }
  ],
  "excludedQuotes": [
    {
      "officialModel": "deepseek-v4-pro",
      "provider": "deepseek",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "unsupported-shape",
      "source": {
        "url": "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/",
        "checkedAt": "2026-11-16"
      },
      "rawFees": [
        {
          "condition": "off-peak",
          "input": 4.5,
          "output": 13.5,
          "cache_read": 0.15
        },
        {
          "condition": "peak",
          "input": 9,
          "output": 27,
          "cache_read": 0.3
        }
      ],
      "conditions": {
        "timezone": "Asia/Shanghai",
        "peakWeekdays": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "peakWindows": [
          "09:00-12:00",
          "14:00-18:00"
        ],
        "excludeFromPeak": "All Chinese statutory holidays; weekends and all other times are off-peak"
      },
      "reason": "Cannot represent holiday exclusions in existing CostSchedule; using weekdays alone overcharges holidays. Flash ID legacy routing is explicit official evidence; no v4.1-flash alias assumed."
    },
    {
      "officialModel": "deepseek-v4-flash",
      "provider": "deepseek",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "unsupported-shape",
      "source": {
        "url": "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/",
        "checkedAt": "2026-11-16"
      },
      "rawFees": [
        {
          "condition": "off-peak",
          "input": 1,
          "output": 4,
          "cache_read": 0.02
        },
        {
          "condition": "peak",
          "input": 2,
          "output": 8,
          "cache_read": 0.04
        }
      ],
      "conditions": {
        "timezone": "Asia/Shanghai",
        "peakWeekdays": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "peakWindows": [
          "09:00-12:00",
          "14:00-18:00"
        ],
        "excludeFromPeak": "All Chinese statutory holidays; weekends and all other times are off-peak"
      },
      "reason": "Cannot represent holiday exclusions in existing CostSchedule; using weekdays alone overcharges holidays. Flash ID legacy routing is explicit official evidence; no v4.1-flash alias assumed."
    },
    {
      "officialModel": "glm-5.1",
      "provider": "zhipuai",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens; storage per million-token-hour",
      "status": "incomplete",
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "rawFees": [
        {
          "condition": "input length [0,32K)",
          "input": 6,
          "output": 24,
          "cache_read": 1.3,
          "cache_storage": 0
        },
        {
          "condition": "input length >=32K",
          "input": 8,
          "output": 28,
          "cache_read": 2,
          "cache_storage": 0
        }
      ],
      "reason": "Exact expansion of K not verified; cache_storage explicitly temporarily free, never cache_write0."
    },
    {
      "officialModel": "MiniMax-M3",
      "provider": "minimax-cn",
      "officialServiceTier": "standard",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "incomplete",
      "source": {
        "url": "https://platform.minimax.cn/docs/pricing/overview",
        "checkedAt": "2026-11-16"
      },
      "rawFees": [
        {
          "condition": "input tokens <=512k",
          "input": 2.1,
          "output": 8.4,
          "cache_read": 0.42
        },
        {
          "condition": "input tokens >512k",
          "input": 4.2,
          "output": 16.8,
          "cache_read": 0.84
        }
      ],
      "conditions": "Published permanent 50%-off rates, not struck-through original list. service_tier omitted defaults standard; explicit priority costs 1.5x standard. New uncached input is charged input; cache reads are separate; no separate cache write/storage fee published. Automatic prefix cache applies from 512 input tokens.",
      "reason": "512k not expanded to an exact integer in inspected source; do not take local 512000 as primary evidence."
    },
    {
      "officialModel": "MiniMax-M3",
      "provider": "minimax-cn",
      "officialServiceTier": "priority",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "incomplete",
      "source": {
        "url": "https://platform.minimax.cn/docs/pricing/overview",
        "checkedAt": "2026-11-16"
      },
      "rawFees": [
        {
          "condition": "input tokens <=512k",
          "input": 3.15,
          "output": 12.6,
          "cache_read": 0.63
        },
        {
          "condition": "input tokens >512k",
          "input": 6.3,
          "output": 25.2,
          "cache_read": 1.26
        }
      ],
      "conditions": "Published permanent 50%-off rates, not struck-through original list. service_tier omitted defaults standard; explicit priority costs 1.5x standard. New uncached input is charged input; cache reads are separate; no separate cache write/storage fee published. Automatic prefix cache applies from 512 input tokens.",
      "reason": "512k not expanded to an exact integer in inspected source; do not take local 512000 as primary evidence."
    },
    {
      "officialModel": "MiniMax-M2.7",
      "provider": "minimax-cn",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "missing-source",
      "rawFees": null,
      "source": {
        "url": "https://platform.minimax.cn/docs/pricing/overview",
        "checkedAt": "2026-11-16"
      },
      "reason": "Fresh official original CNY fee table absent. Historical launch news for M2.5 gives USD examples rather than full original CNY fees; cannot use USD*7 or copy ordinary model price onto highspeed."
    },
    {
      "officialModel": "MiniMax-M2.7-highspeed",
      "provider": "minimax-cn",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "missing-source",
      "rawFees": null,
      "source": {
        "url": "https://platform.minimax.cn/docs/pricing/overview",
        "checkedAt": "2026-11-16"
      },
      "reason": "Fresh official original CNY fee table absent. Historical launch news for M2.5 gives USD examples rather than full original CNY fees; cannot use USD*7 or copy ordinary model price onto highspeed."
    },
    {
      "officialModel": "MiniMax-M2.5",
      "provider": "minimax-cn",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "missing-source",
      "rawFees": null,
      "source": {
        "url": "https://platform.minimax.cn/docs/pricing/overview",
        "checkedAt": "2026-11-16"
      },
      "reason": "Fresh official original CNY fee table absent. Historical launch news for M2.5 gives USD examples rather than full original CNY fees; cannot use USD*7 or copy ordinary model price onto highspeed."
    },
    {
      "officialModel": "MiniMax-M2.5-highspeed",
      "provider": "minimax-cn",
      "currency": "CNY",
      "unit": "per 1,000,000 tokens",
      "status": "missing-source",
      "rawFees": null,
      "source": {
        "url": "https://platform.minimax.cn/docs/pricing/overview",
        "checkedAt": "2026-11-16"
      },
      "reason": "Fresh official original CNY fee table absent. Historical launch news for M2.5 gives USD examples rather than full original CNY fees; cannot use USD*7 or copy ordinary model price onto highspeed."
    }
  ]
}
```
