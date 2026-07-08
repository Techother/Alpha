# Product

## Register

product

## Users

Clinicians — physicians, nurses, and care coordinators — managing remote patient monitoring (RPM) panels. They use MKL Health during clinical workflows: reviewing alert queues, documenting TCM contacts, generating billing data, and tracking screening compliance. Context is high-stakes: decisions affect care quality and billing accuracy. Sessions are often brief (90 seconds per patient) and occur on clinic workstations under ambient fluorescent lighting or at a desk during a busy shift.

## Product Purpose

MKL Health enables health system care teams to safely monitor and bill for remote patient care without any sensitive API credentials leaking to the browser or the public internet. It tracks vitals, surfaces alerts, manages TCM episodes, scores PHQ-9/GAD-7 screenings, and produces CPT billing reports — the clinical and operational backbone for an RPM program.

Success: a care coordinator can review their full patient panel, act on overdue alerts, confirm billing eligibility, and document a TCM contact within 10 minutes, with zero credential exposure risk.

## Brand Personality — Product Register (Clinical Dashboard)

Serious · Evidence-forward · Institutional

The product earns trust through data clarity and structural calm, not through personality or delight. Tone is terse, precise, clinical — like a well-formatted lab report. No cheerfulness. No loading animations with personality. Confidence through density handled well.

## References

- **Kaiser Permanente (kp.org)**: Institutional authority, clear stat hierarchy, blue-dominant healthcare palette
- **Primary Intelligence AI**: Evidence-forward data presentation, clinical credibility markers, research-citation aesthetic
- **Sutter Health**: Clean white clinical environment, generous whitespace, hierarchy that makes data scannable under time pressure

## Anti-references — Product Register (Clinical Dashboard)

- **Startup-cool dark mode**: Neon teal on near-black, glassmorphism, designed to impress investors not care teams. The current MKL Health design is in this bucket — the refinement moves away from it.
- **Consumer health app**: Cheery pastels, gamification cues, emoji, patient-facing emotional warmth — completely wrong register for a clinician workflow tool.

Anti-references above apply to the clinical dashboard/product register only. The public landing/marketing register intentionally adopts a warmer, approachable register (see 'Brand Personality — Public Register' below), per MKL Health PRD Section 2.

## Brand Personality — Public Register (Landing / Marketing)

Warm Clinical: approachable, editorial, human-forward — credible without being cold. First impression for a prospect evaluating whether this platform understands their practice.

## Design Principles

1. **Data earns its position** — Every element on screen either presents clinical data, enables action on it, or navigates to it. Decoration is clinical debt.
2. **Institutional trust is structural** — Credibility comes from consistent grid, precise typography, and predictable hierarchy. Not from color or motion.
3. **Density handled well** — Clinical tools carry a lot of information. Good density is not crowding; it is high information-to-pixel ratio with maintained legibility. Breathing room is strategic, not reflexive.
4. **States communicate clearly** — Alert severity, billing eligibility, screening urgency, and TCM overdue status must be visually unambiguous at a glance. Color is reserved for state, not decoration.
5. **Clinician time is scarce** — Every interaction should require fewer clicks than the clinician expects. No confirmation dialogs for read operations. No loading states without progress signals.

## Accessibility & Inclusion

WCAG AAA where possible. AA required everywhere. Priority: data values, alert states, severity indicators, and billing status must meet 7:1 contrast (AAA). Reduced-motion support required (clinical users may have vestibular sensitivities; busy clinical environments also discourage animation distraction). No reliance on color alone for state — always paired with icon, label, or pattern.
