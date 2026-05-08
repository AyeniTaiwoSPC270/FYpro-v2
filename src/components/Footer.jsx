import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Footer() {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <footer
      className="py-8 px-6 border-t"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-sidebar)' }}
    >
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          FYPro · Lagos, Nigeria
        </span>

        <nav className="flex flex-wrap items-center gap-4">
          <Link
            to="/roadmap"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Public roadmap
          </Link>
          <Link
            to="/privacy"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Terms
          </Link>
          {authed && (
            <Link
              to="/account/email-preferences"
              className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              Email preferences
            </Link>
          )}
        </nav>
      </div>
    </footer>
  )
}
