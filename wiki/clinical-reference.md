---
title: Clinical Reference — CPT Codes, Screenings, Alerts
source: https://cardiotrack-three.vercel.app/training-guide.html
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [billing, cpt, phq9, gad7, alerts, clinical]
status: current
---

# Clinical Reference

Quick-lookup tables for CPT billing, PHQ-9/GAD-7 scoring, and alert thresholds.

---

## CPT Code Reference

| Code | Description | Threshold | CMS 2025 Rate | Key Rules |
|------|-------------|-----------|---------------|-----------|
| 99454 | Device supply, data collection & transmission | ≥ 16 days readings in 30-day period | ~$20/mo | Written consent required; one device per patient |
| 99457 | RPM treatment management — first 20 min | ≥ 20 cumulative min/month + interactive contact | ~$57/mo | Must include interactive communication, not just data review |
| 99458 ×1 | RPM treatment management — add-on 20 min | ≥ 40 cumulative min/month | ~$47/unit | Billed after 99457; max 2 add-on units/month |
| 99458 ×2 | RPM treatment management — second add-on | ≥ 60 cumulative min/month | ~$47/unit | Max RPM combo (99457 + 99458 ×2) = ~$151/mo |
| 96127 | Brief behavioral/emotional assessment (PHQ-9/GAD-7) | Per administration | ~$18/visit | Listed on landing page; not in training guide |
| 99495 | TCM — moderate complexity | Contact within 14 business days; visit within 14 calendar days | ~$175 | Cannot bill same month as certain E&M codes |
| 99496 | TCM — high complexity | Contact within 7 business days; visit within 7 calendar days | ~$238 | Requires high-complexity medical decision making |

**CPT 99454 requires written RPM consent before billing.** This is a CMS requirement.

> ⚠ **Rate discrepancy:** The training guide (src_training_guide_v1) listed 99454 at ~$65/mo, 99457 at ~$54/mo, 99458 at ~$41/unit. The landing page and pitch deck both use CMS 2025 fee schedule figures ($20/$57/$47). The landing page explicitly states "Based on CMS 2025 physician fee schedule." The landing page/pitch deck figures are used here as the authoritative source. Verify with billing team before submission.

---

## TCM Milestone Deadlines

| Milestone | CPT 99495 (Moderate) | CPT 99496 (High) |
|-----------|---------------------|------------------|
| Interactive contact | ≤ 14 business days post-discharge | ≤ 7 business days post-discharge |
| Face-to-face visit | ≤ 14 calendar days post-discharge | ≤ 7 calendar days post-discharge |
| Medical decision complexity | Moderate | High |

---

## PHQ-9 Scoring (Depression — 9 items, 0–3 each, total 0–27)

| Score | Severity | Recommended Action |
|-------|----------|--------------------|
| 0–4 | Minimal | Watchful waiting; repeat at follow-up |
| 5–9 | Mild | Support and monitor; discuss contributing factors |
| 10–14 | Moderate | Initiate stepped-care protocol; consider counseling |
| 15–19 | Moderately Severe | Active treatment: therapy and/or medication |
| 20–27 | Severe | Immediate psychiatric referral; safety planning |

**Safety Alert — Q9 (suicidality):** If patient responds > 0 to item 9 ("Thoughts that you would be better off dead or of hurting yourself"), follow the practice's suicide risk protocol immediately. Do not proceed without escalation.

Screening cadence: at enrollment, then every 90 days.

---

## GAD-7 Scoring (Anxiety — 7 items, 0–3 each, total 0–21)

| Score | Severity |
|-------|----------|
| 0–4 | Minimal |
| 5–9 | Mild |
| 10–14 | Moderate |
| 15–21 | Severe |

---

## Alert Threshold Reference

| Level | Color | Trigger Conditions | Response SLA | Auto-Notifies |
|-------|-------|--------------------|--------------|---------------|
| Critical | 🔴 Red | SBP > 180 mmHg · DBP > 110 mmHg · Weight ↑ > 5 lbs/7 days · Wellness score 5 (consecutive) | 30 minutes | Slack + Alerts panel |
| Warning | 🟡 Amber | SBP 160–179 · Weight ↑ 3–5 lbs/24h · Wellness score 4 · 2 missed check-ins | 4 hours | Alerts panel |
| Info | 🔵 Blue | Medication missed 1 day · SBP 140–159 · 1 missed check-in · PHQ-9 5–9 | Same business day | Alerts panel |

Critical alerts: clinician must call (not SMS) within 30 minutes. Log call time — counts toward RPM minutes.

---

## See Also

- [[training-guide]] — full role workflows
- [[sources-and-data]] — integrations and data layer
- [[project-overview]] — tech stack and key files
