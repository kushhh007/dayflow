import { useRef, useState } from 'react'
import { useAsyncData } from '../../hooks/useAsyncData.js'
import DashboardCard from '../../components/ui/DashboardCard.jsx'
import StatusBadge from '../../components/ui/StatusBadge.jsx'
import Loading from '../../components/states/Loading.jsx'
import EmptyState from '../../components/states/EmptyState.jsx'
import ErrorState from '../../components/states/ErrorState.jsx'
import * as leaveService from '../../api/leaveService.js'
import './leavePage.css'

// Employee leave (spec §3/§6 scope): balances, apply (Sick requires an
// attachment), own request history, cancellation of PENDING requests only.
// Balances and days are rendered as returned by the service; the frontend
// implements no balance or transaction logic. Client checks below are UX
// mirrors of backend validations.

const LEAVE_TYPES = ['PAID', 'SICK', 'UNPAID']
const LEAVE_TYPE_LABELS = {
  PAID: 'Paid Time Off',
  SICK: 'Sick Leave',
  UNPAID: 'Unpaid Leave',
}

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})

function formatDay(dateString) {
  return dayFormat.format(new Date(`${dateString}T00:00:00`))
}

function formatRange(start, end) {
  return start === end ? formatDay(start) : `${formatDay(start)} – ${formatDay(end)}`
}

