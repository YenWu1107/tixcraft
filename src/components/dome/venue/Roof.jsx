import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { LATTICE, SHELL, SPEAKER_CLUSTER } from '../../../data/domeLayout'
import { COLORS, noRaycast, withCutaway } from './materials'
import { CAP, DECK, LAT, beamMatrix, capY, deckY, domeSurface, fillInstances, latY, ringSweep, ringXZ } from './geometry'

// 屋頂：外部鈦金屬殼、內側近黑屋面板、白色菱形鋼構網格、探照燈環、貓道、中央喇叭框架

// 細線貼圖（屋面縫線、二次桁架）：程式產生
function lineTexture({ size = 128, bg, line, width = 3, grid = false }) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = line
  ctx.fillRect(0, 0, width, size)
  if (grid) ctx.fillRect(0, 0, size, width)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// 鋼構網格：u+v = c 與 u−v = c 兩組線（u、v 為橢圓正規化座標），投影到屋頂曲面上
function latticeMatrices() {
  const { spacing: S, memberWidth: W, memberDepth: H } = LATTICE
  const K = Math.ceil(Math.SQRT2 / S)
  const step = S / 4 // 每格切兩段，讓弧線平滑
  const inside = (u, v) => u * u + v * v <= 1
  const toWorld = (u, v, out) => {
    const r = Math.min(1, Math.hypot(u, v))
    return out.set(u * LAT.ax, latY(r), v * LAT.az)
  }
  // 曲面法線（數值微分，外緣附近夾住避免無限斜率）
  const normalAt = (u, v, out) => {
    const r = Math.hypot(u, v)
    const k = r > 0.985 ? 0.985 / r : 1
    const uu = u * k
    const vv = v * k
    const e = 0.002
    const fy = (a, b) => latY(Math.hypot(a, b))
    const dx = (fy(uu + e, vv) - fy(uu - e, vv)) / (2 * e * LAT.ax)
    const dz = (fy(uu, vv + e) - fy(uu, vv - e)) / (2 * e * LAT.az)
    return out.set(-dx, 1, -dz).normalize()
  }
  const out = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (const fam of [1, -1]) {
    for (let i = -K; i <= K; i++) {
      const c = i * S
      // 線上的點：fam=1 → v = c − u；fam=−1 → v = u − c
      const vOf = (u) => (fam === 1 ? c - u : u - c)
      for (let u = -1.5; u < 1.5; u += step) {
        let u0 = u
        let u1 = u + step
        const in0 = inside(u0, vOf(u0))
        const in1 = inside(u1, vOf(u1))
        if (!in0 && !in1) continue
        // 裁到外緣（二分法）
        if (in0 !== in1) {
          let lo = in0 ? u0 : u1
          let hi = in0 ? u1 : u0
          for (let k = 0; k < 18; k++) {
            const mid = (lo + hi) / 2
            if (inside(mid, vOf(mid))) lo = mid
            else hi = mid
          }
          if (in0) u1 = lo
          else u0 = lo
        }
        if (Math.abs(u1 - u0) < 1e-4) continue
        toWorld(u0, vOf(u0), a)
        toWorld(u1, vOf(u1), b)
        const um = (u0 + u1) / 2
        normalAt(um, vOf(um), n)
        out.push(beamMatrix(a, b, W, H, n, new THREE.Matrix4(), H / 2))
      }
    }
  }
  return out
}

function Lattice() {
  const ref = useRef()
  const matrices = useMemo(latticeMatrices, [])
  const material = useMemo(
    () =>
      withCutaway(new THREE.MeshStandardMaterial({ color: COLORS.steel, roughness: 0.6, metalness: 0.1 }), {
        ghost: 0.05,
        wash: 0.26,
        key: 'lattice',
      }),
    [],
  )
  useLayoutEffect(() => fillInstances(ref.current, matrices), [matrices])
  return (
    <instancedMesh ref={ref} args={[null, null, matrices.length]} material={material} raycast={noRaycast} renderOrder={3}>
      <boxGeometry />
    </instancedMesh>
  )
}

