export {}
// Runs the PRD 13.1 demo against a live server: `npm start` in one shell, `npm run demo` in another.
const base = process.env.API ?? 'http://localhost:8787'
const j = async (method: string, path: string, body?: unknown) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', 'x-member-token': process.env.VAULT_MEMBER_TOKEN ?? 'demo-member-token' }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json() as any }
}
const step = (s: string) => console.log(`\n== ${s}`)

await j('POST', '/api/demo/reset')
const sc = (await j('GET', '/api/demo/scenarios')).body.find((s: any) => s.id === 'groceries')

step(`1-3. Agent requests virtual card: "${sc.task}" ${sc.budgetCents / 100} USD`)
const mint = await j('POST', '/api/agent/cards', { task: sc.task, budgetCents: sc.budgetCents, allowedCategories: sc.allowedCategories })
console.log(mint.status, JSON.stringify(mint.body.card))
if (mint.status !== 201) throw new Error(`mint failed: ${mint.status} ${JSON.stringify(mint.body)}`)
const id = mint.body.id

step('4-5. Bad cart (TV) -> Agent B rejects -> agent fixes')
for (const cart of sc.carts) {
  const r = await j('POST', `/api/agent/cards/${id}/cart`, cart)
  console.log(`attempt ${r.body.attempt}: approved=${r.body.approved} - ${r.body.message}`)
}

step('6. Checkout + close')
console.log((await j('POST', `/api/agent/cards/${id}/checkout`)).body)
console.log('status:', (await j('GET', `/api/agent/cards/${id}`)).body.status)

step('7. Try to spend again -> hard block')
console.log(await j('POST', `/api/agent/cards/${id}/charge`, { merchant: 'QFC', category: 'groceries', amountCents: 100 }))

step('Event log')
for (const e of (await j('GET', '/api/events')).body) console.log(`#${e.seq} [${e.actor}] ${e.type}: ${e.summary}`)
