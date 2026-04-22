"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, useInView, useScroll, useTransform } from "framer-motion";

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay, ease: [0.25, 0.4, 0.25, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardReveal = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] },
  },
};

// ─── Animated Dot Canvas Background ─────────────────────────────────────────

function DotCanvas() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const dotsRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0 });

  const DOT_SPACING = 28;
  const DOT_RADIUS = 1.2;
  const OPACITY_MIN = 0.08;
  const OPACITY_MAX = 0.28;

  const buildDots = useCallback(() => {
    const { w, h } = sizeRef.current;
    if (!w || !h) return;
    const dots = [];
    for (let col = 0; col < Math.ceil(w / DOT_SPACING); col++) {
      for (let row = 0; row < Math.ceil(h / DOT_SPACING); row++) {
        const base = Math.random() * (OPACITY_MAX - OPACITY_MIN) + OPACITY_MIN;
        dots.push({
          x: col * DOT_SPACING + DOT_SPACING / 2,
          y: row * DOT_SPACING + DOT_SPACING / 2,
          opacity: base,
          speed: (Math.random() * 0.002 + 0.0005) * (Math.random() < 0.5 ? 1 : -1),
        });
      }
    }
    dotsRef.current = dots;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { clientWidth: w, clientHeight: h } = canvas.parentElement ?? canvas;
    canvas.width = w;
    canvas.height = h;
    sizeRef.current = { w, h };
    buildDots();
  }, [buildDots]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const { w, h } = sizeRef.current;
    if (!ctx || !w) { rafRef.current = requestAnimationFrame(draw); return; }

    ctx.clearRect(0, 0, w, h);
    dotsRef.current.forEach((d) => {
      d.opacity += d.speed;
      if (d.opacity >= OPACITY_MAX || d.opacity <= OPACITY_MIN) {
        d.speed = -d.speed;
        d.opacity = Math.max(OPACITY_MIN, Math.min(d.opacity, OPACITY_MAX));
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(0, 102, 255, ${d.opacity.toFixed(3)})`;
      ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [resize, draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

// ─── Navbar ──────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { label: "How it Works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "For Students", href: "#why-fypro" },
  { label: "Pricing", href: "#pricing" },
];

function Navbar({ onGetStarted }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "background 0.25s ease, border-color 0.25s ease, backdrop-filter 0.25s ease",
        background: scrolled ? "rgba(13, 27, 42, 0.9)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(255,255,255,0.08)" : "1px solid transparent",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <a
          href="#"
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "1.5rem",
            color: "#ffffff",
            textDecoration: "none",
            letterSpacing: "-0.01em",
          }}
        >
          FYPro
        </a>

        {/* Nav links — hidden on mobile */}
        <div className="hidden md:flex" style={{ gap: 32, alignItems: "center" }}>
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "rgba(255,255,255,0.65)",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.target.style.color = "#ffffff")}
              onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.65)")}
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          onClick={onGetStarted}
          whileHover={{ boxShadow: "0 0 20px rgba(22, 163, 74, 0.45)" }}
          whileTap={{ scale: 0.97 }}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#ffffff",
            background: "#16A34A",
            border: "none",
            borderRadius: 10,
            padding: "10px 22px",
            cursor: "pointer",
            transition: "background 0.2s ease",
          }}
        >
          Get Started
        </motion.button>
      </div>
    </motion.nav>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────

function HeroSection({ onGetStarted }) {
  const words = "The Supervisor You Never Had.".split(" ");

  return (
    <section
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#0D1B2A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {/* Animated dot canvas */}
      <DotCanvas />

      {/* Radial vignette */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, transparent 20%, #0D1B2A 90%)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Bottom fade */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 180,
          background: "linear-gradient(to top, #0D1B2A, transparent)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          textAlign: "center",
          maxWidth: 820,
          margin: "0 auto",
          padding: "80px 24px 48px",
        }}
      >
        {/* Badge */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{ marginBottom: 28 }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.12em",
              color: "rgba(0, 102, 255, 0.9)",
              background: "rgba(0, 102, 255, 0.1)",
              border: "1px solid rgba(0, 102, 255, 0.25)",
              borderRadius: 999,
              padding: "6px 16px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#0066FF",
                display: "inline-block",
              }}
            />
            AI-POWERED · BUILT FOR NIGERIAN UNIVERSITIES
          </span>
        </motion.div>

        {/* Heading — word by word */}
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
            lineHeight: 1.1,
            color: "#ffffff",
            marginBottom: 28,
            letterSpacing: "-0.02em",
          }}
        >
          {words.map((word, i) => (
            <motion.span
              key={i}
              custom={0.35 + i * 0.09}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              style={{ display: "inline-block", marginRight: "0.25em" }}
            >
              {word}
            </motion.span>
          ))}
        </motion.h1>

        {/* Subheading */}
        <motion.p
          custom={0.85}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "clamp(1rem, 2.2vw, 1.2rem)",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.62)",
            maxWidth: 580,
            margin: "0 auto 44px",
          }}
        >
          FYPro guides Nigerian final year students from a rough topic idea to a
          defensible project — and puts you in front of an AI panel before the
          real defense. No supervisor required.
        </motion.p>

        {/* CTA */}
        <motion.div
          custom={1.1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}
        >
          <motion.button
            onClick={onGetStarted}
            whileHover={{
              scale: 1.03,
              boxShadow: "0 0 32px rgba(22, 163, 74, 0.55)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "1rem",
              fontWeight: 600,
              color: "#ffffff",
              background: "#16A34A",
              border: "none",
              borderRadius: 12,
              padding: "15px 36px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Get Started
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.button>

          <motion.a
            href="#how-it-works"
            whileHover={{ borderColor: "rgba(255,255,255,0.4)" }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "1rem",
              fontWeight: 600,
              color: "rgba(255,255,255,0.7)",
              background: "transparent",
              border: "1.5px solid rgba(255,255,255,0.18)",
              borderRadius: 12,
              padding: "15px 36px",
              cursor: "pointer",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              transition: "border-color 0.2s ease, color 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
          >
            See how it works
          </motion.a>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          custom={1.35}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          style={{
            marginTop: 64,
            display: "flex",
            justifyContent: "center",
            gap: 48,
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "6", label: "Guided Steps" },
            { value: "3", label: "AI Examiners" },
            { value: "100%", label: "Free to Use" },
          ].map(({ value, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "1.75rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "0.75rem",
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 6,
                  letterSpacing: "0.04em",
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          style={{
            width: 24,
            height: 38,
            border: "1.5px solid rgba(255,255,255,0.2)",
            borderRadius: 12,
            display: "flex",
            justifyContent: "center",
            paddingTop: 6,
          }}
        >
          <div
            style={{
              width: 4,
              height: 8,
              background: "rgba(255,255,255,0.4)",
              borderRadius: 2,
            }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─── How It Works — 6 Steps ───────────────────────────────────────────────────

const STEPS = [
  {
    num: "01",
    title: "Topic Validator",
    desc: "Paste your topic idea. FYPro scores its clarity, scope, and academic viability — then suggests sharper alternatives.",
    accent: "#0066FF",
    accentBg: "rgba(0, 102, 255, 0.07)",
  },
  {
    num: "02",
    title: "Chapter Architect",
    desc: "Generate a full chapter outline with a literature map — structured the way your department actually expects it.",
    accent: "#F59E0B",
    accentBg: "rgba(245, 158, 11, 0.07)",
  },
  {
    num: "03",
    title: "Methodology Advisor",
    desc: "Pick the right research design, sampling strategy, and data analysis method for your field and faculty.",
    accent: "#16A34A",
    accentBg: "rgba(22, 163, 74, 0.07)",
  },
  {
    num: "04",
    title: "Instrument Builder",
    desc: "Build your questionnaire or interview guide from scratch — aligned with your objectives and methodology.",
    accent: "#0066FF",
    accentBg: "rgba(0, 102, 255, 0.07)",
  },
  {
    num: "05",
    title: "Writing Planner",
    desc: "Get a week-by-week writing schedule that fits your submission deadline, with buffer weeks built in.",
    accent: "#F59E0B",
    accentBg: "rgba(245, 158, 11, 0.07)",
  },
  {
    num: "06",
    title: "Defense Prep",
    desc: "Face a three-examiner AI panel. Each examiner has a distinct personality and grills you on your methodology.",
    accent: "#DC2626",
    accentBg: "rgba(220, 38, 38, 0.07)",
  },
];

function StepCard({ step, index }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      variants={cardReveal}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      transition={{ delay: (index % 3) * 0.1 }}
      style={{
        position: "relative",
        background: step.accentBg,
        border: `1px solid rgba(255,255,255,0.07)`,
        borderLeft: `3px solid ${step.accent}`,
        borderRadius: 16,
        padding: "32px 28px",
        overflow: "hidden",
        cursor: "default",
        transition: "box-shadow 0.2s ease, transform 0.2s ease",
      }}
      whileHover={{
        y: -3,
        boxShadow: `0 12px 32px rgba(0,0,0,0.35)`,
      }}
    >
      {/* Watermark step number */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          top: -16,
          right: -8,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 100,
          fontWeight: 700,
          color: `${step.accent}08`,
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {step.num}
      </span>

      {/* Step badge */}
      <span
        style={{
          display: "inline-block",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "0.65rem",
          fontWeight: 500,
          letterSpacing: "0.1em",
          color: step.accent,
          background: `${step.accent}18`,
          border: `1px solid ${step.accent}30`,
          borderRadius: 999,
          padding: "3px 10px",
          marginBottom: 14,
        }}
      >
        STEP {step.num}
      </span>

      <h3
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "1.25rem",
          fontWeight: 400,
          color: "#ffffff",
          marginBottom: 10,
          lineHeight: 1.3,
        }}
      >
        {step.title}
      </h3>

      <p
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: "0.875rem",
          lineHeight: 1.65,
          color: "rgba(255,255,255,0.55)",
          margin: 0,
        }}
      >
        {step.desc}
      </p>
    </motion.div>
  );
}

function HowItWorks() {
  const titleRef = useRef(null);
  const titleInView = useInView(titleRef, { once: true, margin: "-80px" });

  return (
    <section
      id="how-it-works"
      style={{
        background: "#060E18",
        padding: "100px 24px",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Section header */}
        <div ref={titleRef} style={{ textAlign: "center", marginBottom: 64 }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#0066FF",
              background: "rgba(0, 102, 255, 0.1)",
              border: "1px solid rgba(0, 102, 255, 0.2)",
              borderRadius: 999,
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            THE WORKFLOW
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              marginBottom: 16,
            }}
          >
            From idea to defense,<br />in six structured steps.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "1rem",
              color: "rgba(255,255,255,0.5)",
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Each step builds on the last. Complete them in order, or jump back
            any time. Your progress is always saved.
          </motion.p>
        </div>

        {/* 6-step grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {STEPS.map((step, i) => (
            <StepCard key={step.num} step={step} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Why FYPro ────────────────────────────────────────────────────────────────

const WHY_CARDS = [
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <path d="M14 3L3 8.5V14c0 6.075 4.925 10.5 11 12 6.075-1.5 11-5.925 11-12V8.5L14 3z" stroke="#0066FF" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(0,102,255,0.1)" />
        <path d="M9.5 14l3 3 6-6" stroke="#0066FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Built for Nigerian Universities",
    desc: "Chapters structured to UNILAG, ABU, OAU, and FUTA faculty expectations. Not a generic international template.",
    accent: "#0066FF",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <circle cx="14" cy="14" r="10" stroke="#16A34A" strokeWidth="1.8" fill="rgba(22,163,74,0.1)" />
        <path d="M14 9v5l3.5 3.5" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: "Works Even Without a Supervisor",
    desc: "Most final year students see their supervisor fewer than 5 times. FYPro fills the gap with always-available AI guidance.",
    accent: "#16A34A",
  },
  {
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
        <rect x="4" y="6" width="20" height="16" rx="3" stroke="#F59E0B" strokeWidth="1.8" fill="rgba(245,158,11,0.1)" />
        <path d="M9 11h10M9 15h7" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
    title: "Defense-Ready, Not Just Written",
    desc: "The AI examiner panel simulates real viva conditions — tough questions, follow-ups, and a final confidence score.",
    accent: "#F59E0B",
  },
];

function WhyFYPro() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      id="why-fypro"
      style={{
        background: "#0D1B2A",
        padding: "100px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        {/* Header */}
        <div ref={ref} style={{ textAlign: "center", marginBottom: 64 }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#16A34A",
              background: "rgba(22, 163, 74, 0.1)",
              border: "1px solid rgba(22, 163, 74, 0.2)",
              borderRadius: 999,
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            WHY FYPRO
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            The companion your department<br />never gave you.
          </motion.h2>
        </div>

        {/* Cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? "visible" : "hidden"}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {WHY_CARDS.map(({ icon, title, desc, accent }) => (
            <motion.div
              key={title}
              variants={cardReveal}
              style={{
                background: "rgba(15, 34, 53, 0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "32px 28px",
                transition: "box-shadow 0.2s ease",
              }}
              whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.3)" }}
            >
              <div style={{ marginBottom: 18 }}>{icon}</div>
              <h3
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "1.2rem",
                  color: "#ffffff",
                  marginBottom: 10,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  color: "rgba(255,255,255,0.52)",
                  margin: 0,
                }}
              >
                {desc}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Features Marquee Strip ───────────────────────────────────────────────────

const FEATURE_TAGS = [
  "Topic Validation",
  "Chapter Outlining",
  "Literature Mapping",
  "Methodology Advice",
  "Questionnaire Builder",
  "Interview Guide",
  "Writing Schedule",
  "Three-Examiner Panel",
  "AI Defense Simulation",
  "Supervisor Email Draft",
  "Nigerian University Format",
  "Progress Tracking",
];

function FeatureStrip() {
  return (
    <div
      id="features"
      style={{
        background: "#060E18",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "20px 0",
        overflow: "hidden",
      }}
      aria-hidden="true"
    >
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        style={{ display: "flex", gap: 12, width: "max-content" }}
      >
        {[...FEATURE_TAGS, ...FEATURE_TAGS].map((tag, i) => (
          <span
            key={i}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.7rem",
              fontWeight: 500,
              letterSpacing: "0.08em",
              color: "rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 999,
              padding: "6px 16px",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {tag}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

const TESTIMONIALS = [
  {
    quote:
      "I was completely lost after my supervisor rejected my first topic twice. FYPro helped me reframe it in 20 minutes. My chapter outline got approved on the first submission.",
    name: "Chidinma Eze",
    department: "Mass Communication",
    university: "UNILAG",
    initials: "CE",
    accent: "#0066FF",
  },
  {
    quote:
      "The defense simulator is no joke. Prof. Akinwale grilled me on my sampling method for 10 straight minutes. I failed the first session — but walked into my real defense completely confident.",
    name: "Tunde Adeyemi",
    department: "Business Administration",
    university: "OAU",
    initials: "TA",
    accent: "#16A34A",
  },
  {
    quote:
      "My methodology was completely wrong for a quantitative study. FYPro caught it before I submitted. My supervisor said Chapter 3 was the best she had seen from a final year student.",
    name: "Fatima Bello",
    department: "Nursing Science",
    university: "ABU Zaria",
    initials: "FB",
    accent: "#F59E0B",
  },
];

function TestimonialsSection() {
  const titleRef = useRef(null);
  const titleInView = useInView(titleRef, { once: true, margin: "-80px" });

  return (
    <section
      style={{
        background: "#0D1B2A",
        padding: "100px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div ref={titleRef} style={{ textAlign: "center", marginBottom: 64 }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#F59E0B",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid rgba(245, 158, 11, 0.2)",
              borderRadius: 999,
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            STUDENT VOICES
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
            }}
          >
            Students who stopped guessing<br />and started defending.
          </motion.h2>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={titleInView ? "visible" : "hidden"}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {TESTIMONIALS.map(({ quote, name, department, university, initials, accent }) => (
            <motion.div
              key={name}
              variants={cardReveal}
              style={{
                background: "rgba(15, 34, 53, 0.8)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderLeft: `3px solid ${accent}`,
                borderRadius: 16,
                padding: "32px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 24,
                position: "relative",
                overflow: "hidden",
              }}
              whileHover={{ y: -3, boxShadow: "0 12px 32px rgba(0,0,0,0.35)" }}
            >
              {/* Decorative quote mark */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: 12,
                  right: 20,
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 80,
                  lineHeight: 1,
                  color: `${accent}0a`,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                "
              </span>

              <p
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "0.9rem",
                  lineHeight: 1.7,
                  color: "rgba(255,255,255,0.72)",
                  margin: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                "{quote}"
              </p>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: `${accent}20`,
                    border: `1.5px solid ${accent}40`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: accent,
                    flexShrink: 0,
                  }}
                >
                  {initials}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#ffffff",
                      lineHeight: 1.3,
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: "0.75rem",
                      color: "rgba(255,255,255,0.38)",
                      marginTop: 2,
                    }}
                  >
                    {department} · {university}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Defense Simulator Preview ────────────────────────────────────────────────

const EXAMINERS = [
  {
    code: "EXAM-01",
    name: "Prof. Akinwale",
    title: "The Methodologist",
    personality: "Cold. Precise. Will dismantle every assumption in your research design.",
    accent: "#DC2626",
    sampleQ: "Why did you choose a sample size of 120? Justify your choice of SPSS over AMOS for this SEM.",
  },
  {
    code: "EXAM-02",
    name: "Dr. Okafor",
    title: "The Literaturist",
    personality: "Sharp. Expects you to have read everything. Will probe your theoretical gaps.",
    accent: "#F59E0B",
    sampleQ: "Which theorist grounds your conceptual framework? How current is your literature review?",
  },
  {
    code: "EXAM-03",
    name: "Dr. Bello",
    title: "The Chair",
    personality: "Measured. Tests overall coherence. Ensures your conclusions match your data.",
    accent: "#0066FF",
    sampleQ: "Do your findings directly answer your research questions? What are the policy implications?",
  },
];

function DefensePreviewSection({ onGetStarted }) {
  const titleRef = useRef(null);
  const titleInView = useInView(titleRef, { once: true, margin: "-80px" });

  return (
    <section
      style={{
        background: "#060E18",
        padding: "100px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div ref={titleRef} style={{ textAlign: "center", marginBottom: 64 }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#DC2626",
              background: "rgba(220, 38, 38, 0.1)",
              border: "1px solid rgba(220, 38, 38, 0.2)",
              borderRadius: 999,
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            STEP 06 · DEFENSE SIMULATOR
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              marginBottom: 16,
            }}
          >
            Three examiners. No mercy.<br />Practice until you're ready.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "1rem",
              color: "rgba(255,255,255,0.5)",
              maxWidth: 520,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Each AI examiner has a distinct persona, grilling style, and area of focus.
            You don't pass until you can handle all three.
          </motion.p>
        </div>

        {/* Examiner cards */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={titleInView ? "visible" : "hidden"}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
            marginBottom: 48,
          }}
        >
          {EXAMINERS.map(({ code, name, title, personality, accent, sampleQ }) => (
            <motion.div
              key={code}
              variants={cardReveal}
              style={{
                background: "rgba(6, 14, 24, 0.9)",
                border: `1px solid ${accent}25`,
                borderTop: `3px solid ${accent}`,
                borderRadius: 16,
                padding: "28px",
                position: "relative",
                overflow: "hidden",
              }}
              whileHover={{ y: -3, boxShadow: `0 12px 32px rgba(0,0,0,0.45), 0 0 24px ${accent}15` }}
            >
              {/* Watermark code */}
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: -10,
                  right: -4,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 72,
                  fontWeight: 700,
                  color: `${accent}07`,
                  lineHeight: 1,
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              >
                {code}
              </span>

              {/* Code badge */}
              <span
                style={{
                  display: "inline-block",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.6rem",
                  fontWeight: 500,
                  letterSpacing: "0.1em",
                  color: accent,
                  background: `${accent}15`,
                  border: `1px solid ${accent}30`,
                  borderRadius: 999,
                  padding: "3px 10px",
                  marginBottom: 16,
                }}
              >
                {code}
              </span>

              <h3
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "1.3rem",
                  fontWeight: 400,
                  color: "#ffffff",
                  marginBottom: 4,
                  lineHeight: 1.2,
                }}
              >
                {name}
              </h3>

              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  color: accent,
                  letterSpacing: "0.06em",
                  marginBottom: 14,
                }}
              >
                {title}
              </div>

              <p
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "0.8rem",
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.5)",
                  margin: "0 0 20px",
                }}
              >
                {personality}
              </p>

              {/* Sample question */}
              <div
                style={{
                  background: `${accent}0c`,
                  border: `1px solid ${accent}20`,
                  borderRadius: 10,
                  padding: "12px 14px",
                }}
              >
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.58rem",
                    fontWeight: 500,
                    letterSpacing: "0.1em",
                    color: "rgba(255,255,255,0.3)",
                    marginBottom: 6,
                  }}
                >
                  SAMPLE QUESTION
                </div>
                <p
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "0.8rem",
                    lineHeight: 1.55,
                    color: "rgba(255,255,255,0.65)",
                    margin: 0,
                    fontStyle: "italic",
                  }}
                >
                  "{sampleQ}"
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Enter defense CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.45 }}
          style={{ textAlign: "center" }}
        >
          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.03, boxShadow: "0 0 32px rgba(220, 38, 38, 0.4)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 18 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#ffffff",
              background: "transparent",
              border: "1.5px solid rgba(220, 38, 38, 0.6)",
              borderRadius: 12,
              padding: "13px 32px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              transition: "border-color 0.2s ease",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5.5" stroke="#DC2626" strokeWidth="1.5" />
              <circle cx="7" cy="7" r="2" fill="#DC2626" />
            </svg>
            Enter the Defense Room
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Pricing Table ────────────────────────────────────────────────────────────

const PLANS = [
  {
    name: "Free",
    price: "₦0",
    period: "forever",
    desc: "Get your project started. Core AI guidance, no commitment.",
    accent: "#0066FF",
    features: [
      { text: "Topic Validator", included: true },
      { text: "Chapter Architect", included: true },
      { text: "Methodology Advisor", included: true },
      { text: "Supervisor Email Draft", included: true },
      { text: "Instrument Builder", included: false },
      { text: "Writing Planner", included: false },
      { text: "Defense Simulator", included: false },
    ],
    cta: "Get Started Free",
    ctaVariant: "ghost",
    highlight: false,
    badge: null,
  },
  {
    name: "Student",
    price: "₦2,000",
    period: "per month",
    desc: "Everything you need to write a defensible, submission-ready project.",
    accent: "#0066FF",
    features: [
      { text: "Everything in Free", included: true },
      { text: "Instrument Builder", included: true },
      { text: "Writing Planner", included: true },
      { text: "Week-by-week schedule", included: true },
      { text: "Progress tracking", included: true },
      { text: "Defense Simulator", included: false },
      { text: "Unlimited defense runs", included: false },
    ],
    cta: "Start Student Plan",
    ctaVariant: "primary",
    highlight: true,
    badge: "MOST POPULAR",
  },
  {
    name: "Defense",
    price: "₦3,500",
    period: "per month",
    desc: "The full panel experience. Walk into your real defense with zero surprises.",
    accent: "#DC2626",
    features: [
      { text: "Everything in Student", included: true },
      { text: "Three-Examiner AI Panel", included: true },
      { text: "Unlimited defense runs", included: true },
      { text: "Confidence score report", included: true },
      { text: "Examiner feedback export", included: true },
      { text: "Priority AI processing", included: true },
      { text: "Defense mode (dark theme)", included: true },
    ],
    cta: "Unlock Defense Mode",
    ctaVariant: "defense",
    highlight: false,
    badge: null,
  },
];

function PricingSection({ onGetStarted }) {
  const titleRef = useRef(null);
  const titleInView = useInView(titleRef, { once: true, margin: "-80px" });

  return (
    <section
      id="pricing"
      style={{
        background: "#0D1B2A",
        padding: "100px 24px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div ref={titleRef} style={{ textAlign: "center", marginBottom: 64 }}>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45 }}
            style={{
              display: "inline-block",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "0.65rem",
              fontWeight: 500,
              letterSpacing: "0.14em",
              color: "#0066FF",
              background: "rgba(0, 102, 255, 0.1)",
              border: "1px solid rgba(0, 102, 255, 0.2)",
              borderRadius: 999,
              padding: "5px 14px",
              marginBottom: 18,
            }}
          >
            PLANS
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.55, delay: 0.1 }}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "clamp(2rem, 4vw, 3rem)",
              color: "#ffffff",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              marginBottom: 16,
            }}
          >
            Priced for Nigerian students.<br />Not Silicon Valley startups.
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={titleInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: "1rem",
              color: "rgba(255,255,255,0.5)",
              maxWidth: 480,
              margin: "0 auto",
              lineHeight: 1.65,
            }}
          >
            Start free and upgrade only when you need the full arsenal.
          </motion.p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate={titleInView ? "visible" : "hidden"}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {PLANS.map(({ name, price, period, desc, accent, features, cta, ctaVariant, highlight, badge }) => (
            <motion.div
              key={name}
              variants={cardReveal}
              style={{
                position: "relative",
                background: highlight
                  ? "linear-gradient(145deg, #0F2235 0%, #091D31 100%)"
                  : "rgba(15, 34, 53, 0.6)",
                border: highlight
                  ? `1px solid rgba(0, 102, 255, 0.35)`
                  : `1px solid rgba(255,255,255,0.07)`,
                borderTop: `3px solid ${accent}`,
                borderRadius: 16,
                padding: "32px 28px",
                boxShadow: highlight ? "0 0 40px rgba(0, 102, 255, 0.12)" : "none",
              }}
              whileHover={{
                y: -4,
                boxShadow: highlight
                  ? "0 16px 40px rgba(0,0,0,0.4), 0 0 40px rgba(0, 102, 255, 0.2)"
                  : "0 12px 32px rgba(0,0,0,0.35)",
              }}
            >
              {/* Popular badge */}
              {badge && (
                <div
                  style={{
                    position: "absolute",
                    top: -12,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "0.58rem",
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    color: "#ffffff",
                    background: accent,
                    borderRadius: 999,
                    padding: "4px 14px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {badge}
                </div>
              )}

              {/* Plan name */}
              <div
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  color: accent,
                  marginBottom: 12,
                }}
              >
                {name.toUpperCase()}
              </div>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "2.25rem",
                    fontWeight: 700,
                    color: "#ffffff",
                    lineHeight: 1,
                  }}
                >
                  {price}
                </span>
                <span
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "0.8rem",
                    color: "rgba(255,255,255,0.35)",
                  }}
                >
                  /{period}
                </span>
              </div>

              <p
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "0.825rem",
                  lineHeight: 1.6,
                  color: "rgba(255,255,255,0.5)",
                  margin: "0 0 24px",
                }}
              >
                {desc}
              </p>

              {/* Divider */}
              <div
                style={{
                  height: 1,
                  background: "rgba(255,255,255,0.06)",
                  marginBottom: 20,
                }}
              />

              {/* Feature list */}
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {features.map(({ text, included }) => (
                  <li
                    key={text}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: "0.825rem",
                      color: included ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)",
                    }}
                  >
                    {included ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <circle cx="7" cy="7" r="6.5" fill={`${accent}20`} stroke={`${accent}40`} />
                        <path d="M4.5 7l1.8 1.8 3.2-3.6" stroke={accent} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
                        <circle cx="7" cy="7" r="6.5" stroke="rgba(255,255,255,0.1)" />
                        <path d="M5 5l4 4M9 5l-4 4" stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    )}
                    {text}
                  </li>
                ))}
              </ul>

              {/* CTA Button */}
              <motion.button
                onClick={onGetStarted}
                whileHover={
                  ctaVariant === "primary"
                    ? { boxShadow: "0 0 24px rgba(22, 163, 74, 0.45)" }
                    : ctaVariant === "defense"
                    ? { boxShadow: "0 0 20px rgba(220, 38, 38, 0.35)", borderColor: "rgba(220,38,38,0.8)" }
                    : { borderColor: "rgba(255,255,255,0.4)" }
                }
                whileTap={{ scale: 0.97 }}
                style={{
                  width: "100%",
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: ctaVariant === "primary" ? "#ffffff" : ctaVariant === "defense" ? "#DC2626" : "rgba(255,255,255,0.65)",
                  background: ctaVariant === "primary" ? "#16A34A" : "transparent",
                  border:
                    ctaVariant === "primary"
                      ? "none"
                      : ctaVariant === "defense"
                      ? "1.5px solid rgba(220, 38, 38, 0.5)"
                      : "1.5px solid rgba(255,255,255,0.18)",
                  borderRadius: 12,
                  padding: "13px 24px",
                  cursor: "pointer",
                  transition: "border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease",
                }}
              >
                {cta}
              </motion.button>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCTA({ onGetStarted }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section
      style={{
        background: "#060E18",
        padding: "120px 24px",
      }}
    >
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6 }}
        style={{
          maxWidth: 700,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        {/* Decorative line */}
        <div
          aria-hidden="true"
          style={{
            width: 48,
            height: 2,
            background: "linear-gradient(90deg, #0066FF, #16A34A)",
            borderRadius: 999,
            margin: "0 auto 32px",
          }}
        />

        <h2
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            color: "#ffffff",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            marginBottom: 20,
          }}
        >
          Ready to ace<br />your defense?
        </h2>

        <p
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "1.05rem",
            color: "rgba(255,255,255,0.5)",
            maxWidth: 480,
            margin: "0 auto 40px",
            lineHeight: 1.65,
          }}
        >
          Join thousands of Nigerian students who are approaching their final year
          with clarity and confidence.
        </p>

        <motion.button
          onClick={onGetStarted}
          whileHover={{
            scale: 1.04,
            boxShadow: "0 0 40px rgba(22, 163, 74, 0.5)",
          }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 18 }}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "1rem",
            fontWeight: 600,
            color: "#ffffff",
            background: "#16A34A",
            border: "none",
            borderRadius: 12,
            padding: "16px 48px",
            cursor: "pointer",
          }}
        >
          Get Started — It's Free
        </motion.button>
      </motion.div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      style={{
        background: "#060E18",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "1.25rem",
            color: "#ffffff",
          }}
        >
          FYPro
        </span>

        <span
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: "0.75rem",
            color: "rgba(255,255,255,0.3)",
          }}
        >
          Built for the CBC UNILAG Claude AI Hackathon · April 2026
        </span>

        <div style={{ display: "flex", gap: 20 }}>
          {["How it Works", "Features", "For Students"].map((link) => (
            <a
              key={link}
              href="#"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: "0.75rem",
                color: "rgba(255,255,255,0.35)",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.target.style.color = "rgba(255,255,255,0.7)")}
              onMouseLeave={(e) => (e.target.style.color = "rgba(255,255,255,0.35)")}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

// ─── Page Composition ─────────────────────────────────────────────────────────

export default function LandingPage() {
  const handleGetStarted = () => {
    // Wire to app routing when ready
    console.log("Get started clicked");
  };

  return (
    <div style={{ background: "#0D1B2A" }}>
      <Navbar onGetStarted={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      <FeatureStrip />
      <HowItWorks />
      <WhyFYPro />
      <TestimonialsSection />
      <DefensePreviewSection onGetStarted={handleGetStarted} />
      <PricingSection onGetStarted={handleGetStarted} />
      <FinalCTA onGetStarted={handleGetStarted} />
      <Footer />
    </div>
  );
}
