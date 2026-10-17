import { useCallback, useRef, useState } from 'react'
import { useApi } from '../api/client'
import type { CartItem, CartVerdict, ChargeResult, Receipt, TaskVerdict, VirtualCard } from '../api/types'
import type { Scenario } from '../demo/scenarios'

export type Phase =
  | 'idle'
  | 'confirming'      // Agent A running
  | 'needs_override'  // waiting on member
  | 'denied'
  | 'minting'
  | 'shopping'        // card open, agent building cart
  | 'reviewing'       // Agent B running
  | 'cart_rejected'
  | 'cart_approved'
  | 'purchasing'
  | 'closed'

export type Actor = 'member' | 'agent' | 'vault' | 'agentA' | 'agentB' | 'merchant'

export interface LogEntry {
  id: number
  at: number
  actor: Actor
  text: string
  payload?: unknown
  tone?: 'ok' | 'bad' | 'warn'
}

export interface Attempt {
  items: CartItem[]
  verdict: CartVerdict
}

export function useAgentSession() {
  const api = useApi()
  const [scenario, setScenario] = useState<Scenario | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [taskVerdict, setTaskVerdict] = useState<TaskVerdict | null>(null)
  const [card, setCard] = useState<VirtualCard | null>(null)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [rogue, setRogue] = useState<ChargeResult | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const logId = useRef(0)

  const push = useCallback((e: Omit<LogEntry, 'id' | 'at'>) => {
    setLog((l) => [...l, { ...e, id: ++logId.current, at: Date.now() }])
  }, [])

  const guard = useCallback(async (fn: () => Promise<void>) => {
    setError(null)
    try { await fn() } catch (e) { setError((e as Error).message); push({ actor: 'vault', text: `Error: ${(e as Error).message}`, tone: 'bad' }) }
  }, [push])

  const mint = useCallback(async (taskId: string) => {
    setPhase('minting')
    const c = await api.mintCard(taskId)
    setCard(c)
    push({ actor: 'vault', text: `Virtual card issued ••${c.pan.slice(-4)} with $${(c.limitCents / 100).toFixed(2)} fake money. Sent to agent.`, payload: c, tone: 'ok' })
    setPhase('shopping')
  }, [api, push])

  const start = useCallback((s: Scenario) => guard(async () => {
    await api.reset()
    setScenario(s); setTaskVerdict(null); setCard(null); setAttempts([]); setReceipt(null); setRogue(null); setLog([])
    push({ actor: 'member', text: s.prompt })
    push({ actor: 'agent', text: `Requesting a virtual card for "${s.request.task}".`, payload: s.request })
    setPhase('confirming')
    const v = await api.confirmTask(s.request)
    setTaskVerdict(v)
    push({ actor: 'agentA', text: v.reason, payload: v, tone: v.status === 'approved' ? 'ok' : 'warn' })
    if (v.status === 'approved') await mint(v.taskId)
    else setPhase('needs_override')
  }), [api, guard, mint, push])

  const override = useCallback((approve: boolean) => guard(async () => {
    if (!taskVerdict) return
    push({ actor: 'member', text: approve ? 'I approve this purchase.' : 'No, I did not ask for this.' })
    const v = await api.overrideTask(taskVerdict.taskId, approve)
    setTaskVerdict(v)
    push({ actor: 'vault', text: v.reason, tone: approve ? 'ok' : 'bad' })
    if (v.status === 'approved') await mint(v.taskId)
    else setPhase('denied')
  }), [api, guard, mint, push, taskVerdict])

  const submitNextCart = useCallback(() => guard(async () => {
    if (!scenario || !card) return
    const items = scenario.carts[Math.min(attempts.length, scenario.carts.length - 1)]
    push({
      actor: 'agent',
      text: attempts.length === 0 ? `Cart ready (${items.length} items). Submitting for checkout.` : `Fixed cart and resubmitting (${items.length} items).`,
      payload: items,
    })
    setPhase('reviewing')
    const verdict = await api.submitCart(card.cardId, items)
    setAttempts((a) => [...a, { items, verdict }])
    push({ actor: 'agentB', text: verdict.feedback, payload: verdict, tone: verdict.status === 'approved' ? 'ok' : 'bad' })
    setPhase(verdict.status === 'approved' ? 'cart_approved' : 'cart_rejected')
  }), [api, attempts.length, card, guard, push, scenario])

  const checkout = useCallback(() => guard(async () => {
    if (!card) return
    setPhase('purchasing')
    const r = await api.checkout(card.cardId)
    setReceipt(r)
    setCard((c) => (c ? { ...c, status: 'CLOSED', balanceCents: c.balanceCents - r.chargedCents } : c))
    push({ actor: 'vault', text: `Charged $${(r.chargedCents / 100).toFixed(2)}. Card ••${card.pan.slice(-4)} CLOSED.`, payload: r, tone: 'ok' })
    setPhase('closed')
  }), [api, card, guard, push])

  const tryRogueCharge = useCallback(() => guard(async () => {
    if (!card) return
    push({ actor: 'agent', text: 'Compromised agent tries to reuse the card at giftcardz.biz for $500.' })
    const r = await api.attemptCharge(card.cardId, 'giftcardz.biz', 'gift_card', 50000)
    setRogue(r)
    push({ actor: 'merchant', text: r.message, payload: r, tone: r.approved ? 'bad' : 'ok' })
  }), [api, card, guard, push])

  /** The single "what happens next" action for the demo driver. */
  const next = useCallback(() => {
    if (phase === 'shopping' || phase === 'cart_rejected') return submitNextCart()
    if (phase === 'cart_approved') return checkout()
    if (phase === 'closed' && !rogue) return tryRogueCharge()
  }, [checkout, phase, rogue, submitNextCart, tryRogueCharge])

  const nextLabel =
    phase === 'shopping' ? 'Agent submits cart'
    : phase === 'cart_rejected' ? 'Agent fixes & resubmits'
    : phase === 'cart_approved' ? 'Buy & close card'
    : phase === 'closed' && !rogue ? 'Simulate compromised agent'
    : null

  /** Demo progress for the presenter bar. */
  const stepIndex =
    phase === 'idle' ? 0
    : ['confirming', 'needs_override', 'denied', 'minting'].includes(phase) ? 1
    : phase === 'shopping' || phase === 'reviewing' ? 2
    : phase === 'cart_rejected' ? 3
    : phase === 'cart_approved' || phase === 'purchasing' ? 4
    : rogue ? 6 : 5

  const busy = phase === 'confirming' || phase === 'minting' || phase === 'reviewing' || phase === 'purchasing'

  return {
    scenario, phase, busy, taskVerdict, card, attempts, receipt, rogue, log, error,
    stepIndex, start, override, submitNextCart, checkout, tryRogueCharge, next, nextLabel,
  }
}

export type AgentSession = ReturnType<typeof useAgentSession>
