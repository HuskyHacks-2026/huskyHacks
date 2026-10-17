import type { Exchange, VaultClient } from './client'
import type { Leak } from './secrets'
import type { Cart, Scenario, Step } from './scenarios'

export type Actor = 'member' | 'shopping agent' | 'agent a' | 'agent b' | 'vault' | 'network' | 'attacker' | 'narrator'

export interface Check { ok: boolean; what: string; got?: string }

export interface StepResult {
  index: number
  actor: Actor
  title: string
  /** Human-readable detail lines for the narrated demo. */
  lines: string[]
  checks: Check[]
  exchange?: Exchange
}

export interface ScenarioResult {
  scenario: Scenario
  steps: StepResult[]
  leaks: Leak[]
  agentResponses: number
  failures: string[]
}

export const usd = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })

const cartTotal = (cart: Cart) => cart.items.reduce((s, i) => s + i.qty * i.unitPriceCents, 0)
const describeCart = (cart: Cart) => cart.items.map(i => `${i.qty}x ${i.name} @ ${usd(i.unitPriceCents)}`).join(', ')

/** Keys of a JSON object, one level deep for nested objects, e.g. `card{pan, cvv}`. */
function shapeOf(json: unknown): string {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return typeof json
  return Object.entries(json as Record<string, unknown>).map(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? `${k}{${Object.keys(v as object).join(', ')}}` : k).join(', ')
}

/**
 * Runs one scenario against a client. Never throws on an unexpected outcome: each step records checks so the
 * demo keeps going and the summary (and the tests) can report exactly which expectation broke.
 */
