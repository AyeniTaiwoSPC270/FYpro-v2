export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'DM Serif Display'", "Georgia", "serif"],
        sans:  ["'Poppins'", "sans-serif"],
        mono:  ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        page:         "#0A0F1C",
        sidebar:      "#070C18",
        card:         "#0D1425",
        input:        "#111827",
        surface:      "#0F1A2E",
        "blue-brand": "#2563EB",
        "blue-light": "#3B82F6",
        "green-brand":"#10B981",
        "amber-brand":"#F59E0B",
        "red-brand":  "#EF4444",
        "border-dim": "#1E293B",
      },
      boxShadow: {
        card:       "0 8px 40px rgba(59,130,246,0.06)",
        "card-h":   "0 12px 48px rgba(59,130,246,0.12)",
        "blue-glow":"0 0 24px rgba(37,99,235,0.4)",
        "green-glow":"0 0 20px rgba(16,185,129,0.35)",
      },
      animation: {
        "fade-up":   "fadeUp 0.4s ease forwards",
        "fade-in":   "fadeIn 0.3s ease forwards",
        "bounce-dot":"bounceDot 1.2s ease-in-out infinite",
        shimmer:     "shimmer 1.5s infinite",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        bounceDot: {
          "0%, 80%, 100%": { transform: "translateY(0)" },
          "40%":           { transform: "translateY(-8px)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
    },
  },
  plugins: [],
}
