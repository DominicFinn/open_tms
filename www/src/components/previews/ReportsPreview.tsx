export default function ReportsPreview() {
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
        @keyframes reports-line-draw {
          from { stroke-dashoffset: 500; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes reports-dot-appear {
          0% { opacity: 0; r: 0; }
          100% { opacity: 1; r: 3; }
        }
        @keyframes reports-breadcrumb-dot {
          0% { opacity: 0; transform: scale(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes reports-badge-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>Telemetry Report &mdash; SHP-7842</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
              background: 'rgba(34,197,94,0.15)', color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.2)',
              animation: 'reports-badge-pulse 3s ease-in-out infinite',
            }}>Auto-generated</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Generated Apr 11, 2026 at 16:30 UTC &bull; Minneapolis, MN &rarr; Milwaukee, WI
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{
            height: 30, borderRadius: 6, padding: '0 12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
            PDF
          </div>
          <div style={{
            height: 30, borderRadius: 6, padding: '0 12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#94a3b8',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13"/></svg>
            Share
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 16, padding: '16px 20px' }}>
        {/* Left: Temperature chart */}
        <div style={{ flex: 1.3 }}>
          <div style={{
            background: 'rgba(30,41,59,0.8)', borderRadius: 10, padding: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Temperature Over Time</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>24h window</span>
            </div>
            <svg width="100%" height="180" viewBox="0 0 420 180" style={{ display: 'block' }}>
              {/* Grid */}
              {[30, 60, 90, 120, 150].map(y => (
                <line key={y} x1="40" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              ))}
              {/* Y-axis labels: -2 to 8 degrees, mapped to y: 150 (-2) to 30 (8) */}
              {[
                { label: '8\u00b0C', y: 30 },
                { label: '6\u00b0C', y: 54 },
                { label: '4\u00b0C', y: 78 },
                { label: '2\u00b0C', y: 102 },
                { label: '0\u00b0C', y: 126 },
                { label: '-2\u00b0C', y: 150 },
              ].map(l => (
                <text key={l.label} x="34" y={l.y + 3} textAnchor="end" fontSize="9" fill="#475569">{l.label}</text>
              ))}
              {/* X-axis labels */}
              {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((t, i) => (
                <text key={t} x={40 + i * 60} y="170" textAnchor="middle" fontSize="9" fill="#475569">{t}</text>
              ))}
              {/* Danger zone above 6C (y=54) */}
              <rect x="40" y="20" width="360" height="34" fill="rgba(239,68,68,0.06)"/>
              <line x1="40" y1="54" x2="400" y2="54" stroke="rgba(239,68,68,0.35)" strokeWidth="1" strokeDasharray="4 3"/>
              <text x="405" y="57" fontSize="8" fill="#ef4444">6\u00b0C limit</text>
              {/* Safe zone label */}
              <text x="405" y="93" fontSize="7" fill="#22c55e" opacity="0.5">Safe</text>
              {/* Temperature line - stays in safe zone, avg ~3.2C (y ~88) */}
              <path
                d="M40 90 L60 88 L80 86 L100 84 L120 82 L140 80 L160 78 L180 76 L200 78 L220 82 L240 84 L260 80 L280 76 L300 74 L320 72 L340 74 L360 78 L380 82 L400 84"
                fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="500" strokeDashoffset="500"
                style={{ animation: 'reports-line-draw 4s ease-out forwards' }}
              />
              {/* Area fill under the line */}
              <path
                d="M40 90 L60 88 L80 86 L100 84 L120 82 L140 80 L160 78 L180 76 L200 78 L220 82 L240 84 L260 80 L280 76 L300 74 L320 72 L340 74 L360 78 L380 82 L400 84 L400 150 L40 150 Z"
                fill="url(#tempGradient)" opacity="0.3"
              />
              <defs>
                <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                </linearGradient>
              </defs>
              {/* Data points */}
              {[
                [40,90],[100,84],[160,78],[220,82],[280,76],[340,74],[400,84]
              ].map(([cx, cy], i) => (
                <circle key={i} cx={cx} cy={cy} r="0" fill="#3b82f6"
                  style={{ animation: `reports-dot-appear 0.3s ease-out ${1.5 + i * 0.3}s forwards` }}/>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: Data summary */}
        <div style={{ flex: 0.7 }}>
          <div style={{
            background: 'rgba(30,41,59,0.8)', borderRadius: 10, padding: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>Shipment Metrics</div>
            {[
              { label: 'Duration', value: '14h 22m', icon: '\u23f1' },
              { label: 'Distance', value: '847 mi', icon: '\ud83d\udccd' },
              { label: 'Avg Temp', value: '3.2\u00b0C', color: '#3b82f6', icon: '\ud83c\udf21' },
              { label: 'Max Temp', value: '5.1\u00b0C', color: '#f59e0b', icon: '\u2b06' },
              { label: 'Min Temp', value: '1.8\u00b0C', color: '#3b82f6', icon: '\u2b07' },
              { label: 'Excursions', value: '0', color: '#22c55e', icon: '\u2705' },
            ].map((m, i) => (
              <div key={m.label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{m.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: m.color || '#e2e8f0' }}>{m.value}</span>
              </div>
            ))}
          </div>

          {/* Compliance badge */}
          <div style={{
            marginTop: 12, background: 'rgba(34,197,94,0.08)', borderRadius: 10, padding: 12,
            border: '1px solid rgba(34,197,94,0.15)', textAlign: 'center' as const,
          }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>&#9989;</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>Compliant</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>All thresholds met</div>
          </div>
        </div>
      </div>

      {/* GPS breadcrumb trail */}
      <div style={{ padding: '0 20px 16px' }}>
        <div style={{
          background: 'rgba(30,41,59,0.6)', borderRadius: 10, padding: 14,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>GPS Breadcrumb Trail</span>
            <span style={{ fontSize: 10, color: '#64748b', marginLeft: 'auto' }}>142 waypoints recorded</span>
          </div>
          <svg width="100%" height="50" viewBox="0 0 700 50" style={{ display: 'block' }}>
            {/* Connecting line */}
            <line x1="20" y1="20" x2="680" y2="20" stroke="rgba(59,130,246,0.15)" strokeWidth="1"/>
            {/* Waypoint dots */}
            {Array.from({ length: 18 }, (_, i) => {
              const x = 20 + i * (660 / 17)
              const isEndpoint = i === 0 || i === 17
              return (
                <g key={i}>
                  <circle cx={x} cy={20}
                    r={isEndpoint ? 5 : 3}
                    fill={isEndpoint ? '#3b82f6' : 'rgba(59,130,246,0.5)'}
                    style={{
                      animation: `reports-breadcrumb-dot 0.3s ease-out ${0.1 * i}s both`,
                      transformOrigin: `${x}px 20px`,
                    }}
                  />
                  {(i === 0 || i === 6 || i === 12 || i === 17) && (
                    <text x={x} y={38} textAnchor="middle" fontSize="8" fill="#475569">
                      {['02:15', '06:42', '11:08', '16:37'][i === 0 ? 0 : i === 6 ? 1 : i === 12 ? 2 : 3]}
                    </text>
                  )}
                </g>
              )
            })}
            {/* Labels */}
            <text x="20" y="48" textAnchor="middle" fontSize="7" fill="#3b82f6">Origin</text>
            <text x="680" y="48" textAnchor="middle" fontSize="7" fill="#22c55e">Delivered</text>
          </svg>
        </div>
      </div>
    </div>
  )
}
