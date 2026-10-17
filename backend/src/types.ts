export type Category =
  | 'groceries' | 'household' | 'clothing' | 'electronics' | 'entertainment'
  | 'travel' | 'luxury' | 'gambling' | 'crypto' | 'gift_cards'

export const RESTRICTED: readonly Category[] = ['gambling', 'crypto', 'gift_cards']

export interface Txn {
  id: string
  merchant: string
  category: Category
  amountCents: number
  date: string
}

/** Secret side of the vault. Must never appear in any agent-facing response. */
export interface Member {
  id: string
  name: string
  realAccount: { accountNumber: string; routingNumber: string; balanceCents: number }
  history: Txn[]
}

export interface DefaultRuleset {
  perTaskCapCents: number
  allowedCategories: Category[]
  thinHistoryThreshold: number
  historyCapMultiplier: number
  cardTtlMs: number
}

export interface CardRules {
  budgetCents: number
  allowedCategories: Category[]
  expiresAt: string
}

export type CardStatus = 'PENDING_OVERRIDE' | 'OPEN' | 'CLOSED' | 'DENIED'

export interface CartItem {
  name: string
  qty: number
  unitPriceCents: number
  /** Label supplied by the shopping agent; untrusted. Agent B classifies by name itself. */
  category?: string
}

export interface Cart {
  merchant: string
  items: CartItem[]
}

export interface CartRejection {
  index: number
  name: string
  reason: string
}

export interface CartReview {
  approved: boolean
  attempt: number
  totalCents: number
  rejections: CartRejection[]
  message: string
}

export interface Receipt {
  cardId: string
  merchant: string
  totalCents: number
  items: CartItem[]
  refundedToAccountCents: number
}

export type Actor = 'member' | 'shopping_agent' | 'agent_a' | 'agent_b' | 'vault' | 'network'

export interface VaultEvent {
  seq: number
  ts: string
  actor: Actor
  type: string
  summary: string
  cardId?: string
  data?: Record<string, unknown>
}

export const dollars = (cents: number) => `$${(cents / 100).toFixed(2)}`
