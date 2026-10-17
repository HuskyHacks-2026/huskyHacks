# PRD: Agent Alias Vault (working title)

**Event:** HuskyHack 2026  
**Status:** Draft — decisions in progress  
**Last updated:** 2026-10-17  
**Sources:** Team recorded pitch transcript; team clarifications in chat  

### Decisions locked

| ID | Decision | Source |
| --- | --- | --- |
| D1 | Hackathon uses a **virtual card** backed by **fake money** (not a real issuer API; no real funds). Terminology: say **virtual card**, not “fake card.” | Team answer 2026-10-17: Q1 → A; wording correction 2026-10-17 |
| D2 | Default: card issues **automatically from the prompt** (no member approve step). Exception: **highly suspicious** requests require member approval before issue (example given: $100,000 boat purchase on a Tuesday morning). Exact suspicion rules **not yet defined**. | Team answer 2026-10-17: Q3 → B + exception |
| D3 | Off-task spend on an issued card is a **hard block** — charge does not go through (not soft-flag-only) | Team answer 2026-10-17: Q2 → A |
| D4 | Transaction history is used to decide **whether a wallet may be minted at all** (allow/deny), including denying weird/new patterns — not primarily for amount suggestion or merchant lists (those not chosen here) | Team answer 2026-10-17: Q8 → B |
| D5 | Thin/no history: use a **default ruleset** that **updates as history accumulates** (not “block until history” or “tiny only” or “always approve” as the chosen path) | Team answer 2026-10-17: Q9 → D |
| D6 | Audit timing (earlier): runs after rules exist, before mint — **timing may still hold; purpose superseded by D7** | Team answer 2026-10-17: Q11 → A |
| D7 | **Correction:** Audit does **not** confirm rules/budget vs user prompt. Shopping agent (e.g. Perplexity / Muse) **creates rules/budget and sends them to us**. Audit only checks: **does this purchase make sense for this user?** If no → **manual override**. Confirming prompt fidelity is explicitly out of scope / impossible per team. | Team correction 2026-10-17 |
| D8 | Manual override actor is the **member** (not CU employee as the chosen path) | Team answer 2026-10-17: Q24 → A |
| D9 | Demo uses a **real chat/agent bot** (team example: “Grok bot or something”) with a **virtual card** and **fake money**. Exact bot product not locked beyond that example. | Team answer 2026-10-17 on Q14 |
| D10 | **Cart-then-buy model:** Agent builds a shopping list/cart and **does not spend** while shopping. When it thinks the task is finished, it submits the cart. If anything is **disapproved**, we **send a response back** so the agent can fix or remove items. **Only when we are sure** do we buy everything, then **close the card immediately** (no further spend). | Team clarification 2026-10-17 |
| D11 | Cart disapproval/confirmation is done by **an agent checking against automatic rules** (not “member clicks approve each item” as the primary path; not rules-with-no-agent). | Team answer 2026-10-17 on Q30 |
| D12 | **Two agents:** (1) confirms **Perp’s task and budget**; (2) confirms the **final shopping list against that task and budget**. Not the same agent. | Team answer 2026-10-17 on Q31 |
| D13 | Cart approval is a **loop**: Muse/Perp **keeps iterating the shopping list** until Agent B approves the **whole list**. No partial checkout of a half-approved cart. | Team answer 2026-10-17 on Q29 |
| D14 | Remaining open questions from the crunch batch (demo story, Sound vs generic, product name, Agent A signals, seat names) are **skipped for now** — not blocking Phase 1 MVP stub. | Team 2026-10-17 |

---

## 1. One-sentence product

The agent never sees a member’s real account info. For a task, it only receives a temporary alias (virtual card / wallet handle) with rules and guardrails. If the agent is compromised, what it holds is useless beyond that narrow, time-bound allowance.

---

## 2. Problem (from pitch — confirmed)

Agents (example used in pitch: Perplexity doing a shopping task) can go astray via prompt injection or bad decisions and cause money loss.

Today, giving an agent payment ability risks giving away too much: money and/or account-adjacent access.

---

## 3. Goals (confirmed)

