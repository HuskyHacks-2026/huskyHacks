# How other agents wire these demos & test cases into the system

**Audience:** Cursor / coding agents working on `backend/`, `web/`, pitch, or CI.  
**Owner of this folder:** demo/test lane. Do **not** edit `backend/` or `web/` from this lane; consume their contracts.  
**Source of truth for scenarios:** [`src/scenarios.ts`](./src/scenarios.ts) · human table: [`test-cases.md`](./test-cases.md)  
**Wire contract:** `web/src/api/types.ts` (`VaultApi`) — backend implements it; demos drive it.

---

## 1. What this folder is

`demos/` is an **independent package**. It does not ship UI and does not implement Agent A/B. It:

1. Defines **13 locked scenarios** as executable step lists (happy / bad / phish / audit).
2. Runs them against the real backend HTTP API (or in-process via `backend/src/app`).
3. Asserts every PRD beat (confirm → override? → mint → cart loop → buy+close → hard block) and that the **agent surface never sees** account number, routing number, member id, or raw member balance.

| Use | How |
| --- | --- |
| Regression gate after backend changes | `cd demos && npm test` |
| Live rehearsal | `cd demos && npm run demo` (API default `http://localhost:8787/api`) |
| Scenario fixtures for the frontend | Import carts/prompts from `src/scenarios.ts` or copy from `test-cases.md` |
| Contract check when wiring `web` → `backend` | Map UI clicks to the step kinds below |

---

## 2. Repo layout (do not flatten)

```
huskyHacks/
  backend/          # mint, Agent A/B (+ optional Jev), checkout, hard block
  web/              # Agent Pay UI (owns VaultApi types)
  demos/            # THIS package
  docs/             # PRD + planning
```

`demos/` may **import** `backend/src/*` and `web/src/api/types` for in-process tests. It must never write into `backend/` or `web/`.

---

## 3. Backend contract (VaultApi under `/api`)

Documented in `backend/README.md`. Every request should send `x-session` (session isolation). Member routes also need `x-member-token` (default `demo-member-token`).

### Agent-facing — **no** member token

| Method | Path | Body | Result |
| --- | --- | --- | --- |
| POST | `/tasks/confirm` | `{ agentName, task, budgetCents, categories[] }` | `TaskVerdict` (`approved` \| `needs_override` \| `denied`) |
| POST | `/cards` | `{ taskId }` | `VirtualCard` (fake PAN) or error (`TASK_NOT_APPROVED`, `INSUFFICIENT_FUNDS`, …) |
| POST | `/cards/:id/cart` | `{ items: CartItem[] }` | `CartVerdict` (whole-list approve/reject) |
| POST | `/cards/:id/checkout` | — | `Receipt`; card CLOSED |
| POST | `/cards/:id/charge` | `{ merchant, category, amountCents }` | `ChargeResult` (`CARD_CLOSED`, `OFF_TASK_BLOCKED`, `OVER_LIMIT`, `CART_NOT_APPROVED`, …) |

### Member-facing — **requires** `x-member-token`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/member` | masked accounts + history |
| POST | `/tasks/:id/override` | `{ approve: bool }` |
| GET | `/events?since=N` | audit feed |
| POST | `/reset` | wipe session (`204`) |

**Hard rule:** never put `x-member-token` on agent calls; never return full account/routing/memberId on the agent surface. Our runner fails if those leak.

Categories (see `web/src/api/types.ts`):  
`grocery | dining | gas | utilities | pharmacy | electronics | gift_card | marine | entertainment | gambling | crypto | clothing | household | travel | luxury`

---

## 4. Scenario step kinds → wire UI / bots here

