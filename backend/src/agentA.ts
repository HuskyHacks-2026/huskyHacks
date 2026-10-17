import type { Category, DefaultRuleset, Member } from './types'
import { RESTRICTED, dollars } from './types'

export interface MintRequest {
  task: string
  budgetCents: number
  allowedCategories: Category[]
}

export type AgentADecision =
  | { decision: 'approve'; reasons: string[] }
  | { decision: 'needs_override'; reasons: string[] }
  | { decision: 'deny'; reasons: string[] }

/**
 * Agent A: does this purchase make sense for THIS member? (D4, D5, D7)
 * It does not second-guess the shopping agent's reading of the prompt.
 * Thin history -> default ruleset; enough history -> cap/categories learned from it.
 * deny = restricted/weird pattern; needs_override = suspicious, member decides (D2, D8).
 */
export function agentA(member: Member, req: MintRequest, rules: DefaultRuleset): AgentADecision {
  const deny: string[] = []
  const override: string[] = []

  if (req.allowedCategories.length === 0) deny.push('No spend categories supplied with the request.')
  const restricted = req.allowedCategories.filter(c => RESTRICTED.includes(c))
  if (restricted.length) deny.push(`Restricted categories are never minted: ${restricted.join(', ')}.`)
  if (deny.length) return { decision: 'deny', reasons: deny }

  const thin = member.history.length < rules.thinHistoryThreshold
  const maxTxn = Math.max(0, ...member.history.map(h => h.amountCents))
  const cap = thin ? rules.perTaskCapCents : Math.max(rules.perTaskCapCents, rules.historyCapMultiplier * maxTxn)
  if (req.budgetCents > cap) {
    override.push(
      `Budget ${dollars(req.budgetCents)} exceeds this member's usual range (cap ${dollars(cap)}` +
        `${thin ? ', default ruleset' : ', learned from history'}).`,
    )
  }

  const seen = new Set<Category>(member.history.map(h => h.category))
  const known = thin ? new Set<Category>(rules.allowedCategories) : seen
  const novel = req.allowedCategories.filter(c => !known.has(c))
  if (novel.length) {
    override.push(`New spending pattern for this member: ${novel.join(', ')}.`)
  }

  if (override.length) return { decision: 'needs_override', reasons: override }
  return {
    decision: 'approve',
    reasons: [`Budget ${dollars(req.budgetCents)} and categories fit this member's ${thin ? 'default ruleset' : 'history'}.`],
  }
}
