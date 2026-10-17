import type { VaultApi } from './types'

/**
 * HTTP client for the real/mock backend. Endpoint map:
 *   GET  /member
 *   POST /tasks/confirm            body: TaskRequest          -> TaskVerdict
 *   POST /tasks/:taskId/override   body: { approve }          -> TaskVerdict
 *   POST /cards                    body: { taskId }           -> VirtualCard
 *   POST /cards/:cardId/cart       body: { items }            -> CartVerdict
 *   POST /cards/:cardId/checkout                              -> Receipt
 *   POST /cards/:cardId/charge     body: { merchant, category, amountCents } -> ChargeResult
 *   POST /reset
 */
export interface HttpApiOptions {
  /** Isolates this browser's vault on the server (x-session). */
  sessionId?: string
  /** Sent only on member-side calls (member, override, reset). A shopping agent never has it. */
  memberToken?: string
  fetchImpl?: typeof fetch
}

export function createHttpApi(baseUrl: string, opts: HttpApiOptions = {}): VaultApi {
  const doFetch = opts.fetchImpl ?? fetch
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, asMember = false): Promise<T> {
    const headers: Record<string, string> = {}
    if (body) headers['Content-Type'] = 'application/json'
    if (opts.sessionId) headers['x-session'] = opts.sessionId
    if (asMember && opts.memberToken) headers['x-member-token'] = opts.memberToken
    const res = await doFetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`)
    return res.status === 204 ? (undefined as T) : res.json()
  }

  return {
    getMember: () => call('GET', '/member', undefined, true),
    confirmTask: (req) => call('POST', '/tasks/confirm', req),
    overrideTask: (taskId, approve) => call('POST', `/tasks/${taskId}/override`, { approve }, true),
    mintCard: (taskId) => call('POST', '/cards', { taskId }),
    submitCart: (cardId, items) => call('POST', `/cards/${cardId}/cart`, { items }),
    checkout: (cardId) => call('POST', `/cards/${cardId}/checkout`),
    attemptCharge: (cardId, merchant, category, amountCents) =>
      call('POST', `/cards/${cardId}/charge`, { merchant, category, amountCents }),
    reset: () => call('POST', '/reset', undefined, true),
  }
}
