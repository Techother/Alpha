import { useState, useEffect, useRef, useCallback } from 'react'
import {
  supabase, signIn, signOut, onAuthChange,
  getPatients, getPatient, getPatientCheckins,
  createCheckin, getOpenAlerts, getPatientAlerts, acknowledgeAlert,
  getDashboardStats, createChatbotSession, saveChatbotMessage,
  completeSession, createAlert,
} from './api/supabase'
import { getStories, getSprints, createStory, createSprint } from './api/airtable'
import { getChannelMessages, postMessage, postPatientAlert } from './api/slack'
import { initGoogleCalendar, signInGoogle, isSignedIn, getUpcomingEvents, createEvent } from './api/gcal'
import { FEATURES } from './config'
import { getBillingPeriodData, getMonthlyBillingSummary, logRpmTime, exportBillingCSV } from './api/billing'
import { getPatientMedications, addMedication, deactivateMedication, getMedicationAdherence, logMedications } from './api/medications'
import { getActiveTcmEpisodes, getPatientTcmEpisodes, createTcmEpisode, logTcmContact, completeTcmMilestone, getOverdueTcmEpisodes } from './api/tcm'
import { getPatientScreenings, getLatestScreening, createScreeningResult, getPatientsNeedingScreening, scorePHQ9, scoreGAD7 } from './api/screening'
import { sendTestSMS } from './api/twilio'

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg: '#080C10', s1: '#0D1117', s2: '#111820', s3: '#16202C',
  border: '#1E2D3D', red: '#E53E3E', amber: '#DD6B20', green: '#38A169',
  teal: '#0BC5EA', blue: '#4299E1', text: '#E2E8F0', mid: '#718096', dim: '#2D3748',
}
const F = { display: "'Fraunces', serif", body: "'DM Sans', sans-serif", mono: "'DM Mono', monospace" }

// ── Global styles (injected once at root) ────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; -webkit-text-size-adjust: 100%; }
  body { background: ${T.bg}; color: ${T.text}; font-family: ${F.body}; overflow-x: hidden; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
  @keyframes slideLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
  ::-webkit-scrollbar { width: 5px; height: 5px; }
  ::-webkit-scrollbar-track { background: ${T.s1}; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
  select option { background: ${T.s3}; }
  input, select, textarea { color: ${T.text}; }
  a { color: ${T.teal}; }

  /* Responsive layout tokens */
  .sidebar {
    position: fixed; left: 0; top: 0; bottom: 0; width: 260px; z-index: 50;
    background: ${T.s1}; border-right: 1px solid ${T.border};
    display: flex; flex-direction: column;
    transform: translateX(-100%); transition: transform 0.25s ease;
  }
  .sidebar.open { transform: translateX(0); animation: slideLeft 0.25s ease; }
  .sidebar-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 40;
  }
  .sidebar-overlay.open { display: block; }
  .main-content { margin-left: 0; min-height: 100dvh; display: flex; flex-direction: column; }
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0; z-index: 30;
    background: ${T.s1}; border-top: 1px solid ${T.border};
    display: flex; align-items: stretch;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  .topbar {
    position: sticky; top: 0; z-index: 20;
    background: ${T.s1}; border-bottom: 1px solid ${T.border};
    height: 52px; padding: 0 16px; display: flex; align-items: center; gap: 10px;
  }
  .page { flex: 1; padding: 16px; padding-bottom: calc(72px + env(safe-area-inset-bottom, 0)); animation: fadeIn 0.2s ease; }
  .grid-2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid-sidebar { display: grid; grid-template-columns: 1fr; gap: 16px; }
  .hide-mobile { display: none !important; }
  .show-mobile { display: flex !important; }

  @media (min-width: 768px) {
    .sidebar { transform: translateX(0); }
    .sidebar.open { animation: none; }
    .sidebar-overlay { display: none !important; }
    .main-content { margin-left: 260px; }
    .bottom-nav { display: none; }
    .topbar { height: 56px; padding: 0 28px; }
    .page { padding: 28px; padding-bottom: 28px; }
    .grid-2 { grid-template-columns: 1fr 1fr; }
    .grid-4 { grid-template-columns: repeat(4, 1fr); }
    .grid-sidebar { grid-template-columns: 2fr 1fr; }
    .hide-mobile { display: flex !important; }
    .show-mobile { display: none !important; }
  }
`

// ── Primitives ────────────────────────────────────────────────

function Spin({ size = 16 }: { size?: number }) {
  return <span style={{ display: 'inline-block', width: size, height: size, border: `2px solid ${T.border}`, borderTopColor: T.teal, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
}

function Empty({ icon = '○', msg }: { icon?: string; msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: T.mid }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontFamily: F.body }}>{msg}</div>
    </div>
  )
}

type BtnV = 'primary' | 'ghost' | 'danger'
function Btn({ children, onClick, variant = 'primary', disabled, style: s, type = 'button', full }: {
  children: React.ReactNode; onClick?: () => void; variant?: BtnV
  disabled?: boolean; style?: React.CSSProperties; type?: 'button' | 'submit'; full?: boolean
}) {
  const base: React.CSSProperties = { fontFamily: F.body, fontSize: 14, fontWeight: 500, padding: '10px 18px', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, border: '1px solid transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'opacity 0.15s, transform 0.1s', minHeight: 44, width: full ? '100%' : undefined, WebkitTapHighlightColor: 'transparent' }
  const v: Record<BtnV, React.CSSProperties> = {
    primary: { background: T.teal, color: '#000' },
    ghost:   { background: 'transparent', color: T.text, border: `1px solid ${T.border}` },
    danger:  { background: T.red, color: '#fff' },
  }
  return <button type={type} onClick={onClick} disabled={disabled} style={{ ...base, ...v[variant], ...s }}>{children}</button>
}

type TagT = 'default' | 'green' | 'red' | 'amber' | 'teal'
function Tag({ children, type = 'default' }: { children: React.ReactNode; type?: TagT }) {
  const c: Record<TagT, [string, string]> = { default: [T.dim, T.text], green: ['#1C3D2E', T.green], red: ['#3D1C1C', T.red], amber: ['#3D2A1C', T.amber], teal: ['#0A2D35', T.teal] }
  return <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4, background: c[type][0], color: c[type][1], whiteSpace: 'nowrap' }}>{children}</span>
}

function SevBar({ severity }: { severity: string }) {
  const col: Record<string, string> = { critical: T.red, high: T.amber, medium: '#ECC94B', low: T.mid }
  return <div style={{ width: 3, minHeight: 44, borderRadius: 2, background: col[severity] ?? T.mid, flexShrink: 0 }} />
}

function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', ...s }}>{children}</div>
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>{children}</div>
}

function Sparkline({ checkins, color = T.teal }: { checkins: any[]; color?: string }) {
  const vals = [...checkins].reverse().map((c: any) => Number(c.weight_lbs)).filter(v => !isNaN(v) && v > 0)
  if (vals.length < 2) return <div style={{ color: T.mid, fontSize: 12, padding: '8px 0' }}>Not enough data</div>
  const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1
  const W = 260; const H = 56; const p = 6
  const pts = vals.map((v, i) => `${(p + (i / (vals.length - 1)) * (W - p * 2)).toFixed(1)},${(H - p - ((v - min) / range) * (H - p * 2)).toFixed(1)}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', maxWidth: W }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {vals.map((v, i) => { const x = p + (i / (vals.length - 1)) * (W - p * 2); const y = H - p - ((v - min) / range) * (H - p * 2); return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} fill={color} /> })}
    </svg>
  )
}

function useAsync<T>(fn: () => Promise<T>, deps: any[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await fn()) } catch (e: any) { setError(e.message ?? 'Error') } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { run() }, [run])
  return { data, loading, error, refresh: run }
}

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}
function riskOrder(r: string) { return r === 'high' ? 0 : r === 'medium' ? 1 : 2 }
function riskTag(r: string): TagT { return r === 'high' ? 'red' : r === 'medium' ? 'amber' : 'green' }

function ComingSoon({ title, icon, description, version = 'v2.1' }: { title: string; icon: string; description: string; version?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 48, background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 300, marginBottom: 8, color: T.text }}>{title}</div>
      <div style={{ fontSize: 13, color: T.mid, marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>{description}</div>
      <span style={{ background: T.s3, border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px', fontSize: 11, fontFamily: F.mono, color: T.mid }}>Coming in {version}</span>
    </div>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '11px 14px', minHeight: 44, outline: 'none' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, required }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required}
        style={{ background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 15, padding: '11px 14px', outline: 'none', width: '100%', minHeight: 44 }} />
    </label>
  )
}

// ── Landing page ──────────────────────────────────────────────

function LandingPage({ onSignIn }: { onSignIn: () => void }) {
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
      <nav style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(8,12,16,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}`, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: F.display, fontSize: 20, color: T.teal, flex: 1 }}>CardioTrack</div>
        <Btn onClick={onSignIn} style={{ padding: '8px 20px', minHeight: 38, fontSize: 13 }}>Sign In</Btn>
      </nav>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '64px 24px 48px', maxWidth: 640, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: '#0A2D35', border: `1px solid ${T.teal}30`, borderRadius: 20, padding: '4px 14px', fontFamily: F.mono, fontSize: 11, color: T.teal, marginBottom: 24, letterSpacing: 1 }}>
          CARDIAC REMOTE MONITORING
        </div>
        <h1 style={{ fontFamily: F.display, fontSize: 'clamp(32px, 8vw, 56px)', color: T.text, lineHeight: 1.1, marginBottom: 20 }}>
          Heart failure care,<br /><span style={{ color: T.teal }}>from anywhere.</span>
        </h1>
        <p style={{ fontSize: 16, color: T.mid, lineHeight: 1.7, marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
          CardioTrack gives cardiac care teams real-time patient monitoring, AI-powered daily check-ins, and instant alerting — in one clinical-grade dashboard.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn onClick={onSignIn} style={{ fontSize: 15, padding: '12px 28px' }}>Get Started →</Btn>
          <Btn variant="ghost" onClick={onSignIn} style={{ fontSize: 15, padding: '12px 28px' }}>Provider Login</Btn>
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ background: T.s1, borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, padding: '24px 20px', margin: '0 0 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(24px, 6vw, 64px)', flexWrap: 'wrap' }}>
          {[['< 2 min', 'daily check-in time'], ['60s', 'alert polling interval'], ['7-day', 'weight trend window'], ['4', 'integrations']].map(([val, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.display, fontSize: 28, color: T.teal }}>{val}</div>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
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
            <div key={f.title} style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontFamily: F.body, fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: T.mid, lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div style={{ background: T.s1, borderTop: `1px solid ${T.border}`, padding: '48px 20px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: F.display, fontSize: 24, color: T.text, marginBottom: 8 }}>Built for every role</h2>
          <p style={{ color: T.mid, fontSize: 14, marginBottom: 32 }}>One platform, tailored access for patients, clinicians, and administrators.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['Patients', 'Daily check-ins, symptom tracking, care team messaging'], ['Clinicians', 'Full monitoring dashboard, alerts, check-in history'], ['Admins', 'Backlog management, sprint tracking, system setup']].map(([role, desc]) => (
              <div key={role} style={{ flex: '1 1 180px', background: T.s2, border: `1px solid ${T.border}`, borderRadius: 10, padding: '20px 16px', textAlign: 'left' }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: T.teal, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{role}</div>
                <div style={{ fontSize: 13, color: T.mid, lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 36 }}>
            <Btn onClick={onSignIn} full style={{ maxWidth: 320, margin: '0 auto', fontSize: 15 }}>Sign In to CardioTrack →</Btn>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${T.border}`, padding: '20px', textAlign: 'center', fontFamily: F.mono, fontSize: 11, color: T.dim }}>
        CardioTrack · Clinical Cardiac Remote Monitoring · For authorized care teams only
      </div>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────

