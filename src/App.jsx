import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import Search from './pages/Search'
import Event from './pages/Event'
import Zone from './pages/Zone'
import Quantity from './pages/Quantity'
import Verify from './pages/Verify'
import Login from './pages/Login'
import Payment from './pages/Payment'
import Success from './pages/Success'
import Register from './pages/Register'

// 開發用的 3D 模型預覽頁（只在 npm run dev 時存在）
const DomePreview = import.meta.env.DEV ? lazy(() => import('./pages/DomePreview')) : null

// 分鏡對照：7-1 首頁 → 7-9 購票成功
const TITLES = {
  '/': 'tixcraft 首頁',
  '/search': '搜尋結果',
  '/event': '活動詳情：LUMEN 臺北站',
  '/zone': '選擇票區',
  '/quantity': '選擇張數與座位視野',
  '/verify': '安全驗證',
  '/login': '登入提示',
  '/payment': '付款',
  '/success': '購票成功',
}

// 換頁時回到頂端；網址帶 #錨點 時捲到該區塊
function useScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    document.title = TITLES[pathname] ?? (pathname.startsWith('/event/') ? '活動詳情' : 'tixcraft 拓元售票')
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    } else {
      window.scrollTo(0, 0)
    }
  }, [pathname, hash])
}

export default function App() {
  useScrollManager()
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/search" element={<Search />} />
      <Route path="/event" element={<Navigate to="/event/lumen" replace />} />
      <Route path="/event/:eventId" element={<Event />} />
      <Route path="/zone" element={<Zone />} />
      <Route path="/quantity" element={<Quantity />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="/login" element={<Login />} />
      <Route path="/payment" element={<Payment />} />
      <Route path="/success" element={<Success />} />
      <Route path="/register" element={<Register />} />
      {DomePreview && (
        <Route path="/dev/dome" element={<Suspense fallback={null}><DomePreview /></Suspense>} />
      )}
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
