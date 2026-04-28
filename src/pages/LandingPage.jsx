import { useState, useEffect, useRef, useCallback } from 'react'
import {
  motion,
  AnimatePresence,
  useInView,
  useMotionValue,
  animate as fmAnimate,
  useAnimate,
} from 'framer-motion'

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCountUp(target, inView, duration = 1500) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView) return
    const start = performance.now()
    let rafId
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1)
      setCount(Math.round((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      setCount(0)
    }
  }, [inView, target, duration])
  return count
}

function useTypewriter(text, startDelay = 1080, speed = 26) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)
  useEffect(() => {
    let outerTimeout, interval
    outerTimeout = setTimeout(() => {
      let i = 0
      interval = setInterval(() => {
        i++
        setDisplayed(text.slice(0, i))
        if (i >= text.length) {
          clearInterval(interval)
          setTimeout(() => setDone(true), 1000)
        }
      }, speed)
    }, startDelay)
    return () => { clearTimeout(outerTimeout); clearInterval(interval) }
  }, [text, startDelay, speed])
  return { displayed, done }
}

function useNavActive() {
  const [active, setActive] = useState(null)
  useEffect(() => {
    const ids = ['how-it-works', 'features', 'pricing']
    const sections = ids.map(id => document.getElementById(id)).filter(Boolean)
    const visible = {}
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { visible[e.target.id] = e.isIntersecting })
      setActive(ids.find(id => visible[id]) || null)
    }, { threshold: 0.2, rootMargin: '-64px 0px -35% 0px' })
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])
  return active
}

function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { setVisible(entry.isIntersecting) },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, visible]
}

// ─── SVG: Shield ──────────────────────────────────────────────────────────────

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldIcon({ size = 20, color = '#0066FF', ...rest }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true" {...rest}>
      <path d={SHIELD_D} />
    </svg>
  )
}

// ─── Back to Top ──────────────────────────────────────────────────────────────

function BackToTop() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const h = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          whileHover={{ y: -3, boxShadow: '0 6px 28px rgba(0,102,255,0.65)' }}
          transition={{ duration: 0.3 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          className="fixed bottom-8 right-8 z-[250] w-11 h-11 rounded-full bg-blue-brand border-0 cursor-pointer flex items-center justify-center"
          style={{ boxShadow: '0 4px 16px rgba(0,102,255,0.45)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

// ─── Ripple Button/Link ───────────────────────────────────────────────────────

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
    <a href={href} className={`relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all no-underline ${className}`} onClick={handleClick}>
      {children}
      {rippleEls}
    </a>
  )
}

function BtnButton({ className, children, onClick }) {
  const { handleClick, rippleEls } = useRipple()
  return (
    <button className={`relative overflow-hidden inline-flex items-center justify-center gap-2 font-sans font-semibold rounded-xl cursor-pointer transition-all border-0 ${className}`} onClick={(e) => { handleClick(e); onClick?.(e) }}>
      {children}
      {rippleEls}
    </button>
  )
}

// ─── Reveal (scroll-reveal wrapper) ──────────────────────────────────────────

function Reveal({ children, delay = 0, as = 'div', className, style }) {
  const [ref, visible] = useReveal()
  const Tag = as
  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: `opacity 0.5s ease ${delay}s, transform 0.5s ease ${delay}s`,
      }}
    >
      {children}
    </Tag>
  )
}

// ─── Section Divider ─────────────────────────────────────────────────────────

function SectionDivider() {
  return (
    <div className="h-px bg-white/[0.04] relative overflow-hidden">
      <motion.div
        className="absolute inset-y-0 w-1/2"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #0066FF 50%, transparent 100%)' }}
        animate={{ x: ['-200%', '200%'] }}
        transition={{ duration: 2.8, ease: 'easeInOut', repeat: Infinity }}
      />
    </div>
  )
}

// ─── Magnetic Feature Card ────────────────────────────────────────────────────

function MagneticCard({ children, className, style, hoverShadow, dataN }) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  const onMove = useCallback((e) => {
    const r = e.currentTarget.getBoundingClientRect()
    x.set(((e.clientX - r.left - r.width / 2) / (r.width / 2)) * 8)
    y.set(((e.clientY - r.top - r.height / 2) / (r.height / 2)) * 8)
  }, [x, y])

  const onLeave = useCallback(() => {
    fmAnimate(x, 0, { duration: 0.45, ease: [0.22, 1, 0.36, 1] })
    fmAnimate(y, 0, { duration: 0.45, ease: [0.22, 1, 0.36, 1] })
  }, [x, y])

  return (
    <motion.div
      className={className}
      style={{ x, y, transformStyle: 'preserve-3d', ...style }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={{ boxShadow: hoverShadow, transition: { duration: 0.3 } }}
      data-n={dataN}
    >
      {children}
    </motion.div>
  )
}

// ─── Testimonials Ticker ──────────────────────────────────────────────────────

function TestiCard({ quote, name, dept, initials, avatarStyle, fixed }) {
  return (
    <motion.div
      className="flex flex-col gap-[18px] p-7 rounded-2xl border border-white/[0.07] transition-colors duration-200"
      style={{
        background: 'linear-gradient(150deg, #0D1B2A 0%, #091420 100%)',
        ...(fixed ? { width: 380, flexShrink: 0 } : {}),
      }}
      whileHover={fixed ? {} : { borderColor: 'rgba(0,102,255,0.22)', y: -3 }}
    >
      <div className="text-[#F59E0B] text-[0.75rem] tracking-[2px]">★★★★★</div>
      <div className="flex-1">
        <span className="block font-serif text-[3.5rem] leading-none mb-4 select-none pointer-events-none" style={{ color: 'rgba(37,99,235,0.4)' }} aria-hidden="true">&ldquo;</span>
        <p className="text-[0.875rem] text-white/[0.78] leading-[1.75] italic">{quote}</p>
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
        <div className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-mono text-[0.7rem] font-bold text-white flex-shrink-0" style={avatarStyle}>{initials}</div>
        <div>
          <div className="text-[0.875rem] font-semibold text-white">{name}</div>
          <div className="text-[0.75rem] text-white/65">{dept}</div>
        </div>
      </div>
    </motion.div>
  )
}

