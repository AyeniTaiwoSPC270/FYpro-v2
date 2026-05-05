import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

export default function RouteProgressBar() {
  const location = useLocation()
  const barRef = useRef(null)
  const prevPathRef = useRef(location.pathname)
  const timerRef = useRef(null)

  useEffect(() => {
    if (location.pathname === prevPathRef.current) return
    prevPathRef.current = location.pathname

    const bar = barRef.current
    if (!bar) return

    clearTimeout(timerRef.current)

    // Reset without transition
    bar.style.transition = 'none'
    bar.style.width = '0%'
    bar.style.opacity = '1'

    // Force reflow so the reset applies before the next transition
    bar.getBoundingClientRect()

    // Race to ~85% to give a sense of progress
    bar.style.transition = 'width 320ms cubic-bezier(0.4, 0, 0.2, 1)'
    bar.style.width = '85%'

    // Complete and fade out
    timerRef.current = setTimeout(() => {
      bar.style.transition = 'width 120ms ease-out'
      bar.style.width = '100%'
      setTimeout(() => {
        bar.style.transition = 'opacity 180ms ease-out'
        bar.style.opacity = '0'
      }, 120)
    }, 320)

    return () => clearTimeout(timerRef.current)
  }, [location.pathname])

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        ref={barRef}
        style={{
          height: '100%',
          width: '0%',
          opacity: 0,
          background: 'linear-gradient(to right, #0066FF, #3B82F6)',
          boxShadow: '0 0 10px rgba(0, 102, 255, 0.55)',
        }}
      />
    </div>
  )
}