| `kind` | Who | Backend call | UI hint |
| --- | --- | --- | --- |
| `member_says` | member | — | prompt / preset |
| `narrate` | narrator | — | console callout |
| `agent_plans` | shopping agent | — | show derived task + budget + categories |
| `confirm_task` | Agent A | `POST /tasks/confirm` | approved / needs_override / denied + checks |
| `member_override` | member | `POST /tasks/:id/override` + token | Approve / Deny |
| `mint_card` | vault | `POST /cards` | virtual card panel; prove no real account |
| `submit_cart` | Agent B | `POST /cards/:id/cart` | line verdicts + feedback |
| `checkout` | vault | `POST /cards/:id/checkout` | receipt + CLOSED |
| `charge` | network / attacker | `POST /cards/:id/charge` | decline banner |
| `agent_inspects` | agent / attacker | (last mint body + leak scan) | “what the agent holds” |
| `member_dashboard` | member | `GET /member` + token | checking balance delta |

---

## 5. How to run

```bash
cd backend && npm install
cd ../demos && npm install

cd demos && npm test            # in-process
cd demos && npm run verify

cd backend && npm start         # :8787
cd demos && npm run demo
cd demos && npm run demo -- mexico-vacation groceries-plus-tv --events
cd demos && API=http://localhost:8787/api npm run test:live
```

**Suggested judge path:**  
`mexico-vacation` → `groceries-plus-tv` → `injection-gift-cards` → `phish-for-account-numbers` or `total-agent-failure`.

---

## 6. Wiring into `web/`

`web` already speaks VaultApi (`mockApi` / `httpApi`). Prefer:

1. Keep `demos/src/scenarios.ts` as the expanded locked set (backend currently re-exports only the smaller `web/src/demo/scenarios.ts` list).
2. Add UI presets for the locked ids (`groceries-week`, `mexico-vacation`, …) or map buttons → our carts.
3. Member calls must send `x-member-token`; agent console must never show it.
4. Reuse `data-testid`s in `web/README.md` so UI tests can drive the same IDs.
5. After wiring HTTP mode: `cd demos && npm test` must still pass against that backend.

Frontend against local API:

```bash
cd web && VITE_API_MODE=http VITE_API_BASE_URL=http://localhost:8787/api npm run dev
```

---

## 7. Wiring into `backend/`

When you change Agent A/B, mint, or charge:

1. Run `cd demos && npm test` before claiming done.
2. If expectations must change, edit **`demos/src/scenarios.ts`** and **`demos/test-cases.md`** together.
3. Keep leak-scan coverage in `demos/test/scenarios.test.ts`.
4. Thin-history coverage: `demos/test/new-member.test.ts` (in-process; skipped under `API=`).

---

## 8. Programmatic use

```ts
import { createApp } from '../backend/src/app'
import { VaultClient } from './src/client'
import { byId } from './src/scenarios'
import { runScenario } from './src/runner'

const app = createApp()
const client = new VaultClient('http://vault.local/api', async (url, init) => app.request(url, init))
const result = await runScenario(byId('groceries-plus-tv')!, client)
if (result.failures.length || result.leaks.length) throw new Error(result.failures.join('\n'))
```

---

## 9. Adding a new locked test case

1. Add a `Scenario` to `SCENARIOS` in `src/scenarios.ts`.
2. Add a row to `test-cases.md`.
3. `npm test` and `npm run demo -- <id>`.
4. Tell frontend which step kinds need chrome.

Keep cart item names keyword-friendly for `backend/src/catalog.ts` (or expect unrecognized-item rejects).

---

## 10. Ownership

| Path | Who edits |
| --- | --- |
| `demos/**` | demo/test lane |
| `backend/**` | backend lane |
| `web/**` | frontend lane |
| `docs/prd-agent-alias-vault.md` | shared product |

If two lanes need the same scenario data, **import or copy from `demos/`** — do not invent a third list for the expanded set.

---

## 11. Quick health after sync

```bash
git fetch --all
cd backend && npm install && npm run verify
cd ../demos && npm install && npm run verify
cd ../web && npm install && npm run build
```

If demos fail with `401` on member routes → missing `x-member-token`.  
If fail with `BAD_SESSION` → invalid `x-session`.  
If fail on path 404s → base URL must include `/api` (e.g. `http://localhost:8787/api`).
