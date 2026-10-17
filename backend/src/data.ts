import type { DefaultRuleset, Member, Txn } from './types'

const t = (id: number, merchant: string, category: Txn['category'], amountCents: number, date: string): Txn =>
  ({ id: `t${id}`, merchant, category, amountCents, date })

export function demoMember(): Member {
  return {
    id: 'm_alex',
    name: 'Alex Rivera',
    realAccount: { accountNumber: '8675309214', routingNumber: '325081403', balanceCents: 482055 },
    history: [
      t(1, 'QFC', 'groceries', 6420, '2026-09-02'),
      t(2, 'Safeway', 'groceries', 8815, '2026-09-09'),
      t(3, 'Trader Joes', 'groceries', 5290, '2026-09-16'),
      t(4, 'QFC', 'groceries', 7140, '2026-09-23'),
      t(5, 'Target', 'household', 3875, '2026-09-25'),
      t(6, 'Safeway', 'groceries', 9430, '2026-09-30'),
      t(7, 'Best Buy', 'electronics', 12900, '2026-10-03'),
      t(8, 'AMC', 'entertainment', 2850, '2026-10-05'),
      t(9, 'QFC', 'groceries', 6755, '2026-10-07'),
      t(10, 'Target', 'clothing', 4599, '2026-10-10'),
    ],
  }
}

export const DEFAULT_RULESET: DefaultRuleset = {
  perTaskCapCents: 20000,
  allowedCategories: ['groceries', 'household', 'clothing', 'electronics', 'entertainment'],
  thinHistoryThreshold: 5,
  historyCapMultiplier: 3,
  cardTtlMs: 30 * 60 * 1000,
}
