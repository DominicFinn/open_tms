export default function ForCarriers() {
  return (
    <section id="carriers" className="relative py-32 bg-surface-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          {/* Left: visual */}
          <div className="order-2 lg:order-1">
            <div className="glass-card rounded-2xl p-8">
              <div className="rounded-xl bg-surface-900 border border-white/5 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-surface-900">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                  <div className="h-3 w-3 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-xs text-surface-500 font-mono">Carrier Portal - Active Tenders</span>
                </div>
                <div className="p-6 space-y-4">
                  {/* Tender cards */}
                  {[
                    { id: 'TND-2891', route: 'Dallas, TX → Memphis, TN', rate: '$2,450', deadline: '2h 15m', equipment: '53\' Dry Van' },
                    { id: 'TND-2893', route: 'Atlanta, GA → Miami, FL', rate: '$1,890', deadline: '5h 30m', equipment: '53\' Reefer' },
                    { id: 'TND-2897', route: 'Chicago, IL → Detroit, MI', rate: '$1,150', deadline: '12h 45m', equipment: 'Flatbed' },
                  ].map(tender => (
                    <div key={tender.id} className="rounded-lg border border-white/5 bg-surface-800/50 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-sm text-primary-400">{tender.id}</span>
                        <span className="text-xs text-yellow-400">{tender.deadline} left</span>
                      </div>
                      <div className="text-sm text-surface-200 font-medium mb-2">{tender.route}</div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-surface-400">
                          <span>{tender.equipment}</span>
                          <span className="text-surface-600">&middot;</span>
                          <span>Target: {tender.rate}</span>
                        </div>
                        <button className="px-3 py-1.5 rounded-lg bg-primary-600/20 text-primary-400 text-xs font-medium hover:bg-primary-600/30 transition-colors">
                          Place Bid
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Stats bar */}
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">73%</div>
                      <div className="text-xs text-surface-500">Win Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white">12</div>
                      <div className="text-xs text-surface-500">Active Bids</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-400">47</div>
                      <div className="text-xs text-surface-500">Loads Won</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: content */}
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent-500/20 bg-accent-500/10 px-4 py-1.5 mb-6">
              <span className="text-sm font-medium text-accent-400">For Carriers</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Win more freight.{' '}
              <span className="gradient-text">Move faster.</span>
            </h2>
            <p className="text-lg text-surface-400 leading-relaxed mb-10">
              The carrier portal gives your team direct access to tenders, bid submission,
              and load tracking. No phone tag. No email chains. Respond to tenders in seconds.
            </p>

            <div className="space-y-6">
              {[
                {
                  title: 'Dedicated Carrier Portal',
                  description: 'Separate login and dashboard for your team. View active tenders, submit bids with rate and transit time, and track your win rate over time.',
                },
                {
                  title: 'EDI 204/990 Integration',
                  description: 'Receive load tenders via EDI 204 and respond with EDI 990 — automatically. No portal login needed for EDI-capable carriers.',
                },
                {
                  title: 'Waterfall & Broadcast Tenders',
                  description: 'Participate in broadcast tenders where all carriers compete, or waterfall tenders where you get first right of refusal.',
                },
                {
                  title: 'Full Bid History',
                  description: 'Track every bid you\'ve submitted — won, lost, pending, or expired. Complete transparency on tender outcomes and historical rates.',
                },
              ].map(item => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 flex-shrink-0">
                    <div className="h-8 w-8 rounded-lg bg-accent-600/20 flex items-center justify-center">
                      <svg className="h-4 w-4 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-surface-400 leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
