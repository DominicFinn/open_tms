import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import WarehousePreview from '../../components/previews/WarehousePreview'

const problems = [
  {
    problem: 'Warehouse staff are juggling paper checklists to launch shipments',
    solution: 'Mobile-first launch app',
    description: 'A dedicated mobile interface designed for warehouse floor use. No training manual needed  - scan a QR code to log in, see your assigned shipments, and work through a guided pre-flight checklist before each launch. Touch-friendly, fast, and works on any device with a browser.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    color: '#f59e0b',
  },
  {
    problem: 'IoT devices get swapped between shipments with no record of which unit has which tracker',
    solution: 'IoT device pairing',
    description: 'Scan a device barcode, pair it to a shipment, and the system tracks the association. When the shipment delivers, the device is automatically released. Full device-to-shipment history means you always know which tracker was on which load  - critical for cold chain compliance.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546M5.106 18.894c-3.808-3.808-3.808-9.98 0-13.789m13.788 0c3.808 3.808 3.808 9.981 0 13.79M12 12h.008v.007H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
      </svg>
    ),
    color: '#10b981',
  },
  {
    problem: 'You can\'t track what\'s actually on the truck  - just that "something" shipped',
    solution: 'Pallet & unit-level tracking',
    description: 'Track cargo at the pallet, tote, and box level. Scan barcodes to build a cargo manifest, reconcile against the order, and detect misdrops at every stop. When a customer asks "which pallet is my order on?", you have the answer instantly.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    color: '#6366f1',
  },
  {
    problem: 'Shipments leave the dock without temperature loggers, accessories, or proper documentation',
    solution: 'Pre-flight checklists',
    description: 'Configurable checklists that must be completed before a shipment can launch. Verify IoT devices are paired and reading, accessories are attached, documentation is present, and cargo counts match. Block launch if any check fails  - catch problems at the dock, not at delivery.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
      </svg>
    ),
    color: '#ec4899',
  },
]

const workflow = [
  { step: '1', title: 'Scan QR to log in', description: 'Magic link authentication  - no passwords to remember on the warehouse floor' },
  { step: '2', title: 'Select shipment', description: 'See assigned shipments with origin, destination, and cargo summary' },
  { step: '3', title: 'Pair IoT devices', description: 'Scan tracker barcodes to associate GPS, temperature, and humidity sensors' },
  { step: '4', title: 'Build cargo manifest', description: 'Scan pallets, totes, and boxes to build and reconcile the cargo list' },
  { step: '5', title: 'Complete pre-flight', description: 'Work through the checklist  - sensors reading, accessories attached, docs present' },
  { step: '6', title: 'Launch', description: 'Shipment status flips to In Transit and monitoring begins automatically' },
]

