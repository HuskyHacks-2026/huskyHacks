# How other agents wire these demos & test cases into the system

**Audience:** Cursor / coding agents working on `backend/`, `web/`, pitch, or CI.  
**Owner of this folder:** demo/test lane. Do **not** edit `backend/` or `web/` from this lane; consume their contracts.  
**Source of truth for scenarios:** [`src/scenarios.ts`](./src/scenarios.ts) · human table: [`test-cases.md`](./test-cases.md)

---

## 1. What this folder is

`demos/` is an **independent package**. It does not ship UI and does not implement Agent A/B. It:

1. Defines **13 locked scenarios** as executable step lists (happy / bad / phish / audit).
2. Runs them against the real backend HTTP API (or in-process via `backend/src/app`).
3. Asserts every PRD beat (mint → Agent A → cart loop → Agent B → buy+close → hard block) and that the **agent surface never sees** account number, routing number, balance, or member name.

Use it as:

| Use | How |
| --- | --- |
| Regression gate after backend changes | `cd demos && npm test` |
| Live rehearsal against `npm start` | `cd demos && npm run demo` |
| Scenario fixtures for the frontend | Import shapes from `src/scenarios.ts` or copy carts/prompts from `test-cases.md` |
| Contract check when wiring `web` → `backend` | Map UI clicks to the step kinds below |

---

## 2. Repo layout (do not flatten)

```
huskyHacks/
  backend/          # teammate: mint, Agent A/B, checkout, hard block  → leave alone unless you own it
  web/              # teammate: Agent Pay UI                           → leave alone unless you own it
  demos/            # THIS package: scenarios, runner, leak scan, docs
  docs/             # PRD + planning
```

`demos/` may **import** `backend/src/*` for in-process tests only. It must never write into `backend/` or `web/`.

---

## 3. Backend contract this package expects

Documented in `backend/README.md`. Two surfaces:

### Agent-facing (shopping agent / attacker) — **no** `x-member-token`

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/api/agent/cards` | `{ task, budgetCents, allowedCategories[] }` | `201` OPEN · `202` PENDING_OVERRIDE · `403` DENIED |
| GET | `/api/agent/cards/:id` | — | status, rules, card (or null), generic `reasons` |
| POST | `/api/agent/cards/:id/cart` | `{ merchant, items[{name,qty,unitPriceCents,category?}] }` | `{ approved, attempt, totalCents, rejections[], message }` |
| POST | `/api/agent/cards/:id/checkout` | — | receipt; card CLOSED |
| POST | `/api/agent/cards/:id/charge` | `{ merchant, category, amountCents }` | `200` or `402` with decline code |

### Member-facing (dashboard) — **requires** header `x-member-token: demo-member-token`

(Override with env `VAULT_MEMBER_TOKEN`.)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/vault` | member last4 + balance + cards + Agent A `detail` |
| POST | `/api/vault/cards/:id/override` | `{ approve: bool }` (D8) |
| GET | `/api/events?since=N` | audit feed for the step log |
| POST | `/api/demo/reset` | wipe in-memory state before a scenario |
| GET | `/api/demo/scenarios` | backend's own canned list (subset; ours is richer) |

**Hard rule for any agent wiring UI or a bot:** never put `x-member-token` on agent-facing calls, and never return vault `detail` / `balanceCents` / full account numbers on the agent surface. Our runner fails the scenario if those leak.

Categories the backend accepts today:

`groceries | household | clothing | electronics | entertainment | travel | luxury | gambling | crypto | gift_cards`

(Frontend `web/` currently uses a different category vocabulary — see §6.)

---

## 4. Scenario step kinds (wire UI / bots to these)

Each scenario in `src/scenarios.ts` is an ordered list of `Step`s. When you add a button or an agent tool, map it to one of these:

| `kind` | Who acts | Backend call | UI hint |
| --- | --- | --- | --- |
| `member_says` | member | none (display) | show prompt text / preset chip |
| `narrate` | narrator | none | callout / console note |
| `agent_plans` | shopping agent | none yet | show derived task + budget + categories |
| `request_card` | Agent A via vault | `POST /api/agent/cards` | show OPEN / PENDING_OVERRIDE / DENIED + virtual card |
| `member_override` | member | `POST /api/vault/cards/:id/override` + token | Approve / Deny buttons |
| `submit_cart` | shopping agent → Agent B | `POST /api/agent/cards/:id/cart` | cart lines + APPROVED/REJECTED |
| `checkout` | vault | `POST /api/agent/cards/:id/checkout` | receipt + CLOSED |
| `charge` | network / attacker | `POST /api/agent/cards/:id/charge` | decline code banner |
| `agent_inspects` | agent / attacker | `GET /api/agent/cards/:id` | "what the agent holds" panel + leak scan |
| `member_dashboard` | member | `GET /api/vault` + token | balance delta = approved cart only |

Runner implementation: [`src/runner.ts`](./src/runner.ts). Client: [`src/client.ts`](./src/client.ts).

---

## 5. How to run (for agents automating verify)

```bash
# one-time
cd backend && npm install
cd ../demos && npm install

# after any backend change — must stay green
cd demos && npm test          # in-process, no server
cd demos && npm run verify    # typecheck + test

# narrated demo (starts needing a live API)
cd backend && npm start       # :8787
cd demos && npm run demo
cd demos && npm run demo -- mexico-vacation groceries-plus-tv --events
cd demos && npm run demo -- --group phish
cd demos && API=http://localhost:8787 npm run test:live
```

