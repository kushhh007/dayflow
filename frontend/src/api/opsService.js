import { mockResponse } from './mock.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.
//
// The frontend only RENDERS Ops Intelligence output. The four rules, flags,
// and Attention Score are computed by the backend (spec §10).

export async function getDailyBrief() {
  // Contract area: OPS — Smart Daily Brief for the Admin dashboard. When no
  // flags are active the UI must show the spec's exact empty-state message.
  return mockResponse({ date: null, summary: null, flags: [] })
}

export async function getAttentionQueue() {
  // Contract area: OPS — Attention-ranked queue; every score must be shown
  // with its per-rule breakdown (+40/+25/+20/+15).
  return mockResponse([])
}
