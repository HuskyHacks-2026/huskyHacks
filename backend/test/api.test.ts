import { describe, expect, it } from 'vitest'
import { createHttpApi } from '../../web/src/api/httpApi'
import type { VaultApi } from '../../web/src/api/types'
import { createApp } from '../src/app'
import { demoMember } from '../src/data'
import { MemoryStore } from '../src/store'
import { SCENARIOS } from '../src/scenarios'

const groc = SCENARIOS.find(s => s.id === 'groceries')!
const boat = SCENARIOS.find(s => s.id === 'boat')!

/** The REAL frontend HttpApi client, wired straight into the app: proves the two halves agree. */
function wire(opts: { store?: MemoryStore; session?: string; token?: string } = {}) {
  const app = createApp({ store: opts.store ?? new MemoryStore() })
  const bodies: string[] = []
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    const res = await app.request(url.replace('http://x', ''), init)
    // only what the shopping agent could see: member-side routes legitimately show balances
    if (!/\/(member|override|reset|events)$/.test(url)) bodies.push(await res.clone().text())
    return res
  }) as unknown as typeof fetch
  const api: VaultApi = createHttpApi('http://x/api', {
    sessionId: opts.session ?? 's1', memberToken: opts.token ?? 'demo-member-token', fetchImpl,
  })
  return { app, api, bodies }
}

const m = demoMember()
const SECRETS = [m.accounts[0]!.number, m.accounts[0]!.routing, m.accounts[1]!.number, m.memberId, '4212.56', '421256']

describe('frontend client <-> backend, end to end', () => {
  it('runs the whole demo script through the real client', async () => {
    const { api, bodies } = wire()
    await api.reset()
    const t = await api.confirmTask(groc.request)
    expect(t.status).toBe('approved')
    const card = await api.mintCard(t.taskId)
    expect(card.status).toBe('OPEN')

    const first = await api.submitCart(card.cardId, groc.carts[0]!)
    expect(first.status).toBe('rejected')
    expect(first.lines.filter(l => !l.ok).map(l => l.itemId)).toEqual(['x1', 'x2'])
    const second = await api.submitCart(card.cardId, groc.carts[1]!)
    expect(second.status).toBe('approved')

    const receipt = await api.checkout(card.cardId)
    expect(receipt.cardStatus).toBe('CLOSED')
    const rogue = await api.attemptCharge(card.cardId, 'giftcardz.biz', 'gift_card', 50000)
    expect(rogue).toMatchObject({ approved: false, code: 'CARD_CLOSED' })

    const me = await api.getMember()
    expect(me.accounts[0]!.balanceCents).toBe(421256 - receipt.chargedCents)
    for (const b of bodies) for (const s of SECRETS) expect(b).not.toContain(s)
  })

  it('boat: Agent A flags, member approves via client, backend refuses to fund it (insufficient funds)', async () => {
    const { api } = wire()
    const t = await api.confirmTask(boat.request)
    expect(t.status).toBe('needs_override')
    expect(t.checks.some(c => !c.pass)).toBe(true)
    expect((await api.overrideTask(t.taskId, true)).status).toBe('approved')
    await expect(api.mintCard(t.taskId)).rejects.toThrow(/funds/i)
  })

  it('boat: member declines -> denied, no card', async () => {
    const { api } = wire()
    const t = await api.confirmTask(boat.request)
    expect((await api.overrideTask(t.taskId, false)).status).toBe('denied')
    await expect(api.mintCard(t.taskId)).rejects.toThrow()
  })
})

describe('sessions (many judges, one deployment)', () => {
  it('each x-session gets its own vault; state persists across separate app instances via the store', async () => {
    const store = new MemoryStore()
    const a = wire({ store, session: 'judge-a' }).api
    const b = wire({ store, session: 'judge-b' }).api
    const t = await a.confirmTask(groc.request)
    const card = await a.mintCard(t.taskId)
    expect((await b.getMember()).accounts[0]!.balanceCents).toBe(421256) // untouched
    expect((await a.getMember()).accounts[0]!.balanceCents).toBe(421256 - 8000)
    // a "new serverless instance" (new app, same store) continues the session
    const a2 = wire({ store, session: 'judge-a' }).api
    await a2.submitCart(card.cardId, groc.carts[1]!)
    expect((await a2.checkout(card.cardId)).cardStatus).toBe('CLOSED')
  })

  it('rejects malformed session ids', async () => {
    const { app } = wire()
    const r = await app.request('/api/member', { headers: { 'x-session': '../etc', 'x-member-token': 'demo-member-token' } })
    expect(r.status).toBe(400)
  })
})

describe('member token gate (an agent cannot self-approve)', () => {
  it('blocks member, override, reset and events without the token', async () => {
    const { app } = wire()
    for (const [path, method] of [['/api/member', 'GET'], ['/api/tasks/task_1/override', 'POST'], ['/api/reset', 'POST'], ['/api/events', 'GET']] as const) {
      expect((await app.request(path, { method, headers: {} })).status).toBe(401)
      expect((await app.request(path, { method, headers: { 'x-member-token': 'guess' } })).status).toBe(401)
    }
  })
  it('agent-side routes work without it; a wrong client token fails member calls', async () => {
    const { api } = wire({ token: 'nope' })
    expect((await api.confirmTask(groc.request)).status).toBe('approved')
    await expect(api.getMember()).rejects.toThrow(/401/)
  })
  it('a custom token is honored and CORS allows the custom headers', async () => {
    const app = createApp({ memberToken: 's3cret' })
    expect((await app.request('/api/member', { headers: { 'x-member-token': 's3cret' } })).status).toBe(200)
    expect((await app.request('/api/member', { headers: { 'x-member-token': 'demo-member-token' } })).status).toBe(401)
    const pre = await app.request('/api/member', { method: 'OPTIONS', headers: { origin: 'http://x', 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-member-token,x-session' } })
    expect(pre.headers.get('access-control-allow-headers')).toMatch(/x-member-token.*x-session|x-session.*x-member-token/i)
  })
})

describe('validation', () => {
  it('400s on bad bodies, 404s on unknown ids', async () => {
    const { app } = wire()
    const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    expect((await post('/api/tasks/confirm', { agentName: 'x', task: '', budgetCents: -1, categories: [] })).status).toBe(400)
    expect((await post('/api/tasks/confirm', { agentName: 'x', task: 't', budgetCents: 1.5, categories: ['grocery'] })).status).toBe(400)
    expect((await post('/api/tasks/confirm', { agentName: 'x', task: 't', budgetCents: 100, categories: ['bananas'] })).status).toBe(400)
    expect((await app.request('/api/tasks/confirm', { method: 'POST', body: '{nope' })).status).toBe(400)
    expect((await post('/api/cards', { taskId: 'task_99' })).status).toBe(404)
    expect((await post('/api/cards/vc_9/cart', { items: [] })).status).toBe(404)
    expect((await post('/api/cards/vc_9/charge', { merchant: 'x', category: 'grocery', amountCents: 5 })).status).toBe(404)
  })
})
