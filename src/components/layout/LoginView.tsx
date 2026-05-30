// cardiotrack/src/components/layout/LoginView.tsx
// Extracted from App.tsx lines 301–337 (LoginScreen → LoginView rename)
// Clinical white design — card on light background

import { useState } from 'react'
import { T, F } from '@/lib/tokens'
import { Btn, Spin, Field } from '@/components/ui/primitives'
import { signIn } from '@/api/supabase'

export function LoginView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const { error: err } = await signIn(email, password)
      if (err) throw err
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <nav style={{
        background: T.nav, borderBottom: `1px solid ${T.border}`,
        padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.textSec, cursor: 'pointer', fontSize: 20, padding: 4 }}>←</button>
        <div style={{ fontFamily: F.display, fontSize: 18, color: T.blue }}>Alpha Health Track</div>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
          padding: 'clamp(24px, 5vw, 40px)', width: '100%', maxWidth: 400,
          boxShadow: '0 4px 16px rgba(26,82,150,0.10)', animation: 'slideUp 0.3s ease',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontFamily: F.display, fontSize: 26, color: T.blue, marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>Cardiac Remote Monitoring</div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            {error && (
              <div style={{
                background: T.redSurface, border: `1px solid ${T.red}`,
                borderRadius: 8, padding: '10px 14px', color: T.red, fontSize: 13,
              }}>
                {error}
              </div>
            )}
            <Btn type="submit" disabled={loading} full style={{ marginTop: 4, fontSize: 15 }}>
              {loading ? <><Spin /> Signing in…</> : 'Sign In'}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  )
}
