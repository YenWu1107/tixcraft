import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import PurchaseBar from '../components/PurchaseBar'
import PosterArt from '../components/PosterArt'
import Icon from '../components/Icon'
import { useEventData } from '../data/catalog'
import { HOLD_SECONDS, SERVICE_FEE, STORE_PICKUP_FEE, formatPrice, getZone, seatText } from '../data/lumen'
import { formatClock, useHoldCountdown, usePurchase } from '../context/PurchaseContext'
import styles from './Payment.module.css'

// 7-8 付款：溫和的藍色保留倒數與進度條（取代紅色警告），取票與付款方式，錯誤直接標在欄位下方
const PICKUPS = [
  { id: 'eticket', title: '電子票券', desc: '存入會員中心，入場出示 QR Code・免手續費', recommended: true },
  { id: 'store', title: '超商取票', desc: `開演前 7 天起可取票・NT$${STORE_PICKUP_FEE}／張` },
]

const METHODS = [
  { id: 'card', label: '信用卡', icon: 'card' },
  { id: 'applepay', label: 'Apple Pay' },
  { id: 'linepay', label: 'LINE Pay' },
]

const formatCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ')

export default function Payment() {
  const navigate = useNavigate()
  const { sessionId, zoneId, qty, seatMode, pickup, payMethod, update } = usePurchase()
  const left = useHoldCountdown()
  const [card, setCard] = useState('4311 9522 0817 6402')
  const [exp, setExp] = useState('08 / 29')
  const [cvc, setCvc] = useState('4')
  const [agree, setAgree] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const cvcRef = useRef(null)

  const { event, getSession, getTier } = useEventData()
  const session = getSession(sessionId)
  const zone = getZone(zoneId)
  const tier = getTier(zone.tier)

  const ticketTotal = tier.price * qty
  const serviceTotal = SERVICE_FEE * qty
  const pickupTotal = pickup === 'store' ? STORE_PICKUP_FEE * qty : 0
  const total = ticketTotal + serviceTotal + pickupTotal

  const expired = left === 0
  const cvcInvalid = payMethod === 'card' && (cvc.length > 0 || submitted) && cvc.length < 3
  const cardValid = card.replace(/\s/g, '').length === 16

  const pay = () => {
    setSubmitted(true)
    if (expired || !agree) return
    if (payMethod === 'card' && cvc.length < 3) {
      cvcRef.current?.focus()
      return
    }
    navigate('/success')
  }

  return (
    <div>
      <SiteHeader showSearch={false} />
      <PurchaseBar step={3} />

      <main className={styles.main}>
        <div className={styles.content}>
          <div role="timer" aria-label={`票券保留剩餘 ${Math.floor(left / 60)} 分 ${left % 60} 秒`} className={styles.timer}>
            <div className={styles.timerIcon}>
              <Icon name="clock" size={22} />
            </div>
            <div className={styles.timerBody}>
              {expired ? (
                <>
                  <div className={styles.timerTitle}>保留時間已結束</div>
                  <div className={styles.timerDesc}>
                    票券已釋出，請 <Link to="/zone">重新選擇票區</Link>。
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.timerTitle}>票券已為你保留</div>
                  <div className={styles.timerDesc}>慢慢填沒關係，時間充足；逾時才會釋出給其他人。</div>
                </>
              )}
              <div className={styles.progress}>
                <div className={styles.progressBar} style={{ width: `${(left / HOLD_SECONDS) * 100}%` }} />
              </div>
            </div>
            <div className={styles.clock}>{formatClock(left)}</div>
          </div>

          <section aria-labelledby="pickup-title" className={`card ${styles.panel}`}>
            <h1 id="pickup-title" className={styles.h2}>取票方式</h1>
            <div className={styles.pickups}>
              {PICKUPS.map((p) => (
                <label key={p.id} className={`${styles.option} ${pickup === p.id ? styles.optionActive : ''}`}>
                  <input
                    type="radio"
                    name="pickup"
                    checked={pickup === p.id}
                    onChange={() => update({ pickup: p.id })}
                    className={styles.radio}
                  />
                  <span>
                    <span className={styles.optionTitle}>
                      {p.title}
                      {p.recommended && <span className={styles.recommend}>推薦</span>}
                    </span>
                    <span className={styles.optionDesc}>{p.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="pay-title" className={`card ${styles.panel}`}>
            <h2 id="pay-title" className={styles.h2}>付款方式</h2>
            <div role="radiogroup" aria-label="付款方式" className={styles.methods}>
              {METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={payMethod === m.id}
                  onClick={() => update({ payMethod: m.id })}
                  className={`${styles.method} ${payMethod === m.id ? styles.methodActive : ''}`}
                >
                  {m.icon && <Icon name={m.icon} size={18} />}
                  {m.label}
                </button>
              ))}
            </div>

            {payMethod === 'card' ? (
              <div className={styles.cardForm}>
                <label className={`${styles.field} ${styles.fieldFull}`}>
                  卡號
                  <span className={styles.inputWrap}>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      value={card}
                      onChange={(e) => setCard(formatCard(e.target.value))}
                      className={`${styles.input} ${styles.cardInput}`}
                    />
                    {cardValid && <Icon name="check" size={20} strokeWidth={2.2} color="var(--green)" className={styles.validIcon} />}
                  </span>
                </label>
                <label className={styles.field}>
                  到期日
                  <input
                    type="text"
                    autoComplete="cc-exp"
                    value={exp}
                    onChange={(e) => setExp(e.target.value)}
                    className={styles.input}
                  />
                </label>
                <label className={styles.field}>
                  安全碼
                  <input
                    ref={cvcRef}
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    aria-invalid={cvcInvalid}
                    aria-describedby={cvcInvalid ? 'cvc-error' : undefined}
                    className={`${styles.input} ${cvcInvalid ? styles.inputError : ''}`}
                  />
                  {cvcInvalid && (
                    <span id="cvc-error" className={styles.fieldError}>
                      <Icon name="alert" size={15} />
                      請輸入卡片背面的 3 位數安全碼
                    </span>
                  )}
                </label>
              </div>
            ) : (
              <p className={styles.walletNote}>
                <Icon name="info" size={18} style={{ flex: '0 0 auto' }} />
                按下「確認付款」後會開啟 {METHODS.find((m) => m.id === payMethod).label} 完成付款，完成後自動回到本頁。
              </p>
            )}
          </section>

          <section aria-labelledby="buyer-title" className={`card ${styles.buyer}`}>
            <div className={styles.buyerInfo}>
              <h2 id="buyer-title" className={styles.h2} style={{ margin: 0 }}>購票人資料</h2>
              <p className={styles.buyerText}>林小葵・0912-***-678・koi.lin@example.com</p>
            </div>
            <span className={styles.prefilled}>
              <Icon name="check" size={16} strokeWidth={2.2} />
              已帶入會員資料
            </span>
            <a href="#" className={styles.edit}>編輯</a>
          </section>
        </div>

        <aside aria-labelledby="order-title" className={styles.aside}>
          <h2 id="order-title" className={styles.h2} style={{ margin: 0 }}>訂單摘要</h2>
          <div className={styles.eventRow}>
            <div className={styles.eventThumb}>
              <PosterArt event={event} />
            </div>
            <div>
              <div className={styles.eventName}>{event.shortTitle ?? event.en}</div>
              <div className={styles.eventMeta}>{session.short}・{event.venue}</div>
            </div>
          </div>
          <div className={styles.seat}>
            <div className={styles.seatLabel}>你的座位・{tier.name}</div>
            <div className={styles.seatValue}>{seatText(zone, qty)}</div>
            <div className={styles.seatNote}>{seatMode === 'together' ? '已成功配到連號座位' : '已成功配到座位'}</div>
          </div>
          <dl className={styles.bill}>
            <div><dt>票價 NT${formatPrice(tier.price)} × {qty}</dt><dd>NT${formatPrice(ticketTotal)}</dd></div>
            <div><dt>系統服務費 NT${SERVICE_FEE} × {qty}</dt><dd>NT${formatPrice(serviceTotal)}</dd></div>
            <div><dt>取票手續費</dt><dd>{pickupTotal ? `NT$${pickupTotal}` : '免費'}</dd></div>
            <div className={styles.billTotal}><dt>總計</dt><dd>NT${formatPrice(total)}</dd></div>
          </dl>
          <label className={`${styles.agree} ${submitted && !agree ? styles.agreeError : ''}`}>
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className={styles.checkbox} />
            <span>
              我已閱讀並同意 <a href="#">購票須知</a> 與 <a href="#">退票規則</a>
            </span>
          </label>
          <button type="button" onClick={pay} disabled={expired} className={`btn-primary ${styles.payBtn}`}>
            確認付款 NT${formatPrice(total)}
          </button>
          <p className={styles.secure}>
            <Icon name="lock" size={14} />
            付款資訊全程加密傳輸
          </p>
        </aside>
      </main>
    </div>
  )
}
