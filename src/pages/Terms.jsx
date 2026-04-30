import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Shield Icon ──────────────────────────────────────────────────────────────

function ShieldIcon({ size = 20 }) {
  return (
    <img src="/fypro-logo.png" alt="FYPro" width={size} height={size} aria-hidden="true" />
  )
}

// ─── Reveal ───────────────────────────────────────────────────────────────────

function Reveal({ children, delay = 0, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, margin: '0px 0px -32px 0px', amount: 0.12 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
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
              className="text-[0.875rem] font-medium text-white/65 hover:text-white transition-colors duration-150 no-underline"
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
              <a href="/signup" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-blue-600 text-white no-underline rounded-xl font-semibold text-center font-sans">Start Free</a>
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

// ─── Content Data ─────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    paras: [
      'By accessing or using FYPro, you confirm that you are at least 16 years old and agree to these Terms of Service. If you do not agree, do not use FYPro.',
    ],
  },
  {
    heading: '2. What FYPro Does',
    paras: [
      'FYPro is an AI-powered academic guidance tool. It helps you think through your final year project — it does not write your project for you. All outputs are suggestions and starting points. You are responsible for the academic integrity of your own work.',
    ],
  },
  {
    heading: '3. Your Account',
    paras: [
      'You are responsible for maintaining the security of your account and password. You must not share your account with others. You must provide accurate information when creating your account.',
    ],
  },
  {
    heading: '4. Acceptable Use',
    paras: ['You agree not to:'],
    list: [
      'Use FYPro to produce work you submit as entirely your own without meaningful contribution',
      'Attempt to reverse engineer, hack, or abuse the FYPro platform',
      'Use FYPro for any unlawful purpose',
      'Share your account credentials with other users',
    ],
  },
  {
    heading: '5. Payments and Refunds',
    paras: [
      'All payments are processed securely by Paystack. Prices are displayed in Nigerian Naira (₦). All purchases are per-project and non-recurring. We offer a 7-day refund policy — if FYPro does not help you make meaningful progress within 7 days of payment, contact us at support@fypro.app for a full refund.',
    ],
  },
  {
    heading: '6. AI-Generated Content',
    paras: [
      'FYPro uses Claude, an AI developed by Anthropic, to generate academic guidance. AI responses may occasionally be inaccurate or incomplete. Always verify important information with your supervisor or institution. FYPro is a thinking partner, not a replacement for academic judgment.',
    ],
  },
  {
    heading: '7. Intellectual Property',
    paras: [
      'FYPro and its original content are owned by Taiwo Ayeni. The research content you create using FYPro belongs to you. You grant FYPro a limited licence to process your content solely to provide the service.',
    ],
  },
  {
    heading: '8. Limitation of Liability',
    paras: [
      'FYPro is provided as-is. We are not liable for any academic outcomes, examination results, or decisions made based on FYPro\'s guidance. Use FYPro as a supplement to, not a replacement for, your own academic judgment and your supervisor\'s guidance.',
    ],
  },
  {
    heading: '9. Termination',
    paras: [
      'We reserve the right to suspend or terminate accounts that violate these terms. You may delete your account at any time from your profile settings.',
    ],
  },
  {
    heading: '10. Governing Law',
    paras: [
      'These terms are governed by the laws of the Federal Republic of Nigeria. Any disputes shall be subject to the jurisdiction of Nigerian courts.',
    ],
  },
  {
    heading: '11. Contact',
    paras: [
      'For questions about these terms: legal@fypro.app',
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Terms() {
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
        <div className="max-w-3xl mx-auto px-6 py-16">

          {/* Header */}
          <span className="font-mono text-xs uppercase tracking-widest text-blue-400">Legal</span>
          <h1 className="font-serif text-4xl text-white mt-3">Terms of Service</h1>
          <p className="font-mono text-xs text-slate-500 mt-2">Last updated: April 25, 2026</p>
          <p className="text-slate-400 text-base leading-relaxed mt-6">
            Please read these terms carefully before using FYPro. By creating an account, you agree to be bound by these terms.
          </p>

          {/* Sections */}
          {SECTIONS.map(({ heading, paras, list }, idx) => (
            <Reveal key={heading} delay={idx * 0.03}>
              <div>
                <h2 className="text-white font-semibold text-lg mt-10 mb-3">{heading}</h2>
                {paras?.map((p, i) => (
                  <p key={i} className="text-slate-400 text-base leading-loose">{p}</p>
                ))}
                {list && (
                  <ul className="list-none mt-2 space-y-1.5">
                    {list.map((item, i) => (
                      <li key={i} className="text-slate-400 text-base leading-loose flex gap-2.5">
                        <span className="text-slate-500 flex-shrink-0 select-none">—</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          ))}

        </div>
      </main>

      <Footer />
    </motion.div>
  )
}
