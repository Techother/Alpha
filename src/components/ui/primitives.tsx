// cardiotrack/src/components/ui/primitives.tsx
// Shared UI primitives for CardioTrack — clinical white design system
// All components import T and F from @/lib/tokens

import React from 'react'
import { T, F } from '@/lib/tokens'

// ── Spin ─────────────────────────────────────────────────────
export function Spin({ size = 16 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      border: `2px solid ${T.border}`, borderTopColor: T.blue,
      borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0
    }} />
  )
}

// ── Empty ────────────────────────────────────────────────────
export function Empty({ icon = '○', msg }: { icon?: string; msg: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 16px', color: T.textTert }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 14, fontFamily: F.body }}>{msg}</div>
    </div>
  )
}

// ── Btn ──────────────────────────────────────────────────────
export type BtnV = 'primary' | 'ghost' | 'danger'

export function Btn({
  children, onClick, variant = 'primary', disabled, style: s,
  type = 'button', full, title
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: BtnV
  disabled?: boolean
  style?: React.CSSProperties
  type?: 'button' | 'submit'
  full?: boolean
  title?: string
}) {
  const base: React.CSSProperties = {
    fontFamily: F.body, fontSize: 14, fontWeight: 500,
    padding: '10px 18px', borderRadius: 8,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: '1px solid transparent',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    transition: 'opacity 0.15s, background-color 0.15s',
    minHeight: 44, width: full ? '100%' : undefined,
    WebkitTapHighlightColor: 'transparent',
  }
  const v: Record<BtnV, React.CSSProperties> = {
    primary: { background: T.blue, color: '#FFFFFF' },
    ghost:   { background: 'transparent', color: T.text, border: `1px solid ${T.border}` },
    danger:  { background: T.red, color: '#FFFFFF' },
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title}
      style={{ ...base, ...v[variant], ...s }}>
      {children}
    </button>
  )
}

// ── Tag ──────────────────────────────────────────────────────
export type TagT = 'default' | 'green' | 'red' | 'amber' | 'teal'

export function Tag({ children, type = 'default' }: { children: React.ReactNode; type?: TagT }) {
  const c: Record<TagT, [string, string]> = {
    default: [T.subtle,       T.textTert],
    green:   [T.greenSurface, T.green],
    red:     [T.redSurface,   T.red],
    amber:   [T.amberSurface, T.amber],
    teal:    [T.tealSurface,  T.teal],
  }
  return (
    <span style={{
      fontFamily: F.mono, fontSize: 10, fontWeight: 600,
      padding: '3px 8px', borderRadius: 4,
      background: c[type][0], color: c[type][1], whiteSpace: 'nowrap'
    }}>
      {children}
    </span>
  )
}

// ── SeverityRow ──────────────────────────────────────────────
// REPLACES SevBar (3px left-border stripe — BANNED per design mandate)
// Pattern: full-row background tint at 40% opacity + leading severity Tag
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low'

const SEV_SURFACE: Record<SeverityLevel, string> = {
  critical: T.redSurface,
  high:     T.amberSurface,
  medium:   T.amberSurface,
  low:      T.tealSurface,
}
const SEV_TAG: Record<SeverityLevel, TagT> = {
  critical: 'red',
  high:     'amber',
  medium:   'amber',
  low:      'teal',
}

export function SeverityRow({
  severity, children, style: s
}: {
  severity: SeverityLevel
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      background: SEV_SURFACE[severity],
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderRadius: 8,
      ...s,
    }}>
      <Tag type={SEV_TAG[severity]}>{severity}</Tag>
      {children}
    </div>
  )
}

// Backward-compatible alias — pages that reference SevBar can use SeverityRow instead
// Do not re-export the old SevBar; this alias reminds migrators of the replacement
export { SeverityRow as SevBar }

// ── Card ─────────────────────────────────────────────────────
export function Card({ children, style: s }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: 'hidden', ...s }}>
      {children}
    </div>
  )
}

// ── CardHeader ───────────────────────────────────────────────
// style prop added to fix TS2322 pre-existing error (COMP-05)
export function CardHeader({
  children, style: s
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      padding: '12px 16px', borderBottom: `1px solid ${T.border}`,
      fontFamily: F.mono, fontSize: 11, color: T.textTert,
      textTransform: 'uppercase', letterSpacing: 1,
      ...s,
    }}>
      {children}
    </div>
  )
}

// ── Sparkline ────────────────────────────────────────────────
export function Sparkline({ checkins, color = T.blue }: { checkins: unknown[]; color?: string }) {
  const vals = [...checkins].reverse()
    .map((c) => Number((c as Record<string, unknown>).weight_lbs))
    .filter(v => !isNaN(v) && v > 0)
  if (vals.length < 2) {
    return <div style={{ color: T.textTert, fontSize: 12, padding: '8px 0' }}>Not enough data</div>
  }
  const min = Math.min(...vals); const max = Math.max(...vals); const range = max - min || 1
  const W = 260; const H = 56; const p = 6
  const pts = vals.map((v, i) =>
    `${(p + (i / (vals.length - 1)) * (W - p * 2)).toFixed(1)},${(H - p - ((v - min) / range) * (H - p * 2)).toFixed(1)}`
  ).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', maxWidth: W }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      {vals.map((v, i) => {
        const x = p + (i / (vals.length - 1)) * (W - p * 2)
        const y = H - p - ((v - min) / range) * (H - p * 2)
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} fill={color} />
      })}
    </svg>
  )
}

// ── SelectField ──────────────────────────────────────────────
export function SelectField({
  label, value, onChange, options
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8,
        color: T.text, fontFamily: F.body, fontSize: 14, padding: '11px 14px', minHeight: 44, outline: 'none'
      }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

// ── Field ────────────────────────────────────────────────────
export function Field({
  label, value, onChange, type = 'text', placeholder, required
}: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontFamily: F.mono, fontSize: 10, color: T.textTert, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} required={required} style={{
          background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 8,
          color: T.text, fontFamily: F.body, fontSize: 15, padding: '11px 14px',
          outline: 'none', width: '100%', minHeight: 44
        }} />
    </label>
  )
}
