import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import PosterArt from './PosterArt'
import StatusBadge from './StatusBadge'
import { formatPrice } from '../data/lumen'
import styles from './EventCard.module.css'

// 活動卡片：海報、日期、場館、最低票價與售票狀態，在列表層就能判斷能不能買
// variant="upcoming"：即將開賣卡片，底部顯示開賣時間與「開賣提醒」按鈕
export default function EventCard({ event, variant = 'default' }) {
  const upcoming = variant === 'upcoming'
  const [reminded, setReminded] = useState(false)
  const Root = upcoming ? 'div' : Link

  return (
    <Root className={styles.card} {...(upcoming ? {} : { to: `/event/${event.id}` })}>
      <div className={styles.poster}>
        <PosterArt event={event} />
        <div className={styles.scrim} style={{ '--scrim': event.art.bg }} />
        <div className={styles.posterText} style={{ color: event.art.fg }}>
          <div className={styles.posterTitle}>{event.en}</div>
          <div className={styles.posterSub}>{event.sub}</div>
        </div>
        <StatusBadge status={event.status} className={styles.badge} />
      </div>

      <div className={styles.body}>
        <div className={styles.date}>{event.date}</div>
        <div className={styles.title}>{event.title}</div>
        <div className={styles.venue}>
          <Icon name="pin" size={14} />
          {event.venue}
        </div>

        {upcoming ? (
          <>
            <div className={styles.saleAt}>
              <Icon name="clock" size={15} />
              {event.saleAt} 開賣
            </div>
            <button
              type="button"
              aria-pressed={reminded}
              onClick={() => setReminded(!reminded)}
              className={styles.remindBtn}
            >
              <Icon name={reminded ? 'check' : 'bell'} size={16} />
              {reminded ? '已設定提醒' : '開賣提醒'}
            </button>
          </>
        ) : (
          <div className={styles.footer}>
            <span className={styles.price}>NT${formatPrice(event.price)} 起</span>
            <span className={styles.note}>{event.note}</span>
          </div>
        )}
      </div>
    </Root>
  )
}
