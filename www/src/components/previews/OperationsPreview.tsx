import { useEffect, useState } from 'react'

const shipments = [
  { id: 'SHP-7842', customer: 'Acme Foods Inc.', origin: 'Chicago, IL', dest: 'Detroit, MI', carrier: 'Swift Transport', status: 'In Transit', statusColor: '#3b82f6', eta: 'Today 14:30' },
  { id: 'SHP-7839', customer: 'FreshCo Logistics', origin: 'Dallas, TX', dest: 'Houston, TX', carrier: 'Werner Freight', status: 'Delivered', statusColor: '#22c55e', eta: 'Delivered 09:12' },
  { id: 'SHP-7836', customer: 'Nordic Dairy Co.', origin: 'Minneapolis, MN', dest: 'Milwaukee, WI', carrier: 'Lineage Cool', status: 'In Transit', statusColor: '#3b82f6', eta: 'Today 16:45' },
  { id: 'SHP-7833', customer: 'Harbor Seafood', origin: 'Seattle, WA', dest: 'Portland, OR', carrier: 'Marten Transport', status: 'Pending', statusColor: '#f59e0b', eta: 'Tomorrow 08:00' },
  { id: 'SHP-7830', customer: 'Valley Produce', origin: 'Phoenix, AZ', dest: 'Las Vegas, NV', carrier: 'Prime Inc.', status: 'Delivered', statusColor: '#22c55e', eta: 'Delivered 11:47' },
]

const stats = [
  { label: 'Active Shipments', value: '142', color: '#3b82f6' },
  { label: 'In Transit', value: '38', color: '#a78bfa' },
  { label: 'Delivered Today', value: '24', color: '#22c55e' },
  { label: 'On-Time', value: '96.2%', color: '#22c55e' },
  { label: 'Issues', value: '3', color: '#ef4444' },
]

export default function OperationsPreview() {
  const [highlightRow, setHighlightRow] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setHighlightRow(prev => (prev + 1) % shipments.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

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
        @keyframes ops-row-pulse {
          0%, 100% { background: transparent; }
          50% { background: rgba(59,130,246,0.08); }
        }
        @keyframes ops-stat-count {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes ops-dot-travel {
          0% { cx: 80; cy: 38; }
          25% { cx: 160; cy: 22; }
          50% { cx: 260; cy: 32; }
          75% { cx: 340; cy: 18; }
          100% { cx: 420; cy: 28; }
        }
        @keyframes ops-dot-ping {
          0%, 100% { r: 3; opacity: 1; }
          50% { r: 5; opacity: 0.5; }
        }
      `}</style>

      {/* Top bar filters */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(30,41,59,0.5)',
      }}>
        <div style={{
          flex: 1, maxWidth: 220, height: 32, borderRadius: 6,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', padding: '0 10px', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <span style={{ fontSize: 12, color: '#64748b' }}>Search shipments...</span>
        </div>
        {['Status: All', 'Mode: All'].map(label => (
          <div key={label} style={{
            height: 32, borderRadius: 6, padding: '0 12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: '#94a3b8',
          }}>
            {label}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {['list', 'map'].map((v, i) => (
            <div key={v} style={{
              width: 32, height: 32, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: i === 0 ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${i === 0 ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              {i === 0 ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={i === 0 ? '#3b82f6' : '#64748b'} strokeWidth="2"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'flex', gap: 12, padding: '16px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {stats.map((stat, i) => (
          <div key={stat.label} style={{
            flex: 1, padding: '12px 14px', borderRadius: 10,
            background: 'rgba(30,41,59,0.8)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{stat.label}</div>
            <div style={{
              fontSize: 22, fontWeight: 700, color: stat.color,
              animation: `ops-stat-count 4s ease-in-out ${i * 0.5}s infinite`,
            }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Shipment table */}
      <div style={{ padding: '0 20px 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['Shipment ID', 'Customer', 'Route', 'Carrier', 'Status', 'ETA'].map(h => (
                <th key={h} style={{
                  padding: '10px 8px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: '#64748b',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shipments.map((s, i) => (
              <tr key={s.id} style={{
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                animation: highlightRow === i ? 'ops-row-pulse 1.5s ease-in-out' : 'none',
                transition: 'background 0.3s ease',
              }}>
                <td style={{ padding: '10px 8px', fontSize: 13, fontWeight: 600, color: '#3b82f6' }}>{s.id}</td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#e2e8f0' }}>{s.customer}</td>
                <td style={{ padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>
                  {s.origin} <span style={{ color: '#64748b' }}>&rarr;</span> {s.dest}
                </td>
                <td style={{ padding: '10px 8px', fontSize: 13, color: '#94a3b8' }}>{s.carrier}</td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                    fontSize: 11, fontWeight: 600,
                    background: `${s.statusColor}20`, color: s.statusColor,
                  }}>{s.status}</span>
                </td>
                <td style={{ padding: '10px 8px', fontSize: 12, color: '#94a3b8' }}>{s.eta}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mini map */}
        <div style={{
          marginTop: 12, borderRadius: 10, overflow: 'hidden',
          background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.06)',
          padding: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8' }}>Live Tracking</span>
            <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>3 active routes</span>
          </div>
          <svg width="100%" height="60" viewBox="0 0 500 60" style={{ display: 'block' }}>
            {/* Route lines */}
            <path d="M80 38 Q160 10 260 32 T420 28" fill="none" stroke="rgba(59,130,246,0.3)" strokeWidth="2" strokeDasharray="4 4"/>
            <path d="M60 48 Q180 20 300 42 T460 22" fill="none" stroke="rgba(167,139,250,0.3)" strokeWidth="2" strokeDasharray="4 4"/>
            <path d="M100 52 Q200 30 320 45 T440 35" fill="none" stroke="rgba(34,197,94,0.3)" strokeWidth="2" strokeDasharray="4 4"/>
            {/* Origin dots */}
            <circle cx="80" cy="38" r="4" fill="#3b82f6" opacity="0.7"/>
            <circle cx="60" cy="48" r="4" fill="#a78bfa" opacity="0.7"/>
            <circle cx="100" cy="52" r="4" fill="#22c55e" opacity="0.7"/>
            {/* Destination dots */}
            <circle cx="420" cy="28" r="4" fill="#3b82f6" opacity="0.4"/>
            <circle cx="460" cy="22" r="4" fill="#a78bfa" opacity="0.4"/>
            <circle cx="440" cy="35" r="4" fill="#22c55e" opacity="0.4"/>
            {/* Animated traveling dot */}
            <circle r="3" fill="#3b82f6" style={{ animation: 'ops-dot-travel 6s linear infinite' }}>
              <animate attributeName="cx" values="80;160;260;340;420" dur="6s" repeatCount="indefinite"/>
              <animate attributeName="cy" values="38;22;32;18;28" dur="6s" repeatCount="indefinite"/>
            </circle>
            <circle r="3" fill="#3b82f6" opacity="0.3" style={{ animation: 'ops-dot-ping 2s ease-in-out infinite' }}>
              <animate attributeName="cx" values="80;160;260;340;420" dur="6s" repeatCount="indefinite"/>
              <animate attributeName="cy" values="38;22;32;18;28" dur="6s" repeatCount="indefinite"/>
            </circle>
          </svg>
        </div>
      </div>
    </div>
  )
}
