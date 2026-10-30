import { useMemo } from 'react'
import { TIERS as TIER_STYLES } from './lumen'
import { useEvents } from '../context/EventsContext'
import { usePurchase } from '../context/PurchaseContext'

// 把後台（/api/events/）給的活動資料，整理成頁面好用的格式：
//   event（基本資料）、sessions（場次）、tiers（票價等級）、extra（介紹文字／地址／主辦）
// 場次與票價都在 Django 後台編輯；票價等級的名稱與顏色是前端固定樣式（lumen.js 的 TIERS）。

const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const pad = (n) => String(n).padStart(2, '0')

function makeSession(s) {
  const [y, m, d] = s.date.split('-').map(Number)
  const wd = WEEK[new Date(y, m - 1, d).getDay()]
  const date = `${y}.${pad(m)}.${pad(d)}（${wd}）`
  return {
    id: String(s.id),
    ymd: s.date,
    month: MON[m - 1],
    day: pad(d),
    weekday: `星期${wd}`,
    date,
    time: s.time,
    short: `${pad(m)}.${pad(d)}（${wd}）${s.time}`,
    label: `${date} ${s.time}`,
    desc: s.desc || '演出約 150 分鐘',
    doors: s.doors || '開演前 90 分鐘',
    qrOpen: s.qrOpen || '演出前一天',
    status: s.status,
    extra: s.extra,
  }
}

const cache = new WeakMap()
function buildEventData(event) {
  if (!cache.has(event)) {
    const sessions = event.sessions.map(makeSession)
    const tiers = TIER_STYLES.map((t) => ({ ...t, price: event.tiers.find((x) => x.id === t.id)?.price ?? t.price }))
    cache.set(event, {
      event,
      sessions,
      tiers,
      extra: { about: event.about || undefined, address: event.address || undefined, organizer: event.organizer || undefined },
      getSession: (id) => sessions.find((s) => s.id === id) ?? sessions.find((s) => s.status !== 'soon') ?? sessions[0],
      getTier: (id) => tiers.find((t) => t.id === id),
    })
  }
  return cache.get(event)
}

// 在頁面中使用：不傳參數 = 目前購票流程的活動（存在 PurchaseContext）；活動頁會傳網址上的 id
export function useEventData(id) {
  const { eventId } = usePurchase()
  const { getEvent, events } = useEvents()
  const event = getEvent(id ?? eventId) ?? events[0]
  return useMemo(() => buildEventData(event), [event])
}
