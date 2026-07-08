// cardiotrack/src/lib/tokens.ts
// Clinical white design system — replaces dark-mode T/F in App.tsx
// Source of truth: DESIGN.md + design_mandate in phase prompt

export const T = {
  // Surfaces
  bg:           '#F7F4EF',   // app canvas (was '#F8F9FA')
  card:         '#FFFFFF',   // card backgrounds (replaces old T.s2 '#111820')
  nav:          '#EDE8E0',   // sidebar, topbar (was '#ECEEF2')
  subtle:       '#E8E1D6',   // hover, inputs, selected rows (was '#E5E8EE')

  // Borders
  border:       '#D9CFC0',   // all borders, dividers (was '#D0D5DD')
  borderStrong: '#A0876B',   // emphasized borders, focus (was '#A8B0BE')

  // Text
  text:         '#1F2A37',   // primary text (was '#1A202C')
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

// Public register (landing/marketing) — Warm Clinical palette
export const P = {
  canvas:       '#FDFBF8',
  surface:      '#FAF6F0',
  strip:        '#F3ECE1',
  ink:          '#1F2A37',
  body:         '#4A4038',
  muted:        '#7A7267',
  border:       '#E4DDD0',
  borderStrong: '#CBBFA9',
  clay:         '#C1502F',   // bright — large/decorative text and marks only
  clayDeep:     '#A8431F',   // deep — buttons, links, small/interactive text (5.59:1 ivory / 6.02:1 white)
  clayHover:    '#8A3618',
  claySurface:  '#F6E1D8',
  sage:         '#5B7267',
  sageHover:    '#47594F',
  sageSurface:  '#EEF2EE',
} as const
