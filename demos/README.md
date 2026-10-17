# Agent Alias Vault — demos & test cases

Independent demo / test package for HuskyHack 2026. Locked scenarios (groceries, Mexico vacation, off-task carts, prompt injection, stolen card, suspicious boat, casino) run end-to-end against the real backend. Does **not** modify `backend/` or `web/`; consumes their HTTP API.

**Agents working on backend or frontend:** start with [`AGENT_WIRING.md`](./AGENT_WIRING.md) — contracts, step kinds, how to wire UI/bots, ownership boundaries.

| Doc | Purpose |
| --- | --- |
| [`AGENT_WIRING.md`](./AGENT_WIRING.md) | How other agents use and wire these cases into backend/web |
| [`test-cases.md`](./test-cases.md) | Locked scenarios, expected outcomes, screen checklist, judge path |
| [`src/scenarios.ts`](./src/scenarios.ts) | Same scenarios as executable step lists |
| [`src/runner.ts`](./src/runner.ts) | Runner + leak scan |
| [`src/run.ts`](./src/run.ts) | Narrated terminal demo |
| [`test/`](./test) | Vitest suites |

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