Exit code ≠ 0 if any expectation fails or any secret hits an agent-facing response.

**Suggested judge path** (also in `test-cases.md`):  
`mexico-vacation` → `groceries-plus-tv` → `injection-gift-cards` → `phish-for-account-numbers` or `total-agent-failure`.

---

## 6. Wiring into `web/` (frontend agents)

`web/` today talks a **different** REST shape (`/tasks/confirm`, `/cards`, categories like `grocery` / `marine`) and defaults to `mockApi`. The locked demos speak **backend** English.

### Preferred integration (adapter, do not fork scenarios twice)

1. Keep `demos/src/scenarios.ts` as the product scenario list.
2. In `web`, either:
   - **A.** Add an adapter that maps each demo `Step` → `VaultApi` calls / UI phases, **or**
   - **B.** Point `httpApi.ts` at the real backend paths in §3 and translate categories:

| demos / backend | web types today |
| --- | --- |
| `groceries` | `grocery` |
| `gift_cards` | `gift_card` |
| `luxury` (boat) | `marine` (approx) |
| `travel` | *(missing — add or map)* |
| `household`, `clothing`, … | *(align or extend)* |

3. Cart shape: backend wants `{ merchant, items[{ name, qty, unitPriceCents, category? }] }`. Web `CartItem` uses `priceCents` + per-line `merchant` — flatten when calling HTTP.
4. Member calls from the browser must send `x-member-token` (same value as `VAULT_MEMBER_TOKEN` / `demo-member-token`). Never expose that token to the agent console panel.
5. Reuse `data-testid`s already in `web/README.md` (`scenario-groceries`, `next-step`, `virtual-card`, `leak-scan`, …) so Playwright/agent UI tests can drive the same locked IDs (`groceries-week`, `mexico-vacation`, …).

### Minimal “front end shows our scenarios” checklist

- [ ] Every `SCENARIOS` id in `demos/src/scenarios.ts` is selectable or scripted in the UI (or a documented subset for stage).
- [ ] Phase order matches step kinds in §4.
- [ ] Agent console never renders vault `detail`, full account number, routing, or raw balance.
- [ ] `npm test` in `demos/` still passes against the backend the UI talks to.

---

## 7. Wiring into `backend/` (backend agents)

When you change Agent A/B, mint, or charge behavior:

1. Run `cd demos && npm test` before claiming done.
2. If a scenario expectation must change, edit **`demos/src/scenarios.ts`** and **`demos/test-cases.md`** together — do not silently change only backend tests.
3. Do not remove leak-scan coverage in `demos/test/scenarios.test.ts`.
4. New member / thin-history behavior is covered by `demos/test/new-member.test.ts` (in-process only; skipped under `API=`).
5. If you add categories or rename decline codes, update the `Category` / `DeclineCode` unions in `demos/src/scenarios.ts` and any carts that use them.

Backend's own `GET /api/demo/scenarios` is a **subset** (`groceries`, `injection`, `boat`, `gambling`). Our package is the expanded locked set — prefer pointing demos and stage scripts here.

---

## 8. Programmatic use from another agent / script

```ts
import { createApp } from '../backend/src/app'
import { VaultClient } from './src/client'
import { byId } from './src/scenarios'
import { runScenario } from './src/runner'

const app = createApp()
const client = new VaultClient('http://vault.local', async (url, init) => app.request(url, init))
// Member token is attached automatically on member-surface calls only.

const sc = byId('groceries-plus-tv')!
const result = await runScenario(sc, client)
if (result.failures.length || result.leaks.length) {
  throw new Error(result.failures.join('\n'))
}
```

Live server:

```ts
const client = new VaultClient(process.env.API ?? 'http://localhost:8787', fetch)
await client.reset()
const result = await runScenario(byId('mexico-vacation')!, client)
```

Inspect `result.steps` for actor-tagged narration suitable for a panel log. Inspect `client.agentExchanges()` for raw bodies if building a leak-scan UI.

---

## 9. Adding a new locked test case

1. Add a `Scenario` to `SCENARIOS` in `src/scenarios.ts` with `group`, `proves`, and ordered `steps`.
2. Add a row to the table in `test-cases.md`.
3. Run `npm test` and `npm run demo -- <new-id>`.
4. Tell frontend which step kinds need new chrome (if any).

Keep carts keyword-friendly for Agent B's catalog (`backend/src/catalog.ts`) or expect `Unrecognized item` rejections.

---

## 10. Ownership boundaries (agents: respect this)

| Path | Who edits |
| --- | --- |
| `demos/**` | demo/test lane |
| `backend/**` | backend lane |
| `web/**` | frontend lane |
| `docs/prd-agent-alias-vault.md` | shared product decisions |

If two lanes need the same scenario data, **import or copy from `demos/`** — do not invent a third list.

---

## 11. Quick health after sync

```bash
git fetch --all
# merge/rebase teammate branches as needed, then:
cd backend && npm install && npm run verify
cd ../demos && npm install && npm run verify
cd ../web && npm install && npm run build   # if frontend present
```

If `demos` tests fail only on member routes with `401 UNAUTHORIZED`, the client is missing `x-member-token` on the member surface — see `VaultClient` in `src/client.ts`.
