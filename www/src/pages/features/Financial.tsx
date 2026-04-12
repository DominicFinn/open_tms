import { Link } from 'react-router-dom'
import AnimateIn from '../../components/AnimateIn'
import MissingFeature from '../../components/MissingFeature'

const sections = [
  {
    problem: 'You\'re reconciling carrier invoices in spreadsheets and hoping the numbers match',
    solution: 'Three-way freight audit',
    description: 'Every carrier invoice is automatically matched against the tendered rate and expected charges. Variances are flagged instantly with per-line match results. Within a 2% tolerance, invoices auto-approve - outside that, they route to your team for review. EDI 210 inbound parsing feeds directly into the audit engine.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="20" y="30" width="72" height="140" rx="8" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" fill="rgba(99,102,241,0.05)" />
        <rect x="104" y="30" width="72" height="140" rx="8" stroke="rgba(139,92,246,0.3)" strokeWidth="1.5" fill="rgba(139,92,246,0.05)" />
        <rect x="188" y="30" width="72" height="140" rx="8" stroke="rgba(59,130,246,0.3)" strokeWidth="1.5" fill="rgba(59,130,246,0.05)" />
        <rect x="30" y="44" width="52" height="6" rx="3" fill="rgba(99,102,241,0.25)" />
        <rect x="30" y="56" width="36" height="4" rx="2" fill="rgba(99,102,241,0.15)" />
        <rect x="30" y="66" width="44" height="4" rx="2" fill="rgba(99,102,241,0.12)" />
        <rect x="30" y="80" width="52" height="8" rx="4" fill="rgba(99,102,241,0.2)" />
        <rect x="114" y="44" width="52" height="6" rx="3" fill="rgba(139,92,246,0.25)" />
        <rect x="114" y="56" width="36" height="4" rx="2" fill="rgba(139,92,246,0.15)" />
        <rect x="114" y="66" width="44" height="4" rx="2" fill="rgba(139,92,246,0.12)" />
        <rect x="114" y="80" width="52" height="8" rx="4" fill="rgba(139,92,246,0.2)" />
        <rect x="198" y="44" width="52" height="6" rx="3" fill="rgba(59,130,246,0.25)" />
        <rect x="198" y="56" width="36" height="4" rx="2" fill="rgba(59,130,246,0.15)" />
        <rect x="198" y="66" width="44" height="4" rx="2" fill="rgba(59,130,246,0.12)" />
        <rect x="198" y="80" width="52" height="8" rx="4" fill="rgba(59,130,246,0.2)" />
        <path d="M92 100 l12 0" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <path d="M176 100 l12 0" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
        <circle cx="140" cy="145" r="18" stroke="rgba(34,197,94,0.4)" strokeWidth="1.5" fill="rgba(34,197,94,0.08)" />
        <path d="M133 145 l4 4 l8 -8" stroke="rgba(34,197,94,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="56" y1="105" x2="120" y2="130" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="140" y1="105" x2="140" y2="127" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="224" y1="105" x2="160" y2="130" stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3 3" />
        <text x="56" y="40" textAnchor="middle" fill="rgba(99,102,241,0.5)" fontSize="8" fontWeight="600">TENDER</text>
        <text x="140" y="40" textAnchor="middle" fill="rgba(139,92,246,0.5)" fontSize="8" fontWeight="600">EXPECTED</text>
        <text x="224" y="40" textAnchor="middle" fill="rgba(59,130,246,0.5)" fontSize="8" fontWeight="600">INVOICE</text>
      </svg>
    ),
  },
  {
    problem: 'Invoicing takes days because someone has to manually pull data from three different systems',
    solution: 'Auto-invoice on delivery',
    description: 'When a shipment is delivered, approved revenue charges are automatically marked ready to invoice. If the customer has auto-invoicing enabled, a draft invoice is created immediately. Consolidate by shipment, weekly (every Monday), or monthly (1st of each month). Full/partial payments, void and reissue, and overdue detection with reminder cadence.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="40" y="20" width="200" height="160" rx="10" stroke="rgba(99,102,241,0.3)" strokeWidth="1.5" fill="rgba(99,102,241,0.04)" />
        <rect x="56" y="40" width="168" height="8" rx="4" fill="rgba(99,102,241,0.2)" />
        <line x1="56" y1="58" x2="224" y2="58" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <rect x="56" y="68" width="80" height="5" rx="2.5" fill="rgba(99,102,241,0.15)" />
        <rect x="180" y="68" width="44" height="5" rx="2.5" fill="rgba(34,197,94,0.2)" />
        <rect x="56" y="82" width="80" height="5" rx="2.5" fill="rgba(99,102,241,0.12)" />
        <rect x="180" y="82" width="44" height="5" rx="2.5" fill="rgba(34,197,94,0.2)" />
        <rect x="56" y="96" width="80" height="5" rx="2.5" fill="rgba(99,102,241,0.12)" />
        <rect x="180" y="96" width="44" height="5" rx="2.5" fill="rgba(34,197,94,0.2)" />
        <line x1="56" y1="112" x2="224" y2="112" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <rect x="56" y="122" width="60" height="6" rx="3" fill="rgba(139,92,246,0.15)" />
        <rect x="160" y="120" width="64" height="10" rx="5" fill="rgba(99,102,241,0.2)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
        <rect x="56" y="146" width="88" height="20" rx="6" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
        <rect x="64" y="152" width="40" height="4" rx="2" fill="rgba(34,197,94,0.3)" />
        <rect x="112" y="152" width="24" height="4" rx="2" fill="rgba(34,197,94,0.2)" />
      </svg>
    ),
  },
  {
    problem: 'Getting a quote out takes hours of back-and-forth, and you lose track of revisions',
    solution: 'Quotes with revision tracking',
    description: 'Create quotes with configurable markup percentages and validity periods. When a customer requests changes, revise the quote - the original is superseded and linked to the new version. Accept a quote and it auto-creates an order with pre-populated approved revenue charges. Expired quotes are caught by a cron job every 30 minutes.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="30" y="30" width="100" height="70" rx="8" stroke="rgba(139,92,246,0.2)" strokeWidth="1" fill="rgba(139,92,246,0.03)" strokeDasharray="4 4" />
        <rect x="38" y="42" width="60" height="5" rx="2.5" fill="rgba(139,92,246,0.15)" />
        <rect x="38" y="52" width="44" height="4" rx="2" fill="rgba(139,92,246,0.1)" />
        <rect x="38" y="62" width="80" height="6" rx="3" fill="rgba(139,92,246,0.12)" />
        <text x="108" y="40" fill="rgba(139,92,246,0.3)" fontSize="7">v1</text>
        <rect x="50" y="50" width="100" height="70" rx="8" stroke="rgba(139,92,246,0.3)" strokeWidth="1" fill="rgba(139,92,246,0.04)" strokeDasharray="4 4" />
        <text x="128" y="60" fill="rgba(139,92,246,0.4)" fontSize="7">v2</text>
        <rect x="70" y="70" width="100" height="70" rx="8" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" fill="rgba(99,102,241,0.06)" />
        <text x="148" y="80" fill="rgba(99,102,241,0.5)" fontSize="7">v3</text>
        <rect x="82" y="84" width="60" height="5" rx="2.5" fill="rgba(99,102,241,0.2)" />
        <rect x="82" y="94" width="44" height="4" rx="2" fill="rgba(99,102,241,0.15)" />
        <rect x="82" y="106" width="76" height="8" rx="4" fill="rgba(99,102,241,0.15)" />
        <rect x="82" y="120" width="76" height="10" rx="5" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
        <rect x="90" y="123" width="32" height="4" rx="2" fill="rgba(34,197,94,0.3)" />
        <path d="M170 105 l20 0 l0 30 l30 0" stroke="rgba(99,102,241,0.25)" strokeWidth="1.5" strokeDasharray="4 4" />
        <rect x="220" y="120" width="44" height="30" rx="6" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" fill="rgba(34,197,94,0.06)" />
        <rect x="228" y="128" width="28" height="5" rx="2.5" fill="rgba(34,197,94,0.2)" />
        <rect x="228" y="138" width="20" height="4" rx="2" fill="rgba(34,197,94,0.15)" />
        <text x="242" y="118" textAnchor="middle" fill="rgba(34,197,94,0.4)" fontSize="7">ORDER</text>
      </svg>
    ),
  },
  {
    problem: 'LTL rating is a black box and you never know if you\'re being overcharged',
    solution: 'Class-based LTL rating engine',
    description: 'Full LTL rating with NMFC freight class lookup, density-based class calculation, and weight break matrix pricing. Deficit weight optimization automatically selects the cheaper option when bumping to a higher weight break costs less. FAK overrides, minimum charge thresholds, and LTL accessorial codes (liftgate, residential, inside delivery). Re-weigh and re-class adjustments create audit-trailed cost and revenue corrections.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="20" y="140" width="240" height="4" rx="2" fill="rgba(255,255,255,0.05)" />
        <rect x="20" y="140" width="40" height="30" rx="0" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.25)" strokeWidth="1" />
        <rect x="70" y="120" width="40" height="50" rx="0" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.3)" strokeWidth="1" />
        <rect x="120" y="95" width="40" height="75" rx="0" fill="rgba(139,92,246,0.15)" stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
        <rect x="170" y="70" width="40" height="100" rx="0" fill="rgba(139,92,246,0.18)" stroke="rgba(139,92,246,0.35)" strokeWidth="1" />
        <rect x="220" y="50" width="40" height="120" rx="0" fill="rgba(59,130,246,0.15)" stroke="rgba(59,130,246,0.3)" strokeWidth="1" />
        <text x="40" y="138" textAnchor="middle" fill="rgba(99,102,241,0.4)" fontSize="7">M</text>
        <text x="90" y="118" textAnchor="middle" fill="rgba(99,102,241,0.4)" fontSize="7">500</text>
        <text x="140" y="93" textAnchor="middle" fill="rgba(139,92,246,0.4)" fontSize="7">1K</text>
        <text x="190" y="68" textAnchor="middle" fill="rgba(139,92,246,0.4)" fontSize="7">2K</text>
        <text x="240" y="48" textAnchor="middle" fill="rgba(59,130,246,0.4)" fontSize="7">5K</text>
        <path d="M40 140 L90 120 L140 95 L190 70 L240 50" stroke="rgba(34,197,94,0.4)" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
        <circle cx="140" cy="95" r="4" fill="rgba(34,197,94,0.5)" />
        <rect x="100" y="20" width="80" height="24" rx="6" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.3)" strokeWidth="1" />
        <text x="140" y="35" textAnchor="middle" fill="rgba(34,197,94,0.5)" fontSize="8" fontWeight="600">DEFICIT WEIGHT</text>
        <line x1="140" y1="44" x2="140" y2="91" stroke="rgba(34,197,94,0.2)" strokeWidth="1" strokeDasharray="3 3" />
        <text x="140" y="186" textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8">Weight Breaks (lbs)</text>
      </svg>
    ),
  },
  {
    problem: 'Cargo damage happens and nobody files a claim until the customer complains weeks later',
    solution: 'Auto-raised financial queries',
    description: 'When cargo goes missing at a stop, a misdrop is detected, or a cold chain shipment is quarantined, a financial query is automatically created with full context. Resolve disputes with optional credit note generation. Every query links back to the originating operational event for a complete audit trail.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <circle cx="80" cy="70" r="28" stroke="rgba(239,68,68,0.3)" strokeWidth="1.5" fill="rgba(239,68,68,0.06)" />
        <text x="80" y="66" textAnchor="middle" fill="rgba(239,68,68,0.5)" fontSize="20">!</text>
        <text x="80" y="78" textAnchor="middle" fill="rgba(239,68,68,0.3)" fontSize="6">EVENT</text>
        <path d="M108 70 l30 0" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" markerEnd="url(#arrowFQ)" />
        <defs>
          <marker id="arrowFQ" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6" fill="rgba(255,255,255,0.2)" />
          </marker>
        </defs>
        <rect x="140" y="44" width="120" height="52" rx="8" stroke="rgba(251,191,36,0.3)" strokeWidth="1.5" fill="rgba(251,191,36,0.05)" />
        <rect x="152" y="56" width="60" height="5" rx="2.5" fill="rgba(251,191,36,0.2)" />
        <rect x="152" y="66" width="96" height="4" rx="2" fill="rgba(251,191,36,0.12)" />
        <rect x="152" y="76" width="72" height="4" rx="2" fill="rgba(251,191,36,0.1)" />
        <text x="200" y="42" textAnchor="middle" fill="rgba(251,191,36,0.4)" fontSize="7" fontWeight="600">FINANCIAL QUERY</text>
        <path d="M200 96 l0 24" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeDasharray="3 3" />
        <rect x="150" y="124" width="100" height="44" rx="8" stroke="rgba(34,197,94,0.3)" strokeWidth="1.5" fill="rgba(34,197,94,0.05)" />
        <rect x="162" y="136" width="48" height="5" rx="2.5" fill="rgba(34,197,94,0.2)" />
        <rect x="162" y="146" width="76" height="4" rx="2" fill="rgba(34,197,94,0.12)" />
        <rect x="162" y="156" width="56" height="4" rx="2" fill="rgba(34,197,94,0.1)" />
        <text x="200" y="122" textAnchor="middle" fill="rgba(34,197,94,0.4)" fontSize="7" fontWeight="600">CREDIT NOTE</text>
      </svg>
    ),
  },
  {
    problem: 'Month-end financial reporting means exporting data from five systems into one spreadsheet',
    solution: 'Built-in financial reports and CSV exports',
    description: 'AR aging reports with distribution charts and customer breakdown. Carrier spend summaries showing total invoiced, approved, and paid per carrier. Margin analysis by customer with revenue, cost, and margin from shipment financial summaries. One-click CSV exports for invoice register, carrier invoice register, payment ledger, and charge detail - with date range and status filters.',
    illustration: (
      <svg viewBox="0 0 280 200" fill="none" className="w-full h-auto">
        <rect x="20" y="20" width="240" height="160" rx="10" stroke="rgba(99,102,241,0.2)" strokeWidth="1" fill="rgba(99,102,241,0.03)" />
        <rect x="36" y="36" width="80" height="10" rx="5" fill="rgba(99,102,241,0.15)" />
        <rect x="36" y="60" width="48" height="80" rx="4" fill="rgba(34,197,94,0.12)" stroke="rgba(34,197,94,0.25)" strokeWidth="1" />
        <rect x="92" y="76" width="48" height="64" rx="4" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.25)" strokeWidth="1" />
        <rect x="148" y="92" width="48" height="48" rx="4" fill="rgba(251,146,36,0.12)" stroke="rgba(251,146,36,0.25)" strokeWidth="1" />
        <rect x="204" y="108" width="48" height="32" rx="4" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.25)" strokeWidth="1" />
        <text x="60" y="56" textAnchor="middle" fill="rgba(34,197,94,0.4)" fontSize="7">Current</text>
        <text x="116" y="72" textAnchor="middle" fill="rgba(251,191,36,0.4)" fontSize="7">30d</text>
        <text x="172" y="88" textAnchor="middle" fill="rgba(251,146,36,0.4)" fontSize="7">60d</text>
        <text x="228" y="104" textAnchor="middle" fill="rgba(239,68,68,0.4)" fontSize="7">90d+</text>
        <line x1="36" y1="150" x2="252" y2="150" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <rect x="36" y="158" width="52" height="8" rx="4" fill="rgba(99,102,241,0.15)" stroke="rgba(99,102,241,0.25)" strokeWidth="1" />
        <rect x="44" y="160" width="20" height="4" rx="2" fill="rgba(99,102,241,0.25)" />
        <text x="140" y="188" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="7">AR Aging Report</text>
      </svg>
    ),
  },
]

