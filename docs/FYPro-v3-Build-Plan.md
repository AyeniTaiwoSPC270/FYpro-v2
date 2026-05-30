# FYPro v3 — Strategic Build & Scaling Roadmap

**FYPro v3**

Strategic Build & Scaling Roadmap

*From 73/100 to 90/100*

Prepared for: Taiwo Ayeni

v3 build window: August 18 – November 28, 2026

**Target public launch: December 5, 2026**

Document version: 1.0 — April 26, 2026

# Contents

Section 1 — How v3 Differs From v2

Section 2 — The 90/100 Target: Score Gap Analysis

Section 3 — Go/No-Go Decision Gates

Section 4 — Phase 1: Running v2 and Prepping v3 (June 13 – August 15)

Section 5 — Phase 2: v3 Build Schedule (August 18 – November 28)

Section 6 — Phase 3: Pre-Launch and Launch (November 29 – December 12)

Section 7 — The Hiring Playbook

Section 8 — Institutional Sales at Scale

Section 9 — SIWES B2B2C Playbook

Section 10 — The Dataset Moat

Section 11 — Content Engine and Community at Scale

Section 12 — Fundraising as Backup

Section 13 — What to Cut if You Fall Behind

Section 14 — Contract Templates and Operational Docs

Section 15 — Common Founder Mistakes (Months 6–12) + Personal Sustainability

Section 16 — v4 Preview: The Realistic Next Layer

Appendix — Tools, Accounts, Resources

# Section 1 — How v3 Differs From v2

Read this first. Everything else in this document is a function of these differences. If you treat v3 like v2 — a pure build sprint with a daily code schedule — you will fail to close the score gaps that take FYPro to 90/100.

## Five Structural Differences

| **Dimension** | **v2 vs v3** |
| --- | --- |
| What success looks like | v2 success was 'a working product that students pay for'. v3 success is 'a real business that has institutional contracts, paying users at scale, and a moat that takes capital to copy'. Different bar entirely. |
| Where the value comes from | v2 value came mostly from code shipped. v3 value comes 50% from code, 50% from things outside code — institutional contracts, hires, growth tactics, partnerships. The doc reflects this split. |
| Time pressure | v2 was racing a hackathon and a defense season. v3's deadline is softer — start of the new academic year for incoming final-years (mid-November to early December 2026). Missing by 2 weeks is recoverable. Missing by 8 weeks is not. |
| Decision quality matters more than speed | v2 was about doing things fast. v3 is about doing the right things. A wrong feature in v3 costs 4–6 weeks of wasted build time. Plan more, build less. |
| You may not be solo by week 6 | v2 assumed solo throughout. v3 plans for a possible hire mid-build once revenue justifies it. Some sections have 'split-mode' notes for when that happens. |

## What Stays the Same

- Same product DNA. The 6-step workflow + Defense Simulator stays. Don't pivot the core.

- Same target user. Nigerian university final-year students. Don't expand the wedge until the wedge is locked.

- Same stack. React + Supabase + Vercel + Anthropic. Don't rewrite tech for the sake of it.

- Same founder. You. Same constraints — coursework, NEPA, limited budget. Plan around them, not against them.

## What Must Change

- Add post-graduation continuity (Masters Proposal Builder) so users don't churn at graduation.

- Build the supervisor dashboard for real, not as a marketing concept — with at least one HoD lined up to pilot it.

- Sign at least 2 institutional contracts before launch. Contracts, not LOIs. Money in escrow, not promises.

- Add a real test suite, error monitoring, and staging environment. Stop running production from the live branch.

- Build a referral mechanic into the product so users acquire users.

- Open a SIWES B2B2C revenue stream — Defense Simulator licensed to companies as an interview tool.

- Begin building a proprietary defense-question dataset that no Western tool can replicate.

# Section 2 — The 90/100 Target: Score Gap Analysis

Every dimension of v3 traces back to closing a specific gap in the v2 critical analysis. Below is the explicit map. When you're deciding what to build on a given week, ask: which score does this move? If the answer is 'none', cut it.

| **Score** | **v2 → v3 Target** | **What Closes The Gap** |
| --- | --- | --- |
| Product fundamentals | 78 → 92 (+14) | Masters Proposal Builder ships. Post-graduation continuity feature live. LTV per user moves from 1 transaction to 4–5 across their academic career. |
| Differentiation | 72 → 88 (+16) | Proprietary defense-question dataset. Supervisor relationship layer fully built. Both are structurally hard for Western competitors to replicate. |
| Technical execution | 70 → 88 (+18) | Vitest + Playwright test suite covering critical paths. Sentry for error tracking. Staging environment with proper deploy pipeline. Performance monitoring. |
| Business model | 65 → 88 (+23) | 2 signed institutional contracts (not LOIs). 1 SIWES B2B2C contract. Pricing adjusted based on real conversion data from v2. Net margin clearly positive at scale. |
| Distribution strategy | 75 → 90 (+15) | First hire in place by week 5–8 (revenue permitting). Referral mechanic live in product. WhatsApp community of 1,000+ active members. |
| Founder fit | 88 → 92 (+4) | Either a co-founder or a first hire reduces solo-founder risk. Founder learns to delegate (the hardest part). |
| Timing | 70 → 85 (+15) | Live in 3 universities, not 1. First-mover position locked before bigger competitors enter. Press coverage in TechCabal or Techpoint. |
| Risk-adjusted prospects | 68 → 85 (+17) | Function of the others. Doesn't move directly. Moves when the rest move. |

## Total Gap to Close

From 73/100 to 90/100. That's 17 points across 8 dimensions. The doc is structured so each section closes one or two specific gaps. Don't skip sections that don't feel urgent — they exist because the score doesn't move without them.

# Section 3 — Go/No-Go Decision Gates

| **Why this section exists** v3 is a 4–5 month commitment. If v2 doesn't validate the thesis, building v3 is the most expensive mistake you can make in 2026. These gates exist to force the honest conversation at three points before you've burned all your time. |
| --- |

## Gate 1 — August 15, 2026 (After Defense Season)

This is the most important gate. Two months of v2 in market with the defense-season revenue window included. By this date you have real data on whether students will pay for FYPro at scale.

### **Pass criteria — meet at least 4 of 6**

- 1,500+ total free signups since June 12 launch.

- 100+ paid conversions (any tier).

- ₦400,000+ total revenue collected since launch.

- At least 1 institutional pilot conversation underway (lecturer or HoD has agreed to a free pilot).

- Day-30 retention above 25% — meaning users come back after their first session.

- At least 5 unsolicited testimonials or organic shares in DMs / public posts.

### **If you fail (3 or fewer criteria met)**

- Do not start v3 build on August 18.

- Spend 2–3 weeks doing user interviews with 20+ existing users. Find out what's actually wrong.

- Decide between three paths: pivot the product (different feature set, same audience), pivot the audience (same features, different audience like Masters students), or sunset FYPro and start something new.

- Whatever you decide, document it. Don't drift into v3 build by default.

### **If you pass (4–5 criteria met)**

- Conditional go. Start v3 prep but adjust scope — drop SIWES module, focus on closing one institutional contract first.

### **If you crush (all 6 criteria met)**

- Full go. Execute v3 plan as written. Consider hiring earlier than week 8 if revenue trend is strong.

## Gate 2 — October 5, 2026 (Week 7 of v3 Build)

Mid-build checkpoint. By now v3 build should be roughly 50% done. This gate catches projects drifting before it's too late.

### **Pass criteria — meet at least 3 of 4**

- Masters Proposal Builder — built and tested with at least 5 real Masters applicants.

- Supervisor Dashboard — UI complete, basic functionality working, lecturer pilot lined up for week 12.

- v2 retail revenue still tracking — not declining month-over-month.

- v3 build hours actually spent on planned tasks (not derailed by support, fires, or new features).

### **If you fail (2 or fewer)**

- Pause v3 build for 1 week. Diagnose what's slipping.

- Cut scope using Section 13. Don't extend timeline.

- If revenue is declining, hire freelancer support (₦30,000–₦50,000/week) to handle v2 customer support so you can focus.

## Gate 3 — November 21, 2026 (Pre-Launch)

Final gate. One week before the planned launch. This is where you decide if v3 actually goes live or if it slips.

### **Pass criteria — meet all 5**

- All planned v3 features built and tested in staging.

- At least 1 institutional contract signed (or signing imminent — within 2 weeks).

- Beta tested by at least 15 real users (mix of student and supervisor).

- Critical path test suite passing 100% — no known crash bugs.

- Launch comms drafted, scheduled, and ready to go.

### **If you fail any one**

- Push launch by 1 week. Maximum 2 weeks. Beyond 2 weeks, push to January 2027 — don't launch into Christmas/New Year.

- Use the extra time only on the failed criterion. Don't add new scope.

# Section 4 — Phase 1: Running v2, Prepping v3

June 13 to August 15, 2026 — about 9 weeks. You are not building v3 yet. You are running v2, generating revenue, gathering data, having institutional conversations, and laying groundwork for v3. This phase determines whether v3 happens at all.

## Weekly Themes During Phase 1

| **Weeks** | **Theme and Focus** |
| --- | --- |
| Weeks 1–2 (June 13 – June 26) | Launch reaction. Reply to every user. Fix bugs as they appear. Note feature requests but don't build them. The job this week is showing up, not improving. |
| Weeks 3–4 (June 27 – July 10) | Defense season starts. Engineering departments at most Nigerian universities defend in July. This is your peak revenue window. Don't disrupt the product — just push acquisition hard. |
| Weeks 5–6 (July 11 – July 24) | Defense season peaks. First institutional outreach. Send the 5 cold emails to UNILAG HoDs from your list. Have the pilot proposal ready. |
| Weeks 7–8 (July 25 – August 7) | User interviews. Talk to 20+ paid users by phone or video. Specific questions: what would they pay for next year? Would they recommend? What's missing? This data shapes v3. |
| Week 9 (August 8 – August 15) | Decision week. Run Gate 1 analysis. Document the decision. Begin v3 prep work or pivot — whichever the data tells you. |

## What to Track During Phase 1

- Total signups (cumulative and weekly delta).

- Conversion to paid (% and absolute).

- Revenue (cumulative).

- Day-7, day-14, day-30 retention.

- Top 5 features by usage.

- Support tickets / messages received per week.

- Time spent on support vs everything else.

- Cost per acquired user (track if you spend any money on ads).

## Phase 1 Critical Tasks

- Set up a simple dashboard (Google Sheet is fine) that updates daily with the metrics above.

- By week 4 — 5 institutional cold emails sent. By week 6 — at least 2 follow-ups. By week 8 — at least 1 pilot conversation.

- By week 6 — interview 5 of your highest-paying users. Ask them what they'd pay for next.

- By week 8 — interview 5 churned users. Ask why they didn't return. (This is harder. Send a personal message offering a free Defense Pack in exchange for 15 minutes.)

- By week 9 — write the Gate 1 analysis. Be honest. The data tells the story, not your hopes.

# Section 5 — Phase 2: v3 Build Schedule

August 18 to November 28, 2026 — 14 weeks. Each week has a single theme. Daily tasks within each week are indicative — adjust based on real progress. Cut, don't extend.

Tools legend stays the same as v2: CC = Claude Code, Manual = direct VS Code work, Browser = dashboards (Supabase, Paystack, Vercel), Claude.ai = strategic chat. Add now: Hire = work delegated to your hire (only applies after week 5–8 if hire is in place).

## Week 1 (Aug 18 – Aug 22) — Setup and Architecture

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 1 | Mon Aug 18 | v3 architecture review. Document what changes vs v2 — new tables, new routes, new API endpoints. | Claude.ai + Manual | Sketch in this chat first. Don't write code today. |
| 2 | Tue Aug 19 | Set up staging environment on Vercel. Separate Supabase project for staging. | Browser + CC | This is where v3 builds happen. Production stays untouched. |
| 3 | Wed Aug 20 | Set up Sentry. Wire it into the existing v2 production codebase first — start collecting real error data immediately. | CC | Free tier covers 5K errors/month. Plenty for v3-stage usage. |
| 4 | Thu Aug 21 | Vitest setup. Write your first 5 tests on the most-used v2 paths (signup, payment, defense session start). | CC | Solo founders skip tests until they break things in production. Don't be that founder. |
| 5 | Fri Aug 22 | Database schema design for v3 features. Tables for: masters_proposals, supervisor_pilots, defense_question_archive, referrals. | Claude.ai + Browser | Schema decisions made fast become tech debt. Spend the day getting it right. |

## Week 2 (Aug 25 – Aug 29) — Masters Proposal Builder Foundation

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 6 | Mon Aug 25 | Masters Proposal Builder — UI design and routing. New section in /app for post-graduation features. | CC | Reuse existing design system. Don't reinvent. |
| 7 | Tue Aug 26 | Masters Proposal Builder — first prompt engineering session. The system prompt has to be different from FYP — Masters research is more rigorous. | Claude.ai | Write the prompt in chat first. Test with 3 real Masters topics from real applicants if possible. |
| 8 | Wed Aug 27 | Masters Proposal Builder — wire up the actual flow. Topic refinement → research gap identification → proposal structure. | CC | Pattern matches FYP workflow. Speed should be high. |
| 9 | Thu Aug 28 | Masters Proposal Builder — supervisor matching feature. Suggests potential Masters supervisors based on topic and Nigerian university research focus areas. | CC | Use OpenAlex API to find researchers actively publishing in the topic area at Nigerian universities. |
| 10 | Fri Aug 29 | Masters Proposal Builder — testing with 5 real Masters applicants. Recruit through your existing user base. | Manual | Pay them ₦2,000 each in exchange for 30 minutes feedback. Worth it. |

## Week 3 (Sep 1 – Sep 5) — Supervisor Dashboard Foundation

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 11 | Mon Sep 1 | Supervisor Dashboard — separate auth role in Supabase. Lecturer accounts cannot see student-only views and vice versa. | Browser + CC | Row-level security policies in Supabase. This is where mistakes leak data. |
| 12 | Tue Sep 2 | Supervisor Dashboard — UI for the lecturer's main view. List of assigned students with traffic-light status. | CC | Mock data for now. Real data wires up later this week. |
| 13 | Wed Sep 3 | Supervisor invite system. A lecturer generates a unique code; students enter it during signup to be linked to that supervisor. | CC | This is the trust layer — if invites are easy to spoof, the whole institutional pitch dies. |
| 14 | Thu Sep 4 | Supervisor Dashboard — drill-down view per student. Shows their validated topic, methodology, current chapter status, flagged weaknesses. | CC | Reuse data from existing student-side views. Different presentation, same source data. |
| 15 | Fri Sep 5 | Supervisor Dashboard — comment system. Lecturer leaves notes that the student sees in their dashboard. | CC | Simple feature, big trust signal. Lecturers stay engaged when they can see their input matters. |

## Week 4 (Sep 8 – Sep 12) — Supervisor Dashboard Polish + Testing

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 16 | Mon Sep 8 | Supervisor Dashboard — analytics view. Lecturer sees aggregate stats: how many students validated topics, how many on track, how many need intervention. | CC | This is the slide that makes HoDs sign contracts. Make it clear and printable. |
| 17 | Tue Sep 9 | Supervisor Dashboard — bulk actions. Email all students who haven't logged in this week. Schedule a group meeting through the dashboard. | CC | Email goes through Supabase or a simple service like Resend. |
| 18 | Wed Sep 10 | Recruit 1 sympathetic UNILAG lecturer to pilot the dashboard for 2 weeks. Set up their account, give them access, walk them through it. | Manual | If you don't have a lecturer ready by today, your Phase 1 outreach failed. Critical signal. |
| 19 | Thu Sep 11 | Bug fixes from lecturer's first day of use. Note every confusion point. | CC | Lecturers will use it differently than you expect. Listen, don't argue. |
| 20 | Fri Sep 12 | Document the lecturer feedback. Use it to write the institutional pitch deck (separate task in Section 8). | Manual + Claude.ai | Day off from coding. Document, plan, breathe. |