| ID | Goal |
| --- | --- |
| G1 | Agent never has access to member account information. |
| G2 | If the agent is compromised, information it holds cannot be used to access the real account. |
| G3 | Agent only receives a temporary alias bound to a transaction/task, with rules and guardrails. |
| G4 | Agent does not get unlimited access to virtual wallets. |
| G5 | Virtual wallets are only created and used based on the user’s transaction history. |
| G6 | **Two confirmation agents (D12):** Agent A confirms Perp’s **task + budget** (for the member / against policy — still **not** “re-hear the user’s words”; D7). Agent B confirms the **final cart against that task + budget**. Failures → fix loop and/or **member manual override** where D7/D8 apply. |

---

## 4. Non-goals (confirmed only where stated)

| ID | Non-goal | Notes |
| --- | --- | --- |
| NG1 | Giving the agent the real account / unlimited wallet access | Explicitly rejected by team |
| NG2 | — | Other non-goals not yet decided (see Open Questions) |

---

## 5. Confirmed product flow (from pitch)

What the team described as the intended path:

1. **User writes a task** to an agent (pitch example: “buy groceries” + grocery list; Perplexity named as example agent).
2. **Shopping agent** (pitch examples: Perplexity, Muse) turns the user task into **rules/budget** and **sends that package to our API** when requesting a virtual card / alias.
3. **Our system does not re-derive or “confirm” that those rules match the user’s original words** (D7 — team: impossible).
4. **Before mint (timing per D6, pending reconfirm):** **Audit subagent** checks whether the **proposed purchase makes sense for this member** (history/default ruleset context — exact signals TBD).
   - If it makes sense → proceed toward mint.
   - If it does not → **ask the member for manual override** (D8).
5. **On mint:** virtual card is bound to the agent-supplied rules/budget; card is for the task but **no purchase yet**.
6. **Cart phase (D10):** agent builds shopping list/cart; no money moves.
7. **Checkout propose (D13):** agent submits cart. Agent B must approve the **whole list**. If not → response to Muse/Perp → **iterate** → resubmit. Loop until full approval.
8. **Buy + close:** when whole cart approved → purchase with **fake money** on the **virtual card** → **close card immediately** (D10). Off-rules spend **hard-blocked** (D3).
9. Raw user prompt storage still parked (Q25).

---

## 6. Confirmed constraints on wallet issuance

From team clarification (not fully specified in the pitch recording):

- Virtual wallets are **not** unlimited / free-for-all for the agent.
- Creation and use of virtual wallets are **based on the user’s transaction history**.
- **D4:** History gates **mint allow/deny** (weird/new patterns can be refused).
- **D5:** Thin/no history → **default ruleset**, then that ruleset **updates as history grows**. Contents of the default ruleset still open (Q23).

---

## 7. Roles in the system (named in pitch / chat; responsibilities incomplete)

| Role | Mentioned duties | Unresolved |
| --- | --- | --- |
| Member / user | Writes the task/prompt | Auth, UX, approval steps |
| Shopping / payment agent (e.g. Perplexity) | Requests virtual card via API; tries to complete purchase | Who hosts the agent in the demo |
| Alias / virtual-card issuer API | Takes prompt; mints card with task + amount + rules | Who builds/hosts; Visa vs mock |
| Shopping agent (Perp / Muse / etc.) | Creates rules/budget from user task; sends to our API | Out of our confirmation scope (D7) |
| Fraud / block layer | Hard-blocks spend that doesn’t match **agent-supplied** rules (D3) | How mismatch is detected; logging/UX |
| Agent A — task/budget confirm | Confirms Perp’s task + budget before we proceed (D12); sense/policy for member (D7); member override if needed (D8) | Exact pass/fail criteria (Q26) |
| Agent B — cart confirm | Confirms final shopping list **against** that task + budget (D11/D12); disapprove → response to shopping agent to fix/remove (D10) | Same vs different model instance only |

---

## 8. Success criteria for the hackathon

### 8.1 Must be true for the pitch claim to hold

