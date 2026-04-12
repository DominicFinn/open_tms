import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import OperationsPreview from '../../components/previews/OperationsPreview'
import LiveActivityFeed from '../../components/previews/LiveActivityFeed'

const sections = [
  {
    problem: 'You\'re running shipments across spreadsheets, emails, and three different portals',
    solution: 'Single pane of glass',
    description: 'Every shipment, order, carrier assignment, and status update lives in one place. Search, filter, and act on your entire operation from a unified dashboard  - no more tab-switching between carrier portals.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="20" y="20" width="240" height="160" rx="12" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" fill="rgba(139,92,246,0.05)" />
        <rect x="36" y="44" width="100" height="56" rx="8" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
        <rect x="144" y="44" width="100" height="56" rx="8" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
        <rect x="36" y="112" width="208" height="48" rx="8" fill="rgba(139,92,246,0.1)" stroke="rgba(139,92,246,0.2)" strokeWidth="1" />
        <circle cx="60" cy="72" r="10" fill="rgba(99,102,241,0.3)" />
        <rect x="78" y="64" width="48" height="6" rx="3" fill="rgba(99,102,241,0.25)" />
        <rect x="78" y="76" width="32" height="4" rx="2" fill="rgba(99,102,241,0.15)" />
        <circle cx="168" cy="72" r="10" fill="rgba(59,130,246,0.3)" />
        <rect x="186" y="64" width="48" height="6" rx="3" fill="rgba(59,130,246,0.25)" />
        <rect x="186" y="76" width="32" height="4" rx="2" fill="rgba(59,130,246,0.15)" />
        <rect x="52" y="128" width="60" height="6" rx="3" fill="rgba(139,92,246,0.2)" />
        <rect x="52" y="140" width="40" height="4" rx="2" fill="rgba(139,92,246,0.12)" />
        <circle cx="160" cy="136" r="14" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" fill="none" />
        <path d="M156 136 l3 3 l5 -5" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    problem: 'Carrier selection is manual, slow, and based on whoever answers the phone first',
    solution: 'Automated carrier tendering',
    description: 'Create a tender in minutes, not hours. Choose broadcast (all carriers at once) or waterfall (sequential with auto-escalation on timeout). Carriers bid through their own portal or via EDI 204/990  - you compare rates and award with one click.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <circle cx="140" cy="60" r="24" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" fill="rgba(99,102,241,0.1)" />
        <path d="M134 60 l4 4 l8 -8" stroke="rgba(99,102,241,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="60" cy="150" r="20" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" fill="rgba(59,130,246,0.08)" />
        <circle cx="140" cy="170" r="20" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" fill="rgba(139,92,246,0.08)" />
        <circle cx="220" cy="150" r="20" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" fill="rgba(59,130,246,0.08)" />
        <line x1="125" y1="80" x2="72" y2="134" stroke="rgba(99,102,241,0.2)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="140" y1="84" x2="140" y2="150" stroke="rgba(99,102,241,0.2)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="155" y1="80" x2="208" y2="134" stroke="rgba(99,102,241,0.2)" strokeWidth="1" strokeDasharray="4 4" />
        <rect x="44" y="143" width="32" height="6" rx="3" fill="rgba(59,130,246,0.25)" />
        <rect x="124" y="163" width="32" height="6" rx="3" fill="rgba(139,92,246,0.25)" />
        <rect x="204" y="143" width="32" height="6" rx="3" fill="rgba(59,130,246,0.25)" />
        <text x="140" y="64" textAnchor="middle" fill="rgba(99,102,241,0.0)" fontSize="10">T</text>
      </svg>
    ),
  },
  {
    problem: 'You don\'t know a shipment is late until the customer calls you',
    solution: 'Traffic-aware ETA monitoring',
    description: 'Real-time GPS tracking with adaptive polling  - checking more frequently as delivery approaches. Delay severity escalation (minor to warning to critical) triggers automatic alerts before your customers even notice. Supports TomTom, HERE, and self-hosted Valhalla routing.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <path d="M30 160 Q80 140 120 100 Q160 60 200 80 Q240 100 260 50" stroke="rgba(99,102,241,0.4)" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="120" cy="100" r="6" fill="rgba(99,102,241,0.5)" />
        <circle cx="200" cy="80" r="6" fill="rgba(139,92,246,0.5)" />
        <circle cx="260" cy="50" r="6" fill="rgba(59,130,246,0.5)" />
        <circle cx="120" cy="100" r="18" stroke="rgba(99,102,241,0.15)" strokeWidth="1" fill="none" />
        <circle cx="120" cy="100" r="30" stroke="rgba(99,102,241,0.08)" strokeWidth="1" fill="none" />
        <rect x="30" y="168" width="40" height="4" rx="2" fill="rgba(99,102,241,0.15)" />
        <rect x="80" y="168" width="40" height="4" rx="2" fill="rgba(99,102,241,0.12)" />
        <rect x="130" y="168" width="40" height="4" rx="2" fill="rgba(139,92,246,0.15)" />
        <rect x="180" y="168" width="40" height="4" rx="2" fill="rgba(139,92,246,0.12)" />
        <rect x="230" y="168" width="30" height="4" rx="2" fill="rgba(59,130,246,0.15)" />
        <line x1="30" y1="164" x2="260" y2="164" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      </svg>
    ),
  },
  {
    problem: 'EDI integration takes months and costs six figures with your current TMS',
    solution: 'Built-in EDI suite',
    description: 'Full X12 support out of the box: 850 (Purchase Orders), 856 (ASN), 204 (Load Tenders), 990 (Tender Responses), 214 (Status Updates), 997 (Acknowledgments). One unified trading partner model handles SFTP and HTTP delivery in both directions.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="30" y="40" width="80" height="120" rx="8" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" fill="rgba(99,102,241,0.05)" />
        <rect x="170" y="40" width="80" height="120" rx="8" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" fill="rgba(139,92,246,0.05)" />
        <path d="M110 75 l30 0" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" markerEnd="url(#arrowR)" />
        <path d="M170 125 l-30 0" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" markerEnd="url(#arrowL)" />
        <defs>
          <marker id="arrowR" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6" fill="rgba(99,102,241,0.4)" />
          </marker>
          <marker id="arrowL" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
            <path d="M6 0 L0 3 L6 6" fill="rgba(139,92,246,0.4)" />
          </marker>
        </defs>
        <rect x="44" y="56" width="52" height="6" rx="3" fill="rgba(99,102,241,0.2)" />
        <rect x="44" y="68" width="36" height="4" rx="2" fill="rgba(99,102,241,0.12)" />
        <rect x="44" y="80" width="44" height="4" rx="2" fill="rgba(99,102,241,0.12)" />
        <rect x="44" y="100" width="52" height="6" rx="3" fill="rgba(99,102,241,0.2)" />
        <rect x="44" y="112" width="36" height="4" rx="2" fill="rgba(99,102,241,0.12)" />
        <rect x="184" y="56" width="52" height="6" rx="3" fill="rgba(139,92,246,0.2)" />
        <rect x="184" y="68" width="36" height="4" rx="2" fill="rgba(139,92,246,0.12)" />
        <rect x="184" y="80" width="44" height="4" rx="2" fill="rgba(139,92,246,0.12)" />
        <rect x="184" y="100" width="52" height="6" rx="3" fill="rgba(139,92,246,0.2)" />
        <rect x="184" y="112" width="36" height="4" rx="2" fill="rgba(139,92,246,0.12)" />
      </svg>
    ),
  },
  {
    problem: 'A driver takes a wrong turn or skips a stop and nobody notices until the customer calls',
    solution: 'Route deviation alerts',
    description: 'Define planned routes per lane using Google Maps with drag-to-adjust editing and hub-and-spoke waypoints. The system continuously compares GPS positions against the planned path and alerts when shipments stray beyond a configurable corridor. Warning and critical severity levels trigger automatic exceptions and triage agent evaluation. No Google Maps key? The feature gracefully disables itself - no errors, no broken UI.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        {/* Planned route */}
        <path d="M30 160 Q80 120 140 100 Q200 80 250 40" stroke="rgba(99,102,241,0.4)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Corridor boundary */}
        <path d="M30 140 Q80 100 140 80 Q200 60 250 20" stroke="rgba(99,102,241,0.1)" strokeWidth="1" fill="none" strokeDasharray="4 4" />
        <path d="M30 180 Q80 140 140 120 Q200 100 250 60" stroke="rgba(99,102,241,0.1)" strokeWidth="1" fill="none" strokeDasharray="4 4" />
        {/* On-route truck */}
        <circle cx="140" cy="100" r="5" fill="rgba(34,197,94,0.6)" />
        <circle cx="140" cy="100" r="12" stroke="rgba(34,197,94,0.2)" strokeWidth="1" fill="none" />
        {/* Deviated truck */}
        <circle cx="200" cy="140" r="5" fill="rgba(239,68,68,0.7)" />
        <circle cx="200" cy="140" r="12" stroke="rgba(239,68,68,0.3)" strokeWidth="1.5" fill="none" />
        <circle cx="200" cy="140" r="22" stroke="rgba(239,68,68,0.15)" strokeWidth="1" fill="none" />
        {/* Deviation line */}
        <line x1="200" y1="80" x2="200" y2="128" stroke="rgba(239,68,68,0.3)" strokeWidth="1" strokeDasharray="3 3" />
        {/* Origin marker */}
        <circle cx="30" cy="160" r="6" fill="rgba(34,197,94,0.4)" stroke="rgba(34,197,94,0.6)" strokeWidth="1.5" />
        {/* Destination marker */}
        <circle cx="250" cy="40" r="6" fill="rgba(99,102,241,0.4)" stroke="rgba(99,102,241,0.6)" strokeWidth="1.5" />
        {/* Alert badge */}
        <rect x="210" y="128" width="48" height="18" rx="9" fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.4)" strokeWidth="1" />
        <text x="234" y="140" textAnchor="middle" fill="rgba(239,68,68,0.8)" fontSize="8" fontWeight="600">OFF ROUTE</text>
      </svg>
    ),
  },
  {
    problem: 'Your IoT data is trapped in a vendor dashboard you can\'t query or act on',
    solution: 'Integrated IoT & sensor telemetry',
    description: 'GPS, temperature, humidity, shock, and light sensor data flows directly into your shipment records. Set thresholds, trigger automatic exceptions, and generate compliance breadcrumb reports  - all without leaving the TMS.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <circle cx="140" cy="100" r="50" stroke="rgba(99,102,241,0.15)" strokeWidth="1" fill="none" />
        <circle cx="140" cy="100" r="35" stroke="rgba(99,102,241,0.2)" strokeWidth="1" fill="none" />
        <circle cx="140" cy="100" r="20" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" fill="rgba(99,102,241,0.08)" />
        <circle cx="140" cy="100" r="4" fill="rgba(99,102,241,0.6)" />
        <circle cx="80" cy="60" r="12" stroke="rgba(59,130,246,0.3)" strokeWidth="1" fill="rgba(59,130,246,0.08)" />
        <rect x="72" y="56" width="16" height="3" rx="1.5" fill="rgba(59,130,246,0.3)" />
        <rect x="76" y="62" width="8" height="3" rx="1.5" fill="rgba(59,130,246,0.2)" />
        <circle cx="200" cy="60" r="12" stroke="rgba(139,92,246,0.3)" strokeWidth="1" fill="rgba(139,92,246,0.08)" />
        <path d="M195 60 l5 -4 l5 8 l5 -6 l2 2" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="80" cy="150" r="12" stroke="rgba(139,92,246,0.3)" strokeWidth="1" fill="rgba(139,92,246,0.08)" />
        <path d="M76 150 a4 4 0 1 1 8 0" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <line x1="80" y1="150" x2="82" y2="146" stroke="rgba(139,92,246,0.4)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="200" cy="150" r="12" stroke="rgba(59,130,246,0.3)" strokeWidth="1" fill="rgba(59,130,246,0.08)" />
        <circle cx="200" cy="150" r="3" fill="rgba(59,130,246,0.3)" />
        <circle cx="200" cy="150" r="7" stroke="rgba(59,130,246,0.2)" strokeWidth="1" fill="none" />
        <line x1="92" y1="66" x2="122" y2="84" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="188" y1="66" x2="158" y2="84" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="92" y1="144" x2="122" y2="116" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="188" y1="144" x2="158" y2="116" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
      </svg>
    ),
  },
  {
    problem: 'Documents are created manually and live in email threads nobody can find',
    solution: 'Automated document generation',
    description: 'Handlebars-based templates for BOLs, shipping labels, customs forms, and daily operations reports. Documents generate automatically at the right point in the shipment lifecycle and store in S3-compatible storage with 10-year retention.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="80" y="20" width="120" height="160" rx="8" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" fill="rgba(99,102,241,0.05)" />
        <rect x="96" y="40" width="88" height="8" rx="4" fill="rgba(99,102,241,0.2)" />
        <rect x="96" y="56" width="60" height="4" rx="2" fill="rgba(99,102,241,0.12)" />
        <rect x="96" y="66" width="72" height="4" rx="2" fill="rgba(99,102,241,0.1)" />
        <rect x="96" y="76" width="48" height="4" rx="2" fill="rgba(99,102,241,0.1)" />
        <line x1="96" y1="90" x2="184" y2="90" stroke="rgba(99,102,241,0.15)" strokeWidth="1" />
        <rect x="96" y="100" width="88" height="24" rx="4" fill="rgba(139,92,246,0.08)" stroke="rgba(139,92,246,0.2)" strokeWidth="1" />
        <rect x="104" y="108" width="40" height="4" rx="2" fill="rgba(139,92,246,0.2)" />
        <rect x="152" y="108" width="24" height="4" rx="2" fill="rgba(139,92,246,0.15)" />
        <rect x="96" y="132" width="88" height="24" rx="4" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.2)" strokeWidth="1" />
        <rect x="104" y="140" width="40" height="4" rx="2" fill="rgba(59,130,246,0.2)" />
        <rect x="152" y="140" width="24" height="4" rx="2" fill="rgba(59,130,246,0.15)" />
        <path d="M40 80 l20 0 l0 -20 l20 20 l-20 0 l0 20 z" stroke="rgba(99,102,241,0.2)" strokeWidth="1" fill="rgba(99,102,241,0.05)" strokeLinejoin="round" />
        <path d="M220 120 l12 -8 l0 16 z" fill="rgba(139,92,246,0.2)" />
        <path d="M236 112 l12 0 l0 16 l-12 0" stroke="rgba(139,92,246,0.2)" strokeWidth="1" fill="rgba(139,92,246,0.05)" />
      </svg>
    ),
  },
]

