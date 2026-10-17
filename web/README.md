# Escrow: Phase 1 demo front end

```bash
npm install
npm run dev        # http://localhost:5173
```

## Demo path
1. Tap **Escrow**, then **Weekly groceries**. Agent A approves and a virtual card is minted.
2. Press **Agent submits cart**. Agent B rejects the TV and gift card (prompt injection).
3. Press **Agent fixes & resubmits**. The whole cart is approved.
4. Press **Buy & close card**. The card is charged and shows CLOSED.
5. Press **Simulate compromised agent**. The charge is declined.
6. Press **Restart**, then **Buy a boat**. Agent A flags it, and the member chooses Approve or Decline.

## Plugging in the backend
Everything goes through the `VaultApi` interface in `src/api/types.ts`.
- `src/api/mockApi.ts`: in-browser fake backend (the default).
- `src/api/httpApi.ts`: REST client. The endpoint map is in the file header.
- Switch with env vars (see `.env.example`): `VITE_API_MODE=http VITE_API_BASE_URL=http://localhost:8000/api npm run dev`

## Testing hooks
- Wrap the app in `<ApiProvider api={createMockApi()}>` (latency defaults to 0) or pass any fake `VaultApi`.
- `createMockApi()` is plain TS with no React, so you can unit test it directly.
- Key elements have `data-testid`: `open-agent-pay`, `scenario-groceries`, `scenario-boat`, `next-step`,
  `override-approve`, `override-deny`, `virtual-card` (with `data-status`), `card-status`, `cart-status`,
  `cart-line-<id>`, `receipt`, `rogue-result`, `leak-scan`, `log-entry`, and `agent-pay-screen` (with `data-phase`).
- Demo data lives in `src/demo/scenarios.ts` and `src/api/mockData.ts`.
