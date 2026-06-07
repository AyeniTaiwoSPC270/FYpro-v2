import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'

const ThemeContext = createContext()

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('fypro_theme') || 'dark'
  })

  useEffect(() => {
    const d = document.documentElement
    const bg = theme === 'light' ? '#F8FAFC' : '#0A0F1C'
    localStorage.setItem('fypro_theme', theme)
    d.setAttribute('data-theme', theme)
    // Keep the inline styles (set by the anti-flicker script) in sync.
    // Inline styles have the highest specificity and override CSS rules, so
    // without this the background stays frozen at the value from page load.
    d.style.setProperty('--bg-base', bg)
    d.style.background = bg
    if (theme === 'dark') {
      d.classList.add('dark')
      d.classList.remove('light')
    } else {
      d.classList.add('light')
      d.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme(prev => prev === 'dark' ? 'light' : 'dark'), [])

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme])

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
