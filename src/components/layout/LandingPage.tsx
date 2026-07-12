// cardiotrack/src/components/layout/LandingPage.tsx
// /impeccable bolder — editorial typographic structure, orange committed accent (#F25623),
// clinical white canvas. Removed: stats bar (hero-metric ban), card grid (identical-card ban),
// emoji icons. Added: <main>, skip-nav, 44px+ touch targets, editorial feature rows.

import { useState, type FormEvent } from 'react'
import { P, F } from '@/lib/tokens'
import { collectPrelaunchEmail } from '@/api/supabase'

const features = [
  { tag: 'Monitoring',  title: 'Real-time Vital Tracking',   desc: 'Vital signs tracked across your full roster. Weight gain, breathlessness spikes, and missed medications surface to the alert queue automatically.' },
  { tag: 'AI',         title: 'Daily Check-ins',             desc: 'Structured conversational check-ins powered by Claude, logged, transcribed, and flagged for clinician review within the shift.' },
  { tag: 'Alerts',     title: 'Smart Alert Routing',         desc: 'Threshold crossings trigger care team notifications via Slack within 60 seconds. Configurable severity levels per patient, per protocol.' },
  { tag: 'Scheduling', title: 'Calendar Integration',        desc: 'Google Calendar sync for appointments and follow-up visits. No manual entry, no double-booking between your RPM platform and your clinic schedule.' },
  { tag: 'Billing',    title: 'CPT Eligibility Tracking',    desc: 'Automatic tracking of 99454, 99457, and 99458 per patient per billing period: auditable, exportable, and always current.' },
  { tag: 'Analytics',  title: 'Risk-Stratified Roster',      desc: '7-day trend analysis with sparklines, PHQ-9 and GAD-7 scores, and priority flags. The highest-risk patients are always at the top.' },
]

const roles = [
  { label: 'Patients', desc: 'Daily symptom check-ins, weight logging, care team messaging, and appointment reminders.' },
  { label: 'Clinicians', desc: 'Full monitoring dashboard, alert review, check-in history, screening scores, and billing eligibility.' },
  { label: 'Admins', desc: 'Care team management, patient enrollment, audit log access, and system configuration.' },
]

function ClayBtn({
  onClick,
  children,
  style: extra,
}: {
  onClick: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = P.clayHover }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = P.clayDeep }}
      style={{
        background: P.clayDeep,
        color: '#FFF8F5',   // tinted white — slight orange lean
        border: 'none',
        borderRadius: 6,
        padding: '13px 26px',
        minHeight: 48,
        fontSize: 15,
        fontFamily: F.body,
        fontWeight: 600,
        cursor: 'pointer',
        letterSpacing: '0.01em',
        transition: 'background 150ms ease-out',
        ...extra,
      }}
    >
      {children}
    </button>
  )
}

function GhostBtn({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = P.body
        el.style.color = P.ink
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.borderColor = P.borderStrong
        el.style.color = P.body
      }}
      style={{
        background: 'transparent',
        color: P.body,
        border: `1px solid ${P.borderStrong}`,
        borderRadius: 6,
        padding: '13px 26px',
        minHeight: 48,
        fontSize: 15,
        fontFamily: F.body,
        fontWeight: 400,
        cursor: 'pointer',
        transition: 'border-color 150ms ease-out, color 150ms ease-out',
      }}
    >
      {children}
    </button>
  )
}

