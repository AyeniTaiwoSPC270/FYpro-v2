# FYPro Financial Projection

*Revenue, costs, and profit at every scale*

Three scenarios · Four user scales · Monthly + Annual views

Document version 1.0 — April 26, 2026

---

## How to Read This Document

This is the companion to the Cost Model. The Cost Model told you what FYPro costs to operate. This document tells you what FYPro earns at each scale, and whether you're profitable.

### What's Inside

- Section 1: The three scenarios — Conservative, Base, Optimistic. What conversion rates each assumes.
- Section 2: Revenue at each scale, broken down by Student Pack, Defense Pack, Project Reset.
- Section 3: Full Monthly P&L for all 12 combinations (4 scales × 3 scenarios).
- Section 4: Full Annual P&L summaries.
- Section 5: Profit margins, break-even analysis.
- Section 6: Founder takeaways — when does FYPro become a real business.

### Critical Assumptions

- One-time pricing: Student Pack ₦2,000, Defense Pack ₦3,500, Project Reset ₦1,500.
- One user buys at most one Student Pack and one Defense Pack.
- Project Reset is the only repeat purchase.
- Conversion rates vary by scenario (see Section 1).
- Free users cost real money in Claude API.
- Marketing/acquisition costs are NOT included in P&L (they're founder time + small variable spend).
- Founder salary is NOT included in P&L (you're not paying yourself yet).
- Exchange rate held at ₦1,600/USD.

### What This Document Does NOT Cover

- Institutional B2B revenue (the ₦25M/year potential per university). That's a separate revenue line you can layer on top of these projections.
- SIWES B2B2C revenue (v3 feature). Not modeled here.
- Revenue from grants, prize money, or fundraising.
- Detailed marketing spend (founder time treated as free).

---

## Section 1 — The Three Scenarios

Same product, three different conversion outcomes. Real-world FYPro will land somewhere across these three, possibly drifting between them quarter by quarter.

### The Three Scenarios Defined

| Scenario | Student Pack Conv. | Defense Pack Conv. | Reset Multiplier | When This Happens |
|---|---|---|---|---|
| **Conservative** | 5% | 3% | 10% | Slow word-of-mouth, weak free-tier hook, churn |
| **Base** | 8% | 5% | 15% | Realistic launch — what you should plan around |
| **Optimistic** | 12% | 8% | 20% | Defense season peak, viral moment, strong testimonials |

### How Reset Multiplier Works

Reset multiplier = % of users who already paid (Student or Defense) who go on to also buy a Project Reset (₦1,500). Real example: a student buys Student Pack, fails their first topic validation, buys Reset to start over with a new topic.

### Why These Specific Numbers

- 5% Student Pack conversion is the floor for a freemium product with strong value. Anything lower means the free tier is too generous or paid features are weak.
- 8% Base is informed by Nigerian student spending willingness — they pay for things they trust will improve outcomes (cf. JAMB CBT prep apps).
- 12% Optimistic happens during defense season (May-July at most universities) when the Defense Pack is most relevant.
- Defense Pack conversion is always lower than Student Pack — Defense Pack is for students near defense day; Student Pack is for anyone running a project.

---

## Section 2 — Revenue at Each Scale

Gross revenue across the three plans, before costs are deducted. Net revenue (after Paystack fees) is shown for clarity.

### Base Scenario Revenue Breakdown

| Revenue Source | 10K users | 25K users | 50K users | 100K users |
|---|---|---|---|---|
| Student Pack buyers | 800 | 2,000 | 4,000 | 8,000 |
| Student Pack revenue | ₦1.60M | ₦4.00M | ₦8.00M | ₦16.00M |
| Defense Pack buyers | 500 | 1,250 | 2,500 | 5,000 |
| Defense Pack revenue | ₦1.75M | ₦4.38M | ₦8.75M | ₦17.50M |
| Project Reset buyers | 195 | 488 | 975 | 1,950 |
| Project Reset revenue | ₦292,500 | ₦731,250 | ₦1.46M | ₦2.92M |
| **GROSS REVENUE (annual)** | **₦3.64M** | **₦9.11M** | **₦18.21M** | **₦36.42M** |
| Less: Paystack fees | ₦-204,137 | ₦-510,344 | ₦-1,020,687 | ₦-2,041,375 |
| **NET REVENUE (annual)** | **₦3.44M** | **₦8.60M** | **₦17.19M** | **₦34.38M** |

### All Three Scenarios — Net Revenue Annual

| Scale | Conservative | Base | Optimistic |
|---|---|---|---|
| 10,000 users | ₦2.05M | ₦3.44M | ₦5.47M |
| 25,000 users | ₦5.12M | ₦8.60M | ₦13.68M |
| 50,000 users | ₦10.25M | ₦17.19M | ₦27.36M |
| 100,000 users | ₦20.49M | ₦34.38M | ₦54.73M |

### Monthly Average Revenue (Base Scenario)

| Scale | Monthly Net Revenue | Daily Average |
|---|---|---|
| 10,000 users | ₦286,530 | ₦9,420 |
| 25,000 users | ₦716,326 | ₦23,550 |
| 50,000 users | ₦1.43M | ₦47,101 |
| 100,000 users | ₦2.87M | ₦94,202 |

---

## Section 3 — Full Monthly P&L

Monthly Profit & Loss for each scale × scenario combination.

### 10,000 Users — Monthly P&L

| Line Item | Conservative | Base | Optimistic |
|---|---|---|---|
| Student Pack revenue | ₦83,333 | ₦133,333 | ₦200,000 |
| Defense Pack revenue | ₦87,500 | ₦145,833 | ₦233,333 |
| Project Reset revenue | ₦10,000 | ₦24,375 | ₦50,000 |
| Gross revenue | ₦180,833 | ₦303,542 | ₦483,333 |
| Less: Paystack fees | ₦-10,046 | ₦-17,011 | ₦-27,250 |
| **Net revenue** | **₦170,788** | **₦286,530** | **₦456,083** |
| Less: Claude API (free workflow) | ₦-160,440 | ₦-160,440 | ₦-160,440 |
| Less: Claude API (Student extras) | ₦-4,760 | ₦-7,616 | ₦-11,424 |
| Less: Defense Sim (Claude+Whisper) | ₦-6,960 | ₦-11,600 | ₦-18,560 |
| Less: Fixed costs (hosting/SaaS) | ₦-6,500 | ₦-6,500 | ₦-6,500 |
| Total monthly costs | ₦-178,660 | ₦-186,156 | ₦-196,924 |
| **MONTHLY PROFIT/LOSS** | **₦-7,872** | **₦100,374** | **₦259,159** |
| **Margin %** | **-4.6%** | **35.0%** | **56.8%** |

### 25,000 Users — Monthly P&L

| Line Item | Conservative | Base | Optimistic |
|---|---|---|---|
| Student Pack revenue | ₦208,333 | ₦333,333 | ₦500,000 |
| Defense Pack revenue | ₦218,750 | ₦364,583 | ₦583,333 |
| Project Reset revenue | ₦25,000 | ₦60,938 | ₦125,000 |
| Gross revenue | ₦452,083 | ₦758,854 | ₦1.21M |
| Less: Paystack fees | ₦-25,115 | ₦-42,529 | ₦-68,125 |
| **Net revenue** | **₦426,969** | **₦716,326** | **₦1.14M** |
| Less: Claude API (free workflow) | ₦-401,100 | ₦-401,100 | ₦-401,100 |
| Less: Claude API (Student extras) | ₦-11,900 | ₦-19,040 | ₦-28,560 |
| Less: Defense Sim (Claude+Whisper) | ₦-17,400 | ₦-29,000 | ₦-46,400 |
| Less: Fixed costs (hosting/SaaS) | ₦-94,000 | ₦-94,000 | ₦-94,000 |
| Total monthly costs | ₦-524,400 | ₦-543,140 | ₦-570,060 |
| **MONTHLY PROFIT/LOSS** | **₦-97,431** | **₦173,186** | **₦570,148** |
| **Margin %** | **-22.8%** | **24.2%** | **50.0%** |

### 50,000 Users — Monthly P&L

| Line Item | Conservative | Base | Optimistic |
|---|---|---|---|
| Student Pack revenue | ₦416,667 | ₦666,667 | ₦1.00M |
| Defense Pack revenue | ₦437,500 | ₦729,167 | ₦1.17M |
| Project Reset revenue | ₦50,000 | ₦121,875 | ₦250,000 |
| Gross revenue | ₦904,167 | ₦1.52M | ₦2.42M |
| Less: Paystack fees | ₦-50,229 | ₦-85,057 | ₦-136,250 |
| **Net revenue** | **₦853,938** | **₦1.43M** | **₦2.28M** |
| Less: Claude API (free workflow) | ₦-802,200 | ₦-802,200 | ₦-802,200 |
| Less: Claude API (Student extras) | ₦-23,800 | ₦-38,080 | ₦-57,120 |
| Less: Defense Sim (Claude+Whisper) | ₦-34,800 | ₦-58,000 | ₦-92,800 |
| Less: Fixed costs (hosting/SaaS) | ₦-188,500 | ₦-188,500 | ₦-188,500 |
| Total monthly costs | ₦-1,049,300 | ₦-1,086,780 | ₦-1,140,620 |
| **MONTHLY PROFIT/LOSS** | **₦-195,362** | **₦345,871** | **₦1.14M** |
| **Margin %** | **-22.9%** | **24.1%** | **50.0%** |

### 100,000 Users — Monthly P&L

| Line Item | Conservative | Base | Optimistic |
|---|---|---|---|
| Student Pack revenue | ₦833,333 | ₦1.33M | ₦2.00M |
| Defense Pack revenue | ₦875,000 | ₦1.46M | ₦2.33M |
| Project Reset revenue | ₦100,000 | ₦243,750 | ₦500,000 |
| Gross revenue | ₦1.81M | ₦3.04M | ₦4.83M |
| Less: Paystack fees | ₦-100,458 | ₦-170,115 | ₦-272,500 |
| **Net revenue** | **₦1.71M** | **₦2.87M** | **₦4.56M** |
| Less: Claude API (free workflow) | ₦-1,604,400 | ₦-1,604,400 | ₦-1,604,400 |
| Less: Claude API (Student extras) | ₦-47,600 | ₦-76,160 | ₦-114,240 |
| Less: Defense Sim (Claude+Whisper) | ₦-69,600 | ₦-116,000 | ₦-185,600 |
| Less: Fixed costs (hosting/SaaS) | ₦-309,500 | ₦-309,500 | ₦-309,500 |
| Total monthly costs | ₦-2,031,100 | ₦-2,106,060 | ₦-2,213,740 |
| **MONTHLY PROFIT/LOSS** | **₦-323,225** | **₦759,242** | **₦2.35M** |
| **Margin %** | **-18.9%** | **26.5%** | **51.5%** |

---

## Section 4 — Annual P&L Summary

### Annual P&L — Base Scenario at All Scales

| Line Item | 10K users | 25K users | 50K users | 100K users |
|---|---|---|---|---|
| Gross revenue | ₦3.64M | ₦9.11M | ₦18.21M | ₦36.42M |
| Less: Paystack fees | ₦-204,137 | ₦-510,344 | ₦-1,020,687 | ₦-2,041,375 |
| Net revenue | ₦3.44M | ₦8.60M | ₦17.19M | ₦34.38M |
| Variable costs (Claude+Whisper) | ₦-2,155,872 | ₦-5,389,680 | ₦-10,779,360 | ₦-21,558,720 |
| Fixed costs (hosting/SaaS) | ₦-78,000 | ₦-1,128,000 | ₦-2,262,000 | ₦-3,714,000 |
| **ANNUAL NET PROFIT** | **₦1.20M** | **₦2.08M** | **₦4.15M** | **₦9.11M** |
| **Profit margin %** | **35.0%** | **24.2%** | **24.1%** | **26.5%** |

### Annual P&L — All Scenarios at 50K Users

| Line Item | Conservative | Base | Optimistic |
|---|---|---|---|
| Net revenue | ₦10.25M | ₦17.19M | ₦27.36M |
| Total costs | ₦-12,591,600 | ₦-13,041,360 | ₦-13,687,440 |
| **Annual net profit** | **₦-2,344,350** | **₦4.15M** | **₦13.68M** |
| **Margin** | -22.9% | 24.1% | 50.0% |

---

## Section 5 — Break-Even Analysis

### Minimum Paying Users to Break Even

| Scenario | Avg Net Revenue / Paying User | Min Paying Users to Cover Fixed Costs |
|---|---|---|
| Conservative | ₦2,562 | 883 paying users |
| Base | ₦2,645 | 856 paying users |
| Optimistic | ₦2,737 | 827 paying users |

> Note: This break-even covers FIXED costs only (hosting, SaaS subscriptions). To break even fully including variable costs, you need more — but variable costs scale with revenue, so they're not a separate concern.

### First Revenue Milestones

- **First ₦100K revenue:** ~70 paying users (mix of Student/Defense). Achievable in week 1-2 of launch with strong WhatsApp blast + course rep partnerships.
- **First ₦1M revenue:** ~700 paying users. Realistic by month 3 if Defense season hits well.
- **First ₦10M revenue:** ~7,000 paying users. Year 1 target if base scenario holds and you launch by July.
- **First ₦100M revenue:** 70,000+ paying users OR institutional contracts. The institutional path gets there faster — 4 universities × ₦25M = ₦100M alone.

---

## Section 6 — Founder Takeaways

### When FYPro Becomes a Real Business

Real business = covers all costs AND pays you a livable salary (~₦200K/month minimum to start). At Base scenario, you need approximately 25K-50K total users to comfortably support yourself + buffer + light reinvestment. Realistic timeline: **8-12 months from public launch.**

### The Hierarchy of Levers

Things you can do to increase profitability, ranked by impact:

1. **Increase conversion rate.** 5% to 8% is a 60% revenue increase. Single biggest lever.
2. **Layer in B2B revenue (institutional + SIWES).** One ₦25M university contract = the entire annual profit at 50K users base scenario.
3. **Optimize Defense Pack adoption.** Highest margin product. Marketing should weight it 60/40 over Student Pack.
4. **Reduce free user costs through aggressive caching + prompt optimization.** 30% savings is achievable.
5. **Raise prices.** ₦2,000 → ₦2,500 Student Pack (+25%) likely loses <10% volume. Net positive impact.

### What You Should Tell Investors

If you ever pitch FYPro for fundraising, lead with these numbers (using Base scenario at 50K users):

| Metric | Value |
|---|---|
| Annual gross revenue | ₦18.21M |
| Annual net revenue | ₦17.19M |
| Annual gross profit | ₦4.15M |
| Gross margin | 24.1% |
| Total paying customers | 6,500 |
| Avg revenue per paying user | ₦2,645 |
| Cost per paying user | ₦2,006 |

### What This Says About Pricing Strategy

- **Defense Pack at ₦3,500** is correctly priced. ~88% gross margin per buyer. Don't lower it.
- **Student Pack at ₦2,000** has lower margin (~70%) due to Paystack fees being a higher % of small transactions. Consider raising to ₦2,500 within 6 months of launch.
- **Project Reset at ₦1,500** is the worst-margin product (~55% after fees and costs). It exists for utility, not profit. Don't promote heavily.
- Future products should price at **₦3,500+** to optimize Paystack fee economics. Anything under ₦1,500 is a fee disaster — Paystack eats >10%.

### The Honest Year-One Forecast

> **What FYPro likely does in year 1:**
> Realistic: 5,000-15,000 free signups, 400-1,200 paying users, ₦1.5M-₦4M revenue, ₦300K-₦1.5M profit.
> Won't make you rich. Will validate the thesis.
> Year 2 is where it scales — institutional contracts, retention, repeat defense season, expansion.
> **Year 1 is the proof. Year 2 is the business.**

### What's Most Likely To Go Wrong

1. **Conversion below 5%.** If your Defense Simulator + Project Reviewer don't convert at 3%+ each, the model breaks. Mitigation: A/B test pricing, improve free→paid moments, deepen Defense Pack value.
2. **Anthropic doubles pricing.** ₦200K-₦300K/month additional cost at 50K users. Mitigation: caching, prompt optimization, switch some workflows to cheaper models.
3. **Naira devaluation.** Every 10% Naira drop = ~9% increase in your USD-denominated costs. Mitigation: raise prices proportionally.
4. **Competitive entry.** ₦200M+ funded competitor enters the market. Mitigation: dataset moat (ship Day 26 archive on time), first-mover institutional contracts (sign 3 by Christmas 2026).
5. **You burn out.** Mitigation: the schedule has buffer days for a reason. Use them.

### FYPro Quarterly Health Check

Print this. Stick it on your wall. Compare quarterly:

1. Total registered users (target: doubling every quarter Year 1).
2. Paid users / total users (target: 5%+).
3. Net revenue this quarter (target: 4× the previous quarter Year 1).
4. Cost per paying user (target: under ₦1,000).
5. Gross margin (target: 65%+).
6. Months of runway at current burn (target: 6+ months).

---

*Companion document: [cost-model.md](cost-model.md)*
