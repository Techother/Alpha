// cardiotrack/src/components/layout/LandingPage.tsx
// Extracted from App.tsx lines 209–297
// Clinical white design — institutional blue replaces neon teal

import { T, F } from '@/lib/tokens'
import { Btn } from '@/components/ui/primitives'

export function LandingPage({ onSignIn }: { onSignIn: () => void }) {
  const features = [
    { icon: '♡', title: 'Real-time Monitoring', desc: 'Daily vital signs tracked across your entire patient roster with instant alert escalation.' },
    { icon: '⚠', title: 'Smart Alerts', desc: 'Automatic alerts for weight gain, breathlessness spikes, and missed medications.' },
    { icon: '🤖', title: 'AI Check-ins', desc: 'Conversational daily check-ins powered by Claude — compassionate, structured, clinical.' },
    { icon: '◷', title: 'Scheduling', desc: 'Google Calendar integration for appointments synced directly with your practice.' },
    { icon: '✦', title: 'Team Messaging', desc: 'Slack integration for instant care team alerts and communication.' },
    { icon: '▦', title: 'Clinical Dashboard', desc: 'Risk-stratified roster with trend analysis, sparklines, and KPI overview.' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, fontFamily: F.body }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: T.nav, borderBottom: `1px solid ${T.border}`,
        padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontFamily: F.display, fontSize: 20, color: T.blue, flex: 1 }}>Alpha Health Track</div>
        <Btn onClick={onSignIn} style={{ padding: '8px 20px', minHeight: 38, fontSize: 13 }}>Sign In</Btn>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '64px 24px 48px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{
          display: 'inline-block',
          background: T.blueSurface, border: `1px solid ${T.blue}30`,
          borderRadius: 20, padding: '4px 14px',
          fontFamily: F.mono, fontSize: 11, color: T.blue,
          marginBottom: 24, letterSpacing: 1,
        }}>
          CARDIAC REMOTE MONITORING
        </div>
        <h1 style={{ fontFamily: F.display, fontSize: 'clamp(32px, 8vw, 56px)', color: T.text, lineHeight: 1.1, marginBottom: 20 }}>
          Heart failure care,<br /><span style={{ color: T.blue }}>from anywhere.</span>
        </h1>
        <p style={{ fontSize: 16, color: T.textSec, lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
          Alpha Health Track gives cardiac care teams real-time patient monitoring, AI-powered daily check-ins, and instant alerting — in one clinical-grade dashboard.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={onSignIn} style={{ fontSize: 15, padding: '12px 28px' }}>Get Started →</Btn>
          <Btn variant="ghost" onClick={onSignIn} style={{ fontSize: 15, padding: '12px 28px' }}>Provider Login</Btn>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: T.nav, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: '24px 20px', margin: '0 0 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(24px, 6vw, 64px)', flexWrap: 'wrap' }}>
          {[['< 2 min', 'daily check-in time'], ['60s', 'alert polling interval'], ['7-day', 'weight trend window'], ['4', 'integrations']].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.display, fontSize: 28, color: T.blue }}>{val}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '0 20px 64px' }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <h2 style={{ fontFamily: F.display, fontSize: 28, color: T.text }}>Everything your care team needs</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {features.map(f => (
            <div key={f.title} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: T.textSec, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div style={{ background: T.nav, borderTop: `1px solid ${T.border}`, padding: '48px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: F.display, fontSize: 24, color: T.text, marginBottom: 8 }}>Built for every role</h2>
          <p style={{ color: T.textSec, fontSize: 14, marginBottom: 32 }}>One platform, tailored access for patients, clinicians, and administrators.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['Patients', 'Daily check-ins, symptom tracking, care team messaging'], ['Clinicians', 'Full monitoring dashboard, alerts, check-in history'], ['Admins', 'Backlog management, sprint tracking, system setup']].map(([role, desc]) => (
              <div key={role} style={{ flex: '1 1 180px', background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: '20px 16px', textAlign: 'left' }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: T.blue, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{role}</div>
                <div style={{ fontSize: 13, color: T.textSec, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36 }}>
            <Btn onClick={onSignIn} full style={{ maxWidth: 320, margin: '0 auto', fontSize: 15 }}>Sign In to Alpha Health Track →</Btn>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: '20px', textAlign: 'center', fontFamily: F.mono, fontSize: 11, color: T.textTert }}>
        Alpha Health Track · Clinical Remote Monitoring · For authorized care teams only
      </div>
    </div>
  )
}
