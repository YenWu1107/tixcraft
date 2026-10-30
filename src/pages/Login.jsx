import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import PurchaseBar from '../components/PurchaseBar'
import Icon from '../components/Icon'
import { formatClock, useHoldCountdown } from '../context/PurchaseContext'
import { useAuth } from '../context/AuthContext'
import styles from './Login.module.css'

// 7-7 登入提示：彈出視窗說明登入原因與好處，顯示保留倒數，登入後自動回到付款頁
// 從導覽列「登入」進來時（location.state.from），登入後回到原本的頁面
const BENEFITS = ['票券綁定本人帳號，防止盜用與轉賣', '訂單成立與取票通知即時寄到信箱', '隨時在會員中心查看票券、申請退票']

export default function Login() {
  const navigate = useNavigate()
  const { state } = useLocation()
  const from = state?.from
  const inPurchase = !from
  const { login } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const left = useHoldCountdown()

  const close = () => navigate(from ?? '/verify')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(identifier, password)
      navigate(from ?? '/payment')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* 背景：模糊的付款頁骨架，讓使用者知道登入後會回到哪裡 */}
      <div aria-hidden="true" inert className={styles.backdropPage}>
        <SiteHeader showSearch={false} />
        <PurchaseBar step={3} />
        <div className={styles.skeleton}>
          <div className={styles.skeletonMain}>
            <div className={styles.skTimer} />
            <div className={styles.skCard} style={{ height: 260 }} />
            <div className={styles.skCard} style={{ height: 320 }} />
          </div>
          <div className={styles.skCard} style={{ flex: '1 1 340px', height: 520 }} />
        </div>
      </div>

      <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && close()}>
        <section role="dialog" aria-modal="true" aria-labelledby="login-title" className={styles.dialog}>
          <button type="button" aria-label="關閉" onClick={close} className={styles.close}>
            <Icon name="close" size={16} strokeWidth={2.2} />
          </button>

          <div className={styles.intro}>
            <div className={styles.lockIcon}>
              <Icon name="lock" size={28} />
            </div>
            <h2 id="login-title" className={styles.h2}>{inPurchase ? '登入以保障你的票券' : '登入 tixcraft'}</h2>
            {inPurchase ? (
              <>
                <p className={styles.lead}>
                  票券已為你保留。登入後會自動回到付款頁，
                  <br />
                  不需要重新選位。
                </p>
                <span className={styles.timer}>
                  <Icon name="clock" size={16} />
                  保留時間剩餘 {formatClock(left)}
                </span>
              </>
            ) : (
              <p className={styles.lead}>登入後即可購票、設定開賣提醒與查詢訂單。</p>
            )}
          </div>

          <ul className={styles.benefits}>
            {BENEFITS.map((b) => (
              <li key={b}>
                <Icon name="check" size={18} strokeWidth={2.2} color="var(--green)" style={{ flex: '0 0 auto', marginTop: 1 }} />
                {b}
              </li>
            ))}
          </ul>

          <form onSubmit={submit} className={styles.form}>
            <label className={styles.field}>
              Email 或手機號碼
              <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" className={styles.input} />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldRow}>
                <span>密碼</span>
                <a href="#" className={styles.forgot}>忘記密碼？</a>
              </span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={styles.input} autoFocus />
            </label>
            {error && <p role="alert" style={{ color: '#d33', fontSize: 14, margin: 0 }}>{error}</p>}
            <button type="submit" disabled={busy} className={`btn-primary ${styles.submit}`}>
              {inPurchase ? '登入並繼續付款' : '登入'}
            </button>
          </form>

          <div className={styles.or}>
            <span />或<span />
          </div>
          <button type="button" className={styles.google}>使用 Google 帳號繼續</button>
          <p className={styles.signup}>
            還不是會員？<a href="#">30 秒完成註冊</a>
          </p>
        </section>
      </div>
    </div>
  )
}
