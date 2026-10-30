import { BOWL_SECTIONS, FLOOR_SECTIONS } from './domeLayout.js'

// LUMEN 臺北站：場次、票區與座位圖資料（購票流程使用）

export const SESSIONS = [
  { id: '1212', month: 'DEC', day: '12', weekday: '星期六', date: '2026.12.12（六）', time: '19:30', short: '12.12（六）19:30', doors: '18:00', desc: '18:00 開放入場・演出約 150 分鐘', qrOpen: '12.11（五）19:30', status: 'hot' },
  { id: '1213', month: 'DEC', day: '13', weekday: '星期日', date: '2026.12.13（日）', time: '18:00', short: '12.13（日）18:00', doors: '16:30', desc: '16:30 開放入場・演出約 150 分鐘', qrOpen: '12.12（六）18:00', status: 'few' },
  { id: '1214', month: 'DEC', day: '14', weekday: '星期一', date: '2026.12.14（一）', time: '19:30', short: '12.14（一）19:30', doors: '18:00', desc: '10.25（日）12:00 開賣', qrOpen: '12.13（日）19:30', status: 'soon', extra: true },
].map((s) => ({ ...s, label: `${s.date} ${s.time}` }))

export const getSession = (id) => SESSIONS.find((s) => s.id === id) ?? SESSIONS[0]

// 票價等級：color 對應 global.css 的 --tier-*；hex 給 3D 模型使用
export const TIERS = [
  { id: 'vip', name: '特區', price: 6800, color: 'var(--tier-1)', hex: '#1A5DD6', avail: '少量', availColor: 'var(--orange)' },
  { id: 'rock', name: '搖滾區', price: 4800, color: 'var(--tier-2)', hex: '#5B8DEF', avail: '有票', availColor: 'var(--green)' },
  { id: 'stand', name: '1 樓看台', price: 3800, color: 'var(--tier-3)', hex: '#A9C4F5', avail: '有票', availColor: 'var(--green)' },
  { id: 'upper', name: '2 樓看台', price: 2800, color: 'var(--tier-4)', hex: '#F0A33B', avail: '有票', availColor: 'var(--green)' },
  { id: 'back', name: '5 樓看台', price: 1800, color: 'var(--tier-5)', hex: '#F7D9A0', avail: '有票', availColor: 'var(--green)' },
]

export const getTier = (id) => TIERS.find((t) => t.id === id)

// 售票狀態：soldOut = 已售完；left = 剩餘席次（少量時顯示）
const SOLD_OUT = ['B4', '116', '117', '208', '209', '512']
const LEFT = { A3: 12, A4: 8 }

const tierOf = (s) => {
  if (s.kind === 'floor') return s.id.startsWith('A') ? 'vip' : 'rock'
  return { L1: 'stand', L2: 'upper', L5: 'back' }[s.level]
}

// 可售的分區（3D 模型上可點選的區域）；幾何資料見 domeLayout.js
export const ZONES = [...FLOOR_SECTIONS, ...BOWL_SECTIONS.filter((s) => !s.closed)].map((s) => ({
  ...s,
  tier: tierOf(s),
  soldOut: SOLD_OUT.includes(s.id),
  left: LEFT[s.id],
}))

// 不開放的看台（舞台後方），3D 模型畫成淺灰、不能點
export const CLOSED_SECTIONS = BOWL_SECTIONS.filter((s) => s.closed)

export const getZone = (id) => ZONES.find((z) => z.id === id) ?? ZONES.find((z) => z.id === '112')

// 顯示用的區域名稱：場地區塊直接用代號，看台加「區」
export const zoneName = (zone) => (zone.kind === 'floor' ? zone.id : `${zone.id} 區`)

// 右側票區清單的按鈕分組（一個按鈕可對應模型上的多個區域）
const sectionId = (prefix, n) => `${prefix}${String(n).padStart(2, '0')}`
const range = (prefix, [from, to]) => Array.from({ length: to - from + 1 }, (_, i) => sectionId(prefix, from + i))
const single = (ids) => ids.map((id) => ({ label: id, zones: [id] }))
const sides = (prefix, left, front, right) =>
  [
    ['左側', left],
    ['正面', front],
    ['右側', right],
  ].map(([side, r]) => ({ label: `${side} ${sectionId(prefix, r[0])}–${sectionId(prefix, r[1])}`, zones: range(prefix, r) }))

export const ZONE_GROUPS = {
  vip: single(['A1', 'A2', 'A3', 'A4', 'A5', 'A6']),
  rock: single(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'C1', 'C2', 'C3', 'C4']),
  stand: sides(1, [3, 8], [9, 16], [17, 22]),
  upper: sides(2, [3, 8], [9, 16], [17, 22]),
  back: sides(5, [1, 5], [6, 10], [11, 15]),
}

export const SERVICE_FEE = 20
export const STORE_PICKUP_FEE = 30
export const MAX_TICKETS = 4
export const HOLD_SECONDS = 10 * 60

// 依張數與配位方式產生示意座位
export const seatText = (zone, qty) => {
  const nums = Array.from({ length: qty }, (_, i) => 7 + i).join('、')
  return `${zoneName(zone)} 12 排 ${nums} 號`
}

export const formatPrice = (n) => n.toLocaleString('en-US')
