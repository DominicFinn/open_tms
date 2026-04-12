import '../hero/mockup-animations.css'

const columns = [
  {
    title: 'Open',
    color: '#3b82f6',
    count: 8,
    cards: [
      { title: 'Temp exceedance on SHP-4421', priority: 'critical', desc: 'Reefer unit reporting 12\u00b0C, threshold is 6\u00b0C. Immediate action required.', time: '12m ago', initials: 'JR' },
      { title: 'Missing POD for SHP-5112', priority: 'medium', desc: 'Customer requesting proof of delivery documentation.', time: '34m ago', initials: 'AL' },
      { title: 'Carrier no-show SHP-6033', priority: 'high', desc: 'Pickup window missed by 2 hours. Need to reassign.', time: '1h ago', initials: 'KM' },
    ],
  },
  {
    title: 'In Progress',
    color: '#f59e0b',
    count: 3,
    cards: [
      { title: 'Late delivery SHP-3307', priority: 'high', desc: 'ETA delay of 4 hours. Customer notified.', time: '2h ago', initials: 'TS' },
      { title: 'Weight discrepancy SHP-3651', priority: 'low', desc: 'Actual weight 2,400 lbs vs manifest 2,200 lbs.', time: '3h ago', initials: 'DP' },
      { title: 'Damaged pallet SHP-4102', priority: 'medium', desc: 'One pallet damaged during loading. Assessing.', time: '4h ago', initials: 'MR' },
    ],
  },
  {
    title: 'Resolved',
    color: '#22c55e',
    count: 12,
    cards: [
      { title: 'GPS signal lost SHP-2918', priority: 'medium', desc: 'Device reconnected after 45 min dead zone.', time: '5h ago', initials: 'JR' },
      { title: 'Invoice mismatch SHP-2844', priority: 'low', desc: 'Rate corrected from $1,450 to $1,380.', time: '6h ago', initials: 'AL' },
      { title: 'Customs hold SHP-2790', priority: 'high', desc: 'Documentation submitted and cleared.', time: '8h ago', initials: 'KM' },
    ],
  },
  {
    title: 'Closed',
    color: '#64748b',
    count: 47,
    cards: [
      { title: 'Reefer alarm SHP-2501', priority: 'critical', desc: 'False alarm - sensor recalibrated.', time: '1d ago', initials: 'TS' },
      { title: 'Wrong delivery SHP-2433', priority: 'high', desc: 'Rerouted and delivered to correct address.', time: '1d ago', initials: 'DP' },
      { title: 'Billing dispute SHP-2380', priority: 'low', desc: 'Resolved with carrier. Credit issued.', time: '2d ago', initials: 'MR' },
    ],
  },
]

const priorityColors: Record<string, { bg: string; text: string }> = {
  critical: { bg: 'rgba(239,68,68,0.2)', text: '#fca5a5' },
  high: { bg: 'rgba(249,115,22,0.2)', text: '#fdba74' },
  medium: { bg: 'rgba(234,179,8,0.2)', text: '#fde047' },
  low: { bg: 'rgba(148,163,184,0.15)', text: '#cbd5e1' },
}

