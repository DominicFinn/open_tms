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
            <div className="glow max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg mx-auto" style={{ display: 'inline-block', borderRadius: '2rem', padding: '4px' }}>
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

      {/* WMS Operations */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 mb-6">
                <span className="text-sm font-medium text-indigo-400">Warehouse Management System</span>
              </div>
              <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 800, lineHeight: 1.1 }}>
                <span className="text-white">Full warehouse operations.</span>{' '}
                <span className="gradient-text">Receive to dispatch.</span>
              </h2>
              <p className="mt-4 text-lg text-surface-400 max-w-2xl mx-auto">
                Beyond shipment launch, Open TMS includes a complete WMS covering the full goods flow inside the warehouse. Zone and bin management, directed putaway, wave-based picking, and inventory control.
              </p>
            </div>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Receiving', desc: 'Dock appointments, ASN-based and blind receiving with line-by-line inspection. Scan items at the dock, verify quantities, and record damage.', icon: 'M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3' },
              { title: 'Directed Putaway', desc: 'Priority-based routing rules match items to the right storage location. Scan-to-confirm with deviation tracking and temperature/hazmat constraint validation.', icon: 'M9 8.25H7.5a2.25 2.25 0 00-2.25 2.25v9a2.25 2.25 0 002.25 2.25h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25H15M9 12l3 3m0 0l3-3m-3 3V2.25' },
              { title: 'Wave Planning', desc: 'Group orders into pick waves with templates. Set carrier cutoff times, grouping rules, and auto-release schedules. Apply templates on demand or via cron.', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z' },
              { title: 'Optimized Picking', desc: 'Walk-sequence-optimized pick lists guide workers through the warehouse in the most efficient path. Discrete (per order) or batch (multi-order) strategies.', icon: 'M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z' },
              { title: 'Cycle Counting', desc: 'Full warehouse, zone, and random sample inventory counts. Automatic variance detection and inventory adjustment with immutable audit trail.', icon: 'M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 019 9v.375M10.125 2.25A3.375 3.375 0 0113.5 5.625v1.5c0 .621.504 1.125 1.125 1.125h1.5a3.375 3.375 0 013.375 3.375M9 15l2.25 2.25L15 12' },
              { title: 'Auto-Replenishment', desc: 'Configure min/max thresholds per SKU per pick face. When stock drops below minimum, the system auto-creates putaway tasks to pull from bulk storage.', icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182' },
              { title: 'Cross-Dock', desc: 'Flow-through workflow for high-velocity operations. Received goods skip storage entirely and sort directly to staging bins for outbound loading. Ideal for hub-and-spoke distribution.', icon: 'M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V7.5' },
              { title: 'Pack Audit', desc: 'Scale and dim-weight variance checks at the pack station. Expected weight auto-calculated from the SKU catalog; configurable tolerance (10% default) drives pass/warning/fail verdicts that auto-raise quality issues for investigation. Pass rate and failure counts surface on the pack audits dashboard.', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3' },
              { title: 'Cutoff At Risk', desc: 'Per-carrier, per-day cutoff times with timezone support. A 5-minute cron projects warehouse-ready time from remaining pick/pack/load work and auto-raises triage issues when a shipment is projected to miss the cutoff. Dedup and severity escalation keep alerts signal-heavy.', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
              { title: 'Operations KPI Dashboard', desc: 'Six KPI groups in one view: throughput today vs last 7 days, 30-day cycle times (pick, dock-to-stock, order-to-ship), quality (pick accuracy, pack audit pass rate, inventory record accuracy), live work queue, exceptions, and bin utilization. Tone-coloured thresholds and drill-downs to every operational page.', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
              { title: 'Pallet Types & Palletization', desc: 'Standard pallet catalogue with one-click seed of EUR1, EUR2, EUR3, EUR6 half, US GMA, CHEP 1210, CHEP 48×40, AU 1165, plastic and one-way export variants. Palletization planner computes cartons-per-layer, layers, stacked height and weight utilization. Recommender picks the best pallet type for a given carton.', icon: 'M3 8.25V18a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 18V8.25M3 8.25V5.625c0-.621.504-1.125 1.125-1.125h15.75c.621 0 1.125.504 1.125 1.125V8.25m-18 0h18M7.5 8.25v12M12 8.25v12m4.5-12v12' },
              { title: 'Container Intelligence', desc: 'Cartons gain temperature zone, insulation hours, hazmat UN classes, value class, tamper-evident and material fields. The recommender groups items by constraint profile, enforces a UN segregation matrix, picks the smallest qualifying carton per group, and attaches ancillaries (gel pack, dry ice, desiccant, fragile padding, tamper seal). Transit-hours aware cold-chain upgrades.', icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9' },
              { title: 'EDI 940 / 945 (3PL Shipping)', desc: 'Depositors send an EDI 940 Warehouse Shipping Order; we parse the full W05 / N1 / W01 / G62 / W66 structure and create the order automatically. On shipment.delivered, the 945 Warehouse Shipping Advice auto-sends back with W12 status codes (CC complete / PC partial / CN cancelled), W27 carrier + tracking, W03 totals, and line-level N9 for tracking, lot and customer refs. Both routed through the universal EDI inbound endpoint and Trading Partner delivery infrastructure.', icon: 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z' },
              { title: 'Load Planning & BOL', desc: 'Sequence outbound loads with reverse stop order (last stop loaded first). Record trailer seals and dock doors. Auto-generate Bill of Lading on load completion.', icon: 'M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12' },
              { title: 'Returns & RMA', desc: 'Full returns lifecycle with seven dispositions (restock, refurb, scrap, recycle, donate, rtv, customer_keeps). Quarantine-first flow protects inventory integrity. Auto-calculated refunds with finance review queue.', icon: 'M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3' },
              { title: 'Return Integration Channels', desc: 'Five entry points for creating returns: admin UI, customer portal self-service (list, request, detail with label download), public REST API (customer API keys), EDI 180 Return Merchandise Authorization inbound + outbound authorization response, and marketplace webhooks (roadmap). One unified command, different initiation sources.', icon: 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5' },
              { title: 'Return Labels & Pickups', desc: 'Generate prepaid return shipping labels and schedule carrier pickups straight from the RMA detail page. Provider-agnostic interface with a manual provider shipping in v1, plus wired stubs for FedEx, UPS, and DHL. Labels stored via binary storage, customers download through the public API.', icon: 'M16.5 8.25V6a2.25 2.25 0 00-2.25-2.25H6A2.25 2.25 0 003.75 6v8.25A2.25 2.25 0 006 16.5h2.25m8.25-8.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-7.5A2.25 2.25 0 018.25 18v-1.5m8.25-8.25h-6a2.25 2.25 0 00-2.25 2.25v6' },
              { title: 'Return Tasks on the Floor', desc: 'Warehouse mobile app surfaces returns as a dedicated Returns tab alongside picking and putaway. Workers scan an RMA to receive lines with per-line quantity input, then run a structured inspection pass (condition + one of seven dispositions per line) that auto-routes items from quarantine to putaway, refurb, scrap, or RTV.', icon: 'M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25' },
              { title: 'Mobile Receiving + Packing', desc: 'Scan-driven receiving on the warehouse floor: match ASN lines by SKU barcode or accept blind scans for walk-in freight; per-line received and damaged counts; pass/fail/quarantine inspection chips; auto-generates putaway tasks on complete. Packing flow verifies every picked item against the pack task, lets the worker pick the right carton from the intelligence-aware catalogue, and jumps straight into a pack audit when the last line is packed.', icon: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z' },
            ].map((item, i) => (
              <AnimateIn key={item.title} animation="fade-up" delay={i * 100}>
                <div className="glass-card p-6 h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(99,102,241,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                    </div>
                    <h3 className="text-white font-semibold">{item.title}</h3>
                  </div>
                  <p className="text-surface-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>

          <AnimateIn animation="fade-up" delay={600}>
            <div className="mt-8 text-center">
              <p className="text-surface-500 text-sm">318 command handler and service tests across 25 test suites covering the full warehouse goods flow</p>
            </div>
          </AnimateIn>
        </div>
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
