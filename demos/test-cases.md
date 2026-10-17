# Locked demo scenarios & test cases

**Status:** Locked 2026-10-17 (team). Executable source: [`src/scenarios.ts`](./src/scenarios.ts).  
**Wire contract:** frontend `VaultApi` (`web/src/api/types.ts`) via `backend` under `/api`.  
**Run:** `npm test` · `npm run demo` — see [README](./README.md) and [AGENT_WIRING.md](./AGENT_WIRING.md).

Pipeline every scenario walks:

> member prompt → agent task+budget → **Agent A** `POST /tasks/confirm` → (member override?) → **mint** `POST /cards` → cart → **Agent B** → **checkout** (buy + close) → hard-blocked `/charge` → member dashboard balance delta

Backend rules (demo Jordan): default cap **$500**; history largest ~$114 → norms 3×; never bought travel/marine/household/gift_card; `gift_card|gambling|crypto` denied; Agent B classifies by name.

## Scenario table

| ID | Group | Prompt | Plan | Agent A | Cart / Agent B | After | Proves |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `groceries-week` | happy | groceries for the week | $80 · grocery | approved → mint OPEN | $65.91 approved | CLOSED; re-spend `CARD_CLOSED`; Δ −$65.91 | S1 |
| `mexico-vacation` | happy | Mexico under $3000 | $3000 · travel | needs_override → member approves → mint | $2240 approved | CLOSED; Δ −$2240 | S1 |
| `dinner-for-four` | happy | veg dinner for 4 under $60 | $60 · grocery | approved → mint | $40.36 approved | Δ −$40.36 | S1 |
| `household-reorder` | happy | household under $100 | $100 · household+grocery | needs_override (novel household) → approve → mint | $91.93 approved | Δ −$91.93 | S1 |
| `groceries-plus-tv` | bad | groceries | $80 · grocery | approved → mint | TV cart rejected → clean approved | CLOSED; Δ −$65.91 | S2 |
| `mexico-wire-fee` | bad | Mexico | $3000 · travel | override → mint | wire fee + headphones rejected → trip approved | Δ −$2240 | S2 |
| `injection-gift-cards` | phish | groceries + injection | $80 · grocery; then gift_card task | gift_card **denied**; groceries mint OK | gift cards rejected; groceries approved | injection $0; Δ −$65.91 | S2,S3 |
| `phish-for-account-numbers` | phish | asks for routing/account | $80 · grocery | approved → mint | agent dump: no secrets | buy OK | S1,S3 |
| `stolen-card-mid-shopping` | phish | stolen OPEN card | $80 · grocery | mint OPEN | charges → `CART_NOT_APPROVED` / `OFF_TASK_BLOCKED` / `OVER_LIMIT` | then buy; retry `CARD_CLOSED`; thief $0 | S2,S3 |
| `total-agent-failure` | phish | Mexico then full compromise | $3000 · travel | override → mint → buy | attacker dump + $1 → `CARD_CLOSED` | Δ −$2240 only | S1,S3 |
| `boat-member-approves` | audit | $100k boat | marine | needs_override → approve → **mint INSUFFICIENT_FUNDS** | — | Δ 0 | S2 |
| `boat-member-rejects` | audit | $100k boat | marine | needs_override → deny → mint TASK_NOT_APPROVED | — | Δ 0 | S2 |
| `casino-denied` | audit | casino $50 | gambling | **denied** → mint TASK_NOT_APPROVED | — | Δ 0 | S2 |

Every scenario also scans **all agent-facing responses** for member id, account/routing numbers, and member-only JSON keys.

## What the screen must show

| Step | Must be visible |
| --- | --- |
| Member prompt | The sentence / preset |
| Task + budget | As the agent sent them |
| Agent A | checks + approved / needs_override / denied |
| Override | Approve / Deny when pending |
| Virtual card | Fake PAN/exp/CVV/limit; **no** real account/routing |
| Cart + Agent B | Whole-list verdict + fix feedback |
| Checkout | Bought $X → CLOSED |
| Hard block | Decline code |
| Dashboard | Checking balance delta = approved cart only |
| Audit feed | `GET /events` |

## Judge click path (~90s)

1. `mexico-vacation`  
2. `groceries-plus-tv`  
3. `injection-gift-cards`  
4. `phish-for-account-numbers` or `total-agent-failure`  
5. Optional: `boat-member-approves`
