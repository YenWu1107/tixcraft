import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'
import { useEvents } from '../context/EventsContext'
import { formatPrice } from '../data/lumen'
import styles from './HeroCarousel.module.css'

// 首頁主視覺輪播：參考 Apple TV，全幅主視覺＋置中標題＋單一主要按鈕
// - 左右箭頭、圓點、鍵盤左右鍵、觸控滑動都能切換
// - 自動播放（目前這張的圓點會顯示進度），游標移入或聚焦時暫停；可按暫停鈕停止
// - 偏好減少動態效果的使用者不會自動播放
const AUTOPLAY_MS = 7000

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function HeroCarousel() {
  const { heroSlides: SLIDES } = useEvents()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [hovering, setHovering] = useState(false)
  const [pageHidden, setPageHidden] = useState(false)
  const [reminded, setReminded] = useState(() => new Set())
  const [failed, setFailed] = useState(() => new Set())
  const pointerStart = useRef(null)

  const count = SLIDES.length
  const go = (i) => setIndex((i + count) % count)
  const next = () => go(index + 1)
  const prev = () => go(index - 1)
  const paused = !playing || hovering || pageHidden

  // 切到其他分頁時暫停自動播放
  useEffect(() => {
    const onVisibility = () => setPageHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const onKeyDown = (e) => {
    if (e.target.closest('input, textarea, select')) return
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }

  // 觸控滑動：水平移動超過 50px 就換頁
  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse') pointerStart.current = { x: e.clientX, y: e.clientY }
  }
  const onPointerUp = (e) => {
    const start = pointerStart.current
    pointerStart.current = null
    if (!start) return
    const dx = e.clientX - start.x
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - start.y)) (dx < 0 ? next : prev)()
  }

  const toggleRemind = (id) =>
    setReminded((set) => {
      const nextSet = new Set(set)
      nextSet.has(id) ? nextSet.delete(id) : nextSet.add(id)
      return nextSet
    })

  return (
    <section
      aria-label="主打節目"
      aria-roledescription="carousel"
      className={styles.hero}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setHovering(false)}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      <div aria-live={paused ? 'polite' : 'off'}>
        {SLIDES.map((s, i) => {
          const { event } = s
          const active = i === index
          const soon = event.status === 'soon'
          return (
            <div
              key={s.eventId}
              role="group"
              aria-roledescription="slide"
              aria-label={`第 ${i + 1} 則，共 ${count} 則：${event.en}`}
              aria-hidden={!active}
              inert={!active}
              className={`${styles.slide} ${active ? styles.active : ''}`}
              style={{ background: event.art.bg }}
            >
              <div aria-hidden="true" className={styles.art}>
                {!failed.has(s.eventId) && (
                  <img
                    src={s.image}
                    alt=""
                    className={styles.img}
                    style={{ objectPosition: s.position }}
                    onError={() => setFailed((set) => new Set(set).add(s.eventId))}
                  />
                )}
                <div className={styles.watermark}>{s.watermark}</div>
                <div className={styles.shade} />
              </div>

              <div className={styles.content}>
                <span className={styles.tag}>{s.tag}</span>
                <div>
                  <div className={styles.title}>{event.en}</div>
                  <div className={styles.subtitle}>{event.title}</div>
                </div>
                <div className={styles.meta}>
                  <span>{event.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>{s.dateText}</span>
                  <span aria-hidden="true">·</span>
                  <span>{event.venue}</span>
                  <span aria-hidden="true">·</span>
                  <span>NT${formatPrice(event.price)} 起</span>
                </div>
                <div className={styles.actions}>
                  {soon ? (
                    <button
                      type="button"
                      aria-pressed={reminded.has(s.eventId)}
                      onClick={() => toggleRemind(s.eventId)}
                      className={`btn-primary ${styles.cta}`}
                    >
                      <Icon name={reminded.has(s.eventId) ? 'check' : 'bell'} size={19} />
                      {reminded.has(s.eventId) ? '已設定開賣提醒' : `開賣提醒・${event.saleAt}`}
                    </button>
                  ) : (
                    <Link to={`/event/${event.id}`} className={`btn-primary ${styles.cta}`}>
                      立即購票
                    </Link>
                  )}
                  <button type="button" aria-label="加入關注" className={styles.glassBtn}>
                    <Icon name="plus" size={22} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <button type="button" aria-label="上一則" onClick={prev} className={`${styles.arrow} ${styles.arrowLeft}`}>
        <Icon name="chevronLeft" size={26} strokeWidth={2} />
      </button>
      <button type="button" aria-label="下一則" onClick={next} className={`${styles.arrow} ${styles.arrowRight}`}>
        <Icon name="chevronRight" size={26} strokeWidth={2} />
      </button>

      <div className={styles.controls}>
        <div className={styles.dots}>
          {SLIDES.map((s, i) => (
            <button
              key={s.eventId}
              type="button"
              aria-label={`第 ${i + 1} 則：${s.event.en}`}
              aria-current={i === index}
              onClick={() => go(i)}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
            >
              {i === index && playing && (
                // 自動播放進度：動畫跑完就換下一張
                <span
                  key={index}
                  className={styles.dotFill}
                  style={{ animationDuration: `${AUTOPLAY_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                  onAnimationEnd={next}
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={playing ? '暫停輪播' : '播放輪播'}
          onClick={() => setPlaying(!playing)}
          className={styles.playBtn}
        >
          <Icon name={playing ? 'pause' : 'play'} size={14} strokeWidth={2.4} />
        </button>
      </div>
    </section>
  )
}
