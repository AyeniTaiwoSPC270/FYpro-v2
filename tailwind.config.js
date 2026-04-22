export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ["'DM Serif Display'", "serif"],
        sans: ["'Poppins'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      colors: {
        "bg-deep":    "#060E18",
        "bg-dark":    "#0D1B2A",
        "bg-mid":     "#0F2235",
        "blue-brand": "#0066FF",
        "green-brand": "#16A34A",
        "amber-brand": "#F59E0B",
        "red-brand":   "#DC2626",
      },
    },
  },
  plugins: [],
}
