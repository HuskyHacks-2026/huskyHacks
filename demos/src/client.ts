import { findForbiddenKeys, findLeaksInText, type Leak } from './secrets'

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>
export type Surface = 'agent' | 'member'

export const MEMBER_HEADER = 'x-member-token'
export const SESSION_HEADER = 'x-session'
// works in Node (tests/CLI) and in the browser (the web app's Test cases view)
export const DEFAULT_MEMBER_TOKEN: string =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.VAULT_MEMBER_TOKEN ?? 'demo-member-token'

export interface Exchange {
  surface: Surface
  method: string
  path: string
  reqBody?: unknown
  reqHeaders: Record<string, string>
  status: number
  text: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any
}

/**
 * Thin client over the backend VaultApi (paths under /api). Agent-surface calls never send the
 * member token. Every exchange is recorded for leak scanning.
 *
 * baseUrl examples: `http://localhost:8787/api` or in-process `http://vault.local/api`
 */
export class VaultClient {
  readonly exchanges: Exchange[] = []

  constructor(
    readonly base: string,
    private readonly fetchImpl: FetchLike,
    readonly memberToken: string = DEFAULT_MEMBER_TOKEN,
    readonly sessionId: string = `demo-${Math.random().toString(36).slice(2, 10)}`,
  ) {}

  private async call(surface: Surface, method: string, path: string, body?: unknown): Promise<Exchange> {
    const headers: Record<string, string> = { [SESSION_HEADER]: this.sessionId }
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (surface === 'member') headers[MEMBER_HEADER] = this.memberToken
    const res = await this.fetchImpl(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    let json: unknown = null
    try { json = text ? JSON.parse(text) : null } catch { json = null }
    const ex: Exchange = { surface, method, path, reqBody: body, reqHeaders: headers, status: res.status, text, json }
    this.exchanges.push(ex)
    return ex
  }

  // ---- agent ----
  confirmTask(body: { agentName: string; task: string; budgetCents: number; categories: string[] }) {
    return this.call('agent', 'POST', '/tasks/confirm', body)
  }
  mintCard(taskId: string) { return this.call('agent', 'POST', '/cards', { taskId }) }
  submitCart(cardId: string, items: unknown[]) { return this.call('agent', 'POST', `/cards/${cardId}/cart`, { items }) }
  checkout(cardId: string) { return this.call('agent', 'POST', `/cards/${cardId}/checkout`) }
  charge(cardId: string, body: { merchant: string; category: string; amountCents: number }) {
    return this.call('agent', 'POST', `/cards/${cardId}/charge`, body)
  }

  // ---- member ----
  getMember() { return this.call('member', 'GET', '/member') }
  overrideTask(taskId: string, approve: boolean) {
    return this.call('member', 'POST', `/tasks/${taskId}/override`, { approve })
  }
  events(since = 0) { return this.call('member', 'GET', `/events?since=${since}`) }
  reset() { return this.call('member', 'POST', '/reset') }
  health() { return this.call('member', 'GET', '/health') }

  agentExchanges(): Exchange[] { return this.exchanges.filter(e => e.surface === 'agent') }

  agentLeaks(): Leak[] {
    const leaks: Leak[] = []
    for (const ex of this.agentExchanges()) {
      for (const match of findLeaksInText(ex.text)) leaks.push({ method: ex.method, path: ex.path, kind: 'value', match })
      for (const match of findForbiddenKeys(ex.json)) leaks.push({ method: ex.method, path: ex.path, kind: 'key', match })
    }
    return leaks
  }
}
