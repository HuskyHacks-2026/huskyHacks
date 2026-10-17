import { createContext, useContext, type ReactNode } from 'react'
import type { VaultApi } from './types'
import { createMockApi } from './mockApi'
import { createHttpApi } from './httpApi'

/** One vault per browser so judges don't trample each other on the shared deployment. */
function sessionId(): string {
  try {
    const k = 'vault-session'
    let id = localStorage.getItem(k)
    if (!id) { id = crypto.randomUUID(); localStorage.setItem(k, id) }
    return id
  } catch {
    return crypto.randomUUID()
  }
}

/** Picks the backend from env. Tests can skip this and pass their own api to <ApiProvider>. */
export function createApiFromEnv(): VaultApi {
  const env = import.meta.env
  if (env.VITE_API_MODE === 'http') {
    return createHttpApi(env.VITE_API_BASE_URL ?? '/api', {
      sessionId: sessionId(),
      memberToken: env.VITE_MEMBER_TOKEN ?? 'demo-member-token',
    })
  }
  return createMockApi({ latencyMs: Number(env.VITE_MOCK_LATENCY_MS ?? 600) })
}

const ApiContext = createContext<VaultApi | null>(null)

export function ApiProvider({ api, children }: { api: VaultApi; children: ReactNode }) {
  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

export function useApi(): VaultApi {
  const api = useContext(ApiContext)
  if (!api) throw new Error('useApi must be used inside <ApiProvider>')
  return api
}
