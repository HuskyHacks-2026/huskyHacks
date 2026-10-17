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
export function createHttpApi(baseUrl: string): VaultApi {
  async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`)
    return res.status === 204 ? (undefined as T) : res.json()
  }

  return {
    getMember: () => call('GET', '/member'),
    confirmTask: (req) => call('POST', '/tasks/confirm', req),
    overrideTask: (taskId, approve) => call('POST', `/tasks/${taskId}/override`, { approve }),
    mintCard: (taskId) => call('POST', '/cards', { taskId }),
    submitCart: (cardId, items) => call('POST', `/cards/${cardId}/cart`, { items }),
    checkout: (cardId) => call('POST', `/cards/${cardId}/checkout`),
    attemptCharge: (cardId, merchant, category, amountCents) =>
      call('POST', `/cards/${cardId}/charge`, { merchant, category, amountCents }),
    reset: () => call('POST', '/reset'),
  }
}
