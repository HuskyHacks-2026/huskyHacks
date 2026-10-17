import { randomInt } from 'node:crypto'
import { agentA, type MintRequest } from './agentA'
import { agentB } from './agentB'
import { DEFAULT_RULESET, demoMember } from './data'
import type {
  Actor, CardRules, CardStatus, Cart, CartReview, DefaultRuleset, Member, Receipt, VaultEvent, Category,
} from './types'
import { dollars } from './types'

export class VaultError extends Error {
  constructor(public code: string, message: string, public http = 409) {
    super(message)
  }
}

interface Card {
  id: string
  task: string
  status: CardStatus
  rules: CardRules
  pan?: string
  cvv?: string
  expMonth?: number
  expYear?: number
  heldCents: number
  spentCents: number
  override?: { reasons: string[] }
  deniedReasons?: string[]
  lastReview?: CartReview
  approvedCart?: Cart
  attempts: number
}

export interface VaultOptions {
  member?: Member
  rules?: DefaultRuleset
  clock?: () => number
}

export type ChargeResult =
  | { approved: true; remainingCents: number }
  | { approved: false; code: string; reason: string }

function luhnPan(): string {
  const digits = [4, 0, 0, 0, 0, 0] // test-range prefix; never a real BIN
  while (digits.length < 15) digits.push(randomInt(0, 10))
  let sum = 0
  digits.forEach((d, i) => {
    let v = d
    if ((digits.length - i) % 2 === 1) { v *= 2; if (v > 9) v -= 9 }
    sum += v
  })
  digits.push((10 - (sum % 10)) % 10)
  return digits.join('')
}

export class Vault {
  private member: Member
  private rules: DefaultRuleset
  private now: () => number
  private cards = new Map<string, Card>()
  private events: VaultEvent[] = []
  private nextCard = 1

  constructor(opts: VaultOptions = {}) {
    this.member = opts.member ?? demoMember()
    this.rules = opts.rules ?? DEFAULT_RULESET
    this.now = opts.clock ?? Date.now
  }

  // ---------- agent-facing (never exposes member data) ----------

  requestCard(req: MintRequest, actor: Actor = 'shopping_agent') {
    const id = `card_${this.nextCard++}`
    this.log(actor, 'card_requested', `Requested virtual card for "${req.task}" - ${dollars(req.budgetCents)}`, id)
    const verdict = agentA(this.member, req, this.rules)
    this.log('agent_a', `task_${verdict.decision}`, verdict.reasons.join(' '), id, { decision: verdict.decision })

    const rules: CardRules = {
      budgetCents: req.budgetCents,
      allowedCategories: [...req.allowedCategories],
      expiresAt: new Date(this.now() + this.rules.cardTtlMs).toISOString(),
    }
    const card: Card = { id, task: req.task, status: 'OPEN', rules, heldCents: 0, spentCents: 0, attempts: 0 }
    this.cards.set(id, card)

    if (verdict.decision === 'deny') {
      card.status = 'DENIED'
      card.deniedReasons = verdict.reasons
    } else if (verdict.decision === 'needs_override') {
      card.status = 'PENDING_OVERRIDE'
      card.override = { reasons: verdict.reasons }
      this.log('vault', 'override_requested', 'Waiting for member approval before minting.', id)
    } else {
      this.mint(card)
    }
    return this.agentView(id)
  }

  agentView(id: string) {
    const c = this.card(id)
    const issued = c.status === 'OPEN' || c.status === 'CLOSED'
    return {
      id: c.id,
      status: c.status,
      task: c.task,
      rules: c.rules,
      reasons: this.agentReasons(c),
      card: issued
        ? {
            pan: c.pan, cvv: c.cvv, expMonth: c.expMonth, expYear: c.expYear,
            remainingCents: c.status === 'OPEN' ? c.rules.budgetCents - c.spentCents : 0,
            spentCents: c.spentCents,
          }
        : null,
      cart: c.lastReview ? { approved: c.lastReview.approved, attempt: c.lastReview.attempt } : null,
    }
  }

  submitCart(id: string, cart: Cart): CartReview {
    const c = this.card(id)
    this.assertOpen(c)
    c.attempts += 1
    this.log('shopping_agent', 'cart_submitted', `Cart #${c.attempts}: ${cart.items.map(i => `${i.qty}x ${i.name}`).join(', ')}`, id)
    const review = agentB(c.task, c.rules, cart, c.attempts)
    c.lastReview = review
    c.approvedCart = review.approved ? cart : undefined
    this.log('agent_b', review.approved ? 'cart_approved' : 'cart_rejected', review.message, id, {
      rejections: review.rejections,
    })
    return review
  }

  checkout(id: string): Receipt {
    const c = this.card(id)
    this.assertOpen(c)
    if (!c.approvedCart || !c.lastReview?.approved) {
      throw new VaultError('CART_NOT_APPROVED', 'Agent B has not approved the whole cart; no purchase made.')
    }
    const cart = c.approvedCart
    const total = c.lastReview.totalCents
    const res = this.authorize(c, cart.merchant, total, null, true)
    if (!res.approved) throw new VaultError(res.code, res.reason)
    this.log('vault', 'checkout', `Bought ${dollars(total)} at ${cart.merchant}.`, id)
    const refunded = this.close(c, 'Purchase complete')
    return { cardId: id, merchant: cart.merchant, totalCents: total, items: cart.items, refundedToAccountCents: refunded }
  }

