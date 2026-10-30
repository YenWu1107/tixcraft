import { Link } from 'react-router-dom'
import PosterArt from './PosterArt'
import Stepper from './Stepper'
import { useEventData } from '../data/catalog'
import { usePurchase } from '../context/PurchaseContext'
import styles from './PurchaseBar.module.css'

// 購票流程頂部：活動名稱與場次摘要（隨時可返回修改）＋四步驟進度條
export default function PurchaseBar({ step, canChangeSession = false, complete = false }) {
  const { sessionId } = usePurchase()
  const { event, getSession } = useEventData()
  const session = getSession(sessionId)

  return (
    <div className={styles.bar}>
      <div className={`${styles.inner} ${complete ? styles.centered : ''}`}>
        {!complete && (
          <div className={styles.summary}>
            <div className={styles.thumb}>
              <PosterArt event={event} />
              <span className={styles.thumbText}>{event.en.split(' ')[0]}</span>
            </div>
            <div>
              <div className={styles.title}>{event.title}</div>
              <div className={styles.meta}>
                {session.label}・{event.venue}
                {canChangeSession && (
                  <Link to={`/event/${event.id}#session-title`} className={styles.change}>更換場次</Link>
                )}
              </div>
            </div>
          </div>
        )}
        <Stepper current={step} complete={complete} />
      </div>
    </div>
  )
}
