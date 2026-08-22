import { useCallback, useEffect, useState } from 'react'

/**
 * Runs async loaders in parallel and keeps per-key results so one failing
 * section does not blank a whole page.
 *
 * loaders: object mapping a key to a () => Promise function.
 * Returns { loading, data, errors, retry } where data/errors are keyed maps;
 * errors[key] is the Error thrown by that loader.
 */
export function useAsyncData(loaders) {
  const keys = Object.keys(loaders)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState({ loading: true, data: {}, errors: {} })

  useEffect(() => {
    let cancelled = false

    async function run() {
      setState({ loading: true, data: {}, errors: {} })
      const results = await Promise.allSettled(keys.map((key) => loaders[key]()))
      if (cancelled) return

      const data = {}
      const errors = {}
      keys.forEach((key, index) => {
        const result = results[index]
        if (result.status === 'fulfilled') {
          data[key] = result.value
        } else {
          errors[key] = result.reason instanceof Error ? result.reason : new Error(String(result.reason))
        }
      })
      setState({ loading: false, data, errors })
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  return { ...state, retry }
}
