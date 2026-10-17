import { beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/app'
import { demoMember } from '../src/data'
import { SCENARIOS } from '../src/scenarios'

let app: ReturnType<typeof createApp>
beforeEach(() => { app = createApp() })

const call = async (method: string, path: string, body?: unknown) => {
  const res = await app.request(path, { method, headers: { 'content-type': 'application/json', 'x-member-token': 'demo-member-token' }, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  return { status: res.status, text, json: text ? JSON.parse(text) : null }
}

const SECRETS = (() => {
  const m = demoMember()
  return [m.name, m.realAccount.accountNumber, m.realAccount.routingNumber, String(m.realAccount.balanceCents), m.id, '4820.55', m.name.split(' ')[0]!]
})()

/** Runs a scenario through the HTTP surface, returning every raw agent-facing response body. */
async function runScenario(id: string) {
  const sc = SCENARIOS.find(s => s.id === id)!
  const agentBodies: string[] = []
  const track = async (m: string, p: string, b?: unknown) => { const r = await call(m, p, b); agentBodies.push(r.text); return r }
  const mint = await track('POST', '/api/agent/cards', { task: sc.task, budgetCents: sc.budgetCents, allowedCategories: sc.allowedCategories })
  return { sc, mint, track, agentBodies }
}

describe('HTTP happy path (PRD 13.1)', () => {
  it('task -> mint -> bad cart rejected -> fixed cart approved -> buy -> card CLOSED -> further spend blocked', async () => {
    const { sc, mint, track } = await runScenario('groceries')
    expect(mint.status).toBe(201)
    const id = mint.json.id
    expect(mint.json.card.pan).toMatch(/^\d{16}$/)
    expect(mint.json.card.remainingCents).toBe(8000)

    const bad = await track('POST', `/api/agent/cards/${id}/cart`, sc.carts[0])
    expect(bad.json.approved).toBe(false)
    expect(bad.json.message).toMatch(/TV/i)
    expect((await track('POST', `/api/agent/cards/${id}/checkout`)).status).toBe(409)

    const good = await track('POST', `/api/agent/cards/${id}/cart`, sc.carts[1])
    expect(good.json.approved).toBe(true)

    const buy = await track('POST', `/api/agent/cards/${id}/checkout`)
    expect(buy.status).toBe(200)
    expect((await call('GET', `/api/agent/cards/${id}`)).json.status).toBe('CLOSED')

    const again = await track('POST', `/api/agent/cards/${id}/charge`, { merchant: 'QFC', category: 'groceries', amountCents: 100 })
    expect(again.status).toBe(402)
    expect(again.json.code).toBe('CARD_CLOSED')

    const events = (await call('GET', '/api/events')).json
    expect(events.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(
      ['card_minted', 'cart_rejected', 'cart_approved', 'checkout', 'card_closed', 'charge_declined']))
  })

  it('prompt-injected cart (movie, mislabeled) is rejected until cleaned', async () => {
    const { sc, mint, track } = await runScenario('injection')
    const r = await track('POST', `/api/agent/cards/${mint.json.id}/cart`, sc.carts[0])
    expect(r.json.approved).toBe(false)
    expect(r.json.rejections.some((x: { name: string }) => /movie/i.test(x.name))).toBe(true)
  })
})

describe('override + deny over HTTP', () => {
  it('boat: 202 pending, member approves via vault surface -> insufficient funds denies', async () => {
    const { mint } = await runScenario('boat')
    expect(mint.status).toBe(202)
    expect(mint.json.card).toBeNull()
    expect((await call('GET', '/api/vault')).json.cards[0].pendingOverride).toBe(true)
    const r = await call('POST', `/api/vault/cards/${mint.json.id}/override`, { approve: true })
    expect(r.json.status).toBe('DENIED') // $100k > $4.8k real balance
  })
  it('gambling: 403 denied', async () => {
    expect((await runScenario('gambling')).mint.status).toBe(403)
  })
})

describe('S1/S3: agent surface never leaks real account data', () => {
  it('no secret appears in any agent-facing response across every scenario, incl. errors', async () => {
    const bodies: string[] = []
    for (const sc of SCENARIOS) {
      app = createApp()
      const { mint, track, agentBodies } = await runScenario(sc.id)
      const id = mint.json.id
      for (const cart of sc.carts) await track('POST', `/api/agent/cards/${id}/cart`, cart)
      await track('POST', `/api/agent/cards/${id}/checkout`)
      await track('POST', `/api/agent/cards/${id}/charge`, { merchant: 'X', category: 'groceries', amountCents: 5 })
      await track('GET', `/api/agent/cards/${id}`)
      await track('GET', '/api/agent/cards/nope')
      await track('POST', `/api/agent/cards/${id}/cart`, { bad: true })
      bodies.push(...agentBodies)
    }
    expect(bodies.length).toBeGreaterThan(20)
    for (const b of bodies) for (const s of SECRETS) expect(b).not.toContain(s)
  })

  it('event log (also shown to the agent-side demo) leaks nothing either', async () => {
    const { sc, mint, track } = await runScenario('groceries')
    await track('POST', `/api/agent/cards/${mint.json.id}/cart`, sc.carts[1])
    await track('POST', `/api/agent/cards/${mint.json.id}/checkout`)
    const ev = (await call('GET', '/api/events')).text
    for (const s of SECRETS) expect(ev).not.toContain(s)
  })

  it('vault (member) surface masks the account to last4 only', async () => {
    const v = (await call('GET', '/api/vault')).text
    expect(v).toContain('9214')
    expect(v).not.toContain('8675309214')
    expect(v).not.toContain('325081403')
  })
})

describe('member token gate', () => {
  const raw = (path: string, method = 'GET', token?: string) =>
    app.request(path, { method, headers: token ? { 'x-member-token': token } : {}, body: method === 'POST' ? '{"approve":true}' : undefined })

  it('agent cannot read the vault, events, override its own request, or reset', async () => {
    const { mint } = await runScenario('boat')
    for (const [path, m] of [['/api/vault', 'GET'], ['/api/events', 'GET'], [`/api/vault/cards/${mint.json.id}/override`, 'POST'], ['/api/demo/reset', 'POST']] as const) {
      expect((await raw(path, m)).status).toBe(401)
      expect((await raw(path, m, 'guess')).status).toBe(401)
    }
    expect((await call('GET', `/api/agent/cards/${mint.json.id}`)).json.status).toBe('PENDING_OVERRIDE')
  })

  it('honors a custom token and keeps the agent surface open', async () => {
    const a = createApp(undefined, 's3cret')
    expect((await a.request('/api/vault', { headers: { 'x-member-token': 's3cret' } })).status).toBe(200)
    expect((await a.request('/api/vault', { headers: { 'x-member-token': 'demo-member-token' } })).status).toBe(401)
    expect((await a.request('/api/demo/scenarios')).status).toBe(200)
  })

  it('CORS preflight allows the token header', async () => {
    const r = await app.request('/api/vault', { method: 'OPTIONS', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'GET', 'access-control-request-headers': 'x-member-token' } })
    expect(r.headers.get('access-control-allow-headers')).toMatch(/x-member-token/i)
  })
})

describe('input validation', () => {
  it('rejects malformed bodies with 400 and unknown cards with 404', async () => {
    expect((await call('POST', '/api/agent/cards', { task: '', budgetCents: -5, allowedCategories: [] })).status).toBe(400)
    expect((await call('POST', '/api/agent/cards', { task: 't', budgetCents: 1.5, allowedCategories: ['groceries'] })).status).toBe(400)
    expect((await call('POST', '/api/agent/cards', { task: 't', budgetCents: 100, allowedCategories: ['bananas'] })).status).toBe(400)
    const res = await app.request('/api/agent/cards', { method: 'POST', body: '{not json' })
    expect(res.status).toBe(400)
    expect((await call('GET', '/api/agent/cards/nope')).status).toBe(404)
  })
  it('reset restores a fresh demo state', async () => {
    await runScenario('groceries')
    await call('POST', '/api/demo/reset')
    const v = (await call('GET', '/api/vault')).json
    expect(v.cards).toEqual([])
    expect(v.member.balanceCents).toBe(demoMember().realAccount.balanceCents)
  })
})
