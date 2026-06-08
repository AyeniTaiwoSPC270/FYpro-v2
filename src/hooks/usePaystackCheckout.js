import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackEvent } from '../lib/analytics'

export function usePaystackCheckout({ loginReturnUrl = '/pricing' } = {}) {
  const navigate = useNavigate()
  const [paying, setPaying] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [payError, setPayError] = useState(null)
  const [blockInfo, setBlockInfo] = useState(null)
  const pollingIntervalRef = useRef(null)
  const isInitiatingRef   = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const loadScript = useCallback(() => {
    if (document.getElementById('paystack-inline-js')) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.id = 'paystack-inline-js'
      script.src = 'https://js.paystack.co/v1/inline.js'
      script.onload = resolve
      script.onerror = () => reject(new Error('Failed to load Paystack script'))
      document.head.appendChild(script)
    })
  }, [])

  const handlePay = useCallback(async (tier) => {
    if (isInitiatingRef.current) return
    isInitiatingRef.current = true
    setPayError(null)
    setBlockInfo(null)

    const [{ data: authData, error: authError }, { data: sessionData }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession(),
    ])
    if (authError || !authData?.user) {
      isInitiatingRef.current = false
      navigate(`/login?returnUrl=${loginReturnUrl}`)
      return
    }
    const user        = authData.user
    const accessToken = sessionData?.session?.access_token || ''

    const { data: entitlements } = await supabase
      .from('user_entitlements')
      .select('paid_features')
      .eq('user_id', user.id)
      .single()

    const currentFeatures = Array.isArray(entitlements?.paid_features) ? entitlements.paid_features : []
    const hasDefense = currentFeatures.includes('defense_pack')
    const hasStudent = currentFeatures.includes('student_pack')

    if (hasDefense && tier !== 'project_reset') {
      isInitiatingRef.current = false
      setBlockInfo({
        tier,
        message: "You're already on the Defense Plan for this project. Start a new project to continue your research journey.",
      })
      return
    }

    if (hasStudent && tier === 'student_pack') {
      isInitiatingRef.current = false
      setBlockInfo({
        tier: 'student_pack',
        message: "You already have the Student Plan. Upgrade to Defense Plan to unlock the Defense Simulator.",
      })
      return
    }

    let pendingReference = null
    setPaying(tier)
    try {
      await loadScript()

      const res = await fetch('/api/payments?action=initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to initiate payment')
      pendingReference = data.reference

      const handler = window.PaystackPop.setup({
        key: data.publicKey,
        email: data.email || user.email,
        amount: data.amount_kobo,
        ref: data.reference,
        currency: 'NGN',
        onSuccess: async (transaction) => {
          stopPolling()
          isInitiatingRef.current = false
          setPaying(null)
          setVerifying(true)
          try {
            const { data: { session: vSession } } = await supabase.auth.getSession()
            const vRes = await fetch('/api/payments?action=verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(vSession?.access_token ? { Authorization: `Bearer ${vSession.access_token}` } : {}),
              },
              body: JSON.stringify({ reference: transaction.reference }),
            })
            const vData = await vRes.json()
            if (vRes.ok && (vData.status === 'success' || vData.status === 'already_processed')) {
              trackEvent('payment_completed', { tier })
              navigate(`/payment-success?reference=${transaction.reference}`)
            } else {
              setPayError('Payment received but verification failed. Please contact support.')
            }
          } catch {
            setPayError('Payment received but verification failed. Please contact support.')
          } finally {
            setVerifying(false)
          }
        },
        onCancel: () => {
          isInitiatingRef.current = false
          setPaying(null)
        },
        onClose: () => {
          stopPolling()
          isInitiatingRef.current = false
          setPaying(null)
          if (pendingReference) {
            supabase.auth.getSession().then(({ data: { session: cSession } }) => {
              fetch('/api/payments?action=verify', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(cSession?.access_token ? { Authorization: `Bearer ${cSession.access_token}` } : {}),
                },
                body: JSON.stringify({ reference: pendingReference }),
              })
              .then(res => res.json())
              .then(data => {
                if (data.status === 'success' || data.status === 'already_processed') {
                  navigate(`/payment-success?reference=${pendingReference}`)
                }
              })
              .catch(() => {})
            })
          }
        },
      })
      trackEvent('payment_initiated', { tier })
      handler.openIframe()

      pollingIntervalRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/payments?action=check-status&reference=${pendingReference}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          const pollData = await pollRes.json()
          if (pollData.status === 'success') {
            stopPolling()
            navigate(`/payment-success?reference=${pendingReference}`)
          }
        } catch {
          // keep polling
        }
      }, 3000)

    } catch (err) {
      isInitiatingRef.current = false
      setPaying(null)
      setPayError(err.message)
    }
  }, [navigate, loginReturnUrl, loadScript, stopPolling])

  return { handlePay, paying, verifying, payError, blockInfo, setBlockInfo }
}
