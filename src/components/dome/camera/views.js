import * as THREE from 'three'
import { LEVELS, ROOF, STAGE, ellipsePoint } from '../../../data/domeLayout'
import { seatEye } from '../seats/geometry'

// 預設鏡位（不能拖曳、縮放，只能切換）
// 角度 az 沿用 domeLayout 的 phi：0 = 舞台那一端（-z）、90 = 左側（-x）、180 = 本壘（+z）、270 = 右側（+x）
// el = 鏡頭俯角（視線與水平面的夾角）
// 鏡頭距離不寫死：依 fov 與畫面比例把 fit 點雲放進畫面（跟 v1 一樣），任何比例都不會裁到

// id 是和 Dome3D 的約定：DEFAULT_VIEW 為預設、'seat' 為「我的視野」
export const VIEWS = [
  { id: 'overview', label: '全場', hint: '從本壘後上方看全場' },
  { id: 'top', label: '俯視', hint: '由上往下看，每一區都好點選' },
  { id: 'left', label: '左側', hint: '放大左側看台（103–108、203–208、501–505 區）' },
  { id: 'right', label: '右側', hint: '放大右側看台（117–122、217–222、511–515 區）' },
  { id: 'stage', label: '舞台視角', hint: '從舞台後上方看向觀眾席' },
  { id: 'seat', label: '我的視野', hint: '從所選區域看向舞台' },
]

// 預設舞台視角：從舞台後上方看向觀眾席，所有區域都夠大、好點選
export const DEFAULT_VIEW = 'stage'

// 畫面四周保留的像素：下方留給視角切換按鈕（高 38 + 下緣 14 + 間距）
export const FRAME_INSETS = { top: 18, right: 16, bottom: 66, left: 16 }

// ---------- 框景用的點 ----------

const BOWL_D = LEVELS.L5.d1 // 看台最外圈（5 樓最後排）
const BOWL_TOP = LEVELS.L5.y1

// 橢圓環上的點；phi 範圍（度）
function ring(d, y, phiFrom = 0, phiTo = 360, n = 48) {
  const pts = []
  const full = phiTo - phiFrom >= 360
  const count = full ? n : n + 1
  for (let i = 0; i < count; i++) {
    const p = ellipsePoint(d, phiFrom + ((phiTo - phiFrom) * i) / n)
    pts.push(new THREE.Vector3(p.x, y, p.z))
  }
  return pts
}

const SCREEN_TOP = STAGE.screen.y0 + STAGE.screen.height
const screenPts = [
  new THREE.Vector3(-STAGE.screen.width / 2, SCREEN_TOP, STAGE.screen.z),
  new THREE.Vector3(STAGE.screen.width / 2, SCREEN_TOP, STAGE.screen.z),
]

// 整個看台：最外圈頂端 + 場地邊緣
const ALL = [...ring(BOWL_D, BOWL_TOP), ...ring(0, 0), ...screenPts]

// 各預設鏡位（距離由 fitView 算）
const FRAMED = {
  // 全場：本壘後上方的 3/4 視角（同 v1）
  overview: { az: 180, el: 44, fov: 35, target: [0, 12, -4], fit: ALL },
  // 俯視：幾乎正上方，留一點傾斜感；舞台在上方（跟一般座位圖一致）
  top: { az: 180, el: 76, fov: 30, target: [0, 8, 0], fit: [...ring(BOWL_D, BOWL_TOP), ...screenPts] },
  // 左側：鏡頭在右後上方，斜看左半邊（左側看台面向鏡頭、靠舞台的區塊放大）；近側右半邊可以被裁掉
  left: {
    az: 242,
    el: 38,
    fov: 35,
    target: [-20, 12, -16],
    fit: [...ring(BOWL_D, BOWL_TOP, 30, 178, 24), ...ring(0, 0, 10, 180, 24), ...screenPts],
  },
  // 右側：左側的鏡像
  right: {
    az: 118,
    el: 38,
    fov: 35,
    target: [20, 12, -16],
    fit: [...ring(BOWL_D, BOWL_TOP, 182, 330, 24), ...ring(0, 0, 180, 350, 24), ...screenPts],
  },
  // 舞台視角：舞台後上方看向觀眾；正後方（不開放、在鏡頭底下）的看台可以裁掉
  // 俯角要夠大，主螢幕才不會擋住場地前段
  stage: {
    az: 0,
    el: 50,
    fov: 35,
    target: [0, 10, 14],
    fit: [...ring(BOWL_D, BOWL_TOP, 45, 315, 36), ...ring(0, 0, 0, 360, 36)],
  },
}

// 鏡頭方向：從 target 指向鏡頭的單位向量
export function dirFromAngles(az, el, out = new THREE.Vector3()) {
  const a = THREE.MathUtils.degToRad(az)
  const e = THREE.MathUtils.degToRad(el)
  return out.set(-Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e))
}

const UP = new THREE.Vector3(0, 1, 0)