export default function LeavePage() {
  const { loading, data, errors, retry } = useAsyncData({
    balances: leaveService.getLeaveBalances,
    requests: leaveService.listLeaveRequests,
  })

  const [form, setForm] = useState({ type: 'PAID', startDate: '', endDate: '', reason: '' })
  const [attachment, setAttachment] = useState(null)
  const fileInputRef = useRef(null)
  const [formError, setFormError] = useState(null)
  const [submitted, setSubmitted] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submitLockRef = useRef(false)

  const [cancelBusyId, setCancelBusyId] = useState(null)
  const [cancelError, setCancelError] = useState(null)
  const cancelLockRef = useRef(false)

  if (loading) {
    return (
      <section className="page">
        <h1>Leave</h1>
        <Loading label="Loading leave…" />
      </section>
    )
  }

  const balances = Array.isArray(data.balances) ? data.balances : []
  const requests = Array.isArray(data.requests) ? data.requests : []
  const sickAttachmentMissing = form.type === 'SICK' && !attachment

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setSubmitted(null)
  }

  function validate() {
    if (!LEAVE_TYPES.includes(form.type)) return 'Select a valid leave type.'
    if (!form.startDate || !form.endDate) return 'Start and end dates are required.'
    if (form.endDate < form.startDate) return 'End date must be on or after the start date.'
    if (form.startDate.slice(0, 4) !== form.endDate.slice(0, 4)) {
      return 'Leave requests cannot span two calendar years.'
    }
    if (!form.reason.trim()) return 'A reason is required.'
    if (form.type === 'SICK' && !attachment) {
      return 'Sick leave requires an attachment.'
    }
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitLockRef.current || submitting) return
    const validationError = validate()
    if (validationError) {
      setFormError(validationError)
      return
    }
    submitLockRef.current = true
    setSubmitting(true)
    setFormError(null)
    try {
      const request = await leaveService.applyLeave({
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        ...(form.type === 'SICK' ? { attachmentName: attachment?.name } : {}),
      })
      setSubmitted(request)
      setForm({ type: 'PAID', startDate: '', endDate: '', reason: '' })
      setAttachment(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      retry()
    } catch (err) {
      setFormError(err.message || 'Could not submit the leave request.')
    } finally {
      setSubmitting(false)
      submitLockRef.current = false
    }
  }

  async function handleCancel(requestId) {
    if (cancelLockRef.current || cancelBusyId) return
    cancelLockRef.current = true
    setCancelBusyId(requestId)
    setCancelError(null)
    try {
      await leaveService.cancelLeaveRequest(requestId)
      retry()
    } catch (err) {
      setCancelError(err.message || 'Could not cancel the request.')
    } finally {
      setCancelBusyId(null)
      cancelLockRef.current = false
    }
  }

  return (
    <section className="page att">
      <header className="page__header">
        <h1>Leave</h1>
        <p className="page__description">
          Apply for full-day leave, track your requests, and cancel pending ones. Approved leave is
          final.
        </p>
      </header>

      <div className="att__grid">
        <DashboardCard title="My balances" to="/employee/leave" actionLabel="Refresh">
          {errors.balances ? (
            <ErrorState title="Could not load balances" onRetry={retry} />
          ) : balances.length === 0 ? (
            <EmptyState title="No leave allocations found" />
          ) : (
            <ul className="att-list">
              {balances.map((balance) => (
                <li key={balance.type} className="att-row">
                  <div>
                    <p className="att-row__title">{LEAVE_TYPE_LABELS[balance.type] ?? balance.type}</p>
                    {balance.allocated == null ? (
                      <p className="att-row__meta">No allocation — not balance-checked</p>
                    ) : (
                      <p className="att-row__meta">
                        <strong className="leave-available">{balance.available}</strong> of{' '}
                        {balance.allocated} available · {balance.approvedOrUsed} used
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard title="Apply for leave">
          <form className="att-form" onSubmit={handleSubmit} noValidate>
            <label className="att-field">
              <span>Leave type</span>
              <select
                name="type"
                value={form.type}
                onChange={(event) => updateField('type', event.target.value)}
                disabled={submitting}
              >
                {LEAVE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LEAVE_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>

            <div className="att-field-row">
              <label className="att-field">
                <span>Start date</span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) => updateField('startDate', event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
              <label className="att-field">
                <span>End date</span>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(event) => updateField('endDate', event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
            </div>

            <label className="att-field">
              <span>Reason / details</span>
              <textarea
                rows={3}
                placeholder="Why do you need this leave?"
                value={form.reason}
                onChange={(event) => updateField('reason', event.target.value)}
                disabled={submitting}
              />
            </label>

            {form.type === 'SICK' && (
              <label className="att-field">
                <span>Medical attachment (required)</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                  disabled={submitting}
                />
              </label>
            )}

            {formError && (
              <p className="att-banner att-banner--error" role="alert">
                {formError}
              </p>
            )}
            {submitted && (
              <p className="att-banner att-banner--success">
                Leave request submitted for {formatRange(submitted.startDate, submitted.endDate)}.
                Status: {submitted.status}.
              </p>
            )}

            <button
              type="submit"
              className="btn"
              disabled={submitting || sickAttachmentMissing}
              title={sickAttachmentMissing ? 'Attach a medical document to submit sick leave.' : undefined}
            >
              {submitting ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        </DashboardCard>

        <DashboardCard title="My leave requests">
          {errors.requests ? (
            <ErrorState title="Could not load requests" onRetry={retry} />
          ) : requests.length === 0 ? (
            <EmptyState title="You have not applied for leave yet" />
          ) : (
            <>
              {cancelError && (
                <p className="att-banner att-banner--error" role="alert">
                  {cancelError}
                </p>
              )}
              <ul className="att-list">
                {requests.map((request) => (
                  <li key={request.id} className="att-row">
                    <div>
                      <p className="att-row__title">
                        {LEAVE_TYPE_LABELS[request.type] ?? request.type} · {formatRange(request.startDate, request.endDate)}
                      </p>
                      <p className="att-row__meta">
                        {request.days} {request.days === 1 ? 'day' : 'days'} · {request.reason}
                        {request.attachmentName ? ` · 📎 ${request.attachmentName}` : ''}
                      </p>
                    </div>
                    <div className="leave-row__actions">
                      <StatusBadge status={request.status} />
                      {request.status === 'PENDING' && (
                        <button
                          type="button"
                          className="leave-cancel"
                          disabled={Boolean(cancelBusyId)}
                          onClick={() => handleCancel(request.id)}
                        >
                          {cancelBusyId === request.id ? 'Cancelling…' : 'Cancel'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DashboardCard>
      </div>
    </section>
  )
}
