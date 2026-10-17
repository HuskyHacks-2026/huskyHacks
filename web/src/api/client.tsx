import { createContext, useContext, type ReactNode } from 'react'
import type { VaultApi } from './types'
import { createMockApi } from './mockApi'
import { createHttpApi } from './httpApi'

/** Picks the backend from env. Tests can skip this and pass their own api to <ApiProvider>. */
export function createApiFromEnv(): VaultApi {
  const env = import.meta.env
  if (env.VITE_API_MODE === 'http') return createHttpApi(env.VITE_API_BASE_URL ?? 'http://localhost:8000/api')
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
