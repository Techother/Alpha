// src/pages/AlertsPage.tsx
// Extracted from App.tsx lines 1658–1699

import { useEffect } from 'react'
import { T, F } from '@/lib/tokens'
import { Card, Btn, Tag, Spin, Empty, SeverityRow } from '@/components/ui/primitives'
import type { SeverityLevel } from '@/components/ui/primitives'
import { useAsync } from '@/lib/hooks'
import { timeAgo } from '@/lib/utils'
import { getOpenAlerts, acknowledgeAlert } from '@/api/supabase'

function alertIcon(type: string) {
  if (type.includes('missed_checkin') || type.includes('no_checkin')) return '📵'
  if (type.includes('medication') || type.includes('med')) return '💊'
  if (type.includes('tcm') || type.includes('discharge')) return '🏥'
  if (type.includes('phq') || type.includes('gad') || type.includes('screening') || type.includes('bhi')) return '🧠'
  return '⚠'
}

export default function AlertsPage() {
  const { data: alerts, loading, error, refresh } = useAsync(getOpenAlerts, [])
  useEffect(() => { const t = setInterval(refresh, 60000); return () => clearInterval(t) }, [refresh])

  async function handleAck(id: string) { await acknowledgeAlert(id); refresh() }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>{(alerts ?? []).length} Open</span>
        <Btn variant="ghost" onClick={refresh} style={{ fontSize: 12, padding: '6px 12px', minHeight: 36 }}>Refresh</Btn>
      </div>
      {error && <div style={{ color: T.red, marginBottom: 12, fontSize: 13 }}>{error}</div>}
      <Card>
        {loading ? <div style={{ padding: 20 }}><Spin /></div> : (alerts ?? []).length === 0 ? <Empty icon="✓" msg="No open alerts" /> :
          (alerts as any[]).map((a) => (
            <SeverityRow key={a.id} severity={a.severity as SeverityLevel} style={{ borderBottom: `1px solid ${T.border}`, borderRadius: 0 }}>
              <div style={{ fontSize: 18, flexShrink: 0 }}>{alertIcon(a.alert_type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: F.body, fontSize: 14, color: T.text, fontWeight: 500 }}>{a.patients?.first_name} {a.patients?.last_name}</span>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert }}>{a.patients?.mrn}</span>
                  <Tag type={a.severity === 'critical' ? 'red' : a.severity === 'high' ? 'amber' : 'default'}>{a.severity}</Tag>
                </div>
                <div style={{ fontFamily: F.body, fontSize: 13, color: T.textTert }}>{a.alert_type.replace(/_/g, ' ')} — {a.description}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: T.textSec, marginTop: 4 }}>{timeAgo(a.created_at)}</div>
              </div>
              <Btn variant="ghost" onClick={() => handleAck(a.id)} style={{ fontSize: 12, padding: '6px 10px', minHeight: 36, flexShrink: 0 }}>Ack</Btn>
            </SeverityRow>
          ))
        }
      </Card>
    </div>
  )
}