const stats = [
  { value: '6', label: 'EDI Types' },
  { value: '3', label: 'Routing Engines' },
  { value: 'Real-time', label: 'GPS' },
  { value: 'Adaptive', label: 'Polling' },
]

export default function Operations() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero with preview behind */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-600/8 blur-[100px]" />

        {/* Preview as background  - subtle */}
        <div className="absolute inset-0 hidden lg:flex items-center justify-center pointer-events-none" style={{ zIndex: 0 }}>
          <div style={{
            opacity: 0.4,
            transform: 'scale(1.2)',
            width: '100%',
            maxWidth: 1600,
            maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 70%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 70%, transparent 100%)',
          }}>
            <OperationsPreview />
          </div>
        </div>

        {/* Live activity feed  - right side */}
        <div className="absolute top-0 right-0 bottom-0 hidden lg:flex items-center pointer-events-none" style={{
          zIndex: 1,
          paddingRight: 24,
          opacity: 0.55,
          maskImage: 'linear-gradient(to bottom, transparent 5%, black 20%, black 75%, transparent 95%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 5%, black 20%, black 75%, transparent 95%)',
        }}>
          <LiveActivityFeed />
        </div>

        {/* Bottom fade over preview */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-surface-950 to-transparent" style={{ zIndex: 1 }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-20 flex flex-col items-center text-center" style={{ zIndex: 2 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          {/* Hero text in a card for contrast against the background preview */}
          <div className="glass-card rounded-2xl p-8 lg:p-10 max-w-3xl" style={{ backdropFilter: 'blur(16px)' }}>
            <AnimateIn animation="fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-6">
                <span className="text-sm font-medium text-primary-300">Operations App</span>
              </div>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                Stop managing logistics.
                <br />
                <span className="gradient-text">Start commanding them.</span>
              </h1>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={200}>
              <p className="text-xl text-surface-300 leading-relaxed">
                The Operations app is your command centre for every shipment, carrier, and delivery.
                Built for operations teams who are tired of stitching together spreadsheets, carrier
                portals, and EDI translators just to move freight.
              </p>
            </AnimateIn>
          </div>
        </div>

      </section>

      {/* Alternating Split Sections */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-32">
            {sections.map((item, i) => {
              const isImageLeft = i % 2 === 0
              return (
                <div key={i} className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                  {/* Illustration side */}
                  <AnimateIn
                    animation={isImageLeft ? 'slide-right' : 'slide-left'}
                    delay={100}
                    className={isImageLeft ? 'order-1' : 'order-1 lg:order-2'}
                  >
                    <div
                      className="glass-card rounded-2xl p-8 lg:p-12"
                      style={{ aspectRatio: '7/5' }}
                    >
                      <div className="flex items-center justify-center h-full">
                        {item.illustration}
                      </div>
                    </div>
                  </AnimateIn>

                  {/* Text side */}
                  <AnimateIn
                    animation={isImageLeft ? 'slide-left' : 'slide-right'}
                    delay={200}
                    className={isImageLeft ? 'order-2' : 'order-2 lg:order-1'}
                  >
                    <div>
                      <p className="text-surface-400 text-sm italic mb-4 leading-relaxed">
                        &ldquo;{item.problem}&rdquo;
                      </p>
                      <h3 className="text-2xl lg:text-3xl font-bold text-white mb-6">
                        {item.solution}
                      </h3>
                      <p className="text-surface-300 leading-relaxed text-lg">
                        {item.description}
                      </p>
                    </div>
                  </AnimateIn>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Parallax-style Stat Band */}
      <section
        className="relative py-24 overflow-hidden"
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(99,102,241,0.08) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(139,92,246,0.08) 0%, transparent 50%)',
          backgroundAttachment: 'fixed',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundAttachment: 'fixed',
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <div
              className="rounded-2xl border border-white/10 p-10 lg:p-14"
              style={{
                background: 'rgba(15, 15, 35, 0.6)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                {stats.map((stat, i) => (
                  <AnimateIn key={i} animation="fade-up" delay={i * 120}>
                    <div className="text-center">
                      <div className="text-3xl sm:text-4xl lg:text-5xl font-bold gradient-text mb-2">
                        {stat.value}
                      </div>
                      <div className="text-surface-400 text-sm sm:text-base font-medium tracking-wide uppercase">
                        {stat.label}
                      </div>
                    </div>
                  </AnimateIn>
                ))}
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      <MissingFeature />

      {/* CTA */}
      <section className="pb-32">
        <AnimateIn animation="scale-up">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to take control?</h2>
            <p className="text-surface-400 mb-8 text-lg">Deploy Open TMS in minutes with Docker. Your operations team will thank you.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="https://github.com/dominicfinn/open_tms#-quick-start"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-500 hover:-translate-y-0.5"
              >
                Deploy Now
              </a>
              <Link
                to="/features/triage"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:-translate-y-0.5"
              >
                Explore Triage Centre
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </AnimateIn>
      </section>
    </div>
  )
}
