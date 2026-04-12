export default function MockupMap() {
  return (
    <div className="mockup-panel" style={{
      width: 340,
      borderRadius: 10,
      background: 'rgba(15,23,42,0.85)',
      border: '1px solid rgba(255,255,255,0.06)',
      padding: 10,
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: '#f59e0b' }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: '#e2e8f0', letterSpacing: 0.3 }}>LIVE TRACKING</span>
        <span style={{ fontSize: 7, color: '#22c55e', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span style={{ width: 4, height: 4, borderRadius: 2, background: '#22c55e', display: 'inline-block' }} />
          3 active
        </span>
      </div>

      {/* SVG Map */}
      <svg
        viewBox="0 0 320 180"
        style={{
          width: '100%',
          height: 160,
          borderRadius: 6,
          background: 'rgba(15,23,42,0.6)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        {/* Abstract US landmass shapes */}
        <path
          d="M30,60 Q60,40 120,50 Q180,35 240,45 Q280,50 300,65 Q290,90 260,100 Q220,120 160,110 Q100,115 60,100 Q35,90 30,60Z"
          fill="rgba(51,65,85,0.4)"
          stroke="rgba(100,116,139,0.2)"
          strokeWidth="0.5"
        />
        {/* Secondary landmass (peninsula/coast detail) */}
        <path
          d="M240,95 Q260,100 270,115 Q265,130 250,125 Q240,110 240,95Z"
          fill="rgba(51,65,85,0.3)"
          stroke="rgba(100,116,139,0.15)"
          strokeWidth="0.5"
        />

        {/* Grid lines for map feel */}
        {[50, 80, 110, 140].map((y) => (
          <line key={`h${y}`} x1="10" y1={y} x2="310" y2={y} stroke="rgba(100,116,139,0.06)" strokeWidth="0.5" />
        ))}
        {[60, 120, 180, 240].map((x) => (
          <line key={`v${x}`} x1={x} y1="20" x2={x} y2="160" stroke="rgba(100,116,139,0.06)" strokeWidth="0.5" />
        ))}

        {/* Route 1: Chicago to Dallas (blue) */}
        <path
          id="route1"
          d="M150,55 Q160,70 170,80 Q175,90 180,100 Q185,105 195,108"
          fill="none"
          stroke="rgba(59,130,246,0.4)"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />
        {/* Origin marker - Chicago */}
        <circle cx="150" cy="55" r="4" fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth="1" />
        <circle cx="150" cy="55" r="1.5" fill="#22c55e" />
        {/* Destination marker - Dallas */}
        <circle cx="195" cy="108" r="4" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1" />
        <circle cx="195" cy="108" r="1.5" fill="#ef4444" />

        {/* Route 2: Seattle to Denver (purple) */}
        <path
          id="route2"
          d="M60,45 Q90,48 120,55 Q145,60 170,65 Q190,68 210,62"
          fill="none"
          stroke="rgba(167,139,250,0.4)"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />
        {/* Origin - Seattle */}
        <circle cx="60" cy="45" r="4" fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth="1" />
        <circle cx="60" cy="45" r="1.5" fill="#22c55e" />
        {/* Destination - Denver */}
        <circle cx="210" cy="62" r="4" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1" />
        <circle cx="210" cy="62" r="1.5" fill="#ef4444" />

        {/* Route 3: Atlanta to Miami (amber) */}
        <path
          id="route3"
          d="M230,85 Q240,95 248,105 Q255,115 258,125"
          fill="none"
          stroke="rgba(245,158,11,0.4)"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />
        {/* Origin - Atlanta */}
        <circle cx="230" cy="85" r="4" fill="rgba(34,197,94,0.3)" stroke="#22c55e" strokeWidth="1" />
        <circle cx="230" cy="85" r="1.5" fill="#22c55e" />
        {/* Destination - Miami */}
        <circle cx="258" cy="125" r="4" fill="rgba(239,68,68,0.3)" stroke="#ef4444" strokeWidth="1" />
        <circle cx="258" cy="125" r="1.5" fill="#ef4444" />

        {/* Animated dot traveling route 1 */}
        <circle r="3" fill="#3b82f6" opacity="0.9">
          <animateMotion dur="12s" repeatCount="indefinite">
            <mpath href="#route1" />
          </animateMotion>
        </circle>
        {/* Pulse ring on traveling dot */}
        <circle r="3" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.4">
          <animateMotion dur="12s" repeatCount="indefinite">
            <mpath href="#route1" />
          </animateMotion>
          <animate attributeName="r" values="3;7;3" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Animated dot traveling route 2 */}
        <circle r="2.5" fill="#a78bfa" opacity="0.9">
          <animateMotion dur="15s" repeatCount="indefinite">
            <mpath href="#route2" />
          </animateMotion>
        </circle>

        {/* Animated dot traveling route 3 */}
        <circle r="2.5" fill="#f59e0b" opacity="0.9">
          <animateMotion dur="10s" repeatCount="indefinite">
            <mpath href="#route3" />
          </animateMotion>
        </circle>

        {/* Legend */}
        <rect x="10" y="145" width="75" height="28" rx="4" fill="rgba(15,23,42,0.8)" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
        <circle cx="20" cy="154" r="2.5" fill="#22c55e" />
        <text x="26" y="156" fontSize="6" fill="#94a3b8">Origin</text>
        <circle cx="55" cy="154" r="2.5" fill="#ef4444" />
        <text x="61" y="156" fontSize="6" fill="#94a3b8">Dest</text>
        <circle cx="20" cy="166" r="2.5" fill="#3b82f6" />
        <text x="26" y="168" fontSize="6" fill="#94a3b8">In Transit</text>
      </svg>
    </div>
  )
}
