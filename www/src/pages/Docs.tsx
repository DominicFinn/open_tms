import { Link } from 'react-router-dom'

const sections = [
  {
    title: 'Getting Started',
    items: [
      { title: 'Quick Start', href: 'https://github.com/dominicfinn/open_tms#-quick-start', external: true },
      { title: 'Deployment Guide', href: 'https://github.com/dominicfinn/open_tms/blob/main/DEPLOYMENT.md', external: true },
      { title: 'Docker Compose', href: 'https://github.com/dominicfinn/open_tms/blob/main/docker-compose.yml', external: true },
    ],
  },
  {
    title: 'Architecture',
    items: [
      { title: 'Domain Behaviours', href: 'https://github.com/dominicfinn/open_tms/blob/main/docs/DOMAIN_BEHAVIOURS.md', external: true },
      { title: 'Event Architecture', href: 'https://github.com/dominicfinn/open_tms/blob/main/docs/EVENT_ARCHITECTURE_PLAN.md', external: true },
      { title: 'ETA Monitoring', href: 'https://github.com/dominicfinn/open_tms/blob/main/docs/ETA_MONITORING_GUIDE.md', external: true },
    ],
  },
  {
    title: 'API Reference',
    items: [
      { title: 'Swagger/OpenAPI', description: 'Full interactive API documentation available at /docs on your deployment' },
      { title: 'Event Export API', description: 'Queryable event store with cursor pagination at /api/v1/events' },
      { title: 'Customer API', description: 'External REST API for programmatic order creation and tracking' },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { title: 'EDI Configuration', description: 'X12 850, 856, 204, 990, 214, 997  - Trading Partner setup guide' },
      { title: 'IoT & Webhooks', description: 'GPS/sensor data ingestion via webhook endpoints' },
      { title: 'System Loco', description: 'Out-of-the-box integration with System Loco IoT hardware' },
    ],
  },
  {
    title: 'Guides',
    items: [
      { title: 'Cold Chain Setup', href: '/blog/cold-chain-compliance-open-tms', external: false },
      { title: 'Carrier Tendering', href: '/blog/carrier-tendering-guide', external: false },
      { title: 'Pallet Tracking', href: '/blog/pallet-level-tracking-digital-twins', external: false },
    ],
  },
  {
    title: 'Contributing',
    items: [
      { title: 'Contributing Guide', href: 'https://github.com/dominicfinn/open_tms/blob/main/CONTRIBUTING.md', external: true },
      { title: 'Roadmap', href: 'https://github.com/dominicfinn/open_tms/blob/main/roadmap.md', external: true },
      { title: 'Report Issues', href: 'https://github.com/dominicfinn/open_tms/issues', external: true },
    ],
  },
]

export default function Docs() {
  return (
    <div className="min-h-screen bg-surface-950 pt-32 pb-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Documentation</h1>
          <p className="text-lg text-surface-400 max-w-2xl">
            Everything you need to deploy, configure, and extend Open TMS.
            Full API documentation is available via Swagger on your running instance.
          </p>
        </div>

        {/* Docs grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map(section => (
            <div key={section.title} className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-white mb-5">{section.title}</h2>
              <div className="space-y-4">
                {section.items.map(item => (
                  <div key={item.title}>
                    {'href' in item && item.href ? (
                      item.external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-2"
                        >
                          <span className="text-sm font-medium text-surface-200 group-hover:text-primary-400 transition-colors">
                            {item.title}
                          </span>
                          <svg className="h-3.5 w-3.5 text-surface-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                        </a>
                      ) : (
                        <Link
                          to={item.href}
                          className="text-sm font-medium text-surface-200 hover:text-primary-400 transition-colors"
                        >
                          {item.title}
                        </Link>
                      )
                    ) : (
                      <div>
                        <div className="text-sm font-medium text-surface-200">{item.title}</div>
                        {'description' in item && (
                          <div className="text-xs text-surface-500 mt-1">{item.description}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* API callout */}
        <div className="mt-12 glass-card rounded-2xl p-8 text-center">
          <h3 className="text-xl font-bold text-white mb-3">Interactive API Documentation</h3>
          <p className="text-surface-400 max-w-xl mx-auto mb-6">
            Deploy Open TMS and visit <code className="px-2 py-0.5 rounded bg-surface-800 text-primary-300 text-sm font-mono">/docs</code> for
            full Swagger/OpenAPI documentation with try-it-now functionality for every endpoint.
          </p>
          <a
            href="https://github.com/dominicfinn/open_tms#-quick-start"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-500"
          >
            Deploy to see API docs
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  )
}
