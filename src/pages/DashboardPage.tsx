// src/pages/DashboardPage.tsx
// Extracted from App.tsx lines 439–557
// onSelectPatient prop → selectPatient from useOutletContext

import { useOutletContext } from 'react-router-dom'
import { T, F } from '@/lib/tokens'
import { Card, CardHeader, Tag, Spin, Empty, SeverityRow } from '@/components/ui/primitives'
import type { SeverityLevel } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { timeAgo, riskOrder, riskTag } from '@/lib/utils'
import { getPatients, getOpenAlerts, getDashboardStats } from '@/api/supabase'
import { getSprints } from '@/api/airtable'
import { getMonthlyBillingSummary } from '@/api/billing'

type OutletCtx = { selectedPatientId: string | null; selectPatient: (id: string | null) => void }

export default function DashboardPage() {
  const { selectPatient } = useOutletContext<OutletCtx>()
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
        <div style={{ background: T.redSurface, border: `1px solid ${T.red}`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: T.red, fontSize: 18 }}>⚠</span>
          <span style={{ color: T.red, fontFamily: F.body, fontWeight: 600, fontSize: 14 }}>{criticals.length} critical alert{criticals.length > 1 ? 's' : ''} need immediate attention</span>
        </div>
      )}

      {/* KPIs — 6 tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 16 }}>
        {sL ? <Spin /> : [
          { label: 'Total Patients',      value: stats?.totalPatients ?? 0,  color: T.blue },
          { label: 'Open Alerts',         value: stats?.openAlerts ?? 0,     color: T.red },
          { label: 'High Risk',           value: stats?.highRisk ?? 0,       color: T.amber },
          { label: 'Check-ins Today',     value: stats?.checkinsToday ?? 0,  color: T.green },
          { label: 'Billable This Month', value: billableCount,              color: T.blue },
          { label: 'Avg Compliance',      value: `${avgAdherence}%`,         color: T.blue },
        ].map(k => (
          <Card key={k.label}>
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{k.label}</div>
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
              <div key={p.id} onClick={() => selectPatient(p.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: `1px solid ${T.border}`, cursor: 'pointer', minHeight: 56 }}
                onMouseEnter={e => (e.currentTarget.style.background = T.subtle)}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: F.body, color: T.text, fontSize: 14, fontWeight: 500 }}>
                    {p.first_name} {p.last_name}
                    {withAlerts.has(p.id) && <span style={{ marginLeft: 6, color: T.red }}>●</span>}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.mrn} · {p.condition}</div>
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
              <div style={{ fontFamily: F.body, fontSize: 13, color: T.textTert, marginBottom: 8 }}>
                <span style={{ color: T.green, fontFamily: F.display, fontSize: 20 }}>{billableCount}</span> of {billingRows.length} patients billable
              </div>
              <div style={{ fontFamily: F.display, fontSize: 24, color: T.blue, marginBottom: 12 }}>${totalRev.toLocaleString()}</div>
              <button onClick={() => {}} style={{ background: 'none', border: 'none', color: T.blue, fontFamily: F.mono, fontSize: 11, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>View Full Report →</button>
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
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert }}>Target: <span style={{ color: T.text }}>{sprints[0]['Target Date'] ?? '—'}</span></span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: T.blue }}>{sprints[0]['Server Points'] ?? 0} srv pts</span>
                    <span style={{ fontFamily: F.mono, fontSize: 11, color: T.blue }}>{sprints[0]['Client Points'] ?? 0} cli pts</span>
                  </div>
                  {sprints[0].Notes && <div style={{ fontFamily: F.body, fontSize: 12, color: T.textTert, marginTop: 8 }}>{sprints[0].Notes}</div>}
                </>
              )}
            </div>
          </Card>

          {/* Recent alerts */}
          <Card>
            <CardHeader>Recent Alerts</CardHeader>
            {aL ? <div style={{ padding: 20 }}><Spin /></div> : (alerts ?? []).slice(0, 4).length === 0 ? <Empty msg="No open alerts" /> :
              (alerts as any[]).slice(0, 4).map((a) => (
                <SeverityRow key={a.id} severity={a.severity as SeverityLevel} style={{ borderBottom: `1px solid ${T.border}`, borderRadius: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: F.body, fontSize: 13, color: T.text, fontWeight: 500 }}>{a.patients?.first_name} {a.patients?.last_name}</div>
                    <div style={{ fontFamily: F.body, fontSize: 12, color: T.textTert, marginTop: 2 }}>{a.description}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec, marginTop: 4 }}>{timeAgo(a.created_at)}</div>
                  </div>
                </SeverityRow>
              ))
            }
          </Card>
        </div>
      </div>
    </div>
  )
}
