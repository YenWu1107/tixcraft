import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import PurchaseBar from '../components/PurchaseBar'
import Icon from '../components/Icon'
import { useEventData } from '../data/catalog'
import { MAX_TICKETS, ZONES, formatPrice, getZone, zoneName } from '../data/lumen'
import { sectionStats } from '../data/domeLayout'
import { usePurchase } from '../context/PurchaseContext'
import styles from './Quantity.module.css'

// 座位視野：用同一個 3D 大巨蛋模型，從選取的區域看向舞台（延遲載入 three.js）
const Dome3D = lazy(() => import('../components/dome/Dome3D'))

// 7-5 選擇張數：預覽座位視野，調整張數與配位方式
const SEAT_MODES = [
  { id: 'together', title: '電腦配位・連號優先', desc: '系統自動挑選同排相鄰座位' },
  { id: 'any', title: '接受不連號', desc: '搶票成功率較高' },
]


export default function Quantity() {
  const { zoneId, qty, seatMode, update } = usePurchase()
  const { getTier } = useEventData()
  const zone = getZone(zoneId)
  const tier = getTier(zone.tier)
  const subtotal = tier.price * qty
  const stats = sectionStats(zone)
  const viewFacts = [
    ['與舞台距離', `約 ${stats.distance} 公尺`],
    ['視角', `${stats.facing}・${stats.angle}`],
    ['離地高度', zone.kind === 'floor' ? '場地平面' : `約 ${stats.height} 公尺`],
  ]

  return (
    <div>
      <SiteHeader active="programs" showSearch={false} />
      <PurchaseBar step={2} canChangeSession />

      <main className={styles.main}>
        <section aria-labelledby="view-title" className={`card ${styles.viewCard}`}>
          <div className={styles.head}>
            <div>
              <h1 id="view-title" className={styles.h1}>座位視野預覽</h1>
              <p className={styles.lead}>從 {zoneName(zone)}（{tier.name}）望向舞台的 3D 模擬畫面。</p>
            </div>
            <div role="tablist" aria-label="切換檢視" className={styles.segmented}>
              <button type="button" role="tab" aria-selected="true" className={`${styles.segBtn} ${styles.segActive}`}>
                視野預覽
              </button>
              <Link to="/zone" role="tab" aria-selected="false" className={styles.segBtn}>
                座位圖
              </Link>
            </div>
          </div>

          <div className={styles.view} role="img" aria-label={`從 ${zoneName(zone)}望向舞台的 3D 視野模擬`}>
            <Suspense fallback={<div className={styles.loading}>載入 3D 視野中…</div>}>
              <Dome3D zones={ZONES} selectedId={zone.id} mode="preview" />
            </Suspense>
            <span className={styles.youAreHere}>從 {zoneName(zone)} 看出去</span>
          </div>

          <div className={styles.facts}>
            {viewFacts.map(([k, v]) => (
              <div key={k} className={styles.fact}>
                <div className={styles.factLabel}>{k}</div>
                <div className={styles.factValue}>{v}</div>
              </div>
            ))}
          </div>
        </section>

        <aside aria-labelledby="qty-title" className={`card ${styles.side}`}>
          <div className={styles.zoneRow}>
            <div>
              <div className={styles.zoneTier}>
                <span className="swatch" style={{ background: tier.color }} />
                <span>{tier.name}</span>
              </div>
              <div className={styles.zoneName}>
                {zoneName(zone)}・NT${formatPrice(tier.price)}
              </div>
            </div>
            <Link to="/zone" className={styles.rechoose}>重選票區</Link>
          </div>

          <div>
            <h2 id="qty-title" className={styles.h2}>購買張數</h2>
            <div className={styles.stepper}>
              <button
                type="button"
                aria-label="減少一張"
                disabled={qty <= 1}
                onClick={() => update({ qty: qty - 1 })}
                className={styles.minus}
              >
                <Icon name="minus" size={20} strokeWidth={2.2} />
              </button>
              <output aria-live="polite" className={styles.qty}>{qty} 張</output>
              <button
                type="button"
                aria-label="增加一張"
                disabled={qty >= MAX_TICKETS}
                onClick={() => update({ qty: qty + 1 })}
                className={styles.plus}
              >
                <Icon name="plus" size={20} strokeWidth={2.2} />
              </button>
            </div>
            <p className={styles.limit}>每人每場限購 {MAX_TICKETS} 張・實名制票券</p>
          </div>

          <fieldset className={styles.fieldset}>
            <legend className={styles.legend}>配位方式</legend>
            {SEAT_MODES.map((m) => (
              <label key={m.id} className={`${styles.option} ${seatMode === m.id ? styles.optionActive : ''}`}>
                <input
                  type="radio"
                  name="seat"
                  checked={seatMode === m.id}
                  onChange={() => update({ seatMode: m.id })}
                  className={styles.radio}
                />
                <span>
                  <span className={styles.optionTitle}>{m.title}</span>
                  <span className={styles.optionDesc}>{m.desc}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className={styles.total}>
            <div className={styles.calc}>
              <span>NT${formatPrice(tier.price)} × {qty} 張</span>
              <span>NT${formatPrice(subtotal)}</span>
            </div>
            <div className={styles.subtotal}>
              <span className={styles.subtotalLabel}>小計</span>
              <span className={styles.subtotalValue}>NT${formatPrice(subtotal)}</span>
            </div>
            <Link to="/verify" className="btn-primary">
              下一步：安全驗證
              <Icon name="chevronRight" size={18} strokeWidth={2} />
            </Link>
            <p className={styles.hint}>
              <Icon name="info" size={16} style={{ flex: '0 0 auto', marginTop: 2 }} />
              通過驗證後，系統會為你保留票券 10 分鐘。
            </p>
          </div>
        </aside>
      </main>
    </div>
  )
}
