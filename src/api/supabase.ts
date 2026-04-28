import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any

// ── Auth ──────────────────────────────────────────────────────

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export function onAuthChange(cb: (session: any) => void) {
  return supabase.auth.onAuthStateChange((_event: any, session: any) => cb(session))
}

// ── Patients ──────────────────────────────────────────────────

export async function getPatients() {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('active', true)
    .order('risk_level', { ascending: true }) // high < low alphabetically — sort manually in UI
  if (error) throw error
  return data ?? []
}

export async function getPatient(id: string) {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

// ── Checkins ──────────────────────────────────────────────────

export async function getPatientCheckins(patientId: string, days = 7) {
  const since = new Date()
  since.setDate(since.getDate() - days)
  const { data, error } = await supabase
    .from('checkins')
    .select('*')
    .eq('patient_id', patientId)
    .gte('checkin_date', since.toISOString().slice(0, 10))
    .order('checkin_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getTodayCheckin(patientId: string) {
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('checkins')
    .select('*')
    .eq('patient_id', patientId)
    .eq('checkin_date', today)
    .maybeSingle()
  return data
}

export async function createCheckin(payload: {
  patient_id: string
  checkin_date: string
  weight_lbs: number | null
  heart_rate: number | null
  breathlessness_score: number | null
  swelling_score: number | null
  medications_taken: boolean | null
  patient_notes: string | null
}) {
  const { data, error } = await supabase
    .from('checkins')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Alerts ────────────────────────────────────────────────────

export async function getOpenAlerts() {
  const { data, error } = await supabase
    .from('alerts')
    .select('*, patients(first_name, last_name, mrn)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getPatientAlerts(patientId: string) {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('patient_id', patientId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function acknowledgeAlert(alertId: string) {
  const { error } = await supabase
    .from('alerts')
    .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
    .eq('id', alertId)
  if (error) throw error
}

export async function createAlert(payload: {
  patient_id: string
  alert_type: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  threshold_value?: string
}) {
  const { data, error } = await supabase
    .from('alerts')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Dashboard stats ───────────────────────────────────────────

export async function getDashboardStats() {
  const today = new Date().toISOString().slice(0, 10)
  const [patientsRes, alertsRes, highRiskRes, checkinsRes] = await Promise.all([
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('alerts').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('patients').select('id', { count: 'exact', head: true }).eq('risk_level', 'high').eq('active', true),
    supabase.from('checkins').select('id', { count: 'exact', head: true }).eq('checkin_date', today),
  ])
  return {
    totalPatients: patientsRes.count ?? 0,
    openAlerts: alertsRes.count ?? 0,
    highRisk: highRiskRes.count ?? 0,
    checkinsToday: checkinsRes.count ?? 0,
  }
}

// ── Chatbot ───────────────────────────────────────────────────

export async function createChatbotSession(patientId: string) {
  const { data, error } = await supabase
    .from('chatbot_sessions')
    .insert({ patient_id: patientId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function saveChatbotMessage(payload: {
  session_id: string
  role: 'user' | 'assistant'
  content: string
  intent?: string
  extracted_value?: string
  sequence_num: number
}) {
  const { error } = await supabase.from('chatbot_messages').insert(payload)
  if (error) throw error
}

export async function completeSession(sessionId: string, checkinId: string) {
  const { error } = await supabase
    .from('chatbot_sessions')
    .update({ completed: true, completed_at: new Date().toISOString(), checkin_id: checkinId })
    .eq('id', sessionId)
  if (error) throw error
}
