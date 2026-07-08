---
title: Training Guide — Roles & Workflows
source: https://cardiotrack-three.vercel.app/training-guide.html
compiled_at: 2026-05-28T00:00:00Z
created: 2026-05-28
tags: [training, workflows, roles, hipaa, clinician, admin]
status: current
---

# Training Guide — Roles & Workflows

Compiled from the internal MKL Health Employee & Admin Training Guide v1.0 (May 2026, Confidential).

## User Roles

| Role | Access |
|------|--------|
| Patient | SMS-only (no dashboard) |
| Clinician | Full dashboard — own patients |
| Admin | Full dashboard + system setup panel |

---

## Section A — Patient Workflows

### A1 Enrollment
1. Clinician creates record: name, DOB, phone, diagnosis, provider
2. Obtain written RPM consent (CMS requirement — must precede billing)
3. Send test SMS to verify phone
4. Orientation call explaining daily check-in format

### A2 Daily SMS Check-In
- 9:00 AM automated SMS
- Patient replies: wellness score (1–5) + weight
- Missed check-ins flagged at 11 AM
- Patients can reply STOP at any time to opt out

### A3 Medication Tracking
- Clinician adds: drug, dose, frequency, start date
- Daily SMS reminder; YES/NO adherence tracking
- Three consecutive missed doses → clinician review flag

### A4 Vitals & Trends
- 30-day check-in history per patient
- Trend colors: Green (normal), Amber (borderline), Red (threshold exceeded)

### A5 Alert Escalation
Critical triggers (call within 30 min, not SMS):
- SBP > 180 mmHg
- DBP > 110 mmHg
- Weight gain > 3 lbs/24h
- Wellness score 5

Log call time — counts toward RPM minutes. See [[clinical-reference]] for full threshold table.

---

## Section B — Clinician Workflows

### B1 Dashboard Priorities
Morning routine: red alerts first → missed check-ins → patients near CPT threshold  
End of day: acknowledge all alerts, verify RPM time logged, review TCM deadlines

### B2 Patient Record Tabs
Overview · Check-ins · Medications · Alerts · Screenings · Billing · TCM · Notes

Log interactions: date, duration (minutes), interaction type.  
**HIPAA:** Never record PHI in Slack. Use patient initials + last 4 MRN only.

### B3 Alert Response Protocol

| Severity | Color | SLA | Examples |
|----------|-------|-----|---------|
| Critical | Red | < 30 min | BP > 180/110, score 5 |
| Warning | Amber | < 4 hr | Weight ↑ 3 lbs, 2 missed check-ins, score 4 |
| Info | Blue | Same day | 1 missed dose, slight BP elevation |

### B4 Mental Health Screening
- PHQ-9 at enrollment and every 90 days
- Scoring and severity actions in [[clinical-reference]]
- **Safety:** PHQ-9 Q9 (suicidality) > 0 → follow practice safety protocol immediately

### B5 Care Programs

**CCM (Chronic Care Management)**
- Eligibility: 2+ chronic conditions
- Minimum 20 min/month coordination
- Log: date, duration, activity type

**TCM (Transitional Care Management)**
- Triggered on inpatient/observation discharge
- Enter discharge date, admission type, diagnosis
- See [[clinical-reference]] for 99495/99496 milestone deadlines

### B6 RPM Billing
See [[clinical-reference]] for CPT code thresholds and reimbursement.  
Workflow: Billing dashboard → Log RPM interaction time → Export CSV at month-end

### B7 Google Calendar
- Connect Google Calendar on first use
- View upcoming 30 days; create follow-up appointments linked to patient records

### B8 Slack
View care team channel from inside dashboard.  
**HIPAA:** Use initials + last 4 MRN only. Clinical details → chart Notes tab.

---

## Section C — Admin Workflows

### C1 User Provisioning
1. supabase.com → project → Authentication → Users → Invite User
2. Enter work email, send invite
3. Assign role in user metadata (`clinician` or `admin`)
4. Departing users: Ban User on **last day of employment** (not retroactively)

### C2 Environment Variables
All secrets stored in Vercel dashboard only — never in code.  
See [[sources-and-data]] for the full variable table.  
To update: vercel.com → Settings → Environment Variables → Edit → Save → Trigger redeploy

### C3 Airtable & Backlog
- Backlog → New Story: title, description, story points, type
- Create sprints with start/end dates; drag stories in
- Change base: update `AIRTABLE_BASE_ID` in Vercel; expected tables: "Stories" and "Sprints"

### C4 Slack Alert Configuration
- Change destination: copy Channel ID → update `SLACK_CHANNEL_ID` in Vercel → redeploy
- Verify bot channel access: right-click channel → Integrations
- Test via Setup panel

### C5 Billing Export
- Billing → Select month → Export CSV (`rpm-billing-YYYY-MM.csv`)
- Columns: Patient ID, Name, Provider NPI, CPT Codes, Units, Days Enrolled, Minutes Logged, Period
- Submit to billing team by 3rd of following month

### C6 HIPAA Compliance

| Control | How |
|---------|-----|
| Access control | Role-based Supabase auth; JWT on every API call |
| Encryption in transit | HTTPS enforced by Vercel |
| Encryption at rest | Supabase PostgreSQL AES-256 |
| Audit logging | Supabase logs all DB reads/writes (user ID + timestamp) — export quarterly, retain 6 years |
| BAA | Required from Supabase and Vercel before going live |

**Quarterly audit log review:** Supabase → Logs → API logs → filter date → export CSV → review for unauthorized access / unusual volume / off-hours activity

**Security incident response:**
1. Ban affected user accounts immediately
2. Rotate all API keys in Vercel
3. Notify HIPAA Privacy Officer within 24 hours
4. Document: timeline, affected data, remediation
5. HIPAA Breach Notification: notify patients within 60 days; notify HHS if > 500 individuals

---

## Escalation Contacts

| Role | Contact |
|------|---------|
| Founder / CEO | larry@techother.com |
| HIPAA Privacy Officer | [Designated — add contact] |
| Supabase Support | supabase.com/support |
| Vercel Support | vercel.com/support |

## See Also

- [[clinical-reference]] — CPT codes, PHQ-9/GAD-7 scoring, alert thresholds
- [[sources-and-data]] — env vars, integrations
- [[project-overview]] — tech stack
- [[current-status]] — phase progress
