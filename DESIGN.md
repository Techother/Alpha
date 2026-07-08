---
name: MKL Health
description: Clinical RPM console for health system care teams — monitoring, billing, and TCM in one authoritative interface
colors:
  clinical-blue: "#1A5496"
  clinical-blue-hover: "#154279"
  clinical-blue-surface: "#EBF4FF"
  surface-app: "#F7F4EF"
  surface-card: "#FFFFFF"
  surface-nav: "#EDE8E0"
  surface-subtle: "#E8E1D6"
  border-default: "#D9CFC0"
  border-strong: "#A0876B"
  text-primary: "#1F2A37"
  text-secondary: "#2D3748"
  text-tertiary: "#4A5568"
  state-red: "#C53030"
  state-amber: "#B84D00"
  state-green: "#22543D"
  state-teal: "#234E52"
  focus-ring: "#3182CE"
  state-red-surface: "#FED7D7"
  state-amber-surface: "#FEEBC8"
  state-green-surface: "#C6F6D5"
  state-teal-surface: "#B2F5EA"
typography:
  display:
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
  title:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'DM Mono', 'Courier New', monospace"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.08em"
    textTransform: "uppercase"
rounded:
  xs: "4px"
  sm: "8px"
  md: "10px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.clinical-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.clinical-blue-hover}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  button-danger:
    backgroundColor: "{colors.state-red}"
    textColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "10px 18px"
  tag-default:
    backgroundColor: "{colors.surface-subtle}"
    textColor: "{colors.text-tertiary}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  tag-green:
    backgroundColor: "{colors.state-green-surface}"
    textColor: "{colors.state-green}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  tag-red:
    backgroundColor: "{colors.state-red-surface}"
    textColor: "{colors.state-red}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  tag-amber:
    backgroundColor: "{colors.state-amber-surface}"
    textColor: "{colors.state-amber}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  tag-teal:
    backgroundColor: "{colors.state-teal-surface}"
    textColor: "{colors.state-teal}"
    rounded: "{rounded.xs}"
    padding: "3px 8px"
  card:
    backgroundColor: "{colors.surface-card}"
    rounded: "{rounded.md}"
    padding: "0"
---

# Design System: MKL Health

## 1. Overview

**Creative North Star: "The Health System Console"**

MKL Health looks and feels like software that belongs next to Epic on a hospital workstation — not in a startup's pitch deck. Surfaces are warm clinical white — a near-neutral that reads as "clean workstation" not "cold terminal." Typography earns trust through hierarchy, not personality. Space is strategic: dense where data demands it, open where clinical judgment needs room to breathe.