export async function runScenario(sc: Scenario, client: VaultClient, onStep?: (s: StepResult) => void): Promise<ScenarioResult> {
  const steps: StepResult[] = []
  const cards = new Map<string, string>()
  let lastPlan: Extract<Step, { kind: 'agent_plans' }> | undefined
  const startExchanges = client.exchanges.length

  const opening = await client.memberVault()
  const openingBalance: number | undefined = opening.json?.member?.balanceCents

  const cardId = (alias = 'card') => cards.get(alias) ?? `(no card "${alias}")`

  const emit = (index: number, actor: Actor, title: string, lines: string[] = [], checks: Check[] = [], exchange?: Exchange) => {
    const r: StepResult = { index, actor, title, lines, checks, exchange }
    steps.push(r)
    onStep?.(r)
    return r
  }
  const eq = (what: string, got: unknown, want: unknown): Check =>
    ({ ok: got === want, what: `${what} = ${String(want)}`, got: got === want ? undefined : String(got) })

  for (const [i, step] of sc.steps.entries()) {
    const n = i + 1
    switch (step.kind) {
      case 'member_says':
        emit(n, 'member', `"${step.text}"`)
        break

      case 'narrate':
        emit(n, 'narrator', step.text)
        break

      case 'agent_plans':
        lastPlan = step
        emit(n, 'shopping agent', `derives task + budget${step.note ? ` (${step.note})` : ''}`, [
          `task: "${step.task}"`,
          `budget: ${usd(step.budgetCents)}`,
          `categories: ${step.allowedCategories.join(', ')}`,
        ])
        break

      case 'request_card': {
        if (!lastPlan) { emit(n, 'vault', 'request_card without a plan', [], [{ ok: false, what: 'agent_plans step before request_card' }]); break }
        const ex = await client.agentRequestCard({ task: lastPlan.task, budgetCents: lastPlan.budgetCents, allowedCategories: lastPlan.allowedCategories })
        const j = ex.json ?? {}
        if (typeof j.id === 'string') cards.set(step.as ?? 'card', j.id)
        const lines = [`POST /api/agent/cards -> ${ex.status} ${j.status ?? ''}`]
        if (j.card) {
          lines.push(`virtual card ••${String(j.card.pan).slice(-4)}  exp ${j.card.expMonth}/${j.card.expYear}  ${usd(j.card.remainingCents)} fake money`)
          lines.push(`rules: ${usd(j.rules.budgetCents)} · ${j.rules.allowedCategories.join(', ')} · expires ${j.rules.expiresAt}`)
        } else {
          lines.push(`card: null  reasons: ${JSON.stringify(j.reasons)}`)
        }
        const checks = [eq('http', ex.status, step.expectHttp), eq('status', j.status, step.expectStatus)]
        if (step.expectReason) {
          const reasons: string[] = Array.isArray(j.reasons) ? j.reasons : []
          checks.push({ ok: reasons.some(r => step.expectReason!.test(r)), what: `agent-visible reason matches ${step.expectReason}`, got: JSON.stringify(reasons) })
        }
        emit(n, 'agent a', `audits the request for THIS member`, lines, checks, ex)
        break
      }

      case 'member_override': {
        const ex = await client.memberOverride(cardId(step.card), step.approve)
        const j = ex.json ?? {}
        const lines = [`POST /api/vault/cards/:id/override {approve: ${step.approve}} -> ${ex.status} ${j.status ?? j.error ?? ''}`]
        if (j.card) lines.push(`virtual card ••${String(j.card.pan).slice(-4)} minted with ${usd(j.card.remainingCents)}`)
        emit(n, 'member', step.approve ? 'approves on the vault dashboard' : 'rejects on the vault dashboard', lines,
          [eq('status', j.status, step.expectStatus)], ex)
        break
      }

      case 'submit_cart': {
        const ex = await client.agentSubmitCart(cardId(step.card), step.cart)
        const j = ex.json ?? {}
        emit(n, 'shopping agent', `submits cart: ${step.label} (${usd(cartTotal(step.cart))} at ${step.cart.merchant})`, [describeCart(step.cart)])
        const lines = [`attempt #${j.attempt ?? '?'} -> ${j.approved ? 'APPROVED' : 'REJECTED'}`]
        if (j.message) lines.push(String(j.message))
        const checks = [eq('approved', j.approved, step.expect === 'approved')]
        for (const re of step.rejectsMatching ?? []) {
          const hit = (j.rejections ?? []).some((r: { name: string; reason: string }) => re.test(r.name) || re.test(r.reason))
          checks.push({ ok: hit, what: `rejection mentions ${re}`, got: hit ? undefined : JSON.stringify(j.rejections) })
        }
        emit(n, 'agent b', `confirms the WHOLE cart against task + budget`, lines, checks, ex)
        break
      }

      case 'checkout': {
        const ex = await client.agentCheckout(cardId(step.card))
        const j = ex.json ?? {}
        if (ex.status === 200) {
          const lines = [
            `bought ${usd(j.totalCents)} at ${j.merchant} with fake money`,
            `card CLOSED immediately; ${usd(j.refundedToAccountCents)} unspent released to the member`,
          ]
          emit(n, 'vault', 'checkout: buy once, then close the card', lines, [eq('checkout', 'ok', step.expect)], ex)
        } else {
          emit(n, 'vault', 'checkout refused', [`${ex.status} ${j.error}: ${j.message}`], [eq('checkout error', j.error, step.expect)], ex)
        }
        break
      }

      case 'charge': {
        const ex = await client.agentCharge(cardId(step.card), { merchant: step.merchant, category: step.category, amountCents: step.amountCents })
        const j = ex.json ?? {}
        const actor: Actor = /attacker/i.test(step.label) ? 'attacker' : 'shopping agent'
        emit(n, actor, `${step.label}: ${usd(step.amountCents)} at ${step.merchant} (${step.category})`)
        const got = j.approved ? 'approved' : j.code
        emit(n, 'network', j.approved ? 'APPROVED' : `DECLINED ${j.code}`, [j.reason ?? `remaining ${usd(j.remainingCents ?? 0)}`],
          [eq('auth result', got, step.expect)], ex)
        break
      }

      case 'agent_inspects': {
        const ex = await client.agentGetCard(cardId(step.card))
        const j = ex.json ?? {}
        const lines = [`GET /api/agent/cards/:id -> ${ex.status} ${j.status ?? ''}`, `fields visible to the agent: ${shapeOf(j)}`]
        if (j.card) lines.push(`card: ••${String(j.card.pan).slice(-4)}  remaining ${usd(j.card.remainingCents)}  spent ${usd(j.card.spentCents)}`)
        const leaks = client.agentLeaks()
        lines.push(leaks.length ? `LEAK: ${leaks.map(l => `${l.kind} ${l.match}`).join(', ')}` : 'no account number, routing number, balance, or member name - anywhere, ever')
        emit(n, /attacker/i.test(step.label) ? 'attacker' : 'shopping agent', step.label, lines,
          [{ ok: leaks.length === 0, what: 'agent surface contains no real-account data', got: leaks.length ? JSON.stringify(leaks) : undefined }], ex)
        break
      }

      case 'member_dashboard': {
        const ex = await client.memberVault()
        const j = ex.json ?? {}
        const bal: number | undefined = j.member?.balanceCents
        const lines = [
          `member ${j.member?.name} · account ••${j.member?.accountLast4} · balance ${bal === undefined ? '?' : usd(bal)}` +
            (openingBalance !== undefined && bal !== undefined ? ` (${bal - openingBalance >= 0 ? '+' : '-'}${usd(Math.abs(bal - openingBalance))} since start)` : ''),
          ...(Array.isArray(j.cards) ? j.cards.map((c: { id: string; status: string; task: string; detail?: string[] }) =>
            `${c.id} ${c.status} "${c.task}"${c.detail?.length ? ` - ${c.detail.join(' ')}` : ''}`) : []),
        ]
        const checks: Check[] = []
        if (step.expectBalanceDeltaCents !== undefined && openingBalance !== undefined && bal !== undefined) {
          checks.push(eq('real balance delta', bal - openingBalance, step.expectBalanceDeltaCents))
        }
        emit(n, 'member', `dashboard: ${step.label}`, lines, checks, ex)
        break
      }
    }
  }

  const leaks = client.agentLeaks()
  const agentResponses = client.exchanges.slice(startExchanges).filter(e => e.surface === 'agent').length
  const failures = steps.flatMap(s => s.checks.filter(c => !c.ok).map(c => `step ${s.index} [${s.actor}] ${s.title}: expected ${c.what}${c.got ? `, got ${c.got}` : ''}`))
  if (leaks.length) failures.push(`agent surface leaked: ${leaks.map(l => `${l.method} ${l.path} ${l.kind}:${l.match}`).join('; ')}`)
  return { scenario: sc, steps, leaks, agentResponses, failures }
}
