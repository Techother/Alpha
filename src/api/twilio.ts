export async function sendCheckinSMS(
  patientPhone: string,
  patientFirstName: string,
  checkinUrl: string
): Promise<void> {
  const body = `Hi ${patientFirstName}, it's time for your daily MKL Health check-in: ${checkinUrl}`
  const res = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: patientPhone, body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'SMS send failed')
}

export async function sendTestSMS(patientPhone: string): Promise<void> {
  const body = 'MKL Health: This is a test message from your care team. Reply STOP to unsubscribe.'
  const res = await fetch('/api/send-sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: patientPhone, body }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'SMS send failed')
}
