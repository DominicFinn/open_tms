import { ReactNode } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getArticle } from '../content/articles'

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const article = slug ? getArticle(slug) : undefined

  if (!article) {
    return (
      <div className="min-h-screen bg-surface-950 pt-32 pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl font-bold mb-4">Article not found</h1>
          <Link to="/blog" className="text-primary-400 hover:text-primary-300">
            Back to blog
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-surface-950 pt-32 pb-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        {/* Back link */}
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-surface-400 hover:text-white transition-colors mb-8"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to blog
        </Link>

        {/* Article header */}
        <header className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-sm text-surface-500">{article.date}</span>
            <span className="text-sm text-surface-600">&middot;</span>
            <span className="text-sm text-surface-500">{article.readTime}</span>
            <span className="text-sm text-surface-600">&middot;</span>
            <span className="text-sm text-surface-500">{article.author}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            {article.title}
          </h1>
          <p className="text-xl text-surface-400 leading-relaxed">
            {article.excerpt}
          </p>
        </header>

        {/* Article content */}
        <div className="prose prose-invert max-w-none">
          <MarkdownContent content={article.content} />
        </div>
      </div>
    </div>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.trim().split('\n')
  const elements: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code blocks
    if (line.trim().startsWith('```')) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      elements.push(
        <pre key={key++} className="rounded-xl bg-surface-900 border border-white/5 p-6 overflow-x-auto my-6">
          <code className="text-sm text-surface-300 font-mono">{codeLines.join('\n')}</code>
        </pre>
      )
      i++
      continue
    }

    // Headers
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} className="text-2xl font-bold text-white mt-12 mb-4">
          {line.replace('## ', '')}
        </h2>
      )
      i++
      continue
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} className="text-xl font-semibold text-white mt-8 mb-3">
          {line.replace('### ', '')}
        </h3>
      )
      i++
      continue
    }

    // List items
    if (line.trim().startsWith('- ')) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().replace('- ', ''))
        i++
      }
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-2 my-4 text-surface-300">
          {items.map((item, idx) => (
            <li key={idx}>{formatInlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line.trim())) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      elements.push(
        <ol key={key++} className="list-decimal list-inside space-y-2 my-4 text-surface-300">
          {items.map((item, idx) => (
            <li key={idx}>{formatInlineMarkdown(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      i++
      continue
    }

    // Paragraph
    elements.push(
      <p key={key++} className="text-surface-300 leading-relaxed my-4">
        {formatInlineMarkdown(line)}
      </p>
    )
    i++
  }

  return <>{elements}</>
}

function formatInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Bold
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    // Code
    const codeMatch = remaining.match(/`(.+?)`/)

    const boldIdx = boldMatch ? remaining.indexOf(boldMatch[0]) : Infinity
    const codeIdx = codeMatch ? remaining.indexOf(codeMatch[0]) : Infinity

    if (boldIdx === Infinity && codeIdx === Infinity) {
      parts.push(remaining)
      break
    }

    if (boldIdx < codeIdx && boldMatch) {
      parts.push(remaining.slice(0, boldIdx))
      parts.push(<strong key={key++} className="text-white font-semibold">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldIdx + boldMatch[0].length)
    } else if (codeMatch) {
      parts.push(remaining.slice(0, codeIdx))
      parts.push(<code key={key++} className="px-1.5 py-0.5 rounded bg-surface-800 text-primary-300 text-sm font-mono">{codeMatch[1]}</code>)
      remaining = remaining.slice(codeIdx + codeMatch[0].length)
    }
  }

  return parts
}
