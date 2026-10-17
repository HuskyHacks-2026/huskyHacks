import { ChevronRight, ShieldCheck } from 'lucide-react'
import type { MemberSummary } from '../api/types'
import { usd } from '../format'

export function HomeScreen({ member, onOpenAgentPay, activeTask }: {
  member: MemberSummary | null
  onOpenAgentPay: () => void
  activeTask: string | null
}) {
  const total = member?.accounts.reduce((s, a) => s + a.balanceCents, 0) ?? 0
  return (
    <div className="screen" data-testid="home-screen">
      <header className="app-bar">
        <div>
          <div className="app-bar__kicker">Good morning</div>
          <h2 className="app-bar__title">{member?.firstName ?? ' '}</h2>
        </div>
        <div className="avatar" aria-hidden="true">{member?.firstName[0] ?? ''}</div>
      </header>

      <section className="hero-balance" aria-label="Total balance">
        <div className="hero-balance__label">Total balance</div>
        <div className="hero-balance__value">{member ? usd(total) : '—'}</div>
      </section>

      <section className="group">
        {member?.accounts.map((a) => (
          <div key={a.id} className="row" data-testid={`account-${a.id}`}>
            <div>
              <div className="row__title">{a.name}</div>
              <div className="row__sub">•• {a.mask}</div>
            </div>
            <div className="row__value">{usd(a.balanceCents)}</div>
          </div>
        )) ?? <div className="skeleton" />}
      </section>

      <button className="feature" onClick={onOpenAgentPay} data-testid="open-agent-pay">
        <span className="feature__icon" aria-hidden="true"><ShieldCheck size={22} /></span>
        <span className="feature__body">
          <span className="feature__title">Escrow {activeTask && <span className="tag tag--live">Active</span>}</span>
          <span className="feature__text">
            {activeTask ?? 'Give AI shopping agents a single-use card. Never your account.'}
          </span>
        </span>
        <ChevronRight size={20} aria-hidden="true" className="feature__chev" />
      </button>

      <section className="group">
        <h3 className="group__title">Recent activity</h3>
        {member?.recentTransactions.slice(0, 5).map((t) => (
          <div key={t.id} className="row">
            <div>
              <div className="row__title">{t.merchant}</div>
              <div className="row__sub">{t.category[0].toUpperCase() + t.category.slice(1)} · {t.date.slice(5).replace('-', '/')}</div>
            </div>
            <div className="row__value row__value--neg">−{usd(t.amountCents)}</div>
          </div>
        ))}
      </section>
    </div>
  )
}
