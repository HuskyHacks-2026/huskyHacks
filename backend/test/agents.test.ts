import { describe, expect, it } from 'vitest'
import { agentA } from '../src/agentA'
import { agentB } from '../src/agentB'
import { classifyItem } from '../src/catalog'
import { DEFAULT_RULESET, demoMember } from '../src/data'
import type { Jev } from '../src/jev'
import type { CartItem, TaskRequest } from '../src/types'
import { SCENARIOS } from '../src/scenarios'

const req = (o: Partial<TaskRequest> = {}): TaskRequest => ({ agentName: 'Perp', task: 'Weekly groceries', budgetCents: 8000, categories: ['grocery'], ...o })
const A = (r: TaskRequest, jev?: Jev) => agentA('t1', demoMember(), r, DEFAULT_RULESET, jev)

describe('Agent A (does this make sense for this member?)', () => {
  it('approves a normal grocery budget and shows its checks', async () => {
    const v = await A(req())
    expect(v.status).toBe('approved')
    expect(v.checks.every(c => c.pass)).toBe(true)
  })
  it('sends the $100k boat to member override, not deny', async () => {
    const v = await A(req({ task: 'Purchase boat', budgetCents: 10_000_000, categories: ['marine'] }))
    expect(v.status).toBe('needs_override')
    expect(v.checks.filter(c => !c.pass).map(c => c.id)).toEqual(expect.arrayContaining(['categories', 'cap', 'norms']))
  })
  it('denies restricted categories outright', async () => {
    for (const c of ['gambling', 'crypto', 'gift_card'] as const) expect((await A(req({ categories: [c] }))).status).toBe('denied')
  })
  it('denies an empty category list', async () => {
    expect((await A(req({ categories: [] }))).status).toBe('denied')
  })
  it('flags a category the member has never bought', async () => {
    expect((await A(req({ categories: ['electronics'], budgetCents: 5000 }))).status).toBe('needs_override')
  })
  it('does not leak member history numbers in verdict text', async () => {
    const v = JSON.stringify(await A(req({ budgetCents: 10_000_000, categories: ['marine'] })))
    expect(v).not.toMatch(/114\.40|11440|largest/i)
  })
  it('Jev can only escalate: low plausibility flags an otherwise-clean request', async () => {
    const low: Jev = { classify: async () => [], makesSense: async () => 0.05 }
    const v = await A(req(), low)
    expect(v.status).toBe('needs_override')
    expect(v.checks.find(c => c.id === 'makes_sense')?.pass).toBe(false)
  })
  it('Jev saying "sensible" never rescues a rules failure, and null Jev changes nothing', async () => {
    const high: Jev = { classify: async () => [], makesSense: async () => 0.99 }
    expect((await A(req({ budgetCents: 10_000_000, categories: ['marine'] }), high)).status).toBe('needs_override')
    expect((await A(req({ categories: ['gift_card'] }), high)).status).toBe('denied')
    const nul: Jev = { classify: async () => [], makesSense: async () => null }
    expect((await A(req(), nul)).status).toBe('approved')
  })
})

const limits = { allowedCategories: ['grocery' as const], maxTotalCents: 8000 }
let n = 0
const item = (name: string, priceCents = 500, qty = 1, category: CartItem['category'] = 'grocery'): CartItem =>
  ({ id: `i${++n}`, name, merchant: 'QFC', category, priceCents, qty })
const B = (items: CartItem[], jev?: Jev) => agentB('Weekly groceries', limits, items, 1, 'vc_1', jev)

describe('Agent B (whole cart vs task + budget)', () => {
  it('approves the frontend scenarios\' clean grocery cart', async () => {
    const clean = SCENARIOS.find(s => s.id === 'groceries')!.carts.at(-1)!
    const v = await B(clean)
    expect(v.status).toBe('approved')
  })
  it('rejects the frontend\'s injected cart (TV + gift card), naming both lines', async () => {
    const bad = SCENARIOS.find(s => s.id === 'groceries')!.carts[0]!
    const v = await B(bad)
    expect(v.status).toBe('rejected')
    expect(v.lines.filter(l => !l.ok).map(l => l.itemId)).toEqual(['x1', 'x2'])
    expect(v.feedback).toMatch(/Remove: .*TV.*gift card/i)
  })
  it('does not trust the agent-supplied category label', async () => {
    expect((await B([item('Movie tickets x4', 6000, 1, 'grocery')])).status).toBe('rejected')
  })
  it('fails closed on unrecognized items and on multi-category ambiguity', async () => {
    expect((await B([item('Zorblax 9000')])).status).toBe('rejected')
    expect(classifyItem('Apple iPhone').sort()).toEqual(['electronics', 'grocery'])
    expect((await B([item('Apple iPhone')])).status).toBe('rejected')
  })
  it('rejects over-budget, empty, and invalid qty/price carts', async () => {
    expect((await B([item('Whole milk', 9000)])).status).toBe('rejected')
    expect((await B([])).status).toBe('rejected')
    expect((await B([item('Whole milk', 500, 0)])).status).toBe('rejected')
    expect((await B([item('Whole milk', -5)])).status).toBe('rejected')
    expect((await B([item('Whole milk', 1.5)])).status).toBe('rejected')
  })

  describe('with Jev', () => {
    const jevSays = (p: Record<string, number> | null): Jev => ({ classify: async (_t, it) => it.map(() => p), makesSense: async () => null })
    it('recognizes a confident allowed item keywords don\'t know', async () => {
      expect((await B([item('Zorblax 9000')], jevSays({ grocery: 0.9, other: 0.1 }))).status).toBe('approved')
    })
    it('rejects when Jev puts real mass on a disallowed category, even if keywords say grocery', async () => {
      expect((await B([item('Whole milk')], jevSays({ grocery: 0.6, gift_card: 0.4 }))).status).toBe('rejected')
    })
    it('"other" or unsure Jev does not rescue an unknown item', async () => {
      expect((await B([item('Zorblax 9000')], jevSays({ other: 0.9, grocery: 0.1 }))).status).toBe('rejected')
      expect((await B([item('Zorblax 9000')], jevSays({ grocery: 0.5, other: 0.5 }))).status).toBe('rejected')
    })
    it('falls back to keywords when Jev is unavailable', async () => {
      expect((await B([item('Whole milk')], jevSays(null))).status).toBe('approved')
      expect((await B([item('Samsung TV', 500, 1, 'electronics')], jevSays(null))).status).toBe('rejected')
    })
  })
})
