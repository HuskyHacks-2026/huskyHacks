import type { Category, MemberSummary } from './types'

export const MEMBER: MemberSummary = {
  firstName: 'Jordan',
  accounts: [
    { id: 'chk', name: 'Everyday Checking', mask: '4821', balanceCents: 421256 },
    { id: 'sav', name: 'Membership Savings', mask: '0093', balanceCents: 1287410 },
  ],
  recentTransactions: [
    { id: 't1', merchant: 'PCC Community Markets', category: 'grocery', amountCents: 8734, date: '2026-10-14' },
    { id: 't2', merchant: 'Shell', category: 'gas', amountCents: 5210, date: '2026-10-13' },
    { id: 't3', merchant: 'QFC', category: 'grocery', amountCents: 6122, date: '2026-10-10' },
    { id: 't4', merchant: 'Seattle City Light', category: 'utilities', amountCents: 11440, date: '2026-10-08' },
    { id: 't5', merchant: 'Pho Bac', category: 'dining', amountCents: 3418, date: '2026-10-06' },
    { id: 't6', merchant: 'Safeway', category: 'grocery', amountCents: 10255, date: '2026-10-03' },
    { id: 't7', merchant: 'Walgreens', category: 'pharmacy', amountCents: 2399, date: '2026-09-29' },
  ],
}

/** Sensitive values that must never appear in anything sent to the agent. */
export const SENSITIVE_ACCOUNT_DATA = {
  accountNumber: '7700384821',
  routingNumber: '325081403',
  memberId: 'SCU-0042-118',
}

/** Default ruleset for thin history (PRD D5). Updates as history grows — static for the demo. */
export const DEFAULT_RULESET = {
  maxPerTaskCents: 50000,
  maxBudgetVsLargestSpend: 3,
  cardTtlMinutes: 30,
}

export const historyCategories = (): Category[] =>
  Array.from(new Set(MEMBER.recentTransactions.map((t) => t.category)))