| ID | Criterion | Status |
| --- | --- | --- |
| S1 | Demo shows agent receiving an alias, not real account data | Specced as requirement; build TBD |
| S2 | Demo shows rules/guardrails blocking or flagging off-task spend | Specced; exact behavior TBD |
| S3 | Demo shows compromise of agent does not expose real account info | Specced; exact “compromise” scenario TBD |
| S4 | Presentation can explain the idea in plain language | In progress |

### 8.2 Judging alignment (from event docs — for reference)

HuskyHack weights: Impact 30% · UX/Trust 25% · Feasibility 20% · Innovation 15% · Prototype/Presentation 10%.

How this product maps to those weights is **not yet decided by the team** (see Open Questions Q16).

---

## 9. Explicitly vague / incomplete areas (do not invent)

These appeared in the pitch as open or unfinished:

1. **How much money** gets assigned to a task (heuristic? model? history? hard caps?).
2. **How the prompt becomes rules** — shopping agent (Perp) owns this; we do not re-validate prompt fidelity (D7).
3. **Virtual card integration reality** — resolved D1: virtual card + fake money, not real issuer.
4. **Team work split** across four people (requested; draft in §11 pending confirmation).
5. Pitch also mentioned “raise the amount of money” in a fragmented line — **meaning unclear**; not interpreted here.
6. “Four ways” / small ideas between teammates — **not captured**; need team input.

---

## 10. Open Questions

### Phase 1: skipped / parked (D14)

Q15, Q16, Q18, Q19, Q26 and earlier parked IDs — **not required** to start the 45-min MVP. Fill later if needed.

**Q29:** resolved in **D13** — Muse/Perp iterates until the **whole** shopping list is approved.

### Product / policy

| ID | Question |
| --- | --- |
| ~~Q1~~ | ~~Real issuer vs mock vs both?~~ | **Resolved in D1: virtual card + fake money (no real issuer)** |
| ~~Q2~~ | ~~Hard-block vs soft-flag vs both for off-task spend?~~ | **Resolved in D3: hard-block** |
| ~~Q3~~ | ~~Member approve before mint, or automatic?~~ | **Resolved in D2: automatic, unless highly suspicious** |
| ~~Q4~~ | ~~Lifetime of alias?~~ | **Resolved via D10: open through cart; close immediately after approved buy** |
| Q5 | Can one task mint **one** alias only, or multiple? |
| Q6 | What exact **member account fields** are never allowed into agent context (account number, routing, balance, full history, name, etc.)? |
| Q7 | What **is** allowed in agent context besides the alias credentials (merchant list? last4? nothing?)? |

### Transaction-history constraint (G5)

| ID | Question |
| --- | --- |
| ~~Q8~~ | ~~History for amount, mint gate, merchants, or other?~~ | **Resolved in D4: mint allow/deny gate** |
| ~~Q9~~ | ~~New member thin/no history?~~ | **Resolved in D5: default ruleset that updates with history** |
| Q23 | What is **in** the default ruleset for new members (caps, categories, MCC allowlist, count of open wallets, etc.)? |
| Q10 | Whose history is used — **this member only**, household, or anonymized peer patterns? |

### Audit subagent (G6)

| ID | Question |
| --- | --- |
| ~~Q11~~ | ~~When does audit subagent run?~~ | **Resolved in D6: after rules, before mint** |
| ~~Q12~~ | ~~If audit fails: block / log / regenerate?~~ | **Superseded by D7: manual override path** (not regenerate-rules-as-primary) |
| Q13 | Must the audit agent be a **separate model/process** with separate prompts, or is “second check in the same service” enough for the hackathon? |
| ~~Q24~~ | ~~Who does manual override?~~ | **Resolved in D8: member** |
| Q25 | Do we still store/attach the **raw user prompt** on the card, or only the **agent-supplied rules/budget**? |
| Q26 | What signals mean “makes sense for this user” (history patterns, amount vs usual, category, time-of-day, merchant, default ruleset, etc.)? List for demo — do not invent. |

### Scope / demo

