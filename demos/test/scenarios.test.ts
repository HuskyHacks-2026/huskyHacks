import { describe, expect, it } from 'vitest'
import { demoMember } from '../../backend/src/data'
import { MEMBER_HEADER } from '../src/client'
import { runScenario } from '../src/runner'
import { CART_TOTALS, SCENARIOS } from '../src/scenarios'
import { DEMO_MEMBER_SECRETS } from '../src/secrets'
import { freshClient } from './helpers'

describe('locked demo scenarios', () => {
  for (const sc of SCENARIOS) {
    it(`${sc.id} - ${sc.title}`, async () => {
      const client = await freshClient()
      const result = await runScenario(sc, client)
      expect(result.failures).toEqual([])
      expect(result.leaks).toEqual([])
      expect(result.agentResponses).toBeGreaterThan(0)
    })
  }

  it('covers every success criterion and every group', () => {
    const proves = new Set(SCENARIOS.flatMap(s => s.proves))
    expect([...proves].sort()).toEqual(['S1', 'S2', 'S3'])
    expect(new Set(SCENARIOS.map(s => s.group))).toEqual(new Set(['happy', 'bad', 'phish', 'audit']))
    expect(new Set(SCENARIOS.map(s => s.id)).size).toBe(SCENARIOS.length)
  })

  it('cart fixtures stay inside their task budgets', () => {
    expect(CART_TOTALS.GROCERIES_WEEK).toBeLessThanOrEqual(8000)
    expect(CART_TOTALS.MEXICO_TRIP).toBeLessThanOrEqual(300000)
    expect(CART_TOTALS.VEGGIE_DINNER).toBeLessThanOrEqual(6000)
    expect(CART_TOTALS.HOUSEHOLD_REORDER).toBeLessThanOrEqual(10000)
  })
})

describe('leak-scan secrets mirror the backend demo member', () => {
  it('secrets.ts matches backend/src/data.ts', () => {
    const m = demoMember()
    expect(DEMO_MEMBER_SECRETS).toEqual({
      memberId: m.id,
      name: m.name,
      accountNumber: m.realAccount.accountNumber,
      routingNumber: m.realAccount.routingNumber,
      openingBalanceCents: m.realAccount.balanceCents,
    })
  })
})

describe('member token stays off the agent surface', () => {
  it('agent calls never send x-member-token; member calls always do', async () => {
    const client = await freshClient()
    const result = await runScenario(SCENARIOS.find(s => s.id === 'mexico-vacation')!, client)
    expect(result.failures).toEqual([])
    for (const ex of client.exchanges) {
      const sent = MEMBER_HEADER in ex.reqHeaders
      if (ex.surface === 'agent') expect(sent).toBe(false)
      else expect(sent).toBe(true)
    }
  })
})
