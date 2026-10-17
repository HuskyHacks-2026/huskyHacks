// The wire contract is owned by the frontend (web/src/api/types.ts); import it so both sides can't drift.
import type { Category } from '../../web/src/api/types'
export type { Category }
export type {
  Cents, MemberSummary, TaskRequest, Check, TaskVerdict, VirtualCard, CartItem, LineVerdict, CartVerdict,
  Receipt, ChargeResult, VaultApi,
} from '../../web/src/api/types'

export const RESTRICTED: readonly Category[] = ['gambling', 'crypto', 'gift_card']

export interface Txn {
  id: string
  merchant: string
  category: Category
  amountCents: number
  date: string
}

/** Secret side of the vault. Must never appear in any agent-facing response. */
export interface Member {
  firstName: string
  memberId: string
  accounts: { id: string; name: string; number: string; routing: string; balanceCents: number }[]
  history: Txn[]
}

export interface DefaultRuleset {
  perTaskCapCents: number
  historyCapMultiplier: number
  cardTtlMs: number
  /** Jev "makes sense for this member" below this flags the request for member override. */
  makesSenseMin: number
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
