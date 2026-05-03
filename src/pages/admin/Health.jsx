import { useState, useEffect } from 'react'
import { useUser } from '../../hooks/useUser'

export default function AdminHealth() {
  const { user, loading } = useUser()
  const [data, setData]     = useState(null)
  const [error, setError]   = useState(null)
  const [fetching, setFetching] = useState(false)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin    = !!adminEmail && user?.email === adminEmail

  useEffect(() => {
    if (!isAdmin) return
    setFetching(true)
    fetch('/api/admin/health')
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setFetching(false))
  }, [isAdmin])

  const containerStyle = {
    padding: '40px',
    fontFamily: "'JetBrains Mono', monospace",
    maxWidth: '720px',
    color: '#0D1B2A',
  }
  const tableStyle = {
    borderCollapse: 'collapse',
    width: '100%',
    marginBottom: '32px',
    fontSize: '14px',
  }
  const tdStyle = {
    border: '1px solid #ccc',
    padding: '8px 12px',
  }
  const labelStyle = { ...tdStyle, color: '#555', width: '240px' }

  if (loading)  return <div style={containerStyle}>Loading…</div>
  if (!isAdmin) return <div style={containerStyle}>Access denied.</div>
  if (fetching) return <div style={containerStyle}>Fetching dashboard data…</div>
  if (error)    return <div style={containerStyle}>Error: {error}</div>
  if (!data)    return null

  const { usage, payments, signups } = data
  const remaining = (usage.cap_usd - usage.spent_usd).toFixed(4)
  const pct       = usage.cap_usd > 0
    ? ((usage.spent_usd / usage.cap_usd) * 100).toFixed(1)
    : '0.0'

  return (
    <div style={containerStyle}>
      <h1 style={{ fontFamily: "'DM Serif Display', serif", marginBottom: 4 }}>
        FYPro Admin — Health Dashboard
      </h1>
      <p style={{ color: '#555', marginBottom: 32 }}>
        {data.date} &nbsp;·&nbsp; status: <strong>{data.status}</strong>
      </p>

      <h2 style={{ marginBottom: 12 }}>API Usage (today)</h2>
      <table style={tableStyle}>
        <tbody>
          <tr><td style={labelStyle}>Spent</td><td style={tdStyle}>${usage.spent_usd.toFixed(4)}</td></tr>
          <tr><td style={labelStyle}>Daily cap</td><td style={tdStyle}>${usage.cap_usd.toFixed(2)}</td></tr>
          <tr><td style={labelStyle}>Remaining</td><td style={tdStyle}>${remaining} ({pct}% used)</td></tr>
          <tr><td style={labelStyle}>Requests</td><td style={tdStyle}>{usage.request_count.toLocaleString()}</td></tr>
          <tr><td style={labelStyle}>Tokens in</td><td style={tdStyle}>{usage.tokens_in.toLocaleString()}</td></tr>
          <tr><td style={labelStyle}>Tokens out</td><td style={tdStyle}>{usage.tokens_out.toLocaleString()}</td></tr>
        </tbody>
      </table>

      <h2 style={{ marginBottom: 12 }}>Payments (today)</h2>
      <table style={tableStyle}>
        <tbody>
          <tr><td style={labelStyle}>Successful payments</td><td style={tdStyle}>{payments.success_count_today}</td></tr>
          <tr><td style={labelStyle}>Total revenue</td><td style={tdStyle}>₦{payments.total_revenue_ngn.toLocaleString()}</td></tr>
        </tbody>
      </table>

      <h2 style={{ marginBottom: 12 }}>Signups</h2>
      <table style={tableStyle}>
        <tbody>
          <tr><td style={labelStyle}>Today</td><td style={tdStyle}>{signups.count_today}</td></tr>
          <tr><td style={labelStyle}>This week</td><td style={tdStyle}>{signups.count_this_week}</td></tr>
        </tbody>
      </table>

      <h2 style={{ marginBottom: 12 }}>Cache</h2>
      <table style={tableStyle}>
        <tbody>
          <tr><td style={labelStyle}>Total hits (all time)</td><td style={tdStyle}>{data.cache?.hits_total ?? 0}</td></tr>
        </tbody>
      </table>
    </div> 
    
    

    
  )
}
