import { randomInt } from 'node:crypto'
import { agentA } from './agentA'
import { agentB } from './agentB'
import { DEFAULT_RULESET, SESSION_FUNDING_ACCOUNT, demoMember } from './data'
import { noJev, type Jev } from './jev'
import type {
  CartItem, CartVerdict, Category, ChargeResult, DefaultRuleset, Member, MemberSummary, Receipt, TaskRequest,
  TaskVerdict, VirtualCard,
} from './types'
import { dollars } from './types'

export class VaultError extends Error {
  constructor(public code: string, message: string, public http = 409) {
    super(message)
  }
}

export type Actor = 'member' | 'shopping_agent' | 'agent_a' | 'agent_b' | 'vault' | 'network'
export interface VaultEvent { seq: number; ts: string; actor: Actor; type: string; summary: string; ref?: string }

interface Task { id: string; req: TaskRequest; verdict: TaskVerdict; cardId?: string }
interface Card {
  id: string
  taskId: string
  status: 'OPEN' | 'CLOSED'
  pan: string
  cvv: string
  expiry: string
  allowedCategories: Category[]
  maxTotalCents: number
  expiresAt: string
  heldCents: number
  spentCents: number
  attempts: number
  last?: { verdict: CartVerdict; items: CartItem[] }
}

/** Plain JSON so a session can be parked in Redis between serverless invocations. */
export interface Snapshot { member: Member; tasks: Task[]; cards: Card[]; events: VaultEvent[]; seq: number }

export interface VaultOptions {
  rules?: DefaultRuleset
  clock?: () => number
  jev?: Jev
  /** Restore a previous session instead of starting fresh. */
  snapshot?: Snapshot
  member?: Member
}

const pad = (n: number) => String(n).padStart(2, '0')

function luhnPan(): string {
  const d = [4, 0, 0, 0, 0, 0] // test-range prefix; never a real BIN
  while (d.length < 15) d.push(randomInt(0, 10))
  let sum = 0
  d.forEach((x, i) => {
    let v = x
    if ((d.length - i) % 2 === 1) { v *= 2; if (v > 9) v -= 9 }
    sum += v
  })
  d.push((10 - (sum % 10)) % 10)
  return d.join('').replace(/(\d{4})(?=\d)/g, '$1 ')
}

export class Vault {
  private s: Snapshot
  private rules: DefaultRuleset
  private now: () => number
  private jev: Jev

  constructor(opts: VaultOptions = {}) {
    this.rules = opts.rules ?? DEFAULT_RULESET
    this.now = opts.clock ?? Date.now
    this.jev = opts.jev ?? noJev
    this.s = opts.snapshot ?? { member: opts.member ?? demoMember(), tasks: [], cards: [], events: [], seq: 0 }
  }

  snapshot(): Snapshot { return structuredClone(this.s) }

  // ---------- member-side ----------

  /** Masks only; real account/routing numbers never leave the Vault. */
  getMember(): MemberSummary {
    const m = this.s.member
    return {
      firstName: m.firstName,
      accounts: m.accounts.map(a => ({ id: a.id, name: a.name, mask: a.number.slice(-4), balanceCents: a.balanceCents })),
      recentTransactions: m.history.map(h => ({ ...h })) as MemberSummary['recentTransactions'],
    }
  }

  overrideTask(taskId: string, approve: boolean): TaskVerdict {
    const t = this.task(taskId)
    if (t.verdict.status !== 'needs_override') {
      throw new VaultError('NOT_PENDING', `Task is ${t.verdict.status}, not awaiting member override.`)
    }
    this.log('member', approve ? 'override_approved' : 'override_rejected', `Member ${approve ? 'approved' : 'declined'} the request.`, taskId)
    t.verdict = {
      ...t.verdict,
      status: approve ? 'approved' : 'denied',
      reason: approve ? 'Approved by member override.' : 'Declined by member. No card issued.',
    }
    return structuredClone(t.verdict)
  }

  eventsSince(seq = 0) { return this.s.events.filter(e => e.seq > seq) }

  // ---------- agent-side ----------

  async confirmTask(req: TaskRequest): Promise<TaskVerdict> {
    const id = `task_${++this.s.seq}`
    this.log('shopping_agent', 'task_submitted', `${req.agentName}: "${req.task}" ${dollars(req.budgetCents)}`, id)
    const verdict = await agentA(id, this.s.member, req, this.rules, this.jev)
    this.s.tasks.push({ id, req, verdict })
    this.log('agent_a', `task_${verdict.status}`, verdict.reason, id)
    return structuredClone(verdict)
  }

  mintCard(taskId: string): VirtualCard {
    const t = this.task(taskId)
    if (t.verdict.status !== 'approved') throw new VaultError('TASK_NOT_APPROVED', 'Task not approved; no card issued.')
    if (t.cardId) throw new VaultError('ALREADY_MINTED', 'A card was already issued for this task.')
    const acct = this.s.member.accounts.find(a => a.id === SESSION_FUNDING_ACCOUNT)!
    if (t.req.budgetCents > acct.balanceCents) throw new VaultError('INSUFFICIENT_FUNDS', 'Not enough funds to back this card.')

    acct.balanceCents -= t.req.budgetCents
    const exp = new Date(this.now() + 365 * 24 * 3600 * 1000)
    const card: Card = {
      id: `vc_${++this.s.seq}`,
      taskId,
      status: 'OPEN',
      pan: luhnPan(),
      cvv: String(randomInt(100, 1000)),
      expiry: `${pad(exp.getUTCMonth() + 1)}/${pad(exp.getUTCFullYear() % 100)}`,
      allowedCategories: [...t.req.categories],
      maxTotalCents: t.req.budgetCents,
      expiresAt: new Date(this.now() + this.rules.cardTtlMs).toISOString(),
      heldCents: t.req.budgetCents,
      spentCents: 0,
      attempts: 0,
    }
    t.cardId = card.id
    this.s.cards.push(card)
    this.log('vault', 'card_minted', `Minted virtual card ••${card.pan.slice(-4)} with ${dollars(card.maxTotalCents)} fake money. Real account never shared.`, card.id)
    return this.view(card)
  }

