import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'

const problems = [
  {
    problem: 'Your team finds out about problems when the customer calls, not when the system detects them',
    solution: 'AI-powered event triage',
    description: 'The triage agent subscribes to shipment exceptions, SLA breaches, cargo issues, and cold chain excursions. When something goes wrong, it gathers context - shipment details, open issues, SLA status - calls Claude, and decides whether to create an issue, escalate an existing one, or take no action. All within seconds, not hours.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
    tall: true,
    accent: 'purple',
  },
  {
    problem: 'Nobody can explain why an automated system did what it did',
    solution: 'Full decision audit trail',
    description: 'Every agent decision is logged with the complete reasoning chain, the context snapshot it had at decision time, and the raw LLM conversation. Human reviewers can mark decisions as correct, incorrect, or partially correct. Token usage and call duration are tracked for cost control.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    tall: false,
    accent: 'blue',
  },
  {
    problem: 'AI costs can spiral without visibility into what is being spent',
    solution: 'Built-in usage telemetry',
    description: 'Every LLM call tracks input tokens, output tokens, and call duration. The Agent Decisions dashboard shows a 30-day usage chart, total token consumption, invocations per day, and average confidence scores. You always know what agents are costing and how well they are performing.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    tall: false,
    accent: 'purple',
  },
  {
    problem: 'You keep solving the same problems manually instead of automating them',
    solution: 'Decision-to-automation pipeline',
    description: 'When agents make the same correct decision repeatedly, you can promote that pattern into a deterministic automation rule - no AI needed. The decision log is your discovery mechanism. Agents handle the messy judgment calls today; automations handle the proven patterns tomorrow.',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
    tall: true,
    accent: 'blue',
  },
]

const differentiators = [
  {
    number: '01',
    title: 'Compliance-first AI',
    description: 'Every decision has a paper trail. Full reasoning, context snapshot, LLM conversation log, and human review. Built for industries where you need to explain why automation did what it did.',
  },
  {
    number: '02',
    title: 'Your key, your costs',
    description: 'Bring your own Anthropic API key. Configure it in admin settings, monitor token usage on the dashboard, and disable agents with one toggle. No vendor lock-in, no hidden AI costs.',
  },
  {
    number: '03',
    title: 'Event-driven, not polling',
    description: 'Agents subscribe to domain events through the same CQRS event bus that powers the rest of the system. They react in real time to exceptions, breaches, and anomalies - not on a polling schedule.',
  },
]

