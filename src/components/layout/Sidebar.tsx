// cardiotrack/src/components/layout/Sidebar.tsx
// Extracted from App.tsx lines 341–401
// Exports Section type, NAV array, TITLES record, and Sidebar component
// Clinical white design — institutional blue replaces neon teal

import { useNavigate } from 'react-router-dom'
import { T, F } from '@/lib/tokens'

// ── Section type ─────────────────────────────────────────────

export type Section = 'dashboard' | 'patients' | 'alerts' | 'billing' |
  'care-programs' | 'screening' | 'backlog' | 'calendar' | 'slack' | 'setup'

// ── NAV array (verbatim icons from App.tsx) ───────────────────

export const NAV: { key: Section; label: string; icon: string }[] = [
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

// ── Page titles (used by TopBar) ─────────────────────────────

export const TITLES: Record<Section, string> = {
  dashboard: 'Dashboard', patients: 'Patients', alerts: 'Alerts',
  billing: 'Billing', 'care-programs': 'Care Programs', screening: 'Screening',
  backlog: 'Backlog', calendar: 'Calendar', slack: 'Slack', setup: 'Setup',
}

// ── Sidebar component ────────────────────────────────────────

export function Sidebar({ section, alertCount, overdueTcm, screeningDue, billingCount, open, onClose }: {
  section: Section
  alertCount: number
  overdueTcm: number
  screeningDue: number
  billingCount: number
  open: boolean
  onClose: () => void
}) {
  const navigate = useNavigate()

  function go(s: Section) { navigate('/' + s); onClose() }

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
          <div style={{ fontFamily: F.display, fontSize: 20, color: T.blue }}>Alpha Health Track</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginTop: 2 }}>Cardiac Monitoring · v2</div>
        </div>
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {NAV.map(n => {
            const b = badge(n.key)
            const active = section === n.key
            return (
              <button key={n.key} onClick={() => go(n.key)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '12px 18px',
                background: active ? T.blueSurface : 'transparent',
                color: active ? T.blue : T.textSec,
                fontWeight: active ? 600 : 400,
                border: 'none',
                borderLeft: `2px solid ${active ? T.blue : 'transparent'}`,
                fontFamily: F.body, fontSize: 14, cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s', minHeight: 44,
                WebkitTapHighlightColor: 'transparent',
              }}>
                <span style={{ fontSize: 17, width: 22, textAlign: 'center' }}>{n.icon}</span>
                {n.label}
                {b && (
                  <span style={{
                    marginLeft: 'auto', background: b.color, color: '#fff',
                    borderRadius: 10, fontSize: 10, fontFamily: F.mono,
                    padding: '2px 7px', fontWeight: 700,
                  }}>
                    {b.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginBottom: 6 }}>Connections</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[['DB', !!import.meta.env.VITE_SUPABASE_URL], ['AT', true], ['SL', true], ['GC', true]].map(([l, ok]) => (
              <div key={l as string} title={l as string} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: ok ? T.green : T.textTert,
              }} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
