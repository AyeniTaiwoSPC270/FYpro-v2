import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Shield Icon ──────────────────────────────────────────────────────────────

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldIcon({ size = 20, color = '#0066FF' }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true">
      <path d={SHIELD_D} />
    </svg>
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
            <img src="/fypro-logo.png" alt="FYPro" className="h-6 w-auto" />
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
    heading: '1. Who We Are',
    paras: [
      'FYPro is an AI-powered final year project companion built for Nigerian university students. FYPro is operated by Taiwo Ayeni, based in Lagos, Nigeria. For data protection enquiries, contact us at: privacy@fypro.app',
    ],
  },
  {
    heading: '2. What Data We Collect',
    paras: [
      'When you create an account and use FYPro, we collect the following personal data:',
    ],
    list: [
      'Full name and email address (provided at signup)',
      'University, faculty, department, and academic level (provided during onboarding)',
      'Research topic and project content (entered during your FYP workflow)',
      'Payment information (processed by Paystack — we do not store card details)',
      'Usage data (pages visited, features used, session duration)',
      'Device and browser information for security purposes',
    ],
  },
  {
    heading: '3. Why We Collect Your Data',
    paras: ['We collect your data to:'],
    list: [
      'Provide and personalise the FYPro service',
      'Process payments for paid plans via Paystack',
      'Send important account and service notifications',
      'Improve FYPro based on how students use it',
      'Comply with our legal obligations under Nigerian law',
    ],
  },
  {
    heading: '4. Third Party Services',
    paras: [
      'FYPro uses the following third-party services that may process your data:',
    ],
    list: [
      'Anthropic (Claude API): powers all AI features. Your research content is sent to Anthropic\'s API to generate responses. Anthropic\'s privacy policy applies.',
      'Supabase: stores your account and project data securely.',
      'Paystack: processes all payments. Paystack\'s privacy policy applies.',
      'Vercel: hosts the FYPro application.',
    ],
    footer: 'We have data processing agreements in place with each of these providers.',
  },
  {
    heading: '5. Your Rights Under the NDPA',
    paras: ['Under the Nigeria Data Protection Act 2023, you have the right to:'],
    list: [
      'Access the personal data we hold about you',
      'Request correction of inaccurate data',
      'Request deletion of your data (right to erasure)',
      'Withdraw consent at any time',
      'Lodge a complaint with the Nigeria Data Protection Commission (NDPC)',
    ],
    footer: 'To exercise any of these rights, email us at: privacy@fypro.app',
  },
  {
    heading: '6. Data Retention',
    paras: [
      'We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required by law to retain it longer.',
    ],
  },
  {
    heading: '7. Data Security',
    paras: [
      'We protect your data using industry-standard security measures including encrypted connections (HTTPS), secure cloud storage, and access controls. In the event of a data breach that affects your rights, we will notify you and the NDPC within 72 hours of becoming aware of it.',
    ],
  },
  {
    heading: '8. Cookies',
    paras: [
      'FYPro uses essential cookies to keep you logged in and remember your session. We do not use advertising or tracking cookies. By continuing to use FYPro, you consent to our use of essential cookies.',
    ],
  },
  {
    heading: '9. Children',
    paras: [
      'FYPro is intended for university students aged 16 and above. We do not knowingly collect data from persons under 16.',
    ],
  },
  {
    heading: '10. Changes to This Policy',
    paras: [
      'We may update this policy from time to time. We will notify you by email of any significant changes. Continued use of FYPro after changes constitutes acceptance of the updated policy.',
    ],
  },
  {
    heading: '11. Contact Us',
    paras: [
      'For any privacy concerns or data requests:',
    ],
    list: [
      'Email: privacy@fypro.app',
      'Response time: within 5 business days',
    ],
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Privacy() {
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
          <h1 className="font-serif text-4xl text-white mt-3">Privacy Policy</h1>
          <p className="font-mono text-xs text-slate-500 mt-2">Last updated: April 25, 2026</p>
          <p className="text-slate-400 text-base leading-relaxed mt-6">
            FYPro is committed to protecting your personal data in accordance with the Nigeria Data Protection Act 2023 (NDPA) and the General Application and Implementation Directive (GAID) 2025.
          </p>

          {/* Sections */}
          {SECTIONS.map(({ heading, paras, list, footer }, idx) => (
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
                {footer && (
                  <p className="text-slate-400 text-base leading-loose mt-3">{footer}</p>
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
