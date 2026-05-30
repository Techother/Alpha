// cardiotrack/src/lib/hooks.ts
// Generic async data-fetching hook extracted from App.tsx lines 153–164
import { useState, useEffect, useCallback } from 'react'

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const run = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await fn()) } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally { setLoading(false) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => { run() }, [run])
  return { data, loading, error, refresh: run }
}
