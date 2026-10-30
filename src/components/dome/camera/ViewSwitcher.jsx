import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { getZone, zoneName } from '../../../data/lumen'
import { DEFAULT_VIEW, VIEWS } from './views'
import styles from './ViewSwitcher.module.css'

// 視角切換：畫布底部置中的毛玻璃分段按鈕（radiogroup，方向鍵切換）
// 「我的視野」需要先選區；在我的視野時左上角顯示「從 ○○ 區看向舞台」

const ICONS = {
  overview: (
    <>
      <ellipse cx="8" cy="6" rx="6" ry="2.8" />
      <path d="M2 6v3.6c0 1.6 2.7 2.8 6 2.8s6-1.2 6-2.8V6" />
    </>
  ),
  top: (
    <>
      <rect x="2" y="2" width="12" height="12" rx="3" />
      <ellipse cx="8" cy="8" rx="3.4" ry="4.2" />
    </>
  ),
  left: (
    <>
      <path d="M6 3.5 2.5 8 6 12.5" />
      <path d="M9 3.5v9M12.5 5v6" />
    </>
  ),
  right: (
    <>
      <path d="M10 3.5 13.5 8 10 12.5" />
      <path d="M7 3.5v9M3.5 5v6" />
    </>
  ),
  stage: (
    <>
      <rect x="2.5" y="2.5" width="11" height="7" rx="1.2" />
      <path d="M1.5 13h13M5 9.5v3.5M11 9.5v3.5" />
    </>
  ),
  seat: (
    <>
      <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
}

function Icon({ id }) {
  return (
    <svg className={styles.icon} viewBox="0 0 16 16" aria-hidden="true">
      {ICONS[id]}
    </svg>
  )
}

export default function ViewSwitcher({ view, onChange, selectedId }) {
  const hasSelection = !!selectedId
  const groupRef = useRef(null)
  const btnRefs = useRef({})
  const [thumb, setThumb] = useState(null)
  const enabled = (id) => id !== 'seat' || hasSelection

  // 取消選區時離開「我的視野」
  useEffect(() => {
    if (view === 'seat' && !hasSelection) onChange(DEFAULT_VIEW)
  }, [view, hasSelection, onChange])

  // 滑動的亮色底塊：量目前按鈕的位置
  useLayoutEffect(() => {
    const group = groupRef.current
    if (!group) return
    const measure = () => {
      const b = btnRefs.current[view]
      if (!b) return setThumb(null)
      setThumb({ x: b.offsetLeft, w: b.offsetWidth })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(group)
    return () => ro.disconnect()
  }, [view])

  // 鍵盤：左右／上下切換（跳過停用的）、Home／End
  const onKeyDown = (e) => {
    const ids = VIEWS.map((v) => v.id).filter(enabled)
    const i = ids.indexOf(view)
    let next = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = ids[(i + 1) % ids.length]
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = ids[(i - 1 + ids.length) % ids.length]
    else if (e.key === 'Home') next = ids[0]
    else if (e.key === 'End') next = ids[ids.length - 1]
    if (!next) return
    e.preventDefault()
    onChange(next)
    btnRefs.current[next]?.focus()
    btnRefs.current[next]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }

  const seatZone = view === 'seat' && selectedId ? getZone(selectedId) : null

  return (
    <div className={styles.overlay}>
      {seatZone && (
        <div className={styles.caption} role="status">
          <Icon id="seat" />
          <span>
            從 <b>{zoneName(seatZone)}</b> 看向舞台
          </span>
        </div>
      )}

      <div className={styles.dock}>
        <div
          ref={groupRef}
          className={styles.group}
          role="radiogroup"
          aria-label="切換 3D 視角"
          onKeyDown={onKeyDown}
        >
          {thumb && (
            <span
              className={styles.thumb}
              style={{ transform: `translateX(${thumb.x}px)`, width: thumb.w }}
              aria-hidden="true"
            />
          )}
          {VIEWS.map((v) => {
            const active = v.id === view
            const disabled = !enabled(v.id)
            return (
              <button
                key={v.id}
                ref={(el) => (btnRefs.current[v.id] = el)}
                type="button"
                role="radio"
                aria-checked={active}
                aria-disabled={disabled || undefined}
                tabIndex={active ? 0 : -1}
                title={disabled ? '請先在模型上點選一個區域' : v.hint}
                className={`${styles.seg} ${active ? styles.active : ''} ${v.id === 'seat' ? styles.seatSeg : ''}`}
                onClick={() => !disabled && !active && onChange(v.id)}
              >
                <Icon id={v.id} />
                <span>{v.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