export default function AiAgents() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-500/8 blur-[100px]" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          <div>
            <AnimateIn animation="fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-500/10 px-4 py-1.5 mb-6">
                <span className="text-sm font-medium text-accent-400">AI Agents</span>
              </div>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 max-w-4xl">
                AI that triages.
                <br />
                <span className="gradient-text">Humans that verify.</span>
              </h1>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={200}>
              <p className="text-xl text-surface-300 leading-relaxed mb-10 max-w-3xl">
                Open TMS agents subscribe to your event stream and use Claude to triage exceptions
                in real time. Every decision is logged with full reasoning for compliance. Proven
                patterns get promoted into deterministic automations - no AI needed.
              </p>
            </AnimateIn>
          </div>
        </div>
      </section>

      {/* "This is rare" callout */}
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
                  <h3 className="text-lg font-bold text-white mb-2">AI with guardrails.</h3>
                  <p className="text-surface-300 text-base leading-relaxed">
                    Most AI integrations in logistics are black boxes. Open TMS logs every reasoning step,
                    tracks every token, and lets humans review every decision. This is AI you can explain
                    to your compliance team.
                  </p>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Problem cards */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-4">The problems we solve</h2>
            <p className="text-surface-400 text-lg mb-12 max-w-2xl">
              AI in logistics needs to be transparent, cost-controlled, and provably useful.
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
              <AnimateIn key={i} animation={i % 2 === 0 ? 'slide-right' : 'slide-left'} delay={i * 100}>
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
                        background: item.accent === 'purple' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)',
                        color: item.accent === 'purple' ? 'rgb(167,139,250)' : 'rgb(96,165,250)',
                      }}
                    >
                      {item.icon}
                    </div>
                    <h3 className="text-lg font-bold text-white pt-2">{item.solution}</h3>
                  </div>
                  <p className="text-surface-400 text-sm italic mb-4 pl-1">&ldquo;{item.problem}&rdquo;</p>
                  <p className="text-surface-300 leading-relaxed">{item.description}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
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

      <section className="pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <MissingFeature />
        </div>
      </section>

      {/* Skills system */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-4">The skills system</h2>
            <p className="text-surface-400 text-lg mb-12 max-w-3xl">
              Skills are composable action units. Each skill does one thing well - create an issue, send an email, call a webhook.
              Chain them together with question branching for complex multi-step responses.
            </p>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: 'bug_report', name: 'Create Issue', desc: 'Create a triage issue with templated title, description, priority, and category', config: false },
              { icon: 'priority_high', name: 'Escalate Issue', desc: 'Escalate an existing issue to critical priority with a reason', config: false },
              { icon: 'email', name: 'Send Email', desc: 'Send templated emails via your configured SMTP service', config: true },
              { icon: 'webhook', name: 'Call Webhook', desc: 'HTTP POST/PUT to external APIs with auth and templated body', config: true },
            ].map((skill, i) => (
              <AnimateIn key={i} animation="scale-up" delay={i * 100}>
                <div className="glass-card rounded-2xl p-6 h-full">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-4" style={{ background: 'rgba(139,92,246,0.15)', color: 'rgb(167,139,250)' }}>
                    <span className="material-icons">{skill.icon}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{skill.name}</h3>
                  <p className="text-surface-400 text-sm leading-relaxed mb-3">{skill.desc}</p>
                  <span className="text-xs" style={{ color: skill.config ? 'rgb(251,191,36)' : 'rgb(74,222,128)' }}>
                    {skill.config ? 'Requires configuration' : 'Works out of the box'}
                  </span>
                </div>
              </AnimateIn>
            ))}
          </div>

          <AnimateIn animation="fade-up" delay={400}>
            <div className="glass-card rounded-2xl p-8 mt-8">
              <h3 className="text-lg font-semibold text-white mb-3">Skill chains with branching</h3>
              <p className="text-surface-300 leading-relaxed mb-4">
                Chain skills together in sequences with question nodes. A question evaluates conditions against the event data
                and branches to different skill paths. For example: create an issue, then ask "is this a cold chain excursion?" -
                if yes, send an urgent email to the quality team and call the compliance webhook. If no, just send a notification.
              </p>
              <p className="text-surface-400 text-sm">
                All skill fields support template variables like {'{{payload.shipmentReference}}'} and {'{{context.shipment.customerName}}'} -
                resolved at runtime from the triggering event data.
              </p>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* Configurable prompts */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <div
              className="rounded-2xl p-8"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(59,130,246,0.08))',
                borderLeft: '4px solid rgba(16,185,129,0.6)',
              }}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <svg className="h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">Configurable agent prompts</h3>
                  <p className="text-surface-300 text-base leading-relaxed mb-4">
                    Every agent's system prompt is fully editable through the admin UI. Template variables like {'{{shipment}}'}, {'{{event}}'}, and {'{{sla_status}}'} inject
                    real context data at runtime. Change how aggressive the agent is, what it prioritises, or add industry-specific guidelines.
                  </p>
                  <p className="text-surface-300 text-base leading-relaxed">
                    Every prompt change creates an immutable version. Each decision links to the version that produced it.
                    If a prompt change makes things worse, roll back to any previous version instantly. The version history gives you
                    evidence for which prompt performed best.
                  </p>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* How it works */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <h2 className="text-3xl font-bold text-white mb-4">How the agent works</h2>
            <p className="text-surface-400 text-lg mb-12 max-w-3xl">
              The triage agent is an event handler that subscribes to your CQRS event bus - the same
              infrastructure that powers projections, notifications, and SLA evaluation.
            </p>
          </AnimateIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Event triggers', desc: 'A shipment exception, SLA breach, cargo misdrop, or cold chain excursion fires a domain event through pg-boss.' },
              { step: '2', title: 'Context gathered', desc: 'The agent loads shipment details, open issues, SLA evaluations, and customer data from the database. It also checks for recent duplicate decisions.' },
              { step: '3', title: 'Claude reasons', desc: 'A structured prompt with system instructions and the full context is sent to Claude. The response is parsed as JSON with a summary, reasoning, action type, and confidence score.' },
              { step: '4', title: 'Action executed', desc: 'Based on the decision, the agent dispatches a CreateIssue or EscalateIssue command through the command bus. Or takes no action if none is needed.' },
              { step: '5', title: 'Decision logged', desc: 'The full decision is recorded - reasoning, context snapshot, LLM conversation, token counts, and wall-clock duration. This is the compliance audit trail.' },
              { step: '6', title: 'Human reviews', desc: 'Operators review decisions in the Agent Decisions dashboard, marking them correct, incorrect, or partially correct. This feedback builds the evidence base for automation.' },
            ].map((item, i) => (
              <AnimateIn key={i} animation="fade-up" delay={i * 80}>
                <div className="glass-card rounded-2xl p-6 h-full">
                  <span
                    className="block text-2xl font-black mb-3"
                    style={{
                      background: 'linear-gradient(135deg, rgb(139,92,246), rgb(59,130,246))',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {item.step}
                  </span>
                  <h3 className="text-base font-semibold text-white mb-2">{item.title}</h3>
                  <p className="text-surface-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      {/* Decision-to-automation pipeline */}
      <section className="pb-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <div
              className="rounded-2xl p-8"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.08))',
                borderLeft: '4px solid rgba(59,130,246,0.6)',
              }}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0 mt-0.5">
                  <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-2">The agent-to-automation pipeline</h3>
                  <p className="text-surface-300 text-base leading-relaxed mb-4">
                    AI agents are your discovery mechanism, not your end state. When an agent makes the same
                    correct decision repeatedly - say, always creating a critical issue when a cold chain
                    excursion exceeds 30 minutes - you promote that pattern into a deterministic automation
                    rule. The rule runs instantly without an LLM call, costs nothing, and behaves identically
                    every time.
                  </p>
                  <p className="text-surface-300 text-base leading-relaxed">
                    This is the real power: agents handle the messy, context-dependent judgment calls today.
                    Automations handle the proven patterns tomorrow. Over time, your AI costs decrease as
                    more patterns graduate into rules, while your automation coverage increases. The decision
                    log is what makes this possible - it gives you the evidence to know when a pattern is
                    reliable enough to automate.
                  </p>
                </div>
              </div>
            </div>
          </AnimateIn>
        </div>
      </section>

      {/* CTA */}
      <section className="pb-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">See it in action</h2>
            <p className="text-surface-400 mb-8 text-lg">Deploy Open TMS, add your Anthropic API key, and the triage agent starts working immediately.</p>
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
        </div>
      </section>
    </div>
  )
}
