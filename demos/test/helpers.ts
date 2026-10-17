import { createApp } from '../../backend/src/app'
import { VaultClient } from '../src/client'

export const LIVE = process.env.API

/**
 * In-process by default (imports the backend's Hono app; no server needed).
 * With API=http://localhost:8787 the same tests hit a running server instead.
 */
export async function freshClient(makeApp: () => ReturnType<typeof createApp> = () => createApp()): Promise<VaultClient> {
  if (LIVE) {
    const c = new VaultClient(LIVE, (url, init) => fetch(url, init))
    await c.reset()
    return c
  }
  const app = makeApp()
  return new VaultClient('http://vault.local', async (url, init) => app.request(url, init))
}
