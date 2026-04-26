import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Constants ────────────────────────────────────────────────────────────────

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldIcon({ size = 20, color = '#0066FF' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true">
      <path d={SHIELD_D} />
    </svg>
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
                href === '/contact'
                  ? 'text-white after:scale-x-100'
                  : 'text-white/65 hover:text-white after:scale-x-0 hover:after:scale-x-100'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <a
            href="/login"
            className="relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline px-5 py-2 text-[0.8rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]"
          >
            Login
          </a>
          <a
            href="/login"
            className="relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline px-5 py-2 text-[0.8rem] bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-0.5"
          >
            Try Free
          </a>
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
                <a
                  key={label}
                  href={href}
                  className="block py-3 px-2 text-base font-medium text-white/65 border-b border-white/[0.06] hover:text-white transition-colors no-underline"
                >
                  {label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <a href="/login" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-transparent text-white border border-white/[0.22] no-underline rounded-xl font-semibold text-center font-sans">Login</a>
              <a href="/login" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-blue-600 text-white no-underline rounded-xl font-semibold text-center font-sans">Start Free</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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

// ─── Success Toast ────────────────────────────────────────────────────────────

function SuccessToast({ visible }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3.5 rounded-xl font-sans text-sm font-medium text-white whitespace-nowrap"
          style={{
            background: 'rgba(22,163,74,0.96)',
            boxShadow: '0 8px 32px rgba(22,163,74,0.35), 0 2px 8px rgba(0,0,0,0.3)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Message sent! We'll get back to you within 24 hours.
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function EnvelopeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="#60A5FA" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

// ─── Info Card ────────────────────────────────────────────────────────────────

function InfoCard({ icon, title, value, note }) {
  return (
    <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-6">
      {icon}
      <div className="text-white font-semibold mt-3 font-sans">{title}</div>
      <div className="text-blue-400 text-sm mt-1 font-sans hover:text-blue-300 cursor-pointer transition-colors duration-150">{value}</div>
      <div className="text-slate-500 text-xs mt-1 font-sans">{note}</div>
    </div>
  )
}

// ─── Submit Button ────────────────────────────────────────────────────────────

function SubmitButton({ children }) {
  const { handleClick, rippleEls } = useRipple()
  return (
    <button
      type="submit"
      onClick={handleClick}
      className="relative overflow-hidden w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-4 transition-all duration-200 hover:-translate-y-0.5 font-sans text-sm mt-2 cursor-pointer border-0"
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 20px rgba(59,130,246,0.4)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '' }}
    >
      {children}
      {rippleEls}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const INPUT_CLS = 'bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-sans text-sm'
const LABEL_CLS = 'block text-slate-400 text-sm font-medium mb-2 font-sans'

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Question',
    message: '',
  })
  const [toastVisible, setToastVisible] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setToastVisible(true)
    setTimeout(() => setToastVisible(false), 4000)
    setFormData({ name: '', email: '', subject: 'General Question', message: '' })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
      style={{ background: 'var(--bg-base)' }}
    >
      <Navbar />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="pt-24 pb-16 text-center">
        <div className="max-w-4xl mx-auto px-6">
          <Reveal>
            <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
              Get In Touch
            </span>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="font-serif text-4xl md:text-5xl text-white mt-3">
              We're here to help.
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="font-sans text-lg text-slate-400 mt-4 max-w-xl mx-auto leading-relaxed">
              Got a question, a bug to report, or just want to say hello? We read every message.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Two-column layout ─────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 mt-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

          {/* Left — Contact Form */}
          <Reveal>
            <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8">
              <h2 className="text-white font-semibold text-lg mb-6 font-sans">Send us a message</h2>
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className={LABEL_CLS}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Adaeze Obi"
                    className={INPUT_CLS}
                    value={formData.name}
                    onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Email Address</label>
                  <input
                    type="email"
                    placeholder="you@university.edu.ng"
                    className={INPUT_CLS}
                    value={formData.email}
                    onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className={LABEL_CLS}>Subject</label>
                  <select
                    className={INPUT_CLS}
                    value={formData.subject}
                    onChange={e => setFormData(f => ({ ...f, subject: e.target.value }))}
                    style={{ appearance: 'none', WebkitAppearance: 'none' }}
                  >
                    <option value="General Question">General Question</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Billing Issue">Billing Issue</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL_CLS}>Message</label>
                  <textarea
                    rows={6}
                    placeholder="Tell us how we can help..."
                    className={INPUT_CLS}
                    style={{ minHeight: 140, resize: 'vertical' }}
                    value={formData.message}
                    onChange={e => setFormData(f => ({ ...f, message: e.target.value }))}
                    required
                  />
                </div>
                <SubmitButton>Send Message</SubmitButton>
              </form>
            </div>
          </Reveal>

          {/* Right — Info Cards */}
          <div className="flex flex-col gap-4">
            <Reveal delay={0.1}>
              <InfoCard
                icon={<EnvelopeIcon />}
                title="Email us"
                value="support@fypro.app"
                note="We reply within 24 hours"
              />
            </Reveal>
            <Reveal delay={0.15}>
              <InfoCard
                icon={<ClockIcon />}
                title="Response time"
                value="Within 24 hours"
                note="Monday to Friday, 9am – 6pm WAT"
              />
            </Reveal>
            <Reveal delay={0.2}>
              <InfoCard
                icon={<UsersIcon />}
                title="Join the community"
                value="FYPro Student Community"
                note="Connect with other final year students"
              />
            </Reveal>
            <Reveal delay={0.25}>
              <InfoCard
                icon={<XIcon />}
                title="Follow us"
                value="@fypro_app"
                note="Updates, tips, and student wins"
              />
            </Reveal>
          </div>
        </div>
      </div>

      {/* ── FAQ Teaser ────────────────────────────────────────────────────── */}
      <div className="mt-20 max-w-2xl mx-auto text-center px-6 pb-24">
        <Reveal>
          <div className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-10">
            <h2 className="text-white font-semibold text-xl font-sans">Looking for quick answers?</h2>
            <p className="text-slate-400 text-sm mt-2 leading-relaxed font-sans">
              Check our frequently asked questions — most common issues are answered there.
            </p>
            <a
              href="/#faq"
              className="border border-slate-700 hover:border-blue-500 hover:text-blue-400 text-slate-400 rounded-xl px-6 py-3 mt-6 transition-all inline-block font-sans text-sm no-underline"
            >
              View FAQ
            </a>
          </div>
        </Reveal>
      </div>

      <Footer />
      <SuccessToast visible={toastVisible} />
    </motion.div>
  )
}
