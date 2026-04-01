import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAlerts } from '@/api/admin'
import type { AlertWithPatient } from '@/api/supabase.types'

type SeverityFilter = 'high' | 'medium' | 'low' | null

const ALERT_LABELS: Record<string, string> = {
  weight_gain:        'Weight gain above baseline',
  abnormal_hr:        'Abnormal heart rate',
  high_breathlessness:'High breathlessness score',
  high_swelling:      'High swelling score',
  missed_medications: 'Missed medications',
}

const SEVERITY_TABS: Array<{ value: SeverityFilter; label: string }> = [
  { value: null,     label: 'All' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
]

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  high:   { color: 'var(--color-alert-high)',   bg: 'var(--color-alert-high-bg)' },
  medium: { color: 'var(--color-alert-medium)', bg: 'var(--color-alert-medium-bg)' },
  low:    { color: 'var(--color-alert-low)',    bg: 'var(--color-alert-low-bg)' },
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const isToday =
    date.getDate()     === now.getDate()     &&
    date.getMonth()    === now.getMonth()    &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return 'Today ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate()     === yesterday.getDate()     &&
    date.getMonth()    === yesterday.getMonth()    &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) {
    return 'Yesterday ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
         ', ' +
         date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const SEVERITY_BADGE_LABELS: Record<'high' | 'medium' | 'low', string> = {
  high: 'HIGH',
  medium: 'MED',
  low: 'LOW',
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const s = SEVERITY_COLORS[severity]
  return (
    <span
      aria-label={`Severity: ${severity}`}
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-bold)',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
      }}
    >
      {SEVERITY_BADGE_LABELS[severity]}
    </span>
  )
}

export function Alerts() {
  const navigate = useNavigate()
  const [allAlerts, setAllAlerts]           = useState<AlertWithPatient[]>([])
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(null)
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getAlerts()
        if (!cancelled) setAllAlerts(data)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const displayed = severityFilter === null
    ? allAlerts
    : allAlerts.filter(a => a.severity === severityFilter)

  const severityCounts = useMemo(() => ({
    all:    allAlerts.length,
    high:   allAlerts.filter(a => a.severity === 'high').length,
    medium: allAlerts.filter(a => a.severity === 'medium').length,
    low:    allAlerts.filter(a => a.severity === 'low').length,
  }), [allAlerts])

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
        <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: 0 }}>
          Alerts
        </h1>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>
          Showing last 30 days
        </span>
      </div>

      {error && (
        <p role="alert" style={{ color: 'var(--color-alert-high)', marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)' }}>
          Could not load data. Try refreshing.
        </p>
      )}

      {/* Severity filter tabs */}
      <div
        role="tablist"
        aria-label="Filter by severity"
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 'var(--space-4)',
          background: 'var(--color-surface)',
          padding: 4,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          width: 'fit-content',
        }}
      >
        {SEVERITY_TABS.map(tab => {
          const isActive = severityFilter === tab.value
          const severityColor = tab.value ? SEVERITY_COLORS[tab.value].color : undefined
          return (
            <button
              key={String(tab.value)}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSeverityFilter(tab.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault()
                  const currentIdx = SEVERITY_TABS.findIndex(t => t.value === tab.value)
                  const nextIdx = e.key === 'ArrowRight'
                    ? (currentIdx + 1) % SEVERITY_TABS.length
                    : (currentIdx - 1 + SEVERITY_TABS.length) % SEVERITY_TABS.length
                  setSeverityFilter(SEVERITY_TABS[nextIdx].value)
                } else if (e.key === 'Home') {
                  e.preventDefault()
                  setSeverityFilter(SEVERITY_TABS[0].value)
                } else if (e.key === 'End') {
                  e.preventDefault()
                  setSeverityFilter(SEVERITY_TABS[SEVERITY_TABS.length - 1].value)
                }
              }}
              style={{
                padding: '5px 14px',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-medium)',
                background: isActive ? 'var(--color-text)' : 'transparent',
                color: isActive ? '#fff' : (severityColor ?? 'var(--color-text-muted)'),
                transition: 'background var(--transition-fast), color var(--transition-fast)',
              }}
            >
              {tab.label}{' '}
              <span aria-hidden="true" style={{ opacity: 0.6, fontWeight: 'var(--font-weight-normal)' }}>
                {tab.value === null ? severityCounts.all : severityCounts[tab.value]}
              </span>
            </button>
          )
        })}
      </div>

      {/* Alerts table */}
      <div style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Column headers */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '90px 1fr 180px 160px',
          gap: 'var(--space-3)',
          padding: 'var(--space-2) var(--space-4)',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-border-subtle)',
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-muted)',
          letterSpacing: '0.04em',
        }}>
          <span>SEVERITY</span>
          <span>ALERT</span>
          <span>PATIENT</span>
          <span>TIME</span>
        </div>

        {/* Loading skeletons */}
        {loading && (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{
              height: 44,
              margin: 'var(--space-1) var(--space-4)',
              background: 'var(--color-border-subtle)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: i < 5 ? 'var(--space-1)' : 'var(--space-2)',
            }} />
          ))
        )}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <p style={{ padding: 'var(--space-5) var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>
            {severityFilter
              ? `No ${severityFilter} alerts in the last 30 days.`
              : 'No alerts in the last 30 days.'
            }
          </p>
        )}

        {/* Alert rows */}
        {!loading && displayed.map((alert, i) => (
          <div key={alert.id} style={{
            display: 'grid',
            gridTemplateColumns: '90px 1fr 180px 160px',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            borderBottom: i < displayed.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
            alignItems: 'center',
          }}>
            <div>
              <SeverityBadge severity={alert.severity} />
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
              {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
            </span>
            <button
              onClick={() => navigate(`/admin/members?patient=${alert.patient_id}`)}
              aria-label={`View ${alert.patientName} in Members`}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-primary-light)',
                textAlign: 'left',
              }}
            >
              {alert.patientName}
            </button>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
              {formatTimestamp(alert.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
