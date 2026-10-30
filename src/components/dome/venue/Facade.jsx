import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GRADE_Y, ROOF, SHELL, SKIRT_WALL } from '../../../data/domeLayout'
import { COLORS, noRaycast, withCutaway } from './materials'
import { fillInstances, ringSweep, ringXZ } from './geometry'

// 外牆與內牆：
// 外觀 = 水平折線下方的銀色菱形板帶 → 青綠色玻璃帶 → 裙樓（層層銀色樓板＋內縮玻璃帷幕＋圓柱）
// 內部 = 看台後方的內牆、藍色走廊燈帶、外野端的灰色弧牆（舞台背景）

// 菱形鱗片板（銀色板帶）
function diamondTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#8f96a0'
  ctx.fillRect(0, 0, 128, 128)
  for (let row = 0; row < 4; row++) {
    for (let col = -1; col < 5; col++) {
      const x = col * 32 + (row % 2) * 16
      const y = row * 32
      const g = ctx.createLinearGradient(x, y, x + 32, y + 32)
      const k = 0.75 + 0.25 * Math.sin(col * 1.7 + row * 2.3)
      g.addColorStop(0, `rgba(255,255,255,${0.85 * k})`)
      g.addColorStop(1, `rgba(170,176,186,${0.9 * k})`)
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.moveTo(x + 16, y + 1)
      ctx.lineTo(x + 31, y + 16)
      ctx.lineTo(x + 16, y + 31)
      ctx.lineTo(x + 1, y + 16)
      ctx.closePath()
      ctx.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// 玻璃帶：密集的直向窗框（亮度貼圖，配合 emissive 發光）
function mullionTexture({ glow, frame, every = 8, lit = 1 }) {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 64
  const ctx = c.getContext('2d')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 64)
  // 室內光的明暗變化
  for (let i = 0; i < 128; i += 16) {
    ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.25 * Math.abs(Math.sin(i * 0.37)) * lit})`
    ctx.fillRect(i, 0, 16, 64)
  }
  ctx.fillStyle = frame
  for (let i = 0; i < 128; i += 128 / every) ctx.fillRect(i, 0, 3, 64)
  ctx.fillRect(0, 0, 128, 4)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

// 縫線（外野弧牆的直向分割）
function seamTexture() {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 8
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, 128, 8)
  ctx.fillStyle = '#9da2ab'
  ctx.fillRect(0, 0, 3, 8)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

function Exterior() {
  const geo = useMemo(() => {
    const top = ROOF.rx - 42 // 折線處的偏移 d（= 52）
    const e = []
    // g：0 菱形板帶、1 青綠玻璃帶、2 樓板、3 玻璃帷幕、4 深色底面
    e.push({ a: [top, ROOF.eaveY], b: [top - 1.4, 35.6], g: 0 })
    e.push({ a: [top - 1.4, 35.6], b: [top - 2.0, 35.6], g: 4 })
    e.push({ a: [top - 2.0, 35.6], b: [top - 2.0, 31.4], g: 1 })
    const slab = (d, y, out) => {
      e.push({ a: [d, y + 1.2], b: [out, y + 1.2], g: 2 }) // 上面
      e.push({ a: [out, y + 1.2], b: [out, y], g: 2 }) // 前緣
      e.push({ a: [out, y], b: [d, y], g: 4 }) // 底面
    }
    slab(top - 2.0, 30.2, top - 0.6)
    e.push({ a: [48.8, 30.2], b: [48.8, 25.0], g: 3 })
    slab(48.8, 23.8, top - 0.2)
    e.push({ a: [48.8, 23.8], b: [48.8, 18.6], g: 3 })
    slab(48.8, 17.4, top - 0.8)
    e.push({ a: [48.6, 17.4], b: [48.6, GRADE_Y - 0.2], g: 3 })
    return ringSweep(e, { segs: 320, uScale: 6, vScale: 6 })
  }, [])

  const mats = useMemo(() => {
    const diamond = diamondTexture()
    diamond.repeat.set(1, 1)
    const ribbon = mullionTexture({ glow: '#ffffff', frame: '#20343a', every: 16 })
    const curtain = mullionTexture({ glow: '#ffffff', frame: '#2b2d33', every: 6, lit: 1 })
    return [
      withCutaway(
        new THREE.MeshStandardMaterial({
          color: COLORS.silver,
          map: diamond,
          roughness: 0.45,
          metalness: 0.3,
          emissive: '#5a6270',
          emissiveIntensity: 0.25,
          emissiveMap: diamond,
          side: THREE.DoubleSide,
        }),
        { key: 'band' },
      ),
      withCutaway(
        new THREE.MeshStandardMaterial({
          color: '#0d2a2e',
          emissive: '#3fd0cc',
          emissiveIntensity: 0.7,
          emissiveMap: ribbon,
          roughness: 0.2,
          side: THREE.DoubleSide,
        }),
        { key: 'ribbon' },
      ),
      withCutaway(new THREE.MeshStandardMaterial({
          color: '#d4d9e0',
          emissive: '#4a5260',
          emissiveIntensity: 0.35,
          roughness: 0.5,
          metalness: 0.2,
          side: THREE.DoubleSide,
        }),
        {
        key: 'slab',
      }),
      withCutaway(
        new THREE.MeshStandardMaterial({
          color: '#101418',
          emissive: '#ffd9b0',
          emissiveIntensity: 0.13,
          emissiveMap: curtain,
          roughness: 0.25,
          side: THREE.DoubleSide,
        }),
        { key: 'curtain' },
      ),
      withCutaway(new THREE.MeshStandardMaterial({ color: '#30343c', roughness: 0.8, side: THREE.DoubleSide }), {
        key: 'soffit',
      }),
    ]
  }, [])

  // 裙樓的銀色圓柱
  const cols = useRef()
  const colMatrices = useMemo(() => {
    const N = 64
    const h = 31.4 - GRADE_Y
    return Array.from({ length: N }, (_, i) => {
      const [x, z] = ringXZ(50.4, (i / N) * 360 + 2.8)
      return new THREE.Matrix4().compose(
        new THREE.Vector3(x, GRADE_Y + h / 2, z),
        new THREE.Quaternion(),
        new THREE.Vector3(1, h, 1),
      )
    })
  }, [])
  useLayoutEffect(() => fillInstances(cols.current, colMatrices), [colMatrices])
  const colMat = useMemo(
    () => withCutaway(new THREE.MeshStandardMaterial({ color: '#8d939c', roughness: 0.4, metalness: 0.3 }), { key: 'col' }),
    [],
  )

  return (
    <group>
      <mesh geometry={geo} material={mats} raycast={noRaycast} />
      <instancedMesh ref={cols} args={[null, null, colMatrices.length]} material={colMat} raycast={noRaycast}>
        <cylinderGeometry args={[0.9, 0.9, 1, 16, 1]} />
      </instancedMesh>
      <GateSign />
    </group>
  )
}

// 1 號門上方的「TAIPEI DOME」銀色字（本壘側）
function GateSign() {
  const { geo, mat } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 1024
    c.height = 128
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 1024, 128)
    ctx.font = '600 92px "Helvetica Neue", Arial, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f2f4f8'
    ctx.fillText('T A I P E I   D O M E', 512, 68)
    const map = new THREE.CanvasTexture(c)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    const geo = ringSweep([{ a: [52.25, 28.6], b: [52.25, 25.6] }], { phi0: 192, phi1: 212, segs: 720, uScale: 1, vScale: 1 })
    // 把 uv 正規化成 0–1
    const uv = geo.attributes.uv
    let maxU = 0
    for (let i = 0; i < uv.count; i++) maxU = Math.max(maxU, uv.getX(i))
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / maxU, 1 - uv.getY(i) / 3)
    const mat = withCutaway(
      new THREE.MeshBasicMaterial({ map, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), depthWrite: false }),
      { key: 'gate' },
    )
    return { geo, mat }
  }, [])
  return <mesh geometry={geo} material={mat} raycast={noRaycast} />
}

function Interior() {
  // 內牆（看台後方，整圈）：剖面邊往上 → 法線朝場內
  const wall = useMemo(
    () =>
      ringSweep(
        [
          { a: [SHELL.wallD, -0.3], b: [SHELL.wallD, SHELL.springY], g: 0 },
          { a: [SHELL.wallD - 0.05, 42.3], b: [SHELL.wallD - 0.05, 42.75], g: 1 }, // 5 樓上方的藍色燈帶
        ],
        { segs: 360, uScale: 4 },
      ),
    [],
  )
  // 外野端的弧牆：從 4 樓頂往上、往後微微傾斜的凹面
  const skirt = useMemo(() => {
    const { phi, d0, y0, d1, y1 } = SKIRT_WALL
    const e = []
    const N = 10
    let v = 0
    for (let i = 0; i < N; i++) {
      const t0 = i / N
      const t1 = (i + 1) / N
      const p = (t) => [d0 + (d1 - d0) * Math.pow(t, 1.6), y0 + (y1 - y0) * t]
      const a = p(t0)
      const b = p(t1)
      e.push({ a, b, g: 0, v0: v })
      v += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    // 弧牆底部的白色收邊（接 4 樓）
    e.push({ a: [d0 - 0.6, y0 - 0.2], b: [d0 - 0.6, y0 + 0.5], g: 1 })
    e.push({ a: [d0 - 0.6, y0 + 0.5], b: [d0, y0 + 0.5], g: 1 })
    return ringSweep(e, { phi0: -phi, phi1: phi, segs: 360, uScale: 5.5, vScale: 40 })
  }, [])

  const mats = useMemo(() => {
    const seams = seamTexture()
    return {
      wall: [
        withCutaway(new THREE.MeshStandardMaterial({ color: COLORS.concrete, roughness: 0.9 }), { wash: 0.04, key: 'iwall' }),
        withCutaway(new THREE.MeshBasicMaterial({ color: new THREE.Color('#3d6bff').multiplyScalar(1.6) }), { key: 'led' }),
      ],
      skirt: [
        withCutaway(
          new THREE.MeshStandardMaterial({ color: COLORS.skirt, map: seams, roughness: 0.75, side: THREE.DoubleSide }),
          { wash: 0.22, key: 'skirt' },
        ),
        withCutaway(new THREE.MeshStandardMaterial({ color: '#d5d9e0', roughness: 0.6 }), { key: 'skirtTrim' }),
      ],
    }
  }, [])

  return (
    <group>
      <mesh geometry={wall} material={mats.wall} raycast={noRaycast} />
      <mesh geometry={skirt} material={mats.skirt} raycast={noRaycast} />
    </group>
  )
}

export default function Facade() {
  return (
    <group>
      <Exterior />
      <Interior />
    </group>
  )
}
