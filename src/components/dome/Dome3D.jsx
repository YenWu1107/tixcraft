import { useState } from 'react'
import DomeCanvas from './venue/DomeCanvas'
import SeatSections from './seats/SeatSections'
import CameraRig from './camera/CameraRig'
import ViewSwitcher from './camera/ViewSwitcher'
import { DEFAULT_VIEW } from './camera/views'
import styles from './Dome3D.module.css'

// 臺北大巨蛋 3D 場館（演唱會暗場）
// - venue/：Canvas、燈光、後製光暈、建築本體、舞台與螢幕
// - seats/：看台與場地區塊（可點選、懸停、已售完、不開放）
// - camera/：多視角預設鏡位、切換動畫、「我的視野」與視角切換按鈕
//
// mode="select"：選位頁，可點選、可切換視角
// mode="preview"：張數頁的座位視野預覽，固定在「我的視野」、不能點選
export default function Dome3D({ zones, selectedId, onSelect, mode = 'select' }) {
  const preview = mode === 'preview'
  const [view, setView] = useState(preview ? 'seat' : DEFAULT_VIEW)

  return (
    <div className={`${styles.wrap} ${preview ? styles.preview : ''}`}>
      <DomeCanvas>
        <CameraRig view={view} selectedId={selectedId} />
        <SeatSections
          zones={zones}
          selectedId={selectedId}
          onSelect={onSelect}
          interactive={!preview && view !== 'seat'}
          showLabels={!preview}
        />
      </DomeCanvas>
      {!preview && <ViewSwitcher view={view} onChange={setView} selectedId={selectedId} />}
    </div>
  )
}
