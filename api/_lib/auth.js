// api/_lib/auth.js
// Shared CORS + Supabase JWT verification helper for all proxy functions.
// _lib/ prefix prevents Vercel from treating this as a route.
import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  process.env.PRODUCTION_URL || null,
].filter(Boolean)

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export function handlePreflight(req, res) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(req, res)
    res.status(200).end()
    return true
  }
  return false
}

export async function verifyJwt(req, res) {
  const auth = req.headers.authorization ?? ''
  const jwt = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!jwt) {
    res.status(401).json({ error: 'Missing authorization token' })
    return null
  }
  // Use SUPABASE_URL (server-only, NOT VITE_SUPABASE_URL) + SERVICE_ROLE_KEY.
  // createClient is instantiated per-request — never at module level (prevents
  // user state leakage across warm-started Vercel invocations).
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) {
    res.status(401).json({ error: 'Invalid or expired token' })
    return null
  }
  return user
}
