const techStack = [
  {
    category: 'Backend',
    items: [
      { name: 'Fastify', description: 'High-performance Node.js framework' },
      { name: 'Prisma', description: 'Type-safe ORM with 87+ models' },
      { name: 'PostgreSQL', description: 'Battle-tested relational database' },
      { name: 'pg-boss', description: 'PostgreSQL-backed job queues' },
    ],
  },
  {
    category: 'Frontend',
    items: [
      { name: 'React 18', description: 'Modern component architecture' },
      { name: 'TypeScript', description: 'Full type safety end to end' },
      { name: 'Vite', description: 'Lightning-fast build tooling' },
      { name: 'OpenStreetMap', description: 'Interactive shipment mapping' },
    ],
  },
  {
    category: 'Architecture',
    items: [
      { name: 'CQRS', description: 'Command/Query responsibility separation' },
      { name: 'Event Sourcing', description: 'Immutable domain event log' },
      { name: 'DI Container', description: 'Symbol-based dependency injection' },
      { name: 'Repository Pattern', description: 'Clean data access abstraction' },
    ],
  },
  {
    category: 'Infrastructure',
    items: [
      { name: 'Docker', description: 'Containerised deployment' },
      { name: 'Cloud Agnostic', description: 'AWS, GCP, Azure, or self-hosted' },
      { name: 'S3 Storage', description: 'Compatible with any S3 provider' },
      { name: 'Pluggable Email', description: 'SMTP, SendGrid, or SES' },
    ],
  },
]

export default function Platform() {
  return (
    <section className="relative py-32 bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-4 py-1.5 mb-6">
            <span className="text-sm font-medium text-primary-300">Technical Foundation</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
            Built on{' '}
            <span className="gradient-text">proven technology</span>
          </h2>
          <p className="text-lg text-surface-400 leading-relaxed">
            A modern, type-safe stack with enterprise patterns. CQRS event architecture means
            every state change is auditable, every integration is pluggable, and every query is fast.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {techStack.map(group => (
            <div key={group.category} className="glass-card rounded-2xl p-6">
              <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-6">{group.category}</h3>
              <div className="space-y-5">
                {group.items.map(item => (
                  <div key={item.name}>
                    <div className="text-sm font-semibold text-white mb-0.5">{item.name}</div>
                    <div className="text-xs text-surface-400">{item.description}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* System Loco integration callout */}
        <div className="mt-12 glass-card rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
          <div className="flex-shrink-0">
            <div className="h-14 w-14 rounded-xl bg-primary-600/20 flex items-center justify-center">
              <svg className="h-7 w-7 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z" />
              </svg>
            </div>
          </div>
          <div className="flex-grow">
            <h3 className="text-lg font-semibold text-white mb-2">System Loco IoT Integration</h3>
            <p className="text-sm text-surface-400 leading-relaxed">
              Works out of the box with System Loco hardware and IoT data platforms. GPS trackers, temperature sensors,
              door sensors, and BLE beacons  - all feeding real-time telemetry into your shipment tracking.
              WiFi and BLE arrival criteria for automatic stop-level status updates.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
