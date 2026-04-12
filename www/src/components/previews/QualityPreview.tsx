const steps = ['Draft', 'Investigation', 'Root Cause', 'Action Plan', 'Implementation', 'Verification', 'Closed']
const currentStep = 2 // Root Cause

export default function QualityPreview() {
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
        @keyframes quality-step-light {
          0%, 5% { background: rgba(255,255,255,0.05); color: #64748b; border-color: rgba(255,255,255,0.06); }
          8%, 100% { background: rgba(59,130,246,0.15); color: #3b82f6; border-color: rgba(59,130,246,0.3); }
        }
        @keyframes quality-check-appear {
          0%, 5% { opacity: 0; transform: scale(0); }
          8%, 100% { opacity: 1; transform: scale(1); }
        }
        @keyframes quality-connector-fill {
          0%, 5% { background: rgba(255,255,255,0.06); }
          8%, 100% { background: rgba(59,130,246,0.3); }
        }
        @keyframes quality-line-draw {
          from { stroke-dashoffset: 300; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes quality-excursion-pulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.25; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0' }}>CAPA-2024-0047</span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12,
              background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.2)',
            }}>Root Cause Identified</span>
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
            Temperature excursion during transit -- SHP-7842
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <div style={{
            height: 30, borderRadius: 6, padding: '0 12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', fontSize: 12, color: '#94a3b8',
          }}>Export</div>
          <div style={{
            height: 30, borderRadius: 6, padding: '0 12px',
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600, color: '#3b82f6',
          }}>Advance Stage</div>
        </div>
      </div>

      {/* Timeline stepper */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {steps.map((step, i) => {
            const totalDur = 12
            const stepDelay = (i / steps.length) * totalDur
            const isCompleted = i < currentStep
            const isCurrent = i === currentStep

            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  position: 'relative', zIndex: 1,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700,
                    background: isCompleted || isCurrent
                      ? (isCurrent ? 'rgba(245,158,11,0.2)' : 'rgba(34,197,94,0.15)')
                      : 'rgba(255,255,255,0.05)',
                    color: isCompleted ? '#22c55e' : (isCurrent ? '#f59e0b' : '#64748b'),
                    border: `2px solid ${isCompleted ? 'rgba(34,197,94,0.3)' : (isCurrent ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.06)')}`,
                    animation: !isCompleted && !isCurrent ? `quality-step-light ${totalDur}s ease-in-out ${stepDelay}s infinite` : 'none',
                  }}>
                    {isCompleted ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <span>{i + 1}</span>
                    )}
                    {!isCompleted && !isCurrent && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"
                        style={{
                          position: 'absolute', opacity: 0, transform: 'scale(0)',
                          animation: `quality-check-appear ${totalDur}s ease-in-out ${stepDelay}s infinite`,
                        }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 600, color: isCompleted || isCurrent ? '#94a3b8' : '#475569',
                    whiteSpace: 'nowrap',
                  }}>{step}</span>
                </div>
                {i < steps.length - 1 && (
                  <div style={{
                    flex: 1, height: 2, marginBottom: 18,
                    background: isCompleted ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.06)',
                    borderRadius: 1, minWidth: 12,
                    animation: !isCompleted ? `quality-connector-fill ${totalDur}s ease-in-out ${stepDelay}s infinite` : 'none',
                  }}/>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: 16, padding: '16px 20px' }}>
        {/* Left: Investigation details */}
        <div style={{ flex: 1.2 }}>
          <div style={{
            background: 'rgba(30,41,59,0.8)', borderRadius: 10, padding: 16,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', marginBottom: 14 }}>
              Investigation Details
            </div>
            {[
              { label: 'Issue Source', value: 'IoT Telemetry Alert' },
              { label: 'Detection Method', value: 'Automated threshold monitoring' },
              { label: 'Category', value: 'Cold Chain Integrity' },
              { label: 'Severity', value: 'Major' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.label}</div>
                <div style={{ fontSize: 13, color: '#e2e8f0' }}>{f.value}</div>
              </div>
            ))}
            <div style={{ marginBottom: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 }}>Initial Findings</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                Temperature sensor TRK-4401 recorded readings above 6&deg;C threshold for approximately 47 minutes during highway segment I-94. Root cause identified as reefer unit compressor cycling failure during sustained ambient temps of 38&deg;C. Unit firmware was running v2.1 (outdated).
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div style={{ flex: 0.8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Linked shipment */}
          <div style={{
            background: 'rgba(30,41,59,0.8)', borderRadius: 10, padding: 14,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>Linked Shipment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Shipment', value: 'SHP-7842', color: '#3b82f6' },
                { label: 'Customer', value: 'Nordic Dairy Co.' },
                { label: 'Route', value: 'Minneapolis \u2192 Milwaukee' },
                { label: 'Carrier', value: 'Lineage Cool Chain' },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: '#64748b' }}>{f.label}</span>
                  <span style={{ color: f.color || '#94a3b8', fontWeight: f.color ? 600 : 400 }}>{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Temperature chart */}
          <div style={{
            background: 'rgba(30,41,59,0.8)', borderRadius: 10, padding: 14,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 10 }}>Temperature Log</div>
            <svg width="100%" height="120" viewBox="0 0 280 120" style={{ display: 'block' }}>
              {/* Grid lines */}
              {[20, 40, 60, 80, 100].map(y => (
                <line key={y} x1="30" y1={y} x2="270" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
              ))}
              {/* Y-axis labels */}
              <text x="24" y="24" textAnchor="end" fontSize="8" fill="#475569">8&#176;C</text>
              <text x="24" y="44" textAnchor="end" fontSize="8" fill="#475569">6&#176;C</text>
              <text x="24" y="64" textAnchor="end" fontSize="8" fill="#475569">4&#176;C</text>
              <text x="24" y="84" textAnchor="end" fontSize="8" fill="#475569">2&#176;C</text>
              <text x="24" y="104" textAnchor="end" fontSize="8" fill="#475569">0&#176;C</text>
              {/* Danger zone */}
              <rect x="30" y="20" width="240" height="20" fill="rgba(239,68,68,0.08)"
                style={{ animation: 'quality-excursion-pulse 3s ease-in-out infinite' }}/>
              <line x1="30" y1="40" x2="270" y2="40" stroke="rgba(239,68,68,0.4)" strokeWidth="1" strokeDasharray="4 2"/>
              <text x="272" y="43" fontSize="7" fill="#ef4444">Limit</text>
              {/* Temperature line */}
              <path
                d="M30 70 L55 68 L80 65 L105 62 L120 55 L135 42 L145 35 L155 32 L165 38 L175 48 L190 58 L210 62 L230 65 L250 63 L270 64"
                fill="none" stroke="#3b82f6" strokeWidth="2"
                strokeDasharray="300" strokeDashoffset="300"
                style={{ animation: 'quality-line-draw 3s ease-out forwards' }}
              />
              {/* Excursion highlight zone on the line */}
              <path
                d="M120 55 L135 42 L145 35 L155 32 L165 38 L175 48"
                fill="none" stroke="#ef4444" strokeWidth="2.5"
                strokeDasharray="100" strokeDashoffset="100"
                style={{ animation: 'quality-line-draw 2s ease-out 2s forwards' }}
              />
              {/* X-axis labels */}
              <text x="30" y="116" fontSize="7" fill="#475569">00:00</text>
              <text x="90" y="116" fontSize="7" fill="#475569">04:00</text>
              <text x="150" y="116" fontSize="7" fill="#475569">08:00</text>
              <text x="210" y="116" fontSize="7" fill="#475569">12:00</text>
              <text x="260" y="116" fontSize="7" fill="#475569">16:00</text>
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
