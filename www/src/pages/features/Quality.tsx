import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import QualityPreview from '../../components/previews/QualityPreview'

const problems = [
  {
    problem: 'A temperature excursion happens and you have no structured way to investigate it',
    solution: 'CAPA workflow engine',
    description: 'Corrective and Preventive Action (CAPA) reports follow a structured lifecycle: Draft \u2192 Investigation \u2192 Root Cause Identified \u2192 Action Plan \u2192 Implementation \u2192 Verification \u2192 Closed. Every step is documented, timestamped, and auditable. When a regulator asks "what did you do about it?", you have the answer.',
    color: '#22c55e',
  },
  {
    problem: 'Cold chain compliance is a nightmare of spreadsheets and manual temperature logs',
    solution: 'Automated cold chain compliance',
    description: 'CFR 21 Part 11 compliant temperature logging with SHA-256 integrity hashes. The system continuously monitors temperature, humidity, and other sensor data. When an excursion is detected, it automatically triggers quarantine workflows and creates investigation records. Compliance reports generate themselves.',
    color: '#3b82f6',
  },
  {
    problem: 'The same types of failures keep happening and nobody\u0027s tracking root causes',
    solution: 'Root cause analysis & prevention',
    description: 'CAPA reports separate the immediate corrective action from the long-term preventive action. Identify root causes, assign preventive measures with due dates, and verify that they actually worked. Over time, you build a knowledge base of what went wrong and how you fixed it.',
    color: '#a855f7',
  },
  {
    problem: 'Audit time means weeks of frantic document gathering',
    solution: 'Audit-ready by design',
    description: 'Every event in the system is immutable and timestamped. CAPA reports, temperature logs, exception timelines, and resolution actions are all queryable and exportable. When the auditor arrives, you pull the report \u2014 you don\u0027t scramble to reconstruct what happened.',
    color: '#f59e0b',
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

            {/* Right: preview (desktop: beside, mobile: below) */}
            <AnimateIn animation="slide-left" delay={200} className="min-w-0">
              <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-green-500/5 glow" style={{
                transform: 'perspective(1200px) rotateY(-2deg)',
              }}>
                <QualityPreview />
              </div>
              <p className="text-center text-surface-400 text-sm mt-4 italic">
                CAPA investigation  - from detection to verified resolution
              </p>
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
            {/* Vertical center line */}
            <div
              className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2"
              style={{ background: 'linear-gradient(to bottom, transparent, rgba(34,197,94,0.4) 10%, rgba(34,197,94,0.4) 90%, transparent)' }}
            />

            <div className="space-y-16">
              {problems.map((item, i) => {
                const isLeft = i % 2 === 0
                return (
                  <div key={i} className="relative">
                    {/* Center dot */}
                    <div
                      className="absolute left-1/2 top-8 -translate-x-1/2 w-4 h-4 rounded-full z-10 glow"
                      style={{ backgroundColor: item.color, boxShadow: `0 0 12px ${item.color}60` }}
                    />

                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 ${isLeft ? '' : 'direction-rtl'}`}>
                      {/* Problem side */}
                      <AnimateIn animation={isLeft ? 'slide-right' : 'slide-left'} delay={i * 100}>
                        <div className={`${isLeft ? 'lg:text-right lg:pr-12' : 'lg:text-left lg:pl-12 lg:order-2'}`} style={{ direction: 'ltr' }}>
                          <p className="text-surface-400 text-sm italic leading-relaxed">
                            &quot;{item.problem}&quot;
                          </p>
                        </div>
                      </AnimateIn>

                      {/* Solution side */}
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
