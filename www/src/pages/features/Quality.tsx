import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import QualityPreview from '../../components/previews/QualityPreview'

const problems = [
  {
    problem: 'A temperature excursion happens and you have no structured way to investigate it',
    solution: 'CAPA workflow engine with 30/60/90 follow-ups',
    description: 'Corrective and Preventive Action (CAPA) reports follow a structured lifecycle from Draft through Investigation, Root Cause, Action Plan, Implementation, Verification, to Closed. Every step is documented and auditable. Automatic 30/60/90-day follow-up scheduling ensures corrective actions stick - with effectiveness tracking so you know if the fix actually worked.',
    color: '#22c55e',
  },
  {
    problem: 'You know there are problem carriers and lanes but you cannot prove it with data',
    solution: 'Quality Centre dashboard with issue analytics',
    description: 'A dedicated Quality Centre aggregates issues by carrier, lane, location, and customer. See which carriers have the highest exception rates, which lanes generate the most delays, and which locations have compliance problems. Drill down from the dashboard into carrier scorecards and lane analysis reports.',
    color: '#3b82f6',
  },
  {
    problem: 'Cold chain compliance is a nightmare of spreadsheets and manual temperature logs',
    solution: 'Automated cold chain compliance',
    description: 'CFR 21 Part 11 compliant temperature logging with SHA-256 integrity hashes. The system continuously monitors temperature, humidity, and other sensor data. When an excursion is detected, it automatically triggers quarantine workflows and creates investigation records. Compliance reports generate themselves.',
    color: '#8b5cf6',
  },
  {
    problem: 'GDP and SOP audits are paper-based and nobody knows if they are overdue',
    solution: 'SOP checklists and GDP audit management',
    description: 'Create reusable SOP checklists for GDP, cold chain, warehouse, and transport processes. Schedule audits on monthly, quarterly, or annual cycles. Each audit walks the auditor through every item with pass/fail/N-A responses, evidence uploads, and automatic scoring. Critical items that fail automatically flag the entire audit. Overdue checklists surface on the Quality Centre dashboard.',
    color: '#f59e0b',
  },
  {
    problem: 'The same types of failures keep happening and nobody is tracking root causes',
    solution: 'Root cause analysis and CAPA effectiveness tracking',
    description: 'CAPA reports separate the immediate corrective action from the long-term preventive action. Track root cause categories (equipment, process, personnel, environmental) across your operation. The CAPA effectiveness report shows follow-up completion rates and whether corrective actions were actually effective.',
    color: '#a855f7',
  },
  {
    problem: 'Audit time means weeks of frantic document gathering',
    solution: 'Audit-ready by design',
    description: 'Every event in the system is immutable and timestamped. CAPA reports, temperature logs, SOP audit results, exception timelines, and resolution actions are all queryable and exportable. When the auditor arrives, you pull the report - you do not scramble to reconstruct what happened.',
    color: '#ef4444',
  },
]

const audiences = [
  {
    role: 'Quality Managers',
    benefit: 'Structured CAPA workflows replace ad-hoc investigation. Every corrective action is tracked to completion with verification steps.',
    color: '#22c55e',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0118 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3l1.5 1.5 3-3.75" />
      </svg>
    ),
  },
  {
    role: 'Compliance Officers',
    benefit: 'CFR 21 Part 11 compliant records with integrity hashes. Audit trails are automatic, not reconstructed after the fact.',
    color: '#3b82f6',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
  },
  {
    role: 'Operations Directors',
    benefit: 'See the pattern behind the firefighting. Root cause data reveals which carriers, lanes, and processes need systemic attention.',
    color: '#a855f7',
    icon: (
      <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
      </svg>
    ),
  },
]

