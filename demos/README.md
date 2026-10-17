# Agent Alias Vault — demos & test cases

Demo / test lane for HuskyHack 2026. Contains the **locked scenarios** (groceries, Mexico vacation, off-task carts, prompt injection, stolen card, suspicious boat, casino) and runs them end-to-end against the real backend. It does **not** modify `backend/` or the frontend; it consumes their HTTP API.

- [`test-cases.md`](./test-cases.md) — the locked scenarios, expected outcomes, what the screen must show, judge click path.
- [`src/scenarios.ts`](./src/scenarios.ts) — the same scenarios as executable step lists.
- [`src/runner.ts`](./src/runner.ts) — runs a scenario, records a check per expectation, scans every agent-facing response for real-account data.
- [`src/run.ts`](./src/run.ts) — narrated terminal demo.
- [`test/`](./test) — vitest suites (scenarios + new-member default ruleset).

## Run

```bash
cd demos && npm install

# tests, in-process (imports backend/src/app; backend deps must be installed: cd backend && npm install)
npm test

# narrated demo against a live server
cd ../backend && npm start            # http://localhost:8787
cd ../demos && npm run demo           # all 13 scenarios
npm run demo -- mexico-vacation groceries-plus-tv
npm run demo -- --group phish         # happy | bad | phish | audit
npm run demo -- --events              # also print the member-side audit feed

# same tests against the live server
npm run test:live                     # or API=http://host:port npm test
```

Exit code is non-zero if any expectation fails or any secret reaches the agent surface.

## How it fits the split

| Lane | Owns |
| --- | --- |
| Backend (teammates) | mint / Agent A / Agent B / checkout / hard block — `backend/` |
| Frontend (teammates) | the visual walkthrough — see the "what the screen must show" table in `test-cases.md` |
| This folder | scenario fixtures, expected outcomes, leak scan, narrated rehearsal, regression tests |

If the backend changes behavior, `npm test` here says exactly which step of which scenario broke and what came back instead.