function LoginScreen({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    try { const { error: err } = await signIn(email, password); if (err) throw err }
    catch (e: any) { setError(e.message ?? 'Sign in failed') } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', flexDirection: 'column' }}>
      <nav style={{ background: 'rgba(8,12,16,0.9)', backdropFilter: 'blur(12px)', borderBottom: `1px solid ${T.border}`, padding: '0 20px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.mid, cursor: 'pointer', fontSize: 20, padding: 4 }}>←</button>
        <div style={{ fontFamily: F.display, fontSize: 18, color: T.teal }}>CardioTrack</div>
      </nav>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 14, padding: 'clamp(24px, 5vw, 40px)', width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease' }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontFamily: F.display, fontSize: 26, color: T.teal, marginBottom: 4 }}>Welcome back</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>Cardiac Remote Monitoring</div>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} required />
            <Field label="Password" type="password" value={password} onChange={setPassword} required />
            {error && <div style={{ background: '#3D1C1C', border: `1px solid ${T.red}`, borderRadius: 8, padding: '10px 14px', color: T.red, fontSize: 13 }}>{error}</div>}
            <Btn type="submit" disabled={loading} full style={{ marginTop: 4, fontSize: 15 }}>
              {loading ? <><Spin /> Signing in…</> : 'Sign In'}
            </Btn>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Nav types ─────────────────────────────────────────────────

type Section = 'dashboard' | 'patients' | 'alerts' | 'billing' | 'care-programs' | 'screening' | 'backlog' | 'calendar' | 'slack' | 'setup'

const NAV: { key: Section; label: string; icon: string }[] = [
  { key: 'dashboard',     label: 'Dashboard',     icon: '▦' },
  { key: 'patients',      label: 'Patients',      icon: '♡' },
  { key: 'alerts',        label: 'Alerts',        icon: '⚠' },
  { key: 'billing',       label: 'Billing',       icon: '$' },
  { key: 'care-programs', label: 'Care Programs', icon: '♥' },
  { key: 'screening',     label: 'Screening',     icon: '🧠' },
  { key: 'backlog',       label: 'Backlog',       icon: '☰' },
  { key: 'calendar',      label: 'Calendar',      icon: '◷' },
  { key: 'slack',         label: 'Slack',         icon: '✦' },
  { key: 'setup',         label: 'Setup',         icon: '⚙' },
]

// ── Sidebar (desktop) ─────────────────────────────────────────

function Sidebar({ section, setSection, alertCount, overdueTcm, screeningDue, billingCount, open, onClose }: {
  section: Section; setSection: (s: Section) => void; alertCount: number
  overdueTcm: number; screeningDue: number; billingCount: number; open: boolean; onClose: () => void
}) {
  function go(s: Section) { setSection(s); onClose() }
  function badge(key: Section) {
    if (key === 'alerts' && alertCount > 0) return { count: alertCount, color: T.red }
    if (key === 'care-programs' && overdueTcm > 0) return { count: overdueTcm, color: T.red }
    if (key === 'screening' && screeningDue > 0) return { count: screeningDue, color: T.amber }
    if (key === 'billing' && billingCount > 0) return { count: billingCount, color: T.green }
    return null
  }
  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <div className={`sidebar ${open ? 'open' : ''}`}>
        <div style={{ padding: '20px 18px 14px', borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: F.display, fontSize: 20, color: T.teal }}>CardioTrack</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginTop: 2 }}>Cardiac Monitoring · v2</div>
        </div>
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {NAV.map(n => {
            const b = badge(n.key)
            return (
              <button key={n.key} onClick={() => go(n.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '12px 18px', background: section === n.key ? T.s2 : 'transparent', color: section === n.key ? T.teal : T.mid, border: 'none', borderLeft: `2px solid ${section === n.key ? T.teal : 'transparent'}`, fontFamily: F.body, fontSize: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', minHeight: 44, WebkitTapHighlightColor: 'transparent' }}>
                <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>{n.icon}</span>
                {n.label}
                {b && <span style={{ marginLeft: 'auto', background: b.color, color: '#fff', borderRadius: 10, fontSize: 10, fontFamily: F.mono, padding: '2px 7px', fontWeight: 700 }}>{b.count}</span>}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginBottom: 6 }}>Connections</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['DB', !!import.meta.env.VITE_SUPABASE_URL], ['AT', !!import.meta.env.VITE_AIRTABLE_API_KEY], ['SL', !!import.meta.env.VITE_SLACK_BOT_TOKEN], ['GC', !!import.meta.env.VITE_GCAL_CLIENT_ID]].map(([l, ok]) => (
              <div key={l as string} title={l as string} style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? T.green : T.dim }} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Bottom nav (mobile) ───────────────────────────────────────

function BottomNav({ section, setSection, alertCount }: { section: Section; setSection: (s: Section) => void; alertCount: number }) {
  const primary = [NAV[0], NAV[1], NAV[2], NAV[3], NAV[6]] // dashboard, patients, alerts, billing, backlog
  return (
    <div className="bottom-nav">
      {primary.map(n => (
        <button key={n.key} onClick={() => setSection(n.key)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '8px 4px', background: 'none', border: 'none', color: section === n.key ? T.teal : T.dim, cursor: 'pointer', position: 'relative', fontFamily: F.body, fontSize: 10, minHeight: 56, WebkitTapHighlightColor: 'transparent' }}>
          <span style={{ fontSize: 20 }}>{n.icon}</span>
          {n.label.slice(0, 6)}
          {n.key === 'alerts' && alertCount > 0 && <span style={{ position: 'absolute', top: 6, right: '50%', marginRight: -18, background: T.red, color: '#fff', borderRadius: 8, fontSize: 9, padding: '1px 5px', fontFamily: F.mono }}>{alertCount}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Top bar ───────────────────────────────────────────────────

function TopBar({ title, onMenu, onSignOut }: { title: string; onMenu: () => void; onSignOut: () => void }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t) }, [])
  return (
    <div className="topbar">
      <button onClick={onMenu} className="show-mobile" style={{ background: 'none', border: 'none', color: T.mid, cursor: 'pointer', fontSize: 22, padding: 4, marginLeft: -4, minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' }}>☰</button>
      <div style={{ flex: 1, fontFamily: F.display, fontSize: 17, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      <div className="hide-mobile" style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{now.toLocaleString()}</div>
      <Btn variant="ghost" onClick={onSignOut} style={{ fontSize: 12, padding: '6px 12px', minHeight: 36 }}>Sign Out</Btn>
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────

function Dashboard({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const { data: stats, loading: sL } = useAsync(getDashboardStats, [])
  const { data: patients, loading: pL } = useAsync(getPatients, [])
  const { data: alerts, loading: aL } = useAsync(getOpenAlerts, [])
  const { data: sprints, loading: spL } = useAsync(getSprints, [])
  const period = new Date().toISOString().slice(0, 7)
  const { data: billingSummary } = useAsync(() => getMonthlyBillingSummary(period), [period])

  const sorted = patients ? [...patients].sort((a, b) => riskOrder(a.risk_level) - riskOrder(b.risk_level)) : []
  const withAlerts = new Set((alerts ?? []).map((a: any) => a.patient_id))
  const criticals = (alerts ?? []).filter((a: any) => a.severity === 'critical')
  const billingRows = billingSummary ?? []
  const billableCount = billingRows.filter((r: any) => r.cpt99454Met).length
  const totalRev = billingRows.reduce((s: number, r: any) => s + r.estimatedReimbursement, 0)
  const avgAdherence = billingRows.length ? Math.round(billingRows.reduce((s: number, r: any) => s + (r.checkinDays / 30) * 100, 0) / billingRows.length) : 0

  return (
    <div>
      {criticals.length > 0 && (
        <div style={{ background: '#3D1C1C', border: `1px solid ${T.red}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: T.red, fontSize: 18 }}>⚠</span>
          <span style={{ color: T.red, fontFamily: F.body, fontWeight: 600, fontSize: 14 }}>{criticals.length} critical alert{criticals.length > 1 ? 's' : ''} need immediate attention</span>
        </div>
      )}

      {/* KPIs — 6 tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
        {sL ? <Spin /> : [
          { label: 'Total Patients',      value: stats?.totalPatients ?? 0,  color: T.teal },
          { label: 'Open Alerts',         value: stats?.openAlerts ?? 0,     color: T.red },
          { label: 'High Risk',           value: stats?.highRisk ?? 0,       color: T.amber },
          { label: 'Check-ins Today',     value: stats?.checkinsToday ?? 0,  color: T.green },
          { label: 'Billable This Month', value: billableCount,              color: T.blue },
          { label: 'Avg Compliance',      value: `${avgAdherence}%`,         color: T.teal },
        ].map(k => (
          <Card key={k.label}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontFamily: F.display, fontSize: 28, color: k.color }}>{k.value}</div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid-2">
        {/* Roster */}
        <Card>
          <CardHeader>Patient Roster</CardHeader>
          {pL ? <div style={{ padding: 20 }}><Spin /></div> : sorted.length === 0 ? <Empty msg="No patients" /> :
            sorted.map((p: any) => (
              <div key={p.id} onClick={() => onSelectPatient(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', minHeight: 56 }}
                onMouseEnter={e => (e.currentTarget.style.background = T.s3)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.body, color: T.text, fontSize: 14, fontWeight: 500 }}>
                    {p.first_name} {p.last_name}
                    {withAlerts.has(p.id) && <span style={{ marginLeft: 6, color: T.red }}>●</span>}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.mrn} · {p.condition}</div>
                </div>
                <Tag type={riskTag(p.risk_level)}>{p.risk_level}</Tag>
              </div>
            ))
          }
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Billing snapshot */}
          <Card>
            <CardHeader>Billing Snapshot · {period}</CardHeader>
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: F.body, fontSize: 13, color: T.mid, marginBottom: 8 }}>
                <span style={{ color: T.green, fontFamily: F.display, fontSize: 20 }}>{billableCount}</span> of {billingRows.length} patients billable
              </div>
              <div style={{ fontFamily: F.display, fontSize: 24, color: T.teal, marginBottom: 12 }}>${totalRev.toLocaleString()}</div>
              <button onClick={() => {}} style={{ background: 'none', border: 'none', color: T.teal, fontFamily: F.mono, fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>View Full Report →</button>
            </div>
          </Card>

          {/* Active sprint */}
          <Card>
            <CardHeader>Active Sprint</CardHeader>
            <div style={{ padding: 16 }}>
              {spL ? <Spin /> : !sprints?.[0] ? <Empty msg="No Airtable sprints" /> : (
                <>
                  <div style={{ fontFamily: F.display, fontSize: 17, color: T.text, marginBottom: 8 }}>{sprints[0].Name}</div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>Target: <span style={{ color: T.text }}>{sprints[0]['Target Date'] ?? '—'}</span></span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: T.teal }}>{sprints[0]['Server Points'] ?? 0} srv pts</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: T.blue }}>{sprints[0]['Client Points'] ?? 0} cli pts</span>
                  </div>
                  {sprints[0].Notes && <div style={{ fontFamily: F.body, fontSize: 12, color: T.mid, marginTop: 8 }}>{sprints[0].Notes}</div>}
                </>
              )}
            </div>
          </Card>

          {/* Recent alerts */}
          <Card>
            <CardHeader>Recent Alerts</CardHeader>
            {aL ? <div style={{ padding: 20 }}><Spin /></div> : (alerts ?? []).slice(0, 4).length === 0 ? <Empty msg="No open alerts" /> :
              (alerts as any[]).slice(0, 4).map((a) => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
                  <SevBar severity={a.severity} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{a.patients?.first_name} {a.patients?.last_name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: T.mid, marginTop: 2 }}>{a.description}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{timeAgo(a.created_at)}</div>
                  </div>
                </div>
              ))
            }
          </Card>
        </div>
      </div>
    </div>
  )
}

// ── Patient Monitor ───────────────────────────────────────────

function PatientMonitor({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { data: patient, loading: pL } = useAsync(() => getPatient(patientId), [patientId])
  const { data: checkins, loading: cL, refresh: rC } = useAsync(() => getPatientCheckins(patientId, 7), [patientId])
  const { data: alerts, loading: aL, refresh: rA } = useAsync(() => getPatientAlerts(patientId), [patientId])
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [slackMsg, setSlackMsg] = useState('')

  if (pL) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spin size={32} /></div>
  if (!patient) return <div style={{ padding: 20, color: T.red }}>Patient not found</div>

  const latest = checkins?.[0] as any; const prev = checkins?.[1] as any
  function trend(f: string) { if (!latest || !prev) return '→'; const a = Number(latest[f]), b = Number(prev[f]); return isNaN(a)||isNaN(b)?'→':a>b?'↑':a<b?'↓':'→' }
  function alarmColor(f: string, th: number) { return latest && Number(latest[f]) >= th ? T.red : T.text }

  async function handleAck(id: string) { await acknowledgeAlert(id); rA() }
  async function handleSlack() {
    try {
      setSlackMsg('')
      await postPatientAlert({ patientName: `${patient.first_name} ${patient.last_name}`, mrn: patient.mrn, alertType: 'manual_alert', value: 'Manual', threshold: 'N/A', provider: patient.provider_name })
      setSlackMsg('✓ Alert sent to Slack')
    } catch (e: any) { setSlackMsg(e.message) }
  }

  return (
    <div>
      {checkinOpen && <ChatbotModal patient={patient} onClose={() => { setCheckinOpen(false); rC(); rA() }} />}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: T.mid, cursor: 'pointer', fontFamily: F.body, fontSize: 14, padding: '4px 0', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontFamily: F.display, fontSize: 'clamp(22px, 5vw, 30px)', color: T.text }}>{patient.first_name} {patient.last_name}</div>
              <Tag type={riskTag(patient.risk_level)}>{patient.risk_level} risk</Tag>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, marginTop: 4 }}>{patient.mrn} · {patient.condition}</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{patient.provider_name}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Btn variant="ghost" onClick={handleSlack} style={{ fontSize: 13 }}>📢 Alert</Btn>
            <Btn onClick={() => setCheckinOpen(true)} style={{ fontSize: 13 }}>+ Check-in</Btn>
          </div>
        </div>
        {slackMsg && <div style={{ marginTop: 8, fontSize: 12, color: slackMsg.startsWith('✓') ? T.green : T.red, fontFamily: F.mono }}>{slackMsg}</div>}
      </div>

      {/* Alerts */}
      {!aL && (alerts ?? []).length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader style={{ color: T.red }}>Open Alerts</CardHeader>
          {(alerts as any[]).map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
              <SevBar severity={a.severity} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{a.alert_type.replace(/_/g, ' ')}</div>
                <div style={{ fontFamily: F.body, fontSize: 12, color: T.mid }}>{a.description}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, marginTop: 2 }}>{timeAgo(a.created_at)}</div>
              </div>
              <Btn variant="ghost" onClick={() => handleAck(a.id)} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>Ack</Btn>
            </div>
          ))}
        </Card>
      )}

      {/* Vitals */}
      <div className="grid-4" style={{ marginBottom: 16 }}>
        {[
          { label: 'Weight', field: 'weight_lbs', unit: 'lbs', th: 999 },
          { label: 'Heart Rate', field: 'heart_rate', unit: 'bpm', th: 999 },
          { label: 'Breathlessness', field: 'breathlessness_score', unit: '/10', th: 7 },
          { label: 'Swelling', field: 'swelling_score', unit: '/10', th: 7 },
        ].map(v => (
          <Card key={v.field}>
            <div style={{ padding: 16 }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>{v.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                <span style={{ fontFamily: F.display, fontSize: 28, color: alarmColor(v.field, v.th) }}>{cL ? '…' : (latest?.[v.field] ?? '—')}</span>
                <span style={{ fontFamily: F.mono, fontSize: 12, color: T.mid }}>{v.unit}</span>
                <span style={{ fontFamily: F.mono, fontSize: 16, color: T.mid, marginLeft: 'auto' }}>{trend(v.field)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Sparkline */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>7-Day Weight Trend (lbs)</CardHeader>
        <div style={{ padding: 16 }}>{cL ? <Spin /> : <Sparkline checkins={checkins ?? []} color={patient.risk_level === 'high' ? T.red : T.teal} />}</div>
      </Card>

      {/* Check-in log */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>Recent Check-ins</CardHeader>
        {cL ? <div style={{ padding: 20 }}><Spin /></div> : (checkins ?? []).length === 0 ? <Empty msg="No check-ins yet" /> :
          (checkins as any[]).slice(0, 5).map((c) => (
            <div key={c.id} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}`, fontFamily: F.mono, fontSize: 11 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ color: T.mid, minWidth: 80 }}>{c.checkin_date}</span>
                <span style={{ color: T.text }}>⚖ {c.weight_lbs ?? '—'} lbs</span>
                <span style={{ color: T.text }}>♡ {c.heart_rate ?? '—'} bpm</span>
                <span style={{ color: c.breathlessness_score >= 7 ? T.red : T.text }}>Breath {c.breathlessness_score ?? '—'}/10</span>
                <span style={{ color: c.swelling_score >= 7 ? T.red : T.text }}>Swell {c.swelling_score ?? '—'}/10</span>
                {c.medications_taken === false && <span style={{ color: T.amber, fontWeight: 700 }}>⚠ MEDS MISSED</span>}
              </div>
            </div>
          ))
        }
      </Card>

      {/* Medications */}
      <MedicationsSection patient={patient} />

      {/* Billing status */}
      <PatientBillingStatus patientId={patientId} />

      {/* TCM status */}
      <PatientTcmStatus patientId={patientId} />

      {/* Screening history */}
      <PatientScreeningHistory patient={patient} />

      {/* SMS Check-in Settings */}
      {FEATURES.SMS_CHECKINS && <SmsCheckinSettings patient={patient} />}
    </div>
  )
}

function PatientBillingStatus({ patientId }: { patientId: string }) {
  const period = new Date().toISOString().slice(0, 7)
  const { data: billing } = useAsync(() => getBillingPeriodData(patientId, period), [patientId, period])
  if (!billing) return null
  const needed = 16 - billing.checkinDays
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>Billing Status · {period}</CardHeader>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ fontFamily: F.mono, fontSize: 12 }}>
          <span style={{ color: billing.cpt99454Met ? T.green : T.amber }}>{billing.checkinDays}</span>
          <span style={{ color: T.mid }}>/16 check-in days {billing.cpt99454Met ? <Tag type="green">99454 ✓</Tag> : needed > 0 ? <Tag type="amber">{needed} more needed</Tag> : null}</span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 12 }}>
          <span style={{ color: billing.cpt99457Met ? T.green : T.mid }}>{billing.rpmMinutes} RPM min</span>
          {billing.cpt99457Met && <span style={{ marginLeft: 6 }}><Tag type="green">99457 ✓</Tag></span>}
          {billing.cpt99458Count > 0 && <span style={{ marginLeft: 6 }}><Tag type="teal">+{billing.cpt99458Count}×99458</Tag></span>}
        </div>
        <div style={{ marginLeft: 'auto', fontFamily: F.mono, fontSize: 14, color: T.green }}>Est. ${billing.estimatedReimbursement}</div>
      </div>
    </Card>
  )
}

function PatientTcmStatus({ patientId }: { patientId: string }) {
  const today = new Date().toISOString().slice(0, 10)
  const { data: episodes } = useAsync(() => getPatientTcmEpisodes(patientId), [patientId])
  const openEp = (episodes ?? []).find((e: any) => e.status === 'open')
  if (!openEp) return null
  function ms(ep: any, m: 'day2' | 'day7') {
    if (ep[`${m}_completed`]) return { label: 'Complete', color: T.green }
    if (ep[`${m}_deadline`] < today) return { label: 'Overdue', color: T.red }
    return { label: ep[`${m}_deadline`], color: T.amber }
  }
  const d2 = ms(openEp, 'day2'); const d7 = ms(openEp, 'day7')
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>TCM Episode</CardHeader>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>D/C: <span style={{ color: T.text }}>{openEp.discharge_date}</span></span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>Day-2: <span style={{ color: d2.color }}>{d2.label}</span></span>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>Day-7: <span style={{ color: d7.color }}>{d7.label}</span></span>
        <Tag type={openEp.complexity === 'high' ? 'red' : 'amber'}>{openEp.complexity}</Tag>
      </div>
    </Card>
  )
}

function PatientScreeningHistory({ patient }: { patient: any }) {
  const [screenOpen, setScreenOpen] = useState<{ type: 'phq9' | 'gad7' } | null>(null)
  const { data: latestPhq9 } = useAsync(() => getLatestScreening(patient.id, 'phq9'), [patient.id])
  const { data: latestGad7 } = useAsync(() => getLatestScreening(patient.id, 'gad7'), [patient.id])
  if (!latestPhq9 && !latestGad7) return null
  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Screening History</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn variant="ghost" onClick={() => setScreenOpen({ type: 'phq9' })} style={{ fontSize: 11, padding: '4px 8px', minHeight: 30 }}>PHQ-9</Btn>
          <Btn variant="ghost" onClick={() => setScreenOpen({ type: 'gad7' })} style={{ fontSize: 11, padding: '4px 8px', minHeight: 30 }}>GAD-7</Btn>
        </div>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        {latestPhq9 && (
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginBottom: 4 }}>PHQ-9</div>
            <span style={{ fontFamily: F.display, fontSize: 24, color: severityColor((latestPhq9 as any).severity) }}>{(latestPhq9 as any).score}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginLeft: 6 }}>{(latestPhq9 as any).severity?.replace('_', ' ')}</span>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>{new Date((latestPhq9 as any).administered_at).toLocaleDateString()}</div>
          </div>
        )}
        {latestGad7 && (
          <div>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginBottom: 4 }}>GAD-7</div>
            <span style={{ fontFamily: F.display, fontSize: 24, color: severityColor((latestGad7 as any).severity) }}>{(latestGad7 as any).score}</span>
            <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginLeft: 6 }}>{(latestGad7 as any).severity?.replace('_', ' ')}</span>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>{new Date((latestGad7 as any).administered_at).toLocaleDateString()}</div>
          </div>
        )}
      </div>
      {screenOpen && <ScreeningChatbot patient={patient} screenType={screenOpen.type} onClose={() => setScreenOpen(null)} />}
    </Card>
  )
}

