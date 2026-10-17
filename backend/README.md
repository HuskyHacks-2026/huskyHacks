# Agent Alias Vault - backend

Hono API implementing the frontend's `VaultApi` contract (`web/src/api/types.ts` is the single source of truth; the backend imports its types) plus PRD D1-D13.

```bash
cd backend && npm install
npm start            # http://localhost:8787/api   (TYPESAFE_API_KEY enables Jev)
npm run verify       # typecheck + tests
npm run demo         # old CLI replay (needs server up)
npx tsx scripts/live-check.ts   # scenarios + adversarial items against a running server
```
Frontend against it: `cd web && VITE_API_MODE=http VITE_API_BASE_URL=http://localhost:8787/api npm run dev`.

## Endpoints (all under `/api`)

| Side | Call | Notes |
| --- | --- | --- |
| agent | `POST /tasks/confirm` | Agent A -> `approved \| needs_override \| denied` with `checks[]` |
| agent | `POST /cards {taskId}` | mints the virtual card (fake PAN), holds funds; one card per task |
| agent | `POST /cards/:id/cart {items}` | Agent B reviews the WHOLE cart; no money moves |
| agent | `POST /cards/:id/checkout` | only after full approval; buys, closes card, releases remainder |
| agent | `POST /cards/:id/charge` | network simulator; declines closed/expired/off-task/over-limit and anything before cart approval |
| member | `GET /member`, `POST /tasks/:id/override`, `POST /reset`, `GET /events` | need header `x-member-token` (default `demo-member-token`, env `VAULT_MEMBER_TOKEN`) |

Every request carries `x-session` (the web client generates one per browser) so judges don't share state. Sessions persist in Upstash/Vercel KV (`KV_REST_API_URL`+`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_*`), falling back to in-memory.

## Jev (TypeSafe System One)

`TYPESAFE_API_KEY` turns it on (`jev-latest`, 8s timeout, 1 retry, falls back to rules on any failure).
- **Agent B**: one Choice question per cart line ("what category is this item?"). Jev can only make Agent B *stricter* (real probability on a disallowed category rejects) or recognize an item the keyword catalog doesn't know (needs >=0.6 on an allowed category). The agent's own category label is never trusted.
- **Agent A**: one Noul question, "does this request make sense for this member's history?"; below 0.3 it adds a failing check -> member override. It can never rescue a failed rule or a denied category.

## Behavior notes
- Agent A rules (Q21/Q23/Q26 are open in the PRD, so this is a short demo heuristic): deny gift cards/gambling/crypto; override if a category is new to the member, budget > $500 default cap, or budget > 3x their largest past transaction.
- Funds are held from checking at mint; the unspent remainder is released at close. Cards expire after 30 min.
- Agent-facing responses never contain account/routing/member id; a test runs the real frontend client through the whole script and scans every agent-visible body.
- **Known limits:** the member token is a shared demo secret, not real auth; Jev can be wrong, which is why rules still gate everything.
