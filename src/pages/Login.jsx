import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [resetSent, setResetSent] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetEmail, setResetEmail] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: 'https://go-grace.vercel.app/set-password'
    })
    if (!error) {
      setResetSent(true)
    } else {
      setError(error.message)
    }
    setLoading(false)
  }

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
          <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
            {resetMode ? 'Reset your password' : 'Church Member Portal'}
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#dc2626', padding: '0.75rem',
            borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        {resetSent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem' }}>📧</div>
            <h3 style={{ color: '#1a56db' }}>Check your email!</h3>
            <p style={{ color: '#6b7280' }}>We've sent a password reset link to {resetEmail}</p>
            <button
              onClick={() => { setResetMode(false); setResetSent(false) }}
              style={{
                marginTop: '1rem', background: 'none', border: 'none',
                color: '#1a56db', cursor: 'pointer', textDecoration: 'underline'
              }}
            >
              Back to login
            </button>
          </div>
        ) : resetMode ? (
          <form onSubmit={handleReset}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                required
                style={inputStyle}
                placeholder="Enter your email"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={btnStyle(loading)}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setResetMode(false)}
                style={linkBtnStyle}
              >
                Back to login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={inputStyle}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={btnStyle(loading)}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '1rem' }}>
              <button
                type="button"
                onClick={() => setResetMode(true)}
                style={linkBtnStyle}
              >
                Forgot password?
              </button>
            </div>
          </form>
        )}
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

const btnStyle = (loading) => ({
  width: '100%', padding: '0.75rem', background: '#1a56db',
  color: 'white', border: 'none', borderRadius: '8px',
  fontSize: '1rem', fontWeight: '600',
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.7 : 1
})

const linkBtnStyle = {
  background: 'none', border: 'none', color: '#1a56db',
  cursor: 'pointer', fontSize: '0.9rem', textDecoration: 'underline'
}