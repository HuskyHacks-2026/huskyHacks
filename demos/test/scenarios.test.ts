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
      memberId: m.memberId,
      firstName: m.firstName,
      checkingNumber: m.accounts[0]!.number,
      savingsNumber: m.accounts[1]!.number,
      routingNumber: m.accounts[0]!.routing,
      checkingOpeningBalanceCents: m.accounts[0]!.balanceCents,
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

describe('runner cannot silently pass', () => {
  it('fails the scenario when the member balance is unreadable (broken /member)', async () => {
    const c = await freshClient()
    const broken = Object.create(c) as typeof c
    broken.getMember = async () => ({ surface: 'member', method: 'GET', path: '/member', reqHeaders: {}, status: 401, text: '', json: null })
    const sc = SCENARIOS.find(s => s.id === 'groceries-week')!
    const r = await runScenario(sc, broken)
    expect(r.failures.some(f => /balance readable/.test(f))).toBe(true)
  })

  it('leak scan only covers the scenario being run, not earlier traffic on a reused client', async () => {
    const c = await freshClient()
    await c.getMember() // member surface, ignored
    c.exchanges.push({ surface: 'agent', method: 'GET', path: '/old', reqHeaders: {}, status: 200, text: '7700384821', json: null })
    const sc = SCENARIOS.find(s => s.id === 'casino-denied')!
    const r = await runScenario(sc, c)
    expect(r.leaks).toEqual([])
  })
})
