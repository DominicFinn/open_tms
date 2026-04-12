import { Link } from 'react-router-dom'
import { articles } from '../content/articles'

const categoryColors: Record<string, string> = {
  engineering: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  product: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  guides: 'bg-green-500/10 text-green-400 border-green-500/20',
  announcements: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
}

export default function Blog() {
  return (
    <div className="min-h-screen bg-surface-950 pt-32 pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-16">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Blog</h1>
          <p className="text-lg text-surface-400">
            Engineering insights, product updates, and guides for logistics teams.
          </p>
        </div>

        {/* Articles */}
        <div className="space-y-8">
          {articles.map(article => (
            <Link
              key={article.slug}
              to={`/blog/${article.slug}`}
              className="block group"
            >
              <article className="glass-card rounded-2xl p-8 feature-card">
                <div className="flex items-center gap-3 mb-4">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${categoryColors[article.category]}`}>
                    {article.category}
                  </span>
                  <span className="text-sm text-surface-500">{article.date}</span>
                  <span className="text-sm text-surface-600">&middot;</span>
                  <span className="text-sm text-surface-500">{article.readTime}</span>
                </div>
                <h2 className="text-xl font-bold text-white mb-3 group-hover:text-primary-400 transition-colors">
                  {article.title}
                </h2>
                <p className="text-surface-400 leading-relaxed">
                  {article.excerpt}
                </p>
                <div className="mt-4 flex items-center gap-2 text-sm text-primary-400 group-hover:text-primary-300 transition-colors">
                  Read more
                  <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
