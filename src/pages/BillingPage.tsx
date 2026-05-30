// src/pages/BillingPage.tsx
// Extracted from App.tsx lines 978–1095

import { useState } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Btn, Tag, Spin, Empty, Field, SelectField } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { ComingSoon } from '@/lib/utils'
import { FEATURES } from '@/config'
import { getMonthlyBillingSummary, logRpmTime, exportBillingCSV } from '@/api/billing'

export default function BillingPage() {
  const today = new Date()
  const defaultPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const [period, setPeriod] = useState(defaultPeriod)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [logForm, setLogForm] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState('')
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
      setExpandedId(null); setActionError(''); refresh()
    } catch (e: any) { setActionError(e.message) } finally { setSaving(false) }
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
          style={{ background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, fontFamily: F.body, fontSize: 14, padding: '8px 12px', minHeight: 40 }} />
        <Btn variant="ghost" onClick={handleExport} style={{ fontSize: 13 }}>Export CSV</Btn>
      </div>

      {/* KPI tiles */}
      <div className="grid-4">
        {[
          { label: 'Enrolled in RPM', value: rows.length, color: T.blue },
          { label: 'Billable This Month', value: billable, color: T.green },
          { label: 'Est. Monthly Revenue', value: `$${totalRev.toLocaleString()}`, color: T.blue },
          { label: 'Avg Compliance', value: `${avgCompliance}%`, color: T.amber },
        ].map(k => (
          <Card key={k.label}><div style={{ padding: 16 }}>
            <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
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
                onMouseEnter={e => (e.currentTarget.style.background = T.subtle)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                  <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{r.firstName} {r.lastName}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{r.mrn}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {checkinBadge(r.checkinDays)}
                  {r.cpt99457Met ? <Tag type="green">99457 ✓</Tag> : <Tag>99457</Tag>}
                  {r.cpt99458Count > 0 && <Tag type="teal">99458×{r.cpt99458Count}</Tag>}
                  <span style={{ fontFamily: F.mono, fontSize: 12, color: T.green }}>${r.estimatedReimbursement}</span>
                </div>
              </div>
              {expandedId === r.patientId && (
                <div style={{ background: T.subtle, padding: 16, borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, marginBottom: 12, textTransform: 'uppercase' }}>Log RPM Time</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
                    <Field label="Date" type="date" value={logForm[r.patientId]?.date ?? today.toISOString().slice(0, 10)} onChange={v => updateLogForm(r.patientId, 'date', v)} />
                    <Field label="Duration (min)" type="number" value={logForm[r.patientId]?.duration ?? ''} onChange={v => updateLogForm(r.patientId, 'duration', v)} />
                    <SelectField label="Activity" value={logForm[r.patientId]?.activityType ?? 'Chart Review'} onChange={v => updateLogForm(r.patientId, 'activityType', v)}
                      options={['Chart Review', 'Patient Communication', 'Care Plan Update', 'Specialist Coordination']} />
                    <Field label="Notes" value={logForm[r.patientId]?.notes ?? ''} onChange={v => updateLogForm(r.patientId, 'notes', v)} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <Btn onClick={() => handleLogTime(r.patientId)} disabled={saving} style={{ fontSize: 13 }}>{saving ? <Spin /> : 'Save Time Log'}</Btn>
                    {actionError && <div style={{ color: T.red, fontSize: 12, marginTop: 6, fontFamily: F.body }}>{actionError}</div>}
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
