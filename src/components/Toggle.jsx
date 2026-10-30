import styles from './Toggle.module.css'

// iOS 風格開關
export default function Toggle({ label, checked, onChange, size = 'md' }) {
  return (
    <label className={`${styles.wrap} ${styles[size]}`}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={styles.input} />
      <span aria-hidden="true" className={styles.track}>
        <span className={styles.knob} />
      </span>
    </label>
  )
}
