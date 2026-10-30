import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import SearchBar from '../components/SearchBar'
import EventCard from '../components/EventCard'
import Toggle from '../components/Toggle'
import Icon from '../components/Icon'
import { DATE_OPTIONS, REGION_OPTIONS } from '../data/events'
import { useEvents } from '../context/EventsContext'
import styles from './Search.module.css'

// 7-2 搜尋結果：套用篩選條件，從活動卡片判斷是否可購買
// 篩選條件存在網址參數（?cat=演唱會&date=2026-11_12&region=north），可直接分享或重新整理
const SORTS = {
  featured: { label: '推薦排序', fn: () => 0 },
  date: { label: '依演出日期', fn: (a, b) => a.startsAt.localeCompare(b.startsAt) },
  sale: { label: '依開賣時間', fn: (a, b) => (a.saleDate ?? '').localeCompare(b.saleDate ?? '') },
  price: { label: '依票價由低到高', fn: (a, b) => a.price - b.price },
}

const readParams = (params) => ({
  q: params.get('q') ?? '',
  cat: params.get('cat') ?? '',
  date: params.get('date') ?? '',
  region: params.get('region') ?? '',
})

export default function Search() {
  const { events } = useEvents()
  const [params, setParams] = useSearchParams()
  const applied = readParams(params)
  const [draft, setDraft] = useState(applied)
  const [buyableOnly, setBuyableOnly] = useState(false)
  const [sort, setSort] = useState('featured')
  const paramKey = params.toString()

  // 從導覽列等其他地方改變網址時，同步搜尋列的內容
  useEffect(() => {
    setDraft(readParams(new URLSearchParams(paramKey)))
  }, [paramKey])

  const apply = (values) => {
    const next = new URLSearchParams()
    Object.entries(values).forEach(([k, v]) => v && next.set(k, v))
    setParams(next)
    setDraft(values)
  }

  // 搜尋列上的類別／日期／地點選完即套用，文字搜尋則按下搜尋鈕才套用
  const onDraftChange = (values) => {
    if (values.q !== draft.q) setDraft(values)
    else apply(values)
  }

  const removeFilter = (key) => apply({ ...applied, [key]: '' })

  const dateOpt = DATE_OPTIONS.find((o) => o.value === applied.date)
  const regionOpt = REGION_OPTIONS.find((o) => o.value === applied.region)

  const chips = [
    applied.q && { key: 'q', label: `「${applied.q}」` },
    applied.cat && { key: 'cat', label: applied.cat },
    dateOpt && { key: 'date', label: dateOpt.chip },
    regionOpt && { key: 'region', label: regionOpt.label },
  ].filter(Boolean)

  const results = useMemo(() => {
    const q = applied.q.trim().toLowerCase()
    return events.filter((e) => {
      if (q && ![e.title, e.en, e.venue].some((t) => t.toLowerCase().includes(q))) return false
      if (applied.cat && e.category !== applied.cat) return false
      if (dateOpt && !dateOpt.test(e.startsAt)) return false
      if (regionOpt && !regionOpt.regions.includes(e.region)) return false
      if (buyableOnly && !['hot', 'few'].includes(e.status)) return false
      return true
    }).sort(SORTS[sort].fn)
  }, [events, applied.q, applied.cat, dateOpt, regionOpt, buyableOnly, sort])

  return (
    <div>
      <SiteHeader active="programs" />

      <main className={styles.main}>
        <nav aria-label="麵包屑" className={styles.crumbs}>
          <Link to="/">首頁</Link>
          <span aria-hidden="true">›</span>
          <span className={styles.crumbCurrent}>節目</span>
        </nav>
        <h1 className={styles.title}>找節目</h1>
        <p className={styles.lead}>用類別、日期與地點，快速找到你想看的演出。</p>

        <div className={styles.searchWrap}>
          <SearchBar values={draft} onChange={onDraftChange} onSubmit={apply} />
        </div>

        <div className={styles.toolbar}>
          <div className={styles.applied}>
            <span className={styles.count}>找到 {results.length} 場活動</span>
            {chips.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-label={`移除篩選：${c.label}`}
                onClick={() => removeFilter(c.key)}
                className={styles.chip}
              >
                {c.label}
                <Icon name="close" size={14} strokeWidth={2} />
              </button>
            ))}
            {chips.length > 0 && (
              <button type="button" onClick={() => apply({ q: '', cat: '', date: '', region: '' })} className={styles.clear}>
                清除全部
              </button>
            )}
          </div>
          <div className={styles.controls}>
            <Toggle label="只顯示可購買" checked={buyableOnly} onChange={setBuyableOnly} />
            <label className={styles.sortLabel}>
              排序
              <select value={sort} onChange={(e) => setSort(e.target.value)} className={styles.select}>
                {Object.entries(SORTS).map(([value, s]) => (
                  <option key={value} value={value}>{s.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {results.length > 0 ? (
          <div className={styles.grid}>
            {results.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        ) : (
          <div className={styles.empty}>
            <Icon name="search" size={28} />
            <p className={styles.emptyTitle}>沒有符合條件的活動</p>
            <p className={styles.emptyText}>試著移除部分篩選條件，或換個關鍵字。</p>
            <button type="button" className="btn-secondary" onClick={() => apply({ q: '', cat: '', date: '', region: '' })}>
              清除全部條件
            </button>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
