import { useCallback, useMemo, useRef, useState } from 'react'
import { Check, FlaskConical, Loader2, Play, X } from 'lucide-react'
import { VaultClient } from '../../../demos/src/client'
import { runScenario, type ScenarioResult, type StepResult } from '../../../demos/src/runner'
import { SCENARIOS, type Group, type Scenario } from '../../../demos/src/scenarios'

type Status = 'idle' | 'running' | 'pass' | 'fail'
interface Run { status: Status; steps: StepResult[]; result?: ScenarioResult; error?: string }

const GROUPS: { id: Group; label: string; blurb: string }[] = [
  { id: 'happy', label: 'Happy paths', blurb: 'Normal tasks the member would actually give an agent' },
  { id: 'bad', label: 'Bad carts', blurb: 'The agent adds something off-task and has to fix it' },
  { id: 'phish', label: 'Attacks', blurb: 'Prompt injection, phishing and a stolen card' },
  { id: 'audit', label: 'Audit & denials', blurb: 'Suspicious or restricted requests' },
]

const env = import.meta.env
export const LIVE = env.VITE_API_MODE === 'http'
const BASE: string = env.VITE_API_BASE_URL ?? '/api'
const TOKEN: string = env.VITE_MEMBER_TOKEN ?? 'demo-member-token'

/** One isolated vault session per run, so scenarios never see each other's state. */
const newClient = () => new VaultClient(BASE, (url, init) => fetch(url, init), TOKEN, `tc-${crypto.randomUUID()}`)

