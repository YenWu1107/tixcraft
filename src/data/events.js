// 活動、場次、票價資料已搬到 Django 後台（backend/events），由 /api/events/ 提供。
// 這個檔案只保留「前端固定的常數」：售票狀態樣式、搜尋選項、最新消息。

export const STATUS = {
  hot: { label: '熱賣中', color: 'var(--green)' },
  soon: { label: '即將開賣', color: 'var(--blue)' },
  few: { label: '少量餘票', color: 'var(--orange)' },
  soldout: { label: '已售完', color: 'var(--text-3)' },
}

export const posterSrc = (id) => `/images/poster-${id}.webp`


// 首頁「快速分類」與搜尋列的選項
export const CATEGORIES = ['演唱會', '音樂劇', '古典與爵士', '音樂節', '脫口秀', '展覽', '體育']

export const DATE_OPTIONS = [
  { value: '2026-11', label: '2026 年 11 月', chip: '11 月', test: (d) => d.startsWith('2026-11') },
  { value: '2026-12', label: '2026 年 12 月', chip: '12 月', test: (d) => d.startsWith('2026-12') },
  { value: '2026-11_12', label: '2026 年 11 – 12 月', chip: '11 – 12 月', test: (d) => d.startsWith('2026-11') || d.startsWith('2026-12') },
  { value: '2027-01', label: '2027 年 1 月', chip: '1 月', test: (d) => d.startsWith('2027-01') },
]

export const REGION_OPTIONS = [
  { value: 'north', label: '臺北・新北', regions: ['臺北', '新北'] },
  { value: 'taichung', label: '臺中', regions: ['臺中'] },
  { value: 'kaohsiung', label: '高雄', regions: ['高雄'] },
]

export const NEWS = [
  { tag: 'important', title: 'LUMEN 臺北站 12/14 加場售票時間公告', date: '10.16' },
  { tag: 'change', title: '《霧之城》12/05 場次開演時間調整說明', date: '10.12' },
  { tag: 'system', title: '10/21（三）凌晨 2:00–5:00 系統維護', date: '10.09' },
  { tag: 'system', title: '會員手機驗證流程更新，購票前請先完成驗證', date: '10.02' },
]
