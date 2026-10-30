import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { api } from '../api'

// 活動資料來自 Django 後台：GET /api/events/
// 在後台（/admin/）新增或修改活動後，重新整理前台就會看到變化。
const EventsContext = createContext(null)
export const useEvents = () => useContext(EventsContext)

const boxStyle = { maxWidth: 560, margin: '20vh auto', padding: 24, fontFamily: 'sans-serif', lineHeight: 1.7 }

export function EventsProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api('/events/')
      .then((d) => {
        if (!d.events?.length) throw new Error('資料庫裡還沒有活動。')
        setData(d)
      })
      .catch((e) => setError(e.message))
  }, [])

  const value = useMemo(() => {
    if (!data) return null
    const byId = new Map(data.events.map((e) => [e.id, e]))
    const getEvent = (id) => byId.get(id)
    const pick = (ids) => ids.map(getEvent).filter(Boolean)
    return {
      events: data.events,
      getEvent,
      hotEvents: pick(data.hot),
      soonEvents: pick(data.soon),
      heroSlides: data.hero.map((s) => ({ ...s, event: getEvent(s.eventId) })).filter((s) => s.event),
    }
  }, [data])

  if (error) {
    return (
      <div style={boxStyle}>
        <h2>無法載入活動資料</h2>
        <p>{error}</p>
        <ol>
          <li>確認 Django 有啟動：在 <code>backend</code> 資料夾執行 <code>python manage.py runserver</code></li>
          <li>第一次使用請匯入活動：<code>python manage.py seed_events</code></li>
        </ol>
      </div>
    )
  }
  if (!value) return <div style={boxStyle}>載入中…</div>
  return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>
}
