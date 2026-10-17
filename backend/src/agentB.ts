import { classifyItem } from './catalog'
import type { Cart, CardRules, CartRejection, CartReview } from './types'
import { dollars } from './types'

/**
 * Agent B: confirm the WHOLE final cart against the task + budget (D11, D12, D13).
 * Approves only if every line passes. Classifies items itself; the agent's label is untrusted.
 */
export function agentB(task: string, rules: CardRules, cart: Cart, attempt: number): CartReview {
  const rejections: CartRejection[] = []
  let total = 0

  cart.items.forEach((item, index) => {
    const bad = (reason: string) => rejections.push({ index, name: item.name, reason })
    if (!Number.isInteger(item.qty) || item.qty < 1 || !Number.isInteger(item.unitPriceCents) || item.unitPriceCents < 1) {
      return bad('Invalid quantity or price.')
    }
    total += item.qty * item.unitPriceCents
    const cats = classifyItem(item.name)
    if (cats.length === 0) return bad('Unrecognized item; cannot confirm it belongs to this task.')
    const offTask = cats.filter(c => !rules.allowedCategories.includes(c))
    if (offTask.length) {
      return bad(`"${offTask.join('/')}" is not allowed for this task ("${task}"; allowed: ${rules.allowedCategories.join(', ')}).`)
    }
    if (item.category && !cats.includes(item.category as never)) {
      bad(`Declared category "${item.category}" does not match item (looks like "${cats.join('/')}").`)
    }
  })

  if (cart.items.length === 0) rejections.push({ index: -1, name: '(cart)', reason: 'Cart is empty.' })
  if (total > rules.budgetCents) {
    rejections.push({ index: -1, name: '(cart)', reason: `Total ${dollars(total)} is over budget ${dollars(rules.budgetCents)}.` })
  }

  const approved = rejections.length === 0
  const message = approved
    ? `Whole cart approved (${dollars(total)} of ${dollars(rules.budgetCents)}).`
    : `Cart rejected. Fix and resubmit the whole list: ${rejections.map(r => (r.index >= 0 ? `remove/replace "${r.name}" - ${r.reason}` : r.reason)).join(' | ')}`
  return { approved, attempt, totalCents: total, rejections, message }
}
