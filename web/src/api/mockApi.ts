import type {
  CartItem, CartVerdict, Category, ChargeResult, Check, Receipt, TaskRequest, TaskVerdict, VaultApi, VirtualCard,
} from './types'
import { DEFAULT_RULESET, MEMBER, historyCategories } from './mockData'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const rand4 = () => String(Math.floor(1000 + Math.random() * 9000))

/** In-memory fake backend implementing the same contract as the real server. */
export function createMockApi(opts: { latencyMs?: number } = {}): VaultApi {
  const latency = opts.latencyMs ?? 0
  let tasks = new Map<string, { req: TaskRequest; verdict: TaskVerdict }>()
  let cards = new Map<string, VirtualCard>()
  let carts = new Map<string, { items: CartItem[]; verdict: CartVerdict }[]>()
  let seq = 0

  const delay = () => (latency ? sleep(latency) : Promise.resolve())
  const fail = (msg: string) => Promise.reject(new Error(msg))

  return {
    async getMember() {
      await delay()
      return structuredClone(MEMBER)
    },

    async confirmTask(req) {
      await delay()
      const taskId = `task_${++seq}`
      const known = historyCategories()
      const largest = Math.max(...MEMBER.recentTransactions.map((t) => t.amountCents))
      const hour = new Date().getHours()

      const checks: (Check & { failText: string })[] = [
        {
          id: 'categories',
          label: 'Categories match member history',
          failText: 'never bought this kind of thing before',
          pass: req.categories.every((c) => known.includes(c)),
          detail: req.categories.join(', '),
        },
        {
          id: 'cap',
          label: `Under default per-task cap ($${DEFAULT_RULESET.maxPerTaskCents / 100})`,
          pass: req.budgetCents <= DEFAULT_RULESET.maxPerTaskCents,
          failText: 'over the default per-task cap',
        },
        {
          id: 'norms',
          label: 'Budget in line with past spending',
          pass: req.budgetCents <= largest * DEFAULT_RULESET.maxBudgetVsLargestSpend,
          failText: 'far above normal spending',
          detail: `largest recent: $${(largest / 100).toFixed(2)}`,
        },
        { id: 'timing', label: 'Normal time & pattern', pass: hour >= 6 && hour <= 23, failText: 'unusual time of day' },
      ]
      const failed = checks.filter((c) => !c.pass)
      const verdict: TaskVerdict = {
        taskId,
        checks: checks.map(({ failText, ...c }) => c),
        status: failed.length === 0 ? 'approved' : 'needs_override',
        reason:
          failed.length === 0
            ? 'Task and budget look normal for this member.'
            : `Unusual request: ${failed.map((c) => c.failText).join(', ')}.`,
      }
      tasks.set(taskId, { req, verdict })
      return structuredClone(verdict)
    },

    async overrideTask(taskId, approve) {
      await delay()
      const t = tasks.get(taskId)
      if (!t) return fail('Unknown task')
      t.verdict = {
        ...t.verdict,
        status: approve ? 'approved' : 'denied',
        reason: approve ? 'Approved by member override.' : 'Declined by member. No card issued.',
      }
      return structuredClone(t.verdict)
    },

    async mintCard(taskId) {
      await delay()
      const t = tasks.get(taskId)
      if (!t || t.verdict.status !== 'approved') return fail('Task not approved')
      const last4 = rand4()
      const card: VirtualCard = {
        cardId: `vc_${++seq}`,
        taskId,
        pan: `4000 12${rand4().slice(0, 2)} ${rand4()} ${last4}`,
        expiry: '10/26',
        cvv: rand4().slice(0, 3),
        status: 'OPEN',
        limitCents: t.req.budgetCents,
        balanceCents: t.req.budgetCents,
        rules: {
          allowedCategories: t.req.categories,
          maxTotalCents: t.req.budgetCents,
          singleUse: true,
          expiresAt: new Date(Date.now() + DEFAULT_RULESET.cardTtlMinutes * 60_000).toISOString(),
        },
      }
      cards.set(card.cardId, card)
      carts.set(card.cardId, [])
      return structuredClone(card)
    },

    async submitCart(cardId, items) {
      await delay()
      const card = cards.get(cardId)
      if (!card) return fail('Unknown card')
      const history = carts.get(cardId)!
      const total = items.reduce((s, i) => s + i.priceCents * i.qty, 0)
      const lines = items.map((i) => {
        const ok = card.rules.allowedCategories.includes(i.category)
        return { itemId: i.id, ok, reason: ok ? undefined : `"${i.category}" is not part of this task` }
      })
      const bad = items.filter((_, idx) => !lines[idx].ok)
      const overBudget = total > card.rules.maxTotalCents
      const approved = bad.length === 0 && !overBudget
      const feedback = approved
        ? 'Whole cart approved. Proceeding to checkout.'
        : [
            bad.length ? `Remove: ${bad.map((b) => b.name).join(', ')}.` : '',
            overBudget ? `Cart total $${(total / 100).toFixed(2)} exceeds budget $${(card.rules.maxTotalCents / 100).toFixed(2)}.` : '',
            'Fix and resubmit the full list.',
          ].filter(Boolean).join(' ')
      const verdict: CartVerdict = {
        cardId, attempt: history.length + 1, status: approved ? 'approved' : 'rejected', totalCents: total, lines, feedback,
      }
      history.push({ items, verdict })
      return structuredClone(verdict)
    },

    async checkout(cardId) {
      await delay()
      const card = cards.get(cardId)
      const last = carts.get(cardId)?.at(-1)
      if (!card || card.status !== 'OPEN') return fail('Card is not open')
      if (!last || last.verdict.status !== 'approved') return fail('Cart not approved')
      card.balanceCents -= last.verdict.totalCents
      card.status = 'CLOSED'
      const receipt: Receipt = {
        cardId, chargedCents: last.verdict.totalCents, items: last.items, cardStatus: 'CLOSED', closedAt: new Date().toISOString(),
      }
      return structuredClone(receipt)
    },

    async attemptCharge(cardId, merchant, category: Category, amountCents): Promise<ChargeResult> {
      await delay()
      const card = cards.get(cardId)
      if (!card || card.status === 'CLOSED')
        return { approved: false, code: 'CARD_CLOSED', message: `Declined at ${merchant}: card is closed.` }
      if (!card.rules.allowedCategories.includes(category))
        return { approved: false, code: 'OFF_TASK_BLOCKED', message: `Blocked at ${merchant}: off-task spend.` }
      if (amountCents > card.balanceCents)
        return { approved: false, code: 'OVER_LIMIT', message: `Declined at ${merchant}: over limit.` }
      return { approved: true, code: 'APPROVED', message: 'Approved.' }
    },

    async reset() {
      tasks = new Map(); cards = new Map(); carts = new Map(); seq = 0
    },
  }
}
