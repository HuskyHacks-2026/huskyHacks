import { useEffect, useState } from 'react'
import { BadgeCheck, KeyRound, LockKeyhole } from 'lucide-react'
import { useApi } from './api/client'
import type { MemberSummary } from './api/types'
import { useAgentSession } from './hooks/useAgentSession'
import { PhoneFrame, type Tab } from './components/PhoneFrame'
import { HomeScreen } from './components/HomeScreen'
import { AgentPayScreen } from './components/AgentPayScreen'
import { AgentConsole } from './components/AgentConsole'

const API_MODE = import.meta.env.VITE_API_MODE === 'http' ? 'Live API' : 'Mock API'

export default function App() {
  const api = useApi()
  const [member, setMember] = useState<MemberSummary | null>(null)
  const [tab, setTab] = useState<Tab>('home')
  const [sessionKey, setSessionKey] = useState(0)

  useEffect(() => { api.getMember().then(setMember).catch(() => setMember(null)) }, [api])

  const restart = () => { setSessionKey((k) => k + 1); setTab('agent') }

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar__brand">
          <span className="wordmark">Sound Credit Union</span>
          <span className="topbar__divider" aria-hidden="true" />
          <span className="topbar__product">Agent Pay</span>
        </div>
        <span className="topbar__meta">Concept demo · <span className="mode">{API_MODE}</span></span>
      </header>

      <Stage key={sessionKey} member={member} tab={tab} setTab={setTab} onRestart={restart} />

      <section className="principles" aria-label="How it works">
        <Principle n="01" icon={<KeyRound size={20} />} title="An alias, not an account">
          The agent gets a virtual card with simulated funds. Account and routing numbers never leave the credit union.
        </Principle>
        <Principle n="02" icon={<BadgeCheck size={20} />} title="Two independent checks">
          One check confirms the task and budget fit your history. A second approves the whole cart before anything is bought.
        </Principle>
        <Principle n="03" icon={<LockKeyhole size={20} />} title="Single use, then closed">
          Off-task spending is blocked. After checkout the card closes, so a compromised agent holds nothing useful.
        </Principle>
      </section>

      <footer className="pagefoot">HuskyHack 2026 · Virtual card with simulated funds. No real money moves.</footer>
    </div>
  )
}

function Stage({ member, tab, setTab, onRestart }: {
  member: MemberSummary | null
  tab: Tab
  setTab: (t: Tab) => void
  onRestart: () => void
}) {
  const s = useAgentSession()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, button') && e.key === ' ') return
      if ((e.key === 'ArrowRight' || e.key === ' ') && s.nextLabel && !s.busy) { e.preventDefault(); s.next() }
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && s.phase !== 'idle') onRestart()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [s, onRestart])

  return (
    <main className="stage">
      <div className="stage__copy">
        <h1>Let an AI agent shop for you without handing it your account.</h1>
        <p>
          Agent Pay issues a single-use virtual card for each task, checks the request against the member’s history,
          approves the whole cart, then closes the card.
        </p>
      </div>
      <AgentConsole s={s} onRestart={onRestart} />
      <div className="stage__device">
        <PhoneFrame tab={tab} onTab={setTab}>
          {tab === 'home'
            ? <HomeScreen member={member} onOpenAgentPay={() => setTab('agent')} activeTask={s.scenario?.request.task ?? null} />
            : <AgentPayScreen s={s} onBack={() => setTab('home')} />}
        </PhoneFrame>
      </div>
    </main>
  )
}

function Principle({ n, icon, title, children }: { n: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <article className="principle">
      <div className="principle__head">
        <span className="principle__n">{n}</span>
        <span className="principle__icon" aria-hidden="true">{icon}</span>
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </article>
  )
}
