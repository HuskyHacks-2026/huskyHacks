/**
 * The demo member's real-account data. Mirrors `backend/src/data.ts` (demoMember) so the
 * live-server demo can scan for leaks without importing backend code. A test keeps the two in sync.
 *
 * None of these values, and none of the FORBIDDEN_KEYS, may ever appear in an agent-facing response.
 */
export const DEMO_MEMBER_SECRETS = {
  memberId: 'm_alex',
  name: 'Alex Rivera',
  accountNumber: '8675309214',
  routingNumber: '325081403',
  openingBalanceCents: 482055,
}

export const SECRET_VALUES: string[] = [
  DEMO_MEMBER_SECRETS.memberId,
  DEMO_MEMBER_SECRETS.name,
  ...DEMO_MEMBER_SECRETS.name.split(' '),
  DEMO_MEMBER_SECRETS.accountNumber,
  DEMO_MEMBER_SECRETS.routingNumber,
  String(DEMO_MEMBER_SECRETS.openingBalanceCents),
  '4820.55',
  '4,820.55',
]

/** JSON keys that belong only on the member/vault surface. Structural check, independent of values. */
export const FORBIDDEN_AGENT_KEYS = [
  'accountNumber', 'routingNumber', 'realAccount', 'accountLast4', 'balanceCents',
  'member', 'memberId', 'history', 'historyCount', 'heldCents', 'detail', 'pendingOverride',
]

export interface Leak {
  method: string
  path: string
  kind: 'value' | 'key'
  match: string
}

export function findLeaksInText(text: string): string[] {
  return SECRET_VALUES.filter(s => text.includes(s))
}

export function findForbiddenKeys(json: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(json)) json.forEach(v => findForbiddenKeys(v, found))
  else if (json && typeof json === 'object') {
    for (const [k, v] of Object.entries(json as Record<string, unknown>)) {
      if (FORBIDDEN_AGENT_KEYS.includes(k)) found.add(k)
      findForbiddenKeys(v, found)
    }
  }
  return found
}
