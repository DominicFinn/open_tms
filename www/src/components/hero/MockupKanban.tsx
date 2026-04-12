const columns = [
  {
    title: 'Open',
    count: 4,
    cards: [
      { title: 'Temp exceedance #4421', priority: 'critical', time: '12m ago', initials: 'JR' },
      { title: 'Missing POD #5112', priority: 'medium', time: '34m ago', initials: 'AL' },
    ],
  },
  {
    title: 'In Progress',
    count: 3,
    cards: [
      { title: 'Late pickup #3307', priority: 'high', time: '1h ago', initials: 'KM' },
      { title: 'Weight discrepancy #3651', priority: 'low', time: '2h ago', initials: 'TS' },
    ],
  },
  {
    title: 'Resolved',
    count: 6,
    cards: [
      { title: 'Carrier no-show #4870', priority: 'high', time: '3h ago', initials: 'DP' },
    ],
  },
  {
    title: 'Closed',
    count: 12,
    cards: [
      { title: 'Damaged freight #2918', priority: 'medium', time: '5h ago', initials: 'MR' },
    ],
  },
]

const priorityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.25)', text: '#fca5a5' },
  high: { bg: 'rgba(249,115,22,0.25)', text: '#fdba74' },
  medium: { bg: 'rgba(234,179,8,0.25)', text: '#fde047' },
  low: { bg: 'rgba(148,163,184,0.2)', text: '#cbd5e1' },
}

export default function MockupKanban() {
  return (
    <div className="mockup-panel" style={{
      width: 360,
      borderRadius: 10,
      background: 'rgba(15,23,42,0.85)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 10,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6' }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: '#e2e8f0', letterSpacing: 0.3 }}>ISSUE TRIAGE</span>
        <span style={{ fontSize: 8, color: '#64748b', marginLeft: 'auto' }}>13 open</span>
      </div>

      {/* Columns */}
      <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
        {columns.map((col) => (
          <div key={col.title} style={{ flex: 1, minWidth: 0 }}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5,
              padding: '2px 4px', borderRadius: 4, background: 'rgba(255,255,255,0.03)',
            }}>
              <span style={{ fontSize: 7, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                {col.title}
              </span>
              <span style={{
                fontSize: 7, fontWeight: 600, color: '#64748b',
                background: 'rgba(255,255,255,0.06)', borderRadius: 6, padding: '0 3px',
              }}>
                {col.count}
              </span>
            </div>

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {col.cards.map((card) => (
                <div key={card.title} style={{
                  background: 'rgba(30,41,59,0.8)',
                  borderRadius: 5,
                  padding: '5px 6px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ fontSize: 7, fontWeight: 500, color: '#cbd5e1', lineHeight: 1.3, marginBottom: 3 }}>
                    {card.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 6, fontWeight: 600, borderRadius: 6,
                      padding: '1px 4px',
                      background: priorityColors[card.priority].bg,
                      color: priorityColors[card.priority].text,
                    }}>
                      {card.priority}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 6, color: '#475569' }}>{card.time}</span>
                      <div style={{
                        width: 12, height: 12, borderRadius: 6,
                        background: 'rgba(59,130,246,0.2)', color: '#93c5fd',
                        fontSize: 5, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {card.initials}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Animated card that moves from col 1 to col 2 */}
        <div style={{
          position: 'absolute',
          top: 22,
          left: 6,
          width: 76,
          animation: 'kanban-card-move 16s ease-in-out infinite',
          zIndex: 10,
        }}>
          <div style={{
            background: 'rgba(30,41,59,0.95)',
            borderRadius: 5,
            padding: '5px 6px',
            border: '1px solid rgba(59,130,246,0.15)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            <div style={{ fontSize: 7, fontWeight: 500, color: '#e2e8f0', lineHeight: 1.3, marginBottom: 3 }}>
              Reefer alarm #6201
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 6, fontWeight: 600, borderRadius: 6, padding: '1px 4px',
                background: 'rgba(239,68,68,0.25)', color: '#fca5a5',
              }}>
                critical
              </span>
              <span style={{ fontSize: 6, color: '#475569' }}>just now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
