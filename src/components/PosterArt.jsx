import { useState } from 'react'
import { posterSrc } from '../data/events'
import styles from './PosterArt.module.css'

// 活動海報圖層：優先顯示 Codex 生成的海報圖，載入失敗時退回原型的色塊構圖
export default function PosterArt({ event, src = event.poster ?? posterSrc(event.id), position = 'center', className = '' }) {
  const [failed, setFailed] = useState(false)
  const { art } = event

  return (
    <div className={`${styles.art} ${className}`} style={{ background: art.bg }} aria-hidden="true">
      {failed ? (
        <>
          <div className={styles.orb} style={{ width: art.orb, left: art.ox, top: art.oy, background: art.c1 }} />
          <div className={styles.ring} style={{ width: art.ring, left: art.rx, top: art.ry, borderColor: art.c2 }} />
        </>
      ) : (
        <img
          src={src}
          alt=""
          loading="lazy"
          className={styles.img}
          style={{ objectPosition: position }}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