## Week 5 (Sep 15 – Sep 19) — Referral Mechanic + Hire Decision

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 21 | Mon Sep 15 | Hire decision day. Review v2 revenue trend. Are you generating enough to hire ₦80,000–₦120,000/month part-time? | Manual | If yes — start the hiring process this week (Section 7). If no — keep building solo, revisit at week 8. |
| 22 | Tue Sep 16 | Referral mechanic — schema and routing. Each user gets a unique referral code in their dashboard. | CC | Track referrals_made and referrals_completed columns on user table. |
| 23 | Wed Sep 17 | Referral reward logic. 3 successful referrals = free Defense Pack. 1 successful referral = 50% off student pack. | CC | Referrals are 'successful' when the new user signs up AND completes Topic Validator. Don't reward signups alone. |
| 24 | Thu Sep 18 | Referral UI in dashboard. Show progress: 'Refer 2 more friends to unlock free Defense Pack'. | CC | Visual progress bars work better than numbers. |
| 25 | Fri Sep 19 | Test referral mechanic end-to-end. Sign up with a new email, use a real referral code, verify reward unlocks. | Manual | Bugs in this flow look like fraud — fix them before any user finds them. |

## Week 6 (Sep 22 – Sep 26) — Dataset Layer + Defense Question Archive

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 26 | Mon Sep 22 | Dataset architecture — design the defense_question_archive table. Captures: question asked, faculty, university, methodology type, student score, anonymous user ID. | Claude.ai + Browser | Privacy by design. No PII in the archive. |
| 27 | Tue Sep 23 | Wire the defense simulator to write to the archive after every session. Anonymous, opt-in (default opt-in with clear setting to opt out). | CC | Add the consent text to the Defense Mode entry screen. |
| 28 | Wed Sep 24 | Build a simple analytics view (admin-side) that lets you see what questions are most common per faculty. | CC | This is your moat starting to compound. Each session adds to it. |
| 29 | Thu Sep 25 | Use the archive to improve the Three-Examiner Panel. The External Examiner especially should pull from the archive when generating questions. | CC + Claude.ai | Now your examiner is asking real questions actually used at Nigerian universities, not invented ones. |
| 30 | Fri Sep 26 | Buffer day. Catch up on anything that slipped this week. | — | Take it if everything's clean. If not, finish the week's tasks. |

## Week 7 (Sep 29 – Oct 3) — SIWES B2B2C Module

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 31 | Mon Sep 29 | SIWES interview module — design. New section: 'For Companies' that lets a company evaluate a SIWES candidate via Defense Simulator. | Claude.ai + CC | Different system prompt — examiner asks technical questions about the candidate's claimed skills, not academic research. |
| 32 | Tue Sep 30 | SIWES module — separate company auth flow. Companies have their own dashboard with multiple candidates. | CC | Reuse the role-based auth from Supervisor Dashboard. |
| 33 | Wed Oct 1 | SIWES module — candidate report generation. After a candidate completes the simulated interview, the company gets a one-page report. | CC | PDF or shareable link. Companies want to forward to hiring managers. |
| 34 | Thu Oct 2 | Pricing page for SIWES module. Pitch to companies: ₦5,000 per candidate evaluated, or ₦50,000/month unlimited. | Manual + CC | Test pricing later — the page just needs to exist for outreach. |
| 35 | Fri Oct 3 | Cold outreach to 5 Nigerian companies that hire SIWES interns (Andela, Flutterwave, Paystack, mid-size oil & gas firms, manufacturing). | Manual | LinkedIn DMs to HR / Talent leads. Even if 1 of 5 responds, that's a real pilot. |

## Week 8 (Oct 6 – Oct 10) — Gate 2 Mid-Build Checkpoint

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 36 | Mon Oct 6 | Gate 2 analysis. Review against criteria in Section 3. Document honestly. | Manual + Claude.ai | If failing, pause build for 1 week and diagnose. Don't push through and hope. |
| 37 | Tue Oct 7 | Based on Gate 2 result — either continue with full plan, or trigger scope cuts from Section 13. | Manual | Decision day. Write down what you decide and why. |
| 38 | Wed Oct 8 | End-to-end testing of all v3 features built so far. List every bug, every UX issue. | Manual | Don't fix today. Document only. Fix in next two days. |
| 39 | Thu Oct 9 | Bug fixes — half the day on critical issues from yesterday. | CC | Crashes first, UX issues second, polish last. |
| 40 | Fri Oct 10 | Bug fixes continued + write a one-pager for institutional pitch using lecturer pilot data. | CC + Manual | By end of today the v3 product should feel solid. If it doesn't, that's the signal to cut scope. |

## Week 9 (Oct 13 – Oct 17) — Test Suite + Performance

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 41 | Mon Oct 13 | Vitest expansion — write tests for the 10 most critical paths in v3. | CC | Signup, login, payment, defense session, supervisor dashboard, Masters proposal flow, referral redemption, etc. |
| 42 | Tue Oct 14 | Playwright setup for end-to-end browser tests. Cover the full 'sign up → use product → pay' user flow. | CC | Slower tests but they catch bugs that unit tests miss. |
| 43 | Wed Oct 15 | Performance audit. Lighthouse on every major page. Fix anything below 80 score. | Manual + CC | Mobile performance especially. Most Nigerian students are on mid-range phones over patchy networks. |
| 44 | Thu Oct 16 | Image optimisation. Compress all images, use WebP where possible, lazy-load anything below the fold. | CC | Page weight reduction = better experience on 3G. |
| 45 | Fri Oct 17 | Database query optimisation. Find any slow queries (Supabase has a query analyzer). Add indexes where needed. | Browser + CC | By v3 you'll have enough data that bad queries become noticeable. |

## Week 10 (Oct 20 – Oct 24) — Deployment Pipeline + Documentation

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 46 | Mon Oct 20 | GitHub Actions CI pipeline. On every push to main, run tests automatically. Block merges if tests fail. | CC | Solo founder protection. Stops you from breaking production at 2am. |
| 47 | Tue Oct 21 | Staging deploy automation. Pushes to a staging branch deploy to staging URL automatically. | CC + Browser | Standard for any real product. Skipped by hackathon projects, required for v3. |
| 48 | Wed Oct 22 | Production deploy with rollback capability. Vercel handles this — just confirm rollback works for a real scenario. | Browser | Test rollback by deploying a bad version, rolling back, confirming production restored. |
| 49 | Thu Oct 23 | Internal documentation. Write a 'how FYPro works' doc for yourself or a future hire. Architecture diagram, deployment process, common issues. | Manual + Claude.ai | You'll forget. The doc remembers. |
| 50 | Fri Oct 24 | Public-facing changelog page on the site. /changelog or /whats-new. Lists every release with date and changes. | CC | Users notice this. Lecturers especially — they want signs of active maintenance before signing institutional contracts. |

## Week 11 (Oct 27 – Oct 31) — Institutional Sales Sprint

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 51 | Mon Oct 27 | Build the institutional sales materials. One-page proposal, 5-slide pitch deck, demo video. | Claude.ai + Manual | Section 8 has the structure. Use it. |
| 52 | Tue Oct 28 | Send pilot results from your week-3 lecturer pilot to 10 more HoDs. 'Here's what happened with one cohort. Want to run the same pilot in your department?' | Manual | Real evidence beats cold pitches. Use it. |
| 53 | Wed Oct 29 | Schedule meetings with anyone who responds. Aim for 3 HoD meetings before launch. | Manual | Be flexible on timing. Make their life easy. |
| 54 | Thu Oct 30 | First HoD meeting (probable date if responses come in). Walk through the live product. | Manual | Section 8 has the meeting script. |
| 55 | Fri Oct 31 | Follow up every meeting with a one-page proposal within 24 hours. Send a calendar invite for the pilot start date. | Manual | Speed of follow-up matters more than depth. Send within hours, not days. |

## Week 12 (Nov 3 – Nov 7) — Buffer + Polish

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 56 | Mon Nov 3 | Polish pass on all v3 features. Animation timing, transitions, loading states, error messages. | CC | No new features. Just making things feel right. |
| 57 | Tue Nov 4 | Mobile experience deep audit. Open every page on your phone, walk through every flow. | Manual | Mobile bugs reveal themselves only on real devices. Don't trust browser dev tools alone. |
| 58 | Wed Nov 5 | Copy review across the entire site. Read every line aloud. Cut anything that doesn't earn its place. | Manual + Claude.ai | Words you wrote in week 1 sound different in week 12. Update them. |
| 59 | Thu Nov 6 | Update all marketing assets — landing page, pricing page, about page — to reflect v3 features. | CC + Manual | Consistency check. Same value props everywhere. |
| 60 | Fri Nov 7 | Buffer day. Whatever's left. | — | Or rest. You've earned it. Two weeks of launch prep ahead. |

# Section 6 — Phase 3: Pre-Launch and Launch

November 10 to December 12. Two weeks of pre-launch prep, then launch week. This is the calmest phase if you've executed the build well — most work is communications and final bug-hunting.

## Week 13 (Nov 10 – Nov 14) — Beta Recruitment and Soft Test

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 61 | Mon Nov 10 | Recruit 20 beta testers across 4 categories: 5 v2 paying users, 5 new users, 5 lecturers, 5 SIWES candidates. | Manual | Mix matters. Different angles surface different bugs. |
| 62 | Tue Nov 11 | Send beta invites with a structured feedback form. Ask 5 specific questions, not 'what do you think'. | Manual | Specific questions: did anything crash? Was anything confusing? Would you recommend? What's missing? What's broken? |
| 63 | Wed Nov 12 | Beta testing in progress. Monitor Sentry. Reply to every feedback message within hours. | Manual + CC | Beta period is for catching things, not improving things. Note feature requests, don't build them. |
| 64 | Thu Nov 13 | Daily fixes from beta feedback. Crash bugs first. | CC | Aim to clear all crash reports by end of day. |
| 65 | Fri Nov 14 | End of beta week 1. Compile feedback into a doc. Decide what's required for launch vs what waits. | Manual + Claude.ai | Required: anything that breaks or confuses. Wait: feature requests, polish wishes. |

## Week 14 (Nov 17 – Nov 21) — Final Polish + Gate 3

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 66 | Mon Nov 17 | Continue beta fixes from week 13. | CC | Critical issues only. No scope expansion. |
| 67 | Tue Nov 18 | Run the full v3 test suite. Investigate any failures. Re-run until clean. | CC | Tests passing != bugs absent. But tests failing means definitely bugs present. |
| 68 | Wed Nov 19 | Drafts of all launch comms. Twitter thread, LinkedIn post, WhatsApp message, Instagram Reel script, TikTok video. | Claude.ai + Manual | Have these ready. Don't draft on launch day. |
| 69 | Thu Nov 20 | Pre-launch press outreach. Email TechCabal, Techpoint, BusinessDay tech with embargoed product info. | Manual | Pitch them the story before launch. They prefer scoops to coverage of already-launched things. |
| 70 | Fri Nov 21 | Gate 3 analysis. All 5 criteria met? Yes — launch as planned. No — push by 1–2 weeks. | Manual | Don't launch with known crash bugs. Don't launch without an institutional contract or imminent signing. |

## Week 15 (Nov 24 – Nov 28) — Pre-Launch Quiet Week

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 71 | Mon Nov 24 | Soft launch — share v3 with v2 paying users only. They get early access as a thank-you. | Manual | Loyalty signal. They appreciate it. They share it. |
| 72 | Tue Nov 25 | Monitor v3 with the soft-launch cohort. Fix any urgent issues. | Manual + CC | If v2 paying users churn from v3 problems, do not public-launch. Pause. |
| 73 | Wed Nov 26 | Final dry run of launch day. Schedule posts, prepare reply templates, set up Sentry alerts to your phone. | Manual + Browser | Walk through the whole day on paper. What posts when? Who do you reply to first? |
| 74 | Thu Nov 27 | Quiet day. Light coding only. Rest. | — | Pre-launch nerves are real. Sleep matters. |
| 75 | Fri Nov 28 | Final pre-launch check. Production environment confirmed stable. Backup plans in place. | Manual + Browser | If anything looks off today, push launch by a week. Better to launch clean than launch on date. |

## Week 16 (Dec 1 – Dec 5) — Launch Week