// 外部鈦金屬屋殼：沿長軸的淡淡分割線＋頂部的內圈橢圓縫
function Cap() {
  const geo = useMemo(() => domeSurface({ ax: CAP.ax, az: CAP.az, yOf: capY, rings: 40, segs: 200, uvScale: 1 / 7 }), [])
  const seam = useMemo(
    () => domeSurface({ ax: CAP.ax, az: CAP.az, yOf: (r) => capY(r) + 0.08, r0: 0.6, r1: 0.606, rings: 1, segs: 200 }),
    [],
  )
  const mats = useMemo(() => {
    const map = lineTexture({ bg: '#ffffff', line: '#c3c8d0', width: 4 })
    const cap = withCutaway(
      new THREE.MeshStandardMaterial({ color: COLORS.titanium, map, roughness: 0.5, metalness: 0.25, side: THREE.DoubleSide }),
      { key: 'cap' },
    )
    // 剖開時看到的殼內側：畫成深色剖面
    cap.onBeforeCompile = ((orig) => (shader) => {
      orig(shader)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif (!gl_FrontFacing) gl_FragColor.rgb = vec3(0.035, 0.04, 0.05);',
      )
    })(cap.onBeforeCompile)
    const seamMat = withCutaway(new THREE.MeshStandardMaterial({ color: '#4E5866', roughness: 0.6 }), { key: 'seam' })
    return { cap, seamMat }
  }, [])
  return (
    <group>
      <mesh geometry={geo} material={mats.cap} raycast={noRaycast} />
      <mesh geometry={seam} material={mats.seamMat} raycast={noRaycast} />
    </group>
  )
}

// 內側屋面板：近黑，帶二次桁架的細格線
function Deck() {
  const geo = useMemo(() => domeSurface({ ax: DECK.ax, az: DECK.az, yOf: deckY, rings: 36, segs: 180, uvScale: 1 / 4.5 }), [])
  const mat = useMemo(() => {
    const map = lineTexture({ bg: '#ffffff', line: '#5a5f6e', width: 5, grid: true })
    return withCutaway(
      new THREE.MeshStandardMaterial({ color: COLORS.deck, map, roughness: 0.9, side: THREE.DoubleSide }),
      { wash: 0.045, key: 'deck' },
    )
  }, [])
  return <mesh geometry={geo} material={mat} raycast={noRaycast} />
}

// 起拱線：探照燈環（演出中大多關閉，只留少數亮著）＋淺灰貓道
function Springline() {
  const lights = useRef()
  const { matrices, colors } = useMemo(() => {
    const N = 228
    const matrices = []
    const colors = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < N; i++) {
      const phi = (i / N) * 360
      const [x, z] = ringXZ(SHELL.wallD - 0.9, phi)
      const [x2, z2] = ringXZ(SHELL.wallD - 0.5, phi + 0.1)
      e.set(-0.5, Math.atan2(x2 - x, z2 - z) + Math.PI / 2, 0, 'YXZ')
      q.setFromEuler(e)
      m.compose(new THREE.Vector3(x, SHELL.springY + 0.9, z), q, new THREE.Vector3(1.3, 0.9, 0.5))
      matrices.push(m.clone())
      const on = i % 19 === 0 || i % 23 === 5
      colors.push(new THREE.Color(on ? '#fff3dc' : '#3a3f4a').multiplyScalar(on ? 2.4 : 1))
    }
    return { matrices, colors }
  }, [])
  useLayoutEffect(() => fillInstances(lights.current, matrices, colors), [matrices, colors])

  const catwalk = useMemo(() => {
    const d0 = SHELL.wallD - 2.6
    const y = SHELL.springY - 1.2
    return ringSweep(
      [
        { a: [d0, y - 0.9], b: [d0, y + 0.3], g: 0 }, // 前緣（朝內）往上 → 法線朝場內
        { a: [SHELL.deckD + 0.2, y - 0.9], b: [d0, y - 0.9], g: 0 }, // 底面（朝下）
        { a: [d0, y + 1.3], b: [d0, y + 1.32], g: 1 }, // 欄杆頂（細線）
      ],
      { segs: 360 },
    )
  }, [])
  const mats = useMemo(
    () => ({
      lamp: withCutaway(new THREE.MeshBasicMaterial({ color: '#ffffff' }), { key: 'lamp' }),
      cat: withCutaway(new THREE.MeshStandardMaterial({ color: COLORS.catwalk, roughness: 0.7, side: THREE.DoubleSide }), {
        wash: 0.12,
        key: 'catwalk',
      }),
      rail: withCutaway(new THREE.MeshBasicMaterial({ color: '#6f7685', side: THREE.DoubleSide }), { key: 'rail' }),
    }),
    [],
  )
  return (
    <group>
      <instancedMesh ref={lights} args={[null, null, matrices.length]} material={mats.lamp} raycast={noRaycast}>
        <boxGeometry />
      </instancedMesh>
      <mesh geometry={catwalk} material={[mats.cat, mats.rail]} raycast={noRaycast} />
    </group>
  )
}

