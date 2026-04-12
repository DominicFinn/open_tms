const stats = [
  { value: '24', label: 'Active', color: '#3b82f6', iconBg: 'rgba(59,130,246,0.15)' },
  { value: '7', label: 'In Transit', color: '#22c55e', iconBg: 'rgba(34,197,94,0.15)' },
  { value: '96.2%', label: 'On-Time', color: '#a78bfa', iconBg: 'rgba(167,139,250,0.15)' },
]

const shipments = [
  { id: 'SHP-7842', origin: 'Chicago, IL', dest: 'Dallas, TX', status: 'In Transit', statusColor: '#3b82f6' },
  { id: 'SHP-7838', origin: 'Atlanta, GA', dest: 'Miami, FL', status: 'Delivered', statusColor: '#22c55e' },
  { id: 'SHP-7835', origin: 'Seattle, WA', dest: 'Denver, CO', status: 'Pending', statusColor: '#f59e0b' },
]

export default function MockupDashboard() {
  return (
    <div className="mockup-panel" style={{
      width: 320,
      borderRadius: 10,
      background: 'rgba(15,23,42,0.85)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 10,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#22c55e' }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: '#e2e8f0', letterSpacing: 0.3 }}>OPERATIONS</span>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {stats.map((s) => (
          <div key={s.label} style={{
            flex: 1,
            background: 'rgba(30,41,59,0.6)',
            borderRadius: 6,
            padding: '6px 7px',
            border: '1px solid rgba(255,255,255,0.03)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
              <div style={{
                width: 14, height: 14, borderRadius: 4, background: s.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: 1, background: s.color }} />
              </div>
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700, color: '#f1f5f9',
              animation: 'stat-pulse 4s ease-in-out infinite',
            }}>
              {s.value}
            </div>
            <div style={{ fontSize: 6, color: '#64748b', fontWeight: 500, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Mini shipments table */}
      <div style={{
        background: 'rgba(30,41,59,0.4)',
        borderRadius: 6,
        padding: 6,
        marginBottom: 8,
        border: '1px solid rgba(255,255,255,0.03)',
      }}>
        <div style={{ fontSize: 7, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
          Recent Shipments
        </div>
        {shipments.map((s) => (
          <div key={s.id} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
            borderBottom: '1px solid rgba(255,255,255,0.03)',
          }}>
            <span style={{ fontSize: 7, fontWeight: 600, color: '#60a5fa', minWidth: 42 }}>{s.id}</span>
            <span style={{ fontSize: 6, color: '#94a3b8', flex: 1 }}>{s.origin} → {s.dest}</span>
            <span style={{
              fontSize: 6, fontWeight: 600, borderRadius: 6, padding: '1px 4px',
              background: `${s.statusColor}20`, color: s.statusColor,
            }}>
              {s.status}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 6, color: '#94a3b8' }}>Delivery Performance</span>
            <span style={{ fontSize: 6, color: '#64748b' }}>72%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#3b82f6',
              animation: 'progress-fill-1 8s ease-in-out infinite alternate',
            }} />
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 6, color: '#94a3b8' }}>On-Time Pickup</span>
            <span style={{ fontSize: 6, color: '#64748b' }}>94%</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%', borderRadius: 2, background: '#22c55e',
              animation: 'progress-fill-2 8s ease-in-out infinite alternate',
              animationDelay: '2s',
            }} />
          </div>
        </div>
      </div>
    </div>
  )
}
