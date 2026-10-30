// 臺北大巨蛋：簡化 3D 模型的共用座標系統（單位：公尺）
//
// 座標：場地地面 y = 0，舞台在 -z（外野端），本壘在 +z（相機那一側）
// 角度 phi：從舞台方向（-z）起算，0° = 舞台正後方，180° = 本壘後方、正對舞台
//           俯視時逆時針增加，所以從觀眾席面向舞台看，101 區在左手邊
// 看台是「橢圓 + 往外偏移 d」：半軸為 (FIELD.rx + d, FIELD.rz + d)
//
// 參考資料（研究 agent 整理）：內部約 230 × 170 m 橢圓、屋頂最高 74.5 m、
// 場地位於地面下 10.5 m；1 樓 101–124、2 樓 201–224、3 樓包廂、4 樓、5 樓 501–515；
// 演唱會舞台在外野端，場地為 A／B／C 排對號座搖滾區

export const FIELD = { rx: 42, rz: 72 } // 場地（看台最前緣）的橢圓半軸

export const ROOF = {
  rx: 94, // 建築外緣最寬處（水平折線）的半軸 = 場地橢圓往外偏移 52 m
  rz: 124,
  eaveY: 42, // 水平折線（外觀最寬處，屋頂鈦金屬殼從這裡往上收）
  apexY: 74.5, // 屋頂最高點
}

// 舞台與螢幕（位於 -z 端）
export const STAGE = {
  z0: -72, // 舞台後緣（台面實際形狀會被場地橢圓裁成弧形）
  z1: -54, // 舞台前緣（面向觀眾）
  width: 56,
  height: 2.4,
  screen: { width: 32, height: 18, z: -65.5, y0: 6 }, // 主螢幕（16:9，實際看板 30.72 × 17.28 m）
  sideScreen: { width: 14.4, height: 8.1, x: 31.5, y0: 12, z: -57, yaw: 0.38 }, // 左右側 IMAG 螢幕（吊掛、略朝內）
  runway: { width: 6, length: 7 }, // 從舞台前緣往觀眾延伸的伸展台（止於 A 區前）
  rigTop: 32, // 舞台頂部燈光桁架的高度
}

// 看台各樓層：d0/d1 = 前緣／後緣往外偏移；y0/y1 = 前排／後排高度；rows = 視覺上的階梯數
// sale: false 代表本場不開放（只畫成建築結構，不能點）
export const LEVELS = {
  L1: { label: '1 樓', d0: 0, d1: 20, y0: 1.2, y1: 9, rows: 8, sale: true },
  L2: { label: '2 樓', d0: 17, d1: 29, y0: 11, y1: 18, rows: 6, sale: true },
  L3: { label: '3 樓包廂', d0: 28, d1: 32, y0: 19.5, y1: 22, rows: 2, sale: false },
  L4: { label: '4 樓', d0: 31, d1: 35, y0: 23.5, y1: 26.5, rows: 3, sale: false },
  L5: { label: '5 樓', d0: 34, d1: 46, y0: 28, y1: 40, rows: 7, sale: true },
}

const deg = (d) => (d * Math.PI) / 180

// 橢圓偏移 d、角度 phi（度）上的點 → { x, z }
export function ellipsePoint(d, phiDeg) {
  const p = deg(phiDeg)
  return {
    x: -(FIELD.rx + d) * Math.sin(p),
    z: -(FIELD.rz + d) * Math.cos(p),
  }
}

// 產生某一樓層的看台分區（含不開放的）
// 1、2 樓：24 區繞一整圈，每區 15°；舞台正後方 ±30° 內（x01、x02、x23、x24）不開放
// 5 樓：15 區，分布在 40°–320°
function bowlSections(levelId, prefix, count, phiStart, phiEnd, closed = []) {
  const step = (phiEnd - phiStart) / count
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1
    return {
      id: `${prefix}${String(n).padStart(2, '0')}`,
      kind: 'bowl',
      level: levelId,
      phi0: phiStart + i * step,
      phi1: phiStart + (i + 1) * step,
      closed: closed.includes(n),
    }
  })
}