function SmsCheckinSettings({ patient }: { patient: any }) {
  const [form, setForm] = useState({ mobile_phone: patient.mobile_phone ?? '', checkin_sms_enabled: patient.checkin_sms_enabled ?? false, checkin_time: patient.checkin_time ?? '09:00' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const checkinUrl = `${window.location.origin}/checkin/${patient.checkin_token}`

  async function handleSave() {
    setSaving(true); setMsg('')
    try {
      const db = (await import('./api/supabase')).supabase
      if (db) await db.from('patients').update({ mobile_phone: form.mobile_phone, checkin_sms_enabled: form.checkin_sms_enabled, checkin_time: form.checkin_time }).eq('id', patient.id)
      setMsg('✓ Saved')
    } catch (e: any) { setMsg(e.message) } finally { setSaving(false) }
  }

  async function handleTestSms() {
    if (!form.mobile_phone) return
    setSaving(true); setMsg('')
    try { await sendTestSMS(form.mobile_phone); setMsg('✓ Test SMS sent') }
    catch (e: any) { setMsg(e.message) } finally { setSaving(false) }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHeader>Check-in Settings</CardHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" checked={form.checkin_sms_enabled} onChange={e => setForm(f => ({ ...f, checkin_sms_enabled: e.target.checked }))} style={{ width: 18, height: 18 }} />
          <span style={{ fontFamily: F.body, fontSize: 14, color: T.text }}>SMS check-ins enabled</span>
        </label>
        <Field label="Mobile Phone" type="tel" value={form.mobile_phone} onChange={v => setForm(f => ({ ...f, mobile_phone: v }))} placeholder="+1 555 000 0000" />
        <Field label="Preferred Check-in Time" type="time" value={form.checkin_time} onChange={v => setForm(f => ({ ...f, checkin_time: v }))} />
        <div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Check-in Link Preview</div>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: T.teal, background: T.s3, borderRadius: 6, padding: '8px 12px', wordBreak: 'break-all' }}>{checkinUrl}</div>
        </div>
        {msg && <div style={{ fontFamily: F.mono, fontSize: 12, color: msg.startsWith('✓') ? T.green : T.red }}>{msg}</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Btn onClick={handleSave} disabled={saving} style={{ fontSize: 13 }}>{saving ? <Spin /> : 'Save Settings'}</Btn>
          <Btn variant="ghost" onClick={handleTestSms} disabled={saving || !form.mobile_phone} style={{ fontSize: 13 }}>Send Test SMS</Btn>
        </div>
        <ComingSoon title="Voice Check-in" icon="🎙" description="Automated phone call check-ins for patients without smartphones." />
      </div>
    </Card>
  )
}

// ── Chatbot Modal ─────────────────────────────────────────────

type ChatMsg = { role: 'user' | 'assistant'; content: string }

const QS = [
  { key: 'weight',      prompt: "What is your weight today in pounds?",                                              type: 'number' },
  { key: 'heart_rate',  prompt: "What is your resting heart rate in bpm?",                                           type: 'number' },
  { key: 'breathless',  prompt: "On a scale of 0–10, how breathless do you feel? (0 = none, 10 = very severe)",      type: 'scale'  },
  { key: 'swelling',    prompt: "On a scale of 0–10, how much swelling in your legs or ankles?",                     type: 'scale'  },
  { key: 'medications', prompt: "Did you take all your medications today?",                                           type: 'yesno'  },
  { key: 'notes',       prompt: "Any notes for your care team? (Type something or press Skip)",                      type: 'text'   },
]

function ChatbotModal({ patient, onClose }: { patient: any; onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([{ role: 'assistant', content: QS[0].prompt }])
  const [step, setStep] = useState(0)
  const [input, setInput] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function parseNum(s: string) { const n = parseFloat(s.replace(/[^\d.]/g, '')); return isNaN(n) ? null : n }
  function parseBool(s: string) { return /yes|yeah|y|took|did/i.test(s) ? true : /no|nope|n|didn't|missed/i.test(s) ? false : null }

  async function handleSend(override?: string) {
    const text = (override ?? input).trim(); if (!text) return
    setInput('')
    setMessages(m => [...m, { role: 'user', content: text }])
    setBusy(true)
    const q = QS[step]; const ans = { ...answers }
    if (q.key === 'weight')      ans.weight_lbs = parseNum(text)
    if (q.key === 'heart_rate')  ans.heart_rate = parseNum(text)
    if (q.key === 'breathless')  ans.breathlessness_score = Math.min(10, Math.max(0, parseNum(text) ?? 0))
    if (q.key === 'swelling')    ans.swelling_score = Math.min(10, Math.max(0, parseNum(text) ?? 0))
    if (q.key === 'medications') ans.medications_taken = parseBool(text)
    if (q.key === 'notes')       ans.patient_notes = text === 'skip' ? null : text
    setAnswers(ans)
    const next = step + 1
    if (next < QS.length) {
      let reply = QS[next].prompt
      try {
        const url = import.meta.env.VITE_ANTHROPIC_PROXY_URL
        if (url) { const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system: `You are a compassionate cardiac care assistant checking in with ${patient.first_name}, a heart failure patient. Be warm and brief.`, userMessage: text, nextQuestion: QS[next].prompt }) }); if (r.ok) { const d = await r.json(); if (d.reply) reply = d.reply } }
      } catch { /* use default */ }
      setMessages(m => [...m, { role: 'assistant', content: reply }])
      setStep(next); setBusy(false)
    } else {
      try {
        await submitCheckin(ans, [...messages, { role: 'user', content: text }])
        setMessages(m => [...m, { role: 'assistant', content: "Thank you! Your check-in is recorded. Take care 💙" }])
        setDone(true)
      } catch (e: any) { setError(e.message) }
      setBusy(false)
    }
  }

  async function submitCheckin(ans: Record<string, any>, allMsgs: ChatMsg[]) {
    const session = await createChatbotSession(patient.id)
    for (const [i, msg] of allMsgs.entries()) await saveChatbotMessage({ session_id: session.id, role: msg.role, content: msg.content, sequence_num: i })
    const checkin = await createCheckin({ patient_id: patient.id, checkin_date: new Date().toISOString().slice(0, 10), weight_lbs: ans.weight_lbs, heart_rate: ans.heart_rate, breathlessness_score: ans.breathlessness_score, swelling_score: ans.swelling_score, medications_taken: ans.medications_taken, patient_notes: ans.patient_notes })
    await completeSession(session.id, checkin.id)
    if ((ans.breathlessness_score ?? 0) >= 7) await createAlert({ patient_id: patient.id, alert_type: 'high_breathlessness', description: `Breathlessness ${ans.breathlessness_score}/10 ≥ threshold 7`, severity: ans.breathlessness_score >= 9 ? 'critical' : 'high', threshold_value: '7' })
    if ((ans.swelling_score ?? 0) >= 7) await createAlert({ patient_id: patient.id, alert_type: 'high_swelling', description: `Swelling ${ans.swelling_score}/10 ≥ threshold 7`, severity: ans.swelling_score >= 9 ? 'critical' : 'high', threshold_value: '7' })
    const recent = await getPatientCheckins(patient.id, 3)
    if (recent.length >= 2 && ans.weight_lbs) {
      const prev = (recent as any[]).find((c: any) => c.checkin_date !== new Date().toISOString().slice(0, 10))
      if (prev?.weight_lbs) { const g = ans.weight_lbs - Number(prev.weight_lbs); if (g >= 2) await createAlert({ patient_id: patient.id, alert_type: 'rapid_weight_gain', description: `Weight +${g.toFixed(1)} lbs since ${prev.checkin_date}`, severity: g >= 5 ? 'critical' : 'high', threshold_value: '2' }) }
    }
  }

  const currentQ = QS[step]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', boxShadow: '0 -24px 64px rgba(0,0,0,0.6)', animation: 'slideUp 0.3s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, color: T.text }}>Daily Check-in</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{patient.first_name} {patient.last_name}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{step + 1}/{QS.length}</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.mid, cursor: 'pointer', fontSize: 22, padding: 4, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Progress */}
        <div style={{ height: 2, background: T.dim }}>
          <div style={{ height: '100%', background: T.teal, width: `${((step) / QS.length) * 100}%`, transition: 'width 0.3s' }} />
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ maxWidth: '82%', padding: '10px 14px', borderRadius: 14, background: m.role === 'user' ? T.teal : T.s2, color: m.role === 'user' ? '#000' : T.text, fontFamily: F.body, fontSize: 15, lineHeight: 1.5, borderBottomRightRadius: m.role === 'user' ? 4 : 14, borderBottomLeftRadius: m.role === 'assistant' ? 4 : 14 }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: T.mid, fontFamily: F.body, fontSize: 13 }}><Spin /> Thinking…</div>}
          {error && <div style={{ color: T.red, fontSize: 13, fontFamily: F.body }}>{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {!done ? (
          <div style={{ padding: '12px 16px', borderTop: `1px solid ${T.border}`, paddingBottom: `calc(12px + env(safe-area-inset-bottom, 0px))` }}>
            {currentQ?.type === 'yesno' ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <Btn onClick={() => handleSend('Yes')} full>Yes</Btn>
                <Btn variant="ghost" onClick={() => handleSend('No')} full>No</Btn>
              </div>
            ) : currentQ?.type === 'scale' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {Array.from({ length: 11 }, (_, i) => (
                  <Btn key={i} variant="ghost" onClick={() => handleSend(String(i))} style={{ padding: '10px 4px', minHeight: 44, fontSize: 15 }}>{i}</Btn>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder={currentQ?.key === 'notes' ? 'Notes or "skip"…' : 'Your answer…'}
                  style={{ flex: 1, background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 15, padding: '10px 14px', outline: 'none', minHeight: 44 }} />
                <Btn onClick={() => handleSend()} disabled={busy || !input.trim()} style={{ minWidth: 70 }}>Send</Btn>
                {currentQ?.key === 'notes' && <Btn variant="ghost" onClick={() => handleSend('skip')}>Skip</Btn>}
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '16px', borderTop: `1px solid ${T.border}`, paddingBottom: `calc(16px + env(safe-area-inset-bottom, 0px))` }}>
            <Btn onClick={onClose} full>Close</Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Billing Dashboard ─────────────────────────────────────────

function BillingDashboard() {
  const today = new Date()
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [period, setPeriod] = useState(defaultPeriod)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logForm, setLogForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const { data: summary, loading, refresh } = useAsync(() => getMonthlyBillingSummary(period), [period])

  const rows = summary ?? []
  const billable = rows.filter((r: any) => r.cpt99454Met).length
  const totalRev = rows.reduce((s: number, r: any) => s + r.estimatedReimbursement, 0)
  const avgCompliance = rows.length ? Math.round(rows.reduce((s: number, r: any) => s + (r.checkinDays / 30) * 100, 0) / rows.length) : 0

  async function handleExport() {
    const csv = await exportBillingCSV(period)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `billing-${period}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  async function handleLogTime(patientId: string) {
    setSaving(true)
    try {
      const f = logForm[patientId] ?? {}
      await logRpmTime({ patientId, logDate: f.date || today.toISOString().slice(0, 10), durationMinutes: Number(f.duration || 0), activityType: f.activityType || 'Chart Review', notes: f.notes })
      setExpandedId(null); refresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  function updateLogForm(pid: string, field: string, val: string) {
    setLogForm((prev: any) => ({ ...prev, [pid]: { ...(prev[pid] ?? {}), [field]: val } }))
  }

  function checkinBadge(days: number) {
    if (days >= 16) return <Tag type="green">✓ {days}</Tag>
    if (days >= 12) return <Tag type="amber">{days}</Tag>
    return <Tag type="red">✗ {days}</Tag>
  }

  if (!FEATURES.BILLING_DASHBOARD) return <ComingSoon title="Billing Dashboard" icon="$" description="Track RPM billing metrics, CPT code thresholds, and estimated reimbursements." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          style={{ background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '8px 12px', minHeight: 40 }} />
        <Btn variant="ghost" onClick={handleExport} style={{ fontSize: 13 }}>Export CSV</Btn>
      </div>

      {/* KPI tiles */}
      <div className="grid-4">
        {[
          { label: 'Enrolled in RPM', value: rows.length, color: T.teal },
          { label: 'Billable This Month', value: billable, color: T.green },
          { label: 'Est. Monthly Revenue', value: `$${totalRev.toLocaleString()}`, color: T.teal },
          { label: 'Avg Compliance', value: `${avgCompliance}%`, color: T.amber },
        ].map(k => (
          <Card key={k.label}><div style={{ padding: 16 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontFamily: F.display, fontSize: 28, color: k.color }}>{k.value}</div>
          </div></Card>
        ))}
      </div>

      {/* Patient table */}
      <Card>
        <CardHeader>Per-Patient Billing — {period}</CardHeader>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : rows.length === 0 ? <Empty msg="No patients" /> :
          rows.map((r: any) => (
            <div key={r.patientId}>
              <div onClick={() => setExpandedId(expandedId === r.patientId ? null : r.patientId)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', flexWrap: 'wrap' }}
                onMouseEnter={e => (e.currentTarget.style.background = T.s3)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{r.firstName} {r.lastName}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{r.mrn}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {checkinBadge(r.checkinDays)}
                  {r.cpt99457Met ? <Tag type="green">99457 ✓</Tag> : <Tag>99457</Tag>}
                  {r.cpt99458Count > 0 && <Tag type="teal">99458×{r.cpt99458Count}</Tag>}
                  <span style={{ fontFamily: F.mono, fontSize: 12, color: T.green }}>${r.estimatedReimbursement}</span>
                </div>
              </div>
              {expandedId === r.patientId && (
                <div style={{ background: T.s3, padding: 16, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, marginBottom: 12, textTransform: 'uppercase' }}>Log RPM Time</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    <Field label="Date" type="date" value={logForm[r.patientId]?.date ?? today.toISOString().slice(0, 10)} onChange={v => updateLogForm(r.patientId, 'date', v)} />
                    <Field label="Duration (min)" type="number" value={logForm[r.patientId]?.duration ?? ''} onChange={v => updateLogForm(r.patientId, 'duration', v)} />
                    <SelectField label="Activity" value={logForm[r.patientId]?.activityType ?? 'Chart Review'} onChange={v => updateLogForm(r.patientId, 'activityType', v)}
                      options={['Chart Review', 'Patient Communication', 'Care Plan Update', 'Specialist Coordination']} />
                    <Field label="Notes" value={logForm[r.patientId]?.notes ?? ''} onChange={v => updateLogForm(r.patientId, 'notes', v)} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Btn onClick={() => handleLogTime(r.patientId)} disabled={saving} style={{ fontSize: 13 }}>{saving ? <Spin /> : 'Save Time Log'}</Btn>
                  </div>
                </div>
              )}
            </div>
          ))
        }
      </Card>

      {/* Coming soon */}
      <div className="grid-2">
        <ComingSoon title="PDF Report Generation" icon="📄" description="Generate printable monthly billing reports for each patient." />
        <ComingSoon title="EHR Billing Export" icon="🏥" description="Export billing data directly to your EHR or billing system." />
      </div>
    </div>
  )
}

// ── Care Programs Panel ───────────────────────────────────────

function CareProgramsPanel() {
  const [tab, setTab] = useState<'ccm' | 'tcm'>('ccm')
  const today = new Date().toISOString().slice(0, 10)
  const period = `${today.slice(0, 7)}`

  if (!FEATURES.CARE_PROGRAMS) return <ComingSoon title="Care Programs" icon="♥" description="Manage CCM and TCM programs for your enrolled patients." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 2, background: T.s2, borderRadius: 8, padding: 3, alignSelf: 'flex-start', border: `1px solid ${T.border}` }}>
        {(['ccm', 'tcm'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', fontFamily: F.body, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t ? T.teal : 'transparent', color: tab === t ? '#000' : T.mid, minHeight: 36 }}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
      {tab === 'ccm' ? <CCMTab period={period} /> : <TCMTab today={today} />}
    </div>
  )
}

function CCMTab({ period }: { period: string }) {
  const { data: patients, loading } = useAsync(getPatients, [])
  const [logOpen, setLogOpen] = useState<string | null>(null)
  const [logForm, setLogForm] = useState({ date: new Date().toISOString().slice(0, 10), duration: '', activityType: 'Chart Review', notes: '' })
  const [saving, setSaving] = useState(false)
  const { data: billingData } = useAsync(() => getMonthlyBillingSummary(period), [period])

  const enrolled = (patients ?? []).filter((p: any) => p.ccm_enrolled)
  const billMap: Record<string, any> = {}
  for (const b of (billingData ?? [])) billMap[(b as any).patientId] = b

  function ccmStatus(mins: number) {
    if (mins >= 20) return { label: 'Active', type: 'green' as const }
    if (mins >= 10) return { label: 'In Progress', type: 'amber' as const }
    if (mins > 0)   return { label: 'At Risk', type: 'red' as const }
    return { label: 'Not Started', type: 'default' as const }
  }

  async function handleLogCcm(patientId: string) {
    setSaving(true)
    try {
      const db = (await import('./api/supabase')).supabase
      if (!db) throw new Error('Supabase not configured')
      await db.from('ccm_time_logs').insert({ patient_id: patientId, log_date: logForm.date, duration_minutes: Number(logForm.duration), activity_type: logForm.activityType, notes: logForm.notes || null, billing_period: period })
      setLogOpen(null)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Chronic Care Management · {enrolled.length} enrolled</div>
      <Card>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (patients ?? []).length === 0 ? <Empty msg="No patients" /> :
          (patients as any[]).map((p: any) => {
            const b = billMap[p.id]
            const rpmMins = b?.rpmMinutes ?? 0
            const st = ccmStatus(p.ccm_enrolled ? rpmMins : -1)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{p.conditions_count ?? 1} condition{(p.conditions_count ?? 1) !== 1 ? 's' : ''}</div>
                </div>
                {p.ccm_enrolled && <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{rpmMins} min</span>}
                <Tag type={p.ccm_enrolled ? st.type : 'default'}>{p.ccm_enrolled ? st.label : 'Not Enrolled'}</Tag>
                {p.ccm_enrolled
                  ? <Btn variant="ghost" onClick={() => setLogOpen(p.id)} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>Log Time</Btn>
                  : <Btn variant="ghost" style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }} onClick={async () => {
                      const db = (await import('./api/supabase')).supabase
                      if (db) await db.from('patients').update({ ccm_enrolled: true }).eq('id', p.id)
                    }}>Enroll</Btn>
                }
              </div>
            )
          })
        }
      </Card>
      {logOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>Log CCM Time</div>
            <Field label="Date" type="date" value={logForm.date} onChange={v => setLogForm(f => ({ ...f, date: v }))} />
            <Field label="Duration (min)" type="number" value={logForm.duration} onChange={v => setLogForm(f => ({ ...f, duration: v }))} />
            <SelectField label="Activity" value={logForm.activityType} onChange={v => setLogForm(f => ({ ...f, activityType: v }))} options={['Chart Review', 'Patient Communication', 'Care Plan Update', 'Specialist Coordination']} />
            <Field label="Notes" value={logForm.notes} onChange={v => setLogForm(f => ({ ...f, notes: v }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn onClick={() => handleLogCcm(logOpen)} disabled={saving} full>{saving ? <Spin /> : 'Save'}</Btn>
              <Btn variant="ghost" onClick={() => setLogOpen(null)} full>Cancel</Btn>
            </div>
          </div>
        </div>
      )}
      <div className="grid-2">
        <ComingSoon title="Care Plan Templates" icon="📋" description="Standardized CCM care plan templates for common chronic conditions." />
        <ComingSoon title="CCM Billing Codes (99490/99491)" icon="💰" description="Automated CCM billing code generation and submission." />
      </div>
    </div>
  )
}

function TCMTab({ today }: { today: string }) {
  const { data: episodes, loading, refresh } = useAsync(getActiveTcmEpisodes, [])
  const { data: overdueEps } = useAsync(getOverdueTcmEpisodes, [])
  const { data: patients } = useAsync(getPatients, [])
  const [newOpen, setNewOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState<string | null>(null)
  const [newForm, setNewForm] = useState({ patientId: '', dischargeDate: today, dischargeFacility: '', diagnosis: '', complexity: 'moderate', notes: '' })
  const [contactForm, setContactForm] = useState({ contactDate: today, contactType: 'phone', reached: 'true', milestone: 'day2', notes: '' })
  const [saving, setSaving] = useState(false)

  function milestoneStatus(ep: any, m: 'day2' | 'day7') {
    const completed = ep[`${m}_completed`]
    const deadline = ep[`${m}_deadline`]
    if (completed) return { icon: '✓', color: T.green, label: 'Complete' }
    if (deadline && deadline < today) return { icon: '✗', color: T.red, label: 'Overdue' }
    return { icon: '◷', color: T.amber, label: 'Pending' }
  }

  async function handleCreateEpisode(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await createTcmEpisode({ patientId: newForm.patientId, dischargeDate: newForm.dischargeDate, dischargeFacility: newForm.dischargeFacility, diagnosis: newForm.diagnosis, complexity: newForm.complexity as 'moderate' | 'high', notes: newForm.notes })
      setNewOpen(false); refresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function handleContact(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await logTcmContact(contactOpen!, { contactDate: contactForm.contactDate, contactType: contactForm.contactType as any, reached: contactForm.reached === 'true', milestone: contactForm.milestone as any, notes: contactForm.notes })
      setContactOpen(null); refresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  const overdueCount = (overdueEps ?? []).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>
          Transitional Care · {(episodes ?? []).length} open
        </span>
        {overdueCount > 0 && <Tag type="red">{overdueCount} overdue</Tag>}
        <div style={{ marginLeft: 'auto' }}>
          <Btn onClick={() => setNewOpen(true)} style={{ fontSize: 13 }}>+ New Episode</Btn>
        </div>
      </div>

      <Card>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (episodes ?? []).length === 0 ? <Empty icon="♥" msg="No active TCM episodes" /> :
          (episodes as any[]).map((ep: any) => {
            const d2 = milestoneStatus(ep, 'day2')
            const d7 = milestoneStatus(ep, 'day7')
            return (
              <div key={ep.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{ep.patients?.first_name} {ep.patients?.last_name}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>D/C: {ep.discharge_date} · {ep.discharge_facility ?? '—'}</div>
                  </div>
                  <Tag type={ep.complexity === 'high' ? 'red' : 'amber'}>{ep.complexity}</Tag>
                </div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11 }}>Day-2: <span style={{ color: d2.color }}>{d2.icon} {ep.day2_deadline}</span></span>
                  <span style={{ fontFamily: F.mono, fontSize: 11 }}>Day-7: <span style={{ color: d7.color }}>{d7.icon} {ep.day7_deadline}</span></span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" onClick={() => setContactOpen(ep.id)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>Log Contact</Btn>
                    {!ep.day2_completed && <Btn variant="ghost" onClick={() => completeTcmMilestone(ep.id, 'day2').then(refresh)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>✓ Day-2</Btn>}
                    {!ep.day7_completed && <Btn variant="ghost" onClick={() => completeTcmMilestone(ep.id, 'day7').then(refresh)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>✓ Day-7</Btn>}
                  </div>
                </div>
              </div>
            )
          })
        }
      </Card>

      {/* New episode modal */}
      {newOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>New TCM Episode</div>
            <form onSubmit={handleCreateEpisode} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Patient</span>
                <select value={newForm.patientId} onChange={e => setNewForm(f => ({ ...f, patientId: e.target.value }))} required
                  style={{ background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '11px 14px', minHeight: 44, outline: 'none' }}>
                  <option value="">Select patient…</option>
                  {(patients ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              </label>
              <Field label="Discharge Date" type="date" value={newForm.dischargeDate} onChange={v => setNewForm(f => ({ ...f, dischargeDate: v }))} required />
              <Field label="Discharge Facility" value={newForm.dischargeFacility} onChange={v => setNewForm(f => ({ ...f, dischargeFacility: v }))} />
              <Field label="Diagnosis" value={newForm.diagnosis} onChange={v => setNewForm(f => ({ ...f, diagnosis: v }))} />
              <div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Complexity</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {[{ v: 'moderate', label: 'Moderate (99495)', desc: '≥8 days post-discharge visit' }, { v: 'high', label: 'High (99496)', desc: '≤7 days post-discharge visit' }].map(opt => (
                    <label key={opt.v} style={{ flex: 1, background: newForm.complexity === opt.v ? T.s3 : 'transparent', border: `1px solid ${newForm.complexity === opt.v ? T.teal : T.border}`, borderRadius: 8, padding: 12, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <input type="radio" name="complexity" value={opt.v} checked={newForm.complexity === opt.v} onChange={() => setNewForm(f => ({ ...f, complexity: opt.v }))} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{opt.label}</div>
                        <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{opt.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Notes" value={newForm.notes} onChange={v => setNewForm(f => ({ ...f, notes: v }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="submit" disabled={saving || !newForm.patientId} full>{saving ? <Spin /> : 'Create Episode'}</Btn>
                <Btn variant="ghost" onClick={() => setNewOpen(false)} full>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact log modal */}
      {contactOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontFamily: F.display, fontSize: 18, color: T.text }}>Log TCM Contact</div>
            <form onSubmit={handleContact} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Date" type="date" value={contactForm.contactDate} onChange={v => setContactForm(f => ({ ...f, contactDate: v }))} />
              <SelectField label="Contact Type" value={contactForm.contactType} onChange={v => setContactForm(f => ({ ...f, contactType: v }))} options={['phone', 'video', 'in-person']} />
              <SelectField label="Patient Reached" value={contactForm.reached} onChange={v => setContactForm(f => ({ ...f, reached: v }))} options={['true', 'false']} />
              <SelectField label="Milestone" value={contactForm.milestone} onChange={v => setContactForm(f => ({ ...f, milestone: v }))} options={['day2', 'day7', 'follow-up']} />
              <Field label="Notes" value={contactForm.notes} onChange={v => setContactForm(f => ({ ...f, notes: v }))} />
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Save Contact'}</Btn>
                <Btn variant="ghost" onClick={() => setContactOpen(null)} full>Cancel</Btn>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid-2">
        <ComingSoon title="TCM Billing Codes (99495/99496)" icon="💰" description="Automated TCM billing code generation and claim submission." />
        <ComingSoon title="Automated Discharge Notifications" icon="🏥" description="Receive automatic alerts when patients are discharged from connected facilities." />
      </div>
    </div>
  )
}

// ── Screening Panel ───────────────────────────────────────────

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things?',
  'Feeling down, depressed, or hopeless?',
  'Trouble falling or staying asleep, or sleeping too much?',
  'Feeling tired or having little energy?',
  'Poor appetite or overeating?',
  'Feeling bad about yourself — or that you are a failure?',
  'Trouble concentrating on things?',
  'Moving or speaking slowly, or being restless?',
  'Thoughts of being better off dead or hurting yourself?',
]
const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge?',
  'Not being able to stop or control worrying?',
  'Worrying too much about different things?',
  'Trouble relaxing?',
  'Being so restless that it\'s hard to sit still?',
  'Becoming easily annoyed or irritable?',
  'Feeling afraid as if something awful might happen?',
]
const SCORE_OPTIONS = [
  { val: 0, label: '0 — Not at all' },
  { val: 1, label: '1 — Several days' },
  { val: 2, label: '2 — More than half the days' },
  { val: 3, label: '3 — Nearly every day' },
]

function severityColor(s: string) {
  if (!s || s === 'none') return T.green
  if (s === 'mild') return T.green
  if (s === 'moderate') return T.amber
  return T.red
}

function ScreeningChatbot({ patient, screenType, onClose }: { patient: any; screenType: 'phq9' | 'gad7'; onClose: () => void }) {
  const questions = screenType === 'phq9' ? PHQ9_QUESTIONS : GAD7_QUESTIONS
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [crisis, setCrisis] = useState(false)
  const [done, setDone] = useState(false)
  const [result, setResult] = useState<{ score: number; severity: string } | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAnswer(val: number) {
    const newAnswers = [...answers, val]
    // PHQ-9 Q9 (index 8) crisis check
    if (screenType === 'phq9' && step === 8 && val >= 1) {
      setCrisis(true); return
    }
    if (step + 1 < questions.length) {
      setAnswers(newAnswers); setStep(step + 1)
    } else {
      const scored = screenType === 'phq9' ? scorePHQ9(newAnswers) : scoreGAD7(newAnswers)
      setResult(scored); setSaving(true)
      try {
        const alertGenerated = scored.score >= 10
        await createScreeningResult({ patientId: patient.id, screenType, score: scored.score, severity: scored.severity, answers: Object.fromEntries(newAnswers.map((v, i) => [String(i), v])), alertGenerated })
        if (alertGenerated) {
          await createAlert({ patient_id: patient.id, alert_type: `${screenType}_threshold`, description: `${screenType.toUpperCase()} score ${scored.score} — ${scored.severity}`, severity: scored.score >= 15 ? 'critical' : 'high', threshold_value: '10' })
        }
      } catch {} finally { setSaving(false) }
      setDone(true)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: T.s1, border: `1px solid ${T.border}`, borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 560, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', animation: 'slideUp 0.3s ease' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontFamily: F.display, fontSize: 17, color: T.text }}>{screenType.toUpperCase()} Screening</div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{patient.first_name} {patient.last_name}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            {!done && !crisis && <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid }}>{step + 1}/{questions.length}</span>}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: T.mid, cursor: 'pointer', fontSize: 22 }}>×</button>
          </div>
        </div>
        {!done && !crisis && (
          <div style={{ height: 2, background: T.dim }}>
            <div style={{ height: '100%', background: T.teal, width: `${(step / questions.length) * 100}%`, transition: 'width 0.3s' }} />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {crisis ? (
            <div style={{ background: '#3D1C1C', border: `1px solid ${T.red}`, borderRadius: 10, padding: 20 }}>
              <div style={{ color: T.red, fontFamily: F.body, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>⚠ Important</div>
              <div style={{ color: T.text, fontFamily: F.body, fontSize: 14, lineHeight: 1.7 }}>
                Thank you for sharing that. Please talk to your care provider right away or call <strong>988</strong> (Suicide &amp; Crisis Lifeline). Help is available 24/7.
              </div>
              <div style={{ marginTop: 16 }}>
                <Btn onClick={onClose} full>Close &amp; Notify Provider</Btn>
              </div>
            </div>
          ) : done && result ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, marginBottom: 8, textTransform: 'uppercase' }}>{screenType.toUpperCase()} Complete</div>
              <div style={{ fontFamily: F.display, fontSize: 52, color: severityColor(result.severity), marginBottom: 8 }}>{result.score}</div>
              <Tag type={result.severity === 'none' || result.severity === 'mild' ? 'green' : result.severity === 'moderate' ? 'amber' : 'red'}>{result.severity.replace('_', ' ')}</Tag>
              {saving && <div style={{ marginTop: 12, color: T.mid, fontSize: 13 }}><Spin /> Saving…</div>}
              {result.score >= 10 && <div style={{ marginTop: 16, background: '#3D2A1C', border: `1px solid ${T.amber}`, borderRadius: 8, padding: 12, fontSize: 13, color: T.amber }}>Alert generated — care team notified</div>}
              <div style={{ marginTop: 20 }}><Btn onClick={onClose} full>Done</Btn></div>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: F.body, fontSize: 16, color: T.text, lineHeight: 1.6 }}>
                Over the <strong>last 2 weeks</strong>, how often have you been bothered by…<br />
                <span style={{ color: T.teal }}>{questions[step]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {SCORE_OPTIONS.map(opt => (
                  <button key={opt.val} onClick={() => handleAnswer(opt.val)}
                    style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 16px', color: T.text, fontFamily: F.body, fontSize: 14, cursor: 'pointer', textAlign: 'left', minHeight: 44, transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = T.s3)}
                    onMouseLeave={e => (e.currentTarget.style.background = T.s2)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ScreeningPanel() {
  const { data: patients } = useAsync(getPatients, [])
  const { data: needsScreening, loading: nL } = useAsync(getPatientsNeedingScreening, [])
  const [screenTarget, setScreenTarget] = useState<{ patient: any; type: 'phq9' | 'gad7' } | null>(null)
  const { data: allScreenings, loading: sL } = useAsync(async () => {
    if (!patients?.length) return []
    const results = await Promise.all((patients as any[]).map(async (p: any) => {
      const { data } = await (await import('./api/supabase')).supabase!.from('screening_results').select('*').eq('patient_id', p.id).order('administered_at', { ascending: false }).limit(5)
      return (data ?? []).map((r: any) => ({ ...r, patientName: `${p.first_name} ${p.last_name}`, mrn: p.mrn }))
    }))
    return results.flat().sort((a: any, b: any) => new Date(b.administered_at).getTime() - new Date(a.administered_at).getTime())
  }, [patients])

  if (!FEATURES.BHI_SCREENING) return <ComingSoon title="Behavioral Health Screening" icon="🧠" description="PHQ-9 and GAD-7 screening tools for behavioral health integration." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {screenTarget && <ScreeningChatbot patient={screenTarget.patient} screenType={screenTarget.type} onClose={() => setScreenTarget(null)} />}

      <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>
        {(needsScreening ?? []).length} patients due for screening
      </div>

      {/* Screening queue */}
      {(needsScreening ?? []).length > 0 && (
        <Card>
          <CardHeader>Screening Queue</CardHeader>
          {nL ? <div style={{ padding: 20 }}><Spin /></div> :
            (needsScreening as any[]).map((p: any) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{p.mrn}</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Btn variant="ghost" onClick={() => setScreenTarget({ patient: p, type: 'phq9' })} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>PHQ-9</Btn>
                  <Btn variant="ghost" onClick={() => setScreenTarget({ patient: p, type: 'gad7' })} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>GAD-7</Btn>
                </div>
              </div>
            ))
          }
        </Card>
      )}

      {/* Recent screenings */}
      <Card>
        <CardHeader>Recent Screenings</CardHeader>
        {sL ? <div style={{ padding: 20 }}><Spin /></div> : (allScreenings ?? []).length === 0 ? <Empty icon="🧠" msg="No screenings recorded" /> :
          (allScreenings as any[]).slice(0, 20).map((s: any) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{s.patientName}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{s.mrn} · {new Date(s.administered_at).toLocaleDateString()}</div>
              </div>
              <Tag>{s.screen_type.toUpperCase()}</Tag>
              <span style={{ fontFamily: F.display, fontSize: 18, color: severityColor(s.severity) }}>{s.score}</span>
              <Tag type={s.severity === 'none' || s.severity === 'mild' ? 'green' : s.severity === 'moderate' ? 'amber' : 'red'}>{s.severity?.replace('_', ' ')}</Tag>
              {s.alert_generated && <span title="Alert generated" style={{ color: T.red }}>⚠</span>}
            </div>
          ))
        }
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
        <ComingSoon title="BHI Care Plan Integration" icon="📋" description="Link screening results to behavioral health care plans." />
        <ComingSoon title="Crisis Protocol Workflow" icon="🚨" description="Automated crisis escalation and follow-up workflows." />
        <ComingSoon title="BHI Billing (CPT 99484)" icon="💰" description="Behavioral health integration billing code generation." />
      </div>
    </div>
  )
}

// ── Medications Section (for PatientMonitor) ──────────────────

function MedicationsSection({ patient }: { patient: any }) {
  const { data: meds, loading, refresh } = useAsync(() => getPatientMedications(patient.id), [patient.id])
  const { data: adherence } = useAsync(() => getMedicationAdherence(patient.id, 30), [patient.id])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', dosage: '', frequency: 'Once daily', instructions: '' })
  const [saving, setSaving] = useState(false)

  const adherenceMap: Record<string, any> = {}
  for (const a of (adherence ?? [])) adherenceMap[(a as any).medicationId] = a

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try {
      await addMedication({ patient_id: patient.id, name: form.name, dosage: form.dosage, frequency: form.frequency, instructions: form.instructions })
      setAddOpen(false); setForm({ name: '', dosage: '', frequency: 'Once daily', instructions: '' }); refresh()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  if (!FEATURES.MED_TRACKING) return <ComingSoon title="Medication Management" icon="💊" description="Track patient medications and adherence rates." />

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Medications</span>
        <Btn variant="ghost" onClick={() => setAddOpen(true)} style={{ fontSize: 12, padding: '5px 10px', minHeight: 34 }}>+ Add</Btn>
      </div>
      {loading ? <div style={{ padding: 16 }}><Spin /></div> : (meds ?? []).length === 0 ? <Empty icon="💊" msg="No medications listed" /> :
        (meds as any[]).map((m: any) => {
          const adh = adherenceMap[m.id]
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{m.name}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{m.dosage} · {m.frequency}</div>
              </div>
              {adh?.adherencePct !== null && adh?.adherencePct !== undefined && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11, color: adh.adherencePct >= 80 ? T.green : adh.adherencePct >= 60 ? T.amber : T.red }}>{adh.adherencePct}%</span>
                  <div style={{ width: 60, height: 4, background: T.dim, borderRadius: 2 }}>
                    <div style={{ width: `${adh.adherencePct}%`, height: '100%', background: adh.adherencePct >= 80 ? T.green : adh.adherencePct >= 60 ? T.amber : T.red, borderRadius: 2 }} />
                  </div>
                </div>
              )}
              <Btn variant="ghost" onClick={() => deactivateMedication(m.id).then(refresh)} style={{ fontSize: 11, padding: '4px 8px', minHeight: 30, color: T.mid }}>Remove</Btn>
            </div>
          )
        })
      }
      {addOpen && (
        <div style={{ padding: 16, background: T.s3, borderTop: `1px solid ${T.border}` }}>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required />
              <Field label="Dosage" value={form.dosage} onChange={v => setForm(f => ({ ...f, dosage: v }))} placeholder="e.g. 10mg" />
            </div>
            <SelectField label="Frequency" value={form.frequency} onChange={v => setForm(f => ({ ...f, frequency: v }))}
              options={['Once daily', 'Twice daily', 'Three times daily', 'As needed', 'Weekly']} />
            <Field label="Instructions" value={form.instructions} onChange={v => setForm(f => ({ ...f, instructions: v }))} />
            <div style={{ display: 'flex', gap: 8 }}>
              <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Save'}</Btn>
              <Btn variant="ghost" onClick={() => setAddOpen(false)} full>Cancel</Btn>
            </div>
          </form>
        </div>
      )}
      <div style={{ padding: '10px 16px' }}>
        <ComingSoon title="Medication Interaction Checker" icon="⚗" description="Automatically check for known drug-drug interactions." />
      </div>
    </Card>
  )
}

// ── Patients list ─────────────────────────────────────────────

function PatientsList({ onSelectPatient }: { onSelectPatient: (id: string) => void }) {
  const { data: patients, loading } = useAsync(getPatients, [])
  const sorted = patients ? [...patients].sort((a, b) => riskOrder(a.risk_level) - riskOrder(b.risk_level)) : []
  return (
    <Card>
      <CardHeader>All Patients ({sorted.length})</CardHeader>
      {loading ? <div style={{ padding: 20 }}><Spin /></div> : sorted.length === 0 ? <Empty msg="No patients" /> :
        sorted.map((p: any) => (
          <div key={p.id} onClick={() => onSelectPatient(p.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', minHeight: 56 }}
            onMouseEnter={e => (e.currentTarget.style.background = T.s3)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.body, color: T.text, fontSize: 14, fontWeight: 500 }}>{p.first_name} {p.last_name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.mrn} · {p.condition}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>{p.provider_name}</div>
            </div>
            <Tag type={riskTag(p.risk_level)}>{p.risk_level}</Tag>
            <span style={{ color: T.mid, fontSize: 20 }}>›</span>
          </div>
        ))
      }
    </Card>
  )
}

// ── Alerts panel ──────────────────────────────────────────────

function alertIcon(type: string) {
  if (type.includes('missed_checkin') || type.includes('no_checkin')) return '📵'
  if (type.includes('medication') || type.includes('med')) return '💊'
  if (type.includes('tcm') || type.includes('discharge')) return '🏥'
  if (type.includes('phq') || type.includes('gad') || type.includes('screening') || type.includes('bhi')) return '🧠'
  return '⚠'
}

function AlertsPanel() {
  const { data: alerts, loading, error, refresh } = useAsync(getOpenAlerts, [])
  useEffect(() => { const t = setInterval(refresh, 60000); return () => clearInterval(t) }, [refresh])
  async function handleAck(id: string) { await acknowledgeAlert(id); refresh() }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>{(alerts ?? []).length} Open</span>
        <Btn variant="ghost" onClick={refresh} style={{ fontSize: 12, padding: '6px 12px', minHeight: 36 }}>Refresh</Btn>
      </div>
      {error && <div style={{ color: T.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <Card>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (alerts ?? []).length === 0 ? <Empty icon="✓" msg="No open alerts" /> :
          (alerts as any[]).map((a) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, padding: '14px 16px', borderBottom: `1px solid ${T.border}`, alignItems: 'flex-start' }}>
              <SevBar severity={a.severity} />
              <div style={{ fontSize: 18, flexShrink: 0, marginTop: 2 }}>{alertIcon(a.alert_type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{a.patients?.first_name} {a.patients?.last_name}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{a.patients?.mrn}</span>
                  <Tag type={a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'amber' : 'default'}>{a.severity}</Tag>
                </div>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.mid }}>{a.alert_type.replace(/_/g, ' ')} — {a.description}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.dim, marginTop: 4 }}>{timeAgo(a.created_at)}</div>
              </div>
              <Btn variant="ghost" onClick={() => handleAck(a.id)} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36, flexShrink: 0 }}>Ack</Btn>
            </div>
          ))
        }
      </Card>
    </div>
  )
}

// ── Backlog ───────────────────────────────────────────────────

function BacklogPanel() {
  const { data: stories, loading: sL, error: sE, refresh: sR } = useAsync(getStories, [])
  const { data: sprints, loading: spL, refresh: spR } = useAsync(getSprints, [])
  const [sf, setSf] = useState({ Name: '', Priority: 'Medium', 'Story Points': '3', Sprint: '' })
  const [pf, setPf] = useState({ Name: '', 'Target Date': '', Notes: '' })
  const [saving, setSaving] = useState(false)
  const [postId, setPostId] = useState<string|null>(null)

  async function addStory(e: React.FormEvent) { e.preventDefault(); setSaving(true); try { await createStory({ ...sf, 'Story Points': Number(sf['Story Points']) }); sR(); setSf({ Name: '', Priority: 'Medium', 'Story Points': '3', Sprint: '' }) } catch (e: any) { alert(e.message) } finally { setSaving(false) } }
  async function addSprint(e: React.FormEvent) { e.preventDefault(); setSaving(true); try { await createSprint(pf); spR(); setPf({ Name: '', 'Target Date': '', Notes: '' }) } catch (e: any) { alert(e.message) } finally { setSaving(false) } }
  async function postSprint(sp: any) { setPostId(sp.id); try { await postMessage(import.meta.env.VITE_SLACK_CHANNEL_ID, `*Sprint: ${sp.Name}*\nTarget: ${sp['Target Date']??'—'}\nServer: ${sp['Server Points']??0} pts | Client: ${sp['Client Points']??0} pts\n${sp.Notes??''}`) } catch(e: any) { alert(e.message) } finally { setPostId(null) } }

  const grouped: Record<string, any[]> = {}
  for (const s of (stories ?? [])) { const sp = s.Sprint ?? 'Unassigned'; grouped[sp] = grouped[sp] ?? []; grouped[sp].push(s) }

  return (
    <div className="grid-sidebar">
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>User Stories</div>
        {sE && <div style={{ color: T.red, marginBottom: 8, fontSize: 13 }}>Airtable: {sE}</div>}
        {sL ? <Spin /> : Object.entries(grouped).map(([sp, items]) => (
          <div key={sp} style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: F.display, fontSize: 16, color: T.text, marginBottom: 8 }}>{sp}</div>
            <Card>
              {items.map((s: any) => (
                <div key={s.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${T.border}`, alignItems: 'center' }}>
                  <div style={{ flex: 1, fontFamily: F.body, fontSize: 13, color: T.text }}>{s.Name}</div>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid }}>{s.Priority}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: T.teal }}>{s['Story Points']}pt</span>
                  <Tag>{s.Status ?? 'Backlog'}</Tag>
                </div>
              ))}
            </Card>
          </div>
        ))}
        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, margin: '20px 0 12px' }}>Sprints</div>
        {spL ? <Spin /> : (sprints ?? []).map((sp: any) => (
          <div key={sp.id} style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{sp.Name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginTop: 2 }}>Target: {sp['Target Date']??'—'} · Srv: {sp['Server Points']??0} · Cli: {sp['Client Points']??0}</div>
            </div>
            <Btn variant="ghost" onClick={() => postSprint(sp)} disabled={postId === sp.id} style={{ fontSize: 12, minHeight: 36 }}>{postId === sp.id ? <Spin /> : 'Slack'}</Btn>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card>
          <CardHeader>New Story</CardHeader>
          <div style={{ padding: 16 }}>
            <form onSubmit={addStory} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Title" value={sf.Name} onChange={v => setSf(f=>({...f,Name:v}))} required />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Priority</span>
                <select value={sf.Priority} onChange={e => setSf(f=>({...f,Priority:e.target.value}))} style={{ background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '11px 14px', minHeight: 44 }}>
                  {['High','Medium','Low'].map(p => <option key={p}>{p}</option>)}
                </select>
              </label>
              <Field label="Story Points" type="number" value={sf['Story Points']} onChange={v => setSf(f=>({...f,'Story Points':v}))} />
              <Field label="Sprint" value={sf.Sprint} onChange={v => setSf(f=>({...f,Sprint:v}))} />
              <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Add Story'}</Btn>
            </form>
          </div>
        </Card>
        <Card>
          <CardHeader>New Sprint</CardHeader>
          <div style={{ padding: 16 }}>
            <form onSubmit={addSprint} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Field label="Sprint Name" value={pf.Name} onChange={v => setPf(f=>({...f,Name:v}))} required />
              <Field label="Target Date" type="date" value={pf['Target Date']} onChange={v => setPf(f=>({...f,'Target Date':v}))} />
              <Field label="Notes" value={pf.Notes} onChange={v => setPf(f=>({...f,Notes:v}))} />
              <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Create Sprint'}</Btn>
            </form>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Calendar ──────────────────────────────────────────────────

function CalendarPanel() {
  const [ready, setReady] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', date: '', time: '', duration: '60', description: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setInterval(() => { if ((window as any).gapi?.load) { clearInterval(t); initGoogleCalendar().then(() => { setReady(true); setSignedIn(isSignedIn()) }).catch(() => {}) } }, 500)
    return () => clearInterval(t)
  }, [])

  async function handleSignIn() { try { await signInGoogle(); setSignedIn(true); load() } catch (e: any) { setError(e.message) } }
  async function load() { setLoading(true); try { setEvents(await getUpcomingEvents(10)) } catch (e: any) { setError(e.message) } finally { setLoading(false) } }
  useEffect(() => { if (signedIn) load() }, [signedIn])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    try { const s = new Date(`${form.date}T${form.time}`); await createEvent({ title: form.title, startDateTime: s.toISOString(), endDateTime: new Date(s.getTime() + Number(form.duration)*60000).toISOString(), description: form.description }); setForm({ title:'',date:'',time:'',duration:'60',description:'' }); load() }
    catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  if (!ready) return <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: T.mid }}><Spin /> Loading Google Calendar…</div>
  if (!signedIn) return (
    <div style={{ background: T.s2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 40, textAlign: 'center' }}>
      <div style={{ fontFamily: F.display, fontSize: 22, color: T.text, marginBottom: 8 }}>Google Calendar</div>
      <div style={{ color: T.mid, marginBottom: 24 }}>Connect to view and schedule appointments</div>
      {error && <div style={{ color: T.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <Btn onClick={handleSignIn}>Connect Google Calendar</Btn>
    </div>
  )

  return (
    <div className="grid-sidebar">
      <div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Upcoming Events</div>
        {error && <div style={{ color: T.red, marginBottom: 8, fontSize: 13 }}>{error}</div>}
        <Card>
          {loading ? <div style={{ padding: 20 }}><Spin /></div> : events.length === 0 ? <Empty msg="No upcoming events" /> :
            events.map(ev => { const dt = ev.start.dateTime || ev.start.date; return (
              <div key={ev.id} style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{ev.summary}</div>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, marginTop: 2 }}>{new Date(dt).toLocaleString()}</div>
              </div>
            )})
          }
        </Card>
      </div>
      <Card>
        <CardHeader>New Appointment</CardHeader>
        <div style={{ padding: 16 }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Title" value={form.title} onChange={v => setForm(f=>({...f,title:v}))} required />
            <Field label="Date" type="date" value={form.date} onChange={v => setForm(f=>({...f,date:v}))} required />
            <Field label="Time" type="time" value={form.time} onChange={v => setForm(f=>({...f,time:v}))} required />
            <Field label="Duration (min)" type="number" value={form.duration} onChange={v => setForm(f=>({...f,duration:v}))} />
            <Field label="Description" value={form.description} onChange={v => setForm(f=>({...f,description:v}))} />
            <Btn type="submit" disabled={saving} full>{saving ? <Spin /> : 'Create Event'}</Btn>
          </form>
        </div>
      </Card>
    </div>
  )
}

// ── Slack ─────────────────────────────────────────────────────

function SlackPanel() {
  const ch = import.meta.env.VITE_SLACK_CHANNEL_ID as string
  const { data: messages, loading, error, refresh } = useAsync(() => getChannelMessages(ch), [ch])
  const [text, setText] = useState(''); const [sending, setSending] = useState(false); const [sendErr, setSendErr] = useState('')

  async function handleSend(e: React.FormEvent) { e.preventDefault(); setSending(true); setSendErr(''); try { await postMessage(ch, text); setText(''); refresh() } catch(e: any) { setSendErr(e.message) } finally { setSending(false) } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {error && <div style={{ color: T.red, fontSize: 13 }}>Slack: {error}</div>}
      <Card>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: T.mid, textTransform: 'uppercase', letterSpacing: 1 }}>Channel Messages</span>
          <Btn variant="ghost" onClick={refresh} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36 }}>Refresh</Btn>
        </div>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (messages ?? []).length === 0 ? <Empty msg="No messages" /> :
          (messages as any[]).map((m, i) => (
            <div key={i} style={{ padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.teal }}>{m.user ?? 'bot'}</span>
                <span style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>{new Date(Number(m.ts)*1000).toLocaleString()}</span>
              </div>
              <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, whiteSpace: 'pre-wrap' }}>{m.text}</div>
            </div>
          ))
        }
      </Card>
      <Card>
        <CardHeader>Send Message</CardHeader>
        <div style={{ padding: 16 }}>
          {sendErr && <div style={{ color: T.red, fontSize: 13, marginBottom: 8 }}>{sendErr}</div>}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: 8 }}>
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" style={{ flex: 1, background: T.s3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 15, padding: '10px 14px', outline: 'none', minHeight: 44 }} />
            <Btn type="submit" disabled={sending || !text.trim()} style={{ minWidth: 70 }}>{sending ? <Spin /> : 'Send'}</Btn>
          </form>
        </div>
      </Card>
    </div>
  )
}

