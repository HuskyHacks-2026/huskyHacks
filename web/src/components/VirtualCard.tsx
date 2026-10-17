import type { VirtualCard as Card } from '../api/types'
import { usd } from '../format'

export function VirtualCard({ card }: { card: Card }) {
  const closed = card.status === 'CLOSED'
  return (
    <div className={`vcard ${closed ? 'vcard--closed' : ''}`} data-testid="virtual-card" data-status={card.status}
      role="img" aria-label={`Virtual card ending ${card.pan.slice(-4)}, ${closed ? 'closed' : 'open'}, ${usd(card.balanceCents)} available`}>
      <svg className="vcard__pattern" viewBox="0 0 340 214" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx="330" cy="-10" r={60 + i * 26} fill="none" stroke="currentColor" strokeWidth="1" />
        ))}
      </svg>
      <div className="vcard__row">
        <span className="vcard__brand">Sound <span>Agent Pay</span></span>
        <span className={`vcard__status ${closed ? '' : 'is-open'}`} data-testid="card-status">{closed ? 'CLOSED' : 'OPEN'}</span>
      </div>
      <div className="vcard__chip" aria-hidden="true" />
      <div className="vcard__pan" data-testid="card-pan">•••• •••• •••• {card.pan.slice(-4)}</div>
      <div className="vcard__row vcard__row--end">
        <div className="vcard__meta">
          <span>Single use</span>
          <span>Exp {card.expiry}</span>
        </div>
        <div className="vcard__bal">
          <span className="vcard__meta">Available</span>
          <span data-testid="card-balance">{usd(card.balanceCents)}</span>
        </div>
      </div>
    </div>
  )
}
