import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { roadmap } from '../../data/roadmap'
import RoadmapColumn from './RoadmapColumn'
import Footer from '../../components/Footer'

const STATUSES = ['done', 'in_progress', 'coming_soon']

// ─── Shield Icon ─────────────────────────────────────────────────────────────

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldIcon({ size = 20, color = '#0066FF', style }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true" style={style}>
      <path d={SHIELD_D} />
    </svg>
  )
}

// ─── Ripple ──────────────────────────────────────────────────────────────────

function useRipple() {
  const [ripples, setRipples] = useState([])
  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const sz = Math.max(rect.width, rect.height) * 2
    const x = e.clientX - rect.left - sz / 2
    const y = e.clientY - rect.top - sz / 2
    const id = Date.now()
    setRipples(prev => [...prev, { id, x, y, sz }])
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 420)
  }
  const rippleEls = ripples.map(({ id, x, y, sz }) => (
    <motion.span
      key={id}
      initial={{ scale: 0, opacity: 0.26 }}
      animate={{ scale: 3, opacity: 0 }}
      transition={{ duration: 0.4, ease: 'linear' }}
      className="absolute rounded-full bg-white/[0.26] pointer-events-none"
      style={{ width: sz, height: sz, left: x, top: y }}
    />
  ))
  return { handleClick, rippleEls }
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const navLinks = [
    { label: 'How It Works', href: '/#how-it-works' },
    { label: 'Features', href: '/#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[200] h-[66px] flex items-center justify-between px-12 border-b transition-all duration-200 ${
          scrolled ? 'border-[rgba(0,102,255,0.18)]' : 'border-white/[0.06]'
        }`}
        style={{
          background: scrolled ? 'rgba(6,14,24,0.94)' : 'rgba(6,14,24,0.82)',
          backdropFilter: scrolled ? 'blur(24px)' : 'blur(16px)',
          WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'blur(16px)',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <a href="/" className="flex items-center gap-2.5 flex-shrink-0 no-underline">
          <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className={`text-[0.875rem] font-medium transition-colors duration-150 relative no-underline after:content-[''] after:absolute after:bottom-[-3px] after:left-0 after:right-0 after:h-px after:bg-blue-500 after:transition-transform after:duration-150 after:origin-left ${
                href === '/about'
                  ? 'text-white after:scale-x-100'
                  : 'text-white/65 hover:text-white after:scale-x-0 hover:after:scale-x-100'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <a href="/login" className="relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline px-5 py-2 text-[0.8rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">Login</a>
          <a href="/login" className="relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline px-5 py-2 text-[0.8rem] bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-0.5">Try Free</a>
        </div>

        <button
          className="md:hidden flex flex-col justify-center items-center gap-[5px] w-10 h-10 bg-transparent border border-white/[0.18] rounded-lg cursor-pointer hover:border-white/40 transition-colors"
          onClick={() => setMobileOpen(o => !o)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="block w-4 h-0.5 bg-white/85 rounded-sm"
              animate={
                mobileOpen
                  ? i === 0 ? { y: 7, rotate: 45 }
                  : i === 1 ? { opacity: 0 }
                  : { y: -7, rotate: -45 }
                  : { y: 0, rotate: 0, opacity: 1 }
              }
              transition={{ duration: i === 1 ? 0.2 : 0.25 }}
            />
          ))}
        </button>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="md:hidden fixed top-[66px] left-0 right-0 z-[190] border-b border-white/[0.07] px-6 pt-5 pb-7 flex flex-col gap-5"
            style={{ background: 'rgba(6,14,24,0.98)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          >
            <div className="flex flex-col gap-1">
              {navLinks.map(({ label, href }) => (
                <a key={label} href={href} className="block py-3 px-2 text-base font-medium text-white/65 border-b border-white/[0.06] hover:text-white transition-colors no-underline">{label}</a>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <a href="/login" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45 no-underline rounded-xl font-semibold text-center font-sans">Login</a>
              <a href="/login" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-blue-600 text-white no-underline rounded-xl font-semibold text-center font-sans">Start Free</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Reveal ──────────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const itemsByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = roadmap.filter((item) => item.status === s)
    return acc
  }, {})

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[var(--bg-base)]"
      style={{
        backgroundImage: 'var(--dot-bg-image)',
        backgroundSize: '28px 28px',
      }}
    >
      <Navbar />

      <main className="pt-[66px]">

        {/* ── HERO ─────────────────────────────────────────────────────────── */}
        <section className="pt-24 pb-16 text-center">
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-widest text-blue-400">Public Roadmap</span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="font-serif text-4xl md:text-5xl text-white mt-3">
                What we're building
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="font-sans text-lg text-slate-400 mt-4 max-w-xl mx-auto leading-relaxed">
                Here's what we've shipped, what we're building, and what's next.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── ROADMAP GRID ─────────────────────────────────────────────────── */}
        <section className="max-w-[1120px] mx-auto px-6 pb-20">
          <Reveal>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {STATUSES.map((status) => (
                <RoadmapColumn key={status} status={status} items={itemsByStatus[status]} />
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── FEATURE REQUEST ──────────────────────────────────────────────── */}
        <div className="text-center pb-20 px-6">
          <Reveal>
            <p className="font-sans text-sm text-slate-500">
              Have a feature request?{' '}
              <a
                href="mailto:hello@fypro.com.ng"
                className="text-blue-400 hover:text-blue-300 transition-colors duration-150 no-underline"
              >
                Email hello@fypro.com.ng
              </a>
            </p>
          </Reveal>
        </div>

      </main>

      <Footer />
    </motion.div>
  )
}
