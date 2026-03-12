import { useToast } from '../context/ToastContext'

export function Toasts() {
  const { toasts } = useToast()
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast--${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  )
}
