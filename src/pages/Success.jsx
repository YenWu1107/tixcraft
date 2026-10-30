import { useState } from 'react'
import SiteHeader from '../components/SiteHeader'
import PurchaseBar from '../components/PurchaseBar'
import Icon from '../components/Icon'
import { useEventData } from '../data/catalog'
import { getZone, seatText } from '../data/lumen'
import { usePurchase } from '../context/PurchaseContext'
import styles from './Success.module.css'

// 7-9 購票成功：查看訂單編號與電子票券，加入行事曆
const ORDER_NO = 'TX26121200384'

// 產生 .ics 行事曆檔
const downloadIcs = (session, event) => {
  const day = session.ymd.replaceAll('-', '')
  const [h, m] = session.time.split(':')
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART;TZID=Asia/Taipei:${day}T${h}${m}00`,
    `DURATION:PT2H30M`,
    `SUMMARY:${event.title}`,
    `LOCATION:${event.venue}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${event.id}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Success() {
  const { sessionId, zoneId, qty } = usePurchase()
  const { event, getSession } = useEventData()
  const [copied, setCopied] = useState(false)
  const session = getSession(sessionId)
  const zone = getZone(zoneId)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ORDER_NO)
    } catch {
      // 不支援剪貼簿時忽略
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const nextSteps = [
    { title: '開演前 24 小時開放 QR Code', desc: '屆時會推播與寄信通知你。' },
    qty > 1
      ? { title: '分票給同行好友', desc: `其餘 ${qty - 1} 張票可轉給好友的拓元帳號，各自入場。` }
      : { title: '在 App 收藏票券', desc: '登入拓元 App，入場時不必再找信件。' },
    { title: '入場請攜帶身分證件', desc: '如需退票，請於 12.02（三）前在訂單頁申請。' },
  ]

  return (
    <div>
      <SiteHeader active="orders" showSearch={false} />
      <PurchaseBar complete />

      <main className={styles.main}>
        <div className={styles.content}>
          <div className={styles.checkIcon}>
            <Icon name="check" size={34} strokeWidth={2.6} />
          </div>
          <div>
            <h1 className={styles.h1}>購票成功！</h1>
            <p className={styles.lead}>
              電子票券已存入你的會員中心，
              <br />
              確認信也寄到 koi.lin@example.com。
            </p>
          </div>
          <div className={styles.order}>
            <span className={styles.orderLabel}>訂單編號</span>
            <span className={styles.orderNo}>{ORDER_NO}</span>
            <button type="button" aria-label="複製訂單編號" onClick={copy} className={styles.copy}>
              {copied ? '已複製' : '複製'}
            </button>
          </div>
          <div className={styles.actions}>
            <a href="#" className={`btn-primary ${styles.primary}`}>查看我的票券</a>
            <button type="button" onClick={() => downloadIcs(session, event)} className={styles.secondary}>
              <Icon name="calendar" size={18} />
              加入行事曆
            </button>
          </div>

          <section aria-labelledby="next-title" className={styles.next}>
            <h2 id="next-title" className={styles.h2}>接下來</h2>
            <ol className={styles.steps}>
              {nextSteps.map((s, i) => (
                <li key={s.title}>
                  <span className={styles.stepNum}>{i + 1}</span>
                  <span className={styles.stepText}>
                    <strong>{s.title}</strong>
                    <br />
                    <span>{s.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <article aria-label="電子票券" className={styles.ticket}>
          <div className={styles.ticketHead}>
            <img src={event.banner} alt="" aria-hidden="true" className={styles.ticketImg} />
            <div className={styles.ticketShade} />
            <div className={styles.ticketTitle}>
              <div className={styles.tour}>ECHOES WORLD TOUR 2026</div>
              <div className={styles.artist}>{event.en}</div>
            </div>
          </div>
          <div className={styles.ticketInfo}>
            <div>
              <div className={styles.infoLabel}>日期</div>
              <div className={styles.infoValue}>{session.date}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>開演</div>
              <div className={styles.infoValue}>
                {session.time}
                <span className={styles.infoSmall}>（{session.doors} 入場）</span>
              </div>
            </div>
            <div>
              <div className={styles.infoLabel}>場館</div>
              <div className={styles.infoValue}>{event.venue}</div>
            </div>
            <div>
              <div className={styles.infoLabel}>入口</div>
              <div className={styles.infoValue}>GATE 1</div>
            </div>
            <div className={styles.seat}>
              <div>
                <div className={styles.infoLabel}>座位</div>
                <div className={styles.seatValue}>{seatText(zone, qty)}</div>
              </div>
              <span className={styles.qty}>{qty} 張</span>
            </div>
          </div>
          <div aria-hidden="true" className={styles.perforation}>
            <div className={styles.notchLeft} />
            <div className={styles.notchRight} />
            <div className={styles.dash} />
          </div>
          <div className={styles.qr}>
            <div aria-hidden="true" className={styles.qrIcon}>
              <Icon name="lock" size={34} strokeWidth={1.6} />
            </div>
            <div>
              <div className={styles.qrTitle}>入場 QR Code 尚未開放</div>
              <div className={styles.qrDesc}>{session.qrOpen} 起可在會員中心或 App 出示</div>
            </div>
          </div>
        </article>
      </main>
    </div>
  )
}
