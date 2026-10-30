import { createContext, useContext, useEffect, useState } from 'react'
import { HOLD_SECONDS } from '../data/lumen'

// 購票流程的共用狀態：場次 → 票區 → 張數 → 驗證 → 登入 → 付款 → 完成
// 預設值：112 區（1 樓看台、正對舞台）、2 張，存在 sessionStorage，重新整理不會遺失
const DEFAULTS = {
  eventId: 'lumen', // 目前購票的活動（對應 events.js 的 id）
  sessionId: '', // 空白 = 該活動第一個可購買的場次
  zoneId: '112',
  qty: 2,
  seatMode: 'together', // together：連號優先／any：接受不連號
  pickup: 'eticket', // eticket：電子票券／store：超商取票
  payMethod: 'card',
  holdUntil: null, // 票券保留到期的時間戳記（通過驗證後開始計時）
}

const STORAGE_KEY = 'tixcraft-purchase'

const load = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY))
    return { ...DEFAULTS, ...saved }
  } catch {
    return DEFAULTS
  }
}

const PurchaseContext = createContext(null)

export function PurchaseProvider({ children }) {
  const [state, setState] = useState(load)

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // 無痕模式等情況下無法存取 storage，忽略即可
    }
  }, [state])

  const update = (patch) => setState((s) => ({ ...s, ...patch }))
  const startHold = () => update({ holdUntil: Date.now() + HOLD_SECONDS * 1000 })

  return (
    <PurchaseContext.Provider value={{ ...state, update, startHold }}>
      {children}
    </PurchaseContext.Provider>
  )
}

export const usePurchase = () => useContext(PurchaseContext)

// 票券保留倒數：回傳剩餘秒數（尚未開始保留時，以設計稿的完整 10 分鐘顯示）
export function useHoldCountdown() {
  const { holdUntil } = usePurchase()
  const calc = () => (holdUntil ? Math.max(0, Math.round((holdUntil - Date.now()) / 1000)) : HOLD_SECONDS)
  const [left, setLeft] = useState(calc)

  useEffect(() => {
    setLeft(calc())
    if (!holdUntil) return
    const timer = setInterval(() => setLeft(calc()), 1000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdUntil])

  return left
}

export const formatClock = (sec) => {
  const m = String(Math.floor(sec / 60)).padStart(2, '0')
  const s = String(sec % 60).padStart(2, '0')
  return `${m}:${s}`
}
