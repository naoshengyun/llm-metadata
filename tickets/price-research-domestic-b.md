# Official CNY research: domestic group B

Checked 2026-11-16 using live first-party public documentation only. No supplier API, production request, Exa search, or configuration mutation. This file covers every DashScope, DashScope-Anthropic, Qianfan, Volcengine, Hunyuan and Seedance-video ID in `data/cny/coverage-reference.json`, plus exact native Doubao task IDs needed to assess fixed rc50 compatibility.

`records` contains complete **scoped** token/task fee lists. Scope (region, inference service and cache mode) is part of `priceList`; it is not a new provider or protocol. Optional tools are retained separately and must be matched to a native meter before enabling their rate. `feeDeclarations` is integration evidence metadata, not an extension requested for the core interface. `coverage` intentionally refuses to equate a display-family name or shorthand with an accepted API Model ID. A valid exact-ID candidate does not authorize selecting it under an unproven alias.

Sources and material interpretation:

- [Alibaba original prices](https://help.aliyun.com/zh/model-studio/model-pricing): Beijing prices, K=1000, all request tokens use input-length tier, original Plus prices retained before temporary20% discount. [Cache rules](https://help.aliyun.com/zh/model-studio/context-cache): Qwen3.7 explicit read10% and creation125%; implicit read20% with no extra storage. Qwen3.8-Max/Flash are explicitly exceptions and direct rates require console. [Routing-specific prices](https://help.aliyun.com/zh/model-studio/model-routing) do publish cached-input1.5/0.1 respectively, but this is a different access route, so these numbers are evidence-only. [Anthropic API](https://help.aliyun.com/zh/model-studio/anthropic-api-messages) confirms exact model IDs.
- [Baidu price table](https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya), updated2026-11-11, and [model list](https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j), updated2026-11-11, jointly prove `ernie-5.1`. Source denomination is CNY/1000 tokens; scaling to ModelCost million-token units is exact. ERNIE5.0 requested IDs are absent.
- [Ark original price table](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh), [model list](https://docs.volcengine.com/docs/ark/model-list?lang=zh), and [cache documentation](https://docs.volcengine.com/docs/ark/context-cache?lang=zh): implicit storage is expressly uncharged; explicit caching adds0.017 CNY/M-token/hour with natural-hour rounding. Audio-cache-hit is a distinct rate in Lite/Mini. The old numeric pricing URL redirects to this current table; local overrides are not evidence. [Seed1.8 dedicated page](https://docs.volcengine.com/docs/ark/bytedance-seed-1-8?lang=zh) retains joint input/output tiers and raw token-hour fees. [Retirement migration](https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh), updated2026-09-21, identifies multiple legacy IDs; successor prices cannot replace them.
- Video unit is **million billable video tokens**, not a second or clip. Use official returned `usage.completion_tokens`; this includes billable minimum handling when video is supplied. Width/height/frame-rate/duration formula and per-second examples are estimates, not primary rates. Seedance2.5 4K is officially priced but not in fixed rc50 profile. Exact Seedance2.0/fast/mini IDs are in both live official model list and native schema. Short `seedance-*` coverage names lack this proof.
- [Legacy Hunyuan prices](https://cloud.tencent.com/document/product/1729/97731), updated2026-06-26, still publish a13b0.5/2. [Official retirement](https://cloud.tencent.com/document/product/1729/131925), updated2026-05-20, specifies five requested IDs shut2026-06-22, original platform shut2026-09-30. [Current TokenHub prices](https://cloud.tencent.com/document/product/1823/130055), updated2026-11-16, have none of these coverage IDs. The a13b record is **legacy published pricing only** and must not imply live availability.

Verified Qwen/Ark thresholds use decimal32000/128000/256000; Baidu ERNIE5.1 numeric threshold is unresolved and has been withdrawn from ready candidates. ModelCost tiers mean `input > size`; thus a source `(32k,128k]` transition is size32000, not32768. No mixed currency or FX reconstruction occurs. Native schema is unchanged. Every failed or unprovable price remains outside `records`.

```json
{
  "checkedAt": "2026-11-16",
  "records": [
    {
      "id": "dashscope--qwen3.7-max--cn-beijing-online-original-implicit",
      "provider": "dashscope",
      "model": "qwen3.7-max",
      "priceList": "cn-beijing-online-original-implicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 12,
        "output": 36,
        "cache_read": 2.4
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope--qwen3.7-max--cn-beijing-online-original-explicit",
      "provider": "dashscope",
      "model": "qwen3.7-max",
      "priceList": "cn-beijing-online-original-explicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write"
      ],
      "cost": {
        "input": 12,
        "output": 36,
        "cache_read": 1.2,
        "cache_write": 15.0
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "cache_write",
          "status": "charged",
          "note": "5-minute explicit cache creation at 125% standard input.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope-anthropic--qwen3.7-max--cn-beijing-online-original-implicit",
      "provider": "dashscope-anthropic",
      "model": "qwen3.7-max",
      "priceList": "cn-beijing-online-original-implicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 12,
        "output": 36,
        "cache_read": 2.4
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope-anthropic--qwen3.7-max--cn-beijing-online-original-explicit",
      "provider": "dashscope-anthropic",
      "model": "qwen3.7-max",
      "priceList": "cn-beijing-online-original-explicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write"
      ],
      "cost": {
        "input": 12,
        "output": 36,
        "cache_read": 1.2,
        "cache_write": 15.0
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "cache_write",
          "status": "charged",
          "note": "5-minute explicit cache creation at 125% standard input.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope--qwen3.7-plus--cn-beijing-online-original-implicit",
      "provider": "dashscope",
      "model": "qwen3.7-plus",
      "priceList": "cn-beijing-online-original-implicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read"
      ],
      "cost": {
        "input": 2,
        "output": 8,
        "cache_read": 0.4,
        "tiers": [
          {
            "tier": {
              "size": 256000
            },
            "input": 6,
            "output": 24,
            "cache_read": 1.2
          }
        ]
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope--qwen3.7-plus--cn-beijing-online-original-explicit",
      "provider": "dashscope",
      "model": "qwen3.7-plus",
      "priceList": "cn-beijing-online-original-explicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write"
      ],
      "cost": {
        "input": 2,
        "output": 8,
        "cache_read": 0.2,
        "cache_write": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 256000
            },
            "input": 6,
            "output": 24,
            "cache_read": 0.6,
            "cache_write": 7.5
          }
        ]
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "cache_write",
          "status": "charged",
          "note": "5-minute explicit cache creation at 125% standard input.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope--qwen3.7-flash--cn-beijing-online-original-implicit",
      "provider": "dashscope",
      "model": "qwen3.7-flash",
      "priceList": "cn-beijing-online-original-implicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.1.input",
        "tiers.1.output",
        "tiers.1.cache_read"
      ],
      "cost": {
        "input": 0.2,
        "output": 0.8,
        "cache_read": 0.04,
        "tiers": [
          {
            "tier": {
              "size": 32000
            },
            "input": 0.6,
            "output": 2.4,
            "cache_read": 0.12
          },
          {
            "tier": {
              "size": 256000
            },
            "input": 1.2,
            "output": 4.8,
            "cache_read": 0.24
          }
        ]
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "dashscope--qwen3.7-flash--cn-beijing-online-original-explicit",
      "provider": "dashscope",
      "model": "qwen3.7-flash",
      "priceList": "cn-beijing-online-original-explicit",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.1.input",
        "tiers.1.output",
        "tiers.1.cache_read",
        "tiers.1.cache_write"
      ],
      "cost": {
        "input": 0.2,
        "output": 0.8,
        "cache_read": 0.02,
        "cache_write": 0.25,
        "tiers": [
          {
            "tier": {
              "size": 32000
            },
            "input": 0.6,
            "output": 2.4,
            "cache_read": 0.06,
            "cache_write": 0.75
          },
          {
            "tier": {
              "size": 256000
            },
            "input": 1.2,
            "output": 4.8,
            "cache_read": 0.12,
            "cache_write": 1.5
          }
        ]
      },
      "description": "Beijing online original list; 8-fold promotional discount for Plus is intentionally not applied. Cache mode is an explicit price-list scope, not automatic selection. Inputs and reasoning+answer output have same output rate. Maximum input 1,000,000. Tools are separate optional meters; see optionalToolFees.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/model-pricing"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        },
        {
          "field": "cache_write",
          "status": "charged",
          "note": "5-minute explicit cache creation at 125% standard input.",
          "sourceUrl": "https://help.aliyun.com/zh/model-studio/context-cache"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seed-2-1-pro-260628--cn-beijing-online-regular-implicit-original",
      "provider": "volcengine",
      "model": "doubao-seed-2-1-pro-260628",
      "priceList": "cn-beijing-online-regular-implicit-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 6,
        "output": 30,
        "cache_read": 1.2
      },
      "description": "Mainland Ark regular online inference, implicit cache only. Exact Model ID verified against official model-list family. Explicit Responses caching is a separate excluded shape; raw storage rate retained. Do not add explicit storage cost to this implicit list. Optional server-side tools require separate matching meters.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seed-2-1-turbo-260628--cn-beijing-online-regular-implicit-original",
      "provider": "volcengine",
      "model": "doubao-seed-2-1-turbo-260628",
      "priceList": "cn-beijing-online-regular-implicit-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read"
      ],
      "cost": {
        "input": 3,
        "output": 15,
        "cache_read": 0.6
      },
      "description": "Mainland Ark regular online inference, implicit cache only. Exact Model ID verified against official model-list family. Explicit Responses caching is a separate excluded shape; raw storage rate retained. Do not add explicit storage cost to this implicit list. Optional server-side tools require separate matching meters.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seed-2-0-pro-260215--cn-beijing-online-regular-implicit-original",
      "provider": "volcengine",
      "model": "doubao-seed-2-0-pro-260215",
      "priceList": "cn-beijing-online-regular-implicit-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.1.input",
        "tiers.1.output",
        "tiers.1.cache_read"
      ],
      "cost": {
        "input": 3.2,
        "output": 16,
        "cache_read": 0.64,
        "tiers": [
          {
            "tier": {
              "size": 32000
            },
            "input": 4.8,
            "output": 24,
            "cache_read": 0.96
          },
          {
            "tier": {
              "size": 128000
            },
            "input": 9.6,
            "output": 48,
            "cache_read": 1.92
          }
        ]
      },
      "description": "Mainland Ark regular online inference, implicit cache only. Exact Model ID verified against official model-list family. Explicit Responses caching is a separate excluded shape; raw storage rate retained. Do not add explicit storage cost to this implicit list. Optional server-side tools require separate matching meters.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seed-2-0-code-preview-260215--cn-beijing-online-regular-implicit-original",
      "provider": "volcengine",
      "model": "doubao-seed-2-0-code-preview-260215",
      "priceList": "cn-beijing-online-regular-implicit-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.1.input",
        "tiers.1.output",
        "tiers.1.cache_read"
      ],
      "cost": {
        "input": 3.2,
        "output": 16,
        "cache_read": 0.64,
        "tiers": [
          {
            "tier": {
              "size": 32000
            },
            "input": 4.8,
            "output": 24,
            "cache_read": 0.96
          },
          {
            "tier": {
              "size": 128000
            },
            "input": 9.6,
            "output": 48,
            "cache_read": 1.92
          }
        ]
      },
      "description": "Mainland Ark regular online inference, implicit cache only. Exact Model ID verified against official model-list family. Explicit Responses caching is a separate excluded shape; raw storage rate retained. Do not add explicit storage cost to this implicit list. Optional server-side tools require separate matching meters.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "cache_read",
          "status": "charged",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        },
        {
          "field": "separate_cache_storage",
          "status": "free",
          "note": "Implicit cache: no separate storage charge. Normal input already pays cache creation.",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedance-1-0-pro-250528--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedance-1-0-pro-250528",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Official model-list exact ID; only online task token fee. Offline inference has separate 7.50 CNY/M tokens; not included in this online list. Upcoming deprecation noted by model list.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedance-1-0-pro-250528",
        "tiers": [
          {
            "name": "online",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 15,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.tokens",
          "status": "charged",
          "unit": "per_million_tokens",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedance-2-0-260128--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedance-2-0-260128",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Native doubao task, exact official ID. tokens must be API usage.completion_tokens (billable usage includes video-input minimum), not an estimate from seconds. Official price page uses 4K; fixed schema condition is lower-case 4k. Failed generations free. Last unconditional fallback handles remaining supported 480p/720p no-input-video cases.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedance-2-0-260128",
        "tiers": [
          {
            "name": "4k-video",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 16,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "resolution": "4k",
              "video_input": "video"
            }
          },
          {
            "name": "4k-none",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 26,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "resolution": "4k",
              "video_input": "none"
            }
          },
          {
            "name": "1080p-video",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 31,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "resolution": "1080p",
              "video_input": "video"
            }
          },
          {
            "name": "1080p-none",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 51,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "resolution": "1080p",
              "video_input": "none"
            }
          },
          {
            "name": "480p-720p-video",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 28,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "video_input": "video"
            }
          },
          {
            "name": "480p-720p-none-default",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 46,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.tokens",
          "status": "charged",
          "unit": "per_million_tokens",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedance-2-0-fast-260128--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedance-2-0-fast-260128",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Native doubao task, exact official ID. tokens must be API usage.completion_tokens (billable usage includes video-input minimum), not an estimate from seconds. Official price page uses 4K; fixed schema condition is lower-case 4k. Failed generations free. Last unconditional fallback handles remaining supported 480p/720p no-input-video cases.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedance-2-0-fast-260128",
        "tiers": [
          {
            "name": "480p-720p-video",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 22,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "video_input": "video"
            }
          },
          {
            "name": "480p-720p-none-default",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 37,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.tokens",
          "status": "charged",
          "unit": "per_million_tokens",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedance-2-0-mini-260615--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedance-2-0-mini-260615",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Native doubao task, exact official ID. tokens must be API usage.completion_tokens (billable usage includes video-input minimum), not an estimate from seconds. Official price page uses 4K; fixed schema condition is lower-case 4k. Failed generations free. Last unconditional fallback handles remaining supported 480p/720p no-input-video cases.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedance-2-0-mini-260615",
        "tiers": [
          {
            "name": "480p-720p-video",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 14,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ],
            "when": {
              "video_input": "video"
            }
          },
          {
            "name": "480p-720p-none-default",
            "charges": [
              {
                "usageKey": "tokens",
                "amount": 23,
                "unit": "per_million_tokens",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.tokens",
          "status": "charged",
          "unit": "per_million_tokens",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedream-5-0-flash-260915--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedream-5-0-flash-260915",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Exact official Model ID from live model list; 5-0-260128 explicitly also supports 5-0-lite-260128. All successful output images share flat price; input images explicitly free. Only native image counters declared by the fixed per-model profile are used. Models 5.0 lite/5.0/4.5/4.0 are marked upcoming retirement by current model list.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedream-5-0-flash-260915",
        "tiers": [
          {
            "name": "all-supported-images",
            "charges": [
              {
                "usageKey": "images_up_to_1_5k",
                "amount": 0.12,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "images_above_1_5k",
                "amount": 0.12,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "input_images",
                "amount": 0,
                "unit": "per_count",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.images_up_to_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.images_above_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.input_images",
          "status": "free",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedream-5-0-lite-260128--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedream-5-0-lite-260128",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Exact official Model ID from live model list; 5-0-260128 explicitly also supports 5-0-lite-260128. All successful output images share flat price; input images explicitly free. Only native image counters declared by the fixed per-model profile are used. Models 5.0 lite/5.0/4.5/4.0 are marked upcoming retirement by current model list.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedream-5-0-lite-260128",
        "tiers": [
          {
            "name": "all-supported-images",
            "charges": [
              {
                "usageKey": "images_above_1_5k",
                "amount": 0.22,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "input_images",
                "amount": 0,
                "unit": "per_count",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.images_above_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.input_images",
          "status": "free",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedream-5-0-260128--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedream-5-0-260128",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Exact official Model ID from live model list; 5-0-260128 explicitly also supports 5-0-lite-260128. All successful output images share flat price; input images explicitly free. Only native image counters declared by the fixed per-model profile are used. Models 5.0 lite/5.0/4.5/4.0 are marked upcoming retirement by current model list.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedream-5-0-260128",
        "tiers": [
          {
            "name": "all-supported-images",
            "charges": [
              {
                "usageKey": "images_above_1_5k",
                "amount": 0.22,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "input_images",
                "amount": 0,
                "unit": "per_count",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.images_above_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.input_images",
          "status": "free",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedream-4-5-251128--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedream-4-5-251128",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Exact official Model ID from live model list; 5-0-260128 explicitly also supports 5-0-lite-260128. All successful output images share flat price; input images explicitly free. Only native image counters declared by the fixed per-model profile are used. Models 5.0 lite/5.0/4.5/4.0 are marked upcoming retirement by current model list.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedream-4-5-251128",
        "tiers": [
          {
            "name": "all-supported-images",
            "charges": [
              {
                "usageKey": "images_above_1_5k",
                "amount": 0.25,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "input_images",
                "amount": 0,
                "unit": "per_count",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.images_above_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.input_images",
          "status": "free",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "volcengine--doubao-seedream-4-0-250828--cn-beijing-task-online-original",
      "provider": "volcengine",
      "model": "doubao-seedream-4-0-250828",
      "priceList": "cn-beijing-task-online-original",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "required": [],
      "cost": {},
      "description": "Exact official Model ID from live model list; 5-0-260128 explicitly also supports 5-0-lite-260128. All successful output images share flat price; input images explicitly free. Only native image counters declared by the fixed per-model profile are used. Models 5.0 lite/5.0/4.5/4.0 are marked upcoming retirement by current model list.",
      "kind": "task",
      "task": {
        "plugin": "doubao",
        "model": "doubao-seedream-4-0-250828",
        "tiers": [
          {
            "name": "all-supported-images",
            "charges": [
              {
                "usageKey": "images_up_to_1_5k",
                "amount": 0.2,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "images_above_1_5k",
                "amount": 0.2,
                "unit": "per_count",
                "currency": "CNY"
              },
              {
                "usageKey": "input_images",
                "amount": 0,
                "unit": "per_count",
                "currency": "CNY"
              }
            ]
          }
        ]
      },
      "feeDeclarations": [
        {
          "field": "task.images_up_to_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.images_above_1_5k",
          "status": "charged",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        },
        {
          "field": "task.input_images",
          "status": "free",
          "unit": "per_count",
          "sourceUrl": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh"
        }
      ]
    },
    {
      "id": "hunyuan--hunyuan-a13b--mainland-legacy-hunyuan-online-postpaid-published",
      "provider": "hunyuan",
      "model": "hunyuan-a13b",
      "priceList": "mainland-legacy-hunyuan-online-postpaid-published",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://cloud.tencent.com/document/product/1729/97731",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output"
      ],
      "cost": {
        "input": 0.5,
        "output": 2
      },
      "description": "Official legacy Hunyuan price page updated2026-06-26 publishes0.5/2 CNY/M tokens. This is a published legacy quote, not an availability claim: official announcement says original Hunyuan platform shutdown2026-09-30. Current TokenHub price list has no a13b row.",
      "feeDeclarations": [
        {
          "field": "input",
          "status": "charged",
          "sourceUrl": "https://cloud.tencent.com/document/product/1729/97731"
        },
        {
          "field": "output",
          "status": "charged",
          "note": "Published output price includes reasoning where supported.",
          "sourceUrl": "https://cloud.tencent.com/document/product/1729/97731"
        },
        {
          "field": "separate_cache_storage",
          "status": "not-listed",
          "note": "No separate model cache rate published in this table.",
          "sourceUrl": "https://cloud.tencent.com/document/product/1729/97731"
        }
      ]
    }
  ],
  "coverage": [
    {
      "platform": "dashscope",
      "model": "qwen3.7-max",
      "status": "ready",
      "reason": "Complete Beijing original token fees, separately scoped implicit and explicit cache price lists; do not combine cache-read rates.",
      "quoteIds": [
        "dashscope--qwen3.7-max--cn-beijing-online-original-implicit",
        "dashscope--qwen3.7-max--cn-beijing-online-original-explicit"
      ],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache"
      ]
    },
    {
      "platform": "dashscope-anthropic",
      "model": "qwen3.7-max",
      "status": "ready",
      "reason": "Complete Beijing original token fees, separately scoped implicit and explicit cache price lists; do not combine cache-read rates.",
      "quoteIds": [
        "dashscope-anthropic--qwen3.7-max--cn-beijing-online-original-implicit",
        "dashscope-anthropic--qwen3.7-max--cn-beijing-online-original-explicit"
      ],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache",
        "https://help.aliyun.com/zh/model-studio/anthropic-api-messages"
      ]
    },
    {
      "platform": "dashscope",
      "model": "qwen3.7-plus",
      "status": "ready",
      "reason": "Complete Beijing original token fees, separately scoped implicit and explicit cache price lists; do not combine cache-read rates.",
      "quoteIds": [
        "dashscope--qwen3.7-plus--cn-beijing-online-original-implicit",
        "dashscope--qwen3.7-plus--cn-beijing-online-original-explicit"
      ],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache"
      ]
    },
    {
      "platform": "dashscope",
      "model": "qwen3.7-flash",
      "status": "ready",
      "reason": "Complete Beijing original token fees, separately scoped implicit and explicit cache price lists; do not combine cache-read rates.",
      "quoteIds": [
        "dashscope--qwen3.7-flash--cn-beijing-online-original-implicit",
        "dashscope--qwen3.7-flash--cn-beijing-online-original-explicit"
      ],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache"
      ]
    },
    {
      "platform": "dashscope",
      "model": "qwen3.8-flash",
      "status": "incomplete",
      "reason": "Direct-call public cache documentation explicitly excepts this model and directs cache prices to console. Router table is a different route and cannot prove direct-call cache price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache",
        "https://help.aliyun.com/zh/model-studio/model-routing",
        "https://help.aliyun.com/zh/model-studio/anthropic-api-messages"
      ]
    },
    {
      "platform": "dashscope",
      "model": "qwen3.8-max",
      "status": "incomplete",
      "reason": "Direct-call public cache documentation explicitly excepts this model and directs cache prices to console. Router table is a different route and cannot prove direct-call cache price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache",
        "https://help.aliyun.com/zh/model-studio/model-routing",
        "https://help.aliyun.com/zh/model-studio/anthropic-api-messages"
      ]
    },
    {
      "platform": "dashscope-anthropic",
      "model": "qwen3.8-max",
      "status": "incomplete",
      "reason": "Direct-call public cache documentation explicitly excepts this model and directs cache prices to console. Router table is a different route and cannot prove direct-call cache price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://help.aliyun.com/zh/model-studio/model-pricing",
        "https://help.aliyun.com/zh/model-studio/context-cache",
        "https://help.aliyun.com/zh/model-studio/model-routing",
        "https://help.aliyun.com/zh/model-studio/anthropic-api-messages"
      ]
    },
    {
      "platform": "qianfan",
      "model": "ernie-5.1",
      "status": "incomplete",
      "reason": "Official raw rates and model identity verified, but source tier labels32k/128k have no supplier-specific numeric expansion verified. Cannot choose32000 vs32768 boundary; raw pricing retained without an executable threshold.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
        "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j"
      ]
    },
    {
      "platform": "qianfan",
      "model": "ernie-5.0",
      "status": "missing-source",
      "reason": "Absent from live pricing and current model-ID list; no official live complete price for this exact ID was found. Do not substitute ERNIE5.1.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
        "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j"
      ]
    },
    {
      "platform": "qianfan",
      "model": "ernie-5.0-thinking-preview",
      "status": "missing-source",
      "reason": "Absent from live pricing and current model-ID list; no official live complete price for this exact ID was found. Do not substitute ERNIE5.1.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
        "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j"
      ]
    },
    {
      "platform": "qianfan",
      "model": "ernie-5.0-thinking-latest",
      "status": "missing-source",
      "reason": "Absent from live pricing and current model-ID list; no official live complete price for this exact ID was found. Do not substitute ERNIE5.1.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
        "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2-1-pro-260628",
      "status": "ready",
      "reason": "Complete regular online implicit-cache price list, exact official dated Model ID. Explicit cache list separately unsupported.",
      "quoteIds": [
        "volcengine--doubao-seed-2-1-pro-260628--cn-beijing-online-regular-implicit-original"
      ],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2-1-turbo-260628",
      "status": "ready",
      "reason": "Complete regular online implicit-cache price list, exact official dated Model ID. Explicit cache list separately unsupported.",
      "quoteIds": [
        "volcengine--doubao-seed-2-1-turbo-260628--cn-beijing-online-regular-implicit-original"
      ],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2-0-pro-260215",
      "status": "ready",
      "reason": "Complete regular online implicit-cache price list, exact official dated Model ID. Explicit cache list separately unsupported.",
      "quoteIds": [
        "volcengine--doubao-seed-2-0-pro-260215--cn-beijing-online-regular-implicit-original"
      ],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2-0-code-preview-260215",
      "status": "ready",
      "reason": "Complete regular online implicit-cache price list, exact official dated Model ID. Explicit cache list separately unsupported.",
      "quoteIds": [
        "volcengine--doubao-seed-2-0-code-preview-260215--cn-beijing-online-regular-implicit-original"
      ],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2.0-lite",
      "status": "unsupported-shape",
      "reason": "Published model price includes distinct cache-hit audio tokens not expressible in current cost schema; explicit cache also has token-hours. Unsuffixed family name is not independently proven as an API alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2-0-lite-260428",
      "status": "unsupported-shape",
      "reason": "Published model price includes distinct cache-hit audio tokens not expressible in current cost schema; explicit cache also has token-hours. Unsuffixed family name is not independently proven as an API alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2.0-mini",
      "status": "unsupported-shape",
      "reason": "Published model price includes distinct cache-hit audio tokens not expressible in current cost schema; explicit cache also has token-hours. Unsuffixed family name is not independently proven as an API alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2-0-mini-260428",
      "status": "unsupported-shape",
      "reason": "Published model price includes distinct cache-hit audio tokens not expressible in current cost schema; explicit cache also has token-hours. Unsuffixed family name is not independently proven as an API alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2.0-pro",
      "status": "missing-source",
      "reason": "Official pricing names the family, but the live API model list names doubao-seed-2-0-pro-260215; no first-party statement that this exact dotted shorthand is an accepted API alias. Exact ID candidate is separate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-2.0-code",
      "status": "missing-source",
      "reason": "Official pricing names the family, but the live API model list names doubao-seed-2-0-code-preview-260215; no first-party statement that this exact dotted shorthand is an accepted API alias. Exact ID candidate is separate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-1.8",
      "status": "unsupported-shape",
      "reason": "Official dedicated model page has output-length<=200 vs>200 within input<=32000 plus explicit token-hour storage; ModelCost only has input-length tiers.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/bytedance-seed-1-8?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-1-8-251228",
      "status": "unsupported-shape",
      "reason": "Official dedicated model page has output-length<=200 vs>200 within input<=32000 plus explicit token-hour storage; ModelCost only has input-length tiers.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/bytedance-seed-1-8?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-1.6",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-1.6-thinking",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-1.6-flash",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-1.6-lite",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seed-code",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-1.5-thinking-pro",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-1.5-pro-32k",
      "status": "missing-source",
      "reason": "Exact requested shorthand lacks a complete live official CNY price and API-alias proof in reviewed pages. Legacy versions occur in retirement/migration material; do not copy local override or successor rate.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
      ]
    },
    {
      "platform": "volcengine",
      "model": "doubao-seedream-5.0-lite",
      "status": "missing-source",
      "reason": "Live official model list explicitly aliases doubao-seedream-5-0-260128 to doubao-seedream-5-0-lite-260128, but not this dotted shorthand. Native exact-ID task candidates are provided separately.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "seedance-video",
      "model": "seedance-2.0",
      "status": "missing-source",
      "reason": "Coverage shorthand has no fixed rc50 task binding or explicit first-party API alias proof; official exact ID is doubao-seedance-2-0-260128. Complete exact-ID task quote is separate; no silent alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "seedance-video",
      "model": "seedance-2.0-fast",
      "status": "missing-source",
      "reason": "Coverage shorthand has no fixed rc50 task binding or explicit first-party API alias proof; official exact ID is doubao-seedance-2-0-fast-260128. Complete exact-ID task quote is separate; no silent alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "seedance-video",
      "model": "seedance-2.0-mini",
      "status": "missing-source",
      "reason": "Coverage shorthand has no fixed rc50 task binding or explicit first-party API alias proof; official exact ID is doubao-seedance-2-0-mini-260615. Complete exact-ID task quote is separate; no silent alias.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "seedance-video",
      "model": "seedance-2.5",
      "status": "unsupported-shape",
      "reason": "Coverage shorthand has no fixed rc50 task binding or explicit first-party API alias proof; official exact ID is doubao-seedance-2-5-260628. Additionally full 2.5 pricing includes 4K missing from fixed 2.5 profile.",
      "quoteIds": [],
      "sourceUrls": [
        "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "https://docs.volcengine.com/docs/ark/model-list?lang=zh"
      ]
    },
    {
      "platform": "hunyuan",
      "model": "hunyuan-a13b",
      "status": "ready",
      "reason": "Complete still-published official legacy raw CNY input/output. Availability is retired-platform, not current TokenHub availability.",
      "quoteIds": [
        "hunyuan--hunyuan-a13b--mainland-legacy-hunyuan-online-postpaid-published"
      ],
      "sourceUrls": [
        "https://cloud.tencent.com/document/product/1729/97731",
        "https://cloud.tencent.com/document/product/1729/131925",
        "https://cloud.tencent.com/document/product/1823/130055"
      ]
    },
    {
      "platform": "hunyuan",
      "model": "hunyuan-2.0-thinking-20251109",
      "status": "missing-source",
      "reason": "Explicit EOS2026-06-22 in official migration announcement, absent current legacy and TokenHub price tables. No complete current original CNY quote verified; never substitute recommended hy3 successor price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.tencent.com/document/product/1729/131925",
        "https://cloud.tencent.com/document/product/1729/97731",
        "https://cloud.tencent.com/document/product/1823/130055"
      ]
    },
    {
      "platform": "hunyuan",
      "model": "hunyuan-2.0-instruct-20251111",
      "status": "missing-source",
      "reason": "Explicit EOS2026-06-22 in official migration announcement, absent current legacy and TokenHub price tables. No complete current original CNY quote verified; never substitute recommended hy3 successor price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.tencent.com/document/product/1729/131925",
        "https://cloud.tencent.com/document/product/1729/97731",
        "https://cloud.tencent.com/document/product/1823/130055"
      ]
    },
    {
      "platform": "hunyuan",
      "model": "hunyuan-t1-latest",
      "status": "missing-source",
      "reason": "Explicit EOS2026-06-22 in official migration announcement, absent current legacy and TokenHub price tables. No complete current original CNY quote verified; never substitute recommended hy3 successor price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.tencent.com/document/product/1729/131925",
        "https://cloud.tencent.com/document/product/1729/97731",
        "https://cloud.tencent.com/document/product/1823/130055"
      ]
    },
    {
      "platform": "hunyuan",
      "model": "hunyuan-turbos-latest",
      "status": "missing-source",
      "reason": "Explicit EOS2026-06-22 in official migration announcement, absent current legacy and TokenHub price tables. No complete current original CNY quote verified; never substitute recommended hy3 successor price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.tencent.com/document/product/1729/131925",
        "https://cloud.tencent.com/document/product/1729/97731",
        "https://cloud.tencent.com/document/product/1823/130055"
      ]
    },
    {
      "platform": "hunyuan",
      "model": "hunyuan-lite",
      "status": "missing-source",
      "reason": "Explicit EOS2026-06-22 in official migration announcement, absent current legacy and TokenHub price tables. No complete current original CNY quote verified; never substitute recommended hy3 successor price.",
      "quoteIds": [],
      "sourceUrls": [
        "https://cloud.tencent.com/document/product/1729/131925",
        "https://cloud.tencent.com/document/product/1729/97731",
        "https://cloud.tencent.com/document/product/1823/130055"
      ]
    }
  ],
  "excludedQuotes": [
    {
      "officialModel": "qwen3.8-flash",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "reason": "Direct-call cache fee incomplete; no direct ready quote. Routing-only cached-input figures retained without transplanting them into direct-call prices.",
      "rawFees": {
        "directOriginalInput": 0.8,
        "directOriginalOutput": 2.7,
        "unit": "CNY/million_tokens",
        "inputRange": "0<input<=1000000",
        "explicitCreation": "Max: 125% input; Flash: exception, unknown",
        "explicitHit": "console-only exception",
        "implicitHit": "console-only exception",
        "routerCachedInput": 0.1,
        "routerPriceSource": "https://help.aliyun.com/zh/model-studio/model-routing"
      },
      "region": "cn-beijing"
    },
    {
      "officialModel": "qwen3.8-max",
      "currency": "CNY",
      "source": {
        "url": "https://help.aliyun.com/zh/model-studio/model-pricing",
        "checkedAt": "2026-11-16"
      },
      "reason": "Direct-call cache fee incomplete; no direct ready quote. Routing-only cached-input figures retained without transplanting them into direct-call prices.",
      "rawFees": {
        "directOriginalInput": 12,
        "directOriginalOutput": 36,
        "unit": "CNY/million_tokens",
        "inputRange": "0<input<=1000000",
        "explicitCreation": "Max: 125% input; Flash: exception, unknown",
        "explicitHit": "console-only exception",
        "implicitHit": "console-only exception",
        "routerCachedInput": 1.5,
        "routerPriceSource": "https://help.aliyun.com/zh/model-studio/model-routing"
      },
      "region": "cn-beijing"
    },
    {
      "officialModel": "doubao-seed-2-1-pro-260628",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Explicit cache additionally bills token-hours, absent from ModelCost. Cannot encode as cache_write.",
      "rawFees": {
        "tokenFees": {
          "input": 6,
          "output": 30,
          "cache_read": 1.2
        },
        "tokenUnit": "CNY/million_tokens",
        "cacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "rounding": "Per natural-hour billing period; partial period charged as full hour"
      },
      "priceList": "cn-beijing-online-regular-explicit-original",
      "cacheSource": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
    },
    {
      "officialModel": "doubao-seed-2-1-turbo-260628",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Explicit cache additionally bills token-hours, absent from ModelCost. Cannot encode as cache_write.",
      "rawFees": {
        "tokenFees": {
          "input": 3,
          "output": 15,
          "cache_read": 0.6
        },
        "tokenUnit": "CNY/million_tokens",
        "cacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "rounding": "Per natural-hour billing period; partial period charged as full hour"
      },
      "priceList": "cn-beijing-online-regular-explicit-original",
      "cacheSource": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
    },
    {
      "officialModel": "doubao-seed-2-0-pro-260215",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Explicit cache additionally bills token-hours, absent from ModelCost. Cannot encode as cache_write.",
      "rawFees": {
        "tokenFees": {
          "input": 3.2,
          "output": 16,
          "cache_read": 0.64,
          "tiers": [
            {
              "tier": {
                "size": 32000
              },
              "input": 4.8,
              "output": 24,
              "cache_read": 0.96
            },
            {
              "tier": {
                "size": 128000
              },
              "input": 9.6,
              "output": 48,
              "cache_read": 1.92
            }
          ]
        },
        "tokenUnit": "CNY/million_tokens",
        "cacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "rounding": "Per natural-hour billing period; partial period charged as full hour"
      },
      "priceList": "cn-beijing-online-regular-explicit-original",
      "cacheSource": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
    },
    {
      "officialModel": "doubao-seed-2-0-code-preview-260215",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Explicit cache additionally bills token-hours, absent from ModelCost. Cannot encode as cache_write.",
      "rawFees": {
        "tokenFees": {
          "input": 3.2,
          "output": 16,
          "cache_read": 0.64,
          "tiers": [
            {
              "tier": {
                "size": 32000
              },
              "input": 4.8,
              "output": 24,
              "cache_read": 0.96
            },
            {
              "tier": {
                "size": 128000
              },
              "input": 9.6,
              "output": 48,
              "cache_read": 1.92
            }
          ]
        },
        "tokenUnit": "CNY/million_tokens",
        "cacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "rounding": "Per natural-hour billing period; partial period charged as full hour"
      },
      "priceList": "cn-beijing-online-regular-explicit-original",
      "cacheSource": "https://docs.volcengine.com/docs/ark/context-cache?lang=zh"
    },
    {
      "officialModel": "doubao-seed-2-0-lite-260428",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "ModelCost has no cached-audio input fee family; explicit cache additionally requires token-hours. No partial text-only quote.",
      "rawFees": {
        "unit": "CNY/million_tokens",
        "columns": [
          "inputNonAudio",
          "inputAudio",
          "cacheHitNonAudio",
          "cacheHitAudio",
          "output"
        ],
        "inputIntervals": [
          "[0,32000]",
          "(32000,128000]",
          "(128000,256000]"
        ],
        "rows": [
          [
            0.6,
            9,
            0.12,
            1.8,
            3.6
          ],
          [
            0.9,
            13.5,
            0.18,
            2.7,
            5.4
          ],
          [
            1.8,
            27,
            0.36,
            5.4,
            10.8
          ]
        ],
        "explicitCacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "implicitCacheStorage": 0
      }
    },
    {
      "officialModel": "doubao-seed-2-0-mini-260428",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "ModelCost has no cached-audio input fee family; explicit cache additionally requires token-hours. No partial text-only quote.",
      "rawFees": {
        "unit": "CNY/million_tokens",
        "columns": [
          "inputNonAudio",
          "inputAudio",
          "cacheHitNonAudio",
          "cacheHitAudio",
          "output"
        ],
        "inputIntervals": [
          "[0,32000]",
          "(32000,128000]",
          "(128000,256000]"
        ],
        "rows": [
          [
            0.2,
            3,
            0.04,
            0.6,
            2
          ],
          [
            0.4,
            6,
            0.08,
            1.2,
            4
          ],
          [
            0.8,
            12,
            0.16,
            2.4,
            8
          ]
        ],
        "explicitCacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "implicitCacheStorage": 0
      }
    },
    {
      "officialModel": "doubao-seed-1-8-251228",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/bytedance-seed-1-8?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Output length and input length jointly select rate; no current output-length tier dimension, plus token-hour storage.",
      "rawFees": {
        "unit": "CNY/million_tokens",
        "conditions": [
          "input[0,32000]&output[0,200]",
          "input[0,32000]&output(200,infinity)",
          "input(32000,128000]",
          "input(128000,256000]"
        ],
        "input": [
          0.8,
          0.8,
          1.2,
          2.4
        ],
        "cacheHit": [
          0.16,
          0.16,
          0.16,
          0.16
        ],
        "output": [
          2,
          8,
          16,
          24
        ],
        "explicitCacheStorage": 0.017,
        "storageUnit": "CNY/million_token_hours",
        "batchInput": [
          0.4,
          0.4,
          0.6,
          1.2
        ],
        "batchCacheHit": [
          0.16,
          0.16,
          0.16,
          0.16
        ],
        "batchOutput": [
          1,
          4,
          8,
          12
        ]
      },
      "availabilitySource": "https://docs.volcengine.com/docs/ark/model-deprecation-migration-guide?lang=zh"
    },
    {
      "officialModel": "doubao-seedance-2-5-260628",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Full official 4K branch missing from fixed rc50 2.5 schema; cannot present 480p/720p/1080p partial as ready.",
      "rawFees": {
        "unit": "CNY/million_billable_video_tokens",
        "columns": [
          "resolution",
          "videoInputNone",
          "videoInputPresent"
        ],
        "rows": [
          [
            "480p,720p",
            70,
            42
          ],
          [
            "1080p",
            77,
            46
          ],
          [
            "4K",
            31,
            19
          ]
        ],
        "minimumUsage": "Input video cases have a minimum; actual charged token usage is API usage.completion_tokens",
        "draft": "Draft and final are two separately charged tasks; final reference-video status derives from draft original input."
      }
    },
    {
      "officialModel": "doubao-seedance-1-0-lite-t2v",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "No full current live Ark official price table row found for this exact fixed native ID; no reseller or Coze billing substituted.",
      "rawFees": {}
    },
    {
      "officialModel": "doubao-seedance-1-0-lite-i2v",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "No full current live Ark official price table row found for this exact fixed native ID; no reseller or Coze billing substituted.",
      "rawFees": {}
    },
    {
      "officialModel": "doubao-seedance-1-5-pro-251215",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "No full current live Ark official price table row found for this exact fixed native ID; no reseller or Coze billing substituted.",
      "rawFees": {}
    },
    {
      "officialModel": "doubao-seedream-5-0-pro-260628",
      "currency": "CNY",
      "source": {
        "url": "https://docs.volcengine.com/docs/ark/model-pricing?lang=zh",
        "checkedAt": "2026-11-16"
      },
      "reason": "Input image fee is max(input_images-1,0)*0.02; current TaskQuote cannot express numeric comparisons/subtraction, so do not charge every input image or omit this fee.",
      "rawFees": {
        "unit": "CNY/image",
        "input": "first image free, second onward0.02",
        "outputPixelCutoff": 2610000,
        "singleImageOutput": [
          0.3,
          0.6
        ],
        "layerDecompositionOutput": [
          0.15,
          0.3
        ]
      }
    },
    {
      "officialModel": "ernie-5.1",
      "currency": "CNY",
      "source": {
        "url": "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
        "checkedAt": "2026-11-16"
      },
      "reason": "Incomplete: Baidu price-page32k/128k tier labels lack verified numeric-token expansion. Prior executable size32000 candidate withdrawn during self-review; do not adopt it.",
      "rawFees": {
        "unit": "CNY/thousand_tokens",
        "tiers": [
          {
            "officialCondition": "input<=32k",
            "input": 0.004,
            "output": 0.018
          },
          {
            "officialCondition": "32k<input<=128k",
            "input": 0.006,
            "output": 0.022
          }
        ],
        "thresholdTokens": null
      }
    }
  ],
  "optionalToolFees": [
    {
      "provider": "dashscope",
      "region": "cn-beijing",
      "source": "https://help.aliyun.com/zh/model-studio/web-search",
      "currency": "CNY",
      "unit": "per_thousand_calls",
      "fees": {
        "search_strategy_turbo": 3,
        "search_strategy_max": 4,
        "search_strategy_agent": 4
      },
      "note": "Optional built-in search: retrieved content separately pays normal model input. Anthropic and Responses use agent-equivalent4/1000. Normal chat token quotes above do not enable tools. Never use MCP-marketplace29/1000 as built-in search price."
    },
    {
      "provider": "qianfan",
      "source": "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
      "currency": "CNY",
      "unit": "per_call",
      "fees": {
        "searchEnhancement": 0.004
      },
      "note": "Optional native meter mapping not proven here; returned search_tokens are ordinary input tokens. Keep separate from normal no-search token price list."
    }
  ]
}
```

Validation: all 41 assigned coverage IDs occur exactly once; no missing or extra IDs. All 22 remaining candidate records pass the existing compiled `generateCny` structural diagnostics, and all 9 task records pass `compileTask` against the fixed rc50 schema. This structural check does not remove the documented scope, availability, alias, or optional-tool limitations.


Self-review evidence retained (2026-11-16):

- **Qwen exact numeric tier units and inclusivity:** [official pricing](https://help.aliyun.com/zh/model-studio/model-pricing), section“阶梯计费规则”, explicitly defines K as1,000 and M as1,000,000 (retrieved lines34–40). Beijing Plus rows318–327 state0<Token≤256K followed by256K<Token≤1M; Flash rows632–646 state0<Token≤32K,32K<Token≤256K,256K<Token≤1M. Thus transitions are strictly above32000 and256000, matching ModelCost `>tier.size`; no minus-one adjustment applies.
- **Ark supplier-specific decimal expansion:** [official Ark image understanding](https://docs.volcengine.com/docs/ark/image-understanding?lang=zh),“图片数量说明” (retrieved lines4860–4864), expands a32K-token context into arithmetic32000÷1312 and32000÷256. This supplies direct numeric evidence independent of Qwen. [Ark pricing](https://docs.volcengine.com/docs/ark/model-pricing?lang=zh), retrieved lines62 and68–79, defines the tier column in K tokens and lists[0,32],(32,128],(128,256] for Pro/Code. Together these support sizes32000/128000 with upper endpoints included in the preceding tier.
- **Qwen cache and promotion scope:** [cache billing](https://help.aliyun.com/zh/model-studio/context-cache), retrieved lines469–483, says explicit cache only changes input-token billing and enumerates creation125%, hits10%, remaining input original; lines39–45 and527 limit this to5min ephemeral, minimum1024tokens, implicit/explicit mutually exclusive. There is no separately published storage/token-hour tariff and no explicit sentence“storage is free”; do not invent a sourced zero-per-hour rate. [Original pricing](https://help.aliyun.com/zh/model-studio/model-pricing), line31, distinguishes original list prices from console promotions; Plus rows explicitly label原价 with限时8折. Candidates are catalog original prices, not current net payable rates, nor proof a user can elect to reject an automatically applied promotion.
- **ERNIE5.1 downgrade:** [Baidu pricing](https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya), retrieved lines1366–1369, uses32k/128k but does not define their numeric expansion in the reviewed page. Narrow searches for Baidu Qianfan1k/1000,32k/32000,32k/32768 and billing k/1024 returned no usable primary definition; community articles were rejected. Exact denomination0.004/0.018 and0.006/0.022 CNY/thousand tokens remains verified, but the executable tier boundary is unverified. The earlier size32000 candidate is withdrawn from this note’s ready records and its raw conditions are retained in excludedQuotes. Aggregate integration must mark it incomplete until primary numeric boundary evidence is available.
