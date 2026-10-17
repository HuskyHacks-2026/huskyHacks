import { Hono, type MiddlewareHandler } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { isCategory } from './catalog'
import { SCENARIOS } from './scenarios'
import type { Category } from './types'
import { Vault, VaultError } from './vault'

const category = z.string().refine(isCategory, 'unknown category').transform(c => c as Category)
const cents = z.number().int().positive().max(1_000_000_000)
const mintBody = z.object({
  task: z.string().min(1).max(500),
  budgetCents: cents,
  allowedCategories: z.array(category).min(1),
})
const cartBody = z.object({
  merchant: z.string().min(1).max(100),
  items: z.array(z.object({
    name: z.string().min(1).max(200),
    qty: z.number().int().min(1).max(10_000),
    unitPriceCents: z.number().int().min(1).max(100_000_000),
    category: z.string().optional(),
  })).max(100),
})
const chargeBody = z.object({ merchant: z.string().min(1), category, amountCents: z.number().int().min(1).max(1_000_000_000) })

export const MEMBER_HEADER = 'x-member-token'

/** Member-side routes require this token; the agent surface never gets it. */
export function createApp(makeVault: () => Vault = () => new Vault(), memberToken = process.env.VAULT_MEMBER_TOKEN ?? 'demo-member-token') {
  let vault = makeVault()
  const app = new Hono()
  app.use('*', cors({ allowHeaders: ['content-type', MEMBER_HEADER] }))
  const memberOnly: MiddlewareHandler = async (c, next) => {
    if (c.req.header(MEMBER_HEADER) !== memberToken) return c.json({ error: 'UNAUTHORIZED', message: 'Member token required.' }, 401)
    await next()
  }
  app.use('/api/vault/*', memberOnly)
  app.use('/api/vault', memberOnly)
  app.use('/api/events', memberOnly)
  app.use('/api/demo/reset', memberOnly)

  app.onError((err, c) => {
    if (err instanceof VaultError) return c.json({ error: err.code, message: err.message }, err.http as 404 | 409)
    if (err instanceof z.ZodError) return c.json({ error: 'BAD_REQUEST', message: err.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }, 400)
    if (err instanceof SyntaxError) return c.json({ error: 'BAD_REQUEST', message: 'Invalid JSON.' }, 400)
    console.error(err)
    return c.json({ error: 'INTERNAL', message: 'Unexpected error.' }, 500)
  })

  app.get('/api/health', c => c.json({ ok: true }))

  // ---- agent-facing surface: nothing about the real account ever appears here ----
  app.post('/api/agent/cards', async c => {
    const body = mintBody.parse(await c.req.json())
    const view = vault.requestCard(body)
    const code = view.status === 'DENIED' ? 403 : view.status === 'PENDING_OVERRIDE' ? 202 : 201
    return c.json(view, code)
  })
  app.get('/api/agent/cards/:id', c => c.json(vault.agentView(c.req.param('id'))))
  app.post('/api/agent/cards/:id/cart', async c => {
    const cart = cartBody.parse(await c.req.json())
    return c.json(vault.submitCart(c.req.param('id'), cart))
  })
  app.post('/api/agent/cards/:id/checkout', c => c.json(vault.checkout(c.req.param('id'))))
  app.post('/api/agent/cards/:id/charge', async c => {
    const b = chargeBody.parse(await c.req.json())
    const res = vault.charge(c.req.param('id'), b.merchant, b.category, b.amountCents)
    return c.json(res, res.approved ? 200 : 402)
  })

  // ---- member/vault-facing surface (frontend dashboard) ----
  app.get('/api/vault', c => c.json(vault.vaultView()))
  app.post('/api/vault/cards/:id/override', async c => {
    const { approve } = z.object({ approve: z.boolean() }).parse(await c.req.json())
    return c.json(vault.resolveOverride(c.req.param('id'), approve))
  })
  app.get('/api/events', c => c.json(vault.eventsSince(Number(c.req.query('since') ?? 0) || 0)))

  // ---- demo helpers ----
  app.get('/api/demo/scenarios', c => c.json(SCENARIOS))
  app.post('/api/demo/reset', c => { vault = makeVault(); return c.json({ ok: true }) })

  return app
}
