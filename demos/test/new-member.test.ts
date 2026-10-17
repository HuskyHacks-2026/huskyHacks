/**
 * Thin/no history -> Agent A treats every category as novel and the $500 default cap applies.
 * Seeded via session store snapshot (HTTP API serves one fixed demo member otherwise).
 */
import { describe, expect, it } from 'vitest'
import { demoMember } from '../../backend/src/data'
import type { Member } from '../../backend/src/types'
import { Vault } from '../../backend/src/vault'
import { freshClient, LIVE } from './helpers'

const newMember = (): Member => ({
  ...demoMember(),
  firstName: 'Casey',
  memberId: 'SCU-NEW-001',
  accounts: [
    { id: 'chk', name: 'Everyday Checking', number: '1122334455', routing: '325081403', balanceCents: 150000 },
    { id: 'sav', name: 'Savings', number: '1122330099', routing: '325081403', balanceCents: 0 },
  ],
  history: [],
})

describe.skipIf(LIVE)('new member, no history (default ruleset)', () => {
  async function client() {
    const snap = new Vault({ member: newMember() }).snapshot()
    return freshClient({ snapshot: snap })
  }

  it('everyday groceries under the default cap still need override (categories are all novel)', async () => {
    const c = await client()
    const r = await c.confirmTask({ agentName: 'Demo', task: 'buy groceries', budgetCents: 8000, categories: ['grocery'] })
    expect(r.json.status).toBe('needs_override')
  })

  it('groceries over the $500 default cap need member approval', async () => {
    const c = await client()
    const r = await c.confirmTask({ agentName: 'Demo', task: 'stock the pantry', budgetCents: 60000, categories: ['grocery'] })
    expect(r.json.status).toBe('needs_override')
  })

  it('restricted categories are denied regardless of history', async () => {
    const c = await client()
    const r = await c.confirmTask({ agentName: 'Demo', task: 'buy gift cards', budgetCents: 5000, categories: ['gift_card'] })
    expect(r.json.status).toBe('denied')
  })

  it('agent surface never shows the new member either', async () => {
    const c = await client()
    const r = await c.confirmTask({ agentName: 'Demo', task: 'buy groceries', budgetCents: 8000, categories: ['grocery'] })
    await c.overrideTask(r.json.taskId, true)
    await c.mintCard(r.json.taskId)
    const all = c.agentExchanges().map(e => e.text).join('\n')
    for (const s of ['Casey', '1122334455', '325081403', '150000', 'SCU-NEW-001']) expect(all).not.toContain(s)
  })
})
