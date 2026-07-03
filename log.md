# Wiki Log

Chronological log of all ingest and lint operations.

---

2026-05-28 | SETUP | Bootstrapped wiki system: wiki/, raw/, index.md, log.md, manifests/raw_sources.csv; session protocol added to CLAUDE.md; seeded current-status, project-overview, sources-and-data from .planning/ files; project at Phase 7 start (Phases 1–6 VERIFIED)
2026-05-28 | INGEST | src_training_guide_v1 — compiled training-guide.html into wiki/training-guide.md (role workflows, HIPAA, escalation contacts) and wiki/clinical-reference.md (CPT codes, PHQ-9/GAD-7 scoring, alert thresholds); env var table added to sources-and-data.md; index.md updated with 2 new pages
2026-05-28 | INGEST | src_landing_page_v1 + src_pitch_deck_v1 — compiled landing.html → wiki/landing-page.md (ROI model, claims, 96127 billing code) and pitch.html → wiki/pitch-deck.md (market, pricing, traction, financials, team, seed ask); dashboard SPA skipped (JS-rendered); ⚠ CPT rate discrepancy found and resolved in clinical-reference.md (training guide $65/$54/$41 vs CMS 2025 $20/$57/$47); index.md updated with 2 new pages
2026-05-29 | FIX | Column duality gap resolved — migrated all query sites from v1-style aliases (breathlessness_score, swelling_score, medications_taken, patient_notes, checkin_date) to v3 column names (breathlessness, swelling, medications, free_text, checked_in_at); date equality queries rewritten as timestamptz range queries; tsc --noEmit passes; supabase/README.md updated; v1-style columns from migration 003 now dead weight pending deprecation migration