// ── Setup ─────────────────────────────────────────────────────

function SetupPanel() {
  const [gcalOk, setGcalOk] = useState(false)
  useEffect(() => { setGcalOk(isSignedIn()) }, [])
  const integrations = [
    { name: 'Supabase',        ok: !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY, status: 'Database & Auth',     link: 'https://supabase.com/dashboard' },
    { name: 'Airtable',        ok: !!import.meta.env.VITE_AIRTABLE_API_KEY,                                          status: 'Product Backlog',     link: 'https://airtable.com/account' },
    { name: 'Slack',           ok: !!import.meta.env.VITE_SLACK_BOT_TOKEN,                                           status: 'Alerts & Messaging',  link: 'https://api.slack.com/apps' },
    { name: 'Google Calendar', ok: gcalOk,                                                                            status: 'Appointments',        link: 'https://console.cloud.google.com' },
    { name: 'Anthropic Proxy', ok: !!import.meta.env.VITE_ANTHROPIC_PROXY_URL,                                       status: 'AI Check-in Chatbot', link: 'https://docs.anthropic.com' },
    { name: 'Twilio',          ok: !!import.meta.env.VITE_TWILIO_ACCOUNT_SID,                                        status: 'SMS Check-ins',       link: 'https://console.twilio.com' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <CardHeader>Integration Status</CardHeader>
        {integrations.map(intg => (
          <div key={intg.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: intg.ok ? T.green : T.dim, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{intg.name}</div>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.mid, marginTop: 2 }}>{intg.status}</div>
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: intg.ok ? T.green : T.mid, whiteSpace: 'nowrap' }}>{intg.ok ? 'Connected' : 'Not set'}</div>
            <a href={intg.link} target="_blank" rel="noreferrer" style={{ fontFamily: F.mono, fontSize: 11, color: T.blue, textDecoration: 'none', whiteSpace: 'nowrap' }}>Setup →</a>
          </div>
        ))}
      </Card>
      {/* Feature flags */}
      <Card>
        <CardHeader>Feature Status</CardHeader>
        {Object.entries(FEATURES).map(([key, enabled]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: enabled ? T.green : T.dim, flexShrink: 0 }} />
            <div style={{ flex: 1, fontFamily: F.mono, fontSize: 12, color: enabled ? T.text : T.mid }}>{key.replace(/_/g, ' ')}</div>
            {enabled
              ? <Tag type="green">On</Tag>
              : <span style={{ fontFamily: F.mono, fontSize: 10, color: T.dim }}>Coming in v2.1</span>
            }
          </div>
        ))}
      </Card>

      <Card>
        <CardHeader>Quick Start</CardHeader>
        <pre style={{ fontFamily: F.mono, fontSize: 12, color: T.mid, padding: 16, margin: 0, lineHeight: 1.8, overflowX: 'auto' }}>
{`1. cp .env.example .env.local
2. Fill in VITE_SUPABASE_URL + ANON_KEY
3. Run supabase/schema.sql in SQL editor
4. Add Airtable / Slack / Google creds
5. Deploy Anthropic proxy (optional)
6. npm run dev`}
        </pre>
      </Card>
    </div>
  )
}

