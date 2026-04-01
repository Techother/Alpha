import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPatientRoster, getPatientDetail } from '@/api/admin'
import type { PatientRosterRow, PatientDetail } from '@/api/supabase.types'

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never'
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

function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
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
      aria-label={`Severity: ${severity}`}
      style={{
        background: s.bg,
        color: s.color,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-bold)',
        padding: '2px 7px',
        borderRadius: 'var(--radius-full)',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  )
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function ConditionChip({ slug, name }: { slug: string; name: string }) {
  const colorMap: Record<string, { color: string; bg: string }> = {
    heart_failure: { color: 'var(--color-hf)',       bg: 'var(--color-hf-bg)' },
    diabetes:      { color: 'var(--color-diabetes)',  bg: 'var(--color-diabetes-bg)' },
    ckd:           { color: 'var(--color-ckd)',       bg: 'var(--color-ckd-bg)' },
  }
  const c = colorMap[slug] ?? { color: 'var(--color-text-muted)', bg: 'var(--color-bg)' }
  return (
    <span style={{
      background: c.bg,
      color: c.color,
      fontSize: 'var(--font-size-xs)',
      fontWeight: 'var(--font-weight-semibold)',
      padding: '1px 7px',
      borderRadius: 'var(--radius-full)',
    }}>
      {name}
    </span>
  )
}

function VitalTile({ label, value, unit }: { label: string; value: number | null | undefined; unit?: string }) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>
        {label.toUpperCase()}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', lineHeight: 1 }}>
        {value != null ? value : '—'}
      </div>
      {unit && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
          {unit}
        </div>
      )}
    </div>
  )
}

function BPTile({ systolic, diastolic }: { systolic: number | null | undefined; diastolic: number | null | undefined }) {
  const hasValue = systolic != null && diastolic != null
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: '10px 12px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', marginBottom: 4, letterSpacing: '0.05em' }}>
        BLOOD PRESSURE
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', lineHeight: 1 }}>
        {hasValue ? (
          <>
            {systolic}
            <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-normal)', color: 'var(--color-text-muted)' }}>
              /{diastolic}
            </span>
          </>
        ) : '—'}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>mmHg</div>
    </div>
  )
}

