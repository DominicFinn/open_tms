import { useRef, useEffect, useState } from 'react'
import MockupKanban from './MockupKanban'
import MockupDashboard from './MockupDashboard'
import MockupMap from './MockupMap'
import './mockup-animations.css'

export default function MockupBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => setPaused(!entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 hidden lg:block ${paused ? 'mockup-paused' : ''}`}
      style={{ pointerEvents: 'none', zIndex: 1 }}
    >
      {/* Kanban - top right */}
      <div style={{
        position: 'absolute',
        top: '8%',
        right: '-4%',
        opacity: 0.55,
        transform: 'rotate(-3deg) scale(1.15)',
        animation: 'panel-float 6s ease-in-out infinite',
      }}>
        <MockupKanban />
      </div>

      {/* Dashboard - center right */}
      <div style={{
        position: 'absolute',
        top: '38%',
        right: '4%',
        opacity: 0.55,
        transform: 'rotate(2deg) scale(1.1)',
        animation: 'panel-float 6s ease-in-out infinite',
        animationDelay: '-2s',
      }}>
        <MockupDashboard />
      </div>

      {/* Map - bottom right */}
      <div style={{
        position: 'absolute',
        top: '60%',
        right: '-6%',
        opacity: 0.55,
        transform: 'rotate(-1.5deg) scale(1.05)',
        animation: 'panel-float 6s ease-in-out infinite',
        animationDelay: '-4s',
      }}>
        <MockupMap />
      </div>
    </div>
  )
}
