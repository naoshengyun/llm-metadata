# Official USD price research: Anthropic, OpenAI and Google

Checked 2026-11-16 against live, public, first-party documentation. Scope is every coverage row on `anthropic`, `openai`, `gemini`, `gemini-openai`, and `gemini-banana` in `data/cny/coverage-reference.json`; exact platform/protocol/model spelling is preserved. No Exa, paid inference, supplier/production requests, code changes, or commits were used. All amounts below are original USD, not converted CNY. Read the stated unit for every non-token fee.

## Findings and evidence

[Claude pricing](https://platform.claude.com/docs/en/about-claude/pricing) publishes all five token/cache categories. The model list and [model IDs policy](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions) distinguish pinned dateless IDs from old convenience aliases. [Sonnet4.5](https://platform.claude.com/docs/en/models/sonnet-4-5/overview) and [Haiku4.5](https://platform.claude.com/docs/en/models/haiku-4-5/overview) explicitly publish both requested spellings; [Opus4.5](https://platform.claude.com/docs/en/models/opus-4-5/overview) publishes the requested dated ID. Haiku5.5 high prices start strictly above100,000 total prompt tokens, including cache tokens. Newer models otherwise have no long-context surcharge. The prior Sonnet5 planned price increase was cancelled. Batch, US inference and Fast are separate conditional lists retained below; cache multipliers stack. Sonnet4.5 retires November30,2026.

[OpenAI pricing](https://developers.openai.com/api/docs/pricing) and its [complete Markdown table](https://developers.openai.com/api/docs/pricing.md) publish all eight requested text IDs, both context bands and30m/12h writes. The [GPT-6.1 Sol page](https://developers.openai.com/api/docs/models/gpt-6.1-sol) establishes the exact272,000-input threshold and full-request multipliers. [Cache documentation](https://developers.openai.com/api/docs/guides/prompt-caching) explains nonadditive write charges and separate `ttl_30m_tokens` / `ttl_12h_tokens`; these must not be counted again in ordinary input. GPT-5.6 Sol promotional pricing expires November30,2026. Fast=2x, Batch/Flex=0.5x; only Astra and6.1Sol have published Ultrafast=6x. Regional/FedRAMP adds10% where eligible. Per-model pages were opened for every text ID; retained source URLs identify them.

[GPT image pricing](https://developers.openai.com/api/docs/pricing#image-generation), [image guide](https://developers.openai.com/api/docs/guides/image-generation#cached-input-pricing), [Images API schema](https://developers.openai.com/api/reference/resources/images/methods/generate), and [streamed usage schema](https://developers.openai.com/api/reference/resources/images/generation-streaming-events) distinguish input text/image tokens and `usage.output_tokens`. Direct2/2.5 raster generation can use ordinary output meter `c` at the image-token output rate; do not put that rate only on `img_o` when no image detail is reported. Direct2/2.5 requests have no cache discount. Responses image-tool cached counts are not reported even though billed; these paths are excluded.2.6 cache applicability is unresolved by the fetched docs and SVG additionally bills its selected author model. No `-1k/-2k/-4k` requested ID was established as an official model code; size is configured separately. [Automatic review](https://developers.openai.com/api/docs/guides/agents-api/sessions/approvals) says review tokens are charged additionally, but does not establish a public price for `codex-auto-review`.

[Google Developer API pricing](https://aistudio.google.com/docs/pricing) publishes paid Standard, Batch, Flex and Priority separately; cache prices do not always follow a common multiplier. [Explicit-cache billing](https://aistudio.google.com/docs/caching?generate-content=true#cost-efficiency) charges stored token count times duration, distinct from reads and ordinary processing. The current model/native schemas cannot represent million-token-hours, and do not define an audio cache family. Such whole-list candidates are retained as unsupported, not made ready by dropping storage. The [3.7 model notice](https://aistudio.google.com/docs/models/gemini-3.7-flash) explicitly routes3.7 to3.8; [3.5 notice](https://aistudio.google.com/docs/models/gemini-3.5-flash) routes3.5 to3.6. Those identities are disclosed crosswalks, not independent made-up prices.3.8/3.6 promotional prices end December31,2026;2.5Pro/Flash reroute on December1,2026, so checked-date quotes must not substitute those future rates early.

Google image model pages establish [3.1LiteImage](https://aistudio.google.com/docs/models/gemini-3.1-flash-lite-image), [3ProImage](https://aistudio.google.com/docs/models/gemini-3-pro-image), [3.1FlashImage](https://aistudio.google.com/docs/models/gemini-3.1-flash-image), and [2.5FlashImage](https://aistudio.google.com/docs/models/gemini-2.5-flash-image) as exact model codes, with context caching unsupported. Original text/image rates and published per-image approximations are retained below. Rounded per-image figures are alternatives for estimates, never additive to the token charge. Mixed output requires proven native modality accounting; current research does not label it executable. Requested Nano-Banana shorthands and resolution-suffixed IDs remain unmatched, rather than silently converted into official IDs.

## Integration notes

`records` are Standard inference candidates compatible with `OfficialQuote`, plus audit metadata. They cover full model-token charges for their expressly stated first-party endpoint/speed/geography; separately metered optional tools and alternate price lists remain explicit in `excludedQuotes`. Do not interpret a ready inference quote as proof that every optional resource fee can execute. `required` includes every quoted tier and TTL path. All sources were opened on the checked date; source links inside JSON are evidence pointers, not guessed aliases. `coverage` accounts for every requested row in this group, including repeated IDs under separate protocols. `excludedQuotes` stores complete observed original amounts/units and why execution is blocked or selection must remain explicit. Google `raw.storage` and every `otherPaidTiers.*.storage` are USD per1M token-hours, never USD per1M tokens.

The generator has no endpoint/speed/geography request selector: activate a different list only through explicit record selection after native routing is known. Cached Responses image paths,2.6cache/SVG, Google explicit caching and mixed-modality image paths remain visibly rejected until their actual native meters are proven. No zero rate is inferred from an omitted public fee.

## Machine-readable findings

```json
{
  "checkedAt": "2026-11-16",
  "records": [
    {
      "id": "us-anthropic-claude-fable-5-2-standard",
      "provider": "anthropic",
      "model": "claude-fable-5-2",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 8,
        "output": 40,
        "cache_read": 0.2,
        "cache_write": 10,
        "cache_write_1h": 16
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/fable-5-2/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-haiku-5-5-standard",
      "provider": "anthropic",
      "model": "claude-haiku-5-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_1h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_1h"
      ],
      "cost": {
        "input": 0.1,
        "output": 0.5,
        "cache_read": 0.01,
        "cache_write": 0.125,
        "cache_write_1h": 0.2,
        "tiers": [
          {
            "tier": {
              "size": 100000,
              "type": "input"
            },
            "input": 0.5,
            "output": 2.5,
            "cache_read": 0.05,
            "cache_write": 0.625,
            "cache_write_1h": 1
          }
        ]
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. Entire request uses high rates iff prompt >100,000 tokens, counting ordinary input plus cache reads and writes.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/haiku-5-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-sonnet-5-5-standard",
      "provider": "anthropic",
      "model": "claude-sonnet-5-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 2,
        "output": 10,
        "cache_read": 0.1,
        "cache_write": 2.5,
        "cache_write_1h": 4
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-5-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-opus-5-5-standard",
      "provider": "anthropic",
      "model": "claude-opus-5-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 4,
        "output": 20,
        "cache_read": 0.2,
        "cache_write": 5,
        "cache_write_1h": 8
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-5-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-fable-5-1-standard",
      "provider": "anthropic",
      "model": "claude-fable-5-1",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 10,
        "output": 50,
        "cache_read": 0.25,
        "cache_write": 12.5,
        "cache_write_1h": 20
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/fable-5-1/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-fable-5-standard",
      "provider": "anthropic",
      "model": "claude-fable-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 10,
        "output": 50,
        "cache_read": 1,
        "cache_write": 12.5,
        "cache_write_1h": 20
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/fable-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-opus-5-standard",
      "provider": "anthropic",
      "model": "claude-opus-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 5,
        "output": 25,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_1h": 10
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-sonnet-5-standard",
      "provider": "anthropic",
      "model": "claude-sonnet-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 2,
        "output": 10,
        "cache_read": 0.2,
        "cache_write": 2.5,
        "cache_write_1h": 4
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. The earlier planned September 2026 price increase was cancelled; $2/$10 is now standard, not an expired introductory price.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-opus-4-8-standard",
      "provider": "anthropic",
      "model": "claude-opus-4-8",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 5,
        "output": 25,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_1h": 10
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-8/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-opus-4-7-standard",
      "provider": "anthropic",
      "model": "claude-opus-4-7",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 5,
        "output": 25,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_1h": 10
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-7/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-opus-4-6-standard",
      "provider": "anthropic",
      "model": "claude-opus-4-6",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 5,
        "output": 25,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_1h": 10
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-6/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-sonnet-4-6-standard",
      "provider": "anthropic",
      "model": "claude-sonnet-4-6",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 3,
        "output": 15,
        "cache_read": 0.3,
        "cache_write": 3.75,
        "cache_write_1h": 6
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-4-6/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-sonnet-4-5-20250929-standard",
      "provider": "anthropic",
      "model": "claude-sonnet-4-5-20250929",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 3,
        "output": 15,
        "cache_read": 0.3,
        "cache_write": 3.75,
        "cache_write_1h": 6
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. Deprecated but available on checked date; retirement November 30, 2026; 200K context. The dated ID and convenience alias are explicitly documented.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-sonnet-4-5-standard",
      "provider": "anthropic",
      "model": "claude-sonnet-4-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 3,
        "output": 15,
        "cache_read": 0.3,
        "cache_write": 3.75,
        "cache_write_1h": 6
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens. Deprecated but available on checked date; retirement November 30, 2026; 200K context. The dated ID and convenience alias are explicitly documented.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-opus-4-5-20251101-standard",
      "provider": "anthropic",
      "model": "claude-opus-4-5-20251101",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 5,
        "output": 25,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_1h": 10
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-haiku-4-5-standard",
      "provider": "anthropic",
      "model": "claude-haiku-4-5",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 1,
        "output": 5,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_1h": 2
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/haiku-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-anthropic-claude-haiku-4-5-20251001-standard",
      "provider": "anthropic",
      "model": "claude-haiku-4-5-20251001",
      "priceList": "Claude API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
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
        "input": 1,
        "output": 5,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_1h": 2
      },
      "description": "First-party Claude API; Standard speed; global inference. Original USD per 1,000,000 tokens. cache_write is 5-minute TTL; cache_write_1h is 1-hour TTL. Cache reads refresh the existing TTL. Output includes billed thinking tokens; tool definitions/results and image inputs consume model tokens.",
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/haiku-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "unit": "per_million_tokens",
          "currency": "USD",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_1h"
          ]
        },
        {
          "name": "cache storage",
          "status": "not_applicable",
          "reason": "Anthropic prices cache creation by TTL and reads; no separate token-hour storage rate in this price list."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "anthropic-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-6.1-terra-standard",
      "provider": "openai",
      "model": "gpt-6.1-terra",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 1,
        "output": 5,
        "cache_read": 0.05,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 7.5,
            "cache_read": 0.1,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-6.1-sol-standard",
      "provider": "openai",
      "model": "gpt-6.1-sol",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 2,
        "output": 10,
        "cache_read": 0.1,
        "cache_write": 2.5,
        "cache_write_12h": 5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 4.0,
            "output": 15.0,
            "cache_read": 0.2,
            "cache_write": 5.0,
            "cache_write_12h": 10.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6.1-sol",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-6-astra-standard",
      "provider": "openai",
      "model": "gpt-6-astra",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 10,
        "output": 50,
        "cache_read": 1,
        "cache_write": 12.5,
        "cache_write_12h": 25,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 20.0,
            "output": 75.0,
            "cache_read": 2.0,
            "cache_write": 25.0,
            "cache_write_12h": 50.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6-astra",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-6-sol-standard",
      "provider": "openai",
      "model": "gpt-6-sol",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 2,
        "output": 10,
        "cache_read": 0.2,
        "cache_write": 2.5,
        "cache_write_12h": 5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 4.0,
            "output": 15.0,
            "cache_read": 0.4,
            "cache_write": 5.0,
            "cache_write_12h": 10.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6-sol",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-6-luna-standard",
      "provider": "openai",
      "model": "gpt-6-luna",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 0.1,
        "output": 0.5,
        "cache_read": 0.01,
        "cache_write": 0.125,
        "cache_write_12h": 0.25,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.2,
            "output": 0.75,
            "cache_read": 0.02,
            "cache_write": 0.25,
            "cache_write_12h": 0.5
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6-luna",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-5.6-sol-standard",
      "provider": "openai",
      "model": "gpt-5.6-sol",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 4,
        "output": 20,
        "cache_read": 0.4,
        "cache_write": 5,
        "cache_write_12h": 10,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 8.0,
            "output": 30.0,
            "cache_read": 0.8,
            "cache_write": 10.0,
            "cache_write_12h": 20.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate. $4/$20 promotional pricing is published only through November30,2026; no later rate inferred.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-5.6-terra-standard",
      "provider": "openai",
      "model": "gpt-5.6-terra",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 2,
        "output": 12,
        "cache_read": 0.2,
        "cache_write": 2.5,
        "cache_write_12h": 5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 4.0,
            "output": 18.0,
            "cache_read": 0.4,
            "cache_write": 5.0,
            "cache_write_12h": 10.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-5.6-luna-standard",
      "provider": "openai",
      "model": "gpt-5.6-luna",
      "priceList": "OpenAI API / Standard / global",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "output",
        "cache_read",
        "cache_write",
        "cache_write_12h",
        "tiers.0.input",
        "tiers.0.output",
        "tiers.0.cache_read",
        "tiers.0.cache_write",
        "tiers.0.cache_write_12h"
      ],
      "cost": {
        "input": 0.2,
        "output": 1.2,
        "cache_read": 0.02,
        "cache_write": 0.25,
        "cache_write_12h": 0.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.4,
            "output": 1.8,
            "cache_read": 0.04,
            "cache_write": 0.5,
            "cache_write_12h": 1.0
          }
        ]
      },
      "description": "First-party OpenAI API / Standard / ordinary global endpoint. Original USD per1M tokens. Full-request high-context prices iff input >272,000 tokens:2x input/cache rates,1.5x output. cache_write=30m, cache_write_12h=12h. Cache writes replace ordinary input charges; do not add them twice. 12h lifetime is Responses API. Reasoning output is billed at output rate. Optional tools are separate.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "feeDeclarations": [
        {
          "name": "token prices",
          "status": "priced",
          "fields": [
            "input",
            "output",
            "cache_read",
            "cache_write",
            "cache_write_12h",
            "tiers.0.input",
            "tiers.0.output",
            "tiers.0.cache_read",
            "tiers.0.cache_write",
            "tiers.0.cache_write_12h"
          ],
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "30m cache write",
          "status": "priced",
          "field": "cache_write",
          "retention": "30m"
        },
        {
          "name": "12h cache write",
          "status": "priced",
          "field": "cache_write_12h",
          "retention": "12h",
          "condition": "Responses API supports prompt_cache_options / ttl_12h_tokens; no overlapping double charge."
        },
        {
          "name": "optional server tools",
          "status": "separately_quoted",
          "quoteGroup": "openai-conditional-tools"
        }
      ]
    },
    {
      "id": "us-openai-gpt-image-2.5-sunburst-direct-images-standard",
      "provider": "openai",
      "model": "gpt-image-2.5-sunburst",
      "priceList": "OpenAI direct Images API / Standard / raster",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "input_image",
        "output"
      ],
      "cost": {
        "input": 5,
        "input_image": 8,
        "output": 30
      },
      "description": "Original USD per1M tokens. Direct /v1/images/generations or /edits, raster image output only. Text input5; image input8; image-only usage.output_tokens30 (ordinary c meter), not an assumed img_o count. The official guide expressly excludes direct Images API from cached rates for2/2.5. Resolution/quality changes token consumption, not this per-token rate. Each partial image adds100 charged output tokens. Responses tool path and SVG are excluded separately.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst"
      ],
      "feeDeclarations": [
        {
          "name": "text input",
          "status": "priced",
          "field": "input",
          "amount": 5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "image input",
          "status": "priced",
          "field": "input_image",
          "amount": 8,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "image output",
          "status": "priced",
          "field": "output",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD",
          "nativeUsage": "c=usage.output_tokens; input image tokens are usage.input_tokens_details.image_tokens. Do not set output_image without a separate image output meter."
        },
        {
          "name": "cache",
          "status": "not_applicable",
          "reason": "Official guide excludes direct Images API requests for GPT-Image2/2.5 from cache prices."
        },
        {
          "name": "partial images",
          "status": "priced",
          "amount": 100,
          "unit": "additional_output_tokens_per_partial_image",
          "condition": "Must be included in measured billable output usage; do not turn100 tokens into100USD."
        }
      ]
    },
    {
      "id": "us-openai-gpt-image-2.5-flare-direct-images-standard",
      "provider": "openai",
      "model": "gpt-image-2.5-flare",
      "priceList": "OpenAI direct Images API / Standard / raster",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "input_image",
        "output"
      ],
      "cost": {
        "input": 5,
        "input_image": 8,
        "output": 30
      },
      "description": "Original USD per1M tokens. Direct /v1/images/generations or /edits, raster image output only. Text input5; image input8; image-only usage.output_tokens30 (ordinary c meter), not an assumed img_o count. The official guide expressly excludes direct Images API from cached rates for2/2.5. Resolution/quality changes token consumption, not this per-token rate. Each partial image adds100 charged output tokens. Responses tool path and SVG are excluded separately.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.5-flare"
      ],
      "feeDeclarations": [
        {
          "name": "text input",
          "status": "priced",
          "field": "input",
          "amount": 5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "image input",
          "status": "priced",
          "field": "input_image",
          "amount": 8,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "image output",
          "status": "priced",
          "field": "output",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD",
          "nativeUsage": "c=usage.output_tokens; input image tokens are usage.input_tokens_details.image_tokens. Do not set output_image without a separate image output meter."
        },
        {
          "name": "cache",
          "status": "not_applicable",
          "reason": "Official guide excludes direct Images API requests for GPT-Image2/2.5 from cache prices."
        },
        {
          "name": "partial images",
          "status": "priced",
          "amount": 100,
          "unit": "additional_output_tokens_per_partial_image",
          "condition": "Must be included in measured billable output usage; do not turn100 tokens into100USD."
        }
      ]
    },
    {
      "id": "us-openai-gpt-image-2-direct-images-standard",
      "provider": "openai",
      "model": "gpt-image-2",
      "priceList": "OpenAI direct Images API / Standard / raster",
      "origin": "foreign",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "required": [
        "input",
        "input_image",
        "output"
      ],
      "cost": {
        "input": 5,
        "input_image": 8,
        "output": 30
      },
      "description": "Original USD per1M tokens. Direct /v1/images/generations or /edits, raster image output only. Text input5; image input8; image-only usage.output_tokens30 (ordinary c meter), not an assumed img_o count. The official guide expressly excludes direct Images API from cached rates for2/2.5. Resolution/quality changes token consumption, not this per-token rate. Each partial image adds100 charged output tokens. Responses tool path and SVG are excluded separately. Official model is deprecated; default snapshot gpt-image-2-2026-04-21.",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2"
      ],
      "feeDeclarations": [
        {
          "name": "text input",
          "status": "priced",
          "field": "input",
          "amount": 5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "image input",
          "status": "priced",
          "field": "input_image",
          "amount": 8,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "image output",
          "status": "priced",
          "field": "output",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD",
          "nativeUsage": "c=usage.output_tokens; input image tokens are usage.input_tokens_details.image_tokens. Do not set output_image without a separate image output meter."
        },
        {
          "name": "cache",
          "status": "not_applicable",
          "reason": "Official guide excludes direct Images API requests for GPT-Image2/2.5 from cache prices."
        },
        {
          "name": "partial images",
          "status": "priced",
          "amount": 100,
          "unit": "additional_output_tokens_per_partial_image",
          "condition": "Must be included in measured billable output usage; do not turn100 tokens into100USD."
        }
      ]
    }
  ],
  "coverage": [
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-fable-5-2",
      "quoteIds": [
        "us-anthropic-claude-fable-5-2-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/fable-5-2/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-haiku-5-5",
      "quoteIds": [
        "us-anthropic-claude-haiku-5-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/haiku-5-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-sonnet-5-5",
      "quoteIds": [
        "us-anthropic-claude-sonnet-5-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-5-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-opus-5-5",
      "quoteIds": [
        "us-anthropic-claude-opus-5-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-5-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-fable-5-1",
      "quoteIds": [
        "us-anthropic-claude-fable-5-1-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/fable-5-1/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-fable-5",
      "quoteIds": [
        "us-anthropic-claude-fable-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/fable-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-opus-5",
      "quoteIds": [
        "us-anthropic-claude-opus-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-sonnet-5",
      "quoteIds": [
        "us-anthropic-claude-sonnet-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-opus-4-8",
      "quoteIds": [
        "us-anthropic-claude-opus-4-8-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-8/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-opus-4-7",
      "quoteIds": [
        "us-anthropic-claude-opus-4-7-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-7/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-opus-4-6",
      "quoteIds": [
        "us-anthropic-claude-opus-4-6-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-6/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-sonnet-4-6",
      "quoteIds": [
        "us-anthropic-claude-sonnet-4-6-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-4-6/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-sonnet-4-5-20250929",
      "quoteIds": [
        "us-anthropic-claude-sonnet-4-5-20250929-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-sonnet-4-5",
      "quoteIds": [
        "us-anthropic-claude-sonnet-4-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/sonnet-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-opus-4-5-20251101",
      "quoteIds": [
        "us-anthropic-claude-opus-4-5-20251101-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/opus-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-haiku-4-5",
      "quoteIds": [
        "us-anthropic-claude-haiku-4-5-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/haiku-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "anthropic",
      "protocol": "anthropic",
      "model": "claude-haiku-4-5-20251001",
      "quoteIds": [
        "us-anthropic-claude-haiku-4-5-20251001-standard"
      ],
      "sourceUrls": [
        "https://platform.claude.com/docs/en/about-claude/pricing",
        "https://platform.claude.com/docs/en/models/haiku-4-5/overview",
        "https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-6.1-terra",
      "quoteIds": [
        "us-openai-gpt-6.1-terra-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6.1-terra",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-6.1-sol",
      "quoteIds": [
        "us-openai-gpt-6.1-sol-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6.1-sol",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-6-astra",
      "quoteIds": [
        "us-openai-gpt-6-astra-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6-astra",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-6-sol",
      "quoteIds": [
        "us-openai-gpt-6-sol-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6-sol",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-6-luna",
      "quoteIds": [
        "us-openai-gpt-6-luna-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-6-luna",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-5.6-sol",
      "quoteIds": [
        "us-openai-gpt-5.6-sol-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-5.6-sol",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-5.6-terra",
      "quoteIds": [
        "us-openai-gpt-5.6-terra-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-5.6-terra",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-5.6-luna",
      "quoteIds": [
        "us-openai-gpt-5.6-luna-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/models/gpt-5.6-luna",
        "https://developers.openai.com/api/docs/guides/prompt-caching"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-sunburst",
      "quoteIds": [
        "us-openai-gpt-image-2.5-sunburst-direct-images-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-flare",
      "quoteIds": [
        "us-openai-gpt-image-2.5-flare-direct-images-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.5-flare"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-sunburst-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-sunburst-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-sunburst-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-flare-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-flare-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.5-flare-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2",
      "quoteIds": [
        "us-openai-gpt-image-2-direct-images-standard"
      ],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2"
      ],
      "status": "ready",
      "reason": "Exact official model ID and full Standard model-token/cache quote verified. Conditional alternate lists/tools remain explicitly separate."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-flare",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.6-flare"
      ],
      "status": "incomplete",
      "reason": "Exact official base model and raw5-category rates verified;2.6 cache API eligibility unresolved; SVG adds separately selected author-model costs."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-sunburst",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst"
      ],
      "status": "incomplete",
      "reason": "Exact official base model and raw5-category rates verified;2.6 cache API eligibility unresolved; SVG adds separately selected author-model costs."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-flare-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-flare-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-flare-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-sunburst-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-sunburst-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "gpt-image-2.6-sunburst-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "openai",
      "protocol": "openai",
      "model": "codex-auto-review",
      "quoteIds": [],
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/agents-api/sessions/approvals",
        "https://developers.openai.com/api/docs/models/codex-auto-review"
      ],
      "status": "missing-source",
      "reason": "No exact public billable model/pricing record matched in checked official model/pricing sources. Automatic-review docs state reviewer tokens are additionally charged, but provide no exact public codex-auto-review rate; no fabricated amount."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.8-flash",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.8-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.8-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.7-flash",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.8-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.7-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit official routing gemini-3.7-flash -> gemini-3.8-flash. Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.6-flash",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.6-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.6-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.5-flash-lite",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.5-flash-lite"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-flash-lite-image",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-lite-image"
      ],
      "status": "unsupported-shape",
      "reason": "Exact official base model and raw multimodal rates verified. Native mixed text/image output split has not been proven; preserve candidateCost/exclusions and do not publish ready."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3-pro-image",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3-pro-image",
        "https://aistudio.google.com/docs/models/gemini-3-pro-image"
      ],
      "status": "unsupported-shape",
      "reason": "Exact official base model and raw multimodal rates verified. Native mixed text/image output split has not been proven; preserve candidateCost/exclusions and do not publish ready."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-flash-image",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-image"
      ],
      "status": "unsupported-shape",
      "reason": "Exact official base model and raw multimodal rates verified. Native mixed text/image output split has not been proven; preserve candidateCost/exclusions and do not publish ready."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.5-flash",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.6-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.5-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit official routing gemini-3.5-flash -> gemini-3.6-flash. Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-flash-lite",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-lite"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-pro-preview",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-pro-preview",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.1-pro-preview"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3-flash-preview",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3-flash-preview",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3-flash-preview"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-2.5-flash-image",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-flash-image",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-image"
      ],
      "status": "unsupported-shape",
      "reason": "Exact official base model and raw multimodal rates verified. Native mixed text/image output split has not been proven; preserve candidateCost/exclusions and do not publish ready."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-2.5-flash-lite",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-flash-lite",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-lite"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-2.5-pro",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-pro",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-2.5-pro"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-2.5-flash",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-flash-image-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-flash-image-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3.1-flash-image-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3-pro-image-1k",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3-pro-image-2k",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "gemini",
      "protocol": "gemini",
      "model": "gemini-3-pro-image-4k",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/image-generation"
      ],
      "status": "missing-source",
      "reason": "Exact requested resolution-suffixed ID was not matched in checked official model lists. Official APIs use a base model code plus size/image_size request configuration. Do not strip-guess the suffix or claim an official alias."
    },
    {
      "platform": "gemini-openai",
      "protocol": "openai_compatible",
      "model": "gemini-3.7-flash",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.8-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.7-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit official routing gemini-3.7-flash -> gemini-3.8-flash. Original token/cache prices verified; explicit cache token-hour storage unsupported. Audio cache rate also needs separate meter where applicable."
    },
    {
      "platform": "gemini-banana",
      "protocol": "gemini",
      "model": "nano-banana-fast",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-image",
        "https://aistudio.google.com/docs/models/gemini-3-pro-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-image"
      ],
      "status": "missing-source",
      "reason": "Requested shorthand is not an exact official model code in checked sources. Official marketing names Nano Banana/Nano Banana Pro/Nano Banana2 identify other exact gemini-* codes; no authorized crosswalk for this platform alias, so no substitution."
    },
    {
      "platform": "gemini-banana",
      "protocol": "gemini",
      "model": "nano-banana-pro",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-image",
        "https://aistudio.google.com/docs/models/gemini-3-pro-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-image"
      ],
      "status": "missing-source",
      "reason": "Requested shorthand is not an exact official model code in checked sources. Official marketing names Nano Banana/Nano Banana Pro/Nano Banana2 identify other exact gemini-* codes; no authorized crosswalk for this platform alias, so no substitution."
    },
    {
      "platform": "gemini-banana",
      "protocol": "gemini",
      "model": "nano-banana-2",
      "quoteIds": [],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-image",
        "https://aistudio.google.com/docs/models/gemini-3-pro-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-image"
      ],
      "status": "missing-source",
      "reason": "Requested shorthand is not an exact official model code in checked sources. Official marketing names Nano Banana/Nano Banana Pro/Nano Banana2 identify other exact gemini-* codes; no authorized crosswalk for this platform alias, so no substitution."
    }
  ],
  "excludedQuotes": [
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5-2",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 4.0,
        "output": 20.0,
        "cache_read": 0.1,
        "cache_write": 5.0,
        "cache_write_1h": 8.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5-2",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 8.8,
        "output": 44.0,
        "cache_read": 0.22,
        "cache_write": 11.0,
        "cache_write_1h": 17.6
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5-2",
      "priceList": "Fast / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 16.0,
        "output": 80.0,
        "cache_read": 0.4,
        "cache_write": 20.0,
        "cache_write_1h": 32.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional Fast speed. Prompt-caching multipliers apply; US-only adds another1.1x where supported; Fast does not combine with Batch. Opus5 is research preview and Opus4.8 Fast deprecated."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-haiku-5-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.05,
        "output": 0.25,
        "cache_read": 0.005,
        "cache_write": 0.0625,
        "cache_write_1h": 0.1,
        "tiers": [
          {
            "tier": {
              "size": 100000,
              "type": "input"
            },
            "input": 0.25,
            "output": 1.25,
            "cache_read": 0.025,
            "cache_write": 0.3125,
            "cache_write_1h": 0.5
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-haiku-5-5",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.11,
        "output": 0.55,
        "cache_read": 0.011,
        "cache_write": 0.1375,
        "cache_write_1h": 0.22,
        "tiers": [
          {
            "tier": {
              "size": 100000,
              "type": "input"
            },
            "input": 0.55,
            "output": 2.75,
            "cache_read": 0.055,
            "cache_write": 0.6875,
            "cache_write_1h": 1.1
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-5-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 5.0,
        "cache_read": 0.05,
        "cache_write": 1.25,
        "cache_write_1h": 2.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-5-5",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.2,
        "output": 11.0,
        "cache_read": 0.11,
        "cache_write": 2.75,
        "cache_write_1h": 4.4
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-5-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.0,
        "output": 10.0,
        "cache_read": 0.1,
        "cache_write": 2.5,
        "cache_write_1h": 4.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-5-5",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 4.4,
        "output": 22.0,
        "cache_read": 0.22,
        "cache_write": 5.5,
        "cache_write_1h": 8.8
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-5-5",
      "priceList": "Fast / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 8.0,
        "output": 40.0,
        "cache_read": 0.4,
        "cache_write": 10.0,
        "cache_write_1h": 16.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional Fast speed. Prompt-caching multipliers apply; US-only adds another1.1x where supported; Fast does not combine with Batch. Opus5 is research preview and Opus4.8 Fast deprecated."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5-1",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.0,
        "output": 25.0,
        "cache_read": 0.125,
        "cache_write": 6.25,
        "cache_write_1h": 10.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5-1",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 11.0,
        "output": 55.0,
        "cache_read": 0.275,
        "cache_write": 13.75,
        "cache_write_1h": 22.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.0,
        "output": 25.0,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_1h": 10.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-fable-5",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 11.0,
        "output": 55.0,
        "cache_read": 1.1,
        "cache_write": 13.75,
        "cache_write_1h": 22.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "output": 12.5,
        "cache_read": 0.25,
        "cache_write": 3.125,
        "cache_write_1h": 5.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-5",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.5,
        "output": 27.5,
        "cache_read": 0.55,
        "cache_write": 6.875,
        "cache_write_1h": 11.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-5",
      "priceList": "Fast / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 10.0,
        "output": 50.0,
        "cache_read": 1.0,
        "cache_write": 12.5,
        "cache_write_1h": 20.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional Fast speed. Prompt-caching multipliers apply; US-only adds another1.1x where supported; Fast does not combine with Batch. Opus5 is research preview and Opus4.8 Fast deprecated."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 5.0,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_1h": 2.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-5",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.2,
        "output": 11.0,
        "cache_read": 0.22,
        "cache_write": 2.75,
        "cache_write_1h": 4.4
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-8",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "output": 12.5,
        "cache_read": 0.25,
        "cache_write": 3.125,
        "cache_write_1h": 5.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-8",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.5,
        "output": 27.5,
        "cache_read": 0.55,
        "cache_write": 6.875,
        "cache_write_1h": 11.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-8",
      "priceList": "Fast / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 10.0,
        "output": 50.0,
        "cache_read": 1.0,
        "cache_write": 12.5,
        "cache_write_1h": 20.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional Fast speed. Prompt-caching multipliers apply; US-only adds another1.1x where supported; Fast does not combine with Batch. Opus5 is research preview and Opus4.8 Fast deprecated."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-7",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "output": 12.5,
        "cache_read": 0.25,
        "cache_write": 3.125,
        "cache_write_1h": 5.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-7",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.5,
        "output": 27.5,
        "cache_read": 0.55,
        "cache_write": 6.875,
        "cache_write_1h": 11.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-6",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "output": 12.5,
        "cache_read": 0.25,
        "cache_write": 3.125,
        "cache_write_1h": 5.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-6",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.5,
        "output": 27.5,
        "cache_read": 0.55,
        "cache_write": 6.875,
        "cache_write_1h": 11.0
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-4-6",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.5,
        "output": 7.5,
        "cache_read": 0.15,
        "cache_write": 1.875,
        "cache_write_1h": 3.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-4-6",
      "priceList": "Standard / inference_geo=us",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 3.3,
        "output": 16.5,
        "cache_read": 0.33,
        "cache_write": 4.125,
        "cache_write_1h": 6.6
      },
      "unit": "per_million_tokens",
      "reason": "Conditional US-only inference; 1.1x applies to all token categories, including high-context Haiku5.5. Global candidate must not be used for this request shape."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-4-5-20250929",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.5,
        "output": 7.5,
        "cache_read": 0.15,
        "cache_write": 1.875,
        "cache_write_1h": 3.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-sonnet-4-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.5,
        "output": 7.5,
        "cache_read": 0.15,
        "cache_write": 1.875,
        "cache_write_1h": 3.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-opus-4-5-20251101",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "output": 12.5,
        "cache_read": 0.25,
        "cache_write": 3.125,
        "cache_write_1h": 5.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-haiku-4-5",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.5,
        "output": 2.5,
        "cache_read": 0.05,
        "cache_write": 0.625,
        "cache_write_1h": 1.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "anthropic",
      "officialModel": "claude-haiku-4-5-20251001",
      "priceList": "Batch / global",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.5,
        "output": 2.5,
        "cache_read": 0.05,
        "cache_write": 0.625,
        "cache_write_1h": 1.0
      },
      "unit": "per_million_tokens",
      "reason": "Separate explicitly selected asynchronous Batch list; not selected by this Standard candidate. Official caching multipliers stack with Batch discount."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-terra",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.5,
        "output": 2.5,
        "cache_read": 0.025,
        "cache_write": 0.625,
        "cache_write_12h": 1.25,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 1.0,
            "output": 3.75,
            "cache_read": 0.05,
            "cache_write": 1.25,
            "cache_write_12h": 2.5
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-terra",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.5,
        "output": 2.5,
        "cache_read": 0.025,
        "cache_write": 0.625,
        "cache_write_12h": 1.25,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 1.0,
            "output": 3.75,
            "cache_read": 0.05,
            "cache_write": 1.25,
            "cache_write_12h": 2.5
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-terra",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.0,
        "output": 10.0,
        "cache_read": 0.1,
        "cache_write": 2.5,
        "cache_write_12h": 5.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 4.0,
            "output": 15.0,
            "cache_read": 0.2,
            "cache_write": 5.0,
            "cache_write_12h": 10.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-sol",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 5.0,
        "cache_read": 0.05,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 7.5,
            "cache_read": 0.1,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-sol",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 5.0,
        "cache_read": 0.05,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 7.5,
            "cache_read": 0.1,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-sol",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 4.0,
        "output": 20.0,
        "cache_read": 0.2,
        "cache_write": 5.0,
        "cache_write_12h": 10.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 8.0,
            "output": 30.0,
            "cache_read": 0.4,
            "cache_write": 10.0,
            "cache_write_12h": 20.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6.1-sol",
      "priceList": "Ultrafast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 12.0,
        "output": 60.0,
        "cache_read": 0.6,
        "cache_write": 15.0,
        "cache_write_12h": 30.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 24.0,
            "output": 90.0,
            "cache_read": 1.2,
            "cache_write": 30.0,
            "cache_write_12h": 60.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-astra",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.0,
        "output": 25.0,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_12h": 12.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 10.0,
            "output": 37.5,
            "cache_read": 1.0,
            "cache_write": 12.5,
            "cache_write_12h": 25.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-astra",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5.0,
        "output": 25.0,
        "cache_read": 0.5,
        "cache_write": 6.25,
        "cache_write_12h": 12.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 10.0,
            "output": 37.5,
            "cache_read": 1.0,
            "cache_write": 12.5,
            "cache_write_12h": 25.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-astra",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 20.0,
        "output": 100.0,
        "cache_read": 2.0,
        "cache_write": 25.0,
        "cache_write_12h": 50.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 40.0,
            "output": 150.0,
            "cache_read": 4.0,
            "cache_write": 50.0,
            "cache_write_12h": 100.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-astra",
      "priceList": "Ultrafast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 60.0,
        "output": 300.0,
        "cache_read": 6.0,
        "cache_write": 75.0,
        "cache_write_12h": 150.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 120.0,
            "output": 450.0,
            "cache_read": 12.0,
            "cache_write": 150.0,
            "cache_write_12h": 300.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-sol",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 5.0,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 7.5,
            "cache_read": 0.2,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-sol",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 5.0,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 7.5,
            "cache_read": 0.2,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-sol",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 4.0,
        "output": 20.0,
        "cache_read": 0.4,
        "cache_write": 5.0,
        "cache_write_12h": 10.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 8.0,
            "output": 30.0,
            "cache_read": 0.8,
            "cache_write": 10.0,
            "cache_write_12h": 20.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-luna",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.05,
        "output": 0.25,
        "cache_read": 0.005,
        "cache_write": 0.0625,
        "cache_write_12h": 0.125,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.1,
            "output": 0.375,
            "cache_read": 0.01,
            "cache_write": 0.125,
            "cache_write_12h": 0.25
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-luna",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.05,
        "output": 0.25,
        "cache_read": 0.005,
        "cache_write": 0.0625,
        "cache_write_12h": 0.125,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.1,
            "output": 0.375,
            "cache_read": 0.01,
            "cache_write": 0.125,
            "cache_write_12h": 0.25
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-6-luna",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.2,
        "output": 1.0,
        "cache_read": 0.02,
        "cache_write": 0.25,
        "cache_write_12h": 0.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.4,
            "output": 1.5,
            "cache_read": 0.04,
            "cache_write": 0.5,
            "cache_write_12h": 1.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-sol",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.0,
        "output": 10.0,
        "cache_read": 0.2,
        "cache_write": 2.5,
        "cache_write_12h": 5.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 4.0,
            "output": 15.0,
            "cache_read": 0.4,
            "cache_write": 5.0,
            "cache_write_12h": 10.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-sol",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.0,
        "output": 10.0,
        "cache_read": 0.2,
        "cache_write": 2.5,
        "cache_write_12h": 5.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 4.0,
            "output": 15.0,
            "cache_read": 0.4,
            "cache_write": 5.0,
            "cache_write_12h": 10.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-sol",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 8.0,
        "output": 40.0,
        "cache_read": 0.8,
        "cache_write": 10.0,
        "cache_write_12h": 20.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 16.0,
            "output": 60.0,
            "cache_read": 1.6,
            "cache_write": 20.0,
            "cache_write_12h": 40.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-terra",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 6.0,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 9.0,
            "cache_read": 0.2,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-terra",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 1.0,
        "output": 6.0,
        "cache_read": 0.1,
        "cache_write": 1.25,
        "cache_write_12h": 2.5,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 2.0,
            "output": 9.0,
            "cache_read": 0.2,
            "cache_write": 2.5,
            "cache_write_12h": 5.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-terra",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 4.0,
        "output": 24.0,
        "cache_read": 0.4,
        "cache_write": 5.0,
        "cache_write_12h": 10.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 8.0,
            "output": 36.0,
            "cache_read": 0.8,
            "cache_write": 10.0,
            "cache_write_12h": 20.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-luna",
      "priceList": "Batch",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.1,
        "output": 0.6,
        "cache_read": 0.01,
        "cache_write": 0.125,
        "cache_write_12h": 0.25,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.2,
            "output": 0.9,
            "cache_read": 0.02,
            "cache_write": 0.25,
            "cache_write_12h": 0.5
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-luna",
      "priceList": "Flex",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.1,
        "output": 0.6,
        "cache_read": 0.01,
        "cache_write": 0.125,
        "cache_write_12h": 0.25,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.2,
            "output": 0.9,
            "cache_read": 0.02,
            "cache_write": 0.25,
            "cache_write_12h": 0.5
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-5.6-luna",
      "priceList": "Fast",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 0.4,
        "output": 2.4,
        "cache_read": 0.04,
        "cache_write": 0.5,
        "cache_write_12h": 1.0,
        "tiers": [
          {
            "tier": {
              "size": 272000,
              "type": "input"
            },
            "input": 0.8,
            "output": 3.6,
            "cache_read": 0.08,
            "cache_write": 1.0,
            "cache_write_12h": 2.0
          }
        ]
      },
      "unit": "per_million_tokens",
      "reason": "Different service tier, must be selected explicitly; original prices preserve both context bands and30m/12h writes. Regional-processing/FedRAMP endpoint adds10% where eligible; eligibility must not be guessed."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.5-sunburst",
      "priceList": "Standard / image-token price list",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5,
        "cache_read": 1.25,
        "input_image": 8,
        "cache_read_image": 2,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.5-sunburst"
      ],
      "fees": [
        {
          "name": "partial-image output",
          "amount": 100,
          "unit": "additional_image_output_tokens_per_partial_image",
          "currency": "USD",
          "condition": "Streaming partial_images adds100 image-output tokens per partial image, charged at output-image rate.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "identityNote": "Base model code is official; resolution is a request setting, not a model-code suffix.",
      "status": "unsupported-shape",
      "reason": "This raw Standard cache-inclusive price list applies to the Responses image-generation tool, which also bills the mainline model. Official guide says cached generation inputs affect billing but cached counts are absent from Responses output, so native usage cannot reconstruct cache costs. Do not silently apply cached rates to direct Images API."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.5-sunburst",
      "priceList": "Batch image prices",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "cache_read": 0.625,
        "input_image": 4.0,
        "cache_read_image": 1.0,
        "output_image": 15.0
      },
      "unit": "per_million_tokens",
      "status": "unsupported-shape",
      "reason": "Published Batch rates retained as raw evidence.2.6 model pages say Batch unsupported despite pricing table;2/2.5 cached image usage still not observable in Responses. Endpoint and mode proof required before execution."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.5-flare",
      "priceList": "Standard / image-token price list",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5,
        "cache_read": 1.25,
        "input_image": 8,
        "cache_read_image": 2,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.5-flare"
      ],
      "fees": [
        {
          "name": "partial-image output",
          "amount": 100,
          "unit": "additional_image_output_tokens_per_partial_image",
          "currency": "USD",
          "condition": "Streaming partial_images adds100 image-output tokens per partial image, charged at output-image rate.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "identityNote": "Base model code is official; resolution is a request setting, not a model-code suffix.",
      "status": "unsupported-shape",
      "reason": "This raw Standard cache-inclusive price list applies to the Responses image-generation tool, which also bills the mainline model. Official guide says cached generation inputs affect billing but cached counts are absent from Responses output, so native usage cannot reconstruct cache costs. Do not silently apply cached rates to direct Images API."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.5-flare",
      "priceList": "Batch image prices",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "cache_read": 0.625,
        "input_image": 4.0,
        "cache_read_image": 1.0,
        "output_image": 15.0
      },
      "unit": "per_million_tokens",
      "status": "unsupported-shape",
      "reason": "Published Batch rates retained as raw evidence.2.6 model pages say Batch unsupported despite pricing table;2/2.5 cached image usage still not observable in Responses. Endpoint and mode proof required before execution."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2",
      "priceList": "Standard / image-token price list",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5,
        "cache_read": 1.25,
        "input_image": 8,
        "cache_read_image": 2,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2"
      ],
      "fees": [
        {
          "name": "partial-image output",
          "amount": 100,
          "unit": "additional_image_output_tokens_per_partial_image",
          "currency": "USD",
          "condition": "Streaming partial_images adds100 image-output tokens per partial image, charged at output-image rate.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "identityNote": "Base model code is official; resolution is a request setting, not a model-code suffix.",
      "status": "unsupported-shape",
      "reason": "This raw Standard cache-inclusive price list applies to the Responses image-generation tool, which also bills the mainline model. Official guide says cached generation inputs affect billing but cached counts are absent from Responses output, so native usage cannot reconstruct cache costs. Do not silently apply cached rates to direct Images API."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2",
      "priceList": "Batch image prices",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "cache_read": 0.625,
        "input_image": 4.0,
        "cache_read_image": 1.0,
        "output_image": 15.0
      },
      "unit": "per_million_tokens",
      "status": "unsupported-shape",
      "reason": "Published Batch rates retained as raw evidence.2.6 model pages say Batch unsupported despite pricing table;2/2.5 cached image usage still not observable in Responses. Endpoint and mode proof required before execution."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.6-flare",
      "priceList": "Standard / image-token price list",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5,
        "cache_read": 1.25,
        "input_image": 8,
        "cache_read_image": 2,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.6-flare"
      ],
      "fees": [
        {
          "name": "partial-image output",
          "amount": 100,
          "unit": "additional_image_output_tokens_per_partial_image",
          "currency": "USD",
          "condition": "Streaming partial_images adds100 image-output tokens per partial image, charged at output-image rate.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "text input",
          "amount": 5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cached text input",
          "amount": 1.25,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Published rate; exact API eligibility not established for2.6."
        },
        {
          "name": "image input",
          "amount": 8,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cached image input",
          "amount": 2,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Published rate; exact API eligibility not established for2.6."
        },
        {
          "name": "image output",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "SVG authoring",
          "amount": null,
          "unit": "selected_author_model_token_rates",
          "currency": "USD",
          "condition": "SVG requires reference-image generation plus chosen author-model tokens; svg_usage is separate from rendering usage. Cannot price unknown author model as free.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "identityNote": "Base model code is official; resolution is a request setting, not a model-code suffix.",
      "status": "incomplete",
      "reason": "Published cache rates exist but the fetched model page only supports Images API and the guide cache eligibility clause names2/2.5, not2.6.2.6 also supports SVG authoring charged to a second selected text model, with separate svg_usage. Do not declare a universal complete image quote or silently assume2.5 cache behavior."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.6-flare",
      "priceList": "Batch image prices",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "cache_read": 0.625,
        "input_image": 4.0,
        "cache_read_image": 1.0,
        "output_image": 15.0
      },
      "unit": "per_million_tokens",
      "status": "incomplete",
      "reason": "Published Batch rates retained as raw evidence.2.6 model pages say Batch unsupported despite pricing table;2/2.5 cached image usage still not observable in Responses. Endpoint and mode proof required before execution."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.6-sunburst",
      "priceList": "Standard / image-token price list",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 5,
        "cache_read": 1.25,
        "input_image": 8,
        "cache_read_image": 2,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://developers.openai.com/api/docs/pricing",
        "https://developers.openai.com/api/docs/guides/image-generation",
        "https://developers.openai.com/api/docs/models/gpt-image-2.6-sunburst"
      ],
      "fees": [
        {
          "name": "partial-image output",
          "amount": 100,
          "unit": "additional_image_output_tokens_per_partial_image",
          "currency": "USD",
          "condition": "Streaming partial_images adds100 image-output tokens per partial image, charged at output-image rate.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "text input",
          "amount": 5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cached text input",
          "amount": 1.25,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Published rate; exact API eligibility not established for2.6."
        },
        {
          "name": "image input",
          "amount": 8,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cached image input",
          "amount": 2,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Published rate; exact API eligibility not established for2.6."
        },
        {
          "name": "image output",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "SVG authoring",
          "amount": null,
          "unit": "selected_author_model_token_rates",
          "currency": "USD",
          "condition": "SVG requires reference-image generation plus chosen author-model tokens; svg_usage is separate from rendering usage. Cannot price unknown author model as free.",
          "source": {
            "url": "https://developers.openai.com/api/docs/guides/image-generation",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "identityNote": "Base model code is official; resolution is a request setting, not a model-code suffix.",
      "status": "incomplete",
      "reason": "Published cache rates exist but the fetched model page only supports Images API and the guide cache eligibility clause names2/2.5, not2.6.2.6 also supports SVG authoring charged to a second selected text model, with separate svg_usage. Do not declare a universal complete image quote or silently assume2.5 cache behavior."
    },
    {
      "provider": "openai",
      "officialModel": "gpt-image-2.6-sunburst",
      "priceList": "Batch image prices",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing",
        "checkedAt": "2026-11-16"
      },
      "cost": {
        "input": 2.5,
        "cache_read": 0.625,
        "input_image": 4.0,
        "cache_read_image": 1.0,
        "output_image": 15.0
      },
      "unit": "per_million_tokens",
      "status": "incomplete",
      "reason": "Published Batch rates retained as raw evidence.2.6 model pages say Batch unsupported despite pricing table;2/2.5 cached image usage still not observable in Responses. Endpoint and mode proof required before execution."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.8-flash",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.8-flash",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.75,
        "output": 3.75,
        "cache_read": 0.075,
        "storage": 0.5,
        "expires": "2026-12-31",
        "next": {
          "input": 1.5,
          "output": 7.5,
          "cache_read": 0.15,
          "storage": 1
        }
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.75,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 3.75,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.075,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 0.5,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.8-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.8-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated. Promotional token and storage rates expire2026-12-31; future rates retained in raw.next, not activated now.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.375,
          "output": 1.875,
          "cache_read": 0.0375,
          "storage": 0.5,
          "validThrough": "2026-12-31",
          "next": {
            "input": 0.75,
            "output": 3.75,
            "cache_read": 0.075,
            "storage": 1.0
          }
        },
        "Flex": {
          "input": 0.375,
          "output": 1.875,
          "cache_read": 0.0375,
          "storage": 0.5,
          "validThrough": "2026-12-31",
          "next": {
            "input": 0.75,
            "output": 3.75,
            "cache_read": 0.075,
            "storage": 1.0
          }
        },
        "Priority": {
          "input": 1.35,
          "output": 6.75,
          "cache_read": 0.135,
          "storage": 0.5,
          "validThrough": "2026-12-31",
          "next": {
            "input": 2.7,
            "output": 13.5,
            "cache_read": 0.27,
            "storage": 1.0
          }
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.6-flash",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.6-flash",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.75,
        "output": 3.75,
        "cache_read": 0.075,
        "storage": 0.5,
        "expires": "2026-12-31",
        "next": {
          "input": 1.5,
          "output": 7.5,
          "cache_read": 0.15,
          "storage": 1
        }
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.75,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 3.75,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.075,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 0.5,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.6-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.6-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated. Promotional token and storage rates expire2026-12-31; future rates retained in raw.next, not activated now.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.375,
          "output": 1.875,
          "cache_read": 0.0375,
          "storage": 0.5,
          "validThrough": "2026-12-31",
          "next": {
            "input": 0.75,
            "output": 3.75,
            "cache_read": 0.075,
            "storage": 1.0
          }
        },
        "Flex": {
          "input": 0.375,
          "output": 1.875,
          "cache_read": 0.0375,
          "storage": 0.5,
          "validThrough": "2026-12-31",
          "next": {
            "input": 0.75,
            "output": 3.75,
            "cache_read": 0.075,
            "storage": 1.0
          }
        },
        "Priority": {
          "input": 1.35,
          "output": 6.75,
          "cache_read": 0.135,
          "storage": 0.5,
          "validThrough": "2026-12-31",
          "next": {
            "input": 2.7,
            "output": 13.5,
            "cache_read": 0.27,
            "storage": 1.0
          }
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.5-flash-lite",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.3,
        "input_audio": 0.3,
        "output": 2.5,
        "cache_read": 0.03,
        "cache_read_audio": 0.03,
        "storage": 1
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_audio",
          "amount": 0.3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 2.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.03,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read_audio",
          "amount": 0.03,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 1,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.5-flash-lite",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.5-flash-lite"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.15,
          "input_audio": 0.15,
          "output": 1.25,
          "cache_read": 0.015,
          "storage": 1
        },
        "Flex": {
          "input": 0.15,
          "input_audio": 0.15,
          "output": 1.25,
          "cache_read": 0.02,
          "storage": 1
        },
        "Priority": {
          "input": 0.54,
          "input_audio": 0.54,
          "output": 4.5,
          "cache_read": 0.05,
          "storage": 1
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.1-flash-lite",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.25,
        "input_audio": 0.5,
        "output": 1.5,
        "cache_read": 0.025,
        "cache_read_audio": 0.05,
        "storage": 1
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.25,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_audio",
          "amount": 0.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 1.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.025,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read_audio",
          "amount": 0.05,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 1,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-lite"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.125,
          "input_audio": 0.25,
          "output": 0.75,
          "cache_read": 0.0125,
          "cache_read_audio": 0.025,
          "storage": 0.5
        },
        "Flex": {
          "input": 0.125,
          "input_audio": 0.25,
          "output": 0.75,
          "cache_read": 0.0125,
          "cache_read_audio": 0.025,
          "storage": 0.5
        },
        "Priority": {
          "input": 0.45,
          "input_audio": 0.9,
          "output": 2.7,
          "cache_read": 0.045,
          "cache_read_audio": 0.09,
          "storage": 1.8
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.1-pro-preview",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.1-pro-preview",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 2,
        "output": 12,
        "cache_read": 0.2,
        "storage": 4.5,
        "tiers": [
          {
            "above": 200000,
            "input": 4,
            "output": 18,
            "cache_read": 0.4
          }
        ]
      },
      "fees": [
        {
          "name": "input",
          "amount": 2,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 12,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.2,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 4.5,
          "unit": "per_million_token_hours",
          "currency": "USD"
        },
        {
          "name": "input",
          "amount": 4,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Entire request prompt >200000 input tokens."
        },
        {
          "name": "output",
          "amount": 18,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Entire request prompt >200000 input tokens."
        },
        {
          "name": "cache_read",
          "amount": 0.4,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Entire request prompt >200000 input tokens."
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-pro-preview",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3.1-pro-preview"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated.",
      "otherPaidTiers": {
        "Batch": {
          "input": 1,
          "output": 6,
          "cache_read": 0.2,
          "storage": 4.5,
          "tiers": [
            {
              "above": 200000,
              "input": 2,
              "output": 9,
              "cache_read": 0.4
            }
          ]
        },
        "Flex": {
          "input": 1,
          "output": 6,
          "cache_read": 0.2,
          "storage": 4.5,
          "tiers": [
            {
              "above": 200000,
              "input": 2,
              "output": 9,
              "cache_read": 0.4
            }
          ]
        },
        "Priority": {
          "input": 3.6,
          "output": 21.6,
          "cache_read": 0.36,
          "storage": 8.1,
          "tiers": [
            {
              "above": 200000,
              "input": 7.2,
              "output": 32.4,
              "cache_read": 0.72
            }
          ]
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3-flash-preview",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3-flash-preview",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.5,
        "input_audio": 1,
        "output": 3,
        "cache_read": 0.05,
        "cache_read_audio": 0.1,
        "storage": 1
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_audio",
          "amount": 1,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.05,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read_audio",
          "amount": 0.1,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 1,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3-flash-preview",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-3-flash-preview"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.25,
          "input_audio": 0.5,
          "output": 1.5,
          "cache_read": 0.05,
          "cache_read_audio": 0.1,
          "storage": 1
        },
        "Flex": {
          "input": 0.25,
          "input_audio": 0.5,
          "output": 1.5,
          "cache_read": 0.05,
          "cache_read_audio": 0.1,
          "storage": 1
        },
        "Priority": {
          "input": 0.9,
          "input_audio": 1.8,
          "output": 5.4,
          "cache_read": 0.09,
          "cache_read_audio": 0.18,
          "storage": 1.8
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-2.5-flash-lite",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-2.5-flash-lite",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.1,
        "input_audio": 0.3,
        "output": 0.4,
        "cache_read": 0.01,
        "cache_read_audio": 0.03,
        "storage": 1
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.1,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_audio",
          "amount": 0.3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 0.4,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.01,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read_audio",
          "amount": 0.03,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 1,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 35,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500 daily free; Flash and Flash-Lite allowance shared.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 25,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500 daily free for Flash/Flash-Lite.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-flash-lite",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-lite"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.05,
          "input_audio": 0.15,
          "output": 0.2,
          "cache_read": 0.01,
          "cache_read_audio": 0.03,
          "storage": 1
        },
        "Flex": {
          "input": 0.05,
          "input_audio": 0.15,
          "output": 0.2,
          "cache_read": 0.01,
          "cache_read_audio": 0.03,
          "storage": 1
        },
        "Priority": {
          "input": 0.18,
          "input_audio": 0.54,
          "output": 0.72,
          "cache_read": 0.018,
          "cache_read_audio": 0.054,
          "storage": 1.8
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-2.5-pro",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-2.5-pro",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 1.25,
        "output": 10,
        "cache_read": 0.125,
        "storage": 4.5,
        "tiers": [
          {
            "above": 200000,
            "input": 2.5,
            "output": 15,
            "cache_read": 0.25
          }
        ],
        "redirectAfter": "2026-12-01",
        "redirectModel": "gemini-3.8-flash"
      },
      "fees": [
        {
          "name": "input",
          "amount": 1.25,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 10,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.125,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 4.5,
          "unit": "per_million_token_hours",
          "currency": "USD"
        },
        {
          "name": "input",
          "amount": 2.5,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Entire request prompt >200000 input tokens."
        },
        {
          "name": "output",
          "amount": 15,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Entire request prompt >200000 input tokens."
        },
        {
          "name": "cache_read",
          "amount": 0.25,
          "unit": "per_million_tokens",
          "currency": "USD",
          "condition": "Entire request prompt >200000 input tokens."
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 35,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500 daily free; Flash and Flash-Lite allowance shared.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 25,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First10000 daily free for Pro.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-pro",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-2.5-pro"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated. Checked-date prices apply before2026-12-01; official future rerouting retained, no early substitution.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.625,
          "output": 5,
          "cache_read": 0.125,
          "storage": 4.5,
          "tiers": [
            {
              "above": 200000,
              "input": 1.25,
              "output": 7.5,
              "cache_read": 0.25
            }
          ]
        },
        "Flex": {
          "input": 0.625,
          "output": 5,
          "cache_read": 0.125,
          "storage": 4.5,
          "tiers": [
            {
              "above": 200000,
              "input": 1.25,
              "output": 7.5,
              "cache_read": 0.25
            }
          ]
        },
        "Priority": {
          "input": 2.25,
          "output": 18,
          "cache_read": 0.225,
          "storage": 8.1,
          "tiers": [
            {
              "above": 200000,
              "input": 4.5,
              "output": 27,
              "cache_read": 0.45
            }
          ]
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-2.5-flash",
      "priceList": "Gemini Developer API / paid Standard",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-2.5-flash",
        "checkedAt": "2026-11-16"
      },
      "raw": {
        "input": 0.3,
        "input_audio": 1,
        "output": 2.5,
        "cache_read": 0.03,
        "cache_read_audio": 0.1,
        "storage": 1,
        "redirectAfter": "2026-12-01",
        "redirectModel": "gemini-3.5-flash-lite"
      },
      "fees": [
        {
          "name": "input",
          "amount": 0.3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_audio",
          "amount": 1,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 2.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read",
          "amount": 0.03,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "cache_read_audio",
          "amount": 0.1,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "storage",
          "amount": 1,
          "unit": "per_million_token_hours",
          "currency": "USD"
        }
      ],
      "tools": [
        {
          "name": "Google Search",
          "amount": 35,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500 daily free; Flash and Flash-Lite allowance shared.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 25,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500 daily free for Flash/Flash-Lite.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-flash",
        "https://aistudio.google.com/docs/caching?generate-content=true",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Explicit cache storage charges per million-token-hour are published but existing ModelCost/native task/tool schema has no storage-duration meter. No cache_read_audio family exists either where audio cache differs. Preserve raw fees; do not fake storage as a one-off cache_write or omit it and declare complete. Output includes thinking tokens. No standalone cache-write price published; ordinary input processing plus stored-duration/read billing must not be conflated. Checked-date prices apply before2026-12-01; official future rerouting retained, no early substitution.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.15,
          "input_audio": 0.5,
          "output": 1.25,
          "cache_read": 0.03,
          "cache_read_audio": 0.1,
          "storage": 1
        },
        "Flex": {
          "input": 0.15,
          "input_audio": 0.5,
          "output": 1.25,
          "cache_read": 0.03,
          "cache_read_audio": 0.1,
          "storage": 1
        },
        "Priority": {
          "input": 0.54,
          "input_audio": 1.8,
          "output": 4.5,
          "cache_read": 0.054,
          "cache_read_audio": 0.18,
          "storage": 1.8
        }
      },
      "otherTierUnits": {
        "input": "per_million_tokens",
        "input_audio": "per_million_tokens",
        "output": "per_million_tokens",
        "cache_read": "per_million_tokens",
        "cache_read_audio": "per_million_tokens",
        "storage": "per_million_token_hours"
      },
      "toolCondition": "Grounding availability differs by service tier:2.5 Batch/Flex Maps unavailable; Google3.8 Batch/Flex table does not offer grounding. Retain model/tool capability proof; no universal tool allowance."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.7-flash",
      "priceList": "Official deprecated routed model",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/models/gemini-3.7-flash",
        "checkedAt": "2026-11-16"
      },
      "routedOfficialModel": "gemini-3.8-flash",
      "routedRawStandard": {
        "input": 0.75,
        "output": 3.75,
        "cache_read": 0.075,
        "storage": 0.5,
        "expires": "2026-12-31",
        "next": {
          "input": 1.5,
          "output": 7.5,
          "cache_read": 0.15,
          "storage": 1
        }
      },
      "sourceUrls": [
        "https://aistudio.google.com/docs/models/gemini-3.7-flash",
        "https://aistudio.google.com/docs/pricing#gemini-3.8-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Official model notice explicitly routes this ID togemini-3.8-flash. No own current price row; routed model original prices retained with an explicit crosswalk. Same token-hour limitation as routed model; no fabricated independent quote."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.5-flash",
      "priceList": "Official deprecated routed model",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/models/gemini-3.5-flash",
        "checkedAt": "2026-11-16"
      },
      "routedOfficialModel": "gemini-3.6-flash",
      "routedRawStandard": {
        "input": 0.75,
        "output": 3.75,
        "cache_read": 0.075,
        "storage": 0.5,
        "expires": "2026-12-31",
        "next": {
          "input": 1.5,
          "output": 7.5,
          "cache_read": 0.15,
          "storage": 1
        }
      },
      "sourceUrls": [
        "https://aistudio.google.com/docs/models/gemini-3.5-flash",
        "https://aistudio.google.com/docs/pricing#gemini-3.6-flash"
      ],
      "status": "unsupported-shape",
      "reason": "Official model notice explicitly routes this ID togemini-3.6-flash. No own current price row; routed model original prices retained with an explicit crosswalk. Same token-hour limitation as routed model; no fabricated independent quote."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.1-flash-lite-image",
      "priceList": "Gemini Developer API / paid Standard / image generation",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite-image",
        "checkedAt": "2026-11-16"
      },
      "candidateCost": {
        "input": 0.25,
        "input_image": 0.25,
        "output": 1.5,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-lite-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-lite-image"
      ],
      "imageOutputEquivalents": [
        {
          "resolution": "1K",
          "outputTokens": 1120,
          "publishedApproxUSD": 0.0336
        }
      ],
      "fees": [
        {
          "name": "input",
          "amount": 0.25,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_image",
          "amount": 0.25,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 1.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output_image",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD"
        }
      ],
      "cache": {
        "status": "not_applicable",
        "reason": "Exact official model page marks Context caching not supported; no cache price invented."
      },
      "tools": [],
      "status": "unsupported-shape",
      "reason": "Original rates are verified; mixed text+image output requires native usage modality split before executable cost is ready. c must count only text/thinking output and img_o only image output, without double counting candidatesTokenCount. Existing generic task schema has no Gemini-image binding. Do not replace token pricing with rounded per-image estimates or silently price image tokens as text.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.125,
          "input_image": 0.125,
          "output": 0.75,
          "output_image": 15.0
        }
      },
      "resolutionNote": "Only1K is supported;2K/4K explicitly unsupported."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3-pro-image",
      "priceList": "Gemini Developer API / paid Standard / image generation",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3-pro-image",
        "checkedAt": "2026-11-16"
      },
      "candidateCost": {
        "input": 2,
        "input_image": 2,
        "output": 12,
        "output_image": 120
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3-pro-image",
        "https://aistudio.google.com/docs/models/gemini-3-pro-image"
      ],
      "imageOutputEquivalents": [
        {
          "resolution": "1K/2K",
          "outputTokens": 1120,
          "publishedApproxUSD": 0.134
        },
        {
          "resolution": "4K",
          "outputTokens": 2000,
          "publishedApproxUSD": 0.24
        }
      ],
      "fees": [
        {
          "name": "input",
          "amount": 2,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_image",
          "amount": 2,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 12,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output_image",
          "amount": 120,
          "unit": "per_million_tokens",
          "currency": "USD"
        }
      ],
      "cache": {
        "status": "not_applicable",
        "reason": "Exact official model page marks Context caching not supported; no cache price invented."
      },
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "status": "unsupported-shape",
      "reason": "Original rates are verified; mixed text+image output requires native usage modality split before executable cost is ready. c must count only text/thinking output and img_o only image output, without double counting candidatesTokenCount. Existing generic task schema has no Gemini-image binding. Do not replace token pricing with rounded per-image estimates or silently price image tokens as text.",
      "inputImageEquivalent": {
        "tokens": 560,
        "publishedApproxUSD": 0.0011
      },
      "contextNote": "Input limit65,536, so the>200K text-model tier referenced by generic Pro pricing is unreachable."
    },
    {
      "provider": "google",
      "officialModel": "gemini-3.1-flash-image",
      "priceList": "Gemini Developer API / paid Standard / image generation",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-image",
        "checkedAt": "2026-11-16"
      },
      "candidateCost": {
        "input": 0.5,
        "input_image": 0.5,
        "output": 3,
        "output_image": 60
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-3.1-flash-image",
        "https://aistudio.google.com/docs/models/gemini-3.1-flash-image"
      ],
      "imageOutputEquivalents": [
        {
          "resolution": "0.5K",
          "outputTokens": 747,
          "publishedApproxUSD": 0.045
        },
        {
          "resolution": "1K",
          "outputTokens": 1120,
          "publishedApproxUSD": 0.067
        },
        {
          "resolution": "2K",
          "outputTokens": 1680,
          "publishedApproxUSD": 0.101
        },
        {
          "resolution": "4K",
          "outputTokens": 2520,
          "publishedApproxUSD": 0.151
        }
      ],
      "fees": [
        {
          "name": "input",
          "amount": 0.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_image",
          "amount": 0.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output_image",
          "amount": 60,
          "unit": "per_million_tokens",
          "currency": "USD"
        }
      ],
      "cache": {
        "status": "not_applicable",
        "reason": "Exact official model page marks Context caching not supported; no cache price invented."
      },
      "tools": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        }
      ],
      "status": "unsupported-shape",
      "reason": "Original rates are verified; mixed text+image output requires native usage modality split before executable cost is ready. c must count only text/thinking output and img_o only image output, without double counting candidatesTokenCount. Existing generic task schema has no Gemini-image binding. Do not replace token pricing with rounded per-image estimates or silently price image tokens as text."
    },
    {
      "provider": "google",
      "officialModel": "gemini-2.5-flash-image",
      "priceList": "Gemini Developer API / paid Standard / image generation",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#gemini-2.5-flash-image",
        "checkedAt": "2026-11-16"
      },
      "candidateCost": {
        "input": 0.3,
        "input_image": 0.3,
        "output": 2.5,
        "output_image": 30
      },
      "unit": "per_million_tokens",
      "sourceUrls": [
        "https://aistudio.google.com/docs/pricing#gemini-2.5-flash-image",
        "https://aistudio.google.com/docs/models/gemini-2.5-flash-image"
      ],
      "imageOutputEquivalents": [
        {
          "resolution": "up to1024x1024",
          "outputTokens": 1290,
          "publishedApproxUSD": 0.039
        }
      ],
      "fees": [
        {
          "name": "input",
          "amount": 0.3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "input_image",
          "amount": 0.3,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output",
          "amount": 2.5,
          "unit": "per_million_tokens",
          "currency": "USD"
        },
        {
          "name": "output_image",
          "amount": 30,
          "unit": "per_million_tokens",
          "currency": "USD"
        }
      ],
      "cache": {
        "status": "not_applicable",
        "reason": "Exact official model page marks Context caching not supported; no cache price invented."
      },
      "tools": [],
      "status": "unsupported-shape",
      "reason": "Original rates are verified; mixed text+image output requires native usage modality split before executable cost is ready. c must count only text/thinking output and img_o only image output, without double counting candidatesTokenCount. Existing generic task schema has no Gemini-image binding. Do not replace token pricing with rounded per-image estimates or silently price image tokens as text.",
      "otherPaidTiers": {
        "Batch": {
          "input": 0.15,
          "input_image": 0.15,
          "output": 1.25,
          "output_image": 15.0
        },
        "Flex": {
          "input": 0.15,
          "input_image": 0.15,
          "output": 1.25,
          "output_image": 15.0
        },
        "Priority": {
          "input": 0.54,
          "input_image": 0.54,
          "output": 4.5,
          "output_image": 54.0
        }
      },
      "lifecycle": "Deprecated; announced shutdown2027-03-15. Published0.039/image is rounded:1290*30/1e6=0.0387; do not treat both as additive fees."
    },
    {
      "provider": "anthropic",
      "officialModel": "Claude API tools",
      "quoteGroup": "anthropic-conditional-tools",
      "currency": "USD",
      "source": {
        "url": "https://platform.claude.com/docs/en/about-claude/pricing#specific-tool-pricing",
        "checkedAt": "2026-11-16"
      },
      "fees": [
        {
          "name": "web_search",
          "amount": 10,
          "unit": "per_thousand_searches",
          "currency": "USD",
          "condition": "Plus model tokens for retrieved content; failed searches not billed."
        },
        {
          "name": "web_fetch",
          "amount": 0,
          "unit": "additional_per_call",
          "currency": "USD",
          "condition": "Fetched content still billed at model input-token rate."
        },
        {
          "name": "code_execution",
          "amount": 0.05,
          "unit": "per_container_hour",
          "currency": "USD",
          "condition": "First1550 organization-hours/month free;5-minute minimum. Free beyond model tokens if web_search_20260209+ or web_fetch_20260209+ is included."
        }
      ],
      "reason": "web_search has a native meter; web_fetch and container-hour allowances are not declared native meters. Preserve explicit free conditional fee; tool definitions/results remain token-billed."
    },
    {
      "provider": "openai",
      "officialModel": "OpenAI built-in tools",
      "quoteGroup": "openai-conditional-tools",
      "currency": "USD",
      "source": {
        "url": "https://developers.openai.com/api/docs/pricing#built-in-tools",
        "checkedAt": "2026-11-16"
      },
      "fees": [
        {
          "name": "web_search",
          "amount": 10,
          "unit": "per_thousand_calls",
          "currency": "USD",
          "condition": "Search content additionally token-billed."
        },
        {
          "name": "web_search_preview reasoning",
          "amount": 10,
          "unit": "per_thousand_calls",
          "currency": "USD",
          "condition": "Search content additionally token-billed."
        },
        {
          "name": "web_search_preview other",
          "amount": 25,
          "unit": "per_thousand_calls",
          "currency": "USD",
          "condition": "Search content token charge explicitly free."
        },
        {
          "name": "file_search call",
          "amount": 2.5,
          "unit": "per_thousand_calls",
          "currency": "USD",
          "condition": "Responses API only."
        },
        {
          "name": "file_search storage",
          "amount": 0.1,
          "unit": "per_GiB_day",
          "currency": "USD",
          "condition": "First1GiB free;1GiB=2^30bytes."
        },
        {
          "name": "container1GiB",
          "amount": 0.03,
          "unit": "per_20_minute_container_session",
          "currency": "USD"
        },
        {
          "name": "container4GiB",
          "amount": 0.12,
          "unit": "per_20_minute_container_session",
          "currency": "USD"
        },
        {
          "name": "container16GiB",
          "amount": 0.48,
          "unit": "per_20_minute_container_session",
          "currency": "USD"
        },
        {
          "name": "container64GiB",
          "amount": 1.92,
          "unit": "per_20_minute_container_session",
          "currency": "USD"
        }
      ],
      "sourceNotes": "Eligible container sessions billed per minute with5-minute minimum. Tool tokens additionally billed at model rates. These conditional resource fees are not universal model token fees. GPT image tool itself token-billed, no invented fixed image_generation/call fee.",
      "reason": "Call-count fees can use declared meters but file-storage and container lifetime/memory dimension cannot be expressed as fixed universal per-call fees."
    },
    {
      "provider": "google",
      "officialModel": "Gemini conditional tools",
      "quoteGroup": "google-conditional-tools",
      "currency": "USD",
      "source": {
        "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
        "checkedAt": "2026-11-16"
      },
      "fees": [
        {
          "name": "Google Search",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 search requests per month free, shared across all Gemini3+; default daily cap1500 requests/project. One model request may perform several independently billed queries.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Google Maps",
          "amount": 14,
          "unit": "per_thousand_search_queries",
          "currency": "USD",
          "condition": "First5000 requests/month free, shared across Gemini3+.",
          "source": {
            "url": "https://aistudio.google.com/docs/pricing#pricing-for-tools",
            "checkedAt": "2026-11-16"
          }
        },
        {
          "name": "Gemini2.5 Google Search",
          "amount": 35,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500 daily grounded prompts free, Flash/Flash-Lite shared allowance."
        },
        {
          "name": "Gemini2.5 Google Maps",
          "amount": 25,
          "unit": "per_thousand_grounded_prompts",
          "currency": "USD",
          "condition": "First1500daily Flash/Flash-Lite;10000daily Pro."
        },
        {
          "name": "code_execution",
          "amount": 0,
          "unit": "additional_session_runtime",
          "currency": "USD",
          "condition": "Generated code/results count output; iterative reuse counts input at model rate."
        },
        {
          "name": "url_context",
          "amount": 0,
          "unit": "additional_per_call",
          "currency": "USD",
          "condition": "Retrieved content billed as model input tokens."
        },
        {
          "name": "computer_use",
          "amount": 0,
          "unit": "additional_per_call",
          "currency": "USD",
          "condition": "Regular model tokens billed."
        },
        {
          "name": "file_search ingestion embedding",
          "amount": 0.15,
          "unit": "per_million_embedding_tokens",
          "currency": "USD",
          "condition": "Gemini Embedding; alternatively Gemini Embedding2 list applies; retrieved document tokens charged at inference model input rates."
        }
      ],
      "reason": "Free allowances and limits are account/project-period dependent. Google Maps, storage duration and embedding-choice costs lack a single native per-call meter. Do not claim those costs are zero because per-call fee is absent."
    }
  ]
}
```