function PrelaunchEmailForm() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'duplicate' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('loading')
    setMessage('')
    try {
      const result = await collectPrelaunchEmail(email)
      setStatus(result.alreadySubscribed ? 'duplicate' : 'success')
      setMessage(result.alreadySubscribed
        ? "You're already on the launch list."
        : "You're on the list. We'll send launch updates and newsletter notes before we open access."
      )
      setEmail('')
    } catch (err: unknown) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'We could not save that email. Please try again.')
    }
  }

  const isLoading = status === 'loading'

  return (
    <div>
      <form
        onSubmit={handleSubmit}
        aria-label="Join the MKL Health launch list"
        style={{
          marginTop: 18,
          padding: 4,
          border: `1px solid ${P.borderStrong}`,
          borderRadius: 8,
          display: 'flex',
          gap: 4,
          background: P.canvas,
          maxWidth: 520,
          boxShadow: '0 8px 24px rgba(74, 64, 56, 0.08)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <label htmlFor="prelaunch-email" style={{
            position: 'absolute',
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}>
            Email address
          </label>
          <input
            id="prelaunch-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => {
              setEmail(e.target.value)
              if (status !== 'idle') {
                setStatus('idle')
                setMessage('')
              }
            }}
            placeholder="you@clinic.com"
            disabled={isLoading}
            style={{
              width: '100%',
              minHeight: 48,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: P.ink,
              fontFamily: F.body,
              fontSize: 15,
              padding: '0 14px',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          style={{
            minHeight: 48,
            minWidth: 148,
            border: 'none',
            borderRadius: 6,
            background: isLoading ? P.borderStrong : P.clayDeep,
            color: '#FFF8F5',
            fontFamily: F.body,
            fontSize: 14,
            fontWeight: 700,
            cursor: isLoading ? 'wait' : 'pointer',
            padding: '0 18px',
            transition: 'background 150ms ease-out',
          }}
        >
          {isLoading ? 'Saving...' : 'Join Launch List'}
        </button>
      </form>
      {message && (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          style={{
            marginTop: 10,
            fontFamily: F.body,
            fontSize: 13,
            lineHeight: 1.5,
            color: status === 'error' ? P.clayHover : P.sage,
          }}
        >
          {message}
        </div>
      )}
    </div>
  )
}

