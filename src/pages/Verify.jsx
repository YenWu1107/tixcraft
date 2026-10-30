import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import PurchaseBar from '../components/PurchaseBar'
import Icon from '../components/Icon'
import { useAuth } from '../context/AuthContext'
import { useEventData } from '../data/catalog'
import { formatPrice, getZone, zoneName } from '../data/lumen'
import { usePurchase } from '../context/PurchaseContext'
import styles from './Verify.module.css'

// 7-6 安全驗證：高對比大字驗證碼；輸入錯誤時即時提示並自動換新，不跳頁
// 示範用：輸入畫面上的 5 個字（不分大小寫）即可通過
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' // 排除 0/O、1/I/L 等易混淆字元

const randomCode = () =>
  Array.from({ length: 5 }, () => ({
    ch: CHARSET[Math.floor(Math.random() * CHARSET.length)],
    rot: Math.round(Math.random() * 14 - 7),
  }))

const INITIAL = [
  { ch: 'R', rot: -6 },
  { ch: '8', rot: 5 },
  { ch: 'W', rot: -3 },
  { ch: '2', rot: 7 },
  { ch: 'F', rot: -5 },
]

export default function Verify() {
  const navigate = useNavigate()
  const { sessionId, zoneId, qty, seatMode, startHold } = usePurchase()
  const loggedIn = !!useAuth().user
  const { getSession, getTier } = useEventData()
  const [code, setCode] = useState(INITIAL)
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [refreshed, setRefreshed] = useState(false)

  const zone = getZone(zoneId)
  const tier = getTier(zone.tier)
  const answer = code.map((c) => c.ch).join('')

  const refresh = () => {
    setCode(randomCode())
    setRefreshed(true)
  }

  const speak = () => {
    if (!('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance(answer.split('').join(' '))
    u.lang = 'en-US'
    u.rate = 0.7
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  const submit = (e) => {
    e.preventDefault()
    if (!value.trim()) {
      setError('empty')
      return
    }
    if (value.trim().toUpperCase() !== answer) {
      setError('wrong')
      setValue('')
      refresh()
      return
    }
    startHold()
    navigate(loggedIn ? '/payment' : '/login')
  }

  return (
    <div>
      <SiteHeader active="programs" showSearch={false} />
      <PurchaseBar step={2} />

      <main className={styles.main}>
        <section aria-labelledby="verify-title" className={`card ${styles.verifyCard}`}>
          <form onSubmit={submit} className={styles.inner} noValidate>
            <div className={styles.intro}>
              <div className={styles.badgeIcon}>
                <Icon name="shieldCheck" size={30} />
              </div>
              <h1 id="verify-title" className={styles.h1}>安全驗證</h1>
              <p className={styles.lead}>
                輸入下圖中的 5 個英數字，確認是你本人操作。
                <br />
                不分大小寫，看不清楚可以換一張或改聽語音。
              </p>
            </div>

            <div className={styles.captchaBox}>
              <div role="img" aria-label="驗證碼圖片" className={styles.captcha}>
                <svg aria-hidden="true" viewBox="0 0 400 120" preserveAspectRatio="none" className={styles.noise}>
                  <path d="M0 80 C 80 40, 160 110, 240 60 S 360 30, 400 70" fill="none" stroke="#D2D2D7" strokeWidth="2" />
                </svg>
                {code.map((c, i) => (
                  <span
                    key={`${answer}-${i}`}
                    className={styles.char}
                    style={{ transform: `rotate(${c.rot}deg)`, color: i % 2 ? 'var(--blue-deep)' : 'var(--text)' }}
                  >
                    {c.ch}
                  </span>
                ))}
                {refreshed && <span className={styles.refreshed}>已更新</span>}
              </div>
              <div className={styles.captchaActions}>
                <button type="button" onClick={refresh} className="btn-secondary">
                  <Icon name="refresh" size={16} />
                  換一張
                </button>
                <button type="button" onClick={speak} className="btn-secondary">
                  <Icon name="speaker" size={16} />
                  語音播放
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="captcha" className={styles.label}>驗證碼</label>
              <input
                id="captcha"
                type="text"
                autoComplete="off"
                maxLength={5}
                placeholder="輸入 5 個字元"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value)
                  if (error === 'empty') setError(null)
                }}
                aria-invalid={!!error}
                aria-describedby={error ? 'captcha-error' : undefined}
                className={`${styles.input} ${error ? styles.inputError : ''}`}
              />
              {error && (
                <div id="captcha-error" role="alert" className={styles.error}>
                  <Icon name="alert" size={18} style={{ flex: '0 0 auto', marginTop: 1 }} />
                  {error === 'wrong' ? (
                    <span>
                      <strong>驗證碼不正確。</strong>已自動換一組新的，請重新輸入。你的選位不會被取消。
                    </span>
                  ) : (
                    <span>
                      <strong>請輸入驗證碼。</strong>輸入上圖中的 5 個英數字即可。
                    </span>
                  )}
                </div>
              )}
            </div>

            <button type="submit" className={`btn-primary ${styles.submit}`}>確認並保留票券</button>
          </form>
        </section>

        <aside aria-labelledby="sum-title" className={`card ${styles.side}`}>
          <h2 id="sum-title" className={styles.h2}>訂購明細</h2>
          <dl className={styles.list}>
            <div className={styles.row}><dt>場次</dt><dd>{getSession(sessionId).short}</dd></div>
            <div className={styles.row}><dt>票區</dt><dd>{zoneName(zone)} {tier.name}</dd></div>
            <div className={styles.row}><dt>張數</dt><dd>{qty} 張</dd></div>
            <div className={styles.row}><dt>配位</dt><dd>{seatMode === 'together' ? '電腦配位・連號優先' : '接受不連號'}</dd></div>
            <div className={styles.totalRow}><dt>小計</dt><dd>NT${formatPrice(tier.price * qty)}</dd></div>
          </dl>
          <Link to="/quantity" className={styles.back}>‹ 返回修改張數</Link>
        </aside>
      </main>
    </div>
  )
}
