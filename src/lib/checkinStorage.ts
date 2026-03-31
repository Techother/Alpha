import type { CheckinState } from '@/api/supabase.types'

function storageKey(patientId: string): string {
  return `ct_checkin_${patientId}`
}

export function saveCheckinState(state: CheckinState): void {
  try {
    localStorage.setItem(storageKey(state.patientId), JSON.stringify(state))
  } catch {
    // localStorage quota exceeded or unavailable — silent fail, session continues in memory
  }
}

export function loadCheckinState(patientId: string): CheckinState | null {
  try {
    const raw = localStorage.getItem(storageKey(patientId))
    if (!raw) return null
    return JSON.parse(raw) as CheckinState
  } catch {
    return null
  }
}

export function clearCheckinState(patientId: string): void {
  try {
    localStorage.removeItem(storageKey(patientId))
  } catch {
    // silent fail
  }
}
