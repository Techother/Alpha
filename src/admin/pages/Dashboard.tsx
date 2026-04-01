import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getAdminStats, getAlerts } from '@/api/admin'
import type { AdminStats, AlertWithPatient } from '@/api/supabase.types'

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRelativeTime(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  if (diffMins < 1)   return 'just now'
  if (diffMins < 60)  return `${diffMins}m ago`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'yesterday'
  return `${diffDays}d ago`
}

const ALERT_LABELS: Record<string, string> = {
  weight_gain:        'Weight gain above baseline',
  abnormal_hr:        'Abnormal heart rate',
  high_breathlessness:'High breathlessness score',
  high_swelling:      'High swelling score',
  missed_medications: 'Missed medications',
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const styles: Record<string, { color: string; bg: string; label: string }> = {
    high:   { color: 'var(--color-alert-high)',   bg: 'var(--color-alert-high-bg)',   label: 'HIGH' },
    medium: { color: 'var(--color-alert-medium)', bg: 'var(--color-alert-medium-bg)', label: 'MED' },
    low:    { color: 'var(--color-alert-low)',    bg: 'var(--color-alert-low-bg)',    label: 'LOW' },
  }
  const s = styles[severity]
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-bold)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
      }}
      aria-label={`Severity: ${severity}`}
    >
      {s.label}
    </span>
  )
}

export function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats]   = useState<AdminStats | null>(null)
  const [alerts, setAlerts] = useState<AlertWithPatient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [s, a] = await Promise.all([getAdminStats(), getAlerts()])
        if (cancelled) return
        setStats(s)
        setAlerts(a)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const providerName = profile?.full_name ?? 'Doctor'
  const recentAlerts = alerts.slice(0, 5)

  const tileData = [
    { label: 'Active Patients',   value: stats?.activePatients,   accent: false },
    { label: 'Check-ins Today',   value: stats?.checkinsToday,    accent: false },
    {
      label: 'Unreviewed Alerts',
      value: stats?.unreviewedAlerts,
      accent: (stats?.unreviewedAlerts ?? 0) > 0,
    },
    { label: 'Alerts This Week',  value: stats?.alertsThisWeek,   accent: false },
  ]

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: 0 }}>
          {getGreeting()}, {providerName}
        </h1>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)' }}>
          {today}
        </p>
      </div>

      {error && (
        <p style={{ color: 'var(--color-alert-high)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          Could not load data. Try refreshing.
        </p>
      )}

      {/* Stat tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        {tileData.map(tile => (
          <div key={tile.label} style={{
            background: tile.accent ? 'var(--color-alert-high-bg)' : 'var(--color-surface)',
            border: `1px solid ${tile.accent ? 'var(--color-alert-high)' : 'var(--color-border)'}`,
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-5)',
          }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: tile.accent ? 'var(--color-alert-high)' : 'var(--color-text-muted)', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
              {tile.label.toUpperCase()}
            </div>
            {loading ? (
              <div style={{ height: 36, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', width: '60%' }} />
            ) : (
              <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)', color: tile.accent ? 'var(--color-alert-high)' : 'var(--color-text)', lineHeight: 1 }}>
                {tile.value ?? '—'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Recent alerts card */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <h2 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', margin: 0 }}>
            Recent Alerts
          </h2>
          <Link to="/admin/alerts" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-primary-light)', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: 'var(--space-4) var(--space-5)' }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ height: 40, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)' }} />
            ))}
          </div>
        ) : recentAlerts.length === 0 ? (
          <p style={{ padding: 'var(--space-5)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            No alerts today.
          </p>
        ) : (
          recentAlerts.map((alert, i) => (
            <div key={alert.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-3) var(--space-5)',
              borderBottom: i < recentAlerts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            }}>
              <SeverityBadge severity={alert.severity} />
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
              </span>
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                {alert.patientName}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                {formatRelativeTime(alert.created_at)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