export default function Warehouse() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero with centered phone preview */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-600/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          <AnimateIn animation="fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 mb-6">
              <span className="text-sm font-medium text-amber-400">Warehouse App</span>
            </div>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={100}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 mx-auto max-w-4xl">
              Launch shipments right.
              <br />
              <span className="gradient-text">Every single time.</span>
            </h1>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={200}>
            <p className="text-xl text-surface-300 leading-relaxed max-w-3xl mx-auto mb-12">
              A mobile-first warehouse app that turns shipment launch from a paper-and-guesswork
              process into a guided, scannable, checklistable workflow. Pair IoT devices, build
              cargo manifests, and verify everything before the truck leaves the dock.
            </p>
          </AnimateIn>

          <AnimateIn animation="scale-up" delay={350}>
            <div className="glow" style={{ display: 'inline-block', borderRadius: '2rem', padding: '4px' }}>
              <WarehousePreview />
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Problem cards as offset grid */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-12 text-center">Problems we solve</h2>
          </AnimateIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: '1.5rem',
              alignItems: 'start',
            }}
          >
            {/* Card 1 - larger, top-left */}
            <AnimateIn animation="fade-up" delay={100} className="col-span-12 lg:col-span-7">
              <div className="feature-card glass-card rounded-2xl p-8 lg:p-10 h-full" style={{ borderLeft: `3px solid ${problems[0].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${problems[0].color}20`, color: problems[0].color }}>
                  {problems[0].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{problems[0].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{problems[0].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{problems[0].description}</p>
              </div>
            </AnimateIn>

            {/* Card 2 - smaller, top-right */}
            <AnimateIn animation="fade-up" delay={200} className="col-span-12 lg:col-span-5">
              <div className="feature-card glass-card rounded-2xl p-8 h-full" style={{ borderLeft: `3px solid ${problems[1].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${problems[1].color}20`, color: problems[1].color }}>
                  {problems[1].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{problems[1].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{problems[1].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{problems[1].description}</p>
              </div>
            </AnimateIn>

            {/* Card 3 - smaller, bottom-left */}
            <AnimateIn animation="fade-up" delay={300} className="col-span-12 lg:col-span-5">
              <div className="feature-card glass-card rounded-2xl p-8 h-full" style={{ borderLeft: `3px solid ${problems[2].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${problems[2].color}20`, color: problems[2].color }}>
                  {problems[2].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{problems[2].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{problems[2].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{problems[2].description}</p>
              </div>
            </AnimateIn>

            {/* Card 4 - larger, bottom-right */}
            <AnimateIn animation="fade-up" delay={400} className="col-span-12 lg:col-span-7">
              <div className="feature-card glass-card rounded-2xl p-8 lg:p-10 h-full" style={{ borderLeft: `3px solid ${problems[3].color}` }}>
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4" style={{ backgroundColor: `${problems[3].color}20`, color: problems[3].color }}>
                  {problems[3].icon}
                </div>
                <p className="text-surface-400 text-sm italic mb-3">&ldquo;{problems[3].problem}&rdquo;</p>
                <h3 className="text-xl font-bold text-white mb-3">{problems[3].solution}</h3>
                <p className="text-surface-300 leading-relaxed">{problems[3].description}</p>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* The launch workflow - connected horizontal journey */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-16 text-center">The launch workflow</h2>
          </AnimateIn>

          {/* Desktop: horizontal subway map */}
          <div className="hidden lg:block">
            <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
              {workflow.map((w, i) => (
                <AnimateIn key={w.step} animation="fade-up" delay={i * 150} className="flex-1">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {/* Connecting line */}
                    {i < workflow.length - 1 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '20px',
                          left: '50%',
                          width: '100%',
                          height: '2px',
                          background: 'linear-gradient(90deg, rgba(245,158,11,0.6), rgba(245,158,11,0.2))',
                          zIndex: 0,
                        }}
                      />
                    )}
                    {/* Node circle */}
                    <div
                      style={{
                        position: 'relative',
                        zIndex: 1,
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))',
                        border: '2px solid rgba(245,158,11,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#f59e0b',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        marginBottom: '1rem',
                        boxShadow: '0 0 20px rgba(245,158,11,0.15)',
                      }}
                    >
                      {w.step}
                    </div>
                    <h3 className="text-sm font-semibold text-white mb-1 text-center">{w.title}</h3>
                    <p className="text-surface-400 text-xs leading-relaxed text-center px-2">{w.description}</p>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>

          {/* Mobile: vertical subway map */}
          <div className="lg:hidden">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {workflow.map((w, i) => (
                <AnimateIn key={w.step} animation="slide-right" delay={i * 100}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', position: 'relative' }}>
                    {/* Node + vertical line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))',
                          border: '2px solid rgba(245,158,11,0.5)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f59e0b',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          boxShadow: '0 0 20px rgba(245,158,11,0.15)',
                        }}
                      >
                        {w.step}
                      </div>
                      {i < workflow.length - 1 && (
                        <div
                          style={{
                            width: '2px',
                            height: '48px',
                            background: 'linear-gradient(180deg, rgba(245,158,11,0.5), rgba(245,158,11,0.1))',
                          }}
                        />
                      )}
                    </div>
                    {/* Text */}
                    <div style={{ paddingTop: '6px', paddingBottom: '2rem' }}>
                      <h3 className="text-sm font-semibold text-white mb-1">{w.title}</h3>
                      <p className="text-surface-400 text-xs leading-relaxed">{w.description}</p>
                    </div>
                  </div>
                </AnimateIn>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Full-width testimonial-style band */}
      <section className="pb-24">
        <AnimateIn animation="fade-up">
          <div
            className="glass-card"
            style={{
              padding: '4rem 2rem',
              textAlign: 'center',
              borderRadius: 0,
              borderLeft: 'none',
              borderRight: 'none',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.03), rgba(245,158,11,0.05))',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="mx-auto max-w-4xl">
              <svg className="h-10 w-10 mx-auto mb-6 text-amber-500/40" fill="currentColor" viewBox="0 0 24 24">
                <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11h4v10H0z" />
              </svg>
              <blockquote
                style={{
                  fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                  fontWeight: 700,
                  lineHeight: 1.3,
                  color: 'white',
                  fontStyle: 'italic',
                }}
              >
                Catch problems at the dock,
                <br />
                <span className="gradient-text">not at delivery.</span>
              </blockquote>
            </div>
          </div>
        </AnimateIn>
      </section>

      {/* MissingFeature */}
      <section className="pb-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MissingFeature />
        </div>
      </section>

      {/* CTA */}
      <section className="pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
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
                to="/features/operations"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:-translate-y-0.5"
              >
                Explore Operations
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
