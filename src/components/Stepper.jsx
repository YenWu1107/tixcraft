import { Fragment } from 'react'
import Icon from './Icon'
import styles from './Stepper.module.css'

const STEPS = ['選擇票區', '張數與驗證', '付款', '完成']

// 購票四步驟進度條；complete=true 時代表全部完成（最後一步顯示綠色勾勾）
export default function Stepper({ current, complete = false }) {
  return (
    <ol aria-label="購票進度" className={styles.steps}>
      {STEPS.map((label, i) => {
        const n = i + 1
        const isDone = complete || n < current
        const isCurrent = complete ? n === STEPS.length : n === current
        return (
          <Fragment key={label}>
            {i > 0 && <li aria-hidden="true" className={`${styles.line} ${n <= current || complete ? styles.lineDone : ''}`} />}
            <li
              aria-current={isCurrent ? 'step' : undefined}
              className={`${styles.step} ${isDone || isCurrent ? styles.reached : ''} ${isCurrent ? styles.current : ''}`}
            >
              <span className={`${styles.num} ${complete && isCurrent ? styles.success : ''}`}>
                {isDone ? <Icon name="check" size={14} strokeWidth={3} /> : n}
              </span>
              {label}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
