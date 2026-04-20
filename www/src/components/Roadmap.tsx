const completed = [
  'Order Management & CSV Import',
  'Shipment Lifecycle & Tracking',
  'Customer, Carrier & Lane Management',
  'EDI 850, 856, 204, 990, 214, 997',
  'Trading Partner Hub',
  'Carrier Tendering (Broadcast & Waterfall)',
  'Carrier Portal with Bid Submission',
  'Cold Chain Monitoring & Compliance',
  'CQRS Event Architecture',
  'IoT GPS & Sensor Telemetry',
  'ETA Monitoring (TomTom/HERE/Valhalla)',
  'Triage & Issue Management',
  'Warehouse Launch App',
  'Document Templates & PDF Generation',
  'Custom Fields with Versioning',
  'White-Label Theming',
  'Email & In-App Notifications',
  'CAPA Reports',
  'Cargo Scan Reconciliation',
  'OAuth SSO (Google/Microsoft)',
  'Charges & Rating Engine',
  'Quotes with Revision Tracking',
  'Customer Invoicing (AR)',
  'Carrier Invoices & Freight Audit (AP)',
  'Financial Queries & Credit Notes',
  'LTL Class-Based Rating',
  'EDI 210, 810, 820 Financial Transactions',
  'AR Aging & Financial Reports',
  'CSV Exports for Accounting',
  'Warehouse Management (Receiving, Putaway, Picking, Packing, Load Plans)',
  'Cycle Counting & Event-Driven Replenishment',
  'Cartonization + Container Intelligence with Hazmat Segregation',
  'Pallet Types & Palletization Planner',
  'Pack Audit (Scale + Dim-Weight Variance)',
  'Cutoff-at-Risk Monitor with Auto-Triage',
  'Full Returns / RMA with 7 Dispositions + Carrier Labels',
  'Customer Portal + Developer Area (API Keys, Signed Webhooks, EDI)',
  'EDI 940 / 945 (Warehouse Shipping Order + Advice)',
  'EDI 180 (Return Merchandise Authorization)',
  'Operations KPI Dashboard',
  'Warehouse Mobile PWA (Receive / Pack / Pick / Putaway / Returns)',
]

const upcoming = [
  { title: 'Driver Mobile App', description: 'Status updates, signature capture, photo POD, and offline GPS tracking' },
  { title: 'N8N Workflow Integration', description: 'Custom automation nodes for event-driven logistics workflows' },
  { title: 'Multi-Language Support', description: 'UI translations, RTL layouts, and localised content' },
  { title: 'Advanced Reporting', description: 'Operational dashboards, carrier scorecards, and lane spend analysis' },
  { title: 'Carrier Intelligence', description: 'Performance scoring, FMCSA integration, risk assessment, and onboarding workflows' },
  { title: 'Route Optimization', description: 'Multi-stop TSP solver, traffic analysis, and carbon footprint calculation' },
  { title: 'Indoor RTLS Heatmap', description: 'Real-time location tracking of operators, forklifts, and trackable units inside the four walls' },
  { title: 'Live FedEx/UPS/DHL Return Label APIs', description: 'Real carrier API integrations for return label generation and pickup scheduling' },
]

export default function Roadmap() {
  return (
    <section className="relative py-32 bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-6">
            <span className="text-sm font-medium text-primary-300">Roadmap</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Shipped & <span className="gradient-text">coming soon</span>
          </h2>
          <p className="text-lg text-surface-400 leading-relaxed">
            Open TMS is under active development with regular releases.
            Here's what's already shipped and what's on the horizon.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Completed */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-8 rounded-lg bg-green-600/20 flex items-center justify-center">
                <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Shipped</h3>
              <span className="text-sm text-surface-500">({completed.length} features)</span>
            </div>
            <div className="space-y-3">
              {completed.map(item => (
                <div key={item} className="flex items-center gap-3 text-sm">
                  <svg className="h-4 w-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-surface-300">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="h-8 w-8 rounded-lg bg-primary-600/20 flex items-center justify-center">
                <svg className="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white">Coming Soon</h3>
            </div>
            <div className="space-y-4">
              {upcoming.map(item => (
                <div key={item.title} className="glass-card rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-1">{item.title}</h4>
                  <p className="text-xs text-surface-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <a
                href="https://github.com/dominicfinn/open_tms/blob/main/roadmap.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                View full roadmap on GitHub
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