export function Members() {
  const [searchParams] = useSearchParams()
  const [roster, setRoster]               = useState<PatientRosterRow[]>([])
  const [filtered, setFiltered]           = useState<PatientRosterRow[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [detail, setDetail]               = useState<PatientDetail | null>(null)
  const [search, setSearch]               = useState('')
  const [rosterLoading, setRosterLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rosterError, setRosterError]     = useState(false)

  // Load roster on mount, then handle ?patient= param
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rows = await getPatientRoster()
        if (cancelled) return
        setRoster(rows)
        setFiltered(rows)

        const paramId = searchParams.get('patient')
        if (paramId && rows.some(r => r.id === paramId)) {
          setSelectedId(paramId)
        }
      } catch {
        if (!cancelled) setRosterError(true)
      } finally {
        if (!cancelled) setRosterLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fetch detail when selectedId changes
  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    let cancelled = false
    async function load() {
      setDetailLoading(true)
      const d = await getPatientDetail(selectedId)
      if (cancelled) return
      setDetail(d)
      setDetailLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [selectedId])

  // Client-side search filter
  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? roster.filter(p => p.name.toLowerCase().includes(q)) : roster)
  }, [search, roster])

  const selected = roster.find(r => r.id === selectedId) ?? null

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--space-8) * 2)', margin: 'calc(-1 * var(--space-8))', overflow: 'hidden' }}>

      {/* Patient list column */}
      <div style={{
        width: 240,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Header + search */}
        <div style={{ padding: 'var(--space-5) var(--space-4) var(--space-3)', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <h1 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)', margin: '0 0 var(--space-3)' }}>
            Members
          </h1>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: 14 }}>⌕</span>
            <input
              type="search"
              placeholder="Search patients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search patients"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '6px 8px 6px 26px',
                fontSize: 'var(--font-size-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                color: 'var(--color-text)',
                background: 'var(--color-bg)',
              }}
            />
          </div>
        </div>

        {/* Patient rows */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2)' }}>
          {rosterError && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-alert-high)', padding: 'var(--space-2)' }}>
              Could not load data. Try refreshing.
            </p>
          )}

          {rosterLoading && (
            [1,2,3,4].map(i => (
              <div key={i} style={{ height: 52, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-1)' }} />
            ))
          )}

          {!rosterLoading && filtered.length === 0 && !rosterError && (
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', padding: 'var(--space-2)' }}>
              {search ? 'No patients match your search.' : 'No patients enrolled yet.'}
            </p>
          )}

          {!rosterLoading && filtered.map(patient => {
            const isSelected = patient.id === selectedId
            return (
              <button
                key={patient.id}
                onClick={() => setSelectedId(patient.id)}
                aria-pressed={isSelected}
                aria-label={`Select patient ${patient.name}`}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: isSelected ? 'var(--color-primary-subtle)' : 'transparent',
                  borderLeft: isSelected ? '3px solid var(--color-primary)' : '3px solid transparent',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 'var(--space-1)',
                  transition: 'background var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-1)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: isSelected ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                      color: 'var(--color-text)',
                      marginBottom: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {patient.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                      {patient.conditionName} · {formatRelativeTime(patient.lastCheckinAt)}
                    </div>
                  </div>
                  {patient.openAlertCount > 0 && (
                    <span
                      aria-label={`${patient.openAlertCount} open alerts`}
                      style={{
                        background: 'var(--color-alert-high-bg)',
                        color: 'var(--color-alert-high)',
                        fontSize: 9,
                        fontWeight: 'var(--font-weight-bold)',
                        padding: '1px 6px',
                        borderRadius: 'var(--radius-full)',
                        flexShrink: 0,
                      }}
                    >
                      {patient.openAlertCount}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, background: 'var(--color-bg)', overflowY: 'auto', padding: 'var(--space-6)' }}>

        {!selected && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
              Select a patient to view their details.
            </p>
          </div>
        )}

        {selected && detailLoading && (
          <div>
            <div style={{ height: 40, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)', width: '50%' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
              {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 70, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }} />)}
            </div>
            <div style={{ height: 120, background: 'var(--color-border-subtle)', borderRadius: 'var(--radius-md)' }} />
          </div>
        )}

        {selected && !detailLoading && detail && (
          <div>
            {/* Patient header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: 'var(--color-primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 'var(--font-weight-bold)', fontSize: 'var(--font-size-md)',
                flexShrink: 0,
              }}>
                {getInitials(selected.name)}
              </div>
              <div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text)' }}>
                  {selected.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 2 }}>
                  <ConditionChip slug={selected.conditionSlug} name={selected.conditionName} />
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
                    Last check-in: {formatAbsoluteTime(selected.lastCheckinAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Latest vitals */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-muted)', letterSpacing: '0.05em', marginBottom: 'var(--space-2)' }}>
                LATEST VITALS
              </div>
              {!detail.latestCheckin ? (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)' }}>No check-in data.</p>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <VitalTile label="Weight" value={detail.latestCheckin.weight_lbs} unit="lbs" />
                    <BPTile systolic={detail.latestCheckin.bp_systolic} diastolic={detail.latestCheckin.bp_diastolic} />
                    <VitalTile label="Heart Rate" value={detail.latestCheckin.heart_rate} unit="bpm" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 'var(--space-2)' }}>
                    <VitalTile label="Breathlessness" value={detail.latestCheckin.breathlessness} unit="/5" />
                    <VitalTile label="Swelling"       value={detail.latestCheckin.swelling}       unit="/5" />
                    <VitalTile label="Fatigue"        value={detail.latestCheckin.fatigue_score}  unit="/5" />
                  </div>
                </>
              )}
            </div>

            {/* Recent alerts */}
            <div style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
            }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text)', marginBottom: 'var(--space-3)' }}>
                Recent Alerts
              </div>
              {detail.recentAlerts.length === 0 ? (
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-muted)', margin: 0 }}>No recent alerts.</p>
              ) : (
                detail.recentAlerts.map((alert, i) => (
                  <div key={alert.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-2) 0',
                    borderBottom: i < detail.recentAlerts.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                  }}>
                    <SeverityBadge severity={alert.severity} />
                    <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text)' }}>
                      {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                      {formatRelativeTime(alert.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
