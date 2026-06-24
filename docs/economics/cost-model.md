# FYPro Cost Model

*What FYPro costs to operate at every scale*

Modeled at 10,000 / 25,000 / 50,000 / 100,000 users

Document version 1.0 — April 26, 2026

---

## How to Read This Document

This document tells you exactly what FYPro costs to run at four user scales: 10K, 25K, 50K, and 100K total users. Companion document is the Financial Projection — that one tells you what you earn after these costs.

### Two Types of Costs

- **FIXED costs** — what you pay monthly regardless of usage (Vercel, Supabase, domain, etc.). Mostly free at small scale, scaling up at 25K+ users.
- **VARIABLE costs** — what you pay PER USER (Claude API, Whisper voice, Paystack fees). These are 90%+ of your costs at scale.

### Why This Matters

If you don't know your unit economics — what each user costs you — you can't price correctly, can't predict profitability, and can't decide when to hire or invest. By the end of this document, you will know FYPro's cost-per-user precisely and where it breaks even.

### The Headline Number

> **FYPro is wildly profitable per paid user, but free users cost real money.**
> A Defense Pack user generates ~₦3,348 in net revenue and costs you ~₦400 to serve. ~88% gross margin.
> A free user generates ZERO revenue and costs you ~₦40-60 in Claude API.
> The math breaks if too many free users never convert. Conversion rate is everything.

---

## Section 1 — Variable Costs Per User

Variable costs are what you pay for each user, every time they use the product. These are dominated by Claude API costs.

### Pricing Sources

- Claude Sonnet 4.5: $3 per million input tokens, $15 per million output tokens. Source: Anthropic pricing page.
- OpenAI Whisper: $0.006 per minute of audio. Source: OpenAI pricing page.
- Paystack: 1.5% + ₦100 per local transaction, capped at ₦2,000. Source: Paystack pricing page.
- Exchange rate used: ₦1,600 per USD (April 2026 baseline).
- Caching discount: 30% reduction on repeated workflow inputs (per Day 31 build).

### Free User — Token Usage Breakdown

A free user runs the 7 workflow features once. Estimated tokens per feature:

| Feature | Input Tokens | Output Tokens | USD Cost |
|---|---|---|---|
| topicValidator | 1,500 | 800 | $0.0165 |
| chapterArchitect | 1,800 | 1,500 | $0.0279 |
| methodologyAdvisor | 1,500 | 1,000 | $0.0195 |
| writingPlanner | 1,200 | 900 | $0.0171 |
| literatureMap | 4,000 | 2,000 | $0.0420 |
| abstractGenerator | 1,800 | 1,000 | $0.0204 |
| instrumentBuilder | 2,000 | 1,500 | $0.0285 |
| **Total per free user** | **13,800** | **8,700** | **$0.1719** |

Free user Claude cost in NGN (with 30% caching discount): **₦193 per user.**

Free users do not pay you. This is pure cost.

### Student Pack User — Adds Premium Features

On top of free workflow, a Student Pack user accesses Project Reviewer (PDF analysis), Red Flag Detector, and Meeting Prep Agent.

| Feature | Input Tokens | Output Tokens | USD Cost |
|---|---|---|---|
| projectReviewer | 8,000 | 2,500 | $0.0615 |
| redFlagDetector | 2,000 | 800 | $0.0180 |
| meetingPrep | 1,500 | 1,200 | $0.0225 |
| **Student extras subtotal** | **11,500** | **4,500** | **$0.1020** |

Student Pack additional cost (with caching): ₦114 per user.

Student Pack total Claude cost (free workflow + extras): **₦307 per user.**

### Defense Pack User — Adds Defense Simulator + Voice

Defense Simulator runs ~5 examiner turns across 3 examiner personas. Whisper transcribes voice answers. No caching applies (every conversation unique).

| Component | Detail | Cost |
|---|---|---|
| Defense Simulator (Claude) | 12,000 in / 6,000 out tokens | $0.1260 |
| Whisper voice transcription | 8 minutes | $0.0480 |
| **Defense extras total** | **Per session** | **$0.1740** |

Defense Pack additional cost in NGN: ₦278 per session.

