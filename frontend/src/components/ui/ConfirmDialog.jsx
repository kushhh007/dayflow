import Modal from './Modal.jsx'
import Button from './Button.jsx'

/**
 * Confirmation dialog for approve/reject style actions.
 * tone: 'primary' | 'danger' — colors the confirm button.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p style={{ margin: 0 }}>{message}</p>
      <footer className="modal__footer" style={{ padding: '16px 0 0', borderTop: 'none' }}>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button variant={tone} loading={busy} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </footer>
    </Modal>
  )
}
