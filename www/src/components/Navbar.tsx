import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

const featurePages = [
  { href: '/features/operations', label: 'Operations', description: 'Shipments, tendering & EDI' },
  { href: '/features/triage', label: 'Triage Centre', description: 'Exception management' },
  { href: '/features/quality', label: 'Quality Centre', description: 'CAPA & cold chain compliance' },
  { href: '/features/reports', label: 'Reports', description: 'Analytics & compliance docs' },
  { href: '/features/warehouse', label: 'Warehouse', description: 'Mobile launch app' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [featuresOpen, setFeaturesOpen] = useState(false)
  const featuresRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    setFeaturesOpen(false)
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (featuresRef.current && !featuresRef.current.contains(e.target as Node)) {
        setFeaturesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const links = [
    { href: '/#carriers', label: 'For Carriers' },
    { href: '/#open-source', label: 'Open Source' },
    { href: '/blog', label: 'Blog' },
    { href: '/docs', label: 'Docs' },
  ]

  const isActive = (href: string) => {
    if (href.startsWith('/#')) return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-surface-950/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-600">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-tight">
              Open <span className="text-primary-400">TMS</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {/* Features dropdown */}
            <div ref={featuresRef} className="relative">
              <button
                onClick={() => setFeaturesOpen(!featuresOpen)}
                className={`flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/features')
                    ? 'text-white bg-white/5'
                    : 'text-surface-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Features
                <svg className={`h-4 w-4 transition-transform ${featuresOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {featuresOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-xl border border-white/10 bg-surface-950/95 backdrop-blur-xl shadow-2xl overflow-hidden">
                  {featurePages.map(fp => (
                    <Link
                      key={fp.href}
                      to={fp.href}
                      className="block px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <div className="text-sm font-medium text-white">{fp.label}</div>
                      <div className="text-xs text-surface-400">{fp.description}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'text-white bg-white/5'
                    : 'text-surface-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/dominicfinn/open_tms"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-300 hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
            <a
              href="https://github.com/dominicfinn/open_tms#-quick-start"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-500 hover:shadow-primary-500/30"
            >
              Get Started
            </a>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-surface-400 hover:text-white"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/5 bg-surface-950/95 backdrop-blur-xl">
          <div className="px-4 py-4 space-y-1">
            <div className="px-4 py-2 text-xs font-semibold text-surface-500 uppercase tracking-wider">Features</div>
            {featurePages.map(fp => (
              <Link
                key={fp.href}
                to={fp.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-lg text-sm font-medium text-surface-300 hover:text-white hover:bg-white/5"
              >
                {fp.label}
              </Link>
            ))}
            <div className="border-t border-white/5 my-2" />
            {links.map(link => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-3 rounded-lg text-sm font-medium text-surface-300 hover:text-white hover:bg-white/5"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://github.com/dominicfinn/open_tms"
              target="_blank"
              rel="noopener noreferrer"
              className="block px-4 py-3 rounded-lg text-sm font-medium text-primary-400 hover:text-primary-300"
            >
              View on GitHub
            </a>
          </div>
        </div>
      )}
    </nav>
  )
}
