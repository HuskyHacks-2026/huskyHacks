# Agent Alias Vault - backend

In-memory TypeScript API (Hono) implementing PRD §13 / decisions D1-D13. `npm install && npm start` -> `http://localhost:8787` (CORS open).
`npm run verify` = typecheck + tests. With the server up, `npm run demo` replays the judge script in the terminal.

## Two surfaces (this split is the S1/S3 claim)

**Agent-facing `/api/agent/*`** - what the shopping agent (Perplexity/Muse/Grok) sees. Tests assert no member name/account/routing/balance ever appears here, including in errors and the event log.

| Call | Result |
| --- | --- |
| `POST /api/agent/cards` `{task, budgetCents, allowedCategories[]}` | Agent A decides. `201` minted (card has fake `pan/cvv/exp`) · `202` `PENDING_OVERRIDE` (member must approve; `card: null`) · `403` `DENIED` |
| `GET  /api/agent/cards/:id` | status, rules, card, last cart verdict |
| `POST /api/agent/cards/:id/cart` `{merchant, items[{name,qty,unitPriceCents,category?}]}` | Agent B reviews the WHOLE cart: `{approved, attempt, totalCents, rejections[{index,name,reason}], message}`. No money moves. Loop until `approved`. |
| `POST /api/agent/cards/:id/checkout` | Only after full approval; buys the approved cart, **closes the card**, releases remainder. `409` otherwise. |
| `POST /api/agent/cards/:id/charge` `{merchant, category, amountCents}` | Raw network auth for the off-task/compromise demo. `402` hard decline: `CARD_CLOSED` `CARD_EXPIRED` `OFF_TASK` `OVER_BUDGET` `BAD_AMOUNT` |

**Member/vault-facing (frontend dashboard)**

| Call | Result |
| --- | --- |
| `GET /api/vault` | member (name, `accountLast4`, `balanceCents`) + all cards (`pendingOverride` flag) |
| `POST /api/vault/cards/:id/override` `{approve: bool}` | member decision (D8); mints on approve |
| `GET /api/events?since=<seq>` | audit feed `{seq, ts, actor, type, summary, cardId}` - poll this for the live log panel |
| `GET /api/demo/scenarios` | canned shopping-agent scenarios: `groceries` (bad cart then fixed), `injection`, `boat` (override), `gambling` (deny) |
| `POST /api/demo/reset` | fresh state before each rehearsal |

Money is integer cents. Statuses: `PENDING_OVERRIDE | OPEN | CLOSED | DENIED`.

## Behavior notes (demo-level choices where the PRD is open)

- **Agent A** (Q21/Q23/Q26 undefined, so a short heuristic): deny restricted categories (gambling/crypto/gift cards); needs member override if budget > cap (default $200 for thin history <5 txns, else 3x the member's largest past txn) or a category the member never buys. Rule-based, deterministic; no LLM call to flake on stage.
- **Agent B** classifies items by name itself and ignores the agent's category label. Unrecognized or ambiguous items fail closed. One bad line rejects the whole list (D13).
- Funds are **held** from the member's real balance at mint and the unspent remainder released at close. Cards expire after 30 min.
- State is in memory; restart or `/api/demo/reset` clears it.