// 依畫面尺寸算出鏡頭距離與平移：fit 點全部落在扣掉 insets 的框內，並置中
function fitView(def, width, height, insets) {
  const aspect = width / Math.max(1, height)
  const tanV = Math.tan(THREE.MathUtils.degToRad(def.fov / 2))
  const tanH = tanV * aspect
  const dir = dirFromAngles(def.az, def.el)
  const fwd = dir.clone().negate()
  const right = new THREE.Vector3().crossVectors(fwd, UP).normalize()
  const up = new THREE.Vector3().crossVectors(right, fwd)
  // 可用的 NDC 範圍
  const x0 = -1 + (2 * insets.left) / width
  const x1 = 1 - (2 * insets.right) / width
  const y0 = -1 + (2 * insets.bottom) / height
  const y1 = 1 - (2 * insets.top) / height

  const target = new THREE.Vector3(...def.target)
  const cam = new THREE.Vector3()
  const rel = new THREE.Vector3()
  let dist = 320
  for (let it = 0; it < 40; it++) {
    cam.copy(target).addScaledVector(dir, dist)
    let bx0 = Infinity
    let bx1 = -Infinity
    let by0 = Infinity
    let by1 = -Infinity
    for (const p of def.fit) {
      rel.subVectors(p, cam)
      const z = Math.max(1, rel.dot(fwd))
      const x = rel.dot(right) / (z * tanH)
      const y = rel.dot(up) / (z * tanV)
      if (x < bx0) bx0 = x
      if (x > bx1) bx1 = x
      if (y < by0) by0 = y
      if (y > by1) by1 = y
    }
    const k = Math.max((bx1 - bx0) / (x1 - x0), (by1 - by0) / (y1 - y0))
    // 平移，讓點雲中心對到可用框的中心
    const cx = (bx0 + bx1) / 2 - (x0 + x1) / 2
    const cy = (by0 + by1) / 2 - (y0 + y1) / 2
    target.addScaledVector(right, cx * dist * tanH).addScaledVector(up, cy * dist * tanV)
    const next = dist * (0.4 + 0.6 * k)
    if (Math.abs(next - dist) < 0.01 && Math.abs(cx) + Math.abs(cy) < 1e-4) break
    dist = next
  }
  return {
    pos: target.clone().addScaledVector(dir, dist),
    target,
    fov: def.fov,
    near: 10,
    seat: false,
  }
}

// ---------- 我的視野 ----------

// 視線目標：遠的座位看主螢幕中心；近的座位（A 區等）改看舞台上的表演者高度，舞台才不會掉出畫面
const LOOK_SCREEN = new THREE.Vector3(0, STAGE.screen.y0 + STAGE.screen.height / 2, STAGE.screen.z)
const LOOK_STAGE = new THREE.Vector3(0, STAGE.height + 3, (STAGE.z0 + STAGE.z1) / 2)
function seatLook(eye) {
  const dist = Math.hypot(eye.x - LOOK_STAGE.x, eye.z - LOOK_STAGE.z)
  const t = THREE.MathUtils.smoothstep(dist, 25, 110)
  return LOOK_STAGE.clone().lerp(LOOK_SCREEN, t)
}

// 屋頂（假設為扁橢球）在 (x, z) 的高度：給轉場路徑避開屋頂用
export function roofHeightAt(x, z) {
  const r = (x / ROOF.rx) ** 2 + (z / ROOF.rz) ** 2
  return ROOF.eaveY + (ROOF.apexY - ROOF.eaveY) * Math.max(0, 1 - r)
}

// 鏡頭是否在建築內（屋頂底下）
export function isInside(p) {
  const r = (p.x / ROOF.rx) ** 2 + (p.z / ROOF.rz) ** 2
  return r < 1 && p.y < roofHeightAt(p.x, p.z)
}

// 「我的視野」：位置、目標、fov，以及轉場時先飛到的「懸停點」（往場內、往上）
export function seatView(zone, aspect) {
  // 眼睛位置直接用看台模型的 seatEye()，和實際的階梯、場地平台高度一致
  const pos = seatEye(zone)
  // 水平視野約 70°（人眼舒適範圍），換算成垂直 fov；寬畫面時垂直 fov 自動變小
  const fov = THREE.MathUtils.clamp(
    THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(35)) / aspect)),
    44,
    56,
  )
  // 懸停點：看台往場地中心 22 m、往上 24 m；場地往舞台 10 m、往上 20 m；不超過屋頂
  const hover = pos.clone()
  if (zone.kind === 'floor') {
    hover.z -= 10
    hover.y += 20
  } else {
    const inward = new THREE.Vector3(-pos.x, 0, -pos.z).normalize()
    hover.addScaledVector(inward, 22)
    hover.y += 24
  }
  hover.y = Math.min(hover.y, roofHeightAt(hover.x, hover.z) - 8)
  return { pos, target: seatLook(pos), fov, near: 0.25, seat: true, hover }
}

// 取得某個視角的鏡頭狀態；seat 沒有選區時退回全場
export function resolveView(id, zone, width, height, insets = FRAME_INSETS) {
  if (id === 'seat' && zone) return seatView(zone, width / Math.max(1, height))
  const def = FRAMED[id] ?? FRAMED[DEFAULT_VIEW]
  return fitView(def, width, height, insets)
}
