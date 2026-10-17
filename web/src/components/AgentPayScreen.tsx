import { useEffect, useRef } from 'react'
import { Ban, Check, ChevronLeft, ChevronRight, CircleCheck, Loader2, ShieldAlert, X } from 'lucide-react'
import type { AgentSession, Phase } from '../hooks/useAgentSession'
import { SCENARIOS } from '../demo/scenarios'
import { usd } from '../format'
import { VirtualCard } from './VirtualCard'

const STEPS: { key: string; label: string; done: (p: Phase) => boolean }[] = [
  { key: 'task', label: 'Checked', done: (p) => !['idle', 'confirming', 'needs_override', 'denied'].includes(p) },
  { key: 'card', label: 'Card issued', done: (p) => !['idle', 'confirming', 'needs_override', 'denied', 'minting'].includes(p) },
  { key: 'cart', label: 'Cart approved', done: (p) => ['cart_approved', 'purchasing', 'closed'].includes(p) },
  { key: 'closed', label: 'Paid & closed', done: (p) => p === 'closed' },
]

export function AgentPayScreen({ s, onBack }: { s: AgentSession; onBack: () => void }) {
  const lastAttempt = s.attempts.at(-1)
  const activeStep = STEPS.findIndex((st) => !st.done(s.phase))
  const latest = useRef<HTMLDivElement>(null)

  // Keep the newest outcome on screen above the tab bar.
  useEffect(() => {
    latest.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [s.receipt, s.rogue, s.phase])

  return (
    <div className="screen" data-testid="agent-pay-screen" data-phase={s.phase}>
      <header className="nav-bar">
        <button className="icon-btn" onClick={onBack} data-testid="back" aria-label="Back to home">
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <h2 className="nav-bar__title">Escrow</h2>
        <span className="icon-btn" aria-hidden="true" />
      </header>

      {s.phase === 'idle' && (
        <>
          <p className="intro">Choose a task. Your agent gets a temporary virtual card with rules, and never sees your account.</p>
          <div className="group group--flush">
            {SCENARIOS.map((sc) => (
              <button key={sc.id} className="choice" onClick={() => s.start(sc)} data-testid={`scenario-${sc.id}`}>
                <span className="choice__body">
                  <span className="row__title">{sc.title}</span>
                  <span className="row__sub">{sc.subtitle}</span>
                  <span className="choice__quote">“{sc.prompt}”</span>
                </span>
                <ChevronRight size={18} aria-hidden="true" className="choice__chev" />
              </button>
            ))}
          </div>
        </>
      )}

      {s.phase !== 'idle' && (
        <>
          <ol className="stepper" data-testid="steps" aria-label="Progress">
            {STEPS.map((st, i) => {
              const done = st.done(s.phase)
              return (
                <li key={st.key} className={done ? 'is-done' : i === activeStep ? 'is-current' : ''}>
                  <span className="stepper__dot" aria-hidden="true">{done ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                  <span>{st.label}</span>
                </li>
              )
            })}
          </ol>

          {s.scenario && (
            <div className="task-row">
              <div>
                <div className="row__sub">Requested by {s.scenario.request.agentName}</div>
                <div className="row__title">{s.scenario.request.task}</div>
              </div>
              <div className="row__value">{usd(s.scenario.request.budgetCents)}</div>
            </div>
          )}

          {(s.phase === 'confirming' || s.phase === 'minting') && (
            <Status testId="working">{s.phase === 'confirming' ? 'Checking this request against your history' : 'Issuing a virtual card'}</Status>
          )}

          {s.phase === 'needs_override' && s.taskVerdict && s.scenario && (
            <section className="alert-card" data-testid="override-sheet" aria-labelledby="override-title">
              <ShieldAlert size={28} className="alert-card__icon" aria-hidden="true" />
              <h3 id="override-title" className="alert-card__title">Did you ask for this?</h3>
              <p className="alert-card__text">
                Your agent wants <strong>{usd(s.scenario.request.budgetCents)}</strong> for “{s.scenario.request.task}”.
                That’s unusual for your account, so we paused it.
              </p>
              <ul className="checklist">
                {s.taskVerdict.checks.map((c) => (
                  <li key={c.id} className={c.pass ? 'is-pass' : 'is-fail'}>
                    {c.pass ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}
                    <span>{c.label}</span>
                    <span className="sr-only">{c.pass ? 'passed' : 'failed'}</span>
                  </li>
                ))}
              </ul>
              <div className="btn-row">
                <button className="btn btn--secondary" onClick={() => s.override(false)} data-testid="override-deny">Decline</button>
                <button className="btn btn--primary" onClick={() => s.override(true)} data-testid="override-approve">Approve</button>
              </div>
            </section>
          )}

          {s.phase === 'denied' && (
            <Notice tone="neutral" icon={<Ban size={18} />} testId="denied-banner" title="No card issued">
              Your agent was told no. Nothing left your account.
            </Notice>
          )}

          {s.card && (
            <section className="card-block">
              <VirtualCard card={s.card} />
              <ul className="rules" data-testid="card-rules" aria-label="Card rules">
                <li>Only {s.card.rules.allowedCategories.join(', ')}</li>
                <li>Up to {usd(s.card.rules.maxTotalCents)}</li>
                <li>Single use</li>
                <li>Expires in 30 min</li>
              </ul>
            </section>
          )}

          {s.receipt && (
            <Notice tone="ok" icon={<CircleCheck size={18} />} testId="receipt" title={`Paid ${usd(s.receipt.chargedCents)}`}>
              The card is closed and can’t be charged again.
            </Notice>
          )}
          {s.rogue && (
            <Notice tone="bad" icon={<Ban size={18} />} testId="rogue-result" title="Charge blocked">
              {s.rogue.message} Your account details were never shared.
            </Notice>
          )}
          {(s.receipt || s.rogue) && <div ref={latest} aria-hidden="true" />}

          {s.phase === 'shopping' && <Status>Your agent is building a cart. No money moves yet.</Status>}
          {s.phase === 'reviewing' && <Status>Reviewing the full cart against your task</Status>}

          {lastAttempt && (
            <section className="group" data-testid="cart" aria-labelledby="cart-title">
              <div className="group__head">
                <h3 id="cart-title" className="group__title">Cart · attempt {lastAttempt.verdict.attempt}</h3>
                <span className={`tag ${lastAttempt.verdict.status === 'approved' ? 'tag--ok' : 'tag--bad'}`} data-testid="cart-status">
                  {lastAttempt.verdict.status === 'approved' ? 'Approved' : 'Sent back'}
                </span>
              </div>
              {lastAttempt.items.map((it) => {
                const line = lastAttempt.verdict.lines.find((l) => l.itemId === it.id)
                const bad = line?.ok === false
                return (
                  <div key={it.id} className={`row ${bad ? 'row--bad' : ''}`} data-testid={`cart-line-${it.id}`}>
                    <div>
                      <div className="row__title">{it.name}{it.qty > 1 ? ` × ${it.qty}` : ''}</div>
                      {line?.reason && <div className="row__reason"><X size={12} aria-hidden="true" /> {line.reason}</div>}
                    </div>
                    <div className="row__value">{usd(it.priceCents * it.qty)}</div>
                  </div>
                )
              })}
              <div className="row row--total">
                <div className="row__title">Total</div>
                <div className="row__value" data-testid="cart-total">{usd(lastAttempt.verdict.totalCents)}</div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function Status({ children, testId }: { children: React.ReactNode; testId?: string }) {
  return (
    <div className="status" role="status" data-testid={testId}>
      <Loader2 size={16} className="spin" aria-hidden="true" />
      <span>{children}</span>
    </div>
  )
}

function Notice({ tone, icon, title, children, testId }: {
  tone: 'ok' | 'bad' | 'neutral'; icon: React.ReactNode; title: string; children: React.ReactNode; testId?: string
}) {
  return (
    <div className={`notice notice--${tone}`} role="status" data-testid={testId}>
      <span className="notice__icon" aria-hidden="true">{icon}</span>
      <div>
        <div className="notice__title">{title}</div>
        <div className="notice__text">{children}</div>
      </div>
    </div>
  )
}
