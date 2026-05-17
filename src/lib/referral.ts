import { supabase } from './supabase'

const REF_KEY = 'fypro_ref_code'
const REF_EXPIRY_KEY = 'fypro_ref_expiry'
const TTL_MS = 14 * 24 * 60 * 60 * 1000  // 14 days
const CODE_RE = /^[A-Z0-9]{6}$/

// ─── URL / localStorage helpers ───────────────────────────────────────────────

export function readRefFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get('ref')
    if (!raw) return null
    const code = raw.trim().toUpperCase()
    return CODE_RE.test(code) ? code : null
  } catch {
    return null
  }
}

export function storeRef(code: string): void {
  localStorage.setItem(REF_KEY, code)
  localStorage.setItem(REF_EXPIRY_KEY, String(Date.now() + TTL_MS))
}

export function getStoredRef(): string | null {
  try {
    const code = localStorage.getItem(REF_KEY)
    const expiry = localStorage.getItem(REF_EXPIRY_KEY)
    if (!code || !expiry) return null
    if (Date.now() > Number(expiry)) {
      clearRef()
      return null
    }
    return code
  } catch {
    return null
  }
}

export function clearRef(): void {
  localStorage.removeItem(REF_KEY)
  localStorage.removeItem(REF_EXPIRY_KEY)
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * Called from signup.jsx after successful account creation.
 * Retries on 404 because the public.users row is created by an async DB trigger
 * that may not have fired yet when this runs immediately after signup.
 * Silently drops on final failure — never blocks the signup UX.
 */
export async function callTrackReferral(email: string, refCode: string): Promise<void> {
  const RETRY_DELAYS = [1000, 2000, 4000]
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch('/api/referral?action=track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, ref_code: refCode }),
      })
      if (res.ok) {
        clearRef()
        return
      }
      // Only retry on 404 — the DB trigger may not have created the user row yet.
      const isUserNotFound = res.status === 404
      if (!isUserNotFound || attempt >= RETRY_DELAYS.length) {
        if (isUserNotFound) {
          console.warn('[referral] all retries exhausted — referral conversion dropped for', email)
        }
        return
      }
    } catch {
      if (attempt >= RETRY_DELAYS.length) return
    }
    await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
  }
}

/**
 * Called from TopicValidator after markStepComplete('topic_validator') resolves.
 * Flips the referral to 'qualified' and awards the referrer's milestone if due.
 * Fire-and-forget — never surfaces errors to the student.
 */
export async function callCreditReferral(): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    await fetch('/api/referral?action=credit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
    })
  } catch {
    // Non-fatal
  }
}

// ─── Dashboard data ───────────────────────────────────────────────────────────

export interface ReferralRow {
  id: string
  status: 'pending' | 'qualified' | 'rewarded'
  created_at: string
  qualified_at: string | null
  rewarded_at: string | null
}

export interface CreditRow {
  id: string
  reason: string
  consumed: boolean
  created_at: string
}

export interface MyReferralsData {
  referralCode: string | null
  referrals: ReferralRow[]
  credits: CreditRow[]
  freeSessionsAvailable: number
}

export async function fetchMyReferrals(): Promise<MyReferralsData | null> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  if (!user) return null

  const [
    { data: userData },
    { data: referrals },
    { data: credits },
  ] = await Promise.all([
    supabase
      .from('users')
      .select('referral_code')
      .eq('id', user.id)
      .single(),
    supabase
      .from('referrals')
      .select('id, status, created_at, qualified_at, rewarded_at')
      .eq('referrer_user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('defense_credits')
      .select('id, reason, consumed, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ])

  return {
    referralCode: userData?.referral_code ?? null,
    referrals: (referrals ?? []) as ReferralRow[],
    credits: (credits ?? []) as CreditRow[],
    freeSessionsAvailable: (credits ?? []).filter((c) => !c.consumed).length,
  }
}
