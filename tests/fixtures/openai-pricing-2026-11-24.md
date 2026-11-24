<!-- Independent evidence excerpt; not generated from official-catalog.json. -->
<!-- source-url: https://developers.openai.com/api/docs/pricing.md -->
<!-- response-sha256: 88f7825ffddb006fefea4d3838831bd3deaed6f72df6914ad79aefa021d51355 -->
<!-- checked-at: 2026-11-24 -->
<!-- cache-guide-url: https://developers.openai.com/api/docs/guides/prompt-caching.md -->
<!-- cache-guide-sha256: 41fd5ad72dc74045ffb0fbe33e8213a879cc018a473b1e022b7be8fa04057625 -->

### Standard pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.2-astra | $8.00 | $40.00 | $0.40 | $10.00 | $20.00 | $16.00 | $60.00 | $0.80 | $20.00 | $40.00 |
| gpt-6.2-sol | $2.00 | $10.00 | $0.10 | $2.50 | $5.00 | $4.00 | $15.00 | $0.20 | $5.00 | $10.00 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

### Batch pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.2-astra | $4.00 | $20.00 | $0.20 | $5.00 | $10.00 | $8.00 | $30.00 | $0.40 | $10.00 | $20.00 |
| gpt-6.2-sol | $1.00 | $5.00 | $0.05 | $1.25 | $2.50 | $2.00 | $7.50 | $0.10 | $2.50 | $5.00 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

### Flex pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.1-sol | $1.00 | $5.00 | $0.05 | $1.25 | $2.50 | $2.00 | $7.50 | $0.10 | $2.50 | $5.00 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

### Fast pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.2-astra | $16.00 | $80.00 | $0.80 | $20.00 | $40.00 | $32.00 | $120.00 | $1.60 | $40.00 | $80.00 |
| gpt-6.2-sol | $4.00 | $20.00 | $0.20 | $5.00 | $10.00 | $8.00 | $30.00 | $0.40 | $10.00 | $20.00 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

For GPT-6.2 Astra and GPT-6.2 Sol, Ultrafast costs 3 times the Standard rate through February 28, 2027, and 6 times the Standard rate starting March 1, 2027 (Pacific time).

### Ultrafast promotion pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.2-astra | $24.00 | $120.00 | $1.20 | $30.00 | $60.00 | $48.00 | $180.00 | $2.40 | $60.00 | $120.00 |
| gpt-6.2-sol | $6.00 | $30.00 | $0.30 | $7.50 | $15.00 | $12.00 | $45.00 | $0.60 | $15.00 | $30.00 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

### Ultrafast list pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.2-astra | $48.00 | $240.00 | $2.40 | $60.00 | $120.00 | $96.00 | $360.00 | $4.80 | $120.00 | $240.00 |
| gpt-6.2-sol | $12.00 | $60.00 | $0.60 | $15.00 | $30.00 | $24.00 | $90.00 | $1.20 | $30.00 | $60.00 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

### Prompt caching guide evidence

For GPT-5.6 and later, cache writes cost 1.25× the standard, uncached input-token rate for the default 30-minute lifetime. In the Responses API, you can choose a 12-hour minimum lifetime at a write rate of 2.5× ordinary input.

In the Responses API, set `prompt_cache_options.ttl` to choose the minimum cache lifetime. Supported values are `"30m"` (default) and `"12h"`. These are total write rates, not surcharges on top of ordinary input.
