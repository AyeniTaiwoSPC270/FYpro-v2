// Canonical list of every localStorage key the app writes per authenticated user.
// cookie_consent and fypro_theme are intentionally excluded — they are device
// preferences and must survive sign-out and session expiry.
export const USER_STORAGE_KEYS = [
  'fypro_session',
  'fypro_session_owner',
  'isOnboarded',
  'fypro_autosave_topic_validator',
  'fypro_autosave_chapter_architect',
  'fypro_autosave_supervisor_prep',
  'fypro_autosave_writing_planner',
  'fypro_routing_v1',
  'fypro_sync_queue',
  'fypro_feedback_given',
  'fypro_ref_code',
  'fypro_ref_expiry',
  'fypro_run_counts',
  'fypro_offline_snapshot',   // offline read cache — cleared on logout
] as const

export function clearUserLocalStorage(): void {
  USER_STORAGE_KEYS.forEach(key => {
    try { localStorage.removeItem(key) } catch {}
  })
  try { sessionStorage.clear() } catch {}
}
