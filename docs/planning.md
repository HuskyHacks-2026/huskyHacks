# Planning, brainstorming & project ideas

**Event:** HuskyHack 2026 @ Milgard Hall, UW Tacoma (Oct 17–18)  
**Theme (public):** Turning Innovation into Trust  
**Working recommendation:** **Hold Line**  
**Related research:** [Event logistics, judges, evidence](./research.md)  
**Devpost:** https://huskyhack2026.devpost.com/

This is the team planning doc: idea scoring, primary build, demo path, weekend execution, and pitch boundaries. Research sources and judge profiles live in the research brief.

---

## Official judging criteria

Source: [HuskyHack 2026 Devpost](https://huskyhack2026.devpost.com/) / [rules](https://huskyhack2026.devpost.com/rules) (verified Oct 16, 2026). Unchanged from the criteria already in this doc — confirmed against the live page.

| Criterion | Weight | What judges look for |
| --- | ---: | --- |
| **Impact on Member Safety** | 30% | Prevents or reduces fraud losses · Intervenes early enough to make a difference · Includes recovery or member support considerations |
| **User Experience & Trust** | 25% | Easy for legitimate members to complete transactions · Clear, accessible, and non-judgmental · Works for diverse member needs and abilities |
| **Feasibility** | 20% | Realistic to implement · Uses available data and technology · Could be piloted by a credit union with reasonable effort |
| **Innovation** | 15% | Creative approach beyond standard warnings or fraud scores · Introduces a new way to protect members |
| **Prototype & Presentation** | 10% | Clickable or visual demonstration · Shows how both members and employees interact with the solution · Clearly communicates the concept |

Also on Devpost/UW (softer language, still design for it):

- Phase 1 review prose: creativity, execution, relevance to the problem statement
- Phase 2 / final prose: technical execution, functionality, UX, scalability, presentation quality

### How Hold Line maps to the rubric

| Criterion | Hold Line angle |
| --- | --- |
| Impact (30%) | Intervenes at payment time before the wire leaves; callback hold is the early stop. Recovery / account-swap support is a known gap (see research) — mention as product phase-two / post-Phase-1 stretch, not the Saturday demo core. |
| UX & Trust (25%) | Legitimate title-company wire stays silent; only story + risky payee triggers friction; language names the lie without blaming the member. |
| Feasibility (20%) | Scenario JSON + deterministic rules in code; no live core; pilot-shaped credit-union module. |
| Innovation (15%) | Contradiction check on what the member was *told*, not another generic banner or black-box score. |
| Prototype (10%) | Member screen + employee tags + before/after contrast; clickable or visual demo for both member and employee. |

---

## Brainstorming frame

Credit unions got very good at stopping the person who stole the password. The open gap is the transfer the **real member** is about to authorize because someone pretended to be the credit union.

Sound already checks devices, passwords, and cards. Those checks pass when the real member wires savings because a spoofed caller said the credit union told them to.

**Product question:** Can we ask what they were told, name the specific lie, and hold the payment for a callback to the number already on the account?

---

## Idea scores

Weights: judge relevance 20 · severity 18 · demo 16 · feasibility 14 · evidence 12 · novelty 12 · commercial 8.  
A 10 was not awarded. Commercial weight stays low because the prize is decided this weekend.

Scores are the author’s judgment from the research brief, not a survey of the judges.

| Idea | Total | Judges | Severity | Demo | Feasible | Evidence | Novel | Commercial |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Hold Line** | **85.4** | 9 | 9 | 9 | 8 | 9 | 7 | 8 |
| Inside Mule | 78.0 | 8 | 8 | 8 | 8 | 8 | 7 | 7 |
| Fresh Shell | 76.8 | 8 | 8 | 8 | 8 | 8 | 6 | 7 |
| Payee Lock | 72.0 | 7 | 8 | 7 | 8 | 8 | 5 | 7 |
| Counter Script | 71.4 | 7 | 8 | 8 | 7 | 8 | 5 | 6 |

Only Hold Line scores above 80 — primary build.

### Idea notes

| Idea | Score | One-liner | Notes |
| --- | ---: | --- | --- |
| **Hold Line** | 85.4 | Payment-time contradiction for a coached member | Strongest before-and-after. Primary build. |
| Inside Mule | 78.0 | Same-credit-union mule graph | Best stretch on the employee screen; easier to dismiss as an AML dashboard. |
| Fresh Shell | 76.8 | Business apps filed days ago | Fits Perry’s June 2025 launch; KYB vendors already exist (novelty 6). |
| Payee Lock | 72.0 | Lock on business-email payment changes | Real problem, crowded space. |
| Counter Script | 71.4 | Guard employees about to reset a password | Valid; overlaps Posh Simulator / Posh Protect — speaking point, not the demo. |

---

## Primary project: Hold Line

**Hold Line** asks what the member was told, names the specific lie, and holds the payment for a callback to the number already on the account.

| Signal | Value |
| --- | --- |
| Weighted score | 85.4 / 100 |
| Industry context | $3.5B FTC imposter-scam losses (2025) |
| Panel fit | 3 of 8 judges operate Sound |
| Institution scale | ~$3.40B Sound assets (June 30, 2026 call report) |

### What the demo has to prove

Synthetic scenario. The contrast is the product: **same authenticated member, different decision**. MFA passed in every case.

#### 1) Generic banner (fails)

- Wire **$48,200** to Treasury Safe Holdings.
- Margaret, 71, called the number in a fake Sound text. The caller said branch staff are under investigation and she must move the money before they freeze it.
- Screen: *“Scams exist. Review the recipient before you continue.”*
- Outcome: Margaret continues. The caller told her the credit union would say that. **$48,200 leaves.**

#### 2) Hold Line (holds)

- Same wire. Same member. Same story.
- Screen: *“Sound will never ask you to move money into a safe account to protect it. This story matches bank-impersonation scams. Held for a callback to the mobile number already on the account.”*
- Outcome: Payment held. Employee sees tags: `protect-the-account`, `secrecy`, `new payee`, `government handoff`.

#### 3) Legitimate wire (allows)

- Wire **$186,400** to First American Title.
- Margaret is closing on a house. The payoff instruction matches the title company already on file.
- Screen: *“First American Title is an existing payee. No secrecy story. No one asked her to keep this from the branch.”*
- Outcome: Allowed. The control is quiet when the payment is ordinary.

---

## Weekend plan

### Hard schedule (official)

| Gate | Time (PDT) |
| --- | --- |
| Check-in | By **9:00 AM** Sat |
| Challenge reveal | Opening ceremonies Sat |
| **Phase 1 submission deadline** | **3:30 PM** Sat |
| Judging | 3:30–5:15 PM Sat |
| Phase 1 winners | ~5:30 PM Sat |
| Phase 2 polish + Devpost | Into **Sun Oct 18** (Grand Prize $15k + CoMotion) |

### Must ship for Phase 1 (by 3:30 PM Sat)

- Working prototype (clickable / visual) — member **and** employee views
- **HuskyHack one-pager** (required with the build)
- Member screen with a generic banner **and** Hold Line contrast
- Tags the judge can see
- Deterministic hold, allow, or callback
- One legitimate title-company wire that is allowed
- An audit line
- Rehearsed short demo path before submission

### Leave for later (Phase 2 / stretch)

- Mule graph
- JSON tool-call view for a voice agent
- Recovery card if the money already left (accountants still scramble on new accounts, payroll/bill swaps, and bank credit tracking — see [field note in research](./research.md#field-note-post-compromise-recovery))
- Any live core, any real member data
- Any accuracy percentage without a confusion matrix

### Order of work (updated to the real clock)

| When | Focus |
| --- | --- |
| Before Saturday | Scenarios + tag rules on paper; repo/scaffold ready; one-pager outline |
| Sat morning (post-reveal) | Lock prompt framing; rules + tests; start both screens |
| Sat midday | Finish Hold Line vs banner contrast + employee tags + allowed wire |
| Sat ~2:00–3:00 PM | One-pager + rehearse 3-minute path **twice**; buffer for Devpost upload |
| Sat 3:30 PM | **Submit** — stop building Phase 1 features |
| Sat evening / Sun | Phase 2 polish only if advancing toward Grand Prize: recovery story card, more scenarios, mule stretch **only if** hold already worked |

### Suggested stack

- TypeScript
- Scenario JSON
- Tested rules
- A model **may** extract tags
- The allow-or-hold decision stays **in code** so it still runs offline and so Demirkan and Sternitzky can inspect it

---

## Pitch boundaries

| If a judge says… | Answer |
| --- | --- |
| We already have Falcon and continuous verification. | They pass in the demo, because Margaret is real. The scam is the instruction. |
| Members hate friction. | The house-closing wire is silent. The question appears only when the story and the payee are both risky. |
| Posh already catches fraud on calls. | This is the payment policy, including the branch, where no voice agent is present. |
| Is this a company? | The buyer is fraud and digital at a credit union. We are not claiming a $10 million revenue path from a prototype. |
| What did Sound lose? | We do not know. The public record supports the pattern, not an internal number. |
| What about recovery / support after fraud? | Prevention is the demo. Day-after work is real: new accounts, swapping payroll and bills, tracking bank credits. We name that gap; we do not claim we built the recovery suite this weekend. |

### Sealed-prompt contingency

If Saturday’s brief is financial confidence rather than fraud, keep the same rules and frame the hold as protecting the member’s ability to stay housed and solvent.

---

## Open team notes

_Use this space for decisions after kickoff (stack choices, who owns screens vs rules, Devpost blurbs, etc.)._

-
-
-
