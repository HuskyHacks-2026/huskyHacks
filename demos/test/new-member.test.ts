/**
 * D5: a brand-new member with no history gets the DEFAULT ruleset (cap $200, everyday categories).
 * The HTTP API serves one fixed demo member, so this runs in-process only (skipped under API=...).
 */
import { describe, expect, it } from 'vitest'
import { createApp } from '../../backend/src/app'
import { demoMember } from '../../backend/src/data'
import type { Member } from '../../backend/src/types'
import { Vault } from '../../backend/src/vault'
import { freshClient, LIVE } from './helpers'

const newMember = (): Member => ({
  ...demoMember(),
  id: 'm_new',
  name: 'Jordan Lee',
  realAccount: { accountNumber: '1122334455', routingNumber: '325081403', balanceCents: 150000 },
  history: [],
})

const client = () => freshClient(() => createApp(() => new Vault({ member: newMember() })))

describe.skipIf(LIVE)('new member, no history (default ruleset)', () => {
  it('everyday groceries under the default cap mint automatically', async () => {
    const c = await client()
    const r = await c.agentRequestCard({ task: 'buy groceries', budgetCents: 8000, allowedCategories: ['groceries'] })
    expect(r.status).toBe(201)
    expect(r.json.status).toBe('OPEN')
  })

  it('groceries over the $200 default cap need member approval', async () => {
    const c = await client()
    const r = await c.agentRequestCard({ task: 'stock the pantry', budgetCents: 25000, allowedCategories: ['groceries'] })
    expect(r.status).toBe(202)
    expect(r.json.status).toBe('PENDING_OVERRIDE')
    expect(r.json.card).toBeNull()
  })

  it('a $3000 vacation is both over cap and a category outside the default ruleset -> member approval', async () => {
    const c = await client()
    const r = await c.agentRequestCard({ task: 'plan a vacation in Mexico', budgetCents: 300000, allowedCategories: ['travel'] })
    expect(r.status).toBe(202)
    const v = await c.memberVault()
    const detail: string[] = v.json.cards[0].detail
    expect(detail.join(' ')).toMatch(/exceeds/i)
    expect(detail.join(' ')).toMatch(/new spending pattern/i)
    expect(r.text).not.toMatch(/exceeds|new spending pattern|default ruleset/i) // detail never reaches the agent
  })

  it('restricted categories are denied regardless of history', async () => {
    const c = await client()
    const r = await c.agentRequestCard({ task: 'buy gift cards', budgetCents: 5000, allowedCategories: ['gift_cards'] })
    expect(r.status).toBe(403)
  })

  it('agent surface never shows the new member either', async () => {
    const c = await client()
    const r = await c.agentRequestCard({ task: 'buy groceries', budgetCents: 8000, allowedCategories: ['groceries'] })
    await c.agentGetCard(r.json.id)
    const all = c.agentExchanges().map(e => e.text).join('\n')
    for (const s of ['Jordan', 'Lee', '1122334455', '325081403', '150000', 'm_new']) expect(all).not.toContain(s)
  })
})