export const BOWL_SECTIONS = [
  ...bowlSections('L1', 1, 24, 0, 360, [1, 2, 23, 24]),
  ...bowlSections('L2', 2, 24, 0, 360, [1, 2, 23, 24]),
  ...bowlSections('L5', 5, 15, 40, 320),
]

// 場地上的對號座區塊（矩形，x0 < x1、z0 < z1）
const floorRow = (prefix, count, z0, z1, totalWidth, gap) => {
  const w = (totalWidth - gap * (count - 1)) / count
  return Array.from({ length: count }, (_, i) => {
    const x0 = -totalWidth / 2 + i * (w + gap)
    return { id: `${prefix}${i + 1}`, kind: 'floor', x0, x1: x0 + w, z0, z1 }
  })
}

export const FLOOR_SECTIONS = [
  ...floorRow('A', 6, -46, -31, 60, 2.5), // 特區：舞台正前方
  ...floorRow('B', 6, -27, -10, 64, 2.5), // 搖滾區
  ...floorRow('C', 4, -6, 12, 60, 3), // 搖滾區後段
]

// 控台（音控／燈控區），位於場地後段
export const CONTROL_DESK = { x0: -8, x1: 8, z0: 24, z1: 32, height: 3 }

// 分區的中心點與高度（給距離、視角計算、標籤定位用）
export function sectionCenter(section) {
  if (section.kind === 'floor') {
    return { x: (section.x0 + section.x1) / 2, y: 0.6, z: (section.z0 + section.z1) / 2 }
  }
  const lv = LEVELS[section.level]
  const { x, z } = ellipsePoint((lv.d0 + lv.d1) / 2, (section.phi0 + section.phi1) / 2)
  return { x, y: (lv.y0 + lv.y1) / 2, z }
}

// 給使用者看的資訊：與舞台距離、離地高度、視角
export function sectionStats(section) {
  const c = sectionCenter(section)
  const stageFront = { x: 0, y: STAGE.height, z: STAGE.z1 }
  const distance = Math.round(Math.hypot(c.x - stageFront.x, c.y - stageFront.y, c.z - stageFront.z))
  const height = Math.round(c.y)
  let facing = '正面'
  if (section.kind === 'bowl') {
    const mid = (section.phi0 + section.phi1) / 2
    facing = mid >= 135 && mid <= 225 ? '正面' : mid < 75 || mid > 285 ? '舞台側邊' : '側面'
  }
  const angle = height < 3 ? '平視' : height < 15 ? '微俯視' : '俯視'
  return {
    distance,
    height,
    facing,
    angle,
    levelLabel: section.kind === 'floor' ? '場地' : LEVELS[section.level].label,
  }
}

// ── 建築外殼與內部（venue/ 使用；單位公尺，d = 場地橢圓往外偏移）──
export const GRADE_Y = 10.5 // 街道／廣場高度（場地在地面下 10.5 m）

export const SHELL = {
  wallD: 47, // 內牆（最外圈看台後方）
  springY: 46, // 屋頂起拱線：探照燈環、貓道
  latticeD: 47, // 鋼構網格在起拱線的偏移
  latticeApexY: 71.5, // 鋼構網格（下緣）最高點
  deckD: 49.5, // 屋面板在起拱線的偏移
  deckApexY: 74, // 屋面板（內側）最高點
  podiumTopY: 30.8, // 地面層（裙樓）頂部
}

// 外野端的灰色弧牆（舞台後方、5 樓看台沒有的範圍，phi -40°～40°）
export const SKIRT_WALL = { phi: 40, d0: 36, y0: 26.5, d1: 46.6, y1: 46 }

// 屋頂鋼構：兩組交叉的弧線，形成菱形→近方形網格（約 9 m 一格）
export const LATTICE = { spacing: 0.1, memberWidth: 0.55, memberDepth: 1.5 }

// 屋頂中央吊掛的喇叭框架
export const SPEAKER_CLUSTER = { width: 24, depth: 11, y: 57 }
