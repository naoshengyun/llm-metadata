# Independent tool tariff maintenance — 2026-11-16

[BigModel official pricing](https://docs.bigmodel.cn/cn/guide/start/pricing) supplies the original CNY call prices below. [DeepSeek official Search/Fetch billing](https://api-docs.deepseek.com/zh-cn/guides/search/) requires a successful response with nonempty results/content. Model token prices remain additive.

The native source contracts are read-only at exact rc50 f2aa91232ed3e5878a614762ace6736a2b74257f. GLM Chat encoder fixes search_std and counts the search once, not the number of results. DeepSeek has existing keys, but its fallback block-count regression fixture counts a delivered empty result; configuration alone does not enforce the official success condition in every path. These runtime conditions are recorded, not repaired under a price-maintenance task. No provider calls or counter tests are claimed.

```json
{
  "records": [
    {
      "id": "cn-zhipu-search-std-standard",
      "provider": "zhipuai",
      "model": "search_std",
      "priceList": "BigModel China Search-Std per-call tariff",
      "origin": "domestic",
      "currency": "CNY",
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "kind": "tool",
      "required": [],
      "cost": {},
      "tools": [
        {
          "key": "search_std",
          "amount": 0.01,
          "unit": "per_call",
          "currency": "CNY"
        }
      ],
      "description": "Separate Search-Std tool charge; standard model token charges remain additive. Candidate applies only existing search_std native key, not other search engines.",
      "nativeContract": {
        "sourceSha": "f2aa91232ed3e5878a614762ace6736a2b74257f",
        "paths": [
          "relay/channel/zhipu_4v/web_search.go",
          "setting/operation_setting/tools.go"
        ],
        "scope": "Existing GLM Chat search_std encoder/meter. Actual search invocation/billing O verification is not claimed."
      }
    }
  ],
  "coverage": [],
  "excludedQuotes": [
    {
      "id": "cn-deepseek-deepseek_search",
      "provider": "deepseek",
      "officialModel": "deepseek_search",
      "status": "unsupported-shape",
      "currency": "CNY",
      "rawFees": {
        "amount": 5,
        "unit": "per_thousand_successful_calls"
      },
      "source": {
        "url": "https://api-docs.deepseek.com/zh-cn/guides/search/",
        "checkedAt": "2026-11-16"
      },
      "reason": "Official successful-count condition requires HTTP200 and nonempty results/content. Fixed rc50 fallback result-block counter can count an empty result when terminal authoritative usage is absent. Preserve raw price; candidate does not claim that every existing native path preserves the condition. No runtime recovery/meter patch is added.",
      "nativeContract": {
        "sourceSha": "f2aa91232ed3e5878a614762ace6736a2b74257f",
        "paths": [
          "relay/channel/claude/tool_billing_test.go",
          "relay/channel/deepseek/constants.go"
        ]
      }
    },
    {
      "id": "cn-deepseek-deepseek_fetch",
      "provider": "deepseek",
      "officialModel": "deepseek_fetch",
      "status": "unsupported-shape",
      "currency": "CNY",
      "rawFees": {
        "amount": 5,
        "unit": "per_thousand_successful_calls"
      },
      "source": {
        "url": "https://api-docs.deepseek.com/zh-cn/guides/search/",
        "checkedAt": "2026-11-16"
      },
      "reason": "Official successful-count condition requires HTTP200 and nonempty results/content. Fixed rc50 fallback result-block counter can count an empty result when terminal authoritative usage is absent. Preserve raw price; candidate does not claim that every existing native path preserves the condition. No runtime recovery/meter patch is added.",
      "nativeContract": {
        "sourceSha": "f2aa91232ed3e5878a614762ace6736a2b74257f",
        "paths": [
          "relay/channel/claude/tool_billing_test.go",
          "relay/channel/deepseek/constants.go"
        ]
      }
    },
    {
      "id": "cn-zhipu-search_pro-standard",
      "provider": "zhipuai",
      "officialModel": "search_pro",
      "status": "unsupported-shape",
      "currency": "CNY",
      "rawFees": {
        "amount": 0.03,
        "unit": "per_call"
      },
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "reason": "Native price key exists, but the inspected fixed rc50 GLM Chat encoder/meter explicitly handles only search_std. Other engine collection paths have not been established; not represented as fully supported by this candidate."
    },
    {
      "id": "cn-zhipu-search_pro_sogou-standard",
      "provider": "zhipuai",
      "officialModel": "search_pro_sogou",
      "status": "unsupported-shape",
      "currency": "CNY",
      "rawFees": {
        "amount": 0.05,
        "unit": "per_call"
      },
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "reason": "Native price key exists, but the inspected fixed rc50 GLM Chat encoder/meter explicitly handles only search_std. Other engine collection paths have not been established; not represented as fully supported by this candidate."
    },
    {
      "id": "cn-zhipu-search_pro_quark-standard",
      "provider": "zhipuai",
      "officialModel": "search_pro_quark",
      "status": "unsupported-shape",
      "currency": "CNY",
      "rawFees": {
        "amount": 0.05,
        "unit": "per_call"
      },
      "source": {
        "url": "https://docs.bigmodel.cn/cn/guide/start/pricing",
        "checkedAt": "2026-11-16"
      },
      "reason": "Native price key exists, but the inspected fixed rc50 GLM Chat encoder/meter explicitly handles only search_std. Other engine collection paths have not been established; not represented as fully supported by this candidate."
    }
  ]
}
```
