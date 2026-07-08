---
title: Landing Page — Marketing Claims & ROI Model
source: https://cardiotrack-three.vercel.app/landing.html
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [marketing, roi, patient-experience, claims]
status: current
---

# Landing Page — Marketing Claims & ROI Model

Compiled from the MKL Health public landing page. Reflects public-facing positioning and the ROI model shown to prospective practices.

---

## Hero Positioning

> "Remote Monitoring that Pays for Itself in 30 Days"

Platform automates chronic care management, captures CPT billing codes automatically, and maintains patient safety between visits for cardiovascular practices.

---

## Patient Experience Claims

| Claim | Figure | Basis |
|-------|--------|-------|
| SMS check-in completion rate | 85% | vs. 40% app-based |
| Check-in time | 30 seconds | — |
| No app download required | ✓ | SMS-only |
| PHQ-9/GAD-7 screenings | Monthly, via SMS | Auto-scored, flagged for review |

**Patient flow:** 9 AM SMS → patient replies wellness score (1–5) + weight → vitals logged → alert if threshold crossed.  
Missed check-ins flagged at 11 AM. Patients reply STOP to opt out at any time.

---

## ROI Model — 50-Patient Panel

Basis: CMS 2025 physician fee schedule. Actual reimbursement varies by payer mix.

| Line Item | Calculation | Monthly |
|-----------|-------------|---------|
| CPT 99454 (device supply) | 50 pts × $20 | +$1,000 |
| CPT 99457 (first 20 min) | 50 pts × $57 | +$2,850 |
| CPT 99458 (add-on 20 min) | 30 pts × $47 | +$1,410 |
| Staff time savings | 2 hrs/pt × $35/hr × 50 pts | +$3,500 |
| Platform fee (Growth tier) | — | −$799 |
| **Net monthly impact** | | **$7,961** |

---

## Cost Reduction Claims

| Outcome | Figure | Source claim |
|---------|--------|-------------|
| Readmission reduction | ↓ 32% | NEJM data |
| Staff hours saved | ↓ 2–3 hrs/pt/month | vs. manual RPM programs |
| CPT billing capture rate | 98% | Auto-tracking |
| Depression co-morbidity costs | ↓ 41% | Undetected depression in cardiac pts |
| Medication adherence improvement | ↑ 28% | Within 90 days |
| Unplanned ER visits reduction | ↓ 24% | Remote vitals + real-time feedback |
| Heart failure readmission cost | $15K–$22K | Individual readmission |
| Non-adherence system cost | $300B/yr | US healthcare system |

---

## Dashboard Features (Provider View)

- Real-time color-coded patient status board (vitals, alerts, compliance)
- Automated Slack alerts: weight gain > 3 lbs, BP > 160/100, symptom score ≥ 4
- CPT billing auto-qualification with threshold progress + export-ready monthly reports
- Google Calendar follow-up scheduling from patient card
- Multi-condition support: heart failure, hypertension, COPD, diabetes
- TCM milestone tracking (2-day contact, 7-day face-to-face, 30-day episode)

**Sample live dashboard figures:** 47 enrolled patients, $6.2K MTD revenue (+18% vs prior month), 3 open alerts

---

## Billing Codes Listed

In addition to the RPM CPT codes in [[clinical-reference]], the landing page lists:

| Code | Description | Per-Visit Value |
|------|-------------|-----------------|
| 96127 | Brief behavioral/emotional assessment (PHQ-9/GAD-7) | ~$18/visit |

This code is **not in the training guide** — flag for billing team awareness.

---

## Testimonials

| Source | Quote |
|--------|-------|
| Dr. Sarah Chen MD, Pacific Heart Group | "$8,400/month net revenue within 60 days of go-live." |
| Patricia Moore RN, Valley Medical Clinic | "Caught 6 lbs fluid gain over 3 days — prevented a $20K hospitalization." |
| Mark Torres, Southwest Cardiology | "Billing report ready on the 1st — no more manual time-log pulls." |

---

## See Also

- [[pitch-deck]] — market sizing, business model, financial projections
- [[clinical-reference]] — CPT codes with thresholds
- [[training-guide]] — internal workflows for clinicians and admins
