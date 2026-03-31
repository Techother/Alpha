import type { Question, ParsedAnswers } from '@/api/supabase.types'

export function parseAnswers(
  questions: Question[],
  answers: Record<string, string>
): ParsedAnswers {
  const result: ParsedAnswers = {
    weight_lbs: null,
    heart_rate: null,
    bp_systolic: null,
    bp_diastolic: null,
    fatigue_score: null,
    breathlessness: null,
    swelling: null,
    medications: null,
    free_text: null,
  }

  for (const q of questions) {
    const raw = answers[q.id] ?? ''
    if (raw === '') continue

    switch (q.intent) {
      case 'weight': {
        const v = parseFloat(raw)
        if (!isNaN(v)) result.weight_lbs = v
        break
      }
      case 'heart_rate': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.heart_rate = v
        break
      }
      case 'blood_pressure': {
        // Expects "120/80" — tolerates "120" (diastolic stays null)
        const parts = raw.split('/')
        const sys = parseInt(parts[0], 10)
        const dia = parseInt(parts[1] ?? '', 10)
        if (!isNaN(sys)) result.bp_systolic = sys
        if (!isNaN(dia)) result.bp_diastolic = dia
        break
      }
      case 'breathlessness': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.breathlessness = v
        break
      }
      case 'swelling': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.swelling = v
        break
      }
      case 'fatigue': {
        const v = parseInt(raw, 10)
        if (!isNaN(v)) result.fatigue_score = v
        break
      }
      case 'medications': {
        result.medications = raw === 'Yes'
        break
      }
      case 'free_text_symptom': {
        if (result.free_text === null) {
          result.free_text = raw
        } else {
          result.free_text += '\n' + raw
        }
        break
      }
    }
  }

  return result
}
