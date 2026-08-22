// The Dayflow API contract is not published yet (docs/api.md is pending from
// the backend lead). No service module calls this client yet — they return
// mocked data. When docs/api.md lands, replace each mock body with an
// apiRequest('<documented endpoint>') call using the agreed paths and schemas.
// Endpoint paths are deliberately NOT invented anywhere in this codebase.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(message, { status = 0, statusText = '', payload = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
    this.payload = payload
  }
}

function buildUrl(path) {
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function apiRequest(path, { method = 'GET', body, headers = {}, signal } = {}) {
  // TODO(api): attach the session token here once the auth contract defines
  // how tokens are issued and transported.
  const config = {
    method,
    headers: { ...headers },
    signal,
  }

  if (body !== undefined) {
    config.headers['Content-Type'] = 'application/json'
    config.body = JSON.stringify(body)
  }

  const response = await fetch(buildUrl(path), config)
  let payload = null

  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    throw new ApiError(payload?.message || response.statusText || 'Request failed', {
      status: response.status,
      statusText: response.statusText,
      payload,
    })
  }

  return payload
}
