import { describe, expect, it, vi } from 'vitest'
import { createJev } from '../src/jev'
import { RedisRestStore } from '../src/store'
import { Vault } from '../src/vault'

const ok = (answers: unknown) => new Response(JSON.stringify({ answers }), { status: 200 })

describe('Jev client', () => {
  it('sends one request with a Choice question per item and parses probabilities', async () => {
    const f = vi.fn(async () => ok({ item_0: { type: 'choice', choice: 'grocery', probabilities: { grocery: 0.9, other: 0.1 }, confidence: 0.9 }, item_1: { type: 'choice', choice: 'electronics', probabilities: { electronics: 1 }, confidence: 1 } }))
    const jev = createJev({ apiKey: 'k', fetchImpl: f as unknown as typeof fetch })
    const out = await jev.classify('groceries', [{ name: 'Milk', merchant: 'QFC' }, { name: 'TV', merchant: 'X' }])
    expect(out).toEqual([{ grocery: 0.9, other: 0.1 }, { electronics: 1 }])
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.typesafe.ai/v1/systemone')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer k')
    const body = JSON.parse(init.body as string)
    expect(body.model).toBe('jev-latest')
    expect(Object.keys(body.questions)).toEqual(['item_0', 'item_1'])
    expect(body.questions.item_0.type).toBe('choice')
    expect(body.questions.item_0.criteria.gift_card).toBeTruthy()
  })

  it('returns nulls (never throws) on 401, timeouts, junk bodies', async () => {
    for (const f of [
      async () => new Response('no', { status: 401 }),
      async () => { throw new Error('boom') },
      async () => new Response('not json', { status: 200 }),
    ]) {
      const jev = createJev({ apiKey: 'k', fetchImpl: f as unknown as typeof fetch })
      expect(await jev.classify('t', [{ name: 'x', merchant: 'y' }])).toEqual([null])
      expect(await jev.makesSense({})).toBeNull()
    }
  })

  it('retries once on 429 then succeeds', async () => {
    let n = 0
    const f = async () => (++n === 1 ? new Response('slow down', { status: 429 }) : ok({ makes_sense: { type: 'noul', noul: 0.8 } }))
    expect(await createJev({ apiKey: 'k', fetchImpl: f as unknown as typeof fetch }).makesSense({})).toBe(0.8)
    expect(n).toBe(2)
  })

  it('an outage does not break the Vault: it falls back to the keyword rules', async () => {
    const down = createJev({ apiKey: 'k', fetchImpl: (async () => { throw new Error('down') }) as unknown as typeof fetch })
    const v = new Vault({ jev: down })
    const t = await v.confirmTask({ agentName: 'x', task: 'Weekly groceries', budgetCents: 8000, categories: ['grocery'] })
    expect(t.status).toBe('approved')
  })
})

describe('RedisRestStore', () => {
  it('round-trips a snapshot via SET/GET commands with a TTL', async () => {
    const kv = new Map<string, string>()
    const calls: unknown[][] = []
    const f = (async (_u: string, init: RequestInit) => {
      const [cmd, key, val] = JSON.parse(init.body as string) as string[]
      calls.push(JSON.parse(init.body as string))
      if (cmd === 'SET') { kv.set(key!, val!); return new Response('{"result":"OK"}') }
      return new Response(JSON.stringify({ result: kv.get(key!) ?? null }))
    }) as unknown as typeof fetch
    const s = new RedisRestStore('https://r', 't', 60, f)
    expect(await s.get('a')).toBeNull()
    const snap = new Vault().snapshot()
    await s.set('a', snap)
    expect(await s.get('a')).toEqual(snap)
    expect(calls.find(c => c[0] === 'SET')).toEqual(['SET', 'vault:a', JSON.stringify(snap), 'EX', 60])
  })
})
