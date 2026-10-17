import type { Snapshot } from './vault'

/** Where a judge's session lives between requests (serverless instances don't share memory). */
export interface SessionStore {
  get(key: string): Promise<Snapshot | null>
  set(key: string, snap: Snapshot): Promise<void>
}

export class MemoryStore implements SessionStore {
  private m = new Map<string, Snapshot>()
  async get(key: string) { return this.m.get(key) ?? null }
  async set(key: string, snap: Snapshot) { this.m.set(key, snap) }
}

/** Upstash / Vercel KV REST (no SDK needed). Sessions expire after 2h. */
export class RedisRestStore implements SessionStore {
  constructor(private url: string, private token: string, private ttlSec = 7200, private fetchImpl: typeof fetch = fetch) {}

  private async cmd(args: (string | number)[]) {
    const res = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    if (!res.ok) throw new Error(`session store ${res.status}`)
    return ((await res.json()) as { result: unknown }).result
  }

  async get(key: string) {
    const r = await this.cmd(['GET', `vault:${key}`])
    return typeof r === 'string' ? (JSON.parse(r) as Snapshot) : null
  }

  async set(key: string, snap: Snapshot) {
    await this.cmd(['SET', `vault:${key}`, JSON.stringify(snap), 'EX', this.ttlSec])
  }
}

export function storeFromEnv(env = process.env): SessionStore {
  const url = env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL
  const token = env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? new RedisRestStore(url, token) : new MemoryStore()
}
