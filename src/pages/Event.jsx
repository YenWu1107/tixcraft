import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import StatusBadge from '../components/StatusBadge'
import Icon from '../components/Icon'
import { STATUS } from '../data/events'
import { useEvents } from '../context/EventsContext'
import { useEventData } from '../data/catalog'
import { formatPrice } from '../data/lumen'
import { usePurchase } from '../context/PurchaseContext'
import { useAuth } from '../context/AuthContext'
import styles from './Event.module.css'

// 7-3 活動詳情：確認場次、票價與購票流程，點「立即購票」
const TABS = [
  { label: '場次資訊', target: 'session-title' },
  { label: '節目介紹', target: 'about-title' },
  { label: '購票須知', target: 'flow-title' },
  { label: '退票規則', target: null },
]

const FLOW = [
  { title: '選擇票區', desc: '座位圖直接顯示價格與剩餘狀態' },
  { title: '張數與驗證', desc: '預覽座位視野，完成安全驗證' },
  { title: '付款', desc: '票券保留 10 分鐘，費用一次列清楚' },
  { title: '完成取票', desc: '電子票券存入會員中心' },
]

const makeFacts = (organizer) => [
  ['主辦單位', organizer],
  ['演出長度', '約 150 分鐘'],
  ['入場方式', '實名制電子票券'],
  ['購買限制', '每人每場限購 4 張'],
]