const TESTI_DATA = [
  {
    quote: "My supervisor had not read my chapter for six weeks. FYPro validated my entire methodology section and flagged three gaps before he eventually did. I walked into that meeting actually prepared.",
    name: "Adaeze O.",
    dept: "Mass Communication · UNILAG · 400 Level",
    initials: "AO",
    avatarStyle: { background: 'linear-gradient(135deg, #0066FF, #3B82F6)' },
  },
  {
    quote: "The defense simulator asked me about the generalisability of my sample — a question I had genuinely never considered. I would have frozen in front of the panel. Instead, I had an answer ready.",
    name: "Tunde F.",
    dept: "Business Administration · LASU · 400 Level",
    initials: "TF",
    avatarStyle: { background: 'linear-gradient(135deg, #16A34A, #4ADE80)' },
  },
  {
    quote: "I spent three months on a topic that wasn't even researchable at my level. FYPro would have told me in three minutes. I wish this existed when I started, not when I was already in a panic.",
    name: "Chisom M.",
    dept: "Computer Science · FUTA · 400 Level",
    initials: "CM",
    avatarStyle: { background: 'linear-gradient(135deg, #F59E0B, #FCD34D)' },
  },
]

function TestimonialsTickerSection() {
  const [scope, tickerAnimate] = useAnimate()
  const animRef = useRef(null)

  useEffect(() => {
    const anim = tickerAnimate(scope.current, { x: ['0%', '-50%'] }, {
      duration: 34,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'loop',
    })
    animRef.current = anim
    return () => anim?.stop?.()
  }, [tickerAnimate, scope])

  return (
    <div className="overflow-hidden relative"
      onMouseEnter={() => animRef.current?.pause()}
      onMouseLeave={() => animRef.current?.play()}
    >
      <div className="absolute left-0 top-0 bottom-0 w-[120px] z-[2] pointer-events-none" style={{ background: 'linear-gradient(to right, #060E18, transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-[120px] z-[2] pointer-events-none" style={{ background: 'linear-gradient(to left, #060E18, transparent)' }} />
      <div ref={scope} className="flex gap-[18px]" style={{ width: 'max-content' }}>
        {[...TESTI_DATA, ...TESTI_DATA].map((t, i) => <TestiCard key={i} {...t} fixed />)}
      </div>
    </div>
  )
}

// ─── Stat Item (count-up) ─────────────────────────────────────────────────────

function StatItem({ renderNumber, target, label, delay }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const count = useCountUp(target, inView)
  return (
    <Reveal delay={delay} className="text-center">
      <div ref={ref} className="font-serif text-[2.6rem] text-white leading-none mb-1.5">
        {renderNumber(count)}
      </div>
      <div className="text-[0.8rem] text-white/65 font-medium">{label}</div>
    </Reveal>
  )
}

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeSection = useNavActive()

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrollTo = (id) => (e) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMobileOpen(false)
  }

  const navLinks = [
    { label: 'How It Works', id: 'how-it-works', href: '#how-it-works' },
    { label: 'Features', id: 'features', href: '#features' },
    { label: 'Pricing', id: 'pricing', href: '/pricing' },
    { label: 'About', id: 'about', href: '/about' },
    { label: 'Contact', id: 'contact', href: '/contact' },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-[200] h-[66px] flex items-center justify-between px-5 md:px-12 border-b transition-all duration-200 ${
          scrolled
            ? 'border-[rgba(0,102,255,0.18)]'
            : 'border-white/[0.06]'
        }`}
        style={{
          background: scrolled ? 'rgba(6,14,24,0.94)' : 'rgba(6,14,24,0.82)',
          backdropFilter: scrolled ? 'blur(24px)' : 'blur(16px)',
          WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'blur(16px)',
          boxShadow: scrolled ? '0 2px 20px rgba(0,0,0,0.4)' : 'none',
        }}
      >
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
        </div>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map(({ label, id, href }) => (
            <a
              key={id}
              href={href}
              onClick={href.startsWith('#') ? scrollTo(id) : undefined}
              className={`text-[0.875rem] font-medium transition-colors duration-150 relative no-underline after:content-[''] after:absolute after:bottom-[-3px] after:left-0 after:right-0 after:h-px after:bg-blue-brand after:transition-transform after:duration-150 after:origin-left ${
                activeSection === id
                  ? 'text-white after:scale-x-100'
                  : 'text-white/65 hover:text-white after:scale-x-0 hover:after:scale-x-100'
              }`}
            >
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <BtnLink href="/login" className="px-5 py-2 text-[0.8rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">Login</BtnLink>
          <BtnLink href="/login" className="px-5 py-2 text-[0.8rem] bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:-translate-y-0.5">Try Free</BtnLink>
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
            className="md:hidden fixed top-[66px] left-0 right-0 z-[190] border-b border-white/[0.07] px-6 pt-5 pb-7 flex flex-col gap-5 pointer-events-auto"
            style={{ background: 'rgba(6,14,24,0.98)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
            aria-hidden={!mobileOpen}
          >
            <div className="flex flex-col gap-1">
              {navLinks.map(({ label, id, href }) => (
                <a key={id} href={href} onClick={href.startsWith('#') ? scrollTo(id) : undefined} className="block py-3 px-2 text-base font-medium text-white/65 border-b border-white/[0.06] hover:text-white transition-colors no-underline">
                  {label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <BtnLink href="/login" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-transparent text-white border border-white/[0.22] hover:border-white/45">Login</BtnLink>
              <BtnLink href="/login" className="w-full py-2.5 px-[22px] text-[0.875rem] bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)]">Start Free</BtnLink>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function HeroMockup() {
  const [hoveredCard, setHoveredCard] = useState(null)
  const [card1Ref, card1Visible] = useReveal()
  const [card2Ref, card2Visible] = useReveal()
  const [card3Ref, card3Visible] = useReveal()

  const steps = [
    { label: 'Topic Validator', done: true },
    { label: 'Chapter Architect', done: true },
    { label: 'Methodology Advisor', done: true },
    { label: 'Instrument Builder', done: true },
    { label: 'Writing Planner', done: true },
    { label: 'Defense Simulator', active: true },
  ]

  const examiners = [
    {
      av: 'TM', avCls: 'bg-[rgba(0,102,255,0.3)] border-[1.5px] border-[rgba(0,102,255,0.6)]',
      name: 'The Methodologist', role: 'EXTERNAL EXAMINER',
      q: '"Your research objectives claim to be exploratory yet your design is conclusive. Justify this contradiction before we go further."',
      asking: true,
    },
    {
      av: 'SE', avCls: 'bg-[rgba(245,158,11,0.2)] border-[1.5px] border-[rgba(245,158,11,0.5)]',
      name: 'The Subject Expert', role: 'INTERNAL EXAMINER',
      q: '"What makes your contribution original? Every paper you cited arrived at a similar conclusion. Where is the gap you are filling?"',
      asking: false,
    },
    {
      av: 'DA', avCls: 'bg-[rgba(22,163,74,0.2)] border-[1.5px] border-[rgba(22,163,74,0.5)]',
      name: "The Devil's Advocate", role: 'SUPERVISOR · DEPT. REP',
      q: '"If your supervisor had never seen this project before today, what is the one thing they would reject immediately?"',
      asking: false,
    },
  ]

  return (
    <div className="relative rounded-[24px] border border-[rgba(0,102,255,0.22)] overflow-hidden" style={{ background: '#080F1C', boxShadow: '0 0 0 1px rgba(0,102,255,0.08), 0 24px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4)' }}>
      {/* Chrome */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-white/[0.03]">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-white/[0.08] border border-white/[0.14]" />)}
        </div>
        <div className="flex-1 bg-white/5 rounded-lg py-[5px] px-3 font-mono text-[0.7rem] text-white/35 text-center">fypro.vercel.app — Step 6: Defense Simulator</div>
      </div>

      {/* Shell */}
      <div className="grid min-h-[370px] grid-cols-1 md:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <div className="hidden md:block border-r border-white/5 py-5 bg-black/20">
          <div className="flex items-center gap-2 px-5 pb-4 border-b border-white/5 mb-3">
            <ShieldIcon size={20} />
            <span className="font-serif text-[0.9rem] text-white"><span>FY</span><span style={{ color: '#0066FF' }}>Pro</span></span>
          </div>
          {steps.map(({ label, done, active }) => (
            <div key={label} className={`flex items-center gap-2 px-5 py-[9px] text-[0.72rem] font-medium border-l-2 ${active ? 'text-white bg-[rgba(0,102,255,0.12)] border-blue-brand' : done ? 'text-[rgba(22,163,74,0.8)] border-transparent' : 'text-white/40 border-transparent'}`}>
              <div className="w-[7px] h-[7px] rounded-full bg-current flex-shrink-0" />{label}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-3.5">
          <div className="border-b border-white/5 pb-3.5">
            <div className="font-mono text-[0.62rem] tracking-[0.12em] uppercase text-blue-brand mb-1">Step 6 of 6 — Defense Prep</div>
            <div className="font-serif text-[1.1rem] text-white">Three-Examiner Panel Simulation</div>
          </div>

          {/* Examiners — individual reveal */}
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
            {examiners.map(({ av, avCls, name, role, q, asking }, i) => {
              const cardKeys = ['methodologist', 'subject-expert', 'devil-advocate']
              const cardRefs = [card1Ref, card2Ref, card3Ref]
              const cardVisibles = [card1Visible, card2Visible, card3Visible]
              const cardKey = cardKeys[i]
              const cardRef = cardRefs[i]
              const cardVisible = cardVisibles[i]
              const hovered = hoveredCard === cardKey
              return (
                <div
                  key={name}
                  ref={cardRef}
                  onMouseEnter={() => setHoveredCard(cardKey)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className={`rounded-xl p-3.5 cursor-default ${asking ? 'bg-[rgba(0,102,255,0.07)]' : 'bg-white/[0.03]'}`}
                  style={{
                    border: hovered ? '1px solid rgba(59,130,246,0.5)' : asking ? '1px solid rgba(0,102,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    boxShadow: hovered ? '0 0 24px rgba(59,130,246,0.2)' : 'none',
                    transform: cardVisible ? (hovered ? 'translateY(-4px)' : 'translateY(0)') : 'translateY(24px)',
                    opacity: cardVisible ? 1 : 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <motion.div
                    className={`w-[34px] h-[34px] rounded-full flex items-center justify-center font-mono text-[0.6rem] font-bold text-white mb-2 cursor-default ${avCls}`}
                    whileHover={{ boxShadow: asking ? '0 0 14px rgba(0,102,255,0.75), 0 0 30px rgba(0,102,255,0.35)' : undefined }}
                  >{av}</motion.div>
                  <div className="text-[0.68rem] font-bold text-white mb-0.5">{name}</div>
                  <div className="font-mono text-[0.58rem] text-white/35 mb-2">{role}</div>
                  <div className="text-[0.66rem] text-white/65 leading-[1.5] text-left">{q}</div>
                </div>
              )
            })}
          </div>

          {/* Vulnerabilities */}
          <div className="bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.22)] rounded-xl p-3 px-3.5">
            <div className="font-mono text-[0.6rem] tracking-[0.1em] uppercase text-[rgba(248,113,113,0.9)] mb-2">PROJECT VULNERABILITIES DETECTED</div>
            {[
              '⚠ Sampling frame excludes postgraduate respondents — representativeness risk',
              '⚠ Chapter 2 theoretical framework not linked to research objectives',
              '⚠ No triangulation strategy declared for mixed-methods design',
            ].map((v, i) => (
              <div key={i} className={`text-[0.68rem] text-white/[0.62] leading-[1.6] py-[3px] ${i > 0 ? 'border-t border-[rgba(220,38,38,0.1)]' : ''}`}>{v}</div>
            ))}
          </div>

          {/* Chips */}
          <div className="flex gap-2 flex-wrap">
            <div className="font-mono text-[0.62rem] px-2.5 py-1 rounded-lg bg-[rgba(22,163,74,0.12)] border border-[rgba(22,163,74,0.3)] text-[#4ADE80]">Readiness Score: 84 / 100</div>
            <div className="font-mono text-[0.62rem] px-2.5 py-1 rounded-lg bg-[rgba(0,102,255,0.12)] border border-[rgba(0,102,255,0.3)] text-[#60A5FA]">3 questions remaining</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function HeroHeadline() {
  const [ref, visible] = useReveal()
  const words = ['The', 'Supervisor', 'Most', 'Final', 'Year', 'Students', 'Never', 'Had']
  const italic = new Set(['Never', 'Had'])
  return (
    <h1
      ref={ref}
      className="relative z-[1] font-serif font-normal leading-[1.1] text-white max-w-[820px] mb-[22px]"
      style={{
        fontSize: 'clamp(2.4rem,6vw,4.4rem)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {words.map((word, i) => (
        <span key={i} className="inline-block mr-[0.25em]">
          {italic.has(word) ? <em style={{ fontStyle: 'italic', color: '#60A5FA' }}>{word}</em> : word}
        </span>
      ))}
    </h1>
  )
}

function HeroSub() {
  const [ref, visible] = useReveal()
  const text = "FYPro guides you from a rough topic to a defensible project — then puts you in front of three examiners before your real panel does."
  const { displayed, done } = useTypewriter(text, 1080, 26)
  return (
    <p
      ref={ref}
      className="relative z-[1] text-[1.05rem] text-white/65 max-w-[540px] leading-[1.75] mb-[38px]"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}
    >
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
          className="inline-block w-[2px] h-[0.9em] bg-white/65 ml-px align-text-bottom"
        />
      )}
    </p>
  )
}

function Hero() {
  const heroRef = useRef(null)
  const [spotPos, setSpotPos] = useState({ x: '50%', y: '42%' })
  const [btnsRef, btnsVisible] = useReveal()
  const [mockupRef, mockupVisible] = useReveal()

  useEffect(() => {
    const el = heroRef.current
    if (!el) return
    const onMove = (e) => {
      const r = el.getBoundingClientRect()
      setSpotPos({ x: e.clientX - r.left, y: e.clientY - r.top })
    }
    const onLeave = () => setSpotPos({ x: '50%', y: '42%' })
    el.addEventListener('mousemove', onMove, { passive: true })
    el.addEventListener('mouseleave', onLeave)
    return () => { el.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', onLeave) }
  }, [])

  return (
    <motion.section
      ref={heroRef}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      }}
      transition={{
        opacity: { duration: 0.6 },
        backgroundPosition: { duration: 8, ease: 'easeInOut', repeat: Infinity },
      }}
      className="min-h-screen flex flex-col items-center text-center relative overflow-hidden"
      style={{
        padding: '140px 24px 80px',
        background: 'linear-gradient(135deg, #060E18 0%, #091623 28%, #0D1B2A 54%, #07111E 80%, #060E18 100%)',
        backgroundSize: '400% 400%',
      }}
    >
      {/* Dot grid + blue radial */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(ellipse 80% 55% at 50% 10%, rgba(0,102,255,0.18) 0%, transparent 65%), radial-gradient(circle, rgba(0,102,255,0.045) 1px, transparent 1px)',
        backgroundSize: '100% 100%, 28px 28px',
      }} />
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-[100px] pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, #060E18)' }} />
      {/* Cursor spotlight */}
      <div className="absolute pointer-events-none w-[700px] h-[700px] rounded-full z-0 will-change-[left,top]"
        style={{ left: spotPos.x, top: spotPos.y, transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(0,102,255,0.07) 0%, transparent 65%)', transition: 'left 0.1s ease, top 0.1s ease' }} />

      {/* Eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-[1] inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[0.68rem] font-medium text-[#60A5FA] tracking-[0.1em] uppercase mb-7"
        style={{ background: 'rgba(0,102,255,0.1)', border: '1px solid rgba(0,102,255,0.3)' }}
      >
        <motion.span
          animate={{ opacity: [1, 0.3, 1], boxShadow: ['0 0 0 0 rgba(96,165,250,0)', '0 0 0 4px rgba(96,165,250,0.35), 0 0 12px rgba(96,165,250,0.4)', '0 0 0 0 rgba(96,165,250,0)'] }}
          transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] flex-shrink-0"
        />
        Built for Nigerian Final Year Students
      </motion.div>

      <HeroHeadline />
      <HeroSub />

      {/* Actions */}
      <div
        ref={btnsRef}
        className="relative z-[1] flex gap-3 items-center justify-center flex-wrap mb-[72px]"
        style={{ opacity: btnsVisible ? 1 : 0, transform: btnsVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}
      >
        <BtnLink href="/login" className="px-8 py-3.5 text-base bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:-translate-y-0.5">Start Free</BtnLink>
        <BtnLink href="#how-it-works" className="px-8 py-3.5 text-base bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>
          See How It Works
        </BtnLink>
      </div>

      {/* App Mockup */}
      <div
        ref={mockupRef}
        className="relative z-[1] w-full max-w-[880px]"
        style={{ opacity: mockupVisible ? 1 : 0, transform: mockupVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}
      >
        <div className="absolute pointer-events-none blur-[20px]" style={{ top: '30%', left: '10%', right: '10%', bottom: -30, background: 'radial-gradient(ellipse, rgba(0,102,255,0.22) 0%, transparent 70%)' }} />
        <HeroMockup />
      </div>
    </motion.section>
  )
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────

function StatsBar() {
  const stats = [
    { target: 500, renderNumber: (n) => <>{n}<em className="not-italic text-blue-brand">K+</em></>, label: 'Final year students in Nigeria', delay: 0 },
    { target: 6, renderNumber: (n) => <em className="not-italic text-blue-brand">{n}</em>, label: 'Structured research steps', delay: 0.1 },
    { target: 3, renderNumber: (n) => <em className="not-italic text-blue-brand">{n}</em>, label: 'AI examiners on your panel', delay: 0.2 },
    { target: 1, renderNumber: (n) => <>₦<em className="not-italic text-blue-brand">{n}B+</em></>, label: 'Academic coaching market (NG)', delay: 0.3 },
  ]
  return (
    <div className="bg-bg-dark border-t border-b border-white/5 py-11">
      <div className="max-w-[1080px] mx-auto px-5 md:px-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {stats.map((s, i) => <StatItem key={i} {...s} />)}
        </div>
      </div>
    </div>
  )
}

// ─── FEATURES ─────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    color: 'blue', n: '1', kicker: 'Step 1 — Topic Validator', title: 'Is Your Topic Actually Researchable?',
    desc: 'FYPro analyses your raw topic idea against scope, originality, and departmental feasibility. You receive a scored verdict and a sharpened topic statement before you waste weeks on a dead end.',
    icon: <svg width="20" height="20" viewBox="0 0 256 256" fill="#60A5FA"><path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z"/></svg>,
    hoverShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,102,255,0.3), 0 0 32px rgba(0,102,255,0.18)',
  },
  {
    color: 'green', n: '2', kicker: 'Step 2 — Chapter Architect', title: 'Your Full Project Blueprint',
    desc: 'Generate a complete five-chapter outline — section headings, key literature, theoretical framework, and a visual literature map — all tailored to your department and level, in under two minutes.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    hoverShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(22,163,74,0.3), 0 0 32px rgba(22,163,74,0.16)',
  },
  {
    color: 'amber', n: '3', kicker: 'Step 3 — Methodology Advisor', title: 'The Right Design for Your Research',
    desc: 'Select the correct research design, sampling strategy, and data approach for your topic. Every choice is justified and written into language you can defend in Chapter 3.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FCD34D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>,
    hoverShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(245,158,11,0.3), 0 0 32px rgba(245,158,11,0.13)',
  },
  {
    color: 'blue', n: '4', kicker: 'Step 4 — Writing Planner', title: 'A Writing Schedule You Can Actually Keep',
    desc: 'Get a week-by-week writing schedule calculated from your submission deadline. Buffer weeks, milestone checkpoints, and chapter word targets — so you always know exactly what to write next.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    hoverShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,102,255,0.3), 0 0 32px rgba(0,102,255,0.18)',
  },
  {
    color: 'green', n: '5', kicker: 'Step 5 — Project Reviewer', title: 'Chapter-by-Chapter Feedback Before You Submit',
    desc: 'Submit any chapter and receive structured feedback on argument flow, citation gaps, and examiner-facing weaknesses. The independent review your supervisor may never give you — before it is too late.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    hoverShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(22,163,74,0.3), 0 0 32px rgba(22,163,74,0.16)',
  },
  {
    color: 'red', n: '6', kicker: 'Step 6 — Defense Simulator', title: 'Three Examiners. Full Panel Pressure.',
    desc: 'Face an external examiner, internal examiner, and supervisor simultaneously in a full defense simulation. Receive a readiness score and targeted prep notes. Walk into your viva knowing every question they can throw at you.',
    icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    hoverShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 0 1px rgba(220,38,38,0.3), 0 0 32px rgba(220,38,38,0.13)',
  },
]

const FEAT_COLOR_MAP = {
  blue:  { kicker: '#60A5FA', iconBg: 'rgba(0,102,255,0.12)', border: '#0066FF' },
  green: { kicker: '#4ADE80', iconBg: 'rgba(22,163,74,0.12)', border: '#0066FF' },
  amber: { kicker: '#FCD34D', iconBg: 'rgba(245,158,11,0.12)', border: '#0066FF' },
  red:   { kicker: '#F87171', iconBg: 'rgba(220,38,38,0.12)', border: '#0066FF' },
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative" style={{ background: '#060E18' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="max-w-[1080px] mx-auto px-5 md:px-10 relative">
        <Reveal as="span" className="block font-mono text-[0.68rem] tracking-[0.14em] uppercase text-blue-brand text-center mb-3.5">Core Features</Reveal>
        <Reveal delay={0.05} as="h2" className="font-serif text-center text-white leading-[1.15] mb-3.5" style={{ fontSize: 'clamp(1.8rem,4vw,2.9rem)' }}>Built for the gaps supervisors leave behind</Reveal>
        <Reveal delay={0.1} as="p" className="text-center text-white/65 text-[0.975rem] max-w-[500px] mx-auto mb-[60px] leading-[1.75]">Every step solves a real, specific problem that final year students face with no one to call.</Reveal>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
          {FEATURES.map((f, i) => {
            const c = FEAT_COLOR_MAP[f.color]
            return (
              <Reveal key={f.n} delay={i * 0.07}>
                <MagneticCard
                  className="relative overflow-hidden rounded-2xl p-9 h-full cursor-default"
                  style={{ background: 'linear-gradient(150deg,#0D1B2A 0%,#091420 100%)', border: '1px solid rgba(255,255,255,0.07)', borderLeft: `3px solid ${c.border}`, transition: 'border-color 0.2s ease' }}
                  hoverShadow={f.hoverShadow}
                  dataN={f.n}
                >
                  {/* Watermark digit */}
                  <span aria-hidden="true" className="absolute bottom-[-16px] right-[14px] font-serif text-[7.5rem] leading-none pointer-events-none select-none" style={{ color: 'rgba(255,255,255,0.025)' }}>{f.n}</span>

                  <motion.div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                    style={{ background: c.iconBg }}
                    whileHover={{ rotate: 10, scale: 1.2 }}
                    transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                  >
                    {f.icon}
                  </motion.div>
                  <div className="font-mono text-[0.62rem] tracking-[0.1em] uppercase mb-2 font-medium" style={{ color: c.kicker }}>{f.kicker}</div>
                  <h3 className="font-serif text-[1.3rem] text-white mb-2.5">{f.title}</h3>
                  <p className="text-[0.875rem] text-white/65 leading-[1.68]">{f.desc}</p>
                </MagneticCard>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── HOW IT WORKS ─────────────────────────────────────────────────────────────

const STEPS = [
  { num: '01', title: 'Topic Validator', desc: 'Enter your rough idea. Get a researchability verdict, a feasibility score against your department and level, and a refined topic statement ready to show your supervisor.' },
  { num: '02', title: 'Chapter Architect + Literature Map', desc: 'Generate a complete five-chapter breakdown with section headings, key scholars to engage, and a visual literature map linking your theoretical framework to your research questions.' },
  { num: '03', title: 'Methodology Advisor', desc: 'Select the right research design, sampling strategy, and data approach for your topic. Quantitative, qualitative, or mixed methods — each choice justified and ready to write into Chapter 3.' },
  { num: '04', title: 'Writing Planner', desc: 'Get a personalised week-by-week writing schedule calculated from your submission deadline. Buffer weeks, milestone checkpoints, and a chapter-by-chapter word target — all built in.' },
  { num: '05', title: 'Project Reviewer', desc: 'Submit any chapter for structured AI feedback on argument flow, citation gaps, and examiner-facing weaknesses. The independent review your supervisor may never give you — before it is too late to act on it.' },
  { num: '06', title: 'Defense Simulator — Three-Examiner Panel', desc: 'Face three AI examiners in a full viva simulation. Receive a readiness score, a weak-spots report by chapter, and a preparation guide for every angle they can attack. Walk into your real defense unshakeable.' },
]

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 bg-bg-dark">
      <div className="max-w-[1080px] mx-auto px-5 md:px-10">
        <Reveal as="span" className="block font-mono text-[0.68rem] tracking-[0.14em] uppercase text-blue-brand text-center mb-3.5">The Process</Reveal>
        <Reveal delay={0.05} as="h2" className="font-serif text-center text-white leading-[1.15] mb-3.5" style={{ fontSize: 'clamp(1.8rem,4vw,2.9rem)' }}>Six steps. One defensible project.</Reveal>
        <Reveal delay={0.1} as="p" className="text-center text-white/65 text-[0.975rem] max-w-[500px] mx-auto mb-[60px] leading-[1.75]">Designed around the exact journey Nigerian final year students go through — with or without a present supervisor.</Reveal>

        <div className="max-w-[760px] mx-auto relative">
          {/* Vertical connector */}
          <div className="absolute top-6 bottom-6 w-0.5 left-[23px]" style={{ background: 'linear-gradient(to bottom, #0066FF, rgba(0,102,255,0.08))' }} />

          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 0.08} className="grid gap-6 py-[18px] items-start" style={{ gridTemplateColumns: '48px 1fr' }}>
              <div className="w-12 h-12 rounded-full border-2 border-blue-brand flex items-center justify-center font-mono text-[0.8rem] font-semibold text-blue-brand relative z-[1] flex-shrink-0" style={{ background: '#060E18' }}>{s.num}</div>
              <div className="pt-2">
                <div className="font-serif text-[1.15rem] text-white mb-1.5">{s.title}</div>
                <div className="text-[0.875rem] text-white/65 leading-[1.7]">{s.desc}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── TESTIMONIALS ─────────────────────────────────────────────────────────────

function TestimonialsSection() {
  return (
    <section className="py-24 relative" style={{ background: '#060E18' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
      <div className="max-w-[1080px] mx-auto px-5 md:px-10 relative">
        <Reveal as="span" className="block font-mono text-[0.68rem] tracking-[0.14em] uppercase text-blue-brand text-center mb-3.5">Student Voices</Reveal>
        <Reveal delay={0.05} as="h2" className="font-serif text-center text-white leading-[1.15] mb-3.5" style={{ fontSize: 'clamp(1.8rem,4vw,2.9rem)' }}>What it felt like to go from confused to confident</Reveal>
        <Reveal delay={0.1} as="p" className="text-center text-white/65 text-[0.975rem] max-w-[500px] mx-auto mb-[60px] leading-[1.75]">&nbsp;</Reveal>
      </div>
      <TestimonialsTickerSection />
    </section>
  )
}

// ─── PRICING ──────────────────────────────────────────────────────────────────

const PLANS = [
  {
    tier: 'Free', amount: '₦0', period: 'forever', featured: false,
    features: ['Topic Validator (3 runs)', 'Chapter Architect (basic outline)', 'Methodology Advisor (recommendation only)', 'Writing Planner (4 weeks only)'],
    ctaLabel: 'Start Free', ctaGhost: true,
  },
  {
    tier: 'Student', amount: '₦2,000', period: 'one-time per project', featured: true, badge: 'MOST POPULAR',
    features: ['Everything in Free', 'Topic Validator (20 runs)', 'Chapter Architect (full breakdown)', 'Methodology Advisor (full + defense answer)', 'Writing Planner (full semester)', 'Literature Map', 'Instrument Builder', 'Abstract Generator', 'Project Reviewer (10 submissions)', 'Supervisor Email Generator'],
    ctaLabel: 'Get Student Plan', ctaGhost: false,
  },
  {
    tier: 'Defense', amount: '₦3,500', period: 'one-time per project', featured: false,
    features: ['Everything in Student', 'Red Flag Detector (3 runs)', 'Defense Simulator (5 full sessions)', 'Three examiner voices', 'Live confidence scoring', 'Session summary report'],
    ctaLabel: 'Get Defense Plan', ctaGhost: true,
  },
]

function PricingSection() {
  return (
    <section id="pricing" className="py-24 bg-bg-dark">
      <div className="max-w-[1080px] mx-auto px-5 md:px-10">
        <Reveal as="span" className="block font-mono text-[0.68rem] tracking-[0.14em] uppercase text-blue-brand text-center mb-3.5">Pricing</Reveal>
        <Reveal delay={0.05} as="h2" className="font-serif text-center text-white leading-[1.15] mb-3.5" style={{ fontSize: 'clamp(1.8rem,4vw,2.9rem)' }}>Simple, honest pricing</Reveal>
        <Reveal delay={0.1} as="p" className="text-center text-white/65 text-[0.975rem] max-w-[500px] mx-auto mb-[60px] leading-[1.75]">Start free. Upgrade only when your defense date gets close.</Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-[18px] items-start">
          {PLANS.map((p, i) => (
            <Reveal key={p.tier} delay={i * 0.08}>
              <motion.div
                className="relative rounded-2xl py-9 px-8"
                style={{
                  background: p.featured ? 'linear-gradient(150deg, rgba(0,102,255,0.1) 0%, #0A1929 100%)' : 'linear-gradient(150deg,#0D1B2A 0%,#091420 100%)',
                  border: p.featured ? '1px solid #0066FF' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: p.featured ? '0 0 48px rgba(0,102,255,0.12)' : 'none',
                  transform: p.featured ? 'scale(1.025)' : 'none',
                }}
                whileHover={!p.featured ? { y: -4, borderColor: 'rgba(0,102,255,0.3)' } : {}}
              >
                {p.badge && (
                  <motion.div
                    animate={{ boxShadow: ['0 0 0 0 rgba(0,102,255,0.55)', '0 0 0 5px rgba(0,102,255,0.08), 0 0 18px rgba(0,102,255,0.38)', '0 0 0 0 rgba(0,102,255,0.55)'] }}
                    transition={{ duration: 2.2, ease: 'easeInOut', repeat: Infinity }}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-brand text-white font-mono text-[0.58rem] tracking-[0.1em] px-3.5 py-1 rounded-full whitespace-nowrap"
                  >{p.badge}</motion.div>
                )}
                <div className="font-mono text-[0.68rem] tracking-[0.1em] uppercase text-white/65 mb-3.5">{p.tier}</div>
                <div className="font-serif text-[2.8rem] text-white leading-none mb-[3px]">{p.amount}</div>
                <div className="text-[0.78rem] text-white/65 mb-5">{p.period}</div>
                <hr className="border-none border-t border-white/[0.07] mb-5" />
                <ul className="list-none flex flex-col gap-2.5 mb-7">
                  {p.features.map(f => (
                    <li key={f} className="text-[0.845rem] text-white/[0.72] flex items-start gap-2 leading-[1.5]">
                      <span className="text-green-brand font-bold flex-shrink-0 mt-[1px]">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <BtnButton
                  className={`w-full py-3 text-[0.875rem] ${p.ctaGhost ? 'bg-transparent text-white border border-white/[0.2] hover:border-white/[0.42] hover:bg-white/[0.04]' : 'bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)]'}`}
                  onClick={() => window.location.href = '/login'}
                >
                  {p.ctaLabel}
                </BtnButton>
              </motion.div>
            </Reveal>
          ))}
        </div>

        <p className="text-center mt-7 text-[0.8rem] text-white/65 font-mono">Project Reset — start a new project from ₦1,500</p>
      </div>
    </section>
  )
}

// ─── LANDING FAQ ─────────────────────────────────────────────────────────────

const LANDING_FAQ_ITEMS = [
  {
    q: 'Is FYPro free to use?',
    a: "Yes. The first three steps — Topic Validator, Chapter Architect, and Methodology Advisor — are completely free. You only pay when you're ready to unlock Writing Planner, Project Reviewer, or the Defense Simulator.",
  },
  {
    q: 'How is FYPro different from ChatGPT?',
    a: 'ChatGPT is a blank box. FYPro is a structured journey. FYPro knows your faculty, your department, your deadline, and your methodology — and every response uses that context. ChatGPT will not interrogate you in a defense simulation. FYPro will.',
  },
  {
    q: 'Will FYPro write my project for me?',
    a: 'No — and that is intentional. FYPro thinks with you, not for you. It validates your thinking, maps your chapters, recommends your methodology, and prepares you for hard questions. Your project stays yours.',
  },
  {
    q: 'What Nigerian universities does FYPro support?',
    a: 'FYPro currently supports UNILAG, FUTA, LASU, OAU, UNIPORT, ABU, UNIBEN, and UNILORIN with more being added. The Topic Validator and Methodology Advisor understand faculty structures across all supported universities.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'All Nigerian debit cards, bank transfers, and USSD payments through Paystack. No international card required.',
  },
  {
    q: 'Can I use FYPro on my phone?',
    a: 'Yes. FYPro is fully responsive and works on any device. The Defense Simulator works best on desktop but all other steps work perfectly on mobile.',
  },
  {
    q: 'What if I change my topic mid-project?',
    a: 'You can reset your project at any time. A Project Reset costs ₦1,500 and gives you a fresh start while keeping your account and history.',
  },
]

function LandingFAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="border-b border-[var(--border-color)] py-5">
      <button
        className="w-full flex items-center justify-between text-left bg-transparent border-0 cursor-pointer group"
        onClick={onToggle}
      >
        <span className="font-sans font-medium text-white text-[0.9rem] pr-4 leading-snug">{q}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors duration-150"
          width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
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
            <p className="font-sans text-slate-400 text-sm leading-relaxed mt-3 pb-2">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function LandingFAQSection() {
  const [openIndex, setOpenIndex] = useState(null)
  return (
    <section id="faq" className="py-24 bg-bg-dark">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <Reveal>
          <h2 className="font-serif text-4xl text-white text-center">Frequently asked questions</h2>
        </Reveal>
        <Reveal delay={0.06}>
          <p className="text-slate-400 text-center mt-3 mb-12">Everything you need to know before you start.</p>
        </Reveal>
        <Reveal delay={0.1}>
          <div>
            {LANDING_FAQ_ITEMS.map((item, i) => (
              <LandingFAQItem
                key={i}
                q={item.q}
                a={item.a}
                isOpen={openIndex === i}
                onToggle={() => setOpenIndex(openIndex === i ? null : i)}
              />
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: '#060E18' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,102,255,0.14) 0%, transparent 65%)' }} />
      <div className="max-w-[1080px] mx-auto px-5 md:px-10 relative z-[1]">
        <div className="max-w-[620px] mx-auto text-center">
          <ShieldIcon size={56} className="block mx-auto mb-[22px]" style={{ filter: 'drop-shadow(0 4px 18px rgba(0,102,255,0.45))' }} />
          <Reveal as="h2" className="font-serif text-white leading-[1.15] mb-3.5" style={{ fontSize: 'clamp(1.9rem,4.5vw,3rem)' }}>Your defense is coming.<br />Are you ready?</Reveal>
          <Reveal delay={0.1} as="p" className="text-base text-white/65 leading-[1.75] mb-9">Every question an examiner can ask, FYPro has already asked you first.<br />Start now — it's free, no account needed.</Reveal>
          <Reveal delay={0.15} className="flex justify-center gap-3 flex-wrap">
            <BtnLink href="/login" className="px-8 py-3.5 text-base bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:-translate-y-0.5">Start Free — No Sign Up</BtnLink>
            <BtnLink href="#how-it-works" className="px-8 py-3.5 text-base bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">See the 6 Steps</BtnLink>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06]" style={{ background: '#030A12', padding: '56px 0 28px' }}>
      <div className="absolute top-0 left-0 right-0 h-[72px] pointer-events-none z-0" style={{ background: 'linear-gradient(to bottom, #060E18, transparent)' }} />
      <div className="max-w-[1080px] mx-auto px-5 md:px-10 relative z-[1]">
        <div className="grid gap-7 mb-11 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[240px_1fr_1fr_1fr]">
          <Reveal>
          <div>
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity }}
              className="flex items-center gap-[9px] mb-3"
            >
              <ShieldIcon size={26} />
              <span className="font-serif text-[1.4rem] text-white"><span>FY</span><span style={{ color: '#0066FF' }}>Pro</span></span>
            </motion.div>
            <p className="text-[0.82rem] text-white/65 leading-[1.65]">The AI research companion built specifically for Nigerian final year students — from rough idea to defensible project.</p>
          </div>
          </Reveal>

          <Reveal delay={0.05}>
          <div>
            <div className="text-[0.78rem] font-bold text-white tracking-[0.05em] uppercase mb-4">Product</div>
            <ul className="list-none flex flex-col gap-[9px]">
              {[['#how-it-works','How It Works'],['#features','Features'],['#pricing','Pricing'],['/login','Launch App']].map(([href, label]) => (
                <li key={label}><a href={href} className="text-[0.84rem] text-white/65 hover:text-white transition-colors duration-150 no-underline">{label}</a></li>
              ))}
            </ul>
          </div>
          </Reveal>

          <Reveal delay={0.1}>
          <div>
            <div className="text-[0.78rem] font-bold text-white tracking-[0.05em] uppercase mb-4">Steps</div>
            <ul className="list-none flex flex-col gap-[9px]">
              {['Topic Validator','Chapter Architect','Methodology Advisor','Writing Planner','Project Reviewer','Defense Simulator'].map(s => (
                <li key={s}><a href="/login" className="text-[0.84rem] text-white/65 hover:text-white transition-colors duration-150 no-underline">{s}</a></li>
              ))}
            </ul>
          </div>
          </Reveal>

          <Reveal delay={0.15}>
          <div>
            <div className="text-[0.78rem] font-bold text-white tracking-[0.05em] uppercase mb-4">About</div>
            <ul className="list-none flex flex-col gap-[9px]">
              {[['About FYPro', '/about'], ['Contact', '/contact']].map(([label, href]) => (
                <li key={label}><a href={href} className="text-[0.84rem] text-white/65 hover:text-white transition-colors duration-150 no-underline">{label}</a></li>
              ))}
            </ul>
          </div>
          </Reveal>
        </div>

        <div className="flex items-center justify-between pt-[22px] border-t border-white/5 flex-wrap gap-2.5">
          <div className="text-[0.76rem] text-white/[0.28]">
            © 2026 FYPro. Built for African students.
          </div>
          <div className="flex gap-[18px]">
            <a href="/privacy" className="text-[0.76rem] text-white/[0.28] hover:text-white/55 transition-colors duration-150 no-underline">Privacy</a>
            <a href="/terms" className="text-[0.76rem] text-white/[0.28] hover:text-white/55 transition-colors duration-150 no-underline">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0
      setScrollProgress(progress)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
      <div style={{ position: 'fixed', top: 0, left: 0, height: '3px', width: scrollProgress + '%', backgroundColor: '#2563EB', zIndex: 9999, transition: 'width 0.1s linear' }} />
      <Navbar />
      <Hero />
      <StatsBar />
      <FeaturesSection />
      <SectionDivider />
      <HowItWorks />
      <SectionDivider />
      <TestimonialsSection />
      <SectionDivider />
      <PricingSection />
      <SectionDivider />
      <LandingFAQSection />
      <FinalCTA />
      <Footer />
      <BackToTop />
    </motion.div>
  )
}
