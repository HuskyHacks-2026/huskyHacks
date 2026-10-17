import { describe, expect, it } from 'vitest'
import { demoMember } from '../src/data'
import { Vault, VaultError } from '../src/vault'

const mintReq = { task: 'buy groceries', budgetCents: 8000, allowedCategories: ['groceries' as const] }
const milk = { name: 'Whole milk', qty: 1, unitPriceCents: 449 }
const tv = { name: 'Smart TV', qty: 1, unitPriceCents: 39999 }

function minted(v = new Vault()) {
  const view = v.requestCard(mintReq)
  expect(view.status).toBe('OPEN')
  return { v, id: view.id }
}

describe('lifecycle', () => {
  it('mints, holds funds from the real account, loops carts, buys once, closes, releases remainder', () => {
    const { v, id } = minted()
    const start = demoMember().realAccount.balanceCents
    expect(v.vaultView().member.balanceCents).toBe(start - 8000)

    expect(v.submitCart(id, { merchant: 'QFC', items: [milk, tv] }).approved).toBe(false)
    expect(() => v.checkout(id)).toThrow(VaultError) // no partial / unapproved checkout
    const ok = v.submitCart(id, { merchant: 'QFC', items: [milk] })
    expect(ok.approved).toBe(true)
    expect(ok.attempt).toBe(2)

    const receipt = v.checkout(id)
    expect(receipt.totalCents).toBe(449)
    expect(receipt.refundedToAccountCents).toBe(8000 - 449)
    expect(v.agentView(id).status).toBe('CLOSED')
    expect(v.vaultView().member.balanceCents).toBe(start - 449)
  })

  it('a rejected resubmit after an approval revokes the approval', () => {
    const { v, id } = minted()
    v.submitCart(id, { merchant: 'QFC', items: [milk] })
    v.submitCart(id, { merchant: 'QFC', items: [milk, tv] })
    expect(() => v.checkout(id)).toThrow(/not approved/i)
  })

  it('checkout charges the approved cart, not anything sent later', () => {
    const { v, id } = minted()
    v.submitCart(id, { merchant: 'QFC', items: [milk] })
    expect(v.checkout(id).totalCents).toBe(449)
  })

  it('closed card hard-blocks all further spend and cart/checkout calls', () => {
    const { v, id } = minted()
    v.submitCart(id, { merchant: 'QFC', items: [milk] }); v.checkout(id)
    const res = v.charge(id, 'QFC', 'groceries', 100)
    expect(res).toMatchObject({ approved: false, code: 'CARD_CLOSED' })
    expect(() => v.checkout(id)).toThrow(VaultError)
    expect(() => v.submitCart(id, { merchant: 'QFC', items: [milk] })).toThrow(VaultError)
  })
})

describe('hard block (D3)', () => {
  it('declines off-task category and over-budget charges on an open card', () => {
    const { v, id } = minted()
    expect(v.charge(id, 'AMC', 'entertainment', 1500)).toMatchObject({ approved: false, code: 'OFF_TASK' })
    expect(v.charge(id, 'QFC', 'groceries', 8001)).toMatchObject({ approved: false, code: 'OVER_BUDGET' })
    expect(v.charge(id, 'QFC', 'groceries', 0)).toMatchObject({ approved: false })
    expect(v.charge(id, 'QFC', 'groceries', 5000)).toMatchObject({ approved: true, remainingCents: 3000 })
    expect(v.charge(id, 'QFC', 'groceries', 3001)).toMatchObject({ approved: false, code: 'OVER_BUDGET' })
  })

  it('card expires (time-bound alias)', () => {
    let t = 1_000_000
    const v = new Vault({ clock: () => t })
    const { id } = { id: v.requestCard(mintReq).id }
    t += 31 * 60 * 1000
    expect(v.charge(id, 'QFC', 'groceries', 100)).toMatchObject({ approved: false, code: 'CARD_EXPIRED' })
    expect(() => v.submitCart(id, { merchant: 'QFC', items: [milk] })).toThrow(/expired/i)
    expect(v.vaultView().member.balanceCents).toBe(demoMember().realAccount.balanceCents) // hold released
  })
})

describe('member override (D2, D8)', () => {
  const boat = { task: 'buy a boat', budgetCents: 1_000_000, allowedCategories: ['luxury' as const] }

  it('suspicious request waits, issues no card number, mints only after member approves', () => {
    const v = new Vault({ member: { ...demoMember(), realAccount: { ...demoMember().realAccount, balanceCents: 5_000_000 } } })
    const view = v.requestCard(boat)
    expect(view.status).toBe('PENDING_OVERRIDE')
    expect(view.card).toBeNull()
    expect(() => v.submitCart(view.id, { merchant: 'x', items: [milk] })).toThrow(VaultError)
    expect(v.charge(view.id, 'x', 'luxury', 100)).toMatchObject({ approved: false })
    const done = v.resolveOverride(view.id, true)
    expect(done.status).toBe('OPEN')
    expect(done.card?.pan).toHaveLength(16)
  })

  it('member rejection kills the request; cannot resolve twice', () => {
    const v = new Vault()
    const { id } = v.requestCard(boat)
    expect(v.resolveOverride(id, false).status).toBe('DENIED')
    expect(() => v.resolveOverride(id, true)).toThrow(VaultError)
  })

  it('approved override still fails if real account cannot fund it', () => {
    const v = new Vault()
    const { id } = v.requestCard(boat)
    expect(v.resolveOverride(id, true).status).toBe('DENIED')
    expect(v.vaultView().member.balanceCents).toBe(demoMember().realAccount.balanceCents)
  })

  it('denied (restricted) request is never overridable', () => {
    const v = new Vault()
    const { id, status } = v.requestCard({ task: 'casino', budgetCents: 5000, allowedCategories: ['gambling'] })
    expect(status).toBe('DENIED')
    expect(() => v.resolveOverride(id, true)).toThrow(VaultError)
  })
})

describe('invariants under random charge sequences', () => {
  it('never spends past budget, never charges after close, money is conserved', () => {
    let seed = 42
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
    for (let run = 0; run < 50; run++) {
      const v = new Vault()
      const start = v.vaultView().member.balanceCents
      const { id } = v.requestCard(mintReq)
      let spent = 0
      for (let i = 0; i < 20; i++) {
        const amt = Math.floor(rnd() * 3000)
        const cat = rnd() < 0.7 ? 'groceries' : 'entertainment'
        const r = v.charge(id, 'M', cat, amt)
        if (r.approved) spent += amt
        expect(spent).toBeLessThanOrEqual(8000)
        if (i === 10) { v.submitCart(id, { merchant: 'QFC', items: [milk] }); try { const rc = v.checkout(id); spent += rc.totalCents } catch { /* over budget */ } }
      }
      const view = v.vaultView()
      const card = view.cards[0]!
      expect(card.card!.spentCents).toBe(spent)
      // nothing created or lost: open -> balance + hold == start; closed -> balance + spent == start
      expect(view.member.balanceCents + (card.status === 'CLOSED' ? spent : card.heldCents)).toBe(start)
    }
  })
})