export default function Quality() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero with side-by-side preview */}
      <section className="relative pt-32 pb-16 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-green-600/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
            {/* Left: text content */}
            <div>
              <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                Back to home
              </Link>

              <AnimateIn animation="fade-in">
                <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-4 py-1.5 mb-6">
                  <span className="text-sm font-medium text-green-400">Quality Centre</span>
                </div>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={100}>
                <h1 className="text-4xl sm:text-5xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-6">
                  Quality isn&#39;t a department.
                  <br />
                  <span className="gradient-text">It&#39;s built into the platform.</span>
                </h1>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={200}>
                <p className="text-lg text-surface-300 leading-relaxed mb-8">
                  Most TMS platforms stop at tracking shipments. Open TMS goes further with a full
                  Quality Centre  - CAPA investigations, cold chain compliance, root cause analysis,
                  and audit-ready records. All connected to your live operational data.
                </p>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={300}>
                <div className="inline-flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 px-6 py-3">
                  <svg className="h-5 w-5 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  <span className="text-sm text-surface-300">
                    <strong className="text-white">A genuine differentiator.</strong> Integrated quality management is almost unheard of in TMS software.
                  </span>
                </div>
              </AnimateIn>
            </div>

            {/* Right: preview (desktop only) */}
            <AnimateIn animation="slide-left" delay={200} className="min-w-0 hidden lg:block">
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-green-500/5 glow" style={{
                transform: 'perspective(1200px) rotateY(-2deg)',
              }}>
                <QualityPreview />
              </div>
              <p className="text-center text-surface-400 text-sm mt-4 italic">
                CAPA investigation  - from detection to verified resolution
              </p>
            </AnimateIn>

            {/* Mobile: compact CAPA workflow SVG */}
            <AnimateIn animation="fade-up" delay={200} className="lg:hidden">
              <div className="glass-card rounded-2xl p-6 max-w-sm mx-auto">
                <svg viewBox="0 0 280 120" fill="none" className="w-full h-auto">
                  <style>{`
                    @keyframes qa-m-step { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
                    .qa-m-s1 { animation: qa-m-step 4s ease-in-out 0s infinite; }
                    .qa-m-s2 { animation: qa-m-step 4s ease-in-out 0.6s infinite; }
                    .qa-m-s3 { animation: qa-m-step 4s ease-in-out 1.2s infinite; }
                    .qa-m-s4 { animation: qa-m-step 4s ease-in-out 1.8s infinite; }
                    .qa-m-s5 { animation: qa-m-step 4s ease-in-out 2.4s infinite; }
                  `}</style>
                  {/* Progress steps */}
                  <g className="qa-m-s1">
                    <circle cx="30" cy="40" r="14" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1.5"/>
                    <path d="M25 40 l3 3 l6 -6" stroke="rgba(34,197,94,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <line x1="44" y1="40" x2="78" y2="40" stroke="rgba(34,197,94,0.2)" strokeWidth="1.5"/>
                  <g className="qa-m-s2">
                    <circle cx="92" cy="40" r="14" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.4)" strokeWidth="1.5"/>
                    <path d="M87 40 l3 3 l6 -6" stroke="rgba(34,197,94,0.7)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <line x1="106" y1="40" x2="140" y2="40" stroke="rgba(59,130,246,0.2)" strokeWidth="1.5"/>
                  <g className="qa-m-s3">
                    <circle cx="154" cy="40" r="14" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" strokeWidth="2"/>
                    <circle cx="154" cy="40" r="4" fill="rgba(59,130,246,0.6)"/>
                  </g>
                  <line x1="168" y1="40" x2="202" y2="40" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" strokeDasharray="4 3"/>
                  <g className="qa-m-s4">
                    <circle cx="216" cy="40" r="14" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" fill="rgba(255,255,255,0.02)"/>
                  </g>
                  <line x1="230" y1="40" x2="250" y2="40" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" strokeDasharray="4 3"/>
                  <g className="qa-m-s5">
                    <circle cx="264" cy="40" r="14" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" fill="rgba(255,255,255,0.02)"/>
                  </g>
                  {/* Labels */}
                  <text x="30" y="68" textAnchor="middle" fill="rgba(34,197,94,0.5)" fontSize="6.5" fontWeight="500">Draft</text>
                  <text x="92" y="68" textAnchor="middle" fill="rgba(34,197,94,0.5)" fontSize="6.5" fontWeight="500">Investigate</text>
                  <text x="154" y="68" textAnchor="middle" fill="rgba(59,130,246,0.6)" fontSize="6.5" fontWeight="600">Root Cause</text>
                  <text x="216" y="68" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6.5">Action</text>
                  <text x="264" y="68" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="6.5">Verify</text>
                  {/* Status card */}
                  <rect x="60" y="82" width="160" height="28" rx="6" fill="rgba(59,130,246,0.08)" stroke="rgba(59,130,246,0.2)" strokeWidth="1"/>
                  <rect x="72" y="90" width="48" height="4" rx="2" fill="rgba(59,130,246,0.3)"/>
                  <rect x="72" y="98" width="80" height="3" rx="1.5" fill="rgba(255,255,255,0.08)"/>
                </svg>
                <p className="text-center text-surface-500 text-xs mt-3">Structured CAPA workflow with audit trail</p>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* Vertical timeline section */}
      <section className="pb-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white text-center mb-16">The problems we solve</h2>
          </AnimateIn>

          <div className="relative">
            {/* Vertical center line - desktop only */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 hidden lg:block"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,197,94,0.4) 10%, rgba(34,197,94,0.4) 90%, transparent)' }}
            />
            {/* Vertical left line - mobile only */}
            <div
              className="absolute left-[7px] top-0 bottom-0 w-px lg:hidden"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,197,94,0.4) 10%, rgba(34,197,94,0.4) 90%, transparent)' }}
            />

            <div className="space-y-16 lg:space-y-16">
              {problems.map((item, i) => {
                const isLeft = i % 2 === 0
                return (
                  <div key={i} className="relative">
                    {/* Center dot - desktop */}
                    <div
                      className="absolute left-1/2 top-8 -translate-x-1/2 w-4 h-4 rounded-full z-10 glow hidden lg:block"
                      style={{ backgroundColor: item.color, boxShadow: `0 0 12px ${item.color}60` }}
                    />
                    {/* Left dot - mobile */}
                    <div
                      className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full z-10 glow lg:hidden"
                      style={{ backgroundColor: item.color, boxShadow: `0 0 12px ${item.color}60` }}
                    />

                    {/* Desktop: alternating 2-col layout */}
                    <div className={`hidden lg:grid lg:grid-cols-2 gap-16 ${isLeft ? '' : 'direction-rtl'}`}>
                      <AnimateIn animation={isLeft ? 'slide-right' : 'slide-left'} delay={i * 100}>
                        <div className={`${isLeft ? 'lg:text-right lg:pr-12' : 'lg:text-left lg:pl-12 lg:order-2'}`} style={{ direction: 'ltr' }}>
                          <p className="text-surface-400 text-sm italic leading-relaxed">
                            &quot;{item.problem}&quot;
                          </p>
                        </div>
                      </AnimateIn>

                      <AnimateIn animation={isLeft ? 'slide-left' : 'slide-right'} delay={i * 100 + 50}>
                        <div className={`${isLeft ? 'lg:pl-12' : 'lg:pr-12 lg:text-right lg:order-1'}`} style={{ direction: 'ltr' }}>
                          <h3 className="text-xl font-bold text-white mb-2" style={{ color: item.color }}>
                            {item.solution}
                          </h3>
                          <p className="text-surface-300 leading-relaxed text-sm">
                            {item.description}
                          </p>
                        </div>
                      </AnimateIn>
                    </div>

                    {/* Mobile: left-aligned single column */}
                    <div className="lg:hidden pl-8">
                      <AnimateIn animation="slide-right" delay={i * 100}>
                        <p className="text-surface-400 text-sm italic leading-relaxed mb-2">
                          &quot;{item.problem}&quot;
                        </p>
                        <h3 className="text-lg font-bold text-white mb-2" style={{ color: item.color }}>
                          {item.solution}
                        </h3>
                        <p className="text-surface-300 leading-relaxed text-sm">
                          {item.description}
                        </p>
                      </AnimateIn>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Who benefits */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white text-center mb-12">Who benefits most</h2>
          </AnimateIn>
          <div className="grid md:grid-cols-3 gap-8">
            {audiences.map((a, i) => (
              <AnimateIn key={i} animation="scale-up" delay={i * 120}>
                <div
                  className="feature-card rounded-2xl p-8 h-full relative overflow-hidden"
                  style={{ borderTop: `3px solid ${a.color}` }}
                >
                  <div
                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5"
                    style={{ backgroundColor: `${a.color}15`, color: a.color }}
                  >
                    {a.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-3">{a.role}</h3>
                  <p className="text-surface-400 leading-relaxed text-sm">{a.benefit}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Full-width parallax-style band */}
      <section className="relative py-28 overflow-hidden">
        {/* Pattern background */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(135deg, rgba(10,10,20,0.97) 0%, rgba(15,25,15,0.97) 50%, rgba(10,10,20,0.97) 100%)',
        }} />
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(rgba(34,197,94,0.07) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <AnimateIn animation="fade-up">
            <div className="glass-card rounded-3xl p-12 lg:p-16" style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <p className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-white">
                Integrated quality management.
                <br />
                <span className="gradient-text">Not bolted on. Built in.</span>
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      <MissingFeature />

      {/* CTA */}
      <section className="pb-32 pt-8">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Quality management, built in</h2>
          <p className="text-surface-400 mb-8 text-lg">Stop bolting on separate QMS tools. Deploy a TMS that takes quality seriously from day one.</p>
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
              to="/features/reports"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:-translate-y-0.5"
            >
              Explore Reports
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
