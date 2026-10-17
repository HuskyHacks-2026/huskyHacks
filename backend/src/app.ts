import { Hono, type MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { isCategory } from './catalog'
import { createJev, noJev, type Jev } from './jev'
import { MemoryStore, storeFromEnv, type SessionStore } from './store'
import type { Category } from './types'
import { Vault, VaultError } from './vault'

export const MEMBER_HEADER = 'x-member-token'
export const SESSION_HEADER = 'x-session'

const category = z.string().refine(isCategory, 'unknown category').transform(c => c as Category)
const taskBody = z.object({
  agentName: z.string().min(1).max(100),
  task: z.string().min(1).max(500),
  budgetCents: z.number().int().positive().max(1_000_000_000),
  categories: z.array(category).min(1),
})
const cartBody = z.object({
  items: z.array(z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    merchant: z.string().min(1).max(100),
    category,
    priceCents: z.number().int().min(1).max(100_000_000),
    qty: z.number().int().min(1).max(10_000),
    note: z.string().max(300).optional(),
  })).max(100),
})
const chargeBody = z.object({
  merchant: z.string().min(1).max(100),
  category,
  amountCents: z.number().int().min(1).max(1_000_000_000),
})

export interface AppOptions {
  store?: SessionStore
  jev?: Jev
  memberToken?: string
  clock?: () => number
}

export function jevFromEnv(env = process.env): Jev {
  return env.TYPESAFE_API_KEY ? createJev({ apiKey: env.TYPESAFE_API_KEY }) : noJev
}

/**
 * Implements the frontend's VaultApi over HTTP (paths in web/src/api/httpApi.ts), under /api.
 * Each browser gets its own vault via the x-session header; state lives in the session store.
 * Member-side calls (member, override, reset, events) need x-member-token; a compromised
 * shopping agent never has it, so it cannot approve its own override or wipe the audit log.
 */
export function createApp(opts: AppOptions = {}) {
  const store = opts.store ?? new MemoryStore()
  const jev = opts.jev ?? noJev
  const memberToken = opts.memberToken ?? process.env.VAULT_MEMBER_TOKEN ?? 'demo-member-token'

  type Env = { Variables: { vault: Vault; sid: string } }
  const app = new Hono<Env>()
  app.use('*', cors({ allowHeaders: ['content-type', MEMBER_HEADER, SESSION_HEADER] }))

  const memberOnly: MiddlewareHandler = async (c, next) => {
    if (c.req.header(MEMBER_HEADER) !== memberToken) return c.json({ error: 'UNAUTHORIZED', message: 'Member token required.' }, 401)
    await next()
  }

  // load this session's vault, persist it after any write
  app.use('/api/*', async (c, next) => {
    const sid = c.req.header(SESSION_HEADER) ?? 'demo'
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(sid)) return c.json({ error: 'BAD_SESSION', message: 'Invalid x-session.' }, 400)
    const snapshot = (await store.get(sid)) ?? undefined
    const vault = new Vault({ jev, clock: opts.clock, snapshot })
    c.set('vault', vault)
    c.set('sid', sid)
    await next()
    if (c.req.method !== 'GET' && c.res.status < 500) await store.set(sid, c.get('vault').snapshot())
  })

  app.onError((err, c) => {
    if (err instanceof VaultError) return c.json({ error: err.code, message: err.message }, err.http as 404 | 409)
    if (err instanceof z.ZodError) return c.json({ error: 'BAD_REQUEST', message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400)
    if (err instanceof SyntaxError) return c.json({ error: 'BAD_REQUEST', message: 'Invalid JSON.' }, 400)
    console.error(err)
    return c.json({ error: 'INTERNAL', message: 'Unexpected error.' }, 500)
  })

  app.get('/api/health', c => c.json({ ok: true, jev: jev !== noJev }))

  // ---- member side ----
  app.get('/api/member', memberOnly, c => c.json(c.get('vault').getMember()))
  app.post('/api/tasks/:id/override', memberOnly, async c => {
    const { approve } = z.object({ approve: z.boolean() }).parse(await c.req.json())
    return c.json(c.get('vault').overrideTask(c.req.param('id'), approve))
  })
  app.get('/api/events', memberOnly, c => c.json(c.get('vault').eventsSince(Number(c.req.query('since') ?? 0) || 0)))
  app.post('/api/reset', memberOnly, async c => {
    c.set('vault', new Vault({ jev, clock: opts.clock }))
    return c.body(null, 204)
  })

  // ---- agent side ----
  app.post('/api/tasks/confirm', async c => c.json(await c.get('vault').confirmTask(taskBody.parse(await c.req.json()))))
  app.post('/api/cards', async c => {
    const { taskId } = z.object({ taskId: z.string() }).parse(await c.req.json())
    return c.json(c.get('vault').mintCard(taskId))
  })
  app.post('/api/cards/:id/cart', async c => {
    const { items } = cartBody.parse(await c.req.json())
    return c.json(await c.get('vault').submitCart(c.req.param('id'), items))
  })
  app.post('/api/cards/:id/checkout', c => c.json(c.get('vault').checkout(c.req.param('id'))))
  app.post('/api/cards/:id/charge', async c => {
    const b = chargeBody.parse(await c.req.json())
    return c.json(c.get('vault').attemptCharge(c.req.param('id'), b.merchant, b.category, b.amountCents))
  })

  return app
}

export const appFromEnv = () => createApp({ store: storeFromEnv(), jev: jevFromEnv() })
