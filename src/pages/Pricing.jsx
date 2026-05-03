import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

function BtnLink({ href, className, children }) {
  const { handleClick, rippleEls } = useRipple()
  return (
    <a
      href={href}
      className={`relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline ${className}`}
      onClick={handleClick}
    >
      {children}
      {rippleEls}
    </a>
  )
}

// ─── Shield Icon ──────────────────────────────────────────────────────────────

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldIcon({ size = 20, color = '#2563EB' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill={color}
      aria-hidden="true"
    >
      <path d={SHIELD_D} />
    </svg>
  )
}

// ─── Reveal ───────────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className, as: Tag = 'div' }) {
  const MotionTag = motion[Tag] || motion.div
  return (
    <MotionTag
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -32px 0px', amount: 0.12 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </MotionTag>
  )
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

function PricingNavbar() {
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
        className={`fixed top-0 left-0 right-0 z-[200] h-[66px] flex items-center justify-between px-6 md:px-12 border-b transition-all duration-200 ${
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
                href === '/pricing'
                  ? 'text-white after:scale-x-100'
                  : 'text-white/65 hover:text-white after:scale-x-0 hover:after:scale-x-100'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <BtnLink
            href="/login"
            className="px-5 py-2 text-[0.8rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]"
          >
            Login
          </BtnLink>
          <BtnLink
            href="/login"
            className="px-5 py-2 text-[0.8rem] bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-0.5"
          >
            Try Free
          </BtnLink>
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
                  ? i === 0
                    ? { y: 7, rotate: 45 }
                    : i === 1
                    ? { opacity: 0 }
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
            style={{
              background: 'rgba(6,14,24,0.98)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex flex-col gap-1">
              {navLinks.map(({ label, href }) => (
                <a key={label} href={href} className="block py-3 px-2 text-base font-medium text-white/65 border-b border-white/[0.06] hover:text-white transition-colors no-underline">{label}</a>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <BtnLink
                href="/login"
                className="w-full py-2.5 px-[22px] text-[0.875rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45"
              >
                Login
              </BtnLink>
              <BtnLink
                href="/login"
                className="w-full py-2.5 px-[22px] text-[0.875rem] bg-blue-600 text-white"
              >
                Try Free
              </BtnLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function PricingHero() {
  return (
    <section className="pt-24 pb-16 text-center relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(37,99,235,0.13) 0%, transparent 60%), radial-gradient(circle, rgba(37,99,235,0.04) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 28px 28px',
        }}
      />
      <div className="max-w-6xl mx-auto px-6 relative z-[1]">
        <Reveal>
          <span className="font-mono text-xs uppercase tracking-widest text-blue-400">
            Simple, honest pricing
          </span>
        </Reveal>
        <Reveal delay={0.07}>
          <h1 className="font-serif text-4xl md:text-5xl text-white text-center mt-3 leading-[1.12]">
            One project. One payment. No subscriptions.
          </h1>
        </Reveal>
        <Reveal delay={0.13}>
          <p className="font-sans text-lg text-slate-400 text-center mt-4 max-w-xl mx-auto leading-relaxed">
            Pay once per project. Only upgrade when you need more.
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── PRICING CARDS ────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg className="flex-shrink-0 mt-[1px]" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="rgba(96,165,250,0.14)" />
      <path
        d="M4.5 8l2.5 2.5 4.5-5"
        stroke="#60A5FA"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg className="flex-shrink-0 mt-[1px]" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="rgba(100,116,139,0.1)" />
      <path
        d="M5.5 5.5l5 5M10.5 5.5l-5 5"
        stroke="#475569"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg className="flex-shrink-0 mt-[1px]" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="rgba(251,191,36,0.12)" />
      <path d="M8 4.5v7M4.5 8h7" stroke="#FBBF24" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function GreenCheckIcon() {
  return (
    <svg className="flex-shrink-0 mt-[1px]" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="rgba(52,211,153,0.14)" />
      <path
        d="M4.5 8l2.5 2.5 4.5-5"
        stroke="#34D399"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FeatureItem({ type, label, addon }) {
  if (type === 'check') {
    return (
      <li className="flex items-start gap-3 text-slate-300 text-sm leading-snug">
        <CheckIcon />
        {label}
      </li>
    )
  }
  if (type === 'cross') {
    return (
      <li className="flex items-start gap-3 text-slate-600 text-sm leading-snug">
        <CrossIcon />
        {label}
      </li>
    )
  }
  if (type === 'addon') {
    return (
      <li className="flex items-start gap-3 text-slate-400 text-sm leading-snug">
        <PlusIcon />
        <span>
          {label}{' '}
          <span className="text-slate-500 text-xs">{addon}</span>
        </span>
      </li>
    )
  }
  if (type === 'included') {
    return (
      <li className="flex items-start gap-3 text-slate-300 text-sm leading-snug">
        <GreenCheckIcon />
        <span>
          {label}{' '}
          <span className="text-green-400 text-xs font-medium">Included</span>
        </span>
      </li>
    )
  }
  return null
}

const FREE_FEATURES = [
  { type: 'check', label: 'Topic Validator' },
  { type: 'check', label: 'Chapter Architect' },
  { type: 'check', label: 'Methodology Advisor' },
  { type: 'cross', label: 'Writing Planner' },
  { type: 'cross', label: 'Project Reviewer' },
  { type: 'cross', label: 'Defense Simulator' },
  { type: 'cross', label: 'Project Reset' },
]

const STUDENT_FEATURES = [
  { type: 'check', label: 'Topic Validator' },
  { type: 'check', label: 'Chapter Architect' },
  { type: 'check', label: 'Methodology Advisor' },
  { type: 'check', label: 'Writing Planner' },
  { type: 'check', label: 'Project Reviewer' },
  { type: 'cross', label: 'Defense Simulator' },
  { type: 'addon', label: 'Project Reset', addon: '— ₦1,500 add-on' },
]

const DEFENSE_FEATURES = [
  { type: 'check', label: 'Topic Validator' },
  { type: 'check', label: 'Chapter Architect' },
  { type: 'check', label: 'Methodology Advisor' },
  { type: 'check', label: 'Writing Planner' },
  { type: 'check', label: 'Project Reviewer' },
  { type: 'check', label: 'Defense Simulator' },
  { type: 'included', label: 'Project Reset' },
]

function usePaystackCheckout() {
  const navigate = useNavigate()
  const [paying, setPaying] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [payError, setPayError] = useState(null)

  const loadScript = useCallback(() => {
    if (document.getElementById('paystack-inline-js')) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.id = 'paystack-inline-js'
      script.src = 'https://js.paystack.co/v1/inline.js'
      script.onload = resolve
      script.onerror = () => reject(new Error('Failed to load Paystack script'))
      document.head.appendChild(script)
    })
  }, [])

  const handlePay = useCallback(async (tier) => {
    setPayError(null)
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      navigate('/login?returnUrl=/pricing')
      return
    }
    const user = authData.user

    setPaying(tier)
    try {
      await loadScript()

      const res = await fetch('/api/initiate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, userId: user.id, email: user.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payment')

      const handler = window.PaystackPop.setup({
        key: data.publicKey,
        email: user.email,
        amount: data.amount_kobo,
        ref: data.reference,
        currency: 'NGN',
        onSuccess: async (transaction) => {
          setVerifying(true)
          try {
            const vRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reference: transaction.reference }),
            })
            const vData = await vRes.json()
            if (vRes.ok && vData.status === 'success') {
              navigate('/dashboard?payment=success')
            } else {
              setPayError('Payment received but verification failed. Please contact support.')
            }
          } catch {
            setPayError('Payment received but verification failed. Please contact support.')
          } finally {
            setVerifying(false)
          }
        },
        onCancel: () => {
          console.log('Payment cancelled')
        },
      })
      handler.openIframe()
    } catch (err) {
      setPayError(err.message)
    } finally {
      setPaying(null)
    }
  }, [navigate, loadScript])

  return { handlePay, paying, verifying, payError }
}

function PricingCards() {
  const { handlePay, paying, payError } = usePaystackCheckout()

  return (
    <section>
      <div className="max-w-6xl mx-auto px-6">
        {/* pt-6 gives the floating badge room above the featured card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 items-start pt-6">

          {/* ── Free ── */}
          <Reveal delay={0}>
            <motion.div
              className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8"
              whileHover={{ y: -4, borderColor: 'rgba(37,99,235,0.35)', transition: { duration: 0.2 } }}
            >
              <div className="font-mono text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Free
              </div>
              <div className="font-serif text-5xl text-white mt-2">₦0</div>
              <div className="text-slate-500 text-sm mt-1">forever</div>
              <div className="border-t border-[var(--border-color)] my-6" />
              <ul className="flex flex-col gap-3">
                {FREE_FEATURES.map((f, i) => (
                  <FeatureItem key={i} {...f} />
                ))}
              </ul>
              <a
                href="/signup"
                className="mt-8 flex items-center justify-center w-full py-3 border border-slate-700 hover:border-blue-500 hover:text-blue-400 text-slate-400 rounded-xl transition-all duration-200 font-sans font-semibold text-sm no-underline"
              >
                Get Started Free
              </a>
            </motion.div>
          </Reveal>

          {/* ── Student Plan (featured) ── */}
          <Reveal delay={0.08}>
            <div className="relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 bg-blue-600 text-white text-xs font-semibold px-4 py-1 rounded-full whitespace-nowrap font-sans">
                Most Popular
              </div>
              <motion.div
                className="bg-[var(--bg-card)] rounded-2xl border-2 border-blue-500 p-8"
                style={{ boxShadow: '0 0 40px rgba(59,130,246,0.15)' }}
                whileHover={{
                  boxShadow: '0 0 56px rgba(59,130,246,0.26)',
                  transition: { duration: 0.25 },
                }}
              >
                <div className="font-mono text-sm font-semibold text-blue-400 uppercase tracking-wider">
                  Student Plan
                </div>
                <div className="font-serif text-5xl text-white mt-2">₦2,000</div>
                <div className="text-slate-400 text-sm mt-1">per project, one-time</div>
                <div className="border-t border-[var(--border-color)] my-6" />
                <ul className="flex flex-col gap-3">
                  {STUDENT_FEATURES.map((f, i) => (
                    <FeatureItem key={i} {...f} />
                  ))}
                </ul>
                <button
                  onClick={() => handlePay('student_pack')}
                  disabled={paying === 'student_pack'}
                  className="mt-8 flex items-center justify-center w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.4)] font-sans text-sm border-0 cursor-pointer"
                >
                  {paying === 'student_pack' ? 'Opening…' : 'Get Student Plan — ₦2,000'}
                </button>
              </motion.div>
            </div>
          </Reveal>

          {/* ── Defense Plan ── */}
          <Reveal delay={0.16}>
            <motion.div
              className="bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] p-8"
              whileHover={{ y: -4, borderColor: 'rgba(37,99,235,0.35)', transition: { duration: 0.2 } }}
            >
              <div className="font-mono text-sm font-semibold text-slate-400 uppercase tracking-wider">
                Defense Plan
              </div>
              <div className="font-serif text-5xl text-white mt-2">₦3,500</div>
              <div className="text-slate-500 text-sm mt-1">per project, one-time</div>
              <div className="border-t border-[var(--border-color)] my-6" />
              <ul className="flex flex-col gap-3">
                {DEFENSE_FEATURES.map((f, i) => (
                  <FeatureItem key={i} {...f} />
                ))}
              </ul>
              <button
                onClick={() => handlePay('defense_pack')}
                disabled={paying === 'defense_pack'}
                className="mt-8 flex items-center justify-center w-full py-3 border border-slate-700 hover:border-blue-500 hover:text-blue-400 disabled:opacity-60 disabled:cursor-not-allowed text-slate-400 rounded-xl transition-all duration-200 font-sans font-semibold text-sm bg-transparent cursor-pointer"
              >
                {paying === 'defense_pack' ? 'Opening…' : 'Get Defense Plan — ₦3,500'}
              </button>
            </motion.div>
          </Reveal>

        </div>
        {payError && (
          <p className="mt-4 text-center text-red-400 text-sm font-sans">{payError}</p>
        )}
      </div>
    </section>
  )
}

// ─── COMPARISON TABLE ─────────────────────────────────────────────────────────

const TABLE_ROWS = [
  { feature: 'Topic Validator',     free: true,    student: true,     defense: true },
  { feature: 'Chapter Architect',   free: true,    student: true,     defense: true },
  { feature: 'Methodology Advisor', free: true,    student: true,     defense: true },
  { feature: 'Writing Planner',     free: false,   student: true,     defense: true },
  { feature: 'Project Reviewer',    free: false,   student: true,     defense: true },
  { feature: 'Defense Simulator',   free: false,   student: false,    defense: true },
  { feature: 'Project Reset',       free: false,   student: '₦1,500', defense: 'Included' },
]

function TableCell({ value, isEven }) {
  const base = `text-center py-4 px-6 ${isEven ? 'bg-[var(--bg-card)]/50' : ''}`
  if (value === true) {
    return (
      <td className={base}>
        <span className="text-blue-400 font-bold text-base">✓</span>
      </td>
    )
  }
  if (value === false) {
    return (
      <td className={base}>
        <span className="text-slate-600 text-base">—</span>
      </td>
    )
  }
  if (value === '₦1,500') {
    return (
      <td className={`${base} font-mono text-sm text-slate-400`}>{value}</td>
    )
  }
  if (value === 'Included') {
    return (
      <td className={`${base} text-green-400 text-sm font-medium`}>{value}</td>
    )
  }
  return <td className={base}>{value}</td>
}

function ComparisonTable() {
  return (
    <section className="mt-24">
      <div className="max-w-4xl mx-auto px-6">
        <Reveal as="h2" className="font-serif text-3xl text-white text-center">
          Everything in one place
        </Reveal>
        <Reveal delay={0.06} className="text-slate-400 text-center mt-2 mb-10 font-sans">
          See exactly what each plan includes
        </Reveal>
        <Reveal delay={0.1}>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-color)]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--bg-card)]">
                  <th className="text-left py-4 px-6 text-slate-400 text-sm font-semibold font-sans border-b border-[var(--border-color)]">
                    Feature
                  </th>
                  <th className="text-center py-4 px-6 text-slate-300 text-sm font-semibold font-sans border-b border-[var(--border-color)]">
                    Free
                  </th>
                  <th className="text-center py-4 px-6 text-blue-400 text-sm font-semibold font-sans border-b border-[var(--border-color)]">
                    Student
                  </th>
                  <th className="text-center py-4 px-6 text-slate-300 text-sm font-semibold font-sans border-b border-[var(--border-color)]">
                    Defense
                  </th>
                </tr>
              </thead>
              <tbody>
                {TABLE_ROWS.map((row, i) => {
                  const isEven = i % 2 !== 0
                  return (
                    <tr key={row.feature} className="border-b border-[var(--border-color)] last:border-b-0">
                      <td
                        className="text-slate-300 text-sm font-medium py-4 px-6"
                        style={{ background: isEven ? 'rgba(13,20,37,0.5)' : 'transparent' }}
                      >
                        {row.feature}
                      </td>
                      <TableCell value={row.free} isEven={isEven} />
                      <TableCell value={row.student} isEven={isEven} />
                      <TableCell value={row.defense} isEven={isEven} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'What counts as one project?',
    a: 'One project is one final year research topic from start to finish. If you start a new topic or reset your project, that counts as a new project.',
  },
  {
    q: 'Do I pay before or after using FYPro?',
    a: "The first three steps — Topic Validator, Chapter Architect, and Methodology Advisor — are completely free. You only pay when you're ready to unlock the Writing Planner and beyond.",
  },
  {
    q: 'What payment methods are accepted?',
    a: 'FYPro accepts all Nigerian debit cards, bank transfers, and USSD payments through Paystack. No international card required.',
  },
  {
    q: 'Can I switch plans mid-project?',
    a: 'Yes. You can upgrade from Free to Student Plan or from Student Plan to Defense Plan at any time. You only pay the difference.',
  },
  {
    q: 'Is my project data saved?',
    a: "Yes. Your project is saved to your account and accessible from any device as long as you're logged in.",
  },
  {
    q: "What if I'm not satisfied?",
    a: "If FYPro doesn't help you make meaningful progress on your project within 7 days of payment, contact us for a full refund. No questions asked.",
  },
]

function FAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="border-b border-[var(--border-color)]">
      <button
        className="w-full flex items-center justify-between py-5 text-left bg-transparent border-0 cursor-pointer group"
        onClick={onToggle}
      >
        <span className="font-sans font-medium text-white text-[0.9rem] pr-4 leading-snug">{q}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors duration-150"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p className="font-sans text-slate-400 text-sm leading-relaxed pb-5">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FAQSection() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <section className="mt-24 max-w-3xl mx-auto px-6">
      <Reveal as="h2" className="font-serif text-3xl text-white text-center mb-10">
        Common questions
      </Reveal>
      <Reveal delay={0.06}>
        <div>
          {FAQ_ITEMS.map((item, i) => (
            <FAQItem
              key={i}
              q={item.q}
              a={item.a}
              isOpen={openIndex === i}
              onToggle={() => setOpenIndex(openIndex === i ? null : i)}
            />
          ))}
        </div>
      </Reveal>
    </section>
  )
}

// ─── BOTTOM CTA ───────────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <section className="mt-24 mb-24 text-center px-6 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 55% 65% at 50% 50%, rgba(37,99,235,0.1) 0%, transparent 65%)',
        }}
      />
      <div className="relative z-[1]">
        <Reveal as="h2" className="font-serif text-4xl text-white">
          Ready to stop guessing?
        </Reveal>
        <Reveal delay={0.07}>
          <p className="font-sans text-slate-400 mt-3 max-w-lg mx-auto leading-relaxed">
            Join thousands of Nigerian final year students who used FYPro to survive their FYP.
          </p>
        </Reveal>
        <Reveal delay={0.13}>
          <a
            href="/signup"
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-10 py-4 mt-8 inline-block transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(59,130,246,0.4)] font-sans no-underline text-base"
          >
            Start for Free
          </a>
        </Reveal>
        <Reveal delay={0.18}>
          <p className="font-sans text-slate-500 text-sm mt-4">
            Payments secured by{' '}
            <span className="font-semibold text-slate-400">Paystack</span>
          </p>
        </Reveal>
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function PricingFooter() {
  return (
    <footer className="border-t border-[var(--border-color)] py-8" style={{ background: 'var(--bg-sidebar)' }}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
          <a href="/" className="flex items-center gap-2 no-underline">
            <img src="/fypro-logo.png" alt="FYPro" className="h-6 w-auto" />
          </a>
          <p className="text-slate-500 text-sm text-center font-sans">
            © 2026 FYPro. Built for African students.
          </p>
          <div className="flex gap-6">
            <a
              href="/privacy"
              className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans"
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans"
            >
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── PAGE ─────────────────────────────────────────────────────────────────────

export default function Pricing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-[var(--bg-base)]"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(37,99,235,0.04) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <PricingNavbar />
      <main className="pt-[66px]">
        <PricingHero />
        <PricingCards />
        <ComparisonTable />
        <FAQSection />
        <BottomCTA />
      </main>
      <PricingFooter />
    </motion.div>
  )
}
