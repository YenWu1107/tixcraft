import * as THREE from 'three'
import { FIELD, ROOF, SHELL } from '../../../data/domeLayout'

// 建築幾何的共用工具（純函式，不含 React）

const DEG = Math.PI / 180

// 場地橢圓往外偏移 d、角度 phi（度）→ [x, z]（與 domeLayout 的 ellipsePoint 相同定義）
export const ringXZ = (d, phi) => [-(FIELD.rx + d) * Math.sin(phi * DEG), -(FIELD.rz + d) * Math.cos(phi * DEG)]

// ── 屋頂剖面：r = 0（中心）～ 1（外緣），橢圓正規化半徑 ──
// 外部鈦金屬殼：從水平折線（ROOF.eaveY）圓滑收到頂點
export const CAP = { ax: ROOF.rx, az: ROOF.rz }
export const capY = (r) => ROOF.eaveY + (ROOF.apexY - ROOF.eaveY) * Math.pow(Math.max(0, 1 - Math.pow(r, 2.4)), 0.5)
// 內側屋面板（近黑）
export const DECK = { ax: FIELD.rx + SHELL.deckD, az: FIELD.rz + SHELL.deckD }
export const deckY = (r) => SHELL.springY + (SHELL.deckApexY - SHELL.springY) * Math.pow(Math.max(0, 1 - r * r), 0.55)
// 白色鋼構網格（下緣）
export const LAT = { ax: FIELD.rx + SHELL.latticeD, az: FIELD.rz + SHELL.latticeD }
export const latY = (r) => SHELL.springY + (SHELL.latticeApexY - SHELL.springY) * Math.pow(Math.max(0, 1 - r * r), 0.55)

// 橢圓曲面（rings × segs 的網格），r 在外緣加密；uv = (x/尺度, z/尺度)
export function domeSurface({ ax, az, yOf, r0 = 0, r1 = 1, rings = 40, segs = 160, uvScale = 1 }) {
  const pos = []
  const uv = []
  const idx = []
  for (let i = 0; i <= rings; i++) {
    const t = i / rings
    const r = r0 + (r1 - r0) * Math.sin((t * Math.PI) / 2)
    for (let j = 0; j <= segs; j++) {
      const p = (j / segs) * Math.PI * 2
      const x = -ax * r * Math.sin(p)
      const z = -az * r * Math.cos(p)
      pos.push(x, yOf(r), z)
      uv.push(x * uvScale, z * uvScale)
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j
      const b = a + segs + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// 剖面（d, y）沿橢圓掃掠成環帶；edges = [{ a: [d, y], b: [d, y], g: 材質編號 }]
// uv：u = 沿周長公尺數 / uScale，v = 沿剖面邊的長度 / vScale
// 回傳的 geometry 依 g 分 group（給多材質 mesh 用）
export function ringSweep(edges, { phi0 = 0, phi1 = 360, segs = 240, uScale = 1, vScale = 1, flip = false } = {}) {
  const groups = new Map()
  const pos = []
  const uv = []
  const n = Math.max(2, Math.ceil(((phi1 - phi0) / 360) * segs))
  for (const e of edges) {
    const start = pos.length / 3
    const len = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1])
    let arc = 0
    let prev = null
    for (let j = 0; j <= n; j++) {
      const phi = phi0 + ((phi1 - phi0) * j) / n
      const pa = ringXZ(e.a[0], phi)
      if (prev) arc += Math.hypot(pa[0] - prev[0], pa[1] - prev[1])
      prev = pa
      const pb = ringXZ(e.b[0], phi)
      pos.push(pa[0], e.a[1], pa[1], pb[0], e.b[1], pb[1])
      uv.push(arc / uScale, (e.v0 ?? 0) / vScale, arc / uScale, ((e.v0 ?? 0) + len) / vScale)
    }
    const list = groups.get(e.g ?? 0) ?? []
    for (let j = 0; j < n; j++) {
      const a0 = start + j * 2
      if (flip) list.push(a0, a0 + 2, a0 + 1, a0 + 1, a0 + 2, a0 + 3)
      else list.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2)
    }
    groups.set(e.g ?? 0, list)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  const keys = [...groups.keys()].sort((a, b) => a - b)
  const index = []
  for (const k of keys) {
    const list = groups.get(k)
    g.addGroup(index.length, list.length, k)
    index.push(...list)
  }
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

// 沿 a→b 擺一根方管（InstancedMesh 用）：寬 w、深 h（沿 up 方向）
const _x = new THREE.Vector3()
const _y = new THREE.Vector3()
const _z = new THREE.Vector3()
const _m = new THREE.Matrix4()
export function beamMatrix(a, b, w, h, up, out = new THREE.Matrix4(), offsetUp = 0) {
  _x.subVectors(b, a)
  const len = _x.length()
  _x.divideScalar(len)
  _z.crossVectors(_x, up).normalize()
  _y.crossVectors(_z, _x).normalize()
  _m.makeBasis(_x, _y, _z)
  _m.scale(_z.set(len, h, w))
  _m.setPosition(
    (a.x + b.x) / 2 + _y.x * offsetUp,
    (a.y + b.y) / 2 + _y.y * offsetUp,
    (a.z + b.z) / 2 + _y.z * offsetUp,
  )
  return out.copy(_m)
}

// 由 Matrix4 陣列建立 InstancedMesh 的 instanceMatrix（只建一次，不每幀更新）
export function fillInstances(mesh, matrices, colors) {
  if (!mesh) return
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
  if (colors) colors.forEach((c, i) => mesh.setColorAt(i, c))
  mesh.count = matrices.length
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
}
