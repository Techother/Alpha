// Manual type definitions for CardioTrack v3 database schema

export type Role = 'provider' | 'patient'

export interface Profile {
  id: string
  role: Role
  full_name: string | null
  email: string | null
  created_at: string
}

export interface Patient {
  id: string
  profile_id: string
  mrn: string | null
  dob: string | null
  created_at: string
}

export interface Condition {
  id: string
  slug: 'heart_failure' | 'diabetes' | 'ckd'
  name: string
  description: string | null
  active: boolean
  created_at: string
}

export interface PatientCondition {
  patient_id: string
  condition_id: string
  diagnosed_at: string | null
  severity: 'mild' | 'moderate' | 'severe' | null
  primary_condition: boolean
  active: boolean
  created_at: string
}

export interface Observation {
  id: string
  patient_id: string
  condition_id: string | null
  session_id: string | null
  checkin_id: string | null
  observation_type: string
  value_numeric: number | null
  value_text: string | null
  unit: string | null
  observed_at: string
  source: 'chatbot' | 'manual' | 'device' | 'lab'
  created_at: string
}

export interface SymptomReport {
  id: string
  patient_id: string
  condition_id: string | null
  session_id: string | null
  checkin_id: string | null
  symptom_type: string
  severity_score: number | null
  free_text: string | null
  reported_at: string
  created_at: string
}

export interface MedicationRegimen {
  id: string
  patient_id: string
  condition_id: string | null
  medication_name: string
  dose: string | null
  frequency: 'once_daily' | 'twice_daily' | 'as_needed' | null
  instructions: string | null
  active: boolean
  started_at: string | null
  ended_at: string | null
  created_at: string
}

export interface MedicationEvent {
  id: string
  patient_id: string
  regimen_id: string | null
  session_id: string | null
  event_type: 'taken' | 'missed' | 'side_effect'
  scheduled_at: string | null
  reported_at: string
  notes: string | null
  created_at: string
}

export interface QuestionnaireTemplate {
  id: string
  slug: string
  name: string
  description: string | null
  questions: Question[]
  active: boolean
  created_at: string
}

export interface Question {
  id: string
  text: string
  type: 'number' | 'text' | 'boolean' | 'scale'
  intent: string
  unit?: string
  scale_min?: number
  scale_max?: number
  optional?: boolean
}

export interface ChatbotSession {
  id: string
  patient_id: string
  condition_id: string | null
  template_id: string | null
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  created_at: string
}

export interface Checkin {
  id: string
  patient_id: string
  session_id: string | null
  weight_lbs: number | null
  heart_rate: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  fatigue_score: number | null
  breathlessness: number | null
  swelling: number | null
  medications: boolean | null
  free_text: string | null
  checked_in_at: string
  created_at: string
}

export interface AlertRow {
  id: string
  patient_id: string
  alert_type: string
  severity: 'high' | 'medium' | 'low'
  created_at: string
}

export interface ParsedAnswers {
  weight_lbs: number | null
  heart_rate: number | null
  bp_systolic: number | null
  bp_diastolic: number | null
  fatigue_score: number | null
  breathlessness: number | null
  swelling: number | null
  medications: boolean | null
  free_text: string | null
}

export interface CheckinState {
  sessionId: string
  patientId: string
  conditionId: string
  templateSlug: string
  questions: Question[]
  answers: Record<string, string>
  currentIndex: number
  startedAt: string
}

export interface SubmitPayload {
  patientId: string
  conditionId: string
  templateSlug: string
  startedAt: string
  parsed: ParsedAnswers
  rawAnswers: Record<string, string>
}

export interface AlertInsert {
  patient_id: string
  condition_id: string
  checkin_id: string
  alert_type: string
  severity: 'high' | 'medium' | 'low'
}
