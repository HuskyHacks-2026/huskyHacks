import { describe, expect, it } from 'vitest'
import { agentA } from '../src/agentA'
import { agentB } from '../src/agentB'
import { classifyItem } from '../src/catalog'
import { DEFAULT_RULESET, demoMember } from '../src/data'
import type { CardRules } from '../src/types'

const req = (over = {}) => ({ task: 'buy groceries', budgetCents: 8000, allowedCategories: ['groceries' as const], ...over })

describe('Agent A (does this make sense for this member?)', () => {
  it('approves a normal grocery budget', () => {
    expect(agentA(demoMember(), req(), DEFAULT_RULESET).decision).toBe('approve')
  })
  it('sends a $100k boat to member override, not deny', () => {
    const r = agentA(demoMember(), req({ budgetCents: 10_000_000, allowedCategories: ['luxury'] }), DEFAULT_RULESET)
    expect(r.decision).toBe('needs_override')
  })
  it('denies restricted categories outright', () => {
    for (const c of ['gambling', 'crypto', 'gift_cards'] as const) {
      expect(agentA(demoMember(), req({ allowedCategories: [c] }), DEFAULT_RULESET).decision).toBe('deny')
    }
  })
  it('denies empty category list', () => {
    expect(agentA(demoMember(), req({ allowedCategories: [] }), DEFAULT_RULESET).decision).toBe('deny')
  })
  it('flags a category the member has never bought (history-based pattern)', () => {
    expect(agentA(demoMember(), req({ allowedCategories: ['travel'] }), DEFAULT_RULESET).decision).toBe('needs_override')
  })
  it('thin history falls back to the default ruleset cap; rich history raises it', () => {
    const thin = demoMember(); thin.history = thin.history.slice(0, 2)
    expect(agentA(thin, req({ budgetCents: 30_000 }), DEFAULT_RULESET).decision).toBe('needs_override') // > $200 default
    expect(agentA(demoMember(), req({ budgetCents: 30_000 }), DEFAULT_RULESET).decision).toBe('approve') // 3x max txn
  })
})

const rules: CardRules = { budgetCents: 8000, allowedCategories: ['groceries'], expiresAt: '2099-01-01T00:00:00Z' }
const item = (name: string, price = 500, qty = 1, category?: string) => ({ name, qty, unitPriceCents: price, category })

describe('Agent B (whole cart vs task + budget)', () => {
  it('approves an all-groceries cart under budget', () => {
    const r = agentB('buy groceries', rules, { merchant: 'QFC', items: [item('Whole milk'), item('Eggs dozen', 599, 2)] }, 1)
    expect(r.approved).toBe(true)
    expect(r.totalCents).toBe(500 + 1198)
  })
  it('rejects the WHOLE cart when one line is off-task and names the line', () => {
    const r = agentB('buy groceries', rules, { merchant: 'QFC', items: [item('Whole milk'), item('55-inch Smart TV', 39999)] }, 1)
    expect(r.approved).toBe(false)
    expect(r.rejections.map(x => x.name)).toContain('55-inch Smart TV')
    expect(r.message).toMatch(/55-inch Smart TV/)
  })
  it('does not trust the agent-supplied category label', () => {
    const r = agentB('buy groceries', rules, { merchant: 'QFC', items: [item('Movie tickets x4', 6000, 1, 'groceries')] }, 1)
    expect(r.approved).toBe(false)
  })
  it('fails closed on unrecognized items and ambiguous multi-category names', () => {
    expect(agentB('t', rules, { merchant: 'x', items: [item('Zorblax 9000')] }, 1).approved).toBe(false)
    expect(classifyItem('Apple iPhone phone case').sort()).toEqual(['electronics', 'groceries'])
    expect(agentB('t', rules, { merchant: 'x', items: [item('Apple iPhone')] }, 1).approved).toBe(false)
  })
  it('rejects over-budget, empty, and invalid qty/price carts', () => {
    expect(agentB('t', rules, { merchant: 'x', items: [item('Whole milk', 9000)] }, 1).approved).toBe(false)
    expect(agentB('t', rules, { merchant: 'x', items: [] }, 1).approved).toBe(false)
    expect(agentB('t', rules, { merchant: 'x', items: [item('Whole milk', 500, 0)] }, 1).approved).toBe(false)
    expect(agentB('t', rules, { merchant: 'x', items: [item('Whole milk', -5)] }, 1).approved).toBe(false)
    expect(agentB('t', rules, { merchant: 'x', items: [item('Whole milk', 1.5)] }, 1).approved).toBe(false)
  })
})
