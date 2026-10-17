import { createApp } from '../../backend/src/app'
import { MemoryStore } from '../../backend/src/store'
import type { Snapshot } from '../../backend/src/vault'
import { VaultClient } from '../src/client'

export const LIVE = process.env.API

/**
 * In-process by default (imports backend createApp). With API=... hits a live server.
 * Optional snapshot seeds a custom member (e.g. thin history) into the session store.
 */
export async function freshClient(opts: { snapshot?: Snapshot; sessionId?: string } = {}): Promise<VaultClient> {
  if (LIVE) {
    const c = new VaultClient(LIVE, (url, init) => fetch(url, init), undefined, opts.sessionId)
    await c.reset()
    return c
  }
  const sessionId = opts.sessionId ?? `t-${Math.random().toString(36).slice(2, 10)}`
  const store = new MemoryStore()
  if (opts.snapshot) await store.set(sessionId, opts.snapshot)
  const app = createApp({ store })
  return new VaultClient('http://vault.local/api', async (url, init) => app.request(url, init), undefined, sessionId)
}
