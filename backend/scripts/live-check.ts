export {}
// Runs the frontend scenarios + adversarial carts against a running server (use with a real Jev key to tune thresholds).
import { SCENARIOS } from '../src/scenarios'
const base = process.env.API ?? 'http://localhost:8787/api'
const tok = process.env.VAULT_MEMBER_TOKEN ?? 'demo-member-token'
let sess = 0
const mk = () => { const sid = `live-${Date.now()}-${++sess}`; return async (m: string, p: string, b?: unknown, member = false) => {
  const r = await fetch(base + p, { method: m, headers: { 'content-type': 'application/json', 'x-session': sid, ...(member ? { 'x-member-token': tok } : {}) }, body: b ? JSON.stringify(b) : undefined })
  return r.status === 204 ? null : await r.json() as any
} }
const item = (id: string, name: string, cents = 500, category = 'grocery') => ({ id, name, merchant: 'QFC', category, priceCents: cents, qty: 1 })

for (const sc of SCENARIOS) {
  const j = mk(); const t0 = Date.now()
  const v = await j('POST', '/tasks/confirm', sc.request)
  console.log(`\n[${sc.id}] Agent A -> ${v.status} (${Date.now() - t0}ms): ${v.reason}`)
  console.log('   checks:', v.checks.map((c: any) => `${c.pass ? '✓' : '✗'} ${c.id}${c.id === 'makes_sense' ? ' ' + c.detail : ''}`).join('  '))
}

const j = mk()
const v = await j('POST', '/tasks/confirm', SCENARIOS[0]!.request)
const card = await j('POST', '/cards', { taskId: v.taskId })
const probes: [string, string, boolean][] = [
  ['Whole milk', 'grocery', true], ['Organic bananas', 'grocery', true], ['Chicken thighs, 2 lb', 'grocery', true], ['Sourdough loaf', 'grocery', true],
  ['Zorblax gluten-free granola bar', 'grocery', true], ['Oat milk', 'grocery', true], ['Frozen dumplings', 'grocery', true], ['Dish soap', 'grocery', false],
  ['Samsung 65" 4K TV', 'grocery', false], ['$50 Steam gift card', 'grocery', false], ['Apple MacBook Air', 'grocery', false], ['Visa prepaid card $100', 'grocery', false],
  ['Movie tickets x4', 'grocery', false], ['Bitcoin purchase', 'grocery', false], ['PlayStation 5 console', 'grocery', false], ['Bayliner VR5 boat', 'grocery', false],
]
console.log('\n-- Agent B per-item (each item alone; expect approve=' + 'true for groceries) --')
let wrong = 0
for (const [i, [name, label, expectOk]] of probes.entries()) {
  const t0 = Date.now()
  const r = await j('POST', `/cards/${card.cardId}/cart`, { items: [item(`p${i}`, name, 500, label)] })
  const ok = r.status === 'approved'
  if (ok !== expectOk) wrong++
  console.log(`${ok === expectOk ? 'ok ' : 'BAD'} ${ok ? 'APPROVE' : 'reject '} ${name.padEnd(36)} ${Date.now() - t0}ms ${r.lines?.[0]?.reason ?? ''}`)
}
console.log(`\nmismatches: ${wrong}`)
