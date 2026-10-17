import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react'
import type { Actor, AgentSession } from '../hooks/useAgentSession'
import { SENSITIVE_ACCOUNT_DATA } from '../api/mockData'

const ACTOR: Record<Actor, { name: string; key: string }> = {
  member: { name: 'Member', key: 'member' },
  agent: { name: 'Shopping agent', key: 'agent' },
  vault: { name: 'Vault', key: 'vault' },
  agentA: { name: 'Check A · task', key: 'check' },
  agentB: { name: 'Check B · cart', key: 'check' },
  merchant: { name: 'Card network', key: 'network' },
}

const FIELD_LABEL: Record<string, string> = {
  accountNumber: 'Account number',
  routingNumber: 'Routing number',
  memberId: 'Member ID',
}

const TOTAL_STEPS = 6

/** Scans everything the agent received for real account identifiers. */
function leakScan(s: AgentSession) {
  const sentToAgent = JSON.stringify([s.card, s.attempts.map((a) => a.verdict), s.rogue])
  return Object.entries(SENSITIVE_ACCOUNT_DATA).map(([k, v]) => ({ key: k, leaked: sentToAgent.includes(v) }))
}

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour12: false })

export function AgentConsole({ s, onRestart }: { s: AgentSession; onRestart: () => void }) {
  const scroller = useRef<HTMLOListElement>(null)
  const [open, setOpen] = useState<number | null>(null)
  const fields = leakScan(s)
  const leaked = fields.filter((f) => f.leaked).length

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [s.log.length])

  return (
    <section className="panel" data-testid="agent-console" aria-labelledby="trace-title">
      <header className="panel__head">
        <div>
          <h2 id="trace-title" className="panel__title">Transaction trace</h2>
          <p className="panel__sub">Every message between the shopping agent and the Vault.</p>
        </div>
        {s.phase !== 'idle' && (
          <button className="btn btn--ghost btn--sm" onClick={onRestart} data-testid="restart">
            <RotateCcw size={14} aria-hidden="true" /> Restart
          </button>
        )}
      </header>

      <ol className="trace" ref={scroller} data-testid="console-log" aria-live="polite">
        {s.log.length === 0 && (
          <li className="trace__empty">Select a task in the app to begin. Each request and decision will appear here.</li>
        )}
        {s.log.map((e) => (
          <li key={e.id} className={`trace__row ${e.tone ? `is-${e.tone}` : ''}`} data-testid="log-entry">
            <time className="trace__time">{time(e.at)}</time>
            <span className={`actor actor--${ACTOR[e.actor].key}`}>{ACTOR[e.actor].name}</span>
            <div className="trace__body">
              <p className="trace__text">{e.text}</p>
              {e.payload !== undefined && (
                <>
                  <button className="disclosure" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                    <ChevronDown size={14} aria-hidden="true" /> Payload
                  </button>
                  {open === e.id && <pre className="trace__payload">{JSON.stringify(e.payload, null, 2)}</pre>}
                </>
              )}
            </div>
          </li>
        ))}
        {s.busy && <li className="trace__pending" aria-hidden="true"><span /><span /><span /></li>}
      </ol>

      <div className="exposure" data-testid="leak-scan">
        <div className="exposure__stat">
          <span className={`exposure__num ${leaked ? 'is-bad' : ''}`}>{leaked}</span>
          <span className="exposure__label">account fields exposed to the agent</span>
        </div>
        <ul className="exposure__list">
          {fields.map((f) => (
            <li key={f.key} className={f.leaked ? 'is-bad' : ''}>
              {f.leaked ? <ShieldX size={14} aria-hidden="true" /> : <ShieldCheck size={14} aria-hidden="true" />}
              {FIELD_LABEL[f.key] ?? f.key}
              <span className="sr-only">{f.leaked ? 'exposed' : 'not shared'}</span>
            </li>
          ))}
        </ul>
      </div>

      <footer className="presenter">
        <div className="presenter__progress">
          <span className="presenter__count">Step {s.stepIndex} of {TOTAL_STEPS}</span>
          <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_STEPS} aria-valuenow={s.stepIndex}>
            <span style={{ transform: `scaleX(${s.stepIndex / TOTAL_STEPS})` }} />
          </div>
        </div>
        {s.nextLabel ? (
          <button className="btn btn--primary btn--lg" onClick={s.next} disabled={s.busy} data-testid="next-step">
            {s.nextLabel} <ArrowRight size={18} aria-hidden="true" />
          </button>
        ) : (
          <p className="presenter__hint">{s.phase === 'idle' ? 'Start from the phone.' : s.phase === 'needs_override' ? 'Waiting on the member in the app.' : s.busy ? 'Working…' : 'Demo complete.'}</p>
        )}
        <p className="presenter__keys"><kbd>→</kbd> next step · <kbd>R</kbd> restart</p>
        {s.error && <p className="presenter__error" role="alert" data-testid="error">{s.error}</p>}
      </footer>
    </section>
  )
}
