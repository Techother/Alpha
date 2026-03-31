export const CONDITION_SLUG = 'heart_failure' as const
export const CHATBOT_TEMPLATE = 'daily_checkin_v1'
export const STATUS_LABEL = 'Active — v3.0'
export const isActive = true

export const OBSERVATION_TYPES = [
  'weight_lbs',
  'heart_rate',
  'bp_systolic',
  'bp_diastolic',
  'fatigue_score',
] as const

export const SYMPTOM_TYPES = [
  'breathlessness',
  'swelling',
] as const

export const ALERT_RULES = [
  { observation_type: 'weight_lbs',   rule: 'delta_3day',  threshold: 2,   alert_type: 'weight_gain',         severity: 'high' },
  { observation_type: 'heart_rate',   rule: 'value_above', threshold: 100, alert_type: 'abnormal_hr',         severity: 'high' },
  { observation_type: 'heart_rate',   rule: 'value_below', threshold: 50,  alert_type: 'abnormal_hr',         severity: 'high' },
  { symptom_type: 'breathlessness',   rule: 'score_gte',   threshold: 4,   alert_type: 'high_breathlessness', severity: 'high' },
  { symptom_type: 'swelling',         rule: 'score_gte',   threshold: 4,   alert_type: 'high_swelling',       severity: 'medium' },
  { event_type: 'missed_checkin',     rule: 'daily',       threshold: 1,   alert_type: 'missed_checkin',      severity: 'medium' },
  { event_type: 'medications_missed', rule: 'session',     threshold: 1,   alert_type: 'missed_medications',  severity: 'medium' },
] as const

export const PATIENT_COPY = {
  conditionLabel: 'Heart Failure',
  weightUnit: 'lbs',
  weightWarning: 'Contact your care team if your weight increases by 2 or more pounds in 3 days.',
  disclaimer: 'CardioTrack is a wellness tracking tool. It does not provide medical advice.',
} as const