  /** Raw network authorization; used by the off-task / "try to spend again" demo (D3 hard block). */
  charge(id: string, merchant: string, category: Category, amountCents: number): ChargeResult {
    const c = this.card(id)
    const res = this.authorize(c, merchant, amountCents, category)
    this.log('network', res.approved ? 'charge_approved' : 'charge_declined',
      res.approved ? `${dollars(amountCents)} at ${merchant} approved` : `${dollars(amountCents)} at ${merchant} DECLINED: ${res.reason}`,
      id, res.approved ? undefined : { code: res.code })
    return res
  }

  // ---------- member/vault-facing ----------

  resolveOverride(id: string, approve: boolean) {
    const c = this.card(id)
    if (c.status !== 'PENDING_OVERRIDE') throw new VaultError('NOT_PENDING', `Card is ${c.status}, not awaiting override.`)
    this.log('member', approve ? 'override_approved' : 'override_rejected', `Member ${approve ? 'approved' : 'rejected'} the request.`, id)
    if (!approve) {
      c.status = 'DENIED'
      c.deniedReasons = ['Member rejected the request.']
    } else if (c.rules.budgetCents > this.member.realAccount.balanceCents) {
      c.status = 'DENIED'
      c.deniedReasons = ['Insufficient funds in member account.']
      this.log('vault', 'mint_failed', 'Insufficient funds; card not minted.', id)
    } else {
      this.mint(c)
    }
    return this.agentView(id)
  }

  vaultView() {
    const a = this.member.realAccount
    return {
      member: { name: this.member.name, accountLast4: a.accountNumber.slice(-4), balanceCents: a.balanceCents },
      historyCount: this.member.history.length,
      cards: [...this.cards.values()].map(c => ({
        ...this.agentView(c.id), detail: c.deniedReasons ?? c.override?.reasons ?? [],
        heldCents: c.heldCents, pendingOverride: c.status === 'PENDING_OVERRIDE',
      })),
    }
  }

  eventsSince(seq = 0) {
    return this.events.filter(e => e.seq > seq)
  }

  // ---------- internals ----------

  private mint(c: Card) {
    const acct = this.member.realAccount
    if (c.rules.budgetCents > acct.balanceCents) {
      c.status = 'DENIED'
      c.deniedReasons = ['Insufficient funds in member account.']
      this.log('vault', 'mint_failed', 'Insufficient funds; card not minted.', c.id)
      return
    }
    c.rules.expiresAt = new Date(this.now() + this.rules.cardTtlMs).toISOString()
    acct.balanceCents -= c.rules.budgetCents
    c.heldCents = c.rules.budgetCents
    c.pan = luhnPan()
    c.cvv = String(randomInt(100, 1000))
    const exp = new Date(this.now() + 365 * 24 * 3600 * 1000)
    c.expMonth = exp.getUTCMonth() + 1
    c.expYear = exp.getUTCFullYear()
    c.status = 'OPEN'
    this.log('vault', 'card_minted', `Minted virtual card ••${c.pan.slice(-4)} with ${dollars(c.rules.budgetCents)} fake money. Real account never shared.`, c.id)
  }

  private authorize(c: Card, merchant: string, amountCents: number, category: Category | null, viaCheckout = false): ChargeResult {
    const decline = (code: string, reason: string): ChargeResult => ({ approved: false, code, reason })
    if (c.status !== 'OPEN') return decline('CARD_CLOSED', `Card is ${c.status}.`)
    if (this.now() > Date.parse(c.rules.expiresAt)) { this.close(c, 'Expired'); return decline('CARD_EXPIRED', 'Card expired.') }
    if (!Number.isInteger(amountCents) || amountCents < 1) return decline('BAD_AMOUNT', 'Invalid amount.')
    if (category && !c.rules.allowedCategories.includes(category)) {
      return decline('OFF_TASK', `Category "${category}" is not allowed on this card.`)
    }
    if (c.spentCents + amountCents > c.rules.budgetCents) return decline('OVER_BUDGET', 'Exceeds card balance.')
    // D10: no spend while shopping; only the approved cart (via checkout) may move money.
    if (!viaCheckout) return decline('CART_NOT_APPROVED', 'No spend until Agent B approves the whole cart.')
    c.spentCents += amountCents
    return { approved: true, remainingCents: c.rules.budgetCents - c.spentCents }
  }

  private close(c: Card, why: string): number {
    const refund = c.heldCents - c.spentCents
    this.member.realAccount.balanceCents += refund
    c.heldCents = 0
    c.status = 'CLOSED'
    this.log('vault', 'card_closed', `${why}; card closed, ${dollars(refund)} released.`, c.id)
    return refund
  }

  private assertOpen(c: Card) {
    if (c.status !== 'OPEN') throw new VaultError('CARD_NOT_OPEN', `Card is ${c.status}.`)
    if (this.now() > Date.parse(c.rules.expiresAt)) {
      this.close(c, 'Expired')
      throw new VaultError('CARD_EXPIRED', 'Card expired.')
    }
  }

  /** Agent-visible reasons are generic: never member history, caps or balance. */
  private agentReasons(c: Card): string[] {
    if (c.status === 'PENDING_OVERRIDE') return ['Requires member approval.']
    if (c.status !== 'DENIED') return []
    if (c.deniedReasons?.some(r => /^(Restricted|No spend)/.test(r))) return c.deniedReasons.filter(r => /^(Restricted|No spend)/.test(r))
    return ['Request was not approved.']
  }

  private card(id: string): Card {
    const c = this.cards.get(id)
    if (!c) throw new VaultError('NOT_FOUND', `No card ${id}.`, 404)
    return c
  }

  private log(actor: Actor, type: string, summary: string, cardId?: string, data?: Record<string, unknown>) {
    this.events.push({ seq: this.events.length + 1, ts: new Date(this.now()).toISOString(), actor, type, summary, cardId, data })
  }
}