  async submitCart(cardId: string, items: CartItem[]): Promise<CartVerdict> {
    const c = this.card(cardId)
    this.assertOpen(c)
    c.attempts += 1
    const attempt = c.attempts
    this.log('shopping_agent', 'cart_submitted', `Cart #${attempt}: ${items.map(i => `${i.qty}x ${i.name}`).join(', ')}`, cardId)
    const task = this.task(c.taskId)
    const verdict = await agentB(task.req.task, { allowedCategories: c.allowedCategories, maxTotalCents: c.maxTotalCents }, items, attempt, cardId, this.jev)
    // the card may have changed while Agent B was thinking; re-check before recording
    this.assertOpen(c)
    c.last = { verdict, items }
    this.log('agent_b', verdict.status === 'approved' ? 'cart_approved' : 'cart_rejected', verdict.feedback, cardId)
    return structuredClone(verdict)
  }

  checkout(cardId: string): Receipt {
    const c = this.card(cardId)
    this.assertOpen(c)
    if (!c.last || c.last.verdict.status !== 'approved') {
      throw new VaultError('CART_NOT_APPROVED', 'Agent B has not approved the whole cart; no purchase made.')
    }
    const { items, verdict } = c.last
    const res = this.authorize(c, verdict.totalCents, null, true)
    if (!res.approved) throw new VaultError(res.code, res.message)
    this.log('vault', 'checkout', `Bought ${dollars(verdict.totalCents)} at ${items[0]?.merchant ?? 'merchant'}.`, cardId)
    this.close(c, 'Purchase complete')
    return { cardId, chargedCents: verdict.totalCents, items: structuredClone(items), cardStatus: 'CLOSED', closedAt: new Date(this.now()).toISOString() }
  }

  /** Network authorization simulator (D3 hard block; D10: no spend while shopping). */
  attemptCharge(cardId: string, merchant: string, category: Category, amountCents: number): ChargeResult {
    const c = this.card(cardId)
    const res = this.authorize(c, amountCents, category, false, merchant)
    this.log('network', res.approved ? 'charge_approved' : 'charge_declined',
      `${dollars(amountCents)} at ${merchant} ${res.approved ? 'approved' : `DECLINED: ${res.message}`}`, cardId)
    return res
  }

  // ---------- internals ----------

  private authorize(c: Card, amountCents: number, category: Category | null, viaCheckout: boolean, merchant = 'merchant'): ChargeResult {
    const no = (code: ChargeResult['code'], message: string): ChargeResult => ({ approved: false, code, message })
    if (c.status !== 'OPEN') return no('CARD_CLOSED', `Declined at ${merchant}: card is closed.`)
    if (this.now() > Date.parse(c.expiresAt)) { this.close(c, 'Expired'); return no('CARD_EXPIRED', `Declined at ${merchant}: card expired.`) }
    if (!Number.isInteger(amountCents) || amountCents < 1) return no('BAD_AMOUNT', `Declined at ${merchant}: invalid amount.`)
    if (category && !c.allowedCategories.includes(category)) return no('OFF_TASK_BLOCKED', `Blocked at ${merchant}: off-task spend.`)
    if (c.spentCents + amountCents > c.maxTotalCents) return no('OVER_LIMIT', `Declined at ${merchant}: over limit.`)
    if (!viaCheckout) return no('CART_NOT_APPROVED', `Declined at ${merchant}: no spend until Agent B approves the whole cart.`)
    c.spentCents += amountCents
    return { approved: true, code: 'APPROVED', message: 'Approved.' }
  }

  private close(c: Card, why: string) {
    const refund = c.heldCents - c.spentCents
    this.s.member.accounts.find(a => a.id === SESSION_FUNDING_ACCOUNT)!.balanceCents += refund
    c.heldCents = 0
    c.status = 'CLOSED'
    this.log('vault', 'card_closed', `${why}; card closed, ${dollars(refund)} released.`, c.id)
  }

  private assertOpen(c: Card) {
    if (c.status !== 'OPEN') throw new VaultError('CARD_NOT_OPEN', 'Card is closed.')
    if (this.now() > Date.parse(c.expiresAt)) {
      this.close(c, 'Expired')
      throw new VaultError('CARD_EXPIRED', 'Card expired.')
    }
  }

  private view(c: Card): VirtualCard {
    return {
      cardId: c.id, taskId: c.taskId, pan: c.pan, expiry: c.expiry, cvv: c.cvv, status: c.status,
      limitCents: c.maxTotalCents,
      balanceCents: c.status === 'OPEN' ? c.maxTotalCents - c.spentCents : 0,
      rules: { allowedCategories: [...c.allowedCategories], maxTotalCents: c.maxTotalCents, singleUse: true, expiresAt: c.expiresAt },
    }
  }

  private task(id: string): Task {
    const t = this.s.tasks.find(x => x.id === id)
    if (!t) throw new VaultError('NOT_FOUND', `No task ${id}.`, 404)
    return t
  }

  private card(id: string): Card {
    const c = this.s.cards.find(x => x.id === id)
    if (!c) throw new VaultError('NOT_FOUND', `No card ${id}.`, 404)
    return c
  }

  private log(actor: Actor, type: string, summary: string, ref?: string) {
    this.s.events.push({ seq: this.s.events.length + 1, ts: new Date(this.now()).toISOString(), actor, type, summary, ref })
  }
}