The palette is Restrained. White surfaces hold patient data without visual interference. The deep clinical blue (#1A5496) appears only on interactive elements — buttons, links, focus states — at a frequency that mirrors how sparingly a well-run clinical form uses color. Semantic colors (red, amber, green) are reserved exclusively for clinical state: alert severity, billing eligibility, screening urgency. They are never decorative.

This system explicitly rejects the two anti-references named in PRODUCT.md: startup-cool dark mode (neon accents on near-black, designed for investor demos) and consumer health apps (cheery pastels, gamification cues, emotional warmth designed for patients). MKL Health serves clinicians under time pressure in fluorescent-lit workrooms; the interface must communicate faster than speech, not feel good to look at.

**Key Characteristics:**
- Warm clinical white — near-neutral surfaces that reduce fluorescent-lighting eye strain without warmth that reads as "consumer app"
- One accent, used sparingly — deep institutional blue on interactive elements only
- Semantic color as diagnostic signal — never decoration
- DM Mono labels — data provenance telegraphed through typeface, not just label text
- Flat tonal elevation — depth through surface tone offsets, not shadows
- Institutional density — high information-to-pixel ratio with maintained legibility; Fraunces for display weight only

## 2. Colors: The Clinical Palette

A restrained institutional palette anchored in deep blue authority and clinical white surfaces. Color functions as diagnostic signal; every non-neutral token represents a clinical state.

### Primary

- **Institutional Blue** (`#1A5496`, oklch ≈ 40% 0.11 260): The single interactive accent. Applied to primary buttons, active nav states, links, and focus rings — and nowhere else. Its rarity signals action. Derived from major health system brand palettes (KP, Cleveland Clinic) rather than tech-first UI systems.
- **Institutional Blue Hover** (`#154279`, oklch ≈ 34% 0.10 260): Hover/pressed state for all primary interactive elements. Exactly 6% darker lightness.
- **Institutional Blue Surface** (`#EBF4FF`, oklch ≈ 96% 0.025 260): Background tint for selected rows, active nav items, informational callouts. Never used as a full-page surface.

### Neutral

- **App Background** (`#F7F4EF`, oklch ≈ 97% 0.003 0): The application canvas. Near-neutral warm white — not blue-tinted, not cream. The slight warmth reduces eye strain under fluorescent clinic lighting without veering into consumer-app territory.
- **Card Surface** (`#FFFFFF`): Primary content containers — patient cards, data tables, billing rows. Pure white against the warm canvas creates clear figure/ground without shadows.
- **Nav Surface** (`#EDE8E0`, oklch ≈ 93% 0.007 250): Sidebar, topbar. Neutral gray with the faintest blue origin — reads as "structural gray" not "blue sidebar." The tonal step to card white is the primary elevation signal; no shadow required.
- **Subtle Surface** (`#E8E1D6`, oklch ≈ 91% 0.008 240): Hover states, selected table rows, input backgrounds on forms. Warm-neutral, not perceptibly blue.
- **Border Default** (`#D9CFC0`): Standard card borders, dividers, input strokes. Medium-value neutral gray — clearly visible without competing with content.
- **Border Strong** (`#A0876B`): Emphasized separators, active input stroke on focus. Used where the border needs to communicate state.
- **Text Primary** (`#1F2A37`): All clinical data, patient names, values, labels. Deep navy-black — never pure black.
- **Text Secondary** (`#2D3748`): Supporting information, metadata, column values.
- **Text Tertiary** (`#4A5568`): Muted labels, empty-state copy, placeholder text.

### State Colors (semantic only — never decorative)

- **Alert Red** (`#C53030`): Critical alerts, overdue TCM, billing errors, danger actions. Meets WCAG AAA (7:1) against white card surface.
- **Warning Amber** (`#B84D00`): High-severity alerts, approaching deadlines. Meets WCAG AA against white; target AAA for critical billing data.
- **Success Green** (`#22543D`): Billing eligibility met, completed screenings, acknowledged alerts. Deep enough for white-background AAA contrast.
- **Muted Teal** (`#234E52`): Secondary informational state — TCM in-progress, care programs active. Never used as a primary accent; always second-tier to the clinical blue.

**The State-Only Rule.** Color is reserved for interactive elements (institutional blue) and clinical state (red/amber/green/teal). No decorative use of color anywhere — no gradient headers, no colorful section dividers, no "visual interest" tints. If a color appears, it carries a clinical meaning. Period.

**The Pairing Rule.** Every state color must appear paired with either a label, icon, or typographic marker. Color alone is prohibited as a state signal. A red tag must also say "Critical." An amber row must also display an overdue indicator.

## 3. Typography

**Display Font:** Fraunces (with Georgia, serif fallback)
**Body Font:** DM Sans (with system-ui, sans-serif fallback)
**Label/Mono Font:** DM Mono (with Courier New, monospace fallback)

**Character:** Fraunces provides institutional gravitas for section titles and patient-facing display text — a serif that reads as considered, not decorative. DM Sans handles the density of clinical data: humanist proportions that stay legible at 14px in a packed data table. DM Mono signals machine provenance — column headers, status tags, and system values that came from a database rather than a human author.

### Hierarchy

- **Display** (Fraunces 300, clamp(1.5rem–2rem), line-height 1.2, letter-spacing -0.01em): Section titles for major panels (Patient Detail, Billing Dashboard), patient names in full-detail views. Appears rarely; its weight signals a significant context.
- **Headline** (DM Sans 700, 1.25rem / 20px, line-height 1.25): Card titles, panel section headers, modal titles. The primary organizational signal within a page.
- **Title** (DM Sans 600, 1rem / 16px, line-height 1.5): Sub-section headers, expandable group titles, form section labels.
- **Body** (DM Sans 400, 0.875rem / 14px, line-height 1.5): All clinical data, list item content, form inputs, descriptions. The dominant text role. Maximum line length: 72ch for prose; no cap for data tables.
- **Label** (DM Mono 600, 0.6875rem / 11px, letter-spacing 0.08em, uppercase): CardHeader labels, status tag text, table column headers, badge values. Telegraphs "this came from a system" — the visual signature of structured clinical data.

**The Mono Label Rule.** DM Mono with uppercase and letter-spacing 0.08em is exclusively for column headers, CardHeader labels, and status tags. Never apply it to patient names, clinical note copy, or any text that a human wrote. The moment a patient's name appears in DM Mono, the interface feels like a system printout, not a clinical tool.

**The Weight Ceiling Rule.** DM Sans 700 is the maximum weight. Bold 800–900 weights are prohibited. Headlines assert hierarchy through size contrast (1.25rem vs 0.875rem), not brute force weight.

## 4. Elevation

MKL Health is flat by default. Surfaces are distinguished by tonal offset, not shadows. The nav (#EDF2F7) is one step darker than the app canvas (#F7F9FC); cards (#FFFFFF) are one step lighter. This creates clear figure-ground hierarchy without a single `box-shadow` on any in-context surface.

**Shadow Vocabulary**

- **Floating only** (`box-shadow: 0 4px 16px rgba(26, 82, 150, 0.10)`): Applied exclusively to elements that float above the document flow — dropdowns, tooltips, date pickers, the mobile sidebar when open. One shadow value, one use case.
- **Focus ring** (`outline: 2px solid #3182CE; outline-offset: 2px`): Applied on `:focus-visible` to all interactive elements. The only blue glow in the system.

**The Flat Floor Rule.** Every in-context surface rests on the same plane. Cards are not elevated above the page — they are distinguished by whiteness against the slightly tinted canvas. If you reach for `box-shadow` on a card, a list item, or a section, stop. Use surface color and border instead.

## 5. Components

### Buttons

Clinical utility over visual weight. Buttons telegraph action potential, not brand enthusiasm.

- **Shape:** Gently rounded (8px radius). Not pill-shaped (too consumer-app) and not sharp-cornered (too legacy-EHR).
- **Primary** (bg #1A5496, text #FFFFFF, padding 10px 18px): For the single most important action in a context — Save, Acknowledge, Submit. One per visible screen area. Minimum height 44px.
- **Primary Hover:** bg #154279, 150ms ease-out transition. No transform, no shadow lift. The color shift is sufficient.
- **Ghost / Secondary** (border 1px solid #C8D6E5, bg transparent, text #1F2A37): For secondary actions — Cancel, View Details, Export. On hover: bg #E4EDF5.
- **Danger** (bg #C53030, text #FFFFFF): For irreversible actions only — delete, revoke, reset. Never used for mere warnings. Requires confirmation step before destructive database operations.

**The One-Per-Zone Rule.** One primary button per visual zone. If two actions both need primary weight, one is wrong.

### Tags / Status Chips

The primary vehicle for clinical state on list items and table rows.

- **Shape:** 4px radius. Compact rectangular profile — communicates data provenance, not UI playfulness.
- **Default** (bg #E4EDF5, text #4A5568, DM Mono 600 11px uppercase): Non-semantic labels, categories, neutral status.
- **Green** (bg #C6F6D5, text #22543D): Billing eligible, screening complete, alert resolved.
- **Red** (bg #FED7D7, text #C53030): Critical alert, overdue, billing error.
- **Amber** (bg #FEEBC8, text #B84D00): High severity, approaching deadline, pending review.
- **Teal** (bg #B2F5EA, text #234E52): In-progress, active episode, scheduled.

**Always paired with label text. Never appears without its textual descriptor.** The tag shape and color reinforce the copy; they do not replace it.

### Cards / Containers

- **Corner Style:** Gently rounded (10px radius) — approachable enough to not feel like a spreadsheet, restrained enough to feel clinical.
- **Background:** Pure white (#FFFFFF) against the warm neutral canvas (#F7F4EF).
- **Shadow Strategy:** None. Flat surface. Border distinguishes card from canvas.
- **Border:** 1px solid #C8D6E5 (Border Default). Only strengthened to #9EAEC0 for focus states or interactive card rows on hover.
- **Internal Padding:** 16px default (md). 12px for compact data rows. 24px for detail panels. Never 0 for text-bearing content.

**CardHeader** (DM Mono, 11px, uppercase, letter-spacing 0.08em, color #4A5568, border-bottom 1px solid #C8D6E5, padding 12px 16px): Every Card has a CardHeader that labels the data below. This is the system's primary information architecture signal — the label in DM Mono signals "this is a data block" to trained clinical eyes.

### Severity Indicator

Replaces the side-stripe SevBar pattern (prohibited — see Do's and Don'ts). For alert rows with severity states:

- **Row background tint** matching severity surface token (e.g., bg #FED7D7 at 40% opacity for critical rows) combined with a leading severity Tag.
- The tint covers the full row — never a left-border stripe only.

### Inputs / Fields

- **Style:** 1px border #C8D6E5, bg #E4EDF5, radius 8px, body font 14px, height 44px minimum.
- **Focus:** border-color shifts to #3182CE (focus-ring), outline: 2px solid #3182CE at 2px offset.
- **Error:** border-color #C53030, bg #FFF5F5. Error message in DM Sans 14px #C53030 below the field.
- **Disabled:** opacity 0.5, cursor not-allowed. Background remains #E4EDF5.

### Navigation (Sidebar / BottomNav)

- **Sidebar:** bg #EDE8E0, border-right 1px solid #D9CFC0, width 260px.
- **Nav items:** DM Sans 14px 500 weight, color #2D3748, padding 10px 16px, radius 8px on hover. Active state: bg #EBF4FF, color #1A5496, font-weight 600.
- **Badge counts:** DM Mono 11px, bg #C53030, text #FFFFFF, radius 4px, padding 1px 6px. Only visible when count > 0.
- **Mobile BottomNav:** bg #EDE8E0, border-top 1px solid #D9CFC0. Nav buttons use the same active/inactive states as sidebar.
- **Navigation uses `<button>` elements with `onClick` — not `<a>` or `<Link>`.** This prevents the global link color (#1A5496) from overriding the inactive nav color (#2D3748).

### Sparkline (Clinical Data Trend)

- Line color: #1A5496 (Institutional Blue) for neutral data; state colors (green/red/amber) when trend direction carries clinical meaning.
- Points: 3px radius filled circles at same color.
- No grid, no axis labels inside the sparkline — the surrounding context carries that. The line is the signal.

## 6. Do's and Don'ts

### Do:

- **Do** use pure white (#FFFFFF) for card surfaces and the blue-tinted canvas (#F7F9FC) for the app background — the tonal contrast creates structure without shadows.
- **Do** pair every severity indicator with both a color token AND a text label (Tag "Critical", Badge "3 overdue"). Never color alone.
- **Do** use DM Mono exclusively for column headers, CardHeader labels, and status tags — never for patient-authored or clinician-authored content.
- **Do** keep primary buttons to one per visual zone. If two actions compete for primary weight, one is wrong.
- **Do** reserve the institutional blue (#1A5496) for interactive elements only — buttons, active nav, focus rings, links. Zero decorative blue use.
- **Do** target WCAG AAA (7:1) contrast for clinical data values, alert states, and billing status on white card surfaces. Use AA (4.5:1) as the absolute floor.
- **Do** replace severity row indicators with full-row background tints — not side-stripe borders.
- **Do** keep a minimum 44px hit target on all interactive elements, including nav buttons, tags if tappable, and card actions.
- **Do** use `outline: 2px solid #3182CE; outline-offset: 2px` for all focus-visible states — the only visible blue glow permitted.

### Don't:

- **Don't** use dark mode. The current dark-on-black design (`#080C10` background, `#0BC5EA` neon teal) is the startup-cool dark mode anti-reference named in PRODUCT.md. That aesthetic is prohibited.
- **Don't** use neon or high-chroma accent colors. The current teal (#0BC5EA) is replaced by deep institutional blue (#1A5496). High chroma at any hue reads as startup, not health system.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored severity stripe on list items, cards, or alert rows. The existing SevBar component (3px colored left border) is prohibited. Replace with full-row background tint.
- **Don't** use gradient text (`background-clip: text` with gradient background). Clinical authority comes from precision, not visual flash.
- **Don't** use glassmorphism (backdrop-filter blur on decorative card surfaces). Not wrong because it's overdone — wrong because it is not institutional.
- **Don't** add animation personality to loading states. `<Spin />` is a loading indicator, not a brand moment. No bounces, no elastic easing, no "fun" spinners.
- **Don't** use cheery UI copy, emoji, gamification cues, or patient-facing warmth. This is a clinician workflow tool. Tone is terse, precise, professional.
- **Don't** use `#000000` or `#FFFFFF` as background colors at the application canvas level. The canvas is warm neutral (#F7F4EF), not pure white and not blue-tinted.
- **Don't** use color for decoration anywhere. If a color appears and a clinician can't immediately interpret what clinical state it represents, it should not be there.
- **Don't** apply DM Sans Bold (700) above the headline level. No 800 or 900 weights. Hierarchy through size, not brute weight.
