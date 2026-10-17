import type { ReactNode } from 'react'
import { BatteryFull, CreditCard, House, Menu, Signal, Sparkles, Wifi } from 'lucide-react'

export type Tab = 'home' | 'agent'

export function PhoneFrame({ children, tab, onTab }: { children: ReactNode; tab: Tab; onTab: (t: Tab) => void }) {
  return (
    <div className="phone" data-testid="phone">
      <div className="phone__island" aria-hidden="true" />
      <div className="phone__screen">
        <div className="phone__status" aria-hidden="true">
          <span>9:41</span>
          <span className="phone__icons">
            <Signal size={15} strokeWidth={2.5} />
            <Wifi size={15} strokeWidth={2.5} />
            <BatteryFull size={20} strokeWidth={2} />
          </span>
        </div>
        <div className="phone__content">{children}</div>
        <nav className="tabbar" aria-label="App">
          <TabButton label="Home" active={tab === 'home'} onClick={() => onTab('home')} icon={<House size={22} />} />
          <TabButton label="Agent Pay" active={tab === 'agent'} onClick={() => onTab('agent')} icon={<Sparkles size={22} />} testId="tab-agent-pay" />
          <TabButton label="Cards" icon={<CreditCard size={22} />} />
          <TabButton label="More" icon={<Menu size={22} />} />
        </nav>
        <div className="phone__home" aria-hidden="true" />
      </div>
    </div>
  )
}

function TabButton({ label, icon, active, onClick, testId }: {
  label: string; icon: ReactNode; active?: boolean; onClick?: () => void; testId?: string
}) {
  return (
    <button className={`tabbar__item ${active ? 'is-active' : ''}`} onClick={onClick} disabled={!onClick}
      aria-current={active ? 'page' : undefined} data-testid={testId}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
