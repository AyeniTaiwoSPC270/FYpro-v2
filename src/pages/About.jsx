import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

// ─── Shield Icon ──────────────────────────────────────────────────────────────

function ShieldIcon({ size = 20, style }) {
  return (
    <img src="/fypro-logo.png" alt="FYPro" width={size} height={size} aria-hidden="true" style={style} />
  )
}

// ─── Ripple ───────────────────────────────────────────────────────────────────

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

// ─── Navbar ───────────────────────────────────────────────────────────────────

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
          <a href="/login" className="relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline px-5 py-2 text-[0.8rem] bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-0.5" style={{ boxShadow: undefined }}>Try Free</a>
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

// ─── Reveal ───────────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: '0px 0px -32px 0px', amount: 0.12 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] py-8" style={{ background: 'var(--bg-sidebar)' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
          <a href="/" className="flex items-center gap-2 no-underline">
            <ShieldIcon size={22} />
            <span className="font-serif text-xl text-white">
              <span>FY</span><span style={{ color: '#0066FF' }}>Pro</span>
            </span>
          </a>
          <p className="text-slate-500 text-sm text-center font-sans">
            © 2026 FYPro. Built for African students.
          </p>
          <div className="flex gap-6">
            <a href="/privacy" className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans">Privacy Policy</a>
            <a href="/terms" className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function About() {
  const navigate = useNavigate()
  const { handleClick: rippleClick, rippleEls } = useRipple()

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

        {/* ── SECTION 1: HERO ─────────────────────────────────────────────── */}
        <section className="pt-24 pb-16 text-center">
          <div className="max-w-4xl mx-auto px-6">
            <Reveal>
              <span className="font-mono text-xs uppercase tracking-widest text-blue-400">Our Story</span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="font-serif text-4xl md:text-5xl text-white mt-3">
                Built by a student. For students.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="font-sans text-lg text-slate-400 mt-4 max-w-2xl mx-auto leading-relaxed">
                FYPro was born out of frustration — the same frustration every final year student in Nigeria knows too well.
              </p>
            </Reveal>
          </div>
        </section>

        {/* ── SECTION 2: THE STORY ────────────────────────────────────────── */}
        <section className="mt-16 max-w-2xl mx-auto px-6">
          <div className="flex flex-col gap-6">
            {[
              "In Nigeria, the gap between a student with an excellent supervisor and one with none is enormous. Some supervisors meet their students twice a semester. Some never at all. And yet both students face the same examination panel on defense day.",
              "FYPro started as a hackathon project at the University of Lagos — built in two weeks by Taiwo Ayeni, a 200-level Metallurgical and Materials Engineering student who was tired of watching his senior colleagues struggle through their final year projects alone.",
              "The question that drove every design decision was simple: what would it look like if every student had access to a brilliant, patient supervisor who was available at 2am, never judged them for not knowing something, and remembered every detail of their project?",
              "FYPro is the answer we built. Not a tool that writes your project for you — but one that thinks with you. Validates your topic. Maps your chapters. Recommends your methodology. Prepares you for the questions your panel will ask. And when the defense comes — puts you in the hot seat first, so the real thing feels familiar.",
              "We are just getting started. But the mission is clear: no Nigerian student should walk into their final year defense unprepared because they could not afford a good supervisor.",
            ].map((para, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <p className="font-sans text-slate-300 text-base leading-loose">{para}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: FOUNDER CARD ─────────────────────────────────────── */}
        <section className="mt-20 max-w-2xl mx-auto px-6">
          <Reveal>
            <div
              className="rounded-2xl border border-[var(--border-color)] p-8"
              style={{ background: 'var(--bg-card)' }}
            >
              <div className="flex flex-row gap-6 items-start">
                {/* Avatar */}
                <div
                  className="flex-shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center border-2 border-blue-500"
                  style={{ background: 'rgba(37,99,235,0.2)' }}
                >
                  <span className="font-serif text-2xl text-blue-400">TA</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="font-sans text-xl font-semibold text-white">Taiwo Ayeni</div>
                  <div className="font-mono text-xs text-blue-400 uppercase tracking-wider mt-1">Founder, FYPro</div>
                  <div className="font-sans text-slate-500 text-xs mt-1">200-level · Metallurgical &amp; Materials Engineering · UNILAG</div>
                  <p className="font-sans text-slate-400 text-sm mt-3 leading-relaxed">
                    Built FYPro during the CBC UNILAG Claude AI Hackathon. Metallurgy student by day, product builder by night. Believes African students deserve world-class tools.
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── SECTION 4: MISSION QUOTE ────────────────────────────────────── */}
        <section className="mt-20 max-w-2xl mx-auto px-6 text-center">
          <Reveal>
            <div className="font-serif text-8xl text-blue-600/30 leading-none select-none" aria-hidden="true">&ldquo;</div>
            <blockquote className="font-serif text-2xl text-white leading-relaxed mt-2">
              No Nigerian student should walk into their defense unprepared because they couldn&apos;t afford a good supervisor.
            </blockquote>
            <cite className="not-italic block font-mono text-xs text-slate-500 uppercase tracking-widest mt-6">
              — Taiwo Ayeni, Founder
            </cite>
          </Reveal>
        </section>

        {/* ── SECTION 5: STATS ────────────────────────────────────────────── */}
        <section className="mt-20 max-w-3xl mx-auto px-6">
          <Reveal>
            <div className="flex flex-col sm:flex-row gap-6">
              {[
                { number: '500,000+', label: 'Nigerian final year students annually' },
                { number: '6 Steps', label: 'From rough idea to defense-ready' },
                { number: '₦0', label: 'To get started today' },
              ].map(({ number, label }) => (
                <div
                  key={label}
                  className="flex-1 rounded-2xl border border-[var(--border-color)] p-8 text-center"
                  style={{ background: 'var(--bg-card)' }}
                >
                  <div className="font-serif text-4xl text-white">{number}</div>
                  <div className="font-sans text-slate-400 text-sm mt-2">{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── SECTION 6: VALUES ───────────────────────────────────────────── */}
        <section className="mt-20 max-w-3xl mx-auto px-6">
          <Reveal>
            <h2 className="font-serif text-3xl text-white text-center mb-10">What we believe</h2>
          </Reveal>
          <div className="flex flex-col sm:flex-row gap-6">
            {[
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 256 256" fill="#60A5FA">
                    <path d={SHIELD_D} />
                  </svg>
                ),
                title: 'Guidance over generation',
                body: 'FYPro thinks with you, not for you. Your project stays yours.',
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                  </svg>
                ),
                title: 'African context first',
                body: 'Built for Nigerian universities, UNILAG faculty structures, and the realities of African undergraduate research.',
              },
              {
                icon: (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                ),
                title: 'Accessible to everyone',
                body: 'The core workflow is free. Every student gets a fighting chance regardless of their supervisor situation.',
              },
            ].map(({ icon, title, body }) => (
              <Reveal key={title} delay={0.05} className="flex-1">
                <div
                  className="rounded-2xl border border-[var(--border-color)] p-6 h-full"
                  style={{ background: 'var(--bg-card)' }}
                >
                  {icon}
                  <div className="font-sans text-white font-semibold mt-4">{title}</div>
                  <p className="font-sans text-slate-400 text-sm mt-2 leading-relaxed">{body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── SECTION 7: BOTTOM CTA ───────────────────────────────────────── */}
        <section className="mt-24 mb-24 text-center px-6">
          <Reveal>
            <h2 className="font-serif text-4xl text-white">Try FYPro today.</h2>
            <p className="font-sans text-slate-400 mt-3">Free to start. No credit card required.</p>
            <button
              className="relative overflow-hidden inline-block bg-blue-600 hover:bg-blue-500 text-white font-sans font-semibold rounded-xl px-10 py-4 mt-8 transition-all duration-200 hover:-translate-y-0.5 border-0 cursor-pointer"
              style={{ boxShadow: undefined }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 8px 20px rgba(59,130,246,0.4)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
              onClick={() => navigate('/signup')}
            >
              Get Started Free
            </button>
          </Reveal>
        </section>

      </main>

      <Footer />
    </motion.div>
  )
}
