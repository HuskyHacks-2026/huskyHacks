import type { Category, Cart } from './types'

export interface Scenario {
  id: string
  title: string
  task: string
  budgetCents: number
  allowedCategories: Category[]
  /** Carts the canned shopping agent submits in order; the last is the cleaned-up one. */
  carts: Cart[]
}

const good = [
  { name: 'Whole milk', qty: 1, unitPriceCents: 449, category: 'groceries' },
  { name: 'Eggs dozen', qty: 2, unitPriceCents: 599, category: 'groceries' },
  { name: 'Sourdough bread', qty: 1, unitPriceCents: 649, category: 'groceries' },
  { name: 'Chicken breast', qty: 2, unitPriceCents: 1199, category: 'groceries' },
]

export const SCENARIOS: Scenario[] = [
  {
    id: 'groceries',
    title: 'Groceries $80 - bad cart gets fixed (happy path)',
    task: 'buy groceries',
    budgetCents: 8000,
    allowedCategories: ['groceries'],
    carts: [
      { merchant: 'QFC', items: [...good, { name: '55-inch Smart TV', qty: 1, unitPriceCents: 39999, category: 'groceries' }] },
      { merchant: 'QFC', items: good },
    ],
  },
  {
    id: 'injection',
    title: 'Prompt-injected agent tries a movie + mislabeled item',
    task: 'buy groceries',
    budgetCents: 8000,
    allowedCategories: ['groceries'],
    carts: [
      { merchant: 'QFC', items: [...good, { name: 'Movie tickets x4', qty: 1, unitPriceCents: 6000, category: 'groceries' }] },
      { merchant: 'QFC', items: good },
    ],
  },
  {
    id: 'boat',
    title: '$100,000 boat - suspicious, needs member approval',
    task: 'buy a boat',
    budgetCents: 10_000_000,
    allowedCategories: ['luxury'],
    carts: [{ merchant: 'Seattle Boats', items: [{ name: 'Fishing boat', qty: 1, unitPriceCents: 10_000_000, category: 'luxury' }] }],
  },
  {
    id: 'gambling',
    title: 'Casino chips - denied outright',
    task: 'online casino credit',
    budgetCents: 5000,
    allowedCategories: ['gambling'],
    carts: [],
  },
]
