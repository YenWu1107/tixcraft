import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Dome3D from '../components/dome/Dome3D'
import { ZONES } from '../data/lumen'

// 開發用：單獨預覽 3D 大巨蛋（只在 npm run dev 時存在）
// /dev/dome：選位模式；/dev/dome?mode=preview&zone=217：張數頁的座位視野模式
export default function DomePreview() {
  const [params] = useSearchParams()
  const mode = params.get('mode') ?? 'select'
  const [selected, setSelected] = useState(params.get('zone') ?? '112')
  return (
    <div style={{ maxWidth: 1000, margin: '32px auto', padding: '0 24px' }}>
      <h1 style={{ fontSize: 20 }}>
        Dome3D 預覽（{mode}）｜已選：{selected}
      </h1>
      <div style={{ background: 'var(--bg)', borderRadius: 22, padding: 10 }}>
        <Dome3D key={mode} zones={ZONES} selectedId={selected} onSelect={setSelected} mode={mode} />
      </div>
    </div>
  )
}
