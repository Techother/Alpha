import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function AdminLogin() {
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // If already authenticated, redirect to correct zone
  if (!loading && profile) {
    const dest = profile.role === 'provider' ? '/admin' : '/my-health'
    navigate(dest, { replace: true })
    return null
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error } = await signIn(email, password)

    if (error) {
      setError(error.message)
      setSubmitting(false)
      return
    }
    // onAuthStateChange in AuthContext will update profile;
    // navigate after profile loads (handled by guard on re-render)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-primary)',
            marginBottom: 'var(--space-4)',
          }}>
            <span style={{ color: '#fff', fontSize: 22, fontWeight: 700 }}>C</span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-1)' }}>
            CardioTrack
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Care Coordinator Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="coordinator@clinic.org"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && <p className="form-error">{error}</p>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)' }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p style={{
          marginTop: 'var(--space-6)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-faint)',
          textAlign: 'center',
        }}>
          Patient? Go to{' '}
          <a href="/my-health/login">your health portal</a>
        </p>
      </div>
    </div>
  )
}
