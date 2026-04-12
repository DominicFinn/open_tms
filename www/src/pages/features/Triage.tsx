import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'
import KanbanPreview from '../../components/previews/KanbanPreview'

const problems = [
  {
    problem: 'Exceptions get buried in email threads and nobody owns them',
    solution: 'Kanban-style issue triage',
    description: 'Every exception - late pickups, temperature excursions, carrier no-shows, damaged freight - surfaces automatically as a triage card. Drag between Open, In Progress, Resolved, and Closed. Assign to team members, set priority, apply labels for organisation, and never lose track of an issue again.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125c-.621 0-1.125.504-1.125 1.125v12.75c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
    tall: true,
    accent: 'purple',
  },
  {
    problem: 'You find out about problems from your customers, not your systems',
    solution: 'Automatic exception detection',
    description: 'The system monitors shipments in real time and creates triage items automatically when things go wrong. Temperature out of range? Card created. ETA delay crosses a threshold? Card created. Carrier misses a pickup window? Card created. Your team responds proactively instead of reactively.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    tall: false,
    accent: 'blue',
  },
  {
    problem: 'Priority is whoever shouts loudest, not what actually matters most',
    solution: 'Severity-based prioritisation',
    description: 'Every issue gets a severity level - Critical, High, Medium, Low - based on business impact, not who sent the email. Filter by severity to focus on what matters. Intelligent snooze lets you defer non-urgent issues with auto-wake, so nothing falls through the cracks. Escalation rules ensure critical issues never sit unattended.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    tall: false,
    accent: 'purple',
  },
  {
    problem: 'You have no idea how many issues you handle per week or what the root causes are',
    solution: 'Full audit trail & analytics',
    description: 'Every state change, assignment, and resolution is recorded as an immutable event. When an issue is closed, a PDF closure report is auto-generated with full context: timeline, shipment data, temperature telemetry, SLA evaluations, and CAPA reports. See how long issues take to resolve, which carriers generate the most exceptions, and which routes are problematic. Data-driven operations, not gut feel.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
      </svg>
    ),
    tall: true,
    accent: 'blue',
  },
]

const differentiators = [
  {
    number: '01',
    title: 'Most TMSs don\'t have this',
    description: 'Triage and exception management is typically a separate tool you bolt on - if you have it at all. Open TMS builds it in natively, connected directly to your shipment data, sensor telemetry, and carrier performance.',
  },
  {
    number: '02',
    title: 'Built for logistics, not generic project management',
    description: 'This isn\'t Jira or Trello with a logistics skin. Triage items link directly to shipments, orders, and carriers via entity search. Every issue has a collaborative comments thread where your team can discuss, share updates, and coordinate responses. When you open an issue, you see the shipment timeline, sensor data, and carrier history without leaving the card.',
  },
  {
    number: '03',
    title: 'Feeds the Quality Centre',
    description: 'Triage items that reveal systemic problems can be escalated into CAPA (Corrective & Preventive Action) investigations in the Quality Centre. The triage board handles the immediate firefighting; the Quality Centre handles the root cause analysis.',
  },
]

export default function Triage() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero with side-by-side preview */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-500/8 blur-[100px]" />
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
                <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-500/10 px-4 py-1.5 mb-6">
                  <span className="text-sm font-medium text-accent-400">Triage Centre</span>
                </div>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={100}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                  Catch every exception.
                  <br />
                  <span className="gradient-text">Before your customers do.</span>
                </h1>
              </AnimateIn>

              <AnimateIn animation="fade-up" delay={200}>
                <p className="text-xl text-surface-300 leading-relaxed mb-10">
                  Most logistics teams find out about problems when the phone rings. The Triage Centre
                  flips that - auto-detecting exceptions across your supply chain and giving your team
                  a visual, priority-driven workflow to resolve them fast.
                </p>
              </AnimateIn>
            </div>

            {/* Right column: embedded KanbanPreview */}
            <AnimateIn animation="slide-left" delay={300}>
              <div className="relative flex items-center justify-center">
                {/* Glow behind the preview */}
                <div className="absolute inset-0 rounded-3xl bg-accent-500/10 blur-[60px]" />
                <div
                  className="relative glow"
                  style={{
                    transform: 'perspective(1200px) rotateY(-4deg) rotateX(2deg) scale(0.6)',
                    transformOrigin: 'center center',
                  }}
                >
                  <KanbanPreview />
                </div>
              </div>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* "This is rare" callout banner */}
      <section className="pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up" delay={100}>
            <div
              className="rounded-2xl p-8"
              style={{
                background: 'linear-gradient(135deg, rgba(139,92,246,0.08), rgba(59,130,246,0.08))',
                borderLeft: '4px solid rgba(139,92,246,0.6)',
              }}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <svg className="h-7 w-7 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">This is rare.</h3>
                  <p className="text-surface-300 text-base leading-relaxed">
                    Most TMS platforms don&apos;t include exception management at all - let alone integrated
                    with live telemetry data. If you&apos;re using spreadsheets or email threads to track issues,
                    you&apos;re not alone. But there&apos;s a better way.
                  </p>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Masonry-style problem cards */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-4">The problems we solve</h2>
            <p className="text-surface-400 text-lg mb-12 max-w-2xl">
              Logistics operations are messy. Here&apos;s what teams deal with every day, and how the Triage Centre fixes it.
            </p>
          </AnimateIn>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
              gap: '1.5rem',
              gridAutoFlow: 'dense',
            }}
          >
            {problems.map((item, i) => (
              <AnimateIn
                key={i}
                animation={i % 2 === 0 ? 'slide-right' : 'slide-left'}
                delay={i * 100}
              >
                <div
                  className="glass-card rounded-2xl p-8"
                  style={{
                    borderLeft: `3px solid ${item.accent === 'purple' ? 'rgba(139,92,246,0.5)' : 'rgba(59,130,246,0.5)'}`,
                    minHeight: item.tall ? '320px' : 'auto',
                  }}
                >
                  <div className="flex items-start gap-4 mb-5">
                    <div
                      className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl"
                      style={{
                        background: item.accent === 'purple'
                          ? 'rgba(139,92,246,0.15)'
                          : 'rgba(59,130,246,0.15)',
                        color: item.accent === 'purple'
                          ? 'rgb(167,139,250)'
                          : 'rgb(96,165,250)',
                      }}
                    >
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-white pt-2">{item.solution}</h3>
                  </div>

                  <p className="text-surface-400 text-sm italic mb-4 pl-1">
                    &ldquo;{item.problem}&rdquo;
                  </p>

                  <p className="text-surface-300 leading-relaxed">{item.description}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* "Why this changes the game" - numbered cards */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-10">Why this changes the game</h2>
          </AnimateIn>

          <div className="grid md:grid-cols-3 gap-6">
            {differentiators.map((d, i) => (
              <AnimateIn key={i} animation="scale-up" delay={i * 120}>
                <div
                  className="glass-card rounded-2xl p-8 h-full"
                  style={{
                    borderLeft: '3px solid transparent',
                    borderImage: 'linear-gradient(to bottom, rgba(139,92,246,0.6), rgba(59,130,246,0.6)) 1',
                  }}
                >
                  <span
                    className="block text-4xl font-black mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgb(139,92,246), rgb(59,130,246))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {d.number}
                  </span>
                  <h3 className="text-lg font-semibold text-white mb-3">{d.title}</h3>
                  <p className="text-surface-400 leading-relaxed text-sm">{d.description}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Missing Feature */}
      <section className="pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MissingFeature />
        </div>
      </section>

      {/* CTA */}
      <section className="pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">See it in action</h2>
            <p className="text-surface-400 mb-8 text-lg">Deploy Open TMS and start triaging exceptions in your first session.</p>
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
                to="/features/quality"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-white/10 hover:-translate-y-0.5"
              >
                Explore Quality Centre
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
