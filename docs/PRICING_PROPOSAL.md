# Content Studio credit pricing proposal

Status: proposal only. The current app does not have checkout, a credit ledger, billing, or plan enforcement. The public landing page labels these prices as planned.

## Customer-facing structure (USD, before applicable tax)

| Plan | Monthly price | AI credits/month | Connected accounts | Approximate text + image posts |
| --- | ---: | ---: | ---: | ---: |
| Starter | $24 | 100 | 1 | 10 |
| Growth | $49 | 250 | 2 | 25 |
| Studio | $99 | 600 | 4 | 60 |

One platform-specific AI draft costs 2 credits. One standard AI image costs 8 credits. A typical Instagram draft with one image therefore costs 10 credits. One rewrite costs 1 credit. Manual editing, scheduling, approval, publishing, and analytics viewing do not consume credits. Charge only after an operation succeeds; retrying a failed operation does not charge again. Additional connected accounts would cost $12/month each, and a 100-credit top-up would cost $12. Monthly credits reset at renewal; top-ups should remain usable for 12 months. These rules are **product design**, not implemented behavior.

This model assumes Zernio is the selected publishing provider. The repository currently defaults to Upload Post; verify that provider's contract and costs before using these prices there.

The plan includes account slots because Zernio bills by *connected account*, not by published post. A pure credit-only plan would allow a low-usage customer to leave many accounts connected and incur a fixed monthly vendor cost. Account slots plus AI credits track both major cost drivers.

## Cost basis and margin guardrails

The model below is intentionally conservative for a small account base. Zernio's published rate is two connected accounts free across the whole team, then $6 per account for accounts 3–10, $3 for accounts 11–100, and $1 after that; charges are prorated daily. Budget **$6 per included account** instead of assuming the shared free allowance will be available. Zernio currently includes unlimited posts, so publishing does not need a per-post credit charge. [Zernio pricing](https://docs.zernio.com/pricing).

The application's example configuration uses Gemini 2.5 Flash for text and Gemini 3.1 Flash Image for images, with Cloudflare and OpenAI image alternatives. Google lists a standard 1K Gemini 3.1 Flash image at about $0.067, and OpenAI lists a medium 1024×1024 GPT Image 1.5 image at $0.034. Actual costs vary with prompt tokens, image size, retries, and provider choice. Set an internal **$0.02 cost reserve per credit** until production telemetry supplies a 95th-percentile cost per successful operation. That gives a standard image $0.16 of cost room at 8 credits. Do not offer high-resolution image generation at the same credit rate without measuring it. [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [OpenAI image pricing](https://developers.openai.com/api/docs/models/gpt-image-1.5).

Assume a **20% sales/affiliate commission** on pre-tax revenue, a **3% + $0.30** payment-processing allowance per monthly subscription, and fixed service/support allowances of $2/$3/$5 for Starter/Growth/Studio. These are planning inputs, not claimed vendor rates or legal tax advice. Apply sales tax or GST on top of the listed price and remit it separately. If a market requires tax-inclusive display, recompute the margin from the tax-exclusive amount before publishing that local price.

| Plan | Revenue | 20% commission | 3% + $0.30 processing | Zernio reserve | Credit reserve | Service reserve | Estimated contribution | Margin |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Starter | $24.00 | $4.80 | $1.02 | $6.00 | $2.00 | $2.00 | $8.18 | 34.1% |
| Growth | $49.00 | $9.80 | $1.77 | $12.00 | $5.00 | $3.00 | $17.43 | 35.6% |
| Studio | $99.00 | $19.80 | $3.27 | $24.00 | $12.00 | $5.00 | $34.93 | 35.3% |

Formula: `contribution = pre-tax price − commission − processing − ($6 × included accounts) − ($0.02 × included credits) − service reserve`. This excludes acquisition costs, refunds, chargebacks, foreign-exchange costs, and usage beyond the covered features. Keep the first two free Zernio accounts as a buffer rather than promising the saving to any one customer.

## Before turning billing on

1. Measure actual text, image, source-processing, and retry cost per workspace and provider. Confirm the chosen standard image size.
2. Build an immutable credit ledger with idempotent charges, refunds on failed operations, monthly allocations, top-up expiry, and a visible balance. Prevent a user from starting an operation they cannot cover.
3. Enforce connected-account limits on connection creation, not only in the UI. Decide whether unused accounts can be swapped immediately and how mid-cycle additions are prorated.
4. Integrate checkout, tax calculation, invoicing, commission payouts, refunds, and cancellation. Keep tax separate from revenue in margin reports.
5. Reprice if commission, processor rates, AI providers, or Zernio tiers change. Target at least 30% contribution after modeled commission at normal usage.