// 中央吊掛的喇叭框架：深色方框＋交叉梁，四角吊著線陣列喇叭
function SpeakerCluster() {
  const { width: W, depth: D, y } = SPEAKER_CLUSTER
  const geo = useMemo(() => {
    const parts = []
    const box = (w, h, d, x, yy, z, ry = 0) => {
      const g = new THREE.BoxGeometry(w, h, d)
      if (ry) g.rotateY(ry)
      g.translate(x, yy, z)
      parts.push(g)
    }
    const t = 1.6
    box(W, 2.6, t, 0, y, -D / 2)
    box(W, 2.6, t, 0, y, D / 2)
    box(t, 2.6, D, -W / 2, y, 0)
    box(t, 2.6, D, W / 2, y, 0)
    const diag = Math.hypot(W, D)
    const ang = Math.atan2(D, W)
    box(diag, 1.8, 1.2, 0, y + 0.4, 0, ang)
    box(diag, 1.8, 1.2, 0, y + 0.4, 0, -ang)
    // 線陣列：每組 7 顆，往下略成 J 形
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
      [0, -1],
      [0, 1],
    ]) {
      for (let k = 0; k < 7; k++) {
        const g = new THREE.BoxGeometry(1.4, 0.75, 1.1)
        g.rotateX(sz * k * 0.05)
        g.translate(sx * (W / 2 - 1.5), y - 2 - k * 0.8, sz * (D / 2 - 0.2) + sz * k * k * 0.02)
        parts.push(g)
      }
    }
    return mergeGeometries(parts.map((g) => g.toNonIndexed()))
  }, [W, D, y])
  // 吊索：從框架四角拉到屋面
  const cables = useMemo(() => {
    const pts = []
    for (const [sx, sz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      const x = (sx * W) / 2
      const z = (sz * D) / 2
      pts.push(x, y + 1.3, z, x * 1.25, latY(Math.hypot((x * 1.25) / 89, (z * 1.25) / 119)), z * 1.25)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return g
  }, [W, D, y])
  const mats = useMemo(
    () => ({
      box: withCutaway(new THREE.MeshStandardMaterial({ color: '#16181e', roughness: 0.65 }), { wash: 0.05, key: 'spk' }),
      cable: withCutaway(new THREE.LineBasicMaterial({ color: '#3b3f4b' }), { key: 'cable' }),
    }),
    [],
  )
  return (
    <group>
      <mesh geometry={geo} material={mats.box} raycast={noRaycast} />
      <lineSegments geometry={cables} material={mats.cable} raycast={noRaycast} />
    </group>
  )
}

export default function Roof() {
  return (
    <group>
      <Cap />
      <Deck />
      <Lattice />
      <Springline />
      <SpeakerCluster />
    </group>
  )
}
