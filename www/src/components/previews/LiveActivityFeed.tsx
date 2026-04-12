import { useEffect, useState } from 'react'

const inboundDock = [
  { pro: 'PRO-884721', carrier: 'Swift Transport', origin: 'Chicago, IL', pallets: 24, eta: '2 min', status: 'arriving' },
  { pro: 'PRO-884718', carrier: 'Werner Logistics', origin: 'Memphis, TN', pallets: 18, eta: 'Now', status: 'docked' },
  { pro: 'PRO-884715', carrier: 'JB Hunt', origin: 'Louisville, KY', pallets: 32, eta: 'Unloading', status: 'unloading' },
  { pro: 'PRO-884709', carrier: 'XPO Freight', origin: 'Atlanta, GA', pallets: 12, eta: 'Complete', status: 'complete' },
]

const outboundDock = [
  { pro: 'PRO-884722', carrier: 'Schneider', dest: 'Dallas, TX', pallets: 28, status: 'loading' },
  { pro: 'PRO-884719', carrier: 'Old Dominion', dest: 'Miami, FL', pallets: 16, status: 'staged' },
  { pro: 'PRO-884716', carrier: 'FedEx Freight', dest: 'Denver, CO', pallets: 22, status: 'dispatched' },
]

const notifications = [
  { type: 'shipment', text: 'New shipment SHP-9247 created', detail: 'Chicago → Dallas • 24 pallets', time: 'Just now' },
  { type: 'arrival', text: 'PRO-884721 arriving at Dock 7', detail: 'Swift Transport • ETA 2 min', time: '30s ago' },
  { type: 'complete', text: 'Order ORD-18842 fulfilled', detail: '32 units picked, packed & shipped', time: '1m ago' },
  { type: 'tender', text: 'Tender TND-402 awarded', detail: 'Schneider • $2,847 • Dallas route', time: '2m ago' },
  { type: 'alert', text: 'Temp alert on SHP-9201', detail: '6.2°C exceeded threshold (6°C)', time: '3m ago' },
  { type: 'shipment', text: 'SHP-9244 delivered on time', detail: 'Miami, FL • Signed by J. Rivera', time: '4m ago' },
  { type: 'arrival', text: 'PRO-884718 docked at Bay 3', detail: 'Werner Logistics • 18 pallets', time: '5m ago' },
  { type: 'complete', text: 'Order ORD-18839 complete', detail: 'All items verified & released', time: '6m ago' },
]

const typeColors: Record<string, { bg: string; border: string; icon: string }> = {
  shipment: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.3)', icon: '#3b82f6' },
  arrival: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.3)', icon: '#22c55e' },
  complete: { bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', icon: '#a78bfa' },
  tender: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', icon: '#f59e0b' },
  alert: { bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.3)', icon: '#ef4444' },
}

const statusColors: Record<string, { bg: string; text: string }> = {
  arriving: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  docked: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
  unloading: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  complete: { bg: 'rgba(167,139,250,0.15)', text: '#c4b5fd' },
  loading: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  staged: { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  dispatched: { bg: 'rgba(34,197,94,0.15)', text: '#4ade80' },
}

export default function LiveActivityFeed() {
  const [visibleNotifs, setVisibleNotifs] = useState(3)
  const [highlightPro, setHighlightPro] = useState(-1)

  useEffect(() => {
    // Cycle through showing new notifications
    const notifTimer = setInterval(() => {
      setVisibleNotifs(v => v >= notifications.length ? 3 : v + 1)
    }, 3000)

    // Highlight incoming PRO numbers
    const proTimer = setInterval(() => {
      setHighlightPro(v => v >= inboundDock.length - 1 ? -1 : v + 1)
    }, 2500)

    return () => { clearInterval(notifTimer); clearInterval(proTimer) }
  }, [])

  const font: React.CSSProperties = { fontFamily: 'Inter, system-ui, sans-serif' }

  return (
    <div style={{
      ...font,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      width: '100%',
      maxWidth: 380,
    }}>
      {/* Live Activity Ticker */}
      <div style={{
        background: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 12,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{
            width: 6, height: 6, borderRadius: 3, background: '#22c55e',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Live Activity
          </span>
          <span style={{ fontSize: 9, color: '#64748b', marginLeft: 'auto' }}>
            {visibleNotifs} events
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflow: 'hidden' }}>
          {notifications.slice(0, visibleNotifs).map((n, i) => {
            const colors = typeColors[n.type]
            const isNew = i === visibleNotifs - 1 && visibleNotifs > 3
            return (
              <div key={`${n.text}-${i}`} style={{
                display: 'flex', gap: 8, padding: '6px 8px',
                borderRadius: 8,
                background: isNew ? colors.bg : 'rgba(30,41,59,0.4)',
                borderLeft: `2px solid ${isNew ? colors.border : 'rgba(255,255,255,0.04)'}`,
                transition: 'all 0.5s ease',
                opacity: isNew ? 1 : 0.7 + (0.3 * (1 - i / visibleNotifs)),
              }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 5, flexShrink: 0, marginTop: 1,
                  background: `${colors.icon}15`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: colors.icon }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, color: '#e2e8f0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {n.text}
                  </div>
                  <div style={{ fontSize: 8, color: '#64748b', marginTop: 1 }}>{n.detail}</div>
                </div>
                <span style={{ fontSize: 7, color: '#475569', flexShrink: 0, marginLeft: 'auto', marginTop: 2 }}>{n.time}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cross-Dock View */}
      <div style={{
        background: 'rgba(15,23,42,0.92)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 12,
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#e2e8f0', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Cross-Dock
          </span>
        </div>

        {/* Inbound */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#22c55e', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
            Inbound
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {inboundDock.map((d, i) => (
              <div key={d.pro} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                borderRadius: 6,
                background: highlightPro === i ? 'rgba(34,197,94,0.08)' : 'rgba(30,41,59,0.3)',
                borderLeft: highlightPro === i ? '2px solid rgba(34,197,94,0.4)' : '2px solid transparent',
                transition: 'all 0.6s ease',
                transform: highlightPro === i ? 'translateX(2px)' : 'none',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace', minWidth: 72 }}>{d.pro}</span>
                <span style={{ fontSize: 8, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.carrier}</span>
                <span style={{ fontSize: 7, color: '#64748b' }}>{d.pallets}p</span>
                <span style={{
                  fontSize: 7, fontWeight: 600, borderRadius: 4, padding: '1px 5px',
                  background: statusColors[d.status].bg,
                  color: statusColors[d.status].text,
                }}>
                  {d.eta}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Outbound */}
        <div>
          <div style={{ fontSize: 8, fontWeight: 600, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 }}>
            Outbound
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {outboundDock.map((d) => (
              <div key={d.pro} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px',
                borderRadius: 6,
                background: 'rgba(30,41,59,0.3)',
                borderLeft: '2px solid transparent',
              }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#60a5fa', fontFamily: 'monospace', minWidth: 72 }}>{d.pro}</span>
                <span style={{ fontSize: 8, color: '#94a3b8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.carrier}</span>
                <span style={{ fontSize: 7, color: '#64748b' }}>{d.pallets}p</span>
                <span style={{
                  fontSize: 7, fontWeight: 600, borderRadius: 4, padding: '1px 5px',
                  background: statusColors[d.status].bg,
                  color: statusColors[d.status].text,
                }}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
