// Shared contracts between the UI and the Vault backend.
// Keep this file in sync with the backend; both the mock and HTTP clients implement VaultApi.

export type Cents = number

export type Category =
  | 'grocery'
  | 'dining'
  | 'gas'
  | 'utilities'
  | 'pharmacy'
  | 'electronics'
  | 'gift_card'
  | 'marine'
  | 'entertainment'
  // known to the backend so it can flag or deny them
  | 'gambling'
  | 'crypto'
  | 'clothing'
  | 'household'
  | 'travel'
  | 'luxury'

/** Member-facing only. Never sent to the shopping agent. */
export interface MemberSummary {
  firstName: string
  accounts: { id: string; name: string; mask: string; balanceCents: Cents }[]
  recentTransactions: { id: string; merchant: string; category: Category; amountCents: Cents; date: string }[]
}

/** What the shopping agent (Perplexity / Muse / Grok) sends us. */
export interface TaskRequest {
  agentName: string
  task: string
  budgetCents: Cents
  categories: Category[]
}

export interface Check {
  id: string
  label: string
  pass: boolean
  detail?: string
}

/** Agent A: does this task + budget make sense for this member? */
export interface TaskVerdict {
  taskId: string
  status: 'approved' | 'needs_override' | 'denied'
  checks: Check[]
  reason: string
}

export type CardStatus = 'OPEN' | 'CLOSED'

/** The ONLY credential the shopping agent ever receives. */
export interface VirtualCard {
  cardId: string
  taskId: string
  pan: string
  expiry: string
  cvv: string
  status: CardStatus
  limitCents: Cents
  balanceCents: Cents
  rules: {
    allowedCategories: Category[]
    maxTotalCents: Cents
    singleUse: true
    expiresAt: string
  }
}

export interface CartItem {
  id: string
  name: string
  merchant: string
  category: Category
  priceCents: Cents
  qty: number
  /** demo-only hint shown in the console: where this item came from */
  note?: string
}

export interface LineVerdict {
  itemId: string
  ok: boolean
  reason?: string
}

/** Agent B: does the whole cart match the task + budget? */
export interface CartVerdict {
  cardId: string
  attempt: number
  status: 'approved' | 'rejected'
  totalCents: Cents
  lines: LineVerdict[]
  /** Message sent back to the shopping agent so it can fix the cart. */
  feedback: string
}

export interface Receipt {
  cardId: string
  chargedCents: Cents
  items: CartItem[]
  cardStatus: CardStatus
  closedAt: string
}

export interface ChargeResult {
  approved: boolean
  code: 'APPROVED' | 'CARD_CLOSED' | 'CARD_EXPIRED' | 'OFF_TASK_BLOCKED' | 'OVER_LIMIT' | 'BAD_AMOUNT' | 'CART_NOT_APPROVED'
  message: string
}

export interface VaultApi {
  getMember(): Promise<MemberSummary>
  confirmTask(req: TaskRequest): Promise<TaskVerdict>
  overrideTask(taskId: string, approve: boolean): Promise<TaskVerdict>
  mintCard(taskId: string): Promise<VirtualCard>
  submitCart(cardId: string, items: CartItem[]): Promise<CartVerdict>
  checkout(cardId: string): Promise<Receipt>
  attemptCharge(cardId: string, merchant: string, category: Category, amountCents: Cents): Promise<ChargeResult>
  reset(): Promise<void>
}
