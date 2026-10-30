import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { getZone } from '../../../data/lumen'
import { DEFAULT_VIEW, isInside, resolveView, roofHeightAt } from './views'

// 鏡頭系統：驅動 R3F 預設鏡頭，在預設鏡位之間做平滑轉場
// - 第一次掛載直接到位，不播動畫；prefers-reduced-motion 也直接到位
// - 兩個「場外」鏡位之間：繞著（內插中的）目標點做球面內插，像環繞飛行，不會穿過建築
// - 進出「我的視野」：三次貝茲曲線，先往場內上方的懸停點飛，再落進座位（離開時反過來先升起）
// - 只在轉場時每幀更新並 invalidate()，靜止時不做事；每幀不配置新物件

const DUR_ORBIT = 1.0
const DUR_SEAT = 1.2
const FAR = 1500

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2) // easeInOutCubic

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// 向量 → 方位角／俯角／距離（同 views.dirFromAngles 的定義）
function toSpherical(v, out) {
  out.r = v.length()
  out.el = Math.asin(THREE.MathUtils.clamp(v.y / Math.max(out.r, 1e-6), -1, 1))
  out.az = Math.atan2(-v.x, -v.z)
  return out
}

export default function CameraRig({ view, selectedId }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)

  const zone = useMemo(() => (selectedId ? getZone(selectedId) : null), [selectedId])
  const effective = view === 'seat' && !zone ? DEFAULT_VIEW : view

  // 目前的鏡頭狀態與轉場資料（全部預先配置好）
  const st = useMemo(
    () => ({
      ready: false,
      active: false,
      t: 0,
      dur: 1,
      mode: 'orbit',
      lookAt: new THREE.Vector3(), // 目前的注視點
      fov: 35,
      near: 10,
      atSeat: false, // 靜止在「我的視野」
      key: '',
      // 起點／終點
      p0: new THREE.Vector3(),
      t0: new THREE.Vector3(),
      fov0: 35,
      p3: new THREE.Vector3(),
      t3: new THREE.Vector3(),
      fov3: 35,
      near3: 10,
      seat3: false,
      // 貝茲控制點
      c1: new THREE.Vector3(),
      c2: new THREE.Vector3(),
      // 球面內插參數
      s0: { r: 0, az: 0, el: 0 },
      s3: { r: 0, az: 0, el: 0 },
      hover: new THREE.Vector3(), // 目前座位的懸停點（離開座位時先飛到這裡）
      hasHover: false,
      tmp: new THREE.Vector3(),
      tmpT: new THREE.Vector3(),
    }),
    [],
  )

  // 把狀態寫進鏡頭
  const apply = (pos, look, fov, near) => {
    camera.position.copy(pos)
    camera.up.set(0, 1, 0)
    camera.lookAt(look)
    if (camera.fov !== fov || camera.near !== near || camera.far !== FAR) {
      camera.fov = fov
      camera.near = near
      camera.far = FAR
      camera.updateProjectionMatrix()
    }
    camera.updateMatrixWorld()
  }

  // 設定終點，並把終點方位角展開成離起點最近的角度（走最短路徑）
  const setEnd = (dest) => {
    st.p3.copy(dest.pos)
    st.t3.copy(dest.target)
    st.fov3 = dest.fov
    st.near3 = dest.near
    st.seat3 = dest.seat
    toSpherical(st.tmp.subVectors(st.p3, st.t3), st.s3)
    const dAz = st.s3.az - st.s0.az
    st.s3.az = st.s0.az + Math.atan2(Math.sin(dAz), Math.cos(dAz))
  }
  const rememberHover = (dest) => {
    st.hasHover = dest.seat
    if (dest.seat) st.hover.copy(dest.hover)
  }

  useLayoutEffect(() => {
    const dest = resolveView(effective, zone, size.width, size.height)
    const key = effective === 'seat' ? `seat:${zone.id}` : effective
    const sameTarget = key === st.key
    st.key = key

    // 尺寸改變（同一個鏡位）：靜止時直接重新框景；轉場中只更新終點
    // 第一次掛載、或使用者偏好減少動態：直接到位
    const jump = !st.ready || reducedMotion() || (sameTarget && !st.active)
    if (jump) {
      st.ready = true
      st.active = false
      st.lookAt.copy(dest.target)
      st.fov = dest.fov
      st.near = dest.near
      st.atSeat = dest.seat
      rememberHover(dest)
      apply(dest.pos, dest.target, dest.fov, dest.near)
      invalidate()
      return
    }

    // 轉場途中改尺寸：只修正終點（與控制點），起點與進度不變
    if (sameTarget && st.active) {
      setEnd(dest)
      if (st.mode === 'bezier' && !dest.seat) st.c2.copy(dest.pos)
      return
    }

    const fromSeat = !st.active && st.atSeat
    // 起點 = 鏡頭目前的實際狀態（轉場到一半被打斷也能接得順）
    st.p0.copy(camera.position)
    st.t0.copy(st.lookAt)
    st.fov0 = camera.fov
    toSpherical(st.tmp.subVectors(st.p0, st.t0), st.s0)
    setEnd(dest)
    st.t = 0

    const startInside = fromSeat || isInside(st.p0)
    if (!dest.seat && !startInside) {
      st.mode = 'orbit'
      st.dur = DUR_ORBIT
    } else {
      st.mode = 'bezier'
      st.dur = DUR_SEAT
      // 起點控制點：從座位出發 → 先升到場內懸停點；在場內其他位置 → 先往上；場外 → 原地
      if (fromSeat && st.hasHover) st.c1.copy(st.hover)
      else if (startInside) {
        st.c1.copy(st.p0)
        st.c1.y = Math.min(st.p0.y + 20, roofHeightAt(st.p0.x, st.p0.z) - 8)
      } else st.c1.copy(st.p0)
      // 終點控制點：進座位 → 懸停點；出場外 → 終點本身
      st.c2.copy(dest.seat ? dest.hover : dest.pos)
    }
    rememberHover(dest)

    // 轉場中用兩者較小的 near，避免靠近座位時被裁掉
    st.near = Math.min(camera.near, dest.near)
    st.active = st.p0.distanceToSquared(st.p3) > 1e-4 || st.t0.distanceToSquared(st.t3) > 1e-4 || st.fov0 !== st.fov3
    st.atSeat = dest.seat && !st.active
    if (!st.active) apply(dest.pos, dest.target, dest.fov, dest.near)
    invalidate()
  }, [effective, zone, size.width, size.height, camera, invalidate, st])

  useFrame((state, delta) => {
    if (!st.active) return
    st.t = Math.min(1, st.t + Math.min(delta, 1 / 20) / st.dur)
    const e = ease(st.t)
    const pos = st.tmp
    const look = st.tmpT.lerpVectors(st.t0, st.t3, e)

    if (st.mode === 'orbit') {
      const r = THREE.MathUtils.lerp(st.s0.r, st.s3.r, e)
      const az = THREE.MathUtils.lerp(st.s0.az, st.s3.az, e)
      const el = THREE.MathUtils.lerp(st.s0.el, st.s3.el, e)
      pos.set(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).multiplyScalar(r).add(look)
    } else {
      // 三次貝茲：p0 → c1 → c2 → p3
      const u = 1 - e
      const b0 = u * u * u
      const b1 = 3 * u * u * e
      const b2 = 3 * u * e * e
      const b3 = e * e * e
      pos
        .set(0, 0, 0)
        .addScaledVector(st.p0, b0)
        .addScaledVector(st.c1, b1)
        .addScaledVector(st.c2, b2)
        .addScaledVector(st.p3, b3)
    }
    const fov = THREE.MathUtils.lerp(st.fov0, st.fov3, e)

    if (st.t >= 1) {
      st.active = false
      st.atSeat = st.seat3
      st.lookAt.copy(st.t3)
      st.near = st.near3
      apply(st.p3, st.t3, st.fov3, st.near3)
    } else {
      st.lookAt.copy(look)
      apply(pos, look, fov, st.near)
    }
    // 結束時也再要一幀：讓其他元件（例如依鏡頭在場內／場外切換的屋頂）看到最終位置
    state.invalidate()
  })

  return null
}
