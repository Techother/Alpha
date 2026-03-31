import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function PortalLogin() {
  const { signIn, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && profile) {
    const dest = profile.role === 'patient' ? '/my-health' : '/admin'
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
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      padding: 'var(--space-4)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 'var(--portal-max-width)' }}>
        <div style={{ marginBottom: 'var(--space-8)', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-hf-bg)',
            marginBottom: 'var(--space-4)',
          }}>
            <span style={{ color: 'var(--color-hf)', fontSize: 22 }}>♥</span>
          </div>
          <h1 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--space-1)' }}>
            My Health Portal
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
            Sign in to track your wellness
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
              placeholder="you@email.com"
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
          lineHeight: 'var(--line-height-relaxed)',
        }}>
          CardioTrack is a wellness tracking tool. It is not a medical device and does not provide medical advice.
        </p>
      </div>
    </div>
  )
}
