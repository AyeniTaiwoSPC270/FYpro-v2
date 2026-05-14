import { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import type { AuthContextValue } from '../context/AuthContext'

// useUser is a thin alias for AuthContext — auth state is resolved exactly once
// in AuthProvider (src/context/AuthContext.tsx) and shared here via context.
// Never call supabase.auth.getSession() or getUser() directly in component
// mount effects — read from this hook instead.
export type UseUserReturn = AuthContextValue

export function useUser(): UseUserReturn {
  return useContext(AuthContext)
}
