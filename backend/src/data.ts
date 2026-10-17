import type { DefaultRuleset, Member } from './types'

export const SESSION_FUNDING_ACCOUNT = 'chk'

export function demoMember(): Member {
  return {
    firstName: 'Jordan',
    memberId: 'SCU-0042-118',
    accounts: [
      { id: 'chk', name: 'Everyday Checking', number: '7700384821', routing: '325081403', balanceCents: 421256 },
      { id: 'sav', name: 'Membership Savings', number: '7700380093', routing: '325081403', balanceCents: 1287410 },
    ],
    history: [
      { id: 't1', merchant: 'PCC Community Markets', category: 'grocery', amountCents: 8734, date: '2026-10-14' },
      { id: 't2', merchant: 'Shell', category: 'gas', amountCents: 5210, date: '2026-10-13' },
      { id: 't3', merchant: 'QFC', category: 'grocery', amountCents: 6122, date: '2026-10-10' },
      { id: 't4', merchant: 'Seattle City Light', category: 'utilities', amountCents: 11440, date: '2026-10-08' },
      { id: 't5', merchant: 'Pho Bac', category: 'dining', amountCents: 3418, date: '2026-10-06' },
      { id: 't6', merchant: 'Safeway', category: 'grocery', amountCents: 10255, date: '2026-10-03' },
      { id: 't7', merchant: 'Walgreens', category: 'pharmacy', amountCents: 2399, date: '2026-09-29' },
    ],
  }
}

/** Default ruleset (PRD D5). Static for the demo. */
export const DEFAULT_RULESET: DefaultRuleset = {
  perTaskCapCents: 50000,
  historyCapMultiplier: 3,
  cardTtlMs: 30 * 60 * 1000,
  makesSenseMin: 0.3,
}
