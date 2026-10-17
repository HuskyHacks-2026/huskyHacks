import type { Exchange, VaultClient } from './client'
import type { Leak } from './secrets'
import type { CartItem, Scenario, Step } from './scenarios'

export type Actor = 'member' | 'shopping agent' | 'agent a' | 'agent b' | 'vault' | 'network' | 'attacker' | 'narrator'

export interface Check { ok: boolean; what: string; got?: string }

export interface StepResult {
  index: number
  actor: Actor
  title: string
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

const cartTotal = (items: CartItem[]) => items.reduce((s, i) => s + i.qty * i.priceCents, 0)
const describeCart = (items: CartItem[]) => items.map(i => `${i.qty}x ${i.name} @ ${usd(i.priceCents)}`).join(', ')

function shapeOf(json: unknown): string {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return typeof json
  return Object.entries(json as Record<string, unknown>).map(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? `${k}{${Object.keys(v as object).join(', ')}}` : k).join(', ')
}

export async function runScenario(sc: Scenario, client: VaultClient, onStep?: (s: StepResult) => void): Promise<ScenarioResult> {
  const steps: StepResult[] = []
  const tasks = new Map<string, string>()
  const cards = new Map<string, string>()
  const cardViews = new Map<string, Record<string, unknown>>()
  let lastPlan: Extract<Step, { kind: 'agent_plans' }> | undefined
  const startExchanges = client.exchanges.length

  const opening = await client.getMember()
  const openingBalance: number | undefined = opening.json?.accounts?.[0]?.balanceCents

  const taskId = (alias = 'task') => tasks.get(alias) ?? `(no task "${alias}")`
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
          `categories: ${step.categories.join(', ')}`,
        ])
        break

      case 'confirm_task': {
        if (!lastPlan) { emit(n, 'vault', 'confirm_task without a plan', [], [{ ok: false, what: 'agent_plans before confirm_task' }]); break }
        const ex = await client.confirmTask({
          agentName: lastPlan.agentName ?? 'Demo Shopping Agent',
          task: lastPlan.task,
          budgetCents: lastPlan.budgetCents,
          categories: lastPlan.categories,
        })
        const j = ex.json ?? {}
        if (typeof j.taskId === 'string') tasks.set(step.as ?? 'task', j.taskId)
        const lines = [
          `POST /tasks/confirm -> ${ex.status} ${j.status ?? ''}`,
          j.reason ? `reason: ${j.reason}` : '',
          Array.isArray(j.checks) ? `checks: ${j.checks.map((c: { id: string; pass: boolean }) => `${c.id}:${c.pass ? 'pass' : 'FAIL'}`).join(', ')}` : '',
        ].filter(Boolean)
        const checks = [eq('status', j.status, step.expect)]
        if (step.reasonMatching) {
          checks.push({ ok: step.reasonMatching.test(String(j.reason ?? '')), what: `reason matches ${step.reasonMatching}`, got: String(j.reason) })
        }
        emit(n, 'agent a', 'audits the request for THIS member', lines, checks, ex)
        break
      }

      case 'member_override': {
        const ex = await client.overrideTask(taskId(step.task), step.approve)
        const j = ex.json ?? {}
        emit(n, 'member', step.approve ? 'approves on the vault dashboard' : 'rejects on the vault dashboard',
          [`POST /tasks/:id/override {approve: ${step.approve}} -> ${ex.status} ${j.status ?? j.error ?? ''}`, j.reason ? String(j.reason) : ''],
          [eq('status', j.status, step.expect)], ex)
        break
      }

      case 'mint_card': {
        const ex = await client.mintCard(taskId(step.task))
        const j = ex.json ?? {}
        if (ex.status === 200 && j.cardId) {
          cards.set(step.as ?? 'card', j.cardId)
          cardViews.set(step.as ?? 'card', j)
          const lines = [
            `POST /cards {taskId} -> OPEN virtual card ••${String(j.pan).slice(-4)}  exp ${j.expiry}`,
            `limit ${usd(j.limitCents)} fake money · categories ${j.rules?.allowedCategories?.join(', ')}`,
            `rules: single-use, expires ${j.rules?.expiresAt}`,
          ]
          emit(n, 'vault', 'mints virtual card (real account never shared)', lines, [eq('status', j.status, step.expect)], ex)
        } else {
          emit(n, 'vault', 'mint refused', [`${ex.status} ${j.error}: ${j.message}`], [eq('mint error', j.error, step.expect)], ex)
        }
        break
      }

      case 'submit_cart': {
        const ex = await client.submitCart(cardId(step.card), step.items)
        const j = ex.json ?? {}
        emit(n, 'shopping agent', `submits cart: ${step.label} (${usd(cartTotal(step.items))})`, [describeCart(step.items)])
        const lines = [`attempt #${j.attempt ?? '?'} -> ${String(j.status ?? '').toUpperCase()}`, j.feedback ? String(j.feedback) : '']
        const checks = [eq('cart status', j.status, step.expect)]
        const blob = JSON.stringify(j)
        for (const re of step.rejectsMatching ?? []) {
          checks.push({ ok: re.test(blob), what: `rejection mentions ${re}`, got: re.test(blob) ? undefined : blob.slice(0, 200) })
        }
        emit(n, 'agent b', 'confirms the WHOLE cart against task + budget', lines.filter(Boolean), checks, ex)
        break
      }

      case 'checkout': {
        const ex = await client.checkout(cardId(step.card))
        const j = ex.json ?? {}
        if (ex.status === 200) {
          emit(n, 'vault', 'checkout: buy once, then close the card', [
            `bought ${usd(j.chargedCents)} with fake money`,
            `card ${j.cardStatus} at ${j.closedAt}`,
          ], [eq('checkout', 'ok', step.expect), eq('cardStatus', j.cardStatus, 'CLOSED')], ex)
          const view = cardViews.get(step.card ?? 'card')
          if (view) cardViews.set(step.card ?? 'card', { ...view, status: 'CLOSED', balanceCents: 0 })
        } else {
          emit(n, 'vault', 'checkout refused', [`${ex.status} ${j.error}: ${j.message}`], [eq('checkout error', j.error, step.expect)], ex)
        }
        break
      }

      case 'charge': {
        const ex = await client.charge(cardId(step.card), { merchant: step.merchant, category: step.category, amountCents: step.amountCents })
        const j = ex.json ?? {}
        const actor: Actor = /attacker/i.test(step.label) ? 'attacker' : 'shopping agent'
        emit(n, actor, `${step.label}: ${usd(step.amountCents)} at ${step.merchant} (${step.category})`)
        emit(n, 'network', j.approved ? 'APPROVED' : `DECLINED ${j.code}`, [j.message ?? ''], [eq('auth result', j.code, step.expect)], ex)
        break
      }

      case 'agent_inspects': {
        const view = cardViews.get(step.card ?? 'card')
        const leaks = client.agentLeaks(startExchanges)
        const lines = [
          view ? `card fields the agent holds: ${shapeOf(view)}` : 'no card in agent memory yet',
          view ? `••${String(view.pan).slice(-4)}  status ${view.status}  remaining ${usd(Number(view.balanceCents ?? 0))}` : '',
          leaks.length ? `LEAK: ${leaks.map(l => `${l.kind} ${l.match}`).join(', ')}` : 'no account number, routing, member id, or raw balance - anywhere on the agent surface',
        ].filter(Boolean)
        emit(n, /attacker/i.test(step.label) ? 'attacker' : 'shopping agent', step.label, lines,
          [{ ok: leaks.length === 0, what: 'agent surface contains no real-account data', got: leaks.length ? JSON.stringify(leaks) : undefined }])
        break
      }

      case 'member_dashboard': {
        const ex = await client.getMember()
        const j = ex.json ?? {}
        const bal: number | undefined = j.accounts?.[0]?.balanceCents
        const lines = [
          `member ${j.firstName} · checking ••${j.accounts?.[0]?.mask} · balance ${bal === undefined ? '?' : usd(bal)}` +
            (openingBalance !== undefined && bal !== undefined ? ` (${bal - openingBalance >= 0 ? '+' : ''}${usd(bal - openingBalance)} since start)` : ''),
        ]
        const checks: Check[] = []
        if (step.expectBalanceDeltaCents !== undefined) {
          // never skip silently: a broken /member response must fail the scenario, not pass it
          checks.push(openingBalance !== undefined && bal !== undefined
            ? eq('checking balance delta', bal - openingBalance, step.expectBalanceDeltaCents)
            : { ok: false, what: 'member balance readable before and after', got: `opening=${openingBalance} now=${bal} (status ${ex.status})` })
        }
        emit(n, 'member', `dashboard: ${step.label}`, lines, checks, ex)
        break
      }
    }
  }

  const leaks = client.agentLeaks(startExchanges)
  const agentResponses = client.exchanges.slice(startExchanges).filter(e => e.surface === 'agent').length
  const failures = steps.flatMap(s => s.checks.filter(c => !c.ok).map(c => `step ${s.index} [${s.actor}] ${s.title}: expected ${c.what}${c.got ? `, got ${c.got}` : ''}`))
  if (leaks.length) failures.push(`agent surface leaked: ${leaks.map(l => `${l.method} ${l.path} ${l.kind}:${l.match}`).join('; ')}`)
  return { scenario: sc, steps, leaks, agentResponses, failures }
}