Defense Pack total Claude+Whisper cost (free workflow + extras): **₦471 per user.**

### Paystack Transaction Fees

Paystack charges 1.5% + ₦100 per local transaction, capped at ₦2,000.

| Plan | Price | Paystack Fee | Net Revenue | % Lost to Fees |
|---|---|---|---|---|
| Student Pack | ₦2,000 | ₦130 | ₦1,870 | 6.5% |
| Defense Pack | ₦3,500 | ₦153 | ₦3,348 | 4.4% |
| Project Reset | ₦1,500 | ₦123 | ₦1,378 | 8.2% |

> Note: Lower-priced products lose proportionally more to fees. Project Reset at ₦1,500 loses ~8.2% to Paystack fees vs Defense Pack at 4.4%. Worth considering when pricing future products.

---

## Section 2 — Fixed Costs by User Scale

Fixed costs are what you pay monthly regardless of usage. These scale up in tiers based on user count, not per-user.

### Service Tiers Used

- **Vercel:** free covers up to ~25K users / 100GB bandwidth. Pro plan ($20/mo) needed beyond.
- **Supabase:** free covers up to 500MB DB and 50K monthly active users. Pro plan ($25/mo) at scale.
- **Upstash Redis:** free 10K requests/day. Pay-as-you-go at scale.
- **Resend:** free 3K emails/month. $20/mo for 50K emails. $80/mo for 100K.
- **Sentry:** free 5K errors/month. Team plan ($26/mo) at scale.
- **Cloudflare:** free covers everything FYPro needs at any scale.
- **Domain:** ~₦18,000/year for fypro.app or ~₦7,000/year for fypro.ng. Average ~₦1,500/month.

### Monthly Fixed Costs at Each Scale

| Service | 10K users | 25K users | 50K users | 100K users |
|---|---|---|---|---|
| Vercel | ₦0 | ₦32,000 | ₦32,000 | ₦32,000 |
| Supabase | ₦0 | ₦0 | ₦40,000 | ₦40,000 |
| Upstash | ₦0 | ₦16,000 | ₦16,000 | ₦16,000 |
| Resend | ₦0 | ₦32,000 | ₦32,000 | ₦128,000 |
| Sentry | ₦0 | ₦0 | ₦42,000 | ₦42,000 |
| Cloudflare | ₦0 | ₦0 | ₦0 | ₦0 |
| Domain (avg/mo) | ₦1,500 | ₦1,500 | ₦1,500 | ₦1,500 |
| Misc/buffer | ₦5,000 | ₦12,500 | ₦25,000 | ₦50,000 |
| **TOTAL MONTHLY** | **₦6,500** | **₦94,000** | **₦188,500** | **₦309,500** |
| **TOTAL ANNUAL** | **₦78,000** | **₦1.13M** | **₦2.26M** | **₦3.71M** |

> **Key insight:** Fixed costs are remarkably small even at 100K users — under ₦300K/month. The real cost driver is the variable Claude API spend, which grows linearly with users. Plan for variable costs first, fixed second.

---

## Section 3 — Total Cost Summary at Each Scale

### Annual Cost at Each Scale (Base Scenario)

| Cost Category | 10K users | 25K users | 50K users | 100K users |
|---|---|---|---|---|
| Free workflow Claude | ₦1.93M | ₦4.81M | ₦9.63M | ₦19.25M |
| Student Pack extras | ₦91,392 | ₦228,480 | ₦456,960 | ₦913,920 |
| Defense Pack extras (incl. Whisper) | ₦139,200 | ₦348,000 | ₦696,000 | ₦1.39M |
| Variable costs subtotal | ₦2.16M | ₦5.39M | ₦10.78M | ₦21.56M |
| Fixed costs (annual) | ₦78,000 | ₦1.13M | ₦2.26M | ₦3.71M |
| Paystack fees | ₦204,138 | ₦510,344 | ₦1.02M | ₦2.04M |
| **TOTAL ANNUAL COSTS** | **₦2.44M** | **₦7.03M** | **₦14.06M** | **₦27.31M** |

### Cost Per User at Each Scale (Base Scenario)

