const MOCK_LATENCY_MS = 200

/**
 * Simulates network latency and deep-clones the payload so mocked services
 * behave closer to a real API while the shell is developed.
 */
export function mockResponse(data, { latencyMs = MOCK_LATENCY_MS } = {}) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(structuredClone(data)), latencyMs)
  })
}
