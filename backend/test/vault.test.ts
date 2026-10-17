import { describe, expect, it } from 'vitest'
import { demoMember } from '../src/data'
import { SCENARIOS } from '../src/scenarios'
import type { CartItem, TaskRequest } from '../src/types'
import { Vault, VaultError } from '../src/vault'

const groc = SCENARIOS.find(s => s.id === 'groceries')!
const boat = SCENARIOS.find(s => s.id === 'boat')!
const START = demoMember().accounts[0]!.balanceCents
const checking = (v: Vault) => v.getMember().accounts.find(a => a.id === 'chk')!.balanceCents
const bad = groc.carts[0]!
const clean = groc.carts[1]!

async function mintedGroceries(v = new Vault()) {
  const t = await v.confirmTask(groc.request)
  expect(t.status).toBe('approved')
  const card = v.mintCard(t.taskId)
  return { v, card, id: card.cardId }
}

describe('lifecycle (PRD 13.1)', () => {
  it('mints, holds funds, loops carts, buys once, closes, releases the remainder', async () => {
    const { v, id, card } = await mintedGroceries()
    expect(card.pan).toMatch(/^\d{4} \d{4} \d{4} \d{4}$/)
    expect(card.expiry).toMatch(/^\d\d\/\d\d$/)
    expect(card.rules.singleUse).toBe(true)
    expect(checking(v)).toBe(START - 8000)

    expect((await v.submitCart(id, bad)).status).toBe('rejected')
    expect(() => v.checkout(id)).toThrow(VaultError)
    const ok = await v.submitCart(id, clean)
    expect(ok.status).toBe('approved')
    expect(ok.attempt).toBe(2)

    const r = v.checkout(id)
    expect(r.cardStatus).toBe('CLOSED')
    expect(r.chargedCents).toBe(ok.totalCents)
    expect(checking(v)).toBe(START - ok.totalCents)
  })

  it('a rejected resubmit after an approval revokes the approval', async () => {
    const { v, id } = await mintedGroceries()
    await v.submitCart(id, clean)
    await v.submitCart(id, bad)
    expect(() => v.checkout(id)).toThrow(/not approved/i)
  })

  it('closed card hard-blocks spend, carts and checkout (the rogue-agent demo)', async () => {
    const { v, id } = await mintedGroceries()
    await v.submitCart(id, clean); v.checkout(id)
    expect(v.attemptCharge(id, 'giftcardz.biz', 'gift_card', 50000)).toMatchObject({ approved: false, code: 'CARD_CLOSED' })
    expect(() => v.checkout(id)).toThrow(VaultError)
    await expect(v.submitCart(id, clean)).rejects.toThrow(VaultError)
  })

  it('one card per task', async () => {
    const { v } = await mintedGroceries()
    expect(() => v.mintCard('task_1')).toThrow(/already/i)
  })

  it('cannot mint for an unapproved/denied/unknown task', async () => {
    const v = new Vault()
    const t = await v.confirmTask(boat.request)
    expect(t.status).toBe('needs_override')
    expect(() => v.mintCard(t.taskId)).toThrow(/not approved/i)
    expect(() => v.mintCard('task_999')).toThrow(VaultError)
  })
})

