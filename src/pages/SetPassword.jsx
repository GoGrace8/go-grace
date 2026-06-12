import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
  const hashParams = new URLSearchParams(window.location.hash.substring(1))
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (accessToken) {
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  }
}, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  if (success) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f0f4f8'
    }}>
      <div style={{
        background: 'white', padding: '3rem', borderRadius: '12px',
        textAlign: 'center', boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        maxWidth: '400px', width: '100%'
      }}>
        <div style={{ fontSize: '3rem' }}>✅</div>
        <h2 style={{ color: '#1a56db' }}>Password Set!</h2>
        <p style={{ color: '#6b7280' }}>Your account is ready. You can now log in.</p>
        <a href="/login" style={{
          display: 'inline-block', marginTop: '1rem',
          padding: '0.75rem 2rem', background: '#1a56db',
          color: 'white', borderRadius: '8px', textDecoration: 'none',
          fontWeight: '600'
        }}>
          Go to Login
        </a>
      </div>
    </div>
  )

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#f0f4f8'
    }}>
      <div style={{
        background: 'white', padding: '2rem', borderRadius: '12px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        width: '100%', maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#1a56db', fontSize: '1.8rem', margin: 0 }}>Go Grace</h1>
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>Set your password</p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#dc2626', padding: '0.75rem',
            borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.75rem', background: '#1a56db',
              color: 'white', border: 'none', borderRadius: '8px',
              fontSize: '1rem', fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Setting password...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block', marginBottom: '0.5rem',
  color: '#374151', fontWeight: '500'
}

const inputStyle = {
  width: '100%', padding: '0.75rem',
  border: '1px solid #d1d5db', borderRadius: '8px',
  fontSize: '1rem', boxSizing: 'border-box'
}