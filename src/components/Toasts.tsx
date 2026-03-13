import { useToast } from '../context/ToastContext'
import styles from './Toasts.module.css'

export function Toasts() {
  const { toasts } = useToast()
  const latest = toasts[toasts.length - 1]
  if (!latest) return null

  return (
    <div className={`${styles.bar} ${styles[latest.type]}`} key={latest.id}>
      {latest.message}
    </div>
  )
}