| Metric | 10K users | 25K users | 50K users | 100K users |
|---|---|---|---|---|
| Cost per total user (annual) | ₦223 | ₦261 | ₦261 | ₦253 |
| Cost per paying user (annual) | ₦1,718 | ₦2,005 | ₦2,006 | ₦1,944 |

> **Cost-per-paying-user economics:** At every scale, your cost per paying user stays under ₦1,000. Your average revenue per paying user (across plans) is ~₦2,500-3,000. That's a 60%+ gross margin per paying user. The only thing that breaks this is conversion rate falling below 5%.

---

## Section 4 — Sensitivity Analysis

### Scenario A — Claude Pricing Doubles

| Scale | Current Annual Variable | If Claude 2x | Increase |
|---|---|---|---|
| 10,000 users | ₦2.16M | ₦4.31M | ₦2.16M |
| 25,000 users | ₦5.39M | ₦10.78M | ₦5.39M |
| 50,000 users | ₦10.78M | ₦21.56M | ₦10.78M |
| 100,000 users | ₦21.56M | ₦43.12M | ₦21.56M |

Mitigation if Claude prices spike: increase caching aggressiveness (push from 30% to 50% of repeated inputs), shorten system prompts, switch some workflows to Sonnet 3.5 if pricing diverges.

### Scenario B — No Caching Implemented

| Scale | With 30% caching | Without caching | Difference |
|---|---|---|---|
| 10,000 users | ₦2.16M | ₦3.08M | ₦923,945 |
| 25,000 users | ₦5.39M | ₦7.70M | ₦2.31M |
| 50,000 users | ₦10.78M | ₦15.40M | ₦4.62M |
| 100,000 users | ₦21.56M | ₦30.80M | ₦9.24M |

Caching is non-negotiable. Don't skip Day 31.

### Scenario C — Conversion Rate Sensitivity

| Scenario | Total Buyers (50K users) | Annual Costs | Cost/Paying User |
|---|---|---|---|
| Conservative (5% / 3%) | 4,000 | ₦12.59M | ₦3,148 |
| Base (8% / 5%) | 6,500 | ₦13.04M | ₦2,006 |
| Optimistic (12% / 8%) | 10,000 | ₦13.69M | ₦1,369 |

> **The conversion rate truth:** At Conservative conversion rates (5%/3%), your cost per paying user is highest. At Optimistic rates (12%/8%), it drops dramatically because more paid revenue spreads over the same fixed costs. The lever you control most is conversion — improve it through better paid feature value, not cheaper costs.

---

## Section 5 — Key Takeaways

### The Numbers That Matter

- Free user cost: **₦193** (negligible at small scale, real money at 50K+).
- Student Pack net revenue per buyer: **₦1,563** after costs and fees.
- Defense Pack net revenue per buyer: **₦2,877** after costs and fees.
- Defense Pack gross margin: **82%** — your highest-margin product. Push hard on Defense Pack adoption.
- Fixed costs at 100K users: **₦309,500/month**. Tiny relative to variable costs.

### Implications for FYPro Strategy

1. Your unit economics are excellent — paying users are very profitable. The challenge is acquisition and conversion, not cost control.
2. Defense Pack is your highest-margin product. Marketing should weight it heavily.
3. Free user cost is real. Don't let free users grow without bound. Either convert them or constrain their usage.
4. Caching (Day 31) is the single biggest cost lever you control. Implement it well.
5. Below 5% conversion, the model gets tight. Above 8%, it's wildly profitable.
6. Fixed costs are not the problem. Don't over-optimize hosting/infrastructure spend.

### What This Doesn't Cover

- Marketing spend (this is in the Financial Projection, not Cost Model).
- Founder salary or hire compensation (treated separately when revenue justifies).
- Legal, accounting, lawyer fees (one-time, modeled in Pre-Launch Ops doc).
- Refunds (assumed at <2% — material if higher).
- Currency volatility (model assumes ₦1,600/$ — Naira weakness raises Claude/Whisper costs proportionally).

> **Bottom line:** FYPro can be operated with positive unit economics from day one. The question is never 'can FYPro be profitable per user' — it's 'can FYPro acquire users at a cost less than gross profit per user'. The Financial Projection answers that.

---

*Companion document: [financial-projection.md](financial-projection.md)*
