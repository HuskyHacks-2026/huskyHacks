/**
 * Demo member secrets. Mirrors `backend/src/data.ts` (demoMember) so leak scans stay honest without
 * importing secrets into agent-facing payloads. A test keeps the two in sync.
 */
export const DEMO_MEMBER_SECRETS = {
  memberId: 'SCU-0042-118',
  firstName: 'Jordan',
  checkingNumber: '7700384821',
  savingsNumber: '7700380093',
  routingNumber: '325081403',
  checkingOpeningBalanceCents: 421256,
}

export const SECRET_VALUES: string[] = [
  DEMO_MEMBER_SECRETS.memberId,
  DEMO_MEMBER_SECRETS.firstName,
  DEMO_MEMBER_SECRETS.checkingNumber,
  DEMO_MEMBER_SECRETS.savingsNumber,
  DEMO_MEMBER_SECRETS.routingNumber,
  String(DEMO_MEMBER_SECRETS.checkingOpeningBalanceCents),
  '4212.56',
  '4,212.56',
]

/**
 * JSON keys that belong only on the member surface.
 * Note: VirtualCard.balanceCents (remaining fake money) is allowed on the agent surface —
 * do not list `balanceCents` here.
 */
export const FORBIDDEN_AGENT_KEYS = [
  'number', 'routing', 'memberId', 'accounts', 'recentTransactions', 'firstName', 'mask',
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