export default function Event() {
  const navigate = useNavigate()
  const { eventId } = useParams()
  const { getEvent } = useEvents()
  const { eventId: currentEventId, sessionId, update } = usePurchase()
  const loggedIn = !!useAuth().user
  const { event, sessions, tiers, extra, getSession } = useEventData(eventId)
  const [tab, setTab] = useState(0)
  const [reminded, setReminded] = useState(false)
  const selected = getSession(sessionId)

  // 進入不同活動時，重設購票流程（場次、票區、保留時間），避免沿用上一個活動的選擇
  useEffect(() => {
    if (!getEvent(eventId) || eventId === currentEventId) return
    update({ eventId, sessionId: (sessions.find((s) => s.status !== 'soon') ?? sessions[0]).id, zoneId: '112', holdUntil: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  if (!getEvent(eventId)) return <Navigate to="/" replace />

  const goTab = (i) => {
    setTab(i)
    const id = TABS[i].target
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const chooseSession = (id) => {
    update({ sessionId: id })
    navigate('/zone')
  }

  return (
    <div>
      <SiteHeader active="programs" />

      <section aria-label="節目主視覺" className={styles.hero}>
        <div aria-hidden="true" className={styles.heroArt}>
          <img src={event.banner} alt="" className={styles.heroImg} />
          <div className={styles.shadeLeft} />
          <div className={styles.shadeBottom} />
        </div>
        <div className={styles.heroContent}>
          <nav aria-label="麵包屑" className={styles.crumbs}>
            <Link to="/">首頁</Link>
            <span aria-hidden="true">›</span>
            <Link to={`/search?cat=${event.category}`}>{event.category}</Link>
            <span aria-hidden="true">›</span>
            <span className={styles.crumbCurrent}>{event.shortTitle ?? event.en}</span>
          </nav>
          <span className={styles.liveBadge}>
            <span className="dot" style={{ background: STATUS[event.status].color }} />
            {STATUS[event.status].label}
          </span>
          <div>
            <div className={styles.heroTitle}>{event.en}</div>
            <h1 className={styles.heroH1}>{event.title}</h1>
          </div>
          <div className={styles.heroMeta}>
            <span>{event.category}</span>
            <span aria-hidden="true">·</span>
            <span>實名制電子票</span>
            <span aria-hidden="true">·</span>
            <span>全區劃位</span>
          </div>
          <div className={styles.heroActions}>
            <Link to="/zone" className={`btn-primary ${styles.heroCta}`}>立即購票</Link>
            <button type="button" aria-label="加入關注" className={styles.glassBtn}>
              <Icon name="plus" size={22} strokeWidth={2} />
            </button>
            <button type="button" aria-label="分享" className={styles.glassBtn}>
              <Icon name="share" size={20} />
            </button>
          </div>
        </div>
      </section>

      <main className={styles.main}>
        <div className={styles.content}>
          <div role="tablist" aria-label="節目資訊" className={styles.tabs}>
            {TABS.map((t, i) => (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={tab === i}
                onClick={() => goTab(i)}
                className={`${styles.tab} ${tab === i ? styles.tabActive : ''}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <section aria-labelledby="session-title" className={styles.panel}>
            <h2 id="session-title" className={styles.panelTitle} style={{ marginBottom: 6 }}>選擇場次</h2>
            <p className={styles.panelDesc}>共 {sessions.length} 場・皆於{event.venue}演出</p>
            <div className={styles.sessions}>
              {sessions.map((s) => {
                const isSelected = s.id === selected.id
                const isSoon = s.status === 'soon'
                return (
                  <div
                    key={s.id}
                    className={`${styles.session} ${isSelected ? styles.sessionSelected : ''} ${isSoon ? '' : styles.sessionClickable}`}
                    onClick={isSoon ? undefined : () => update({ sessionId: s.id })}
                  >
                    <div className={styles.dateBlock}>
                      <div className={styles.month}>{s.month}</div>
                      <div className={styles.day}>{s.day}</div>
                      <div className={styles.weekday}>{s.weekday}</div>
                    </div>
                    <div className={styles.sessionInfo}>
                      <div className={styles.sessionTime}>
                        {s.label}
                        {s.extra && <span className={styles.extraTag}>加場</span>}
                      </div>
                      <div className={styles.sessionDesc}>{s.desc}</div>
                    </div>
                    <StatusBadge status={s.status} variant="inline" />
                    {isSoon ? (
                      <button
                        type="button"
                        aria-pressed={reminded}
                        onClick={() => setReminded(!reminded)}
                        className={styles.remindBtn}
                      >
                        <Icon name={reminded ? 'check' : 'bell'} size={16} />
                        {reminded ? '已設定提醒' : '開賣提醒'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          chooseSession(s.id)
                        }}
                        className={isSelected ? styles.chooseBtnPrimary : styles.chooseBtn}
                      >
                        選擇此場
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section aria-labelledby="flow-title" className={styles.panel}>
            <h2 id="flow-title" className={styles.panelTitle} style={{ marginBottom: 18 }}>購票只要 4 步</h2>
            <ol className={styles.flow}>
              {FLOW.map((f, i) => (
                <li key={f.title} className={styles.flowItem}>
                  <div className={styles.flowNum}>{i + 1}</div>
                  <div className={styles.flowTitle}>{f.title}</div>
                  <div className={styles.flowDesc}>{f.desc}</div>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="about-title" className={styles.panel}>
            <h2 id="about-title" className={styles.panelTitle} style={{ marginBottom: 14 }}>節目介紹</h2>
            <p className={styles.about}>
              {extra.about ?? `${event.title}，將於 ${event.date} 在${event.venue}登場。詳細節目內容將由主辦單位陸續公布。`}
            </p>
            <dl className={styles.facts}>
              {makeFacts(extra.organizer ?? '主辦單位').map(([k, v]) => (
                <div key={k} className={styles.fact}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>

        <aside aria-label="購票資訊" className={styles.aside}>
          <div className={styles.buyCard}>
            <div className={styles.priceLabel}>票價</div>
            <div className={styles.priceRange}>NT${formatPrice(tiers[tiers.length - 1].price)} – {formatPrice(tiers[0].price)}</div>
            <ul className={styles.tiers}>
              {tiers.map((t) => (
                <li key={t.id} className={styles.tier}>
                  <span className="swatch" style={{ background: t.color }} />
                  <span className={styles.tierName}>{t.name}</span>
                  <span className={styles.tierAvail} style={{ color: t.availColor }}>{t.avail}</span>
                  <span className={styles.tierPrice}>{formatPrice(t.price)}</span>
                </li>
              ))}
            </ul>
            <div className={styles.selected}>
              <Icon name="calendar" size={18} color="var(--blue)" />
              <span className={styles.selectedText}>
                已選 <strong>{selected.short}</strong>
              </span>
              <a href="#session-title" onClick={(e) => { e.preventDefault(); goTab(0) }}>更改</a>
            </div>
            <Link to="/zone" className={`btn-primary ${styles.buyBtn}`}>立即購票</Link>
            {!loggedIn && (
              <div className={styles.loginTip}>
                <Icon name="lock" size={18} style={{ flex: '0 0 auto', marginTop: 1 }} />
                <span>
                  購票前需<strong>登入並完成手機驗證</strong>，確保一人一票、降低黃牛代搶。
                  <Link to="/login" state={{ from: `/event/${event.id}` }}>先去登入 ›</Link>
                </span>
              </div>
            )}
          </div>

          <div className={styles.venueCard}>
            <div className={styles.venueIcon}>
              <Icon name="pin" size={20} color="var(--text)" />
            </div>
            <div style={{ flex: 1 }}>
              <div className={styles.venueName}>{event.venue}</div>
              <div className={styles.venueAddr}>
                {(extra.address ?? '詳細地址將於開賣前公布').split('\n').map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </div>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(event.venue)}`} target="_blank" rel="noreferrer" className={styles.mapLink}>
                在地圖中開啟 ›
              </a>
            </div>
          </div>
        </aside>
      </main>

      <SiteFooter />
    </div>
  )
}
