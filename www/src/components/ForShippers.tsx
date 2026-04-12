export default function ForShippers() {
  const capabilities = [
    {
      title: 'Order to Delivery',
      description: 'Ingest orders via CSV, EDI 850, REST API, or manual entry. Convert to shipments with intelligent lane matching and multi-stop routing.',
    },
    {
      title: 'Real-Time Visibility',
      description: 'GPS tracking with geofence-based status updates. Traffic-aware ETA monitoring alerts you to delays before they become problems.',
    },
    {
      title: 'Exception Management',
      description: 'Auto-detect issues with the Triage Centre. Kanban-style workflow with priority escalation and CAPA reports for root cause analysis.',
    },
    {
      title: 'Compliance Ready',
      description: 'CFR 21 Part 11 cold chain logging, immutable audit trails, and auto-generated compliance reports. Built for pharma and food logistics.',
    },
    {
      title: 'Carrier Management',
      description: 'Tendering with broadcast and waterfall strategies. Compare bids, track carrier performance, and manage contract rates across lanes.',
    },
    {
      title: 'Warehouse Operations',
      description: 'Mobile-first launch app with barcode scanning, IoT device pairing, and pre-flight checks. Magic link QR auth for floor staff.',
    },
  ]

  return (
    <section id="shippers" className="relative py-32 bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left: content */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-6">
              <span className="text-sm font-medium text-primary-300">For Shippers & 3PLs</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Run your entire{' '}
              <span className="gradient-text">logistics operation</span>
            </h2>
            <p className="text-lg text-surface-400 leading-relaxed mb-12">
              From a single order to thousands of daily shipments, Open TMS scales with your operation.
              Multi-app architecture means dispatchers, warehouse staff, and admins each get a purpose-built interface.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {capabilities.map(cap => (
                <div key={cap.title} className="group">
                  <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary-500 group-hover:bg-primary-400 transition-colors" />
                    {cap.title}
                  </h3>
                  <p className="text-sm text-surface-400 leading-relaxed">{cap.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right: visual */}
          <div className="relative">
            <div className="glass-card rounded-2xl p-8 glow">
              {/* Terminal-style UI mockup */}
              <div className="rounded-xl bg-surface-900 border border-white/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-surface-900">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-xs text-surface-500 font-mono">Open TMS - Shipment Dashboard</span>
                </div>
                <div className="p-6 space-y-4 font-mono text-sm">
                  <div className="flex items-center justify-between text-surface-300">
                    <span>SHP-2024-0847</span>
                    <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs">In Transit</span>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-surface-500 mb-1">Origin</div>
                      <div className="text-surface-200">Chicago, IL</div>
                    </div>
                    <div>
                      <div className="text-surface-500 mb-1">Destination</div>
                      <div className="text-surface-200">Nashville, TN</div>
                    </div>
                    <div>
                      <div className="text-surface-500 mb-1">Carrier</div>
                      <div className="text-surface-200">Swift Transport</div>
                    </div>
                    <div>
                      <div className="text-surface-500 mb-1">ETA</div>
                      <div className="text-surface-200">Apr 12, 14:30</div>
                    </div>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="text-xs text-surface-500">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-primary-500" />
                      <span>Geofence exit detected at origin - 08:15</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-2 w-2 rounded-full bg-primary-500" />
                      <span>GPS update: I-65 S, Km 342 - 10:47</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-yellow-500" />
                      <span>ETA updated: +12 min (traffic) - 11:02</span>
                    </div>
                  </div>
                  <div className="h-px bg-white/5" />
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg bg-surface-800 p-3 text-center">
                      <div className="text-surface-500 mb-1">Temp</div>
                      <div className="text-blue-400 font-semibold">2.4&deg;C</div>
                    </div>
                    <div className="rounded-lg bg-surface-800 p-3 text-center">
                      <div className="text-surface-500 mb-1">Pallets</div>
                      <div className="text-white font-semibold">24/24</div>
                    </div>
                    <div className="rounded-lg bg-surface-800 p-3 text-center">
                      <div className="text-surface-500 mb-1">Distance</div>
                      <div className="text-white font-semibold">287 mi</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
