import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import ReportsPreview from '../../components/previews/ReportsPreview'

const problems = [
  {
    problem: 'You spend Friday afternoons manually building the weekly ops report',
    solution: 'Auto-generated compliance reports',
    description: 'Telemetry breadcrumb reports generate automatically when shipments complete. Temperature logs, GPS trails, event timelines, and exception histories  - compiled and ready for your customer or regulator without anyone touching a spreadsheet.',
    stripe: '#3b82f6',
  },
  {
    problem: 'Your reporting data lives in three different systems and none of them agree',
    solution: 'Single source of truth',
    description: 'Every event in Open TMS flows through a CQRS event architecture with dedicated read model projections for reporting. Shipment metrics, carrier performance, lane analysis, and exception counts all draw from the same immutable event store  - no reconciliation needed.',
    stripe: '#22c55e',
  },
  {
    problem: 'You can\'t answer "which carrier is cheapest on this lane?" without a 2-hour data pull',
    solution: 'Carrier & lane performance analytics',
    description: 'Pre-built read models track carrier on-time rates, bid-to-win ratios, tender response times, and cost-per-mile by lane. The data is always current because projections update in real time as events flow through the system.',
    stripe: '#a855f7',
  },
  {
    problem: 'Your BI tool needs a data engineer to maintain the ETL pipeline',
    solution: 'Queryable event export API',
    description: 'The event store is directly queryable with cursor-based pagination at /api/v1/events. Feed events into your data warehouse, BI tool, or analytics platform without building custom ETL. Every event has a schema version for forward-compatible consumption.',
    stripe: '#f59e0b',
  },
]

const reportTypes = [
  { name: 'Telemetry Breadcrumb', description: 'Full sensor trail for each shipment  - auto-generated on completion', auto: true, tint: 'rgba(59,130,246,0.06)' },
  { name: 'Daily Operations', description: 'Excel export with shipment counts, exceptions, and delivery metrics', auto: true, tint: 'rgba(34,197,94,0.06)' },
  { name: 'Location Activity', description: 'Shipment volume and performance by facility over time', auto: false, tint: 'rgba(168,85,247,0.06)' },
  { name: 'Carrier Performance', description: 'On-time rates, tender response times, and cost analysis per carrier', auto: false, tint: 'rgba(245,158,11,0.06)' },
  { name: 'CAPA Investigation', description: 'Full corrective action lifecycle from detection to verification', auto: false, tint: 'rgba(239,68,68,0.06)' },
  { name: 'Cold Chain Compliance', description: 'Temperature logs with integrity hashes for regulatory audit', auto: true, tint: 'rgba(6,182,212,0.06)' },
]

const flowSteps = [
  { label: 'Events', icon: '⚡', color: '#3b82f6' },
  { label: 'Event Store', icon: '🗄', color: '#8b5cf6' },
  { label: 'Projections', icon: '⚙', color: '#f59e0b' },
  { label: 'Read Models', icon: '📊', color: '#22c55e' },
  { label: 'Reports', icon: '📄', color: '#06b6d4' },
]

const abstractIcons = [
  <svg key="0" width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="4" y="8" width="32" height="3" rx="1.5" fill="currentColor" opacity="0.3"/><rect x="4" y="15" width="24" height="3" rx="1.5" fill="currentColor" opacity="0.2"/><rect x="4" y="22" width="28" height="3" rx="1.5" fill="currentColor" opacity="0.15"/><rect x="4" y="29" width="20" height="3" rx="1.5" fill="currentColor" opacity="0.1"/></svg>,
  <svg key="1" width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="26" width="6" height="10" rx="1" fill="currentColor" opacity="0.3"/><rect x="14" y="18" width="6" height="18" rx="1" fill="currentColor" opacity="0.25"/><rect x="22" y="10" width="6" height="26" rx="1" fill="currentColor" opacity="0.2"/><rect x="30" y="4" width="6" height="32" rx="1" fill="currentColor" opacity="0.15"/></svg>,
  <svg key="2" width="40" height="40" viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2" opacity="0.2"/><path d="M20 6a14 14 0 0 1 0 28" fill="currentColor" opacity="0.15"/></svg>,
  <svg key="3" width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M4 36L12 22L20 28L28 14L36 8" stroke="currentColor" strokeWidth="2" opacity="0.25" fill="none"/><circle cx="12" cy="22" r="2" fill="currentColor" opacity="0.2"/><circle cx="20" cy="28" r="2" fill="currentColor" opacity="0.2"/><circle cx="28" cy="14" r="2" fill="currentColor" opacity="0.2"/></svg>,
  <svg key="4" width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="4" y="4" width="14" height="14" rx="3" fill="currentColor" opacity="0.2"/><rect x="22" y="4" width="14" height="14" rx="3" fill="currentColor" opacity="0.15"/><rect x="4" y="22" width="14" height="14" rx="3" fill="currentColor" opacity="0.15"/><rect x="22" y="22" width="14" height="14" rx="3" fill="currentColor" opacity="0.1"/></svg>,
  <svg key="5" width="40" height="40" viewBox="0 0 40 40" fill="none"><path d="M20 4v32M4 20h32" stroke="currentColor" strokeWidth="2" opacity="0.15"/><circle cx="20" cy="20" r="8" stroke="currentColor" strokeWidth="2" opacity="0.2"/><circle cx="20" cy="20" r="3" fill="currentColor" opacity="0.25"/></svg>,
]

