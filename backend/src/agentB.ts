import { classifyItem } from './catalog'
import type { Jev } from './jev'
import { noJev } from './jev'
import type { CartItem, CartVerdict, Category, LineVerdict } from './types'
import { dollars } from './types'

const OFF_TASK_P = 0.3 // Jev probability on a disallowed category that is enough to reject
const KNOWN_P = 0.6 // Jev probability on an allowed category needed to accept an item keywords don't know

export interface CardLimits {
  allowedCategories: Category[]
  maxTotalCents: number
}

/**
 * Agent B: confirm the WHOLE final cart against the task + budget (D11, D12, D13).
 * Items are classified by name (keywords + Jev); the agent's own category label is untrusted.
 * Jev can only add reasons to reject, or recognize an item keywords don't know.
 */
export async function agentB(
  task: string,
  limits: CardLimits,
  items: CartItem[],
  attempt: number,
  cardId: string,
  jev: Jev = noJev,
): Promise<CartVerdict> {
  const probs = await jev.classify(task, items.map(i => ({ name: i.name, merchant: i.merchant })))
  let total = 0

  const lines: LineVerdict[] = items.map((item, idx) => {
    const bad = (reason: string): LineVerdict => ({ itemId: item.id, ok: false, reason })
    if (!Number.isInteger(item.qty) || item.qty < 1 || !Number.isInteger(item.priceCents) || item.priceCents < 1) {
      return bad('Invalid quantity or price.')
    }
    total += item.qty * item.priceCents

    const kw = classifyItem(item.name)
    const p = probs[idx]
    const top = p ? Object.entries(p).sort((x, y) => y[1] - x[1])[0] : undefined
    const jevKnown = top && top[0] !== 'other' && top[1] >= KNOWN_P
    // Jev adds reasons to reject: any real mass on a disallowed category counts against the item.
    const jevCats = p ? Object.entries(p).filter(([c, v]) => c !== 'other' && v >= OFF_TASK_P).map(([c]) => c) : []
    const offTask = [...new Set([...kw, ...jevCats])].filter(c => !limits.allowedCategories.includes(c as Category))
    if (offTask.length) {
      return bad(`"${offTask.join('/')}" is not part of this task ("${task}"; allowed: ${limits.allowedCategories.join(', ')}).`)
    }
    // Recognition: keywords, or Jev only when it is confident.
    if (kw.length === 0 && !jevKnown) return bad('Unrecognized item; cannot confirm it belongs to this task.')
    return { itemId: item.id, ok: true }
  })

  const overBudget = total > limits.maxTotalCents
  const empty = items.length === 0
  const approved = !empty && !overBudget && lines.every(l => l.ok)
  const bad = items.filter((_, i) => !lines[i]!.ok)
  const feedback = approved
    ? 'Whole cart approved. Proceeding to checkout.'
    : [
        empty ? 'Cart is empty.' : '',
        bad.length ? `Remove: ${bad.map(b => b.name).join(', ')}.` : '',
        overBudget ? `Cart total ${dollars(total)} exceeds budget ${dollars(limits.maxTotalCents)}.` : '',
        'Fix and resubmit the full list.',
      ].filter(Boolean).join(' ')
  return { cardId, attempt, status: approved ? 'approved' : 'rejected', totalCents: total, lines, feedback }
}
