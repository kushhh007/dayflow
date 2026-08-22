import { useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as attendanceService from '../../api/attendanceService.js'
import { isDevWeekendAttendanceEnabled } from '../../api/attendanceService.js'
import './attendancePage.css'

// Employee attendance (spec §5 scope): display status/history, check-in and
// check-out through the service layer, and correction request submission.
// The frontend displays backend-provided statuses and flags; it implements
// no attendance rules, no auto-ABSENT generation, and no payroll logic.
// The 06:00–22:00 window / checkout-after-checkin checks below are UX
// mirrors of backend validations so users get instant feedback.

const WINDOW_START = '06:00'
const WINDOW_END = '22:00'

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatDay(dateString) {
  return dayFormat.format(new Date(`${dateString}T00:00:00`))
}

function formatTimes(record) {
  return `${record.checkIn ?? '—'} – ${record.checkOut ?? '—'}`
}

function localIsoDate(date = new Date()) {
  const offset = date.getTimezoneOffset()
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10)
}

function FinalizedNote() {
  return (
    <p className="att-banner att-banner--warning">
      Payroll finalized — this correction does not affect the existing payslip.
    </p>
  )
}

export default function AttendancePage() {
  const now = new Date()
  const { loading, data, errors, retry } = useAsyncData({
    records: attendanceService.getMyAttendance,
    corrections: attendanceService.listCorrectionRequests,
  })

  // Today panel actions
  const [actionBusy, setActionBusy] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Correction form state
  const [form, setForm] = useState({ date: '', checkIn: '', checkOut: '', reason: '' })
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(null)

  if (loading) {
    return (
      <section className="page">
        <h1>My Attendance</h1>
        <Loading label="Loading attendance…" />
      </section>
    )
  }

  const records = Array.isArray(data.records) ? data.records : []
  const corrections = Array.isArray(data.corrections) ? data.corrections : []

  const todayIso = localIsoDate()
  const todayRecord = records.find((record) => record.date === todayIso) ?? null

  // Presentation-only calendar check for action availability; the backend/mock
  // service remains authoritative and rejects non-working-day actions itself.
  const weekday = now.getDay()
  const todayIsWeekend = weekday === 0 || weekday === 6

  // DEVELOPMENT TEST MODE (mock-only): when enabled, weekend buttons stay
  // usable so the demo flow can be rehearsed on Sat/Sun. Production
  // semantics are unchanged when the flag is off.
  const devWeekendMode = todayIsWeekend && isDevWeekendAttendanceEnabled()
  const weekendBlocked = todayIsWeekend && !devWeekendMode

  async function handleCheck(kind) {
    if (actionBusy) return
    setActionBusy(kind)
    setActionError(null)
    try {
      if (kind === 'in') await attendanceService.checkIn()
      else await attendanceService.checkOut()
      retry()
    } catch (err) {
      setActionError(err.message || 'Action failed.')
    } finally {
      setActionBusy(null)
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setSubmitted(null)
  }

  function validateCorrection() {
    if (!form.date) return 'Select the attendance date to correct.'
    if (!form.checkIn || !form.checkOut) return 'Corrected check-in and check-out times are required.'
    if (form.checkIn < WINDOW_START || form.checkIn > WINDOW_END) {
      return `Check-in must be between ${WINDOW_START} and ${WINDOW_END}.`
    }
    if (form.checkOut < WINDOW_START || form.checkOut > WINDOW_END) {
      return `Check-out must be between ${WINDOW_START} and ${WINDOW_END}.`
    }
    if (form.checkOut <= form.checkIn) return 'Check-out must be after check-in.'
    if (!form.reason.trim()) return 'A reason is required.'
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return
    const validationError = validateCorrection()
    if (validationError) {
      setFormError(validationError)
      return
    }
    setSubmitting(true)
    setFormError(null)
    try {
      const request = await attendanceService.submitCorrection({
        date: form.date,
        correctedCheckIn: form.checkIn,
        correctedCheckOut: form.checkOut,
        reason: form.reason.trim(),
      })
      setSubmitted(request)
      setForm({ date: '', checkIn: '', checkOut: '', reason: '' })
      retry()
    } catch (err) {
      setFormError(err.message || 'Could not submit the correction request.')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedRecord = records.find((record) => record.date === form.date) ?? null

  return (
    <section className="page att">
      <header className="page__header">
        <h1>My Attendance</h1>
        <p className="page__description">
          Check in and out on working days, review your history, and request corrections for Admin
          approval.
        </p>
      </header>

      <div className="att__grid">
        <DashboardCard title="Today">
          {errors.records ? (
            <ErrorState title="Could not load attendance" onRetry={retry} />
          ) : (
            <div className="att-today">
              {todayRecord ? (
                <>
                  <StatusBadge status={todayRecord.status} />
                  <p className="att-today__times">{formatTimes(todayRecord)}</p>
                </>
              ) : (
                <EmptyState title="Not checked in yet" message="No attendance recorded for today." />
              )}

              {todayIsWeekend &&
                (devWeekendMode ? (
                  <p className="att-banner att-banner--warning">
                    DEVELOPMENT TEST MODE — weekend attendance simulation enabled for testing
                    only. This is not production attendance.
                  </p>
                ) : (
                  <p className="att-banner att-banner--muted">
                    Attendance is recorded on working days (Mon–Fri) only.
                  </p>
                ))}

              <div className="att-actions">
                <button
                  type="button"
                  className="btn"
                  disabled={Boolean(actionBusy) || weekendBlocked || Boolean(todayRecord?.checkIn)}
                  onClick={() => handleCheck('in')}
                >
                  {actionBusy === 'in' ? 'Checking in…' : 'Check in'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={
                    Boolean(actionBusy) ||
                    weekendBlocked ||
                    !todayRecord?.checkIn ||
                    Boolean(todayRecord?.checkOut)
                  }
                  onClick={() => handleCheck('out')}
                >
                  {actionBusy === 'out' ? 'Checking out…' : 'Check out'}
                </button>
              </div>

              {actionError && (
                <p className="att-banner att-banner--error" role="alert">
                  {actionError}
                </p>
              )}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="History">
          {errors.records ? (
            <ErrorState title="Could not load history" onRetry={retry} />
          ) : records.length === 0 ? (
            <EmptyState title="No attendance records yet" />
          ) : (
            <ul className="att-list">
              {records.map((record) => (
                <li key={record.id} className="att-row">
                  <div>
                    <p className="att-row__title">{formatDay(record.date)}</p>
                    <p className="att-row__meta">{formatTimes(record)}</p>
                    {record.devWeekendTest && (
                      <p className="att-row__flag att-devtag">Dev test entry (weekend)</p>
                    )}
                    {record.payrollFinalized && (
                      <p className="att-row__flag">In a finalized payroll run</p>
                    )}
                  </div>
                  <StatusBadge status={record.status} />
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="Request a correction">
          <form className="att-form" onSubmit={handleSubmit} noValidate>
            <label className="att-field">
              <span>Attendance date</span>
              <select
                name="date"
                value={form.date}
                onChange={(event) => updateField('date', event.target.value)}
                disabled={submitting}
              >
                <option value="">Select a date…</option>
                {records.map((record) => (
                  <option key={record.id} value={record.date}>
                    {formatDay(record.date)} ({record.status})
                  </option>
                ))}
              </select>
            </label>

            <div className="att-field-row">
              <label className="att-field">
                <span>Corrected check-in</span>
                <input
                  type="time"
                  min={WINDOW_START}
                  max={WINDOW_END}
                  value={form.checkIn}
                  onChange={(event) => updateField('checkIn', event.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className="att-field">
                <span>Corrected check-out</span>
                <input
                  type="time"
                  min={WINDOW_START}
                  max={WINDOW_END}
                  value={form.checkOut}
                  onChange={(event) => updateField('checkOut', event.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>

            <label className="att-field">
              <span>Reason</span>
              <textarea
                rows={3}
                placeholder="Why is this correction needed?"
                value={form.reason}
                onChange={(event) => updateField('reason', event.target.value)}
                disabled={submitting}
              />
            </label>

            {selectedRecord?.payrollFinalized && <FinalizedNote />}

            {formError && (
              <p className="att-banner att-banner--error" role="alert">
                {formError}
              </p>
            )}
            {submitted && (
              <div>
                <p className="att-banner att-banner--success">
                  Correction request submitted for {formatDay(submitted.date)}. Status:{' '}
                  {submitted.status}.
                </p>
                {submitted.payrollFinalized && <FinalizedNote />}
              </div>
            )}

            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit correction request'}
            </button>
          </form>
        </DashboardCard>

        <DashboardCard title="My correction requests">
          {errors.corrections ? (
            <ErrorState title="Could not load requests" onRetry={retry} />
          ) : corrections.length === 0 ? (
            <EmptyState title="No correction requests yet" />
          ) : (
            <ul className="att-list">
              {corrections.map((request) => (
                <li key={request.id} className="att-row">
                  <div>
                    <p className="att-row__title">{formatDay(request.date)}</p>
                    <p className="att-row__meta">
                      {request.correctedCheckIn} – {request.correctedCheckOut} · {request.reason}
                    </p>
                    {request.payrollFinalized && (
                      <p className="att-row__flag">Does not affect the finalized payslip</p>
                    )}
                  </div>
                  <StatusBadge status={request.status} />
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>
    </section>
  )
}