const stats = [
  { value: '6', label: 'EDI Types' },
  { value: '3-Way', label: 'Freight Audit' },
  { value: 'Auto', label: 'Invoicing' },
  { value: 'LTL', label: 'Rating Engine' },
]

export default function Financial() {
  return (
    <div className="gradient-bg min-h-screen">
      {/* Hero */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary-600/8 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-20 flex flex-col items-center text-center" style={{ zIndex: 2 }}>
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to home
          </Link>

          <div className="glass-card rounded-2xl p-8 lg:p-10 max-w-3xl" style={{ backdropFilter: 'blur(16px)' }}>
            <AnimateIn animation="fade-in">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-6">
                <span className="text-sm font-medium text-primary-300">Financial Operations</span>
              </div>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={100}>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
                Stop chasing invoices.
                <br />
                <span className="gradient-text">Start getting paid.</span>
              </h1>
            </AnimateIn>

            <AnimateIn animation="fade-up" delay={200}>
              <p className="text-xl text-surface-300 leading-relaxed">
                Full AR/AP lifecycle built into the TMS. Customer invoicing, carrier freight audit,
                quoting with revision tracking, LTL rating, and financial reporting - all connected
                to your shipment data with zero manual re-entry.
              </p>
            </AnimateIn>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-surface-950 to-transparent" style={{ zIndex: 1 }} />
      </section>

      {/* Alternating Split Sections */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-32">
            {sections.map((item, i) => {
              const isImageLeft = i % 2 === 0
              return (
                <div key={i} className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
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

      {/* Stat Band */}
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

      {/* EDI Financial Types callout */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <AnimateIn animation="fade-up">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-white mb-4">EDI financial transactions</h2>
              <p className="text-surface-400 text-lg">Three EDI transaction types connect your financial workflows to trading partners electronically.</p>
            </div>
          </AnimateIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { code: '210', name: 'Freight Invoice', direction: 'Inbound', description: 'Parse carrier invoices automatically and trigger three-way freight audit matching.' },
              { code: '810', name: 'Invoice', direction: 'Outbound', description: 'Generate customer invoices in X12 format with full ISA/GS/ST envelope and line item detail.' },
              { code: '820', name: 'Payment/Remittance', direction: 'Inbound', description: 'Parse customer payment advice and auto-apply remittance to open invoices.' },
            ].map((edi, i) => (
              <AnimateIn key={edi.code} animation="fade-up" delay={i * 100}>
                <div className="glass-card rounded-xl p-6 h-full">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="text-2xl font-bold gradient-text">{edi.code}</div>
                    <div>
                      <div className="text-sm font-semibold text-white">{edi.name}</div>
                      <div className="text-xs text-surface-500">{edi.direction}</div>
                    </div>
                  </div>
                  <p className="text-sm text-surface-400 leading-relaxed">{edi.description}</p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>

      <MissingFeature />

      {/* CTA */}
      <section className="pb-32">
        <AnimateIn animation="scale-up">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Ready to streamline your financials?</h2>
            <p className="text-surface-400 mb-8 text-lg">Deploy Open TMS and get invoicing, freight audit, and financial reporting out of the box.</p>
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
        </AnimateIn>
      </section>
    </div>
  )
}
