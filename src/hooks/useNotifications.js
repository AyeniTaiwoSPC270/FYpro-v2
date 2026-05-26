import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoading(false)
    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      setNotifications(data ?? [])
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    const { error: updateErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    if (updateErr) {
      setNotifications(prev => prev.map(n => ({ ...n, read: false })))
      showToast("Couldn't update notifications — try again")
    }
  }, [userId, unreadCount])

  return { notifications, unreadCount, loading, error, refetch: fetch, markAllRead }
}
