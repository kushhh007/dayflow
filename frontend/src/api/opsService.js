import { mockResponse } from './mock.js'
import * as attendanceService from './attendanceService.js'
import * as leaveService from './leaveService.js'

// MOCK SERVICE. Contract areas follow the Dayflow v4.5 spec; endpoint paths
// will be defined in docs/api.md by the backend lead and must not be invented
// here. Replace bodies with apiRequest() calls when it lands.
//
// The frontend only RENDERS Ops Intelligence output. The four rules, flags,
// and Attention Score are computed by the backend (spec §10).

export async function getDailyBrief() {
  // Contract area: OPS — Smart Daily Brief for the Admin dashboard. When no
  // flags are active the UI must show the spec's exact empty-state message.
  // The flags, scores, and breakdowns are mock server output. The frontend
  // must render them and never derive a score from the flag contents.
  return mockResponse({
    date: new Date().toISOString().slice(0, 10),
    summary: 'Signals requiring Admin attention are ready for review.',
    flags: [
      {
        id: 'brief-absence',
        type: 'UNEXPLAINED_ABSENCE',
        title: 'Unexplained absence',
        message: 'An attendance record has no approved or pending leave context.',
        employeeName: 'Demo Employee',
        attentionScore: 20,
        breakdown: [{ label: 'Unexplained absence', points: 20 }],
      },
      {
        id: 'brief-coverage',
        type: 'COVERAGE_RISK',
        title: 'Department coverage risk',
        message: 'Approved leave has created a high coverage signal.',
        employeeName: 'Demo Employee',
        attentionScore: 40,
        breakdown: [{ label: 'Department coverage HIGH', points: 40 }],
      },
      {
        id: 'brief-anomaly',
        type: 'ATTENDANCE_ANOMALY',
        title: 'Attendance anomaly',
        message: 'A PRESENT record is missing a check-in timestamp.',
        employeeName: 'Demo Employee',
        attentionScore: 15,
        breakdown: [{ label: 'Payroll/attendance anomaly', points: 15 }],
      },
    ],
    emptyMessage:
      'No issues detected today. All attendance, leave, and payroll signals are within expected parameters.',
  })
}

export async function getAttentionQueue() {
  // Contract area: OPS — Attention-ranked queue; every score must be shown
  // with its per-rule breakdown (+40/+25/+20/+15).
  // This normalized shape is mock-only until docs/api.md defines the real
  // queue response. Ranking is supplied by the service and is not recreated
  // in React.
  const [leaveQueue, correctionQueue] = await Promise.all([
    leaveService.listApprovalQueue(),
    attendanceService.listCorrectionQueue(),
  ])

  const queue = [
    ...leaveQueue.map((item) => ({
      ...item,
      source: 'LEAVE',
      requestId: item.id,
      label: `${item.employeeName} · ${item.type} leave`,
    })),
    ...correctionQueue.map((item) => ({
      ...item,
      source: 'ATTENDANCE_CORRECTION',
      requestId: item.id,
      label: `${item.employeeName} · attendance correction`,
    })),
  ].sort((a, b) => (b.attentionScore ?? 0) - (a.attentionScore ?? 0))

  return mockResponse(queue)
}