export default function KanbanPreview() {
  return (
    <div style={{
      fontFamily: 'Inter, system-ui, sans-serif',
      background: 'rgba(15,23,42,0.9)',
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 0 80px rgba(59,130,246,0.08), 0 25px 50px rgba(0,0,0,0.4)',
      border: '1px solid rgba(255,255,255,0.06)',
      maxWidth: 800,
      width: '100%',
    }}>
      <style>{`
        @keyframes kanban-preview-move {
          0%, 15% { transform: translateX(0); opacity: 1; }
          20% { transform: translateX(10px); opacity: 0.7; }
          30%, 70% { transform: translateX(calc(25% + 12px)); opacity: 1; }
          75% { transform: translateX(calc(25% + 22px)); opacity: 0.7; }
          85%, 100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes kanban-new-card {
          0%, 60% { opacity: 0; transform: translateY(-8px) scale(0.97); }
          65% { opacity: 0; transform: translateY(-8px) scale(0.97); }
          75% { opacity: 1; transform: translateY(0) scale(1); box-shadow: 0 0 20px rgba(59,130,246,0.15); }
          90% { box-shadow: 0 0 0px rgba(59,130,246,0); }
          100% { opacity: 1; transform: translateY(0) scale(1); box-shadow: none; }
        }
      `}</style>

      {/* Page header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Issues</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>13 open issues</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            height: 30, borderRadius: 6, padding: '0 10px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            Filter...
          </div>
          <div style={{
            height: 30, borderRadius: 6, padding: '0 14px',
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#3b82f6',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
            Report Issue
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 10, padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {[
          { label: 'Open', value: 8, color: '#3b82f6' },
          { label: 'In Progress', value: 3, color: '#f59e0b' },
          { label: 'Resolved', value: 12, color: '#22c55e' },
          { label: 'Closed', value: 47, color: '#64748b' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, padding: '10px 12px', borderRadius: 8,
            background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban columns */}
      <div style={{ display: 'flex', gap: 10, padding: '16px 20px', position: 'relative', minHeight: 360 }}>
        {columns.map((col, colIdx) => (
          <div key={col.title} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Column header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
              padding: '6px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: col.color, opacity: 0.7 }}/>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {col.title}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#64748b',
                background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '1px 6px', marginLeft: 'auto',
              }}>{col.count}</span>
            </div>

            {/* New card fade-in for first column */}
            {colIdx === 0 && (
              <div style={{
                animation: 'kanban-new-card 8s ease-in-out infinite',
                marginBottom: 8,
              }}>
                <div style={{
                  background: 'rgba(30,41,59,0.9)',
                  borderRadius: 8, padding: '10px 12px',
                  border: '1px solid rgba(59,130,246,0.12)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
                    Reefer alarm SHP-6201
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>
                    Unit reporting abnormal readings on route.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, borderRadius: 8, padding: '2px 6px',
                      background: priorityColors.critical.bg, color: priorityColors.critical.text,
                    }}>critical</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: '#475569' }}>just now</span>
                      <div style={{
                        width: 18, height: 18, borderRadius: 9,
                        background: 'rgba(59,130,246,0.2)', color: '#93c5fd',
                        fontSize: 8, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>JR</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.cards.map((card) => (
                <div key={card.title} style={{
                  background: 'rgba(30,41,59,0.8)',
                  borderRadius: 8, padding: '10px 12px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#cbd5e1', lineHeight: 1.3, marginBottom: 4 }}>
                    {card.title}
                  </div>
                  <div style={{ fontSize: 10, color: '#64748b', lineHeight: 1.4, marginBottom: 8 }}>
                    {card.desc}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: 9, fontWeight: 600, borderRadius: 8, padding: '2px 6px',
                      background: priorityColors[card.priority].bg,
                      color: priorityColors[card.priority].text,
                    }}>{card.priority}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 9, color: '#475569' }}>{card.time}</span>
                      <div style={{
                        width: 18, height: 18, borderRadius: 9,
                        background: 'rgba(59,130,246,0.2)', color: '#93c5fd',
                        fontSize: 8, fontWeight: 600,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>{card.initials}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Animated card sliding from Open to In Progress */}
        <div style={{
          position: 'absolute',
          top: 16 + 32, /* header offset + column header */
          left: 20,
          width: 'calc(25% - 10px)',
          animation: 'kanban-preview-move 8s ease-in-out infinite',
          zIndex: 10,
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(30,41,59,0.97)',
            borderRadius: 8, padding: '10px 12px',
            border: '1px solid rgba(59,130,246,0.2)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>
              Detention charge SHP-5890
            </div>
            <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6, lineHeight: 1.4 }}>
              Driver waiting 3h at receiver dock.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize: 9, fontWeight: 600, borderRadius: 8, padding: '2px 6px',
                background: priorityColors.high.bg, color: priorityColors.high.text,
              }}>high</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, color: '#475569' }}>5m ago</span>
                <div style={{
                  width: 18, height: 18, borderRadius: 9,
                  background: 'rgba(59,130,246,0.2)', color: '#93c5fd',
                  fontSize: 8, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>AL</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
