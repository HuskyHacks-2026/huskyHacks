import { findForbiddenKeys, findLeaksInText, type Leak } from './secrets'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>

export type Surface = 'agent' | 'member'

/** One HTTP round trip, kept so the demo can prove what each side was ever shown. */
export interface Exchange {
  surface: Surface
  method: string
  path: string
  reqBody?: unknown
  status: number
  text: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any
}

/**
 * Thin client over the backend's two surfaces. Everything called through the `agent*` methods is
 * what the shopping agent (or an attacker holding the agent) can see.
 */
export class VaultClient {
  readonly exchanges: Exchange[] = []

  constructor(readonly base: string, private readonly fetchImpl: FetchLike) {}

  private async call(surface: Surface, method: string, path: string, body?: unknown): Promise<Exchange> {
    const res = await this.fetchImpl(this.base + path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { json = null }
    const ex: Exchange = { surface, method, path, reqBody: body, status: res.status, text, json }
    this.exchanges.push(ex)
    return ex
  }

  // ---- agent-facing surface ----
  agentRequestCard(body: { task: string; budgetCents: number; allowedCategories: string[] }) {
    return this.call('agent', 'POST', '/api/agent/cards', body)
  }
  agentGetCard(id: string) { return this.call('agent', 'GET', `/api/agent/cards/${id}`) }
  agentSubmitCart(id: string, cart: unknown) { return this.call('agent', 'POST', `/api/agent/cards/${id}/cart`, cart) }
  agentCheckout(id: string) { return this.call('agent', 'POST', `/api/agent/cards/${id}/checkout`) }
  agentCharge(id: string, body: { merchant: string; category: string; amountCents: number }) {
    return this.call('agent', 'POST', `/api/agent/cards/${id}/charge`, body)
  }

  // ---- member / vault surface ----
  memberVault() { return this.call('member', 'GET', '/api/vault') }
  memberOverride(id: string, approve: boolean) { return this.call('member', 'POST', `/api/vault/cards/${id}/override`, { approve }) }
  events(since = 0) { return this.call('member', 'GET', `/api/events?since=${since}`) }
  health() { return this.call('member', 'GET', '/api/health') }
  reset() { return this.call('member', 'POST', '/api/demo/reset') }

  agentExchanges(): Exchange[] { return this.exchanges.filter(e => e.surface === 'agent') }

  /** Every secret value or member-only key that ever appeared on the agent surface. */
  agentLeaks(): Leak[] {
    const leaks: Leak[] = []
    for (const ex of this.agentExchanges()) {
      for (const match of findLeaksInText(ex.text)) leaks.push({ method: ex.method, path: ex.path, kind: 'value', match })
      for (const match of findForbiddenKeys(ex.json)) leaks.push({ method: ex.method, path: ex.path, kind: 'key', match })
    }
    return leaks
  }
}
