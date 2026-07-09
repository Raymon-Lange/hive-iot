export default function StatusMessage({ status, onClose }) {
  if (!status) return null

  return (
    <div className={`status-message ${status.type === 'error' ? 'status-message-error' : ''}`}>
      <span>{status.message}</span>
      <button type="button" className="status-message-close" onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  )
}