describe('hard block (D3) and no-spend-while-shopping (D10)', () => {
  it('declines off-task, over-limit, bad-amount and pre-approval charges on an open card', async () => {
    const { v, id } = await mintedGroceries()
    expect(v.attemptCharge(id, 'AMC', 'entertainment', 1500)).toMatchObject({ approved: false, code: 'OFF_TASK_BLOCKED' })
    expect(v.attemptCharge(id, 'QFC', 'grocery', 8001)).toMatchObject({ approved: false, code: 'OVER_LIMIT' })
    expect(v.attemptCharge(id, 'QFC', 'grocery', 0)).toMatchObject({ approved: false, code: 'BAD_AMOUNT' })
    expect(v.attemptCharge(id, 'QFC', 'grocery', 5000)).toMatchObject({ approved: false, code: 'CART_NOT_APPROVED' })
    await v.submitCart(id, clean)
    expect(v.attemptCharge(id, 'QFC', 'grocery', 100)).toMatchObject({ approved: false, code: 'CART_NOT_APPROVED' })
    expect(checking(v)).toBe(START - 8000) // nothing moved
  })

  it('card expires and releases its hold even if only /charge notices', async () => {
    let t = 1_000_000
    const v = new Vault({ clock: () => t })
    const { id } = await mintedGroceries(v)
    t += 31 * 60 * 1000
    expect(v.attemptCharge(id, 'QFC', 'grocery', 100)).toMatchObject({ approved: false, code: 'CARD_EXPIRED' })
    expect(checking(v)).toBe(START)
  })

  it('expiry noticed on cart submission also releases the hold', async () => {
    let t = 1_000_000
    const v = new Vault({ clock: () => t })
    const { id } = await mintedGroceries(v)
    t += 31 * 60 * 1000
    await expect(v.submitCart(id, clean)).rejects.toThrow(/expired/i)
    expect(checking(v)).toBe(START)
  })
})

describe('member override (D2, D8)', () => {
  it('approved override can mint if the account can fund it', async () => {
    const m = demoMember(); m.accounts[0]!.balanceCents = 20_000_000
    const v = new Vault({ member: m })
    const t = await v.confirmTask(boat.request)
    expect(v.overrideTask(t.taskId, true).status).toBe('approved')
    expect(v.mintCard(t.taskId).limitCents).toBe(10_000_000)
  })

  it('approved override still cannot mint what the account cannot fund', async () => {
    const v = new Vault()
    const t = await v.confirmTask(boat.request)
    v.overrideTask(t.taskId, true)
    expect(() => v.mintCard(t.taskId)).toThrow(/funds/i)
    expect(checking(v)).toBe(START)
  })

  it('declined override ends the request; cannot resolve twice; denied tasks are never overridable', async () => {
    const v = new Vault()
    const t = await v.confirmTask(boat.request)
    expect(v.overrideTask(t.taskId, false).status).toBe('denied')
    expect(() => v.overrideTask(t.taskId, true)).toThrow(VaultError)
    const g = await v.confirmTask({ agentName: 'x', task: 'casino', budgetCents: 5000, categories: ['gambling'] } as TaskRequest)
    expect(g.status).toBe('denied')
    expect(() => v.overrideTask(g.taskId, true)).toThrow(VaultError)
  })
})

describe('session snapshots (serverless persistence)', () => {
  it('a restored vault continues exactly where the last one stopped', async () => {
    const a = new Vault()
    const t = await a.confirmTask(groc.request)
    const id = a.mintCard(t.taskId).cardId
    await a.submitCart(id, clean)
    const b = new Vault({ snapshot: JSON.parse(JSON.stringify(a.snapshot())) })
    expect(b.checkout(id).cardStatus).toBe('CLOSED')
    expect(checking(b)).toBeLessThan(START)
  })
})

describe('invariants under random operation sequences', () => {
  it('never overspends, never spends outside checkout, money is conserved', async () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32
    const carts: CartItem[][] = [...groc.carts, [], [{ ...clean[0]!, priceCents: 999_999 }]]
    for (let run = 0; run < 40; run++) {
      const v = new Vault()
      const t = await v.confirmTask(groc.request)
      const id = v.mintCard(t.taskId).cardId
      let charged = 0
      for (let i = 0; i < 12; i++) {
        const r = rnd()
        try {
          if (r < 0.4) await v.submitCart(id, carts[Math.floor(rnd() * carts.length)]!)
          else if (r < 0.6) charged += v.checkout(id).chargedCents
          else v.attemptCharge(id, 'M', rnd() < 0.5 ? 'grocery' : 'gift_card', Math.floor(rnd() * 20000))
        } catch (e) { expect(e).toBeInstanceOf(VaultError) }
        expect(charged).toBeLessThanOrEqual(8000)
      }
      const closed = charged > 0
      expect(checking(v)).toBe(closed ? START - charged : START - 8000)
    }
  })
})
