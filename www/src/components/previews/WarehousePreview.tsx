const checklistItems = [
  { label: 'IoT device paired (TRK-4401)', checked: true },
  { label: 'Temperature sensor reading (2.1\u00b0C)', checked: true },
  { label: 'GPS signal acquired', checked: true },
  { label: 'Cargo manifest verified (12 pallets)', checked: true },
  { label: 'Pre-flight checklist complete', checked: false, animating: true },
  { label: 'Documentation attached', checked: false },
]

export default function WarehousePreview() {
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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <style>{`
        @keyframes wh-check-tick {
          0%, 70% { transform: scale(0); opacity: 0; }
          80% { transform: scale(1.3); opacity: 1; }
          90% { transform: scale(0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes wh-check-bg {
          0%, 70% { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.1); }
          80%, 100% { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.4); }
        }
        @keyframes wh-row-highlight {
          0%, 70% { background: transparent; }
          75% { background: rgba(34,197,94,0.08); }
          100% { background: transparent; }
        }
        @keyframes wh-button-pulse {
          0%, 75% { opacity: 0.5; transform: scale(1); box-shadow: none; }
          80%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 20px rgba(59,130,246,0.3); }
        }
        @keyframes wh-progress {
          0% { width: 66%; }
          70% { width: 66%; }
          80%, 100% { width: 83%; }
        }
        @keyframes wh-signal-dot {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes wh-notch-glow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>

      {/* Phone frame */}
      <div style={{
        width: 300,
        height: 580,
        borderRadius: 36,
        background: 'linear-gradient(145deg, #1e293b, #0f172a)',
        border: '3px solid rgba(255,255,255,0.08)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        position: 'relative' as const,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column' as const,
      }}>
        {/* Notch */}
        <div style={{
          position: 'absolute' as const, top: 0, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 28, borderRadius: '0 0 16px 16px',
          background: '#0f172a', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
            boxShadow: '0 0 4px rgba(59,130,246,0.3)',
            animation: 'wh-notch-glow 3s ease-in-out infinite',
          }}/>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}/>
        </div>

        {/* Status bar */}
        <div style={{
          padding: '36px 20px 8px', display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: '#64748b', fontWeight: 600,
        }}>
          <span>9:41</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{
                width: 3, height: 4 + i * 2, borderRadius: 1,
                background: i <= 3 ? '#64748b' : 'rgba(255,255,255,0.1)',
                animation: i === 3 ? 'wh-signal-dot 2s ease-in-out infinite' : 'none',
              }}/>
            ))}
            <div style={{ marginLeft: 4, width: 18, height: 9, borderRadius: 2, border: '1px solid #64748b', position: 'relative' as const }}>
              <div style={{ position: 'absolute' as const, inset: 2, borderRadius: 1, background: '#22c55e', width: '60%' }}/>
            </div>
          </div>
        </div>

        {/* App header */}
        <div style={{
          padding: '12px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Launch Shipment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#3b82f6',
            }}>SHP-7842</span>
            <span style={{ fontSize: 10, color: '#64748b' }}>&bull; Nordic Dairy Co.</span>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ padding: '12px 20px 6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>Pre-launch checklist</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8' }}>4/6</span>
          </div>
          <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, #3b82f6, #22c55e)',
              animation: 'wh-progress 10s ease-in-out infinite',
            }}/>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ flex: 1, padding: '8px 20px', overflowY: 'auto' as const }}>
          {checklistItems.map((item, i) => {
            const isAnimating = item.animating
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
                animation: isAnimating ? 'wh-row-highlight 10s ease-in-out infinite' : 'none',
              }}>
                {/* Checkbox */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: item.checked ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `2px solid ${item.checked ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  transition: 'all 0.3s ease',
                  ...(isAnimating ? { animation: 'wh-check-bg 10s ease-in-out infinite' } : {}),
                }}>
                  {item.checked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                  )}
                  {isAnimating && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3"
                      style={{ animation: 'wh-check-tick 10s ease-in-out infinite' }}>
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  )}
                </div>
                {/* Label */}
                <div>
                  <div style={{
                    fontSize: 13, color: item.checked ? '#94a3b8' : '#e2e8f0',
                    textDecoration: item.checked ? 'line-through' : 'none',
                    fontWeight: item.checked ? 400 : 500,
                  }}>{item.label}</div>
                  {item.checked && (
                    <div style={{ fontSize: 10, color: '#22c55e', marginTop: 1 }}>Verified</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Bottom button */}
        <div style={{ padding: '12px 20px 24px' }}>
          <div style={{
            width: '100%', height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            fontSize: 15, fontWeight: 700, color: '#fff',
            animation: 'wh-button-pulse 10s ease-in-out infinite',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
            Launch Shipment
          </div>
          <div style={{ textAlign: 'center' as const, fontSize: 10, color: '#475569', marginTop: 8 }}>
            All checks must pass before launch
          </div>
        </div>

        {/* Home indicator */}
        <div style={{
          position: 'absolute' as const, bottom: 6, left: '50%', transform: 'translateX(-50%)',
          width: 100, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)',
        }}/>
      </div>
    </div>
  )
}
