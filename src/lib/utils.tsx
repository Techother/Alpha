// cardiotrack/src/lib/utils.tsx
// Utility functions extracted from App.tsx lines 166–184
// ComingSoon uses JSX → .tsx extension required

import React from 'react'
import { T, F } from '@/lib/tokens'

// TagT is defined here (not imported from primitives) to avoid circular dependency.
// primitives.tsx re-exports this type as TagT for pages that import from ui/primitives.
export type TagT = 'default' | 'green' | 'red' | 'amber' | 'teal'

export function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export function riskOrder(r: string): number {
  return r === 'high' ? 0 : r === 'medium' ? 1 : 2
}

export function riskTag(r: string): TagT {
  return r === 'high' ? 'red' : r === 'medium' ? 'amber' : 'green'
}

export function ComingSoon({ title, icon, description, version = 'v2.1' }: {
  title: string; icon: string; description: string; version?: string
}) {
  return (
    <div style={{ textAlign: 'center', padding: 48, background: T.card, border: `1px solid ${T.border}`, borderRadius: 10 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontFamily: F.display, fontSize: 20, fontWeight: 300, marginBottom: 8, color: T.text }}>{title}</div>
      <div style={{ fontSize: 13, color: T.textTert, marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>{description}</div>
      <span style={{ background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 4, padding: '4px 10px', fontSize: 11, fontFamily: F.mono, color: T.textTert }}>
        Coming in {version}
      </span>
    </div>
  )
}