| ID | Question |
| --- | --- |
| ~~Q14~~ | ~~Real agent vs scripted?~~ | **Resolved in D9: real bot (e.g. Grok or similar) + virtual card + fake money** |
| Q27 | Exact demo agent product/API (**Grok**, other, TBD) and how it calls our mint API |
| ~~Q28~~ | ~~What does “expire” mean?~~ | **Resolved in D10: cart → propose → fix loop → buy all → close card** |
| ~~Q29~~ | ~~Hard-block / cart loop?~~ | **Resolved in D13: whole-list approval loop** |
| ~~Q30~~ | ~~Who disapproves cart items?~~ | **Resolved in D11: agent confirms against automatic rules** |
| ~~Q31~~ | ~~Same vs second agent?~~ | **Resolved in D12: two agents (task/budget vs cart)** |
| Q15 | Which **happy path** and which **attack path** are required for judging (e.g. groceries OK vs prompt-injection to movie site)? |
| Q16 | Are we still positioning for **Sound Credit Union / ACH**, or strictly **card/Visa virtual card** as in the pitch? |
| Q17 | What did “use this to raise the amount of money” mean in the recording? |
| Q18 | Product name for slides: **Agent Alias Vault**, **Virtual Card for Agents**, or other? |
| Q21 | What makes a request **highly suspicious** enough to require member approval (D2)? Fixed rules, history-based, model judgment, or a short demo heuristic list? |
| Q22 | For a suspicious request: does the member approve **the whole mint**, or approve a **reduced amount / tighter rules**? |

### Team

| ID | Question |
| --- | --- |
| Q19 | Confirm or rewrite the §11 four-person split (names + ownership). |
| Q20 | Who owns final pitch script and slide deck? |

---

## 11. Proposed four-person work division (draft — confirm names)

Needed workstreams from the request: **(A) feature/system**, **(B) demo/simulation**, **(C) presentation**. Split across four people:

| Seat | Owns | Primary deliverables | Does not own |
| --- | --- | --- | --- |
| **P1 — System / API** | Feature core | Alias mint API; task + amount + rules attachment; enforce “no real account data in response”; wallet issuance limits | Slides; attack-script acting |
| **P2 — Two confirm agents** | Guardrails | Agent A (task/budget confirm); Agent B (cart vs task/budget); member override hook; contracts with P1 | Demo UI polish; final pitch delivery (unless also presenter) |
| **P3 — Demo / simulation** | Show don’t tell | Scripted or live agent flow; happy path + compromise/off-task path; fake merchant pages or stubs | Core policy design |
| **P4 — Presentation + glue** | Story | Slide deck; 90s talk track; judge Q&A sheet; integrate demo into narrative; Devpost blurb | Deep card-issuer implementation |

**Shared:** Agree answers to Open Questions before coding; freeze demo script early so P3/P4 are not blocked.

**Dependency order (logical):**

1. Answer Q1–Q3, Q8, Q11–Q12, Q14–Q16 (blocks architecture).  
2. P1 + P2 define API contracts.  
3. P3 builds against contracts (mocks OK if Q1 = mock).  
4. P4 writes pitch from frozen claims only (claims must match what demo shows).

---

## 12. Out of scope for Phase 1 MVP

- Real Visa/Mastercard issuer  
- Real money / real core banking  
- Perfect prompt-fidelity checking (D7)  
- Polished multi-page bank app  
- Settling skipped questions (D14)

---

## 13. Phase 1 MVP — rough draft (≈45 min, vibe-coded, demo-able)

**Goal:** One clickable demo that proves the story: agent never sees the real account; gets a **virtual card** + **fake money**; Agent A checks task/budget; cart loops until Agent B approves the **whole** list; then buy once and **close the card**.

**Build style:** Vibe-code one small app (Cursor agent). Prefer **one folder**, **one runnable command**, hardcoded demo data. No hand-crafted pixel polish.

### 13.1 Demo script (what judges must see)

1. Member task appears: e.g. “buy groceries, budget $80” (typed or preset button).  
2. Shopping agent (stub or live bot) sends **task + budget** → our API.  
3. **Agent A** pass → mint **virtual card** (show fake PAN/last4 + balance + rules). Screen shows: **no real account numbers**.  
4. Agent submits a **bad cart** (e.g. groceries + a TV / movie).  
5. **Agent B rejects** → response “remove X” → agent resubmits cleaned cart (**loop, D13**).  
6. Agent B **approves whole list** → charge fake money → card status **CLOSED**.  
7. Optional one-liner: try spend again → blocked.

