import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import PurchaseBar from '../components/PurchaseBar'
import Toggle from '../components/Toggle'
import Icon from '../components/Icon'
import { useEventData } from '../data/catalog'
import { ZONES, ZONE_GROUPS, formatPrice, getZone, zoneName } from '../data/lumen'
import { sectionStats } from '../data/domeLayout'
import { usePurchase } from '../context/PurchaseContext'
import styles from './Zone.module.css'

// 3D 模型（three.js）只在這一頁需要，延遲載入讓其他頁面維持輕量
const Dome3D = lazy(() => import('../components/dome/Dome3D'))

// 7-4 選擇票區：臺北大巨蛋 3D 模型與右側票區清單雙向連動，兩邊同步顯示價格與票況
// 固定鏡位，讓使用者一眼看出座位和舞台的相對位置與高度

const groupStatus = (group) => {
  const zones = group.zones.map(getZone)
  if (zones.every((z) => z.soldOut)) return { text: '已售完', soldOut: true }
  if (zones.length === 1 && zones[0].left) return { text: `剩 ${zones[0].left} 席`, color: 'var(--orange)' }
  return { text: '有票', color: 'var(--green)' }
}

export default function Zone() {
  const { zoneId, update } = usePurchase()
  const { tiers: TIERS, getTier } = useEventData()
  const [availableOnly, setAvailableOnly] = useState(false)

  const listRef = useRef(null)

  const zone = getZone(zoneId)
  const tier = getTier(zone.tier)
  const stats = sectionStats(zone)

  // 在 3D 模型上點選時，清單自動捲到選中的按鈕（只捲清單本身，不動整頁）
  useEffect(() => {
    const list = listRef.current
    const btn = list?.querySelector('[aria-pressed="true"]')
    if (!list || !btn || list.scrollHeight <= list.clientHeight) return
    const top = btn.offsetTop - list.offsetTop
    if (top < list.scrollTop || top + btn.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: top - list.clientHeight / 2 + btn.offsetHeight / 2, behavior: 'smooth' })
    }
  }, [zoneId])

  const selectGroup = (group) => {
    if (group.zones.includes(zoneId)) return
    const first = group.zones.map(getZone).find((z) => !z.soldOut)
    if (first) update({ zoneId: first.id })
  }

  return (
    <div>
      <SiteHeader active="programs" showSearch={false} />
      <PurchaseBar step={1} canChangeSession />

      <main className={styles.main}>
        <section aria-labelledby="map-title" className={`card ${styles.mapCard}`}>
          <div className={styles.mapHead}>
            <div>
              <h1 id="map-title" className={styles.h1}>選擇票區</h1>
              <p className={styles.lead}>點 3D 模型或右側清單都可以選，顏色代表票價。</p>
            </div>
            <span className={styles.fixedHint}>
              <Icon name="info" size={15} />
              可切換視角，游標移到區塊上可查看票況
            </span>
          </div>

          <ul aria-label="票價圖例" className={styles.legend}>
            {TIERS.map((t) => (
              <li key={t.id}>
                <span className={styles.legendSwatch} style={{ background: t.color }} />
                {t.name} {formatPrice(t.price)}
              </li>
            ))}
            <li>
              <span className={`${styles.legendSwatch} ${styles.hatchSwatch}`} />
              已售完
            </li>
            <li>
              <span className={`${styles.legendSwatch} ${styles.closedSwatch}`} />
              不開放
            </li>
          </ul>

          <div className={styles.mapBox}>
            <Suspense fallback={<div className={styles.loading}>載入 3D 場館模型中…</div>}>
              <Dome3D zones={ZONES} selectedId={zone.id} onSelect={(id) => update({ zoneId: id })} />
            </Suspense>
          </div>

          {/* 選取區域的相對位置與高度 */}
          <dl aria-live="polite" className={styles.stats}>
            <div className={styles.statMain}>
              <dt>已選區域</dt>
              <dd>
                <span className="swatch" style={{ background: tier.color }} />
                {zoneName(zone)}・{stats.levelLabel}
              </dd>
            </div>
            <div>
              <dt>與舞台距離</dt>
              <dd>約 {stats.distance} 公尺</dd>
            </div>
            <div>
              <dt>離地高度</dt>
              <dd>{zone.kind === 'floor' ? '場地平面' : `約 ${stats.height} 公尺`}</dd>
            </div>
            <div>
              <dt>視角</dt>
              <dd>{stats.facing}・{stats.angle}</dd>
            </div>
          </dl>
        </section>

        <aside aria-labelledby="list-title" className={`card ${styles.listCard}`}>
          <div className={styles.listHead}>
            <h2 id="list-title" className={styles.h2}>票區清單</h2>
            <Toggle label="只看有票" size="sm" checked={availableOnly} onChange={setAvailableOnly} />
          </div>

          {/* 清單在卡片內捲動，下方的「已選票區＋下一步」固定在卡片底部，不必往下滑 */}
          <div ref={listRef} className={styles.tiers}>
            {TIERS.map((t) => (
              <div key={t.id}>
                <div className={styles.tierHead}>
                  <span className="swatch" style={{ background: t.color }} />
                  <span className={styles.tierName}>{t.name}</span>
                  <span className={styles.tierPrice}>NT${formatPrice(t.price)}</span>
                </div>
                {/* 看台分組的標籤較長（例如「左側 103–108」），用兩欄；場地區塊用三欄 */}
                <div className={`${styles.zoneGrid} ${ZONE_GROUPS[t.id].some((g) => g.zones.length > 1) ? styles.zoneGridWide : ''}`}>
                  {ZONE_GROUPS[t.id].map((g) => {
                    const status = groupStatus(g)
                    if (status.soldOut && availableOnly) return null
                    const selected = g.zones.includes(zoneId)
                    if (status.soldOut) {
                      return (
                        <button key={g.label} type="button" disabled className={`${styles.zoneBtn} ${styles.zoneBtnSoldOut}`}>
                          <span className={styles.zoneLabel}>{g.label}</span>
                          <span className={styles.zoneStatus}>已售完</span>
                        </button>
                      )
                    }
                    return (
                      <button
                        key={g.label}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => selectGroup(g)}
                        className={`${styles.zoneBtn} ${selected ? styles.zoneBtnSelected : ''}`}
                      >
                        <span className={styles.zoneLabel}>{g.label}</span>
                        <span className={styles.zoneStatus} style={selected ? undefined : { color: status.color }}>
                          {selected ? (g.zones.length > 1 ? `已選 ${zone.id}` : '已選擇') : status.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className={styles.summary}>
            <div className={styles.summaryRow}>
              <span className={styles.summaryLabel}>已選票區</span>
              <span className={styles.summaryValue}>
                {zoneName(zone)} {tier.name}・NT${formatPrice(tier.price)}
              </span>
            </div>
            <Link to="/quantity" className="btn-primary">
              下一步：選擇張數
              <Icon name="chevronRight" size={18} strokeWidth={2} />
            </Link>
          </div>
        </aside>
      </main>
    </div>
  )
}