export function TestCases() {
  const [runs, setRuns] = useState<Record<string, Run>>({})
  const [selected, setSelected] = useState<string>(SCENARIOS[0]!.id)
  const [busy, setBusy] = useState(false)
  const active = useRef(0)

  const patch = useCallback((id: string, r: Partial<Run>) =>
    setRuns((prev) => ({ ...prev, [id]: { ...({ status: 'idle', steps: [] } as Run), ...prev[id], ...r } })), [])

  const runOne = useCallback(async (sc: Scenario) => {
    patch(sc.id, { status: 'running', steps: [], result: undefined, error: undefined })
    try {
      const result = await runScenario(sc, newClient(), (step) =>
        setRuns((prev) => ({ ...prev, [sc.id]: { ...prev[sc.id]!, steps: [...(prev[sc.id]?.steps ?? []), step] } })))
      patch(sc.id, { status: result.failures.length ? 'fail' : 'pass', result, steps: result.steps })
    } catch (e) {
      patch(sc.id, { status: 'fail', error: (e as Error).message })
    }
  }, [patch])

  const runAll = useCallback(async () => {
    setBusy(true)
    active.current += 1
    const queue = [...SCENARIOS]
    const worker = async () => { for (let sc = queue.shift(); sc; sc = queue.shift()) await runOne(sc) }
    await Promise.all([worker(), worker(), worker()])
    setBusy(false)
  }, [runOne])

  const counts = useMemo(() => {
    const v = Object.values(runs)
    return { pass: v.filter((r) => r.status === 'pass').length, fail: v.filter((r) => r.status === 'fail').length, running: v.filter((r) => r.status === 'running').length }
  }, [runs])

  const sc = SCENARIOS.find((s) => s.id === selected)!
  const run = runs[selected]

  return (
    <main className="tc" data-testid="test-cases">
      <header className="tc__head">
        <div>
          <h1 className="tc__title"><FlaskConical size={22} aria-hidden="true" /> Test cases</h1>
          <p className="tc__sub">
            The locked demo scenarios run live against the Escrow API from your browser: every call, every decision, and a scan of
            everything the agent receives for real account data.
          </p>
        </div>
        <div className="tc__actions">
          <span className="tc__summary" data-testid="tc-summary" aria-live="polite">
            {counts.pass} passed · {counts.fail} failed · {SCENARIOS.length - counts.pass - counts.fail - counts.running} not run
          </span>
          <button className="btn btn--primary" onClick={runAll} disabled={busy || !LIVE} data-testid="run-all">
            {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />} Run all {SCENARIOS.length}
          </button>
        </div>
      </header>

      {!LIVE && (
        <p className="tc__notice" role="status">
          The in-browser mock backend can't run these. Start the API and set <code>VITE_API_MODE=http</code> to run the suite.
        </p>
      )}

      <div className="tc__grid">
        <nav className="tc__list" aria-label="Scenarios">
          {GROUPS.map((g) => (
            <section key={g.id}>
              <h2 className="tc__group">{g.label}</h2>
              <p className="tc__blurb">{g.blurb}</p>
              <ul>
                {SCENARIOS.filter((s) => s.group === g.id).map((s) => {
                  const st = runs[s.id]?.status ?? 'idle'
                  return (
                    <li key={s.id}>
                      <button className={`tc__item ${selected === s.id ? 'is-selected' : ''}`} onClick={() => setSelected(s.id)} data-testid={`tc-${s.id}`}>
                        <StatusIcon status={st} testId={`tc-status-${s.id}`} />
                        <span className="tc__item-title">{s.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </nav>

        <section className="panel tc__detail" aria-labelledby="tc-detail-title">
          <header className="panel__head">
            <div>
              <h2 id="tc-detail-title" className="panel__title">{sc.title}</h2>
              <p className="panel__sub">{sc.group} · proves {sc.proves.join(', ')} · <code>{sc.id}</code></p>
            </div>
            <button className="btn btn--secondary btn--sm" onClick={() => runOne(sc)} disabled={run?.status === 'running' || !LIVE} data-testid="run-one">
              <Play size={14} aria-hidden="true" /> Run
            </button>
          </header>

          <ol className="tc__steps" data-testid="tc-steps">
            {!run && <li className="trace__empty">Not run yet. Press Run to execute this scenario against the live API.</li>}
            {run?.error && <li className="tc__fail" role="alert">Could not run: {run.error}</li>}
            {run?.steps.map((st, i) => <Step key={i} st={st} />)}
            {run?.status === 'running' && <li className="trace__pending" aria-hidden="true"><span /><span /><span /></li>}
          </ol>

          {run?.result && (
            <footer className={`tc__verdict ${run.status === 'pass' ? 'is-ok' : 'is-bad'}`} data-testid="tc-verdict" data-status={run.status}>
              {run.status === 'pass'
                ? <><Check size={18} aria-hidden="true" /> Passed: {run.result.steps.reduce((n, s) => n + s.checks.length, 0)} checks, {run.result.agentResponses} agent responses scanned, 0 leaks</>
                : <><X size={18} aria-hidden="true" /> Failed
                    <ul>{run.result.failures.map((f, i) => <li key={i}>{f}</li>)}</ul></>}
            </footer>
          )}
        </section>
      </div>
    </main>
  )
}

function StatusIcon({ status, testId }: { status: Status; testId: string }) {
  const common = { size: 16, 'aria-hidden': true } as const
  return (
    <span className={`tc__status is-${status}`} data-testid={testId} data-status={status}>
      {status === 'pass' ? <Check {...common} /> : status === 'fail' ? <X {...common} /> : status === 'running' ? <Loader2 {...common} className="spin" /> : <span className="tc__dot" />}
      <span className="sr-only">{status}</span>
    </span>
  )
}

function Step({ st }: { st: StepResult }) {
  const failed = st.checks.some((c) => !c.ok)
  return (
    <li className={`tc__step ${failed ? 'is-bad' : ''}`}>
      <span className={`actor actor--${actorKey(st.actor)}`}>{st.actor}</span>
      <div className="trace__body">
        <p className="trace__text">{st.title}</p>
        {st.lines.map((l, i) => <p key={i} className="tc__line">{l}</p>)}
        {st.checks.map((c, i) => (
          <p key={i} className={`tc__check ${c.ok ? 'is-ok' : 'is-bad'}`}>
            {c.ok ? <Check size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />} {c.what}{c.got ? ` (got ${c.got})` : ''}
          </p>
        ))}
      </div>
    </li>
  )
}

const actorKey = (a: string) =>
  a === 'member' ? 'member' : a === 'shopping agent' ? 'agent' : a === 'agent a' || a === 'agent b' ? 'check' : a === 'attacker' ? 'attacker' : a === 'network' ? 'network' : 'vault'