| **Day** | **Date** | **Task** | **Tool** | **Notes** |
| --- | --- | --- | --- | --- |
| 76 | Mon Dec 1 | Public launch day. WhatsApp blast at 9am. Twitter thread at 11am. Instagram Reel at 2pm. TikTok at 5pm. LinkedIn at 7pm. | Manual + Browser | Stagger to maximize attention across the day. |
| 77 | Tue Dec 2 | Day +1. Reply to every comment, every DM, every message. Push fixes for any post-launch bugs. | Manual + CC | First 48 hours determine the launch narrative. |
| 78 | Wed Dec 3 | Day +2. Share early metrics if impressive. Or share an honest 'here's what's happening' update. | Manual | Transparency wins followers. Hiding doesn't. |
| 79 | Thu Dec 4 | Day +3. Reach out to journalists who covered v2 (or didn't) with the v3 angle. | Manual | Different story now. Live in 3 universities, not 1. Press will care more. |
| 80 | Fri Dec 5 | Week 1 wrap. Numbers. Lessons. Plans. | Manual + Claude.ai | Don't disappear after launch. The first 30 days are when v3 succeeds or doesn't. |

# Section 7 — The Hiring Playbook

Your first hire matters more than any feature. Get it right and v3 becomes a 50% lighter lift. Get it wrong and you've added a person to manage on top of building a product.

## When to Hire

- Trigger 1 — Revenue. Sustained ₦200,000+/month for 2 consecutive months. This is your floor for ₦80,000–₦120,000 part-time hire.

- Trigger 2 — Time. You spend more than 15 hours/week on non-coding work (support, social media, outreach). That's 15 hours of v3 build you're losing.

- Trigger 3 — Coursework. Your own academic load is starting to suffer. The hire is the lever that protects both.

If 2 of 3 triggers are present, hire. If only 1 is present, wait until at least 1 more triggers.

## Who to Hire First

Two roles to choose between. Pick based on what's eating your time.

| **Role** | **When and Why** |
| --- | --- |
| Community Manager / Growth | Pick this if your time is being eaten by support, social media, university outreach, WhatsApp groups. They handle all of it. You build. Profile: a 300- or 400-level student at a Nigerian university (any university). Strong English writing. Active on Twitter/X. Already in 5+ student WhatsApp groups. ₦80,000–₦100,000/month for 20 hours/week. |
| Junior Developer | Pick this if your time is being eaten by bug fixes, customer-reported issues, infrastructure work. They handle the routine code. You handle architecture and new features. Profile: a 400-level Computer Science student or a recent graduate with 1 year of React experience. ₦100,000–₦140,000/month for 25 hours/week. |

Default recommendation: Community Manager first. The thing eating your time as a solo technical founder is almost always non-technical work. You can ship code 2x faster than you can grow an audience.

## Where to Find Them

- Twitter/X. Post 'Hiring a part-time community manager for FYPro. ₦100k/month, 20 hours/week. Must be a current Nigerian university student. DM with your handles + a 100-word answer to: how would you grow FYPro on WhatsApp.' This single post will get 30+ applications.

- CourseMap network. Anyone who used CourseMap and has been engaged is a viable candidate. They already understand the ecosystem.

- Final-year students who paid for FYPro and used it well. They've shown they care about the product. Reach out personally.

- LinkedIn for Junior Developer role specifically. Filter for Nigerian university CS students with React projects.

## How to Interview

60 minutes. Three parts.

- First 15 minutes — story. Why FYPro? What's their experience with their own final year project? Are they paying users? Do they understand the user?

- Next 30 minutes — practical task. For Community Manager: 'Here's a v3 launch announcement. Critique it and rewrite it for X.' For Junior Developer: 'Here's a small feature spec. Walk me through how you'd build it. No coding, just architecture.' Watch how they think under pressure.

- Final 15 minutes — your questions. Compensation expectations. Hours availability. Other commitments. What would they want to grow into?

Don't hire on the first interview. Sleep on it. Talk to a second candidate. Compare. Then decide.

## Trial Period and Contract

- 4-week paid trial at full rate. Either side can end the relationship at the end of the trial with no hard feelings.

- Simple written agreement. One page. Section 14 has a template.

- Clear deliverables for the trial. For Community Manager: 'increase WhatsApp community by X members, run 2 successful posts that drive 50+ signups, handle all support inbox.' For Junior Developer: 'ship 2 small features end-to-end, fix 10 bugs from the queue.'

- After trial — formal 6-month contract. Reviewable monthly.

## Common Mistakes

- Hiring a friend without a written agreement. Friends with money disputes stop being friends.

- Hiring before revenue can support it. Underpaying creates resentment. Pay properly or wait.

- Hiring full-time before 6 months part-time. Full-time hires need full-time work, and you don't have that yet.

- Not delegating after hiring. The whole point is delegation. If you keep doing the work yourself, you've added cost without adding capacity.

# Section 8 — Institutional Sales at Scale

v2 had a basic outreach playbook. v3 needs an actual sales motion. The difference: v2 was about getting one university to consider a pilot. v3 is about running a multi-stage sales pipeline with several universities at different stages simultaneously.

## The 5-Stage Pipeline

| **Stage** | **Definition** | **Conversion to Next Stage** |
| --- | --- | --- |
| Stage 1: Cold | HoD or relevant decision-maker has been emailed but not responded. | 30% reply within 2 weeks if email is good. Aim for 30%+. |
| Stage 2: Engaged | They've replied, expressed interest, agreed to a meeting or info call. | 60% take a real meeting if you respond fast (under 24 hours). |
| Stage 3: Pilot Discussion | Meeting happened. They're interested in a pilot. Working out logistics. | 70% start a pilot if you make it small enough and risk-free. |
| Stage 4: Pilot Active | Pilot is running with real students. | 50% convert to a contract if pilot data is positive and follow-up is strong. |
| Stage 5: Contract Signed | Money committed for at least one semester. | — |

Math: to sign 2 contracts by launch (Gate 3 criterion), you need roughly 12 active pilots. To get 12 pilots, you need 25 engaged conversations. To get 25 engaged conversations, you need 80–100 cold emails sent. Plan accordingly. Most v3 institutional sales work is volume, not finesse.

## The Pitch Deck for HoDs

Five slides. No more. HoDs are busy.

- Slide 1 — The problem. One image (chart or photo). One sentence. 'Final year students at Nigerian universities receive an average of 90 minutes of supervisor time per semester. They defend research they've never been seriously challenged on.'

- Slide 2 — FYPro overview. Three icons (workflow, defense simulator, supervisor dashboard). Three sentences. Don't oversell.

- Slide 3 — Pilot results. Real data from your week-3 UNILAG lecturer pilot. 30 students, X% completion, Y testimonials, Z hours saved for the supervisor. This is the slide that closes.

- Slide 4 — How the partnership works. ₦500/student/semester. Free pilot first. They keep their data and their students' data.

- Slide 5 — Next step. Specific. 'Pilot starts Monday. 30 students. 4 weeks. No cost. Results presented to you on Day 28.'

## The 30-Day Sales Cadence

Repeating monthly cadence. Once you start it, never break it. Inconsistency kills pipelines.

- Week 1 of every month — 20 cold emails sent to new universities.

- Week 2 of every month — Follow up on Week 1 emails. Schedule meetings with anyone engaged.

- Week 3 of every month — Run scheduled meetings. Send pilot proposals within 24 hours of every meeting.

- Week 4 of every month — Follow up on pilot proposals. Convert to active pilots or formally close out.

## Universities to Target — Tiered List for v3

| **Tier** | **Universities (in order)** |
| --- | --- |
| Tier 1 — Lock these by launch | UNILAG (Engineering, Computer Science, Sciences departments specifically). University of Ibadan. OAU. Lagos State University. Covenant University. |
| Tier 2 — Active pipeline by launch | Babcock University. UNN. Federal University of Technology Akure. University of Benin. Ahmadu Bello University Zaria. |
| Tier 3 — Cold pipeline by launch | FUT Minna. University of Ilorin. Bayero University Kano. Kwara State University. Pan-Atlantic University. |

## Pilot Operating Model

Once a pilot starts, here's how to run it for maximum conversion to contract.

- Day 0 — Set up the cohort. Create supervisor accounts. Send personalized invite to each student via the lecturer.

- Day 1 — Welcome message in a dedicated WhatsApp group. Walk-through video for the lecturer.

- Day 7 — First check-in with the lecturer. 15-minute call. What's their experience? Any friction?

- Day 14 — Mid-pilot review. Show the lecturer their dashboard analytics. 'Here's what your students have done.'

- Day 21 — Capture testimonials. Both lecturer and 2–3 students. Permission to use in marketing.

- Day 28 — Final report meeting. Present results, propose contract. Close on the spot if possible. If not, follow up within 48 hours.

# Section 9 — SIWES B2B2C Playbook

SIWES (Students Industrial Work Experience Scheme) is a Nigerian engineering and applied-sciences requirement. Students do 6-month placements at companies during their final year. Companies receive these candidates, often have no good way to evaluate them, and frequently give them unstructured tasks. FYPro has a defense simulator. With a different system prompt, that simulator becomes an interview tool. New revenue stream, same product.

## Why This Works

- Companies already pay for assessment platforms (HackerRank, TestGorilla) — but those are generic and English-centric. FYPro can be tuned for Nigerian context.

- The Defense Simulator code already exists. Adding a SIWES mode is mostly prompts and UI.

- It opens a B2B revenue line that doesn't depend on universities (slower, harder to close) — companies can sign in days, not months.

- Each company that signs becomes a credible reference for the next company.

## Pricing for SIWES

| **Tier** | **Price and What's Included** |
| --- | --- |
| Pay-per-candidate | ₦5,000 per candidate evaluated. Company gets a one-page evaluation report. Good for small companies hiring 2–5 SIWES candidates per year. |
| Quarterly | ₦40,000 per quarter unlimited evaluations. Good for mid-size companies running structured SIWES programs. |
| Annual | ₦120,000 per year unlimited + custom branding + interview question customization. Good for large companies with dedicated talent teams. |

## Target Companies

- Andela, Flutterwave, Paystack — they hire engineering interns, have HR teams, can sign in days.

- Lagos manufacturing firms — Dangote subsidiaries, Lafarge, Nigerian Breweries. They hire mechanical and chemical engineering SIWES students.

- Oil & gas mid-size firms — they hire petroleum, chemical, and mechanical engineers. Look at SPDC, Chevron's SIWES partner programs.

- Nigerian banks — they hire business administration and computer science SIWES students.

- Tech consultancies — Accenture Nigeria, Zenith Tech. They hire across multiple disciplines.

## Outreach Approach

- LinkedIn first. Search for 'Talent', 'HR', 'Internship Coordinator' at target companies. Send a personalized DM.

- DM template: 'Hi [name] — I run FYPro, an AI evaluation tool that companies use to interview SIWES candidates. We help you evaluate engineering interns in 30 minutes instead of 2 days. Would a 15-minute call this week work to show you how?'

- Don't pitch in the first message. Just get the meeting.

- Send the actual pitch deck only after they've expressed interest. Different deck than the university one — focus on time saved, candidate quality signal, cost vs. existing assessment tools.

## Targets for Year 1

- Month 1 (December launch month) — 1 paying SIWES company.

- Month 3 — 5 paying SIWES companies.

- Month 6 — 15 paying SIWES companies.

- Year 1 SIWES revenue target — ₦3M–₦5M. Modest but it diversifies away from university dependency.

# Section 10 — The Dataset Moat

This is the section that takes FYPro from 'product anyone can build with prompts' to 'product nobody can build without 12 months of data collection in Nigerian universities'. Done right, this is your most defensible moat.

## What You're Building

- A structured archive of defense questions actually asked at Nigerian universities, sorted by faculty, university, methodology type, and student outcome.

- A library of common methodology mistakes specific to Nigerian undergraduate research.

- A taxonomy of project topics that pass vs. fail validation, by faculty.

- A map of which research areas Nigerian universities actually have supervisors for.

None of this exists publicly. None of it can be scraped. None of it can be generated by a Western competitor without the same time investment in the same market.

## How to Collect Ethically

- Opt-in by default with clear, plain-language consent at Defense Mode entry. Never opt-out by default — that erodes trust.

- Anonymize aggressively. Strip PII. Store only: faculty, university (department-level granularity max), methodology, question text, score, student-side answer summary (not full text).

- Show users what's being collected and what it's used for. 'We use anonymized session data to improve the examiner panel for future students. You can opt out in Settings at any time.'

- Never sell or share raw data. License access to derived insights only (aggregate analytics for institutional partners — never individual student data).

## How the Moat Compounds

- Month 1 — 100 defense sessions. Useful but not yet differentiating.

- Month 6 — 2,000 defense sessions. The examiner panel asks noticeably better questions because it's drawing from real ones.

- Year 1 — 10,000+ defense sessions. The dataset is good enough to license to: (a) other Nigerian universities as benchmarking data, (b) accreditation bodies as research-quality signals, (c) academics studying Nigerian undergraduate research.

- Year 2+ — Cross-university comparative data. 'Methodologies that pass at UNILAG vs. OAU vs. UI' — useful to lecturers, useful to accreditation bodies, structurally impossible for outsiders to replicate.

## Build Order

- v3 week 6 — Set up the archive. Wire defense sessions to write to it. Consent flow live.

- v3 week 6 — Internal admin view that lets you see aggregate patterns.

- v3 week 9–10 — Use the archive to improve the examiner panel. The first feedback loop closes.

- Post-v3 month 1 — Begin extracting weekly insights. 'Top 5 methodology questions across all faculties this week.'

- Post-v3 month 6 — First commercial license discussion (likely with a Nigerian university wanting benchmarking data for their own program review).

## What Not to Do

- Don't claim ownership of the questions themselves — they belong to the academic process. You own the structured archive and derived insights.

- Don't share data with companies hiring SIWES candidates. The student data layer and the company data layer must stay separate forever.

- Don't train Claude or any other LLM on the data without explicit additional consent. Different consent layer, different opt-in.

# Section 11 — Content Engine and Community at Scale

v2 launched with a per-week content schedule. v3 needs a content engine — content production that runs whether you post that day or not. The difference is the difference between 'I posted today' and 'FYPro posts daily'.

## The Engine: Content Library Approach

- Stockpile 30 pieces of content before v3 launches. Mix of educational threads, product demos, founder updates, testimonials.

- Schedule 4–5 weeks of posts ahead of launch using a free scheduler (Buffer free tier covers this).

- Daily posting becomes 30 minutes/day for replies and engagement, not creation.

- Live-fire content (testimonials, real reactions, news) layers on top of scheduled.

## Three Content Engines That Compound

| **Engine** | **How it Runs** |
| --- | --- |
| Defense Simulator clip series | Every Thursday — a new short clip of the AI examiner asking a real student a real question. Students drop their topics in replies. You record the reaction. 60-second TikTok. 90-second Instagram Reel. Gets shared because it's actually entertaining. |
| Weekly research insight thread | Every Monday — a Twitter thread on something useful for final-year students. 'How to read 30 papers in 3 days.' 'The 5 methodology mistakes I see most.' Pulled from the dataset (Section 10) as it grows. Builds authority. |
| Founder build log | Every Friday — short post on what shipped this week, what broke, what you learned. Vulnerable, specific, real. Nigerian students follow founders, not products. |

## The WhatsApp Community

v2 didn't have an official community. v3 needs one. Not for retention (you have product retention) — for compounding word-of-mouth and getting honest feedback fast.

- Launch a 'FYPro Final Years' WhatsApp Community (different from groups — Communities allow multiple sub-groups under one parent).

- Sub-groups for: Engineering & Tech, Business & Social Sciences, Sciences, Arts & Humanities.

- Rules: respectful, on-topic, no spam, no shilling. Moderate hard, lose members early — keeps the survivors engaged.

- You or your hire posts useful content 3x/week. Members ask questions. Examples turn into content.

- Target: 1,000 active members by v3 launch + 90 days.

## Press Strategy

- Pre-launch — embargoed pitch to 3 publications: TechCabal, Techpoint Africa, BusinessDay tech. Story angle: '200-level student builds AI tool serving 5,000+ Nigerian undergraduates with first institutional contracts at multiple universities.'

- Launch week — published coverage in at least one of the three (60% probability if pitched right).

- Post-launch — 'milestone' pieces every quarter. 'FYPro hits 10,000 users.' 'FYPro signs 5th university.' 'FYPro launches Masters product.' Keep the press relationship warm.

# Section 12 — Fundraising as Backup

Default v3 plan is bootstrap. Don't raise unless you have to. But there are scenarios where raising makes sense — this section is for those scenarios.

## Raise If — Trigger Conditions

- Bootstrap stalls. v2 launches but conversion flatlines below 3% for 6+ weeks. You need capital to test new pricing models or pivot fast.

- Inbound investor reaches out unsolicited and offers terms that don't dilute you below 80%. This is rare but worth taking seriously when it happens.

- Institutional sales accelerate beyond your bandwidth. You're getting pilot interest from 5+ universities and you can't run them all alone.

- A serious competitor enters the market with funding. Speed becomes existential. You need cash to win the land grab.

## Don't Raise If — Anti-Trigger Conditions

- Bootstrap is working — revenue growing month-over-month, retention healthy, no specific cash-blocked opportunity. Don't raise to optimize when bootstrap is producing.

- You'd raise to feel legitimate. Founders who raise for the headline regret it within 6 months.

- You haven't proven the institutional model yet. Investors want evidence — pre-evidence raises are dilutive and demoralizing.

- You don't have a clear use of funds. 'I'd hire some people and do some marketing' is not a fundable plan.

## Targets — In Priority Order

| **Source** | **Notes** |
| --- | --- |
| CcHub Mastercard EdTech Fellowship | Up to $100k equity-free. Application opens annually — usually mid-year. Apply when open. The application alone forces clarity worth doing. |
| Tony Elumelu Foundation | $5,000 grant + mentorship. Lower amount but easier criteria. African founder-friendly. Apply for cohort calls. |
| Ingressive Capital | Pre-seed Pan-African focus. Investment amounts ₦15M–₦80M. Cold pitch via founder@ingressivecapital.com if you have ₦500k+ MRR. |
| Future Africa | Founding investor model. $50k–$250k. Pitch via futureafrica.vc. They like solo founders less than partnerships — wait until you have a hire/co-founder. |
| Ventures Platform | Pre-seed African startup. ₦20M–₦100M cheques. Strong network. Apply via vp.vc. |
| Angel investors | Nigerian tech operators (Andela, Flutterwave, Paystack alums) sometimes angel-invest in education products. Network into them via Twitter and LinkedIn after some traction. |

## If You Decide to Raise — The 90-Day Process

- Days 1–14 — Build the materials. Pitch deck (10 slides max). Financial model. One-page summary. Founder bio.

- Days 15–30 — Outreach to 30 investors. Personalized messages, not spray-and-pray.

- Days 31–60 — First meetings. Refine the pitch based on what every investor pushes back on.

- Days 61–90 — Term sheet negotiations if interested investors emerge. Close fast — drawn-out raises kill momentum.

## Anti-Patterns to Avoid

- Raising before product-market fit is proven. Investors smell desperation.

- Raising more than you need. Bigger round = more dilution = more pressure to grow before you're ready.

- Raising from people you can't say no to. Family money complicates everything.

- Pitching one investor multiple times after a pass. They'll change their mind on their own timeline, not yours.

# Section 13 — What to Cut if You Fall Behind

| **Why this section matters** Cutting decisions made under pressure are bad cutting decisions. Make them now, follow them later. When you hit week 8 and you're 2 weeks behind, you don't want to be debating what to cut — you want a list to execute against. |
| --- |

## The Cut Order — Cut From Bottom Up

This is the order to cut features if you fall behind. Cut number 1 first, then 2, then 3, and so on. Don't pick and choose — the order reflects what's most expendable to v3 success.

| **Cut #** | **Feature** | **Why It's First to Cut** |
| --- | --- | --- |
| 1 | SIWES B2B2C Module | It's a separate revenue stream that can ship 3 months after v3. Doesn't make v3 worse if it's missing. ₦5,000–₦40,000 of opportunity cost per company per month — measurable but recoverable. |
| 2 | Referral Mechanic | Distribution win, not product win. Can be added 1 month after v3 launches. Most users won't notice it's missing. |
| 3 | Performance optimization (week 9 work) | Skipping Lighthouse/image optimization is recoverable in a sprint after launch. Real users will tolerate slower load times for 4 weeks while you fix it. |
| 4 | Press push (week 11–14 outreach) | Can be done post-launch. Press is helpful, not essential. |
| 5 | Defense Question Archive analytics view (week 6, partial) | Keep the data collection. Cut the internal admin view. You can build it later. |
| 6 | Masters Proposal Builder polish (week 2 day 5) | Ship the v1 of Masters. Polish in v3.1 a month later. |
| 7 | Supervisor Dashboard analytics (week 4 day 1) | Ship the dashboard with student list and drill-down. Cut the analytics view if needed. HoDs care about being able to see students; analytics is the cherry. |
| 8 | GitHub Actions CI (week 10 day 1) | Skipping CI is risky but survivable. Manual deploys work. Add CI in v3.1. |

## Hard 'Don't Cut' List

These items are non-negotiable. Even if everything else has been cut, do not cut these:

- Sentry error tracking. Cutting this means launching blind.

- At least one institutional pilot completed. Without it, the v3 launch story falls apart.

- Test suite covering payment and signup flows specifically. Cutting these creates fraud and revenue bugs.

- Beta testing in week 13. Without real users testing v3, you launch to public with unknown crash bugs.

- Gate decisions. Skipping the gates is how 4 months of work gets thrown away.

## If You're 4+ Weeks Behind — Stop

If by week 8 you're 4 weeks behind schedule, you have a structural problem, not a scope problem. Cutting features won't save it. The right call:

- Pause all new development for 1 week.

- Do a structural review. Are you delegating where you should? Is your hire underperforming? Are you context-switching too much?

- Decide: push v3 launch to January 2027 (16-week pivot), or kill v3 and run v2 for another 6 months.

- Either decision is recoverable. Trying to power through a 4-week deficit and shipping a broken v3 is not.

# Section 14 — Contract Templates and Operational Documents

These are starting templates. Get an actual lawyer to review before signing anything binding. Lawyer fees for reviewing a one-page contract in Nigeria run ₦20,000–₦50,000. Worth it.

## Institutional License Agreement (Universities)

- Parties: FYPro (you) and the named department or university.

- Scope: full premium FYPro access for all final-year students in the named department for one academic semester.

- Price: ₦500 per student. Total = ₦500 × number of students at start of semester. Billed once at semester start.

- Payment terms: 50% on signing, 50% within 30 days of semester start. Payment via bank transfer or Paystack invoicing.

- Data ownership: student data belongs to the student. FYPro retains right to use anonymized session data for product improvement (consistent with public privacy policy). Department receives aggregate analytics.

- Termination: either party can terminate with 60 days written notice after the first full semester. No refunds for partial semesters.

- Liability: FYPro liable for product defects up to the value of the contract. Not liable for student academic outcomes.

- Renewal: automatic renewal for next semester unless either party gives 30 days notice.

- Signing block: department head, FYPro founder, dates.

## SIWES Company Agreement

- Parties: FYPro and the named company.

- Scope: candidate evaluation services as priced (per-candidate, quarterly, or annual).

- Price: per pricing page tier.

- Payment: net 30 invoicing. Or upfront for quarterly/annual.

- Data: candidate data shared with company is only the evaluation report. Candidate consent obtained at the start of every session. Company cannot use the data outside hiring decisions for the named role.

- Liability: FYPro liable for service-level uptime (95% target). Not liable for candidate hiring outcomes.

- Termination: 30 days written notice from either side.

## Employment Contract for First Hire

- Parties: FYPro and named individual.

- Role: Community Manager OR Junior Developer (per Section 7).

- Hours: 20–25 hours per week. Specific availability windows.

- Compensation: ₦80,000–₦140,000 per month, paid on the last working day of the month.

- Trial period: 4 weeks at full pay. Either side can terminate at end of trial without notice.

- Post-trial: 6-month contract, monthly review. Either side can terminate with 14 days notice.

- Confidentiality: standard NDA — cannot share user data, internal documents, or strategic plans.

- IP assignment: any work product (code, content, communications) belongs to FYPro.

- No moonlighting at competing products (FYP-tools or AI study tools targeting Nigerian students).

- Contractor status: explicitly contractor, not employee. Both sides handle their own taxes.

## Operational Documents to Have

- Privacy Policy — already live for v2. Update for v3 (data archive, supervisor data, SIWES data).

- Terms of Service — update for v3 features (institutional contracts, SIWES, Masters).

- Data Processing Agreement — for institutional partners. Templates available from privacy law sites.

- Refund Policy — clear, public, fair. Helps when disputes happen.

- User Conduct Policy — for the WhatsApp community.

## How to Get These Reviewed

- Find a Nigerian tech-friendly lawyer. CcHub maintains a list. So does the Nigerian Bar Association tech section.

- Budget ₦100,000 for the full contract pack review (institutional + SIWES + employment + operational docs). Pay it once. Reuse the templates.

- If budget is tight — review the institutional license alone first (₦20,000–₦40,000) and use it as the template structure for the rest.

# Section 15 — Common Founder Mistakes (Months 6–12) + Personal Sustainability

Statistically, the period between months 6 and 12 of building a startup is when most Nigerian student founders quit. The hackathon adrenaline is gone. The launch glow is gone. You're 9 months in, the work is harder, the feedback is mixed, your coursework is suffering, and the money is slower than you hoped. This section exists because nobody tells you what this period actually feels like.

## The 12 Common Mistakes

- Building features your loudest users ask for, instead of the features that move metrics. Loud users are not the median user.

- Hiring too late. Founders wait until they're drowning to hire. By then they're too tired to onboard the hire well.

- Hiring too fast. Hiring at the first whiff of revenue, then realizing you can't sustain payroll. Three months later you're firing.

- Spending more time on social media than on the product. Validation feels like progress. It isn't.

- Not raising prices when you should. Underpricing erodes both margin and perceived value.

- Ignoring churn. New signups feel like progress; churned users feel like failure. The math says churn matters more.

- Letting institutional sales drag indefinitely. Pilots without contracts after 90 days are dead. Kill them and move on.

- Avoiding hard conversations with users who are angry. They're the ones telling you what's wrong.

- Comparing yourself to other Nigerian student founders who post numbers on Twitter. Most numbers on Twitter are inflated. Most founders posting them are months from quitting.

- Pivoting too soon. The product takes 12 months to find its rhythm. 6-month pivots usually destroy what's working.

- Not pivoting when you should. The opposite mistake. If something is structurally broken, ignoring it doesn't fix it.

- Letting coursework collapse. Your final year of university is coming. If you fail courses because of FYPro, you've made the wrong trade.

## Personal Sustainability — The Honest Plan

You're a 200-level student today. By v3 launch (December 2026) you're entering 300-level. By month 12 of FYPro you're a 400-level student starting your own final-year project. The very project FYPro is built for. The irony is the point.

To survive the build, three rules:

- Sleep is non-negotiable. 7 hours a night minimum. Sleep deprivation makes every other problem worse.

- Coursework is non-negotiable. Aim for at least 2:1 at minimum across your courses. A First Class is the goal. Failing courses to ship features is a bad trade.

- One day off per week. Truly off — no FYPro, no email, no support. Whatever you do that recharges you, do that day.

## When to Take a Break

- If you cry from frustration on consecutive days — take 3 days off.

- If you're not enjoying any part of building FYPro for 2 weeks straight — take 5 days off.

- If you start having physical symptoms (headaches, stomach issues, sleep problems) — take a week off and see a doctor.

- If your relationships are visibly suffering — take 2 weeks off and repair them.

## The Hardest Truth

FYPro might not work. Despite the planning, the score gaps, the institutional pipeline, the dataset moat — products fail. Most Nigerian startups in your category fail. The expected value of building FYPro is positive — but specific outcomes can still go badly.

If FYPro fails, you will have built something real, learned more than 95% of your peers, met people you wouldn't have met, and shipped a working product to thousands of users. That outcome is not failure. That outcome is rare.

Build for the version where FYPro works. Plan for the version where it doesn't. Both are real possibilities. Don't tie your identity to either.

# Section 16 — v4 Preview: The Realistic Next Layer

If v3 hits 90/100 on December 5, what does v4 look like? This is the realistic version, not the empire fantasy. Each addition is something achievable in 4–6 months with the team and traction v3 produces.

## v4 Themes

- Pan-African expansion. Ghana, Kenya, South Africa first. Same product, university-specific tuning per country. Estimated build: 6 months for 3 countries with localized content.

- Two-sided marketplace — supervisor matching. Pair students with absent supervisors to retired professors, diaspora academics, PhD candidates available for paid mentorship. FYPro takes 20%.

- Multi-product ecosystem with CourseMap and Spectra. Single sign-on, shared user data with consent, cross-product offers. Same student, three products, three jobs.

- Mobile-native version. Most Nigerian students live on phones, not laptops. A real React Native app with offline support changes acquisition costs entirely.

- Lecturer marketplace. Lecturers offer paid 1:1 supervision sessions through FYPro to students at other universities. New revenue stream, new community.

## v4 Build Timeline (Indicative)

- January – February 2027 — Pan-African content tuning + first non-Nigerian university pilot.

- March – April 2027 — Mobile app build (React Native, leveraging existing React codebase).

- May – June 2027 — Supervisor marketplace MVP.

- July – August 2027 — Multi-product ecosystem integration with CourseMap.

- September 2027 — v4 public launch into the new academic year.

## Revenue Targets at v4 (Year 2 of FYPro)

- Annualized revenue: ₦40M – ₦80M depending on institutional contract pace.

- Active institutional contracts: 8–15 across Nigeria + 1–3 in other African countries.

- Active SIWES company contracts: 30+.

- Total registered users: 50,000+.

- Team size: 4–6 (you + 1 senior engineer + 1 community/sales lead + 1 designer + 1 part-time ops).

## The Long Game

v4 is not the end. By year 3 (2028), if everything works, FYPro is a real African EdTech company with 100,000+ users, ₦200M+ ARR, a real moat, and real options — strategic acquirer interest, Series A fundraise, or continued bootstrap to profitability. None of these outcomes are guaranteed. All of them are accessible from where you stand today.

Build v2. Ship it. Run it. Build v3. Ship it. Run it. v4 is what happens after. None of it matters if the next 7 months don't go right.

# Appendix — Tools, Accounts, Resources

## New Tools Needed for v3 (Beyond v2 Stack)

| **Tool** | **Purpose** |
| --- | --- |
| Sentry (sentry.io) | Error tracking. Free tier: 5K errors/month. Worth setting up before v3 build starts. |
| Vitest | Unit testing for React. Free, NPM-installable. Standard in modern React projects. |
| Playwright | End-to-end browser testing. Free. Catches bugs across the full user flow. |
| GitHub Actions | CI/CD pipeline. Free for public repos, generous limits for private. |
| Buffer or Hypefury | Social media scheduling. Buffer free tier covers 3 channels. |
| Resend or SendGrid | Transactional email at scale. Resend free tier: 3K emails/month. |
| Plausible Analytics | Privacy-respecting analytics. ₦15,000/month or self-host. Better than Google Analytics for a privacy-conscious user base. |
| Linear or Notion | Project management as v3 grows. Notion free tier covers personal use; Linear free tier covers up to 250 issues. |

## Useful Communities and Resources

- CcHub Lagos — physical hub, regular events, advisor access. Worth visiting once you're in Lagos.

- Founder Institute Nigeria — free founder programs, mentorship.

- Tony Elumelu Foundation — application open annually.

- EdTech Hub (edtechhub.org) — global resource for ed-tech research and grants.

- Indie Hackers (indiehackers.com) — bootstrap-focused founder community. Useful for retention/pricing tactics.

- Nigerian Tech Twitter/X — follow founders at established companies. They post pattern recognition daily.

## Reading List for the Build

- "The Mom Test" by Rob Fitzpatrick — how to do user interviews properly. Critical for Phase 1.

- "High Output Management" by Andy Grove — how to run yourself and a small team..

- "Hooked" by Nir Eyal — habit formation in products. Useful for v3 retention work.

- "Crossing the Chasm" by Geoffrey Moore — how to move from early adopters to mainstream. Relevant for v3 institutional sales.

- Stripe Atlas guide — best free resource on starting a business properly. African content limited but US fundamentals translate.

## Final Reminders

- Decision points exist for a reason. Use them.

- Cuts are made now, not when you're under pressure.

- Hire when revenue and time-cost both justify it.

- Sleep, coursework, and one day off per week are non-negotiable.

- v3 might not work. Build it well anyway.

| **The single sentence** Run v2 well. Pass Gate 1 honestly. Build v3 with discipline. Ship in December. Everything else in this document serves that core loop. |
| --- |

Page   |  Prepared for Taiwo Ayeni  |  April 26, 2026
# FYPro v3 — Build Plan

**Prepared for:** Taiwo Ayeni (Specstar)
**Build window:** August 18 – November 28, 2026 (14 weeks)
**Launch:** December 5, 2026
**Constraint:** 1–2 hrs/day weekdays, longer weekends, solo

---

## Honest framing before you start

13 features in 14 weeks at 1–2 hrs/day is ~140–200 build hours. The big features (Masters Proposal Builder, Supervisor Dashboard, SIWES module) are 25–40 hrs each. The small ones (.ics, referral) are 4–10 hrs. The math works on paper. It breaks if you lose two weeks to coursework or NEPA.

**The plan below assumes you will lose two weeks somewhere.** That's why 3D Visual Identity and Premium PDF Engine are sequenced last. They are the cuts if Gate 2 says you're behind.

Don't pretend otherwise. Pre-decide the cuts now so you don't agonise over them in October.

---

## 1. Setup Checklist

Complete all of this **before August 18**. Treat it as Phase 1 work. If you start v3 features against the live v2 codebase with no staging and no tests, you will break something paying users depend on.

### 1.1 Staging environment

| Item | Action |
|---|---|
| Supabase staging project | Create new Supabase project named `fypro-staging`. Run all v2 migrations against it. Seed with 5 fake users (one per role). Store new project ref in 1Password / notes. |
| Vercel staging project | Create new Vercel project pointed at `develop` branch. Custom domain: `staging.fypro.com.ng` (add Whogohost DNS record). |
| Env vars on staging | Copy all v2 env vars. Replace Supabase keys, Paystack keys (use **test** keys on staging permanently), Anthropic key (separate one if you can — caps cost). |
| Staging Resend | Send from `staging@fypro.com.ng` so test emails don't pollute the main domain reputation. |
| Sentry environment tag | Add `VITE_SENTRY_ENVIRONMENT=staging` on Vercel staging. So errors are filterable. |

### 1.2 Testing infrastructure

| Item | Action |
|---|---|
| Vitest | `npm i -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom`. Add `test` script to package.json. Create `vitest.config.js`. |
| Playwright | `npm i -D @playwright/test`. Run `npx playwright install chromium`. Create `playwright.config.js` pointed at `https://staging.fypro.com.ng`. |
| Critical-path tests | Write these 6 Playwright tests first (covered in week 1 prompt): signup, login, Topic Validator submit, Defense Sim start, Paystack purchase, share card render. |
| Vitest skeleton | One unit test per existing util in `/api/_lib/` (papers.js, rate-limit.js, entitlements.js). |
| GitHub Actions | Add `.github/workflows/test.yml` running Vitest on every PR. Playwright runs nightly against staging via cron. |

### 1.3 GitHub branch strategy

```
main           → production (fypro.com.ng, auto-deploys via Vercel)
develop        → staging (staging.fypro.com.ng, auto-deploys)
feature/<name> → branched off develop, merged via PR
hotfix/<name>  → branched off main, merged to main AND develop
```

Rule: **no direct commits to `main` during v3 build.** Everything goes through `develop` first. Even one-line fixes. This rule will save you at least once.

### 1.4 New Supabase tables (v3)

Schema below. Run as migrations in `supabase/migrations/` on staging first, then production at week-of-deploy for each feature. RLS must be enabled on every table. INSERT and UPDATE policies are required — not just SELECT.

| Table | Purpose | Key columns |
|---|---|---|
| `masters_proposals` | Masters Proposal Builder output | id, user_id, topic, supervisor_matches (jsonb), draft_content (jsonb), created_at |
| `user_roles` | Role assignment (student/supervisor/admin) | user_id, role, university, faculty, department, created_at |
| `supervisor_invites` | Invite tokens for students→supervisor link | id, supervisor_user_id, token, student_email, status, expires_at |
| `supervisor_student_links` | Active student–supervisor pairing | supervisor_id, student_id, status, linked_at |
| `siwes_companies` | B2B2C licensee accounts | id, company_name, contact_email, billing_status, api_key, created_at |
| `siwes_candidates` | Interns assigned defense-style sessions | id, company_id, candidate_name, candidate_email, session_token, status |
| `siwes_sessions` | Recorded SIWES interview sessions | id, candidate_id, transcript (jsonb), score, evaluator_notes, completed_at |
| `referrals` | Referral relationships | referrer_user_id, referred_user_id, code, status, reward_claimed |
| `defense_question_dataset` | Dataset moat — captured questions | id, examiner_persona, question, project_topic, faculty, response_quality, captured_at |
| `progression_state` | Rigid Progression unlock state per user | user_id, topic_validated, chapters_built, methodology_set, defense_unlocked, updated_at |

Migration order matches feature build order in Section 3. Don't run them all on Day 1.

### 1.5 New environment variables

| Var | Where | When needed |
|---|---|---|
| `OPENAI_API_KEY` | Vercel prod + staging | Week 10 (Whisper) |
| `STAGING_SUPABASE_URL` | local `.env.staging` | Week 1 |
| `STAGING_SUPABASE_ANON_KEY` | local `.env.staging` | Week 1 |
| `PLAYWRIGHT_BASE_URL` | GitHub Actions secret | Week 1 |
| `REFERRAL_REWARD_AMOUNT_NGN` | Vercel | Week 11 (default ₦500) |
| `SIWES_API_HMAC_SECRET` | Vercel | Week 12 |

### 1.6 New third-party accounts

| Service | Why | Cost to start |
|---|---|---|
| OpenAI API | Whisper transcription | $5 minimum credit |
| Three.js / React Three Fiber | 3D Visual Identity | Free (npm package) |
| Spline (optional) | 3D asset design tool | Free tier |
| Playwright Cloud (optional) | Parallel test runs | Free tier sufficient |

**Don't** open new accounts you don't need yet. OpenAI can wait until week 10.

---

## 2. Feature Build Order

Ordered by: foundation first → revenue/risk second → polish last. Rationale in the right column.

| Order | Feature | Why this position |
|---|---|---|
| 1 | **Staging environment** | Everything else assumes it exists. Skip it and you'll deploy half-built features to production at some point. |
| 2 | **Test suite (Vitest + Playwright)** | Same reason. Critical-path tests catch regressions when you start changing core flows in week 3 onward. |
| 3 | **Defense question dataset** (capture pipeline) | Starts collecting passively from day one. Every Defense Sim session from week 3 onward builds the moat for free. Latest start = least dataset. |
| 4 | **.ics Calendar Export** | Easiest feature on the list. Quick win, builds confidence, ships early so users see v3 momentum. 1–2 sessions. |
| 5 | **Rigid Progression System** | Touches dashboard, every step component, session state, localStorage. High blast radius. Must be in early so weeks of work on top of it are protected. |
| 6 | **Local Data Constraints** | Edits to prompts, formatting rules, schema. Touches the same files Rigid Progression just changed. Do them adjacent. |
| 7 | **Masters Proposal Builder** | Biggest feature. ~25–35 hrs. Revenue/LTV impact is highest. Risk of underestimating. Cannot be left late. |
| 8 | **Supervisor Dashboard** | Second biggest. ~20–30 hrs. Required for institutional pitches in October. Depends on `user_roles` table from item 7. |
| 9 | **Referral mechanic** | Cheap and high-leverage. Should be live before Masters Proposal Builder launches publicly so launch traffic gets referral codes. |
| 10 | **Whisper API** | Drop-in replacement for browser SpeechRecognition. Low risk if Defense Sim is stable. Done after the Rigid Progression work touches it. |
| 11 | **SIWES B2B2C Module** | Hard to scope without a real licensee conversation. Built last among revenue features because the contract conversation has to come first. |
| 12 | **Premium PDF Engine** | Polish. Real benefit to users but not core to the product working. First cut if behind. |
| 13 | **3D Visual Identity** | Visual upgrade, not functional. Last because it's a design project not a code project. First cut if behind. |

**Honest note on cuts:** if Gate 2 (Oct 5) shows you behind, drop #13 immediately, then #12. If you're still behind, drop SIWES (#11) — it can ship in v3.1 in January. Do **not** cut Masters Proposal Builder or Supervisor Dashboard — those are why v3 exists.

---

## 3. Week-by-Week Build Schedule

14 weeks: Mon Aug 18 → Sat Nov 28. Each week assumes ~10 hours: 5 weekday sessions × 1.5 hrs + 1 weekend session × 2.5 hrs. Adjust as life requires.

### Week 1 (Aug 18–23) — Foundation: staging + tests

**Theme:** Stop deploying to production with no safety net.

| Day | Task |
|---|---|
| Mon | Create Supabase staging project. Copy schema. Seed 5 test users. |
| Tue | Create Vercel staging project. Connect `develop` branch. Wire `staging.fypro.com.ng`. |
| Wed | Set all env vars on staging. Confirm Paystack test mode, Resend staging sender. |
| Thu | Install Vitest. Write unit tests for `papers.js`, `rate-limit.js`. |
| Fri | Install Playwright. Write critical-path test: signup → onboarding → topic validator. |
| Sat | Write remaining 5 critical-path tests. GitHub Actions config. |

**Prompts to run:** Prompt #STAGING and Prompt #TESTS (Section 4).

**Checkpoint:** `develop` deploys to `staging.fypro.com.ng`. `npm test` passes locally. GitHub Actions runs Vitest on PRs. At least one Playwright test runs against staging.

### Week 2 (Aug 25–30) — Dataset capture pipeline

**Theme:** Start the moat collecting before any user-facing v3 feature ships.

| Day | Task |
|---|---|
| Mon | Create `defense_question_dataset` migration. RLS: insert-only via service role. |
| Tue | Add capture call inside Defense Sim API route after each question generation. |
| Wed | Add response-quality scorer: simple heuristic (length, keyword match, examiner verdict). |
| Thu | Admin view: page in admin dashboard showing dataset size, top topics, capture rate. |
| Fri | Deploy to staging. Run 3 mock Defense Sim sessions. Verify rows appear. |
| Sat | Deploy to production. Monitor first 24 hrs of real captures via Sentry. |

**Prompts to run:** Prompt #DATASET (Section 4).

**Checkpoint:** Dataset table receives a row for every Defense Sim question asked. Admin dashboard shows the count.

### Week 3 (Sep 1–6) — .ics export + start Rigid Progression

**Theme:** Quick win, then start the high-blast-radius work.

| Day | Task |
|---|---|
| Mon | .ics export endpoint built. RFC 5545 format. One VEVENT per planner week. |
| Tue | Download button in Writing Planner UI. Test on iOS, Android, Outlook. |
| Wed | Begin Rigid Progression: create `progression_state` migration. Define unlock rules. |
| Thu | Add `useProgression` hook. Read state from Supabase + localStorage cache. |
| Fri | Wire Topic Validator success → mark `topic_validated = true`. |
| Sat | Lock Chapter Architect entry behind `topic_validated`. Visual lock state. |

**Prompts to run:** Prompt #ICS and Prompt #PROGRESSION-PART1 (Section 4).

**Checkpoint:** .ics download works on three platforms. Topic Validator unlocks Chapter Architect, not the other way around.

### Week 4 (Sep 7–13) — Finish Rigid Progression + start Local Data Constraints

| Day | Task |
|---|---|
| Mon | Lock Methodology Advisor behind Chapter Architect completion. |
| Tue | Lock Writing Planner / Literature Map / Abstract Generator / Instrument Builder in dependency order. |
| Wed | Lock Defense Simulator behind all core steps complete. Update dashboard cards. |
| Thu | Manual chaos test: try to bypass locks via URL. Fix any gaps. |
| Fri | Start Local Data Constraints: faculty word-count table in Supabase. |
| Sat | Citation style picker by faculty in Methodology Advisor. |

**Prompts to run:** Prompt #PROGRESSION-PART2 and Prompt #LOCAL-DATA-PART1 (Section 4).

**Checkpoint:** Workflow steps unlock sequentially. URL bypass attempts fail. Faculty/citation logic begins influencing outputs.

### Week 5 (Sep 14–20) — Finish Local Data Constraints + start Masters Proposal Builder

| Day | Task |
|---|---|
| Mon | UNILAG formatting rules baked into PDF export. |
| Tue | Topic Validator: viability heuristic for Nigerian-university research areas. |
| Wed | Begin Masters Proposal Builder: `masters_proposals` migration. |
| Thu | Route `/app/masters` with auth gate (Defense Pack tier or new Masters Pack tier — pick now). |
| Fri | Step 1 of Masters flow: research interest input → suggested research areas. |
| Sat | Step 2: supervisor matching via OpenAlex API. Cache 24 hr in Upstash. |

**Prompts to run:** Prompt #LOCAL-DATA-PART2 and Prompt #MASTERS-PART1 (Section 4).

**Checkpoint:** Faculty-specific outputs across the workflow. Masters Proposal Builder accepts input and returns matched supervisors with publication counts.

### Week 6 (Sep 21–27) — Masters Proposal Builder continued

| Day | Task |
|---|---|
| Mon | Step 3 of Masters flow: proposal outline generator (1500-word format). |
| Tue | Step 4: literature review section drafting (re-use Literature Map service). |
| Wed | Step 5: methodology section drafting (re-use Methodology Advisor). |
| Thu | Step 6: budget + timeline tables. |
| Fri | Premium PDF export of full proposal. |
| Sat | Manual test: complete a full proposal end-to-end as a fake user. |

**Prompts to run:** Prompt #MASTERS-PART2 (Section 4).

**Checkpoint:** A fake Masters applicant can go from blank state to downloaded proposal PDF in one session.

### Week 7 (Sep 28 – Oct 4) — Masters polish + Gate 2 prep

**Theme:** Finish Masters. Gate 2 on Oct 5.

| Day | Task |
|---|---|
| Mon | Recruit 5 real Masters applicants for testing. WhatsApp DMs, UNILAG postgrad groups. |
| Tue | Onboard 2 testers. Watch them use it. Note every confusion point. |
| Wed | Fix top 5 issues from testing. |
| Thu | Onboard 3 more testers. |
| Fri | Fix next round of issues. Add Masters Pack pricing to Paystack (suggest ₦3,500). |
| Sat | **Gate 2 review.** Write honest answers to all 4 criteria in Section 3 of the v3 doc. |

**Prompts to run:** Prompt #MASTERS-POLISH (Section 4).

**Checkpoint (Gate 2):** Masters Proposal Builder used by 5 real applicants. At least 3 say they'd pay for it. v2 revenue still tracking. Decide go / cut-scope / pause based on the doc's criteria.

### Week 8 (Oct 5–11) — Supervisor Dashboard part 1

**Theme:** Lecturer role and invite system.

| Day | Task |
|---|---|
| Mon | `user_roles` migration. Update existing users → `student`. |
| Tue | Supervisor signup flow: separate landing at `/for-supervisors`. Email verification. |
| Wed | `supervisor_invites` migration. Generate single-use tokens. |
| Thu | Send invite email via Resend with link `https://fypro.com.ng/accept-invite?token=...`. |
| Fri | Student accepts → row in `supervisor_student_links`. |
| Sat | Supervisor sees list of linked students. No data yet, just the list. |

**Prompts to run:** Prompt #SUPERVISOR-PART1 (Section 4).

**Checkpoint:** A supervisor can sign up, invite a student, and see them in their list once accepted.

### Week 9 (Oct 12–18) — Supervisor Dashboard part 2

**Theme:** Traffic-light student status.

| Day | Task |
|---|---|
| Mon | Compute status per student: green/yellow/red from progression state + recent activity. |
| Tue | Supervisor dashboard UI: cards for each student with status, last activity, current step. |
| Wed | Drill-down view: supervisor can see (read-only) what student has produced. RLS-enforced. |
| Thu | Comment thread: supervisor can leave a note on a chapter. Student receives notification. |
| Fri | Email digest: every Monday, supervisor gets summary of student activity past week. |
| Sat | Test with 1 real supervisor. UNILAG MME department first attempt — see Section 5. |

**Prompts to run:** Prompt #SUPERVISOR-PART2 (Section 4).

**Checkpoint:** One real supervisor has used the dashboard for at least 30 min and given feedback.

### Week 10 (Oct 19–25) — Referral + Whisper

**Theme:** Two cheap-but-important features in one week.

| Day | Task |
|---|---|
| Mon | `referrals` migration. Auto-generate code per user on signup. |
| Tue | Referral page in app: share link, copy button, share-to-WhatsApp deep link. |
| Wed | Track conversion: referred user signs up → row inserted. Reward on first purchase. |
| Thu | Whisper integration: new `/api/transcribe` route. POST audio blob → OpenAI Whisper. |
| Fri | Replace browser SpeechRecognition in Defense Sim. Fallback if Whisper errors. |
| Sat | Test on 3 phones with Nigerian accents. Compare transcription quality. |

**Prompts to run:** Prompt #REFERRAL and Prompt #WHISPER (Section 4).

**Checkpoint:** Referrals appear in dashboard. Whisper transcribes Defense Sim audio with measurable accuracy improvement over browser SR.

### Week 11 (Oct 26 – Nov 1) — SIWES B2B2C Module

**Theme:** Defense Simulator as interview tool.

| Day | Task |
|---|---|
| Mon | `siwes_companies` + `siwes_candidates` + `siwes_sessions` migrations. |
| Tue | Company admin onboarding flow: claim account, upload candidate CSV. |
| Wed | Candidate invite email with unique session URL. No login required. |
| Thu | Interview UI: same as Defense Sim with `Subject Expert` persona, plus a custom prompt slot for the company. |
| Fri | Results dashboard for company: per-candidate score, transcript, evaluator notes. |
| Sat | HMAC API for companies who want to integrate (use Paystack webhook pattern as reference). |

**Prompts to run:** Prompt #SIWES (Section 4).

**Checkpoint:** A test company account can invite 3 candidates, run sessions, and see results. Pricing structure decided (suggest ₦15,000 per 10 candidates as opening rate).

### Week 12 (Nov 2–8) — Premium PDF Engine

**Theme:** Make exports look like real academic documents.

| Day | Task |
|---|---|
| Mon | Evaluate libraries: `@react-pdf/renderer`, `pdf-lib`, or server-side via `puppeteer-core`. Pick one. |
| Tue | Build template: title page, table of contents, page numbers, running headers. |
| Wed | Chapter typesetting: proper heading hierarchy, citation formatting. |
| Thu | Integrate into Chapter Architect export. |
| Fri | Integrate into Masters Proposal Builder export. |
| Sat | Add `Premium PDF` as a paid feature: ₦1,000 per export or free with Student Pack. |

**Prompts to run:** Prompt #PREMIUM-PDF (Section 4).

**Checkpoint:** PDFs from both flows look like submission-quality documents on side-by-side comparison.

### Week 13 (Nov 9–15) — 3D Visual Identity

**Theme:** Brand upgrade.

| Day | Task |
|---|---|
| Mon | Install `@react-three/fiber` + `@react-three/drei`. Test scene on landing page. |
| Tue | Build 3D monogram or hero element. Keep it under 100kb GLTF. |
| Wed | Add depth/parallax to landing hero. Mobile fallback to static image. |
| Thu | Polish: load states, accessibility, prefers-reduced-motion. |
| Fri | Performance test: Lighthouse score must stay above 85 on mobile. |
| Sat | Buffer day — fix anything from earlier weeks. |

**Prompts to run:** Prompt #3D (Section 4).

**Checkpoint:** Landing page has visible 3D element. Mobile performance not degraded. **If you skipped Premium PDF or 3D, this week becomes catch-up.**

### Week 14 (Nov 16–28) — Beta, Gate 3, launch prep

**Theme:** Polish, test, prepare comms. This is two weeks (Mon Nov 16 to Sat Nov 28).

**Week 14a (Nov 16–21):**

| Day | Task |
|---|---|
| Mon | Recruit 15 beta testers across student and supervisor roles. |
| Tue–Wed | Beta sessions. Watch users. Bug list. |
| Thu | Top 5 bug fixes. |
| Fri | Top 10 bug fixes. |
| Sat | **Gate 3 review.** All 5 criteria must pass. Decide launch or 1-week push. |

**Week 14b (Nov 23–28):**

| Day | Task |
|---|---|
| Mon | Draft launch posts: Twitter/X, LinkedIn, WhatsApp status, Instagram. |
| Tue | Email blast draft for existing users. PR outreach drafts (TechCabal, Techpoint). |
| Wed | Schedule everything. Final smoke test on production. |
| Thu | Deploy v3 to production behind a feature flag if any features are still flaky. |
| Fri | Final beta testers sign off. |
| Sat | Rest. You launch in 7 days. |

**Checkpoint:** v3 is in production with all features live or behind a known flag. Launch comms scheduled. You haven't touched the codebase in 48 hours by Dec 5 morning.

---

## 4. Claude Code Prompt Templates

Each prompt is paste-ready. Run `/clear` in Claude Code between prompts so context doesn't bleed. **Every prompt starts with the same header so I don't repeat the instruction in every block.** Header:

```
Read CLAUDE.md and MASTER.md first. Then read the listed files before writing any code.
```

### Prompt #STAGING — Staging environment wiring

```
Read CLAUDE.md and MASTER.md first.

Goal: configure this repo to deploy to a separate Vercel project (staging.fypro.com.ng)
on push to the develop branch, using a separate Supabase project for data.

Read these files first:
- vercel.json
- .env (note variable names only, do not log values)
- supabase/migrations/ (list contents)
- src/lib/supabase.js or wherever the Supabase client is initialised

Tasks:
1. Add .env.staging.example with placeholder values for all Supabase, Paystack, 
   Anthropic, ElevenLabs, Resend, and Upstash keys, suffixed where appropriate.
2. Update the Supabase client init to read from VITE_SUPABASE_URL and 
   VITE_SUPABASE_ANON_KEY (these already exist). Confirm no hardcoded URLs.
3. Add a /api/health route that returns { env: process.env.VERCEL_ENV, 
   supabase: <true|false based on a SELECT 1> }. Use this to verify staging.
4. Update vercel.json with environment-specific headers if needed (CSP already 
   includes wss://*.supabase.co per recent fix).
5. Document in README.md a Staging section: branch flow, how to deploy, how to 
   reset staging data.

Do NOT touch production env vars. Do NOT change main branch behaviour.

Acceptance criteria:
- A push to develop triggers a Vercel build pointed at staging Supabase.
- /api/health returns the correct VERCEL_ENV ("preview" or "production" based 
  on Vercel project config).
- README has clear staging instructions.

Manual test after:
- Push a trivial change to develop. Confirm Vercel deploys staging.fypro.com.ng.
- Hit https://staging.fypro.com.ng/api/health and verify response.
- Sign up a test user on staging. Verify row appears in staging Supabase, NOT 
  production Supabase.
```

### Prompt #TESTS — Vitest + Playwright skeleton

```
Read CLAUDE.md and MASTER.md first.

Goal: install Vitest and Playwright. Write the first set of critical-path tests.

Read these files first:
- package.json
- /api/_lib/papers.js
- /api/_lib/rate-limit.js (or wherever Upstash rate limit lives)
- /api/_lib/entitlements.js (or src/hooks/usePaidFeatures.js)
- One page component to understand React structure: src/pages/TopicValidator.jsx 
  or equivalent

Tasks:
1. Install vitest, @vitest/ui, jsdom, @testing-library/react, @testing-library/jest-dom 
   as devDependencies.
2. Add vitest.config.js with jsdom env and a setup file that imports jest-dom.
3. Add npm scripts: "test", "test:ui", "test:watch".
4. Write unit tests covering: papers.js fallback chain (Semantic Scholar → 
   OpenAlex → Crossref mock), rate-limit increment + decay, entitlement check 
   for a paid feature.
5. Install @playwright/test. Run npx playwright install chromium. Add playwright.config.js 
   pointed at process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'.
6. Write these 6 Playwright tests in tests/e2e/:
   - signup.spec.ts (email/password → confirms onboarding screen)
   - login.spec.ts (returning user → dashboard)
   - topic-validator.spec.ts (submit a topic → see response)
   - defense-sim-trial.spec.ts (start free trial → 3 questions complete)
   - paystack-checkout.spec.ts (mock click → redirected to Paystack — stop there)
   - share-card.spec.ts (visit a sample share card URL → PNG renders)
7. Add .github/workflows/test.yml that runs Vitest on every PR and Playwright 
   nightly against staging via cron.

Acceptance criteria:
- npm test passes locally.
- npx playwright test passes against http://localhost:5173 with the dev server running.
- GitHub Actions runs on a sample PR and reports green.

Manual test after:
- Open a PR with a broken util. Confirm Vitest fails in CI.
- Break the topic validator UI. Confirm Playwright fails next run.
```

### Prompt #DATASET — Defense question dataset capture

```
Read CLAUDE.md and MASTER.md first.

Goal: passively capture every Defense Simulator question into a dataset table 
for the Nigerian-specific question moat. No user-facing change.

Read these files first:
- /api/defense-simulator/<route>.js (the API route that calls Anthropic for 
  examiner questions)
- src/components/DefenseSimulator/<files> to understand the flow
- The latest migrations folder for the migration pattern

Tasks:
1. Create migration: 
   supabase/migrations/<timestamp>_defense_question_dataset.sql
   Table columns: id (uuid pk), session_id, user_id (nullable for SIWES later), 
   examiner_persona (text: methodologist|subject_expert|external_examiner), 
   question (text), project_topic (text), faculty (text nullable), 
   response_text (text nullable), response_quality_score (numeric nullable), 
   captured_at (timestamptz default now()).
   RLS: enable. Policy: only service role can SELECT or INSERT. Authenticated 
   users have no access. (This is internal data.)
2. In the Defense Sim API route, after generating a question and after 
   receiving the student's response, fire an INSERT via the service role 
   Supabase client. Wrap in try/catch — capture failure must NOT break the 
   user-facing flow. Log failures to Sentry.
3. Add a simple quality scorer in /api/_lib/quality-score.js: 
   length(response) > 50 chars → +1, contains methodology keyword → +1, 
   examiner verdict was "good" → +2. Range 0-4.
4. Add admin dashboard page: /admin/dataset showing total rows, breakdown by 
   examiner_persona, top 10 topics by count, last 24h capture rate.

Acceptance criteria:
- Running a full Defense Sim session inserts one row per question into the 
  dataset table.
- The capture failure path does NOT crash the session if Supabase is down.
- Admin dashboard renders the stats.

Manual test after:
- Start a Defense Sim session as a test user. Complete 5 questions.
- Check Supabase table for 5 rows.
- Visit /admin/dataset and verify count went up by 5.
```

### Prompt #ICS — Writing Planner .ics export

```
Read CLAUDE.md and MASTER.md first.

Goal: add a "Download Calendar" button to the Writing Planner that exports the 
generated schedule as an .ics file compatible with Google Calendar, Apple 
Calendar, and Outlook.

Read these files first:
- src/components/WritingPlanner/<files> 
- /api/writing-planner/<route>.js
- The data structure returned by the planner (array of weekly targets with 
  dates, chapter names, word counts)

Tasks:
1. Install ics package: npm i ics (small, well-maintained, no native deps).
2. Create /src/lib/ics-export.js that takes the planner output and returns 
   an .ics string. Each weekly target = one VEVENT. Use RFC 5545 format.
   - SUMMARY: "FYPro: Chapter <n> — <chapter title>"
   - DESCRIPTION: "Target: <word_count> words. Section: <section_name>."
   - DTSTART/DTEND: the week's start and end dates as all-day events.
   - UID: stable per user/week (e.g., user-id-week-1@fypro.com.ng).
3. Add a "Download Calendar" button in the Writing Planner result screen. 
   On click: generate .ics blob, trigger browser download as 
   "FYPro-schedule.ics".
4. Style the button to match the existing design system (DM Serif Display 
   button is wrong — use the standard CTA component, secondary variant).

Acceptance criteria:
- File downloads on click.
- Opens correctly in Google Calendar (web), Apple Calendar (iOS), and Outlook.
- Each week appears as an all-day event with the chapter title visible.

Manual test after:
- Generate a planner schedule as a test user.
- Click Download Calendar. Confirm .ics downloads.
- Import to Google Calendar. Verify all events appear with correct titles.
- Repeat on iOS via the Files app → tap → Add to Calendar.
```

### Prompt #PROGRESSION-PART1 — Rigid Progression part 1

```
Read CLAUDE.md and MASTER.md first.

Goal: introduce server-side progression state so students cannot access workflow 
steps out of order. Part 1: schema + Topic Validator → Chapter Architect lock.

Read these files first:
- src/pages/Dashboard.jsx (or whichever component renders the workflow cards)
- src/components/TopicValidator/<files>
- src/components/ChapterArchitect/<files>
- src/hooks/usePaidFeatures.js (to mirror its pattern for useProgression)
- The most recent Supabase migration for the migration pattern

Tasks:
1. Create migration: progression_state table.
   Columns: user_id (uuid pk references users), topic_validated (bool default 
   false), chapters_built (bool default false), methodology_set (bool default 
   false), writing_planned (bool default false), literature_mapped (bool default 
   false), abstract_generated (bool default false), instruments_built (bool 
   default false), reviewer_passed (bool default false), defense_unlocked 
   (bool default false), updated_at (timestamptz).
   RLS: SELECT and UPDATE allowed where auth.uid() = user_id. No INSERT (use 
   a trigger to auto-create on user signup, or upsert from the hook).
2. Add Supabase trigger on auth.users insert → insert progression_state row.
3. Create src/hooks/useProgression.js mirroring usePaidFeatures pattern. 
   Exports: { progression, isStepUnlocked(stepName), markStepComplete(stepName) }.
4. In Topic Validator: on successful topic submission, call markStepComplete('topic_validated').
5. In Chapter Architect entry route/component: if !isStepUnlocked('chapters_built') 
   AND !isStepUnlocked at the gating check (topic_validated), show locked state 
   instead of the form. Lock UI: muted card, padlock icon, message "Complete 
   Topic Validator to unlock this step", CTA button linking to Topic Validator.

Do NOT lock the other steps in this prompt. That's Part 2.

Acceptance criteria:
- New users get a progression_state row automatically.
- Topic Validator marks topic_validated = true on success.
- Chapter Architect shows locked state for users without topic_validated.
- Existing users (created before this migration) are backfilled with 
  topic_validated = true if they have any existing topic validator output. 
  Include a one-off backfill SQL in the migration.

Manual test after:
- Sign up a new test user. Confirm progression_state row exists.
- Try to open /app/chapter-architect — see locked state.
- Run Topic Validator. Confirm chapter_architect now unlocks.
- Check an existing pre-migration user — confirm backfill worked.
```

### Prompt #PROGRESSION-PART2 — Rigid Progression part 2

```
Read CLAUDE.md and MASTER.md first.

Goal: complete the Rigid Progression system. Lock the remaining workflow steps 
in dependency order and lock Defense Simulator behind all core steps complete.

Read these files first:
- src/hooks/useProgression.js (from Part 1)
- All step component entry points: MethodologyAdvisor, WritingPlanner, 
  LiteratureMap, AbstractGenerator, InstrumentBuilder, ProjectReviewer, 
  DefenseSimulator
- Dashboard.jsx

Tasks:
1. Define the unlock dependency map in useProgression.js:
   - chapter_architect: requires topic_validated
   - methodology_advisor: requires chapters_built
   - writing_planner: requires methodology_set
   - literature_map: requires chapters_built (parallel to methodology)
   - abstract_generator: requires writing_planned AND literature_mapped
   - instrument_builder: requires methodology_set
   - project_reviewer: requires abstract_generated
   - defense_simulator: requires reviewer_passed
2. Apply the same lock pattern from Part 1 to each remaining step component. 
   Reuse a shared <LockedStep prerequisite="..." /> component to keep markup DRY.
3. On the dashboard, render lock state on each step card with the specific 
   prerequisite named.
4. Add markStepComplete calls in each step's success handler.
5. Defense Simulator: existing free-trial flow is exempt from the lock 
   (3-question trial available regardless). Full Defense Sim requires 
   reviewer_passed.

Acceptance criteria:
- Visiting a locked step's URL directly shows the locked state, not the form.
- Completing each step in order unlocks the next.
- Defense Sim free trial still works for users with no progression.
- Full Defense Sim requires reviewer_passed.

Manual test (chaos):
- New user → try every locked URL directly. All must show locked state.
- Complete the workflow step by step. Verify each unlock fires.
- Existing paid user with Defense Pack: confirm they can still trial Defense 
  Sim without completing the workflow.
```

### Prompt #LOCAL-DATA-PART1 — Local Data Constraints part 1

```
Read CLAUDE.md and MASTER.md first.

Goal: add faculty-specific word count norms and citation style suggestions 
based on the student's faculty.

Read these files first:
- src/components/Onboarding/<files> (where faculty is collected)
- The user profile structure in Supabase
- /api/methodology-advisor/<route>.js
- /api/writing-planner/<route>.js

Tasks:
1. Create a static reference file: /src/lib/faculty-norms.js exporting a map:
   {
     "engineering": { wordCountPerChapter: { 1: 2500, 2: 4000, 3: 3500, 4: 5000, 5: 2000 },
                      citationStyle: "IEEE", thesisLength: 15000 },
     "social_sciences": { ... APA ... 12000 },
     "medicine": { ... Vancouver ... 18000 },
     "arts": { ... MLA ... 10000 },
     "sciences": { ... Harvard ... 14000 },
     "law": { ... OSCOLA ... 12000 },
     // add the others based on UNILAG faculty list
   }
2. Ensure user.faculty is captured at onboarding (existing field; verify it's 
   normalised to the keys above).
3. In Methodology Advisor system prompt: inject the suggested citation style 
   for the student's faculty. "For your faculty (Engineering), use IEEE 
   citation style by default."
4. In Writing Planner output: word count per chapter should match the faculty 
   norm, not a global default.
5. Add an admin override: a user can change their citation style in settings 
   if they disagree with the default.

Acceptance criteria:
- Engineering students see IEEE-style citations recommended.
- Social Sciences students see APA.
- Writing Planner respects faculty word counts.
- Users can override the default in settings.

Manual test after:
- Create test users in 3 different faculties.
- Run Methodology Advisor for each. Confirm citation style differs.
- Run Writing Planner. Confirm word counts differ.
```

### Prompt #LOCAL-DATA-PART2 — Local Data Constraints part 2

```
Read CLAUDE.md and MASTER.md first.

Goal: bake UNILAG-specific formatting rules into PDF exports and add Nigerian-
university viability checks in Topic Validator.

Read these files first:
- /api/topic-validator/<route>.js
- The current PDF export module (Chapter Architect or Project Reviewer)
- src/lib/faculty-norms.js (from Part 1)

Tasks:
1. UNILAG formatting rules in PDF exports:
   - Times New Roman 12pt body
   - 1.5 line spacing
   - 1-inch margins all sides
   - Page numbers bottom-centre
   - Chapter headings: caps, bold, 14pt
   - Section headings: title case, bold, 12pt
   - Apply only when user.university = "UNILAG" or generic if not set.
2. Topic Validator: add a "viability" signal in the Anthropic system prompt 
   noting whether the topic is researchable at a Nigerian university given 
   typical lab/data access. Categories: viable (green), challenging (amber), 
   unviable (red — too dependent on resources unavailable in Nigeria, or too 
   broad). Render the signal in the UI without blocking submission.
3. Add a small disclaimer beneath the viability flag: "This is guidance, not 
   a verdict. Discuss with your supervisor."

Acceptance criteria:
- UNILAG users get TNR 12pt PDFs with proper margins.
- Topic Validator now returns a viability signal in addition to its existing 
  feedback.
- Viability signal renders with green/amber/red visual state.

Manual test after:
- Run Topic Validator on: "Synthesis of biodegradable bioplastics from 
  cassava starch" (should be viable).
- Run on: "Building a quantum computer for trapped ion gates" (should be 
  unviable for typical Nigerian university).
- Run on: "Effects of social media on Nigerian youth" (should be challenging 
  — too broad).
- Generate a PDF as a UNILAG user. Verify TNR, margins, page numbers.
```

### Prompt #MASTERS-PART1 — Masters Proposal Builder part 1

```
Read CLAUDE.md and MASTER.md first.

Goal: launch the Masters Proposal Builder MVP — step 1 (research interest input)
and step 2 (supervisor matching via OpenAlex).

Read these files first:
- /api/_lib/papers.js (OpenAlex client lives here)
- src/pages/Dashboard.jsx
- src/hooks/usePaidFeatures.js (mirror for Masters Pack entitlement)
- The Paystack init flow

Tasks:
1. Create masters_proposals migration. Columns: id (uuid pk), user_id, 
   research_interest (text), suggested_areas (jsonb), supervisor_matches 
   (jsonb), draft_content (jsonb), status (enum: draft|in_review|complete), 
   created_at, updated_at. RLS: user can SELECT/UPDATE own rows.
2. Add Masters Pack entitlement: add to user_entitlements (or as a new column). 
   Paystack product = Masters Pack at ₦3,500 (decide final price later).
3. Add /app/masters route guarded by Masters Pack entitlement.
4. Build /api/masters/research-interest route: takes a free-text research 
   interest paragraph, calls Anthropic to return 3 sharpened research 
   sub-areas with rationale. Cache result 24h in Upstash.
5. Build /api/masters/supervisor-match route: takes a sub-area, queries 
   OpenAlex for top 5 active researchers in that area filtered to African 
   institutions (use OpenAlex institutions filter). Returns name, affiliation, 
   recent paper titles, citation count.
6. UI: a 2-step wizard. Step 1: paste research interest → see 3 sub-areas. 
   Pick one. Step 2: see 5 supervisor matches.

Acceptance criteria:
- Masters Pack purchase unlocks /app/masters.
- A complete step 1 → step 2 flow returns supervisor results in under 15s.
- Results are cached on repeat queries.
- All errors handled gracefully — never blank screens.

Manual test after:
- Buy Masters Pack as a test user (Paystack test card).
- Enter "biodegradable polymers for medical implants" as research interest.
- Confirm 3 sub-areas returned.
- Pick one. Confirm 5 supervisor matches with African affiliations appear.
```

### Prompt #MASTERS-PART2 — Masters Proposal Builder part 2

```
Read CLAUDE.md and MASTER.md first.

Goal: complete the Masters Proposal Builder — proposal outline, literature 
review, methodology, budget/timeline, and PDF export.

Read these files first:
- /api/masters/<existing routes>
- src/pages/Masters/<wizard components>
- /api/literature-map/<route>.js (reuse for lit review)
- /api/methodology-advisor/<route>.js (reuse for methodology)
- src/lib/faculty-norms.js

Tasks:
1. Step 3 — Proposal outline: /api/masters/outline takes the selected sub-area 
   + supervisor + faculty norms and returns a structured outline (Introduction, 
   Statement of Problem, Aims/Objectives, Research Questions, Significance, 
   Scope, Literature Review summary, Methodology summary, Timeline, References, 
   Budget). Target 1500 words total proposal length.
2. Step 4 — Literature review section: reuse literature map module. Returns 
   5–10 references formatted in the faculty's citation style.
3. Step 5 — Methodology section: reuse methodology advisor module with the 
   Masters-level prompt variant.
4. Step 6 — Budget + timeline: simple table editor. Default rows for common 
   line items (materials, lab access, travel, equipment). Timeline as a 
   3-month Gantt-style table.
5. Final export: combine all steps into one document. Trigger Premium PDF 
   engine if available; fall back to current PDF if not yet built.
6. Save state at every step. Resume on return. Persist into masters_proposals 
   table.

Acceptance criteria:
- A user can complete all 6 steps and download a 1500-word proposal PDF.
- State persists across sessions.
- Each step renders in under 10s.
- Existing literature map and methodology code is reused, not duplicated.

Manual test after:
- Start a full proposal as a test user.
- Complete one step. Close browser. Reopen — verify state restored.
- Complete all 6 steps. Download PDF. Open in a PDF reader.
- Validate references are formatted correctly per the user's faculty style.
```

### Prompt #MASTERS-POLISH — Real-applicant testing polish

```
Read CLAUDE.md and MASTER.md first.

Goal: based on real Masters applicant feedback this week, fix the top 5 issues 
identified during week 7 testing.

Before starting, paste the issues here as a list. I will not start coding 
until you've provided the issues from this week's testing.

Issues to fix (paste from notes):
- 
- 
- 
- 
- 

Tasks:
For each issue, propose a minimal fix, get my confirmation, then apply it. 
Do not refactor unrelated code. Do not add new features.

Acceptance criteria:
- All 5 issues resolved.
- No new regressions in Vitest or Playwright runs.

Manual test after:
- Re-test the original flow each issue came from.
- Sanity check: a fresh test user can still complete a proposal end-to-end.
```

### Prompt #SUPERVISOR-PART1 — Supervisor Dashboard part 1

```
Read CLAUDE.md and MASTER.md first.

Goal: introduce a supervisor user role, supervisor signup flow, and a working 
invite system that links students to supervisors.

Read these files first:
- src/lib/supabase.js (auth flow)
- src/pages/Login.jsx, Signup.jsx, Onboarding.jsx
- /api/_lib/email.js (Resend integration)
- The most recent migration

Tasks:
1. Migrations: 
   a) user_roles table (user_id pk, role text check in 
      ('student','supervisor','admin'), university, faculty, department, 
      created_at). Backfill all existing users with role='student'.
   b) supervisor_invites table (id, supervisor_user_id, token uuid unique, 
      student_email, status text default 'pending', expires_at default 
      now() + interval '7 days', created_at).
   c) supervisor_student_links table (id, supervisor_user_id, student_user_id, 
      status default 'active', linked_at).
   All with RLS. Supervisor can SELECT own rows. Student can SELECT links they're 
   in. INSERT only via service role for invites; UPDATE allowed for linked status 
   changes by either party.
2. New supervisor signup page: /for-supervisors. Different copy from student 
   signup. On signup, user_roles row is created with role='supervisor'.
3. /app/supervisor dashboard route: gated to role='supervisor'. Empty state: 
   "Invite your first student".
4. Invite flow: supervisor enters student email → POST /api/supervisor/invite 
   → creates invite row, sends Resend email with link to 
   https://fypro.com.ng/accept-invite?token=<token>.
5. Accept invite page: student logs in (or signs up), token validated, 
   supervisor_student_links row created, supervisor_invites status='accepted'.
6. Supervisor dashboard now shows list of linked students (just names + emails 
   for now).

Acceptance criteria:
- A new supervisor can sign up via /for-supervisors.
- Supervisor invites a student email. Student receives Resend email.
- Student accepts invite. Link is created. Supervisor sees student in dashboard.
- Tokens expire after 7 days.

Manual test after:
- Sign up as supervisor at /for-supervisors.
- Invite a real student email you control.
- Open the email. Click the link. Sign up / log in.
- Confirm supervisor sees the student in their dashboard.
- Try an expired token → see clear error.
```

### Prompt #SUPERVISOR-PART2 — Supervisor Dashboard part 2

```
Read CLAUDE.md and MASTER.md first.

Goal: traffic-light student status, read-only drill-down view, comment threads, 
and a weekly email digest.

Read these files first:
- /src/pages/SupervisorDashboard.jsx (from Part 1)
- src/hooks/useProgression.js
- /api/_lib/email.js
- Existing chapter/abstract output components for read-only rendering

Tasks:
1. Status logic per linked student:
   - GREEN: progression advanced in last 7 days OR session count >= 1 in last 
     14 days.
   - AMBER: progression hasn't advanced in 14 days but has activity in last 
     30 days.
   - RED: no activity in 30+ days.
   Compute in /api/supervisor/students.
2. Dashboard UI: card per student with status pill, name, faculty, current 
   step, days since last activity.
3. Drill-down: click student → /app/supervisor/student/<id>. Read-only view 
   of student's outputs: topic, chapter outlines, abstract, methodology. 
   Enforced via RLS that allows SELECT for linked supervisors.
4. Comments: supervisor leaves a note on a specific section. Stored in a new 
   table supervisor_comments (id, supervisor_id, student_id, section text, 
   body text, created_at, read_by_student bool). Student gets in-app and 
   Resend email notification.
5. Weekly digest: cron via Vercel cron job, Monday 7am WAT. Runs 
   /api/supervisor/digest sending each supervisor an email with: count of 
   active students, who advanced this week, who's red-flagged.

Acceptance criteria:
- Status correctly calculated and displayed.
- Drill-down works and respects RLS (a supervisor can never see an unlinked 
  student's data).
- Comments deliver via email and show in-app.
- Weekly digest sends.

Manual test after:
- Create a supervisor + 3 linked students with different activity levels.
- Verify statuses computed correctly.
- Try to access an unlinked student's data via URL guessing — must fail.
- Leave a comment. Check student's email + dashboard.
- Trigger digest manually via the cron endpoint. Check supervisor email.
```

### Prompt #REFERRAL — Referral mechanic

```
Read CLAUDE.md and MASTER.md first.

Goal: each user gets a referral code. Referred users who pay trigger a reward 
for the referrer (₦500 credit toward any pack).

Read these files first:
- src/lib/supabase.js
- The Paystack webhook handler (/api/paystack/webhook.js)
- src/pages/Settings or wherever the user account page lives
- The Paystack init flow

Tasks:
1. Migration: referrals table (id, referrer_user_id, referred_user_id, 
   code text unique, status text in 
   ('pending','signed_up','converted','rewarded'), reward_amount_ngn int, 
   created_at, converted_at). RLS: user can SELECT own referrals (where 
   they're referrer or referred).
2. Generate code on user signup: 6-char alphanumeric, unique. Add to 
   users metadata or new column.
3. Settings page: "Refer a friend" section showing user's code, share link 
   (https://fypro.com.ng/?ref=<code>), share-to-WhatsApp deep link, share-to-
   Twitter prefilled tweet.
4. Track referral on signup: if URL has ?ref=<code>, store in localStorage 
   pre-signup. On successful signup, insert referrals row with 
   referrer_user_id from the code, referred_user_id from the new user, 
   status='signed_up'.
5. In Paystack webhook: if the paying user is a referred user and 
   referrals.status='signed_up', set status='converted'. Issue ₦500 credit 
   to referrer by incrementing a referral_credit_ngn column on users (add 
   to migration).
6. Settings page also shows referral credit balance and a button "Apply 
   credit on next purchase". Credit reduces the Paystack amount at init time.
7. Cap: max 10 successful referrals rewarded per user per 30 days (anti-abuse).

Acceptance criteria:
- Each user has a unique referral code.
- Share links work and prefill correctly.
- A referred user who pays triggers the credit.
- Credit applies on next purchase.
- Abuse cap enforced.

Manual test after:
- Get test user A's code.
- In a different browser, visit fypro.com.ng/?ref=<A's code>.
- Sign up as test user B. Verify referrals row exists, status='signed_up'.
- As B, complete a Paystack test purchase.
- Verify A's referral credit went up by 500.
- As A, start a new purchase. Verify credit applied.
```

### Prompt #WHISPER — OpenAI Whisper voice transcription

```
Read CLAUDE.md and MASTER.md first.

Goal: replace browser SpeechRecognition in Defense Simulator with OpenAI 
Whisper for accurate Nigerian-accent transcription.

Read these files first:
- src/components/DefenseSimulator/<voice handling code>
- The Defense Simulator API routes
- /api/_lib/rate-limit.js

Tasks:
1. Add OPENAI_API_KEY to Vercel staging + production env.
2. Create /api/transcribe route. Accepts multipart audio blob. POSTs to 
   https://api.openai.com/v1/audio/transcriptions with model='whisper-1' 
   and language='en'. Returns transcript text.
3. Rate limit /api/transcribe by user_id: 30 transcriptions per hour 
   (Defense Sim is ~10 questions max).
4. In Defense Simulator: replace browser SpeechRecognition.onresult with a 
   MediaRecorder-based capture (16kHz mono webm/opus). On stop, POST blob 
   to /api/transcribe. Display transcript to user before submitting as 
   answer.
5. Fallback: if /api/transcribe fails (network, OpenAI down), fall back to 
   browser SpeechRecognition or text input. Log fallback events to Sentry 
   with reason.
6. Cost guard: track per-user transcription minutes per day. Hard cap at 30 
   minutes per user per day to prevent runaway spend.

Acceptance criteria:
- Audio captured in Defense Sim transcribes via Whisper.
- Nigerian-accent transcription is qualitatively better than browser SR.
- Fallback triggers cleanly if Whisper errors.
- Cost guard prevents runaway usage.

Manual test after:
- Run a Defense Sim session. Speak with deliberate Nigerian accent.
- Compare transcript quality vs. previous browser SR version (run on a 
  feature flag or save transcripts for comparison).
- Force a failure (block api.openai.com in dev tools). Verify fallback.
- Check OpenAI usage dashboard. Confirm credits are being deducted as expected.
```

### Prompt #SIWES — SIWES B2B2C Module

```
Read CLAUDE.md and MASTER.md first.

Goal: licence the Defense Simulator engine to companies as an interview tool 
for SIWES interns.

Read these files first:
- /api/defense-simulator/<routes>
- /api/paystack/webhook.js (HMAC pattern)
- src/pages/admin/<admin pages>

Tasks:
1. Migrations:
   - siwes_companies (id, company_name, contact_email, billing_status, 
     api_key text unique, hmac_secret text, monthly_session_cap int default 
     50, sessions_used_this_month int default 0, created_at).
   - siwes_candidates (id, company_id, candidate_name, candidate_email, 
     session_token uuid unique, status text default 'invited', invited_at, 
     completed_at).
   - siwes_sessions (id, candidate_id, transcript jsonb, score numeric, 
     evaluator_notes text, completed_at).
   RLS: company admin can SELECT/INSERT/UPDATE own rows. Candidates access 
   via session_token only (no auth).
2. Company onboarding: admin-created accounts only at this stage (you create 
   them manually from /admin/siwes). Generate api_key + hmac_secret.
3. Company dashboard at /siwes/<company_slug>. Login by api_key (simple 
   header auth for now — improve later). Upload candidate CSV. Each row 
   becomes a candidate with a unique session_token.
4. Candidate flow: candidate clicks emailed link 
   https://fypro.com.ng/siwes/interview/<session_token>. No login. Sees 
   the same Defense Sim UI but with persona='subject_expert' and a custom 
   prompt provided by the company.
5. Results dashboard: company sees each candidate's transcript, score, and 
   examiner notes.
6. HMAC API: companies can integrate. POST /api/siwes/v1/candidates with 
   X-Signature header (HMAC-SHA256 of raw body using hmac_secret). Use 
   the exact same raw-body pattern as the Paystack webhook.
7. Billing: increment sessions_used_this_month on each completed session. 
   Cap enforced at the API level.

Acceptance criteria:
- A test company can be created in admin, gets an api_key.
- CSV upload creates candidate rows + sends invite emails via Resend.
- Candidates can complete a session without an FYPro account.
- Company sees results in dashboard.
- HMAC API rejects bad signatures.
- Monthly cap enforced.

Manual test after:
- Create test company in admin.
- Upload CSV of 2 candidates.
- Run one session as candidate. Verify result in company dashboard.
- Try HMAC API with a wrong signature → 401.
- Exceed monthly cap → 429.

Pricing note for billing flow (decide separately):
- Suggest ₦15,000 per 10 candidate sessions as opening rate.
- Billed via Paystack invoice initially, not in-app payment.
```

### Prompt #PREMIUM-PDF — Premium PDF engine

```
Read CLAUDE.md and MASTER.md first.

Goal: replace the current PDF export with a properly typeset academic document 
engine. Used by Chapter Architect, Project Reviewer, and Masters Proposal 
Builder exports.

Read these files first:
- Current PDF export code (likely /api/export-pdf/<route>.js or similar)
- /src/lib/faculty-norms.js
- The Vercel serverless function memory/time limits in vercel.json

Tasks:
1. Evaluate options. Pick one based on Vercel constraints (1024MB memory, 
   60s timeout on Pro):
   - @react-pdf/renderer — JSX-based, server-renderable, good for academic 
     formatting. Recommended.
   - pdf-lib — lower-level, more control, more code.
   - puppeteer-core + sparticuz/chromium — heavy, slow cold start. Avoid.
2. Install @react-pdf/renderer. Build a PremiumDocument component with:
   - Title page (title, author, supervisor, institution, faculty, date)
   - Table of contents (auto-generated from chapter headings)
   - Running header (chapter title)
   - Page numbers (bottom centre)
   - Body styled per faculty norms (TNR 12pt 1.5 spacing for UNILAG default)
   - References section with faculty-appropriate citation style
3. Create /api/export-premium-pdf route. Accepts the same payload shape as 
   the existing export. Generates the PDF and returns as application/pdf.
4. Gate behind a paid feature: Premium PDF available with Student Pack OR 
   Masters Pack OR a one-off purchase at ₦1,000. Update entitlements.
5. Update Chapter Architect, Project Reviewer, and Masters export buttons 
   to offer "Premium PDF" alongside the existing free PDF.

Acceptance criteria:
- Premium PDF generates in under 30s for a 30-page document.
- Output looks like a real academic submission side-by-side with the 
  current PDF.
- Citation style matches faculty norm.
- Entitlement gate works.

Manual test after:
- As a Student Pack user, generate a Premium PDF from Chapter Architect.
- Open in Adobe Reader. Check: TOC links, headers, page numbers, font.
- Generate from Masters Proposal Builder. Verify references formatting.
- As a free user, try to generate — see paywall.
```

### Prompt #3D — 3D Visual Identity

```
Read CLAUDE.md and MASTER.md first.

Goal: add 3D elements to the landing page hero and brand monogram, keeping 
mobile performance intact.

Read these files first:
- src/pages/Landing.jsx
- src/components/Logo.jsx or wherever the brand mark lives
- Any existing performance budgets

Tasks:
1. Install @react-three/fiber, @react-three/drei, three.
2. Build a hero 3D element: rotating monogram or abstract geometric form that 
   evokes "precision engineering × dark academia". Keep model under 100kb. 
   If using a GLTF, host it as a static asset under /public/3d/.
3. Wrap in Suspense with a static fallback (PNG of the same form) for slow 
   connections.
4. Respect prefers-reduced-motion: disable animation when set.
5. Mobile fallback: under 768px width, render static PNG instead of canvas. 
   Avoids GPU contention on cheap Android phones.
6. Run Lighthouse on the landing page (mobile profile). Score must remain 
   above 85. Optimise if it drops.
7. Update the brand mark used in the navbar to a treatment that hints at 
   depth without requiring a 3D canvas (use SVG with subtle gradient + shadow).

Acceptance criteria:
- Landing hero has a visible 3D element on desktop.
- Mobile shows static fallback, no canvas.
- Lighthouse mobile performance score >= 85.
- prefers-reduced-motion respected.

Manual test after:
- Open landing on desktop. Confirm 3D animation.
- Open on mobile (real phone). Confirm static image, fast load.
- Toggle prefers-reduced-motion in browser dev tools. Confirm animation stops.
- Run Lighthouse mobile audit. Capture before/after scores.
```

---

## 5. Institutional Sales Plan

Two signed contracts before December 5. Start outreach in **mid-July (Phase 1 week 5)**, not August. Nigerian institutional sales cycles run 6–10 weeks minimum.

### 5.1 Who to contact, in order

| Rank | Role | Why | How to find |
|---|---|---|---|
| 1 | **Head of Department, your home department (MME, UNILAG)** | You know them. They know you. Lowest barrier. | Walk in. Wear a shirt. Ask Mrs. <secretary> politely. |
| 2 | **FYP Coordinator in your faculty** | Specifically responsible for the problem FYPro solves. Often more receptive than HoD. | Same. Or find them at faculty meetings. |
| 3 | **HoDs in adjacent engineering departments** (Civil, Electrical, Chemical, Petroleum) | Same student pain, different department politics. | Departmental websites. Or ask your HoD to introduce. |
| 4 | **Postgraduate School / SPGS coordinator** | Masters Proposal Builder pitch. Different buyer than undergrad. | UNILAG SPGS office. |
| 5 | **Faculty Deans** | Only after you have one departmental win. Don't lead with deans — they delegate. | Faculty office. |
| 6 | **Other universities: LASU, UI, OAU, UNN** | Once you have UNILAG signal. | LinkedIn → coordinator-level academics. |

### 5.2 The first message (WhatsApp/email)

Pick the channel based on how you'd normally contact them. If you have their number through a real chain (not stolen), WhatsApp converts better in Nigeria. Otherwise email from `hello@fypro.com.ng`.

**Email template:**

> Subject: 30-second look at a tool I built for our department's FYP students
>
> Good morning Prof. <Name>,
>
> I'm Taiwo Ayeni, a [300-level] Metallurgical and Materials Engineering student at UNILAG.
>
> I built a product called FYPro — an AI companion that walks final year students through their project from topic to defense. We launched in June and currently have [<X>] paying users across [<N>] universities.
>
> I'd like to offer the MME department a free pilot for one semester. No payment, no contract, no commitment. In exchange, I'd appreciate two things:
>
> 1. Permission to invite 30 final year students to use it for free.
> 2. 15 minutes of your time at the end of the semester to discuss what worked.
>
> If the pilot is useful, we can talk about a department-level licence for the next session.
>
> A 90-second video showing what it does: <Loom link>
> Live product: https://fypro.com.ng
>
> Best regards,
> Taiwo Ayeni
> +234 <number>

Keep it that short. Anything longer and they won't read it.

### 5.3 What to offer

**Pilot structure (free, one semester):**

- 30 students get full Student Pack access at no cost.
- Department receives a Supervisor Dashboard for up to 10 supervisors.
- Monthly written report on student usage and progression.
- One in-person walkthrough at the start, one debrief at the end.

**Conversion to contract:**

- Annual department licence: **₦500/student/semester × department student count**.
- Example: MME UNILAG ~80 final-year students = ₦40,000/semester = ₦80,000/year.
- Faculty-level licence: 15–20% discount for buying 4+ departments together.
- Payment: 50% upfront via invoice, 50% mid-year.

Don't go below ₦300/student/semester. That's the floor. Below that the product is undervalued and they'll never raise.

### 5.4 Week-by-week timeline

Outreach runs in parallel with build. Don't drop building to chase one slow conversation.

| Week (Phase 1) | Action |
|---|---|
| Phase 1 wk 5 (Jul 13–17) | Walk in to your HoD. Have the 90-second Loom ready. Leave behind a one-pager. |
| Phase 1 wk 5 (Jul 17) | Email FYP Coordinator and 3 adjacent HoDs that day. |
| Phase 1 wk 6 (Jul 20–24) | Follow-up WhatsApp to anyone who hasn't replied. One follow-up only. |
| Phase 1 wk 7 (Jul 27–31) | Schedule pilot meetings. Bring printed one-pager + demo on laptop. |
| Phase 1 wk 8 (Aug 3–7) | First pilot meetings. Goal: 1 verbal "let's pilot". |
| Phase 1 wk 9 (Aug 10–15) | Onboard pilot department for September academic year. Pilot agreement signed (not contract — a one-page MoU). |
| v3 Build wk 1–4 (Aug 18 – Sep 13) | Pilot is live during your v3 build. Don't tinker with the pilot product. |
| v3 Build wk 5 (Sep 14–20) | Mid-pilot check-in with HoD. Bring stats. |
| v3 Build wk 7 (Sep 28 – Oct 4) | Second institution outreach: write to 3 more HoDs in other faculties. Pitch is now: "X department at UNILAG is using this. Here's their data." |
| v3 Build wk 9 (Oct 12–18) | Contract proposal sent to pilot department. Include real usage data. |
| v3 Build wk 10 (Oct 19–25) | Negotiate. Be willing to adjust scope. |
| v3 Build wk 11 (Oct 26 – Nov 1) | **Contract #1 signed.** Send payment terms. |
| v3 Build wk 12 (Nov 2–8) | Second institution: pilot agreed. |
| v3 Build wk 13–14 (Nov 9–28) | **Contract #2 signed** OR pilot strong enough that signing is imminent. |

If you don't have one verbal yes by end of Phase 1 week 8 (Aug 7), institutional sales is moving too slowly for the December target. At that point either:
- Drop the December institutional contract target to a single contract by Q1 2027, or
- Reallocate v3 build hours toward sales (cut Premium PDF and 3D).

Decide this honestly. Don't sleep on it.

### 5.5 SIWES B2B2C — separate motion

Different buyer, different cycle.

- Targets: HR / Talent / Learning teams at Andela, Flutterwave, Paystack, MTN Foundation, Lagos State Employment Trust Fund, GE Africa, Shell Nigeria.
- Channel: LinkedIn direct messages, not email. HR people read LinkedIn.
- Offer: free pilot evaluating 10 SIWES interns with the Defense Sim engine. Show them the dashboard. Bill ₦15,000–₦25,000 per 10 sessions after.
- Realistic target: **1 SIWES contract by December.** This is harder than the academic side. Don't promise yourself two.

---

## 6. What to do if Claude.ai Pro is not renewed

You don't strategically die without Pro. You just slow down. Here's the structure.

### 6.1 What free tier (Sonnet) handles fine

- Daily Claude Code prompt drafting.
- Bug diagnosis from error logs.
- Reading documentation and summarising.
- Writing emails and outreach copy.
- Reviewing code Claude Code wrote.
- Drafting tests.

If your strategy chats are already structured and your build companion docs are written, Sonnet can drive 80% of weekly work without Opus.

### 6.2 What still needs Opus

- Architectural decisions that span 4+ weeks of build (e.g., the supervisor dashboard schema, the SIWES API design).
- Pricing decisions and contract structure.
- Gate decisions — interpreting Gate 1/2/3 data and choosing direction.
- Founder mental-state hard calls (cut scope, push launch, hire, pause).

Estimate: **6–8 Opus-grade conversations between August and December.** Each can be a focused 30–60 minute session.

### 6.3 How to use Opus efficiently on free limits

If you're paying for one month at a time, buy Pro for these months:
- **Mid-August** (Gate 1 decision week + v3 kickoff architecture).
- **Early October** (Gate 2 week).
- **Mid-November** (Gate 3 + launch prep).

That's three Pro months out of five. The other two you ride Sonnet.

When you do have Opus access, batch your hard questions. Write a single conversation with this structure:

```
# Context (copy from your build companion + last gate decision)

# Hard questions (numbered 1–5)
1. ...
2. ...

# What I want from you
For each question: your honest take, the strongest counter-argument, 
and a concrete recommendation.
```

Don't burn Opus on chat. Use it for decisions.

### 6.4 Self-contained Claude Code prompts

Without a strategy chat to reference, your Claude Code prompts must carry more context. Add this header above the existing "Read CLAUDE.md and MASTER.md" line for any feature work:

```
Context (since this is a fresh Claude Code session):
- Stack: React Vite, Vercel serverless, Supabase (project ref ayvunikgfwpylfrkpalj),
  Anthropic Claude, ElevenLabs, Paystack, Upstash, Resend, Sentry.
- v3 just started. Current feature in build: <name>.
- Constraints: solo founder, mobile-first, must not break v2 production.
- Conventions: HMAC raw body for webhook verification, RLS policies must 
  include INSERT and UPDATE not just SELECT, cache durations live in 
  /src/lib/cache-config.js.
- Existing similar feature for reference: <file path>.

Then read CLAUDE.md and MASTER.md.
```

This adds 10 lines but eliminates the most common cause of bad Claude Code output: missing context.

### 6.5 Alternative resources

- **Anthropic's docs** — under-used. https://docs.claude.com has architectural patterns and tool design notes that often answer the "is this the right approach" question without needing chat.
- **Supabase Discord** — RLS edge cases and migration patterns. Free, fast.
- **Stack Overflow + GitHub Issues** — for library-specific issues.
- **One human you trust** — pick one senior engineer or founder you can WhatsApp a hard question to. Even a 10-minute voice note from someone who's shipped is worth 2 hours of LLM back-and-forth.

---

## 7. Risk Register

Top 10. Ranked by exposure (likelihood × impact). Mitigation is what you actually do, not a platitude.

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Coursework load in 300 level cuts build time by 40–60% in October–November | High | High | Front-load high-risk features (Masters Proposal Builder, Supervisor Dashboard) into Aug–Sep. Be ready to cut Premium PDF + 3D at Gate 2. Block exam weeks on the calendar now. |
| 2 | Gate 1 fails (v2 revenue/signups under target) | Medium | High | Run Phase 1 outreach hard. Don't start v3 build until Gate 1 passes. If it fails, do user interviews and pivot, don't push through. |
| 3 | Anthropic API costs spike beyond what unit economics support | Medium | High | Daily spend cap is live. Add weekly per-feature spend report to admin dashboard in week 2. Hard-cap Whisper at 30 min/user/day. |
| 4 | Solo-founder burnout by week 9 (mid-October) | High | High | See Section 8. The rules are not optional. |
| 5 | Institutional sales cycle slips past December | High | Medium | Start outreach mid-July. Have a backup plan: ship v3 to retail users on Dec 5 regardless of institutional status. Contracts in January are still wins. |
| 6 | A v3 feature breaks v2 production for paying users | Medium | High | Staging environment + test suite + branch discipline. Never deploy to main without staging soak. The rule is not negotiable even when you're tired. |
| 7 | Supabase or Vercel free/Pro tier limits hit during launch traffic | Low | High | Already on Vercel Pro. Confirm Supabase plan supports projected user count by week 12. Set up basic load monitoring. |
| 8 | Whisper/OpenAI costs unexpectedly high after launch | Medium | Medium | Cost guard built into Prompt #WHISPER. Monitor first week of production usage. Switch back to browser SR if cost-per-session exceeds ₦15. |
| 9 | Defense Simulator dataset triggers privacy concerns from a user or regulator | Low | High | Dataset RLS is service-role only. Add a clear privacy note at the start of every Defense Sim session: "Your responses help us improve FYPro. No personally identifying info is retained." Wire NDPA compliance ahead of launch. |
| 10 | Competing product launches in October targeting Nigerian FYP students | Medium | Medium | Speed of execution is your defence. Dataset moat is your second defence. Don't try to match feature-for-feature — double down on what's specific to Nigerian universities (faculty norms, supervisor dashboard, local citation styles). |

---

## 8. Personal Sustainability Rules

These are not motivational. They are operational. Treat them like Gate criteria.

### The five rules

1. **No code after midnight on weekdays.** Bugs introduced after midnight cost more to fix than the same bug introduced fresh on Saturday morning. Hard stop at 23:30 most nights.

2. **One full day off per week, every week.** Pick Sunday. No FYPro at all. Not even checking analytics. Not even replying to "quick" WhatsApp questions. The brain needs a day to file context. If you skip this for two weeks running, you will hit week 9 burnt.

3. **Exam weeks are sacred.** When MME first-semester exams hit in November, the v3 build pauses. Pre-decide which week that is (look at last year's UNILAG calendar) and shift the schedule. The 14-week plan assumes one exam-week pause already.

4. **NEPA contingency is a planned thing.** Buy a power bank for your laptop and a UPS for your router if you don't already have one. When power goes for 6+ hours, switch to reading mode (review code, write next week's prompts) instead of trying to code on hotspot in the dark.

5. **One person who knows what you're doing.** Tell one friend or family member the launch date and what you're working on. Not for sympathy — for accountability and for someone to notice if you stop replying for 4 days straight.

### Warning signs you're heading for burnout

- You stop replying to user support DMs within 24 hours.
- You skip the planned weekly rest day twice in a row.
- You start dreading opening your laptop.
- You catch yourself writing "I'll just do this one more thing" past midnight three nights in a row.
- A small bug makes you angry instead of curious.

If two of these are true for a week, you're in burnout territory. Take three days off. Do not negotiate with yourself.

### What success looks like by December 5

- v3 in production with at least 10 of 13 features live.
- 1 institutional contract signed, 1 close to closing.
- 2,000+ total users, 200+ paying, ₦800k+ revenue since June 12.
- A working test suite catching regressions.
- A defense question dataset that has 500+ rows.
- A founder who is tired but not broken, and who can take 10 days off in mid-December to actually rest.

That last one is the most important. You ship in December but you also build the version of yourself who can keep building in 2027.

---

## Appendix A — Daily and weekly checklists

### Daily (5 minutes, 9pm)

- [ ] Did I run `npm test` before pushing today?
- [ ] Did I push to `develop` not `main`?
- [ ] Did I write down tomorrow's first task?
- [ ] Did I respond to any user DM that came in today?

### Weekly Sunday review (30 minutes)

- [ ] Read this week's section in the build plan. Honestly mark each task done/not done.
- [ ] Update Gate 1/2/3 tracking sheet with this week's signups, revenue, retention.
- [ ] Re-read the Risk Register. Mark any new risk that emerged.
- [ ] Read at least one user support thread end to end. Notice patterns.
- [ ] Write the first Claude Code prompt for Monday morning.

### Monthly (the Sunday closest to month-end)

- [ ] Anthropic spend, OpenAI spend, ElevenLabs spend, Resend spend, Upstash spend. Total.
- [ ] Total revenue this month.
- [ ] Net margin per active paying user.
- [ ] Is the unit economic still positive? If no, what specifically changed?

---

## Appendix B — Quick reference

| Thing | Value / location |
|---|---|
| Production | fypro.com.ng |
| Staging | staging.fypro.com.ng |
| Supabase prod ref | ayvunikgfwpylfrkpalj |
| Repo | github.com/AyeniTaiwoSPC270/fypro-app |
| Support channel | WhatsApp (your number) |
| Sending email | hello@fypro.com.ng |
| v3 launch | December 5, 2026 |
| Gate 1 | August 15, 2026 |
| Gate 2 | October 5, 2026 |
| Gate 3 | November 21, 2026 |

---

*Plan version 1.0 — May 15, 2026. Re-read at the start of each new week. Re-write at each Gate. Build with discipline. Ship in December.*