export function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  return (
    <>
      {/* Skip navigation — keyboard and screen reader users */}
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: 9999,
          padding: '8px 16px',
          background: P.clayDeep,
          color: '#FFF8F5',
          fontFamily: F.mono,
          fontSize: 12,
          textDecoration: 'none',
          borderRadius: 4,
        }}
        onFocus={e => { (e.currentTarget as HTMLAnchorElement).style.left = '8px' }}
        onBlur={e => { (e.currentTarget as HTMLAnchorElement).style.left = '-9999px' }}
      >
        Skip to main content
      </a>

      <div style={{ minHeight: '100dvh', background: P.surface, fontFamily: F.body }}>

        {/* Nav */}
        <nav
          aria-label="Site navigation"
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            background: P.canvas,
            borderBottom: `1px solid ${P.border}`,
            padding: '0 24px',
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{
            fontFamily: F.display,
            fontSize: 18,
            color: P.ink,
            flex: 1,
            letterSpacing: '-0.01em',
            fontWeight: 700,
          }}>
            MKL Health
          </div>
          <ClayBtn onClick={onSignIn} style={{ padding: '9px 18px', minHeight: 44, fontSize: 13 }}>
            Sign In
          </ClayBtn>
        </nav>

        <main id="main-content">

          {/* Hero */}
          <div style={{ background: P.canvas, padding: '72px 24px 80px' }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 32,
              }}>
                <div style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: P.clay,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: F.mono,
                  fontSize: 11,
                  color: P.muted,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}>
                  Diabetes · CKD · Medication Outcomes
                </span>
              </div>

              <h1 style={{
                fontFamily: F.display,
                fontSize: 'clamp(40px, 7vw, 68px)',
                color: P.ink,
                lineHeight: 1.06,
                letterSpacing: '-0.025em',
                marginBottom: 28,
                fontWeight: 700,
              }}>
                See if the medication is working —{' '}
                <span style={{ color: P.clay }}>before the next visit.</span>
              </h1>

              <p style={{
                fontFamily: F.body,
                fontSize: 17,
                color: P.body,
                lineHeight: 1.7,
                maxWidth: 520,
                marginBottom: 40,
              }}>
                MKL Health links every medication change to the lab values and vitals it's meant to move —
                real-time monitoring, AI-powered check-ins, and instant alerting for diabetes, CKD, and cardiac
                comorbidities, in one clinical-grade dashboard.
              </p>

              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <ClayBtn onClick={onSignIn}>
                  Request Access →
                </ClayBtn>
                <GhostBtn onClick={onSignIn}>
                  Provider Login
                </GhostBtn>
              </div>

              <div style={{ marginTop: 42 }}>
                <div style={{
                  fontFamily: F.mono,
                  fontSize: 11,
                  color: P.clayDeep,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}>
                  Pre-launch updates
                </div>
                <h2 style={{
                  fontFamily: F.display,
                  fontSize: 'clamp(24px, 4vw, 34px)',
                  color: P.ink,
                  lineHeight: 1.12,
                  letterSpacing: '-0.02em',
                  marginBottom: 10,
                  fontWeight: 700,
                }}>
                  Get launch information before MKL Health opens access.
                </h2>
                <p style={{
                  fontFamily: F.body,
                  fontSize: 15,
                  color: P.body,
                  lineHeight: 1.65,
                  maxWidth: 500,
                  marginBottom: 4,
                }}>
                  Join the newsletter for product updates, launch timing, and early-access details for care teams.
                </p>
                <PrelaunchEmailForm />
                <p style={{
                  fontFamily: F.mono,
                  fontSize: 10,
                  color: P.muted,
                  lineHeight: 1.6,
                  maxWidth: 500,
                  marginTop: 30,
                }}>
                  No patient information. Just launch updates for clinical teams.
                </p>
              </div>

            </div>
          </div>

          {/* Features — editorial typographic rows, not card grid */}
          <div style={{ background: P.surface, borderTop: `1px solid ${P.border}` }}>
            <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 0' }}>

              <div style={{ marginBottom: 48 }}>
                <h2 style={{
                  fontFamily: F.display,
                  fontSize: 'clamp(26px, 4vw, 36px)',
                  fontWeight: 700,
                  color: P.ink,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  marginBottom: 10,
                }}>
                  Everything your care team needs
                </h2>
                <p style={{
                  fontFamily: F.body,
                  fontSize: 15,
                  color: P.muted,
                  lineHeight: 1.6,
                }}>
                  Purpose-built for diabetes, CKD, and medication-outcome tracking. Not adapted from a general-purpose template.
                </p>
              </div>

              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {features.map((f, i) => (
                  <li
                    key={f.tag}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '88px 1fr',
                      gap: '0 28px',
                      padding: '26px 0',
                      borderTop: `1px solid ${P.border}`,
                      ...(i === features.length - 1 ? { borderBottom: `1px solid ${P.border}` } : {}),
                    }}
                  >
                    <div style={{
                      fontFamily: F.mono,
                      fontSize: 11,
                      color: P.clayDeep,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      paddingTop: 3,
                    }}>
                      {f.tag}
                    </div>
                    <div>
                      <div style={{
                        fontFamily: F.display,
                        fontSize: 18,
                        fontWeight: 700,
                        color: P.ink,
                        letterSpacing: '-0.015em',
                        lineHeight: 1.25,
                        marginBottom: 7,
                      }}>
                        {f.title}
                      </div>
                      <div style={{
                        fontFamily: F.body,
                        fontSize: 14,
                        color: P.body,
                        lineHeight: 1.75,
                      }}>
                        {f.desc}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

            </div>
          </div>

          {/* Roles */}
          <div style={{
            background: P.strip,
            borderTop: `1px solid ${P.border}`,
            padding: '64px 24px 72px',
          }}>
            <div style={{ maxWidth: 760, margin: '0 auto' }}>

              <h2 style={{
                fontFamily: F.display,
                fontSize: 'clamp(24px, 3.5vw, 32px)',
                fontWeight: 700,
                color: P.ink,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                marginBottom: 40,
              }}>
                Built for every role
              </h2>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '32px 48px',
                marginBottom: 48,
              }}>
                {roles.map(r => (
                  <div key={r.label}>
                    <div style={{
                      fontFamily: F.mono,
                      fontSize: 11,
                      color: P.clayDeep,
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      marginBottom: 10,
                    }}>
                      {r.label}
                    </div>
                    <div style={{
                      fontFamily: F.body,
                      fontSize: 14,
                      color: P.body,
                      lineHeight: 1.7,
                    }}>
                      {r.desc}
                    </div>
                  </div>
                ))}
              </div>

              <ClayBtn onClick={onSignIn} style={{ minWidth: 240 }}>
                Sign In to MKL Health →
              </ClayBtn>

            </div>
          </div>

        </main>

        {/* Footer */}
        <footer style={{
          borderTop: `1px solid ${P.border}`,
          padding: '18px 24px',
          background: P.canvas,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: P.muted }}>
            MKL Health · Clinical Care Platform for Diabetes, CKD & Medication Outcomes
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: P.muted }}>
            For authorized care teams only
          </span>
        </footer>

      </div>
    </>
  )
}
