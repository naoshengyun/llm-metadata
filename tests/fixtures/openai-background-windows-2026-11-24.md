<!-- Independent official evidence excerpt; not generated from official-catalog.json. -->
<!-- pricing-url: https://developers.openai.com/api/docs/pricing.md -->
<!-- pricing-sha256: 88f7825ffddb006fefea4d3838831bd3deaed6f72df6914ad79aefa021d51355 -->
<!-- flex-guide-url: https://developers.openai.com/api/docs/guides/flex-processing.md -->
<!-- flex-guide-sha256: 886b8b1a7093fc7aee0fe81aca7a7115bec784f76a36e13d1fc493952a58b3de -->
<!-- background-guide-url: https://developers.openai.com/api/docs/guides/background.md -->
<!-- background-guide-sha256: e505f6409f2f56a4b6183f646d19adaa8d07fca929accb9ffa44f5d2c94a72f8 -->
<!-- checked-at: 2026-11-24 -->

### Standard base pricing data

| Model | Short context input | Short context output | Short context cached input | Short context 30m write | Short context 12h write | Long context input | Long context output | Long context cached input | Long context 30m write | Long context 12h write |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| gpt-6.2-astra | $8.00 | $40.00 | $0.40 | $10.00 | $20.00 | $16.00 | $60.00 | $0.80 | $20.00 | $40.00 |
| gpt-6.2-sol | $2.00 | $10.00 | $0.10 | $2.50 | $5.00 | $4.00 | $15.00 | $0.20 | $5.00 | $10.00 |
| gpt-6.1-terra | $1.00 | $5.00 | $0.05 | $1.25 | $2.50 | $2.00 | $7.50 | $0.10 | $2.50 | $5.00 |
| gpt-6-luna | $0.10 | $0.50 | $0.01 | $0.125 | $0.25 | $0.20 | $0.75 | $0.02 | $0.25 | $0.50 |

Short context: ≤272K input tokens. Long context: >272K input tokens.

### Pricing footnote

For GPT‑6.2 Astra, GPT‑6.2 Sol, GPT‑6.1 Terra, and GPT‑6 Luna, model token rates for eligible background requests are 30% below Standard for the 2‑hour completion window and 40% below Standard for the 8‑hour completion window.

### Flex processing guide

Flex is unavailable on GPT-6.2 Astra and GPT-6.2 Sol, and we won’t be adding it to future models.

For workloads that can run asynchronously, background mode in the Responses API offers discounted completion windows on supported models. The 2-hour window is 30% below Standard token pricing, and the 8-hour window is 40% below. The discount applies to every eligible request, including follow-ups.

### Background guide — Choose a completion window

Set `background_options.completion_window` based on how soon you need the initial response. For `2h` and `8h`, the API targets completion within the selected window after it accepts the request.

| Window | When to use it | Model token discount |
| --- | --- | --- |
| `soonest` (default) | Generate an on-demand report while someone waits for the result. | None |
| `2h` | Analyze the morning’s support tickets before an afternoon triage meeting. | 30% below Standard |
| `8h` | Review a batch of documents overnight for the next morning. | 40% below Standard |

The completion target starts when the API accepts the initial request and applies to that response. The discount applies to model token rates on each eligible request, including follow-ups.

### Background guide — eligibility and cache restrictions

Starting with GPT-6.2 Astra and Sol, new models launch without Flex processing (`service_tier: flex`). For long-running Responses API requests, use discounted completion windows with Standard processing on supported models.

Discounted completion windows are in public beta on GPT-6.2 Astra, GPT-6.2 Sol, GPT-6.1 Terra, and GPT-6 Luna.

Set `background` to `true` and set `background_options.completion_window` to `2h` or `8h`. Leave `stream` unset or set it to `false`.

Discounted windows require Standard processing. Set `service_tier` to `default` to select Standard. With `auto`, the request qualifies only if the API selects Standard.

Standard requests outside the discounted completion windows can’t reuse prompt cache entries created by `2h` or `8h` background requests, even when the prompt is identical.

### Evidence limitation

The linked official sources provide no itemized statement applying the multiplier specifically to uncached input, output, cached input, 30-minute cache writes, 12-hour cache writes, or long-context rates. No derived per-meter prices are asserted in this fixture.