export default function Reports() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Split Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-600/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left column: text */}
            <div>
              <AnimateIn animation="fade-in">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-6">
                  <span className="text-sm font-medium text-primary-300">Reports App</span>
                </div>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={100}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                  Reports that write themselves.
                  <br />
                  <span className="gradient-text">Data that tells the truth.</span>
                </h1>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={200}>
                <p className="text-xl text-surface-300 leading-relaxed">
                  Stop building reports manually. Open TMS auto-generates compliance documentation,
                  tracks carrier performance in real time, and exposes a queryable event stream for
                  your analytics stack.
                </p>
              </AnimateIn>
            </div>

            {/* Right column: preview */}
            <AnimateIn animation="slide-left" delay={300}>
              <div style={{
                transform: 'perspective(1200px) rotateY(-4deg) rotateX(2deg)',
                transformOrigin: 'center center',
              }}>
                <div style={{
                  transform: 'scale(0.7)',
                  transformOrigin: 'top right',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 25px 80px rgba(0,0,0,0.4), 0 0 40px rgba(99,102,241,0.1)',
                }}>
                  <ReportsPreview />
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Problem/Solution horizontal cards */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            {problems.map((item, i) => (
              <AnimateIn key={i} animation="slide-left" delay={i * 100}>
                <div
                  className="glass-card rounded-2xl overflow-hidden"
                  style={{ display: 'flex' }}
                >
                  {/* Colored left stripe */}
                  <div style={{
                    width: '6px',
                    minHeight: '100%',
                    background: item.stripe,
                    flexShrink: 0,
                  }} />
                  <div style={{ padding: '2rem 2.5rem', flex: 1 }}>
                    <p className="text-surface-400 text-sm italic mb-2">&ldquo;{item.problem}&rdquo;</p>
                    <h3 className="text-xl font-bold text-white mb-2">{item.solution}</h3>
                    <p className="text-surface-300 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Report types horizontal carousel */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-10">Available report types</h2>
          </AnimateIn>
          <div style={{
            display: 'flex',
            gap: '1.25rem',
            overflowX: 'auto',
            paddingBottom: '1rem',
            scrollSnapType: 'x mandatory',
          }}>
            {reportTypes.map((r, i) => (
              <AnimateIn key={i} animation="scale-up" delay={i * 80}>
                <div
                  className="feature-card"
                  style={{
                    minWidth: '260px',
                    maxWidth: '280px',
                    height: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderRadius: '16px',
                    padding: '1.5rem',
                    background: r.tint,
                    border: '1px solid rgba(255,255,255,0.06)',
                    scrollSnapAlign: 'start',
                    flexShrink: 0,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                      <h3 className="text-base font-semibold text-white">{r.name}</h3>
                      {r.auto && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#4ade80',
                          background: 'rgba(34,197,94,0.1)',
                          border: '1px solid rgba(34,197,94,0.2)',
                          borderRadius: '9999px',
                          padding: '2px 8px',
                        }}>
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-surface-400 leading-relaxed text-sm">{r.description}</p>
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', marginTop: '1rem' }}>
                    {abstractIcons[i]}
                  </div>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Data Architecture Flow */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-4 text-center">Data architecture</h2>
            <p className="text-surface-400 text-center mb-14 max-w-2xl mx-auto">
              Every event flows through an immutable store, gets projected into purpose-built read models,
              and surfaces as real-time reports  - no ETL pipelines, no batch jobs.
            </p>
          </AnimateIn>

          <AnimateIn animation="fade-up" delay={200}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0',
              flexWrap: 'wrap',
              padding: '2rem 0',
            }}>
              {flowSteps.map((step, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                  {/* Node */}
                  <div className="glass-card" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '130px',
                    height: '110px',
                    borderRadius: '16px',
                    border: `1px solid ${step.color}33`,
                    background: `${step.color}0a`,
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{step.icon}</span>
                    <span style={{
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: step.color,
                      textAlign: 'center',
                      lineHeight: 1.2,
                    }}>
                      {step.label}
                    </span>
                  </div>
                  {/* Arrow connector */}
                  {i < flowSteps.length - 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 0.25rem',
                    }}>
                      <div style={{
                        width: '32px',
                        height: '2px',
                        background: 'linear-gradient(to right, rgba(255,255,255,0.15), rgba(255,255,255,0.05))',
                      }} />
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: '-1px' }}>
                        <path d="M2 6h8M7 3l3 3-3 3" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Missing Feature + CTA */}
      <section className="pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MissingFeature />

          <div className="mt-16 text-center">
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
                to="/features/warehouse"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:-translate-y-0.5"
              >
                Explore Warehouse App
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