### 13.2 Minimum surfaces

| Piece | Phase 1 shape |
| --- | --- |
| UI | Single page: left = agent/chat-ish log; right = vault (card, rules, cart, status) |
| Data | Hardcoded member + short transaction history + default ruleset JSON |
| API | In-process functions or tiny local server: `mint`, `confirmTaskBudget`, `submitCart`, `checkout` |
| Agent A | LLM call **or** dumb rules (amount vs history / cap). Must return pass/fail + reason |
| Agent B | LLM call **or** category/keyword match vs task. Reject partial lists; approve only when **all** lines OK |
| Shopping agent | Button that injects canned carts **or** Grok/Perp if already wired — canned is OK for 45 min |
| Money | Integer cents in memory; never call a real processor |

### 13.3 Timebox (45 minutes)

| Min | Do |
| ---: | --- |
| 0–5 | Scaffold app; hardcoded member + history + default rules JSON |
| 5–15 | `mint` + UI card panel (virtual card, fake money, CLOSED/OPEN) |
| 15–25 | Agent A stub on task/budget; block mint on fail; member override button if fail |
| 25–40 | Cart submit + Agent B loop (reject → fix payload → approve) + checkout closes card |
| 40–45 | Rehearse demo path once; fix only what breaks the story |

### 13.4 Explicitly cut from Phase 1

- Real issuer, real bot integration if it burns time (use canned agent messages)  
- Pretty design system  
- Multi-user auth  
- History-learning that updates rules live (show static default → “updates later” in pitch only)  
- Employee console  

### 13.5 Done when

You can run the demo cold and hit every step in §13.1 without apologizing. Code can be ugly.

### 13.6 Four-person parallel (if split during the 45)

| Seat | 45-min job |
| --- | --- |
| P1 | mint / checkout / close card + “no real account” guarantee in responses |
| P2 | Agent A + Agent B (even if rule-based) + reject reasons string |
| P3 | UI + canned happy/bad cart buttons + demo click path |
| P4 | 6-bullet talk track matching exactly what the screen shows |

---

## 14. Document control

| Version | Date | Change |
| --- | --- | --- |
| 0.1 | 2026-10-17 | Initial PRD from pitch transcript + chat constraints; open questions listed; no inferred product decisions |
| 0.2 | 2026-10-17 | D1: virtual card is simulated only (Q1=A) |
| 0.3 | 2026-10-17 | D2: auto-issue from prompt unless highly suspicious (Q3=B+exception); Q21–Q22 added |
| 0.4 | 2026-10-17 | D3: off-task spend hard-blocked (Q2=A) |
| 0.5 | 2026-10-17 | D4: history gates mint allow/deny (Q8=B) |
| 0.6 | 2026-10-17 | D5: thin history → default ruleset that updates (Q9=D); Q23 added |
| 0.7 | 2026-10-17 | D6: audit after rules, before mint (Q11=A) |
| 0.8 | 2026-10-17 | D7: audit = purchase-sense for member + manual override; shopping agent owns rules/budget; not prompt fidelity |
| 0.9 | 2026-10-17 | D8: manual override = member (Q24=A) |
| 0.10 | 2026-10-17 | D9: real bot (Grok-or-similar) + virtual card + fake money; Q27 for exact bot |
| 0.11 | 2026-10-17 | Wording: virtual card not “fake card”; D10 expire→spend→done; Q28 |
| 0.12 | 2026-10-17 | D10 rewritten: cart → disapprove/fix loop → buy all → close card; Q29–Q30 |
| 0.13 | 2026-10-17 | D11: cart confirm = agent vs automatic rules; Q31 same-vs-second agent |
| 0.14 | 2026-10-17 | D12: Agent A = task/budget; Agent B = cart vs task/budget; remaining Qs batched for crunch |
| 0.15 | 2026-10-17 | D13 cart loop until whole list approved; D14 skip rest; §13 Phase 1 45-min vibe MVP |
