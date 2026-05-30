// cardiotrack/src/lib/tokens.ts
// Clinical white design system — replaces dark-mode T/F in App.tsx
// Source of truth: DESIGN.md + design_mandate in phase prompt

export const T = {
  // Surfaces
  bg:           '#F8F9FA',   // app canvas (replaces old T.bg '#080C10')
  card:         '#FFFFFF',   // card backgrounds (replaces old T.s2 '#111820')
  nav:          '#ECEEF2',   // sidebar, topbar (replaces old T.s1 '#0D1117')
  subtle:       '#E5E8EE',   // hover, inputs, selected rows (replaces old T.s3 '#16202C')

  // Borders
  border:       '#D0D5DD',   // all borders, dividers (replaces old T.border '#1E2D3D')
  borderStrong: '#A8B0BE',   // emphasized borders, focus

  // Text
  text:         '#1A202C',   // primary text (replaces old T.text '#E2E8F0')
  textSec:      '#2D3748',   // secondary text (replaces old T.mid '#718096')
  textTert:     '#4A5568',   // muted/label/placeholder (replaces old T.dim '#2D3748')

  // Clinical accent
  blue:         '#1A5496',   // institutional blue — buttons, active nav, links (replaces old T.teal '#0BC5EA')
  blueHover:    '#154279',   // hover state for primary interactive
  blueSurface:  '#EBF4FF',   // selected rows, active nav bg, info callouts

  // State — semantic only, never decorative
  red:          '#C53030',   // critical alerts, danger (replaces old T.red '#E53E3E')
  amber:        '#B84D00',   // high severity, overdue (replaces old T.amber '#DD6B20')
  green:        '#22543D',   // billing eligible, success (replaces old T.green '#38A169')
  teal:         '#234E52',   // in-progress, care programs (replaces old T.teal second use)

  // State surfaces
  redSurface:   '#FED7D7',
  amberSurface: '#FEEBC8',
  greenSurface: '#C6F6D5',
  tealSurface:  '#B2F5EA',

  // Focus
  focus:        '#3182CE',   // focus ring color
} as const

export const F = {
  display: "'Fraunces', Georgia, serif",
  body:    "'DM Sans', system-ui, sans-serif",
  mono:    "'DM Mono', 'Courier New', monospace",
} as const
