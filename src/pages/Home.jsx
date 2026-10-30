import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import SearchBar from '../components/SearchBar'
import EventCard from '../components/EventCard'
import HeroCarousel from '../components/HeroCarousel'
import Icon from '../components/Icon'
import { CATEGORIES, NEWS } from '../data/events'
import { useEvents } from '../context/EventsContext'
import styles from './Home.module.css'

// 7-1 首頁：瀏覽主打海報，用搜尋列選擇類別、日期、地點
const NEWS_TAGS = {
  important: { label: '重要', className: styles.tagImportant },
  change: { label: '異動', className: styles.tagChange },
  system: { label: '系統', className: styles.tagSystem },
}

const toQuery = (values) => {
  const params = new URLSearchParams()
  Object.entries(values).forEach(([k, v]) => v && params.set(k, v))
  const qs = params.toString()
  return qs ? `/search?${qs}` : '/search'
}

export default function Home() {
  const navigate = useNavigate()
  const { hotEvents, soonEvents, heroSlides } = useEvents()
  const [filters, setFilters] = useState({ q: '', cat: '', date: '', region: '' })

  return (
    <div className={styles.page}>
      <SiteHeader active="programs" />

      <div className={styles.notice}>
        <div className={styles.noticeInner}>
          <Icon name="shield" size={16} color="var(--orange)" />
          <span>
            <strong>防詐騙提醒</strong>　拓元不會以電話要求您操作 ATM 或提供信用卡資料。
          </span>
          <a href="#news">查看所有公告 ›</a>
        </div>
      </div>

      {heroSlides.length > 0 && <HeroCarousel />}

      <div className={styles.searchWrap}>
        <SearchBar variant="hero" values={filters} onChange={setFilters} onSubmit={(v) => navigate(toQuery(v))} />
      </div>

      <main className={styles.main}>
        <div role="group" aria-label="快速分類" className={styles.chips}>
          <Link to="/search" className={`${styles.chip} ${styles.chipActive}`}>全部</Link>
          {CATEGORIES.map((c) => (
            <Link key={c} to={toQuery({ cat: c })} className={styles.chip}>{c}</Link>
          ))}
        </div>

        <section aria-labelledby="hot-title" className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 id="hot-title" className={styles.sectionTitle}>熱賣中</h2>
            <Link to="/search" className={styles.more}>查看全部 ›</Link>
          </div>
          <div className={styles.grid}>
            {hotEvents.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>

        <section aria-labelledby="soon-title" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="soon-title" className={styles.sectionTitle}>即將開賣</h2>
              <p className={styles.sectionDesc}>設定開賣提醒，開賣前 10 分鐘通知你。</p>
            </div>
            <Link to="/search" className={styles.more}>查看全部 ›</Link>
          </div>
          <div className={styles.grid}>
            {soonEvents.map((e) => <EventCard key={e.id} event={e} variant="upcoming" />)}
          </div>
        </section>

        {/* 公告依重要程度分級，以標籤區分 */}
        <section id="news" aria-labelledby="news-title" className={styles.news}>
          <div className={styles.sectionHead} style={{ marginBottom: 8 }}>
            <h2 id="news-title" className={styles.newsTitle}>最新消息</h2>
            <a href="#" className={styles.more}>全部公告 ›</a>
          </div>
          <div className={styles.newsGrid}>
            {NEWS.map((n) => (
              <a key={n.title} href="#" className={styles.newsItem}>
                <span className={`${styles.tag} ${NEWS_TAGS[n.tag].className}`}>{NEWS_TAGS[n.tag].label}</span>
                <span className={styles.newsText}>{n.title}</span>
                <span className={styles.newsDate}>{n.date}</span>
              </a>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
