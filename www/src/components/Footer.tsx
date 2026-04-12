import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-white/5 bg-surface-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/" className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">
                Open <span className="text-primary-400">TMS</span>
              </span>
            </Link>
            <p className="text-sm text-surface-400 leading-relaxed">
              Enterprise-grade transportation management, open source and free forever.
            </p>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
            <ul className="space-y-3">
              <li><a href="/#features" className="text-sm text-surface-400 hover:text-white transition-colors">Features</a></li>
              <li><a href="/#carriers" className="text-sm text-surface-400 hover:text-white transition-colors">For Carriers</a></li>
              <li><a href="/#shippers" className="text-sm text-surface-400 hover:text-white transition-colors">For Shippers</a></li>
              <li><Link to="/docs" className="text-sm text-surface-400 hover:text-white transition-colors">Documentation</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Community</h3>
            <ul className="space-y-3">
              <li><a href="https://github.com/dominicfinn/open_tms" target="_blank" rel="noopener noreferrer" className="text-sm text-surface-400 hover:text-white transition-colors">GitHub</a></li>
              <li><a href="https://github.com/dominicfinn/open_tms/issues" target="_blank" rel="noopener noreferrer" className="text-sm text-surface-400 hover:text-white transition-colors">Issues</a></li>
              <li><a href="https://github.com/dominicfinn/open_tms/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener noreferrer" className="text-sm text-surface-400 hover:text-white transition-colors">Contributing</a></li>
              <li><Link to="/blog" className="text-sm text-surface-400 hover:text-white transition-colors">Blog</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-3">
              <li><a href="https://github.com/dominicfinn/open_tms#-quick-start" target="_blank" rel="noopener noreferrer" className="text-sm text-surface-400 hover:text-white transition-colors">Quick Start</a></li>
              <li><a href="https://github.com/dominicfinn/open_tms/blob/main/roadmap.md" target="_blank" rel="noopener noreferrer" className="text-sm text-surface-400 hover:text-white transition-colors">Roadmap</a></li>
              <li><a href="https://github.com/dominicfinn/open_tms/blob/main/LICENCE.md" target="_blank" rel="noopener noreferrer" className="text-sm text-surface-400 hover:text-white transition-colors">MIT License</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-surface-500">
            &copy; {new Date().getFullYear()} Open TMS. Released under the MIT License.
          </p>
          <p className="text-sm text-surface-500">
            Integrates with System Loco IoT hardware
          </p>
        </div>
      </div>
    </footer>
  )
}
