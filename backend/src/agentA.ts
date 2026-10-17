import type { Jev } from './jev'
import { noJev } from './jev'
import type { Check, DefaultRuleset, Member, TaskRequest, TaskVerdict } from './types'
import { RESTRICTED, dollars } from './types'

/**
 * Agent A: does this task + budget make sense for THIS member? (D4, D5, D7, D12)
 * Deterministic checks decide; Jev can only escalate approve -> needs_override.
 * Restricted categories are denied outright (never overridable).
 */
export async function agentA(
  taskId: string,
  member: Member,
  req: TaskRequest,
  rules: DefaultRuleset,
  jev: Jev = noJev,
): Promise<TaskVerdict> {
  const known = new Set(member.history.map(h => h.category))
  const largest = Math.max(0, ...member.history.map(h => h.amountCents))
  const restricted = req.categories.filter(c => RESTRICTED.includes(c))
  const novel = req.categories.filter(c => !known.has(c))

  const checks: Check[] = [
    {
      id: 'restricted',
      label: 'No restricted categories',
      pass: restricted.length === 0 && req.categories.length > 0,
      detail: restricted.length ? restricted.join(', ') : undefined,
    },
    {
      id: 'categories',
      label: 'Categories match member history',
      pass: novel.length === 0,
      detail: req.categories.join(', '),
    },
    {
      id: 'cap',
      label: `Under default per-task cap (${dollars(rules.perTaskCapCents)})`,
      pass: req.budgetCents <= rules.perTaskCapCents,
    },
    {
      id: 'norms',
      label: 'Budget in line with past spending',
      pass: req.budgetCents <= largest * rules.historyCapMultiplier,
    },
  ]

  const p = await jev.makesSense({
    member: { recentTransactions: member.history.map(h => ({ merchant: h.merchant, category: h.category, amountUsd: h.amountCents / 100 })) },
    request: { task: req.task, budgetUsd: req.budgetCents / 100, categories: req.categories },
  })
  if (p !== null) {
    checks.push({ id: 'makes_sense', label: 'Makes sense for this member (Jev)', pass: p >= rules.makesSenseMin, detail: `${Math.round(p * 100)}% plausible` })
  }

  if (req.categories.length === 0 || restricted.length) {
    return { taskId, status: 'denied', checks, reason: 'Restricted or missing spend categories. No card can be issued.' }
  }
  const failed = checks.filter(c => !c.pass)
  const why: Record<string, string> = {
    categories: 'new kind of purchase for this member',
    cap: 'over the default per-task cap',
    norms: 'far above normal spending',
    makes_sense: 'does not look like this member\'s usual purchases',
  }
  return failed.length === 0
    ? { taskId, status: 'approved', checks, reason: 'Task and budget look normal for this member.' }
    : { taskId, status: 'needs_override', checks, reason: `Unusual request: ${failed.map(c => why[c.id]).join(', ')}.` }
}

