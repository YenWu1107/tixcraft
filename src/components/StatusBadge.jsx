import { STATUS } from '../data/events'
import styles from './StatusBadge.module.css'

// 統一的售票狀態標籤：熱賣中／即將開賣／少量餘票／已售完
// variant="pill"：白底膠囊（疊在海報上）；variant="inline"：純文字＋圓點
export default function StatusBadge({ status, variant = 'pill', className = '' }) {
  const { label, color } = STATUS[status]
  return (
    <span className={`${styles[variant]} ${className}`} style={{ color }}>
      <span className="dot" />
      {label}
    </span>
  )
}