// ── Root ──────────────────────────────────────────────────────

type AppView = 'landing' | 'login' | 'app'

const TITLES: Record<Section, string> = {
  dashboard: 'Dashboard', patients: 'Patients', alerts: 'Alerts',
  billing: 'Billing', 'care-programs': 'Care Programs', screening: 'Screening',
  backlog: 'Backlog', calendar: 'Calendar', slack: 'Slack', setup: 'Setup',
}

export default function App() {
  const [view, setView] = useState<AppView>('landing')
  const [session, setSession] = useState<any>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [section, setSection] = useState<Section>('dashboard')
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [alertCount, setAlertCount] = useState(0)
  const [overdueTcm, setOverdueTcm] = useState(0)
  const [screeningDue, setScreeningDue] = useState(0)
  const [billingCount, setBillingCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return }
    supabase.auth.getSession().then(({ data: { session } }: any) => { setSession(session); if (session) setView('app'); setAuthLoading(false) })
    const { data: { subscription } } = onAuthChange((s: any) => { setSession(s); if (s) setView('app'); else setView('landing') })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    const poll = async () => {
      try { const a = await getOpenAlerts(); setAlertCount(a.length) } catch {}
      try { const o = await getOverdueTcmEpisodes(); setOverdueTcm(o.length) } catch {}
      try { const s = await getPatientsNeedingScreening(); setScreeningDue(s.length) } catch {}
      try {
        const period = new Date().toISOString().slice(0, 7)
        const b = await getMonthlyBillingSummary(period)
        setBillingCount(b.filter((r: any) => r.cpt99454Met).length)
      } catch {}
    }
    poll(); const t = setInterval(poll, 60000); return () => clearInterval(t)
  }, [session])

  if (authLoading) return (
    <div style={{ minHeight: '100dvh', background: T.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{GLOBAL_CSS}</style>
      <Spin size={32} />
    </div>
  )

  if (view === 'landing') return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LandingPage onSignIn={() => setView('login')} />
    </>
  )

  if (view === 'login' || !session) return (
    <>
      <style>{GLOBAL_CSS}</style>
      <LoginScreen onBack={() => setView('landing')} />
    </>
  )

  function go(s: Section) { setSection(s); setSelectedPatientId(null); setMenuOpen(false) }
  function selectPatient(id: string) { setSelectedPatientId(id); setSection('patients') }

  const pageTitle = section === 'patients' && selectedPatientId ? 'Patient' : TITLES[section]

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <Sidebar section={section} setSection={go} alertCount={alertCount} overdueTcm={overdueTcm} screeningDue={screeningDue} billingCount={billingCount} open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main-content">
        <TopBar title={pageTitle} onMenu={() => setMenuOpen(o => !o)} onSignOut={() => signOut()} />
        <main className="page">
          {section === 'dashboard'     && <Dashboard onSelectPatient={selectPatient} />}
          {section === 'patients'     && !selectedPatientId && <PatientsList onSelectPatient={selectPatient} />}
          {section === 'patients'     && selectedPatientId && <PatientMonitor patientId={selectedPatientId} onBack={() => setSelectedPatientId(null)} />}
          {section === 'alerts'       && <AlertsPanel />}
          {section === 'billing'      && <BillingDashboard />}
          {section === 'care-programs'&& <CareProgramsPanel />}
          {section === 'screening'    && <ScreeningPanel />}
          {section === 'backlog'      && <BacklogPanel />}
          {section === 'calendar'     && <CalendarPanel />}
          {section === 'slack'        && <SlackPanel />}
          {section === 'setup'        && <SetupPanel />}
        </main>
      </div>
      <BottomNav section={section} setSection={go} alertCount={alertCount} />
    </>
  )
}
