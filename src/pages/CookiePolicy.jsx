import { motion } from 'framer-motion'
import FyproLogo from '../components/FyproLogo'

function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-[200] h-[66px] flex items-center justify-between px-12 border-b border-white/[0.06]"
      style={{ background: 'var(--pub-nav-scrolled)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}
    >
      <a href="/" className="flex items-center gap-2.5 flex-shrink-0 no-underline">
        <FyproLogo className="h-9 w-auto" />
      </a>
      <a href="/login" className="relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline px-5 py-2 text-[0.8rem] bg-blue-600 text-white hover:bg-blue-500">
        Try Free
      </a>
    </nav>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] py-8" style={{ background: 'var(--bg-sidebar)' }}>
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
          <a href="/" className="flex items-center gap-2 no-underline">
            <FyproLogo className="h-6 w-auto" />
          </a>
          <p className="text-slate-500 text-sm text-center font-sans">© 2026 FYPro. Built for African students.</p>
          <div className="flex gap-6">
            <a href="/privacy" className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans">Privacy Policy</a>
            <a href="/terms" className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans">Terms</a>
            <a href="/cookie-policy" className="text-slate-500 text-sm hover:text-slate-300 transition-colors duration-150 no-underline font-sans">Cookie Policy</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

const SECTIONS = [
  {
    heading: '1. What Are Cookies?',
    paras: [
      'Cookies are small text files placed on your device when you visit a website. They help the website remember information about your visit — such as your login session or preferences — so you do not have to re-enter it on your next visit.',
    ],
  },
  {
    heading: '2. What Cookies FYPro Uses',
    paras: [
      'FYPro uses a minimal set of cookies. We do not use advertising cookies or sell your data to third parties.',
    ],
    table: [
      { name: 'Supabase auth session', purpose: 'Keeps you logged in', duration: 'Session / 1 week', type: 'Essential' },
      { name: 'PostHog analytics', purpose: 'Understands how students use FYPro so we can improve it', duration: 'Up to 1 year', type: 'Analytics' },
      { name: 'cookie_consent', purpose: 'Remembers your cookie preference so we do not ask again', duration: 'Indefinite (localStorage)', type: 'Functional' },
    ],
  },
  {
    heading: '3. Analytics Cookies (PostHog)',
    paras: [
      'We use PostHog to understand how students navigate FYPro — which features are used, where students drop off, and how the product can be improved. PostHog collects anonymous usage data such as page views, click events, and session duration.',
      'PostHog does not collect your name, email address, or research content. All data is pseudonymised. We have configured PostHog to operate within PostHog\'s EU cloud (app.posthog.com) and have a data processing agreement in place.',
    ],
  },
  {
    heading: '4. Your Choices',
    paras: [
      'When you first visit FYPro, you are shown a cookie consent banner. You can accept or decline analytics cookies at that point.',
      'If you decline, PostHog analytics will not capture any data from your session. Essential cookies (Supabase session) are still required for the service to function.',
      'To change your preference at any time, clear your browser\'s localStorage for www.fypro.com.ng and reload the page — the consent banner will reappear.',
    ],
  },
  {
    heading: '5. Your Rights Under the NDPA 2023',
    paras: [
      'Under the Nigeria Data Protection Act 2023, you have the right to withdraw consent for non-essential cookies at any time. To exercise this right, follow the steps in Section 4 above, or contact us at privacy@fypro.app.',
    ],
  },
  {
    heading: '6. Contact',
    paras: [
      'Questions about how we use cookies? Email us at privacy@fypro.app. We respond within 5 business days.',
    ],
  },
]

export default function CookiePolicy() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-[var(--bg-base)]"
      style={{ backgroundImage: 'var(--dot-bg-image)', backgroundSize: '28px 28px' }}
    >
      <Navbar />

      <main className="pt-[66px]">
        <div className="max-w-3xl mx-auto px-6 py-16">

          <div className="flex flex-col items-center text-center">
            <span className="font-mono text-xs uppercase tracking-widest text-blue-400">Legal</span>
            <h1 className="font-serif text-4xl text-white mt-3">Cookie Policy</h1>
            <p className="font-mono text-xs text-slate-500 mt-2">Last updated: May 11, 2026</p>
            <p className="text-slate-400 text-base leading-relaxed mt-6 max-w-xl">
              FYPro uses a small number of cookies. This policy explains what they are, why we use them, and how you can control them — in compliance with the Nigeria Data Protection Act 2023.
            </p>
          </div>

          {SECTIONS.map(({ heading, paras, table }, idx) => (
            <motion.div
              key={heading}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.08 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: idx * 0.03 }}
            >
              <h2 className="text-white font-semibold text-lg mt-10 mb-3">{heading}</h2>
              {paras?.map((p, i) => (
                <p key={i} className="text-slate-400 text-base leading-loose">{p}</p>
              ))}
              {table && (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm font-sans border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        {['Cookie', 'Purpose', 'Duration', 'Type'].map(h => (
                          <th key={h} className="text-left py-2 px-3 font-semibold text-slate-300 text-xs uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.map(row => (
                        <tr key={row.name} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td className="py-2.5 px-3 text-slate-300 font-mono text-xs">{row.name}</td>
                          <td className="py-2.5 px-3 text-slate-400">{row.purpose}</td>
                          <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{row.duration}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className="font-mono text-xs px-2 py-0.5 rounded"
                              style={{
                                background: row.type === 'Essential' ? 'rgba(22,163,74,0.15)' : row.type === 'Analytics' ? 'rgba(0,102,255,0.15)' : 'rgba(245,158,11,0.15)',
                                color: row.type === 'Essential' ? '#4ade80' : row.type === 'Analytics' ? '#60a5fa' : '#fbbf24',
                              }}
                            >
                              {row.type}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          ))}

        </div>
      </main>

      <Footer />
    </motion.div>
  )
}
