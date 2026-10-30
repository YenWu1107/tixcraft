import * as THREE from 'three'
import { FIELD, LEVELS, ellipsePoint } from '../../../data/domeLayout'

// 看台幾何（單位：公尺）：每一區 = 結構（踏面、踢面、前牆、背牆、簷底）＋ 座椅條帶 ＋ LED 飾帶
// 剖面在 (d, y) 平面上描述，沿著橢圓 phi 掃出來；所有材質都是 DoubleSide，不必在意繞序

export const SEAT_PITCH = 0.5 // 座位寬
export const ATLAS_SEATS = 8 // 座椅貼圖一張含 8 個座位（亮度略有差異 → 斑點感）
export const LIFT_GROUPS = { TREAD: 0, STRUCT: 1, GLASS: 2, ACCENT: 3, MOUTH: 4 }
const G = LIFT_GROUPS

const SEG_DEG = 1 // 弧線取樣間距
const ROW_DEPTH = 0.9 // 排距
const AISLE = 0.6 // 每區兩側各 0.6 m 走道（相鄰兩區合起來 1.2 m）
const CURB_T = 0.25 // 前牆厚度
const CURB_UP = 0.35 // 前牆高出第一排踏面
const RAIL_H = 1.0 // 玻璃欄杆高
const BACK_T = 0.3 // 背牆厚度
export const FLOOR_DECK = 0.18 // 場地區塊的平台高度

const WHITE = new THREE.Color(1, 1, 1)
// 結構用頂點色（線性色彩空間）
const C = {
  fascia: new THREE.Color('#8f959e'),
  concrete: new THREE.Color('#383c44'),
  aisle: new THREE.Color('#4d525b'),
  dark: new THREE.Color('#1a1c21'),
  vom: new THREE.Color('#202329'),
  rail: new THREE.Color('#c7ccd3'),
}

const rad = (d) => (d * Math.PI) / 180
const lerp = (a, b, t) => a + (b - a) * t

// 橢圓偏移 d 處、角度 phi 的弧長速率（m / rad）
function localRadius(d, phi) {
  const p = rad(phi)
  return Math.hypot((FIELD.rx + d) * Math.cos(p), (FIELD.rz + d) * Math.sin(p))
}
const metersToDeg = (m, d, phi) => (m / localRadius(d, phi)) * (180 / Math.PI)

// ---------- 各層剖面 ----------
// 依 LEVELS 推導；為了避免上層壓到下層最後幾排，簷口與背牆高度在這裡處理
function makeProfile({ d0, d1, y0, y1 }, extra) {
  const rows = Math.max(1, Math.round((d1 - d0 - CURB_T) / ROW_DEPTH))
  const D = (d1 - d0 - CURB_T) / rows
  const rise = rows > 1 ? (y1 - y0) / (rows - 1) : 0
  return {
    d0,
    d1,
    y0,
    y1,
    rows,
    D,
    rise,
    curb: y0 + CURB_UP,
    dS: (i) => d0 + CURB_T + i * D,
    dE: (i) => d0 + CURB_T + (i + 1) * D,
    h: (i) => y0 + rise * i,
    ...extra,
  }
}

const L1 = LEVELS.L1
const L2 = LEVELS.L2
const L4 = LEVELS.L4
const L5 = LEVELS.L5
// 簷底（上層的底面）：前緣在 y0 - fascia，往後沿著坡度升高
const L2_BOTTOM = L2.y0 - 1.0
const L2_SOFFIT_BACK = L2.y1 - 0.8
const L5_BOTTOM = L5.y0 - 0.6
const L5_SOFFIT_BACK = L5.y1 - 0.8
const soffitAt = (lv, bottom, back, d) => lerp(bottom, back, (d - lv.d0) / (lv.d1 + BACK_T - lv.d0))

// 3 樓包廂：前緣退到 2 樓背牆之後（資料的 d0 = 28 會壓到 2 樓最後一排）
export const SUITE = {
  d0: Math.max(LEVELS.L3.d0, L2.d1),
  glassD: Math.max(LEVELS.L3.d0, L2.d1) + 1.4,
  d1: LEVELS.L3.d1,
  base: L2.y1 + 1.1,
  balcony: L2.y1 + 1.6,
  ceiling: LEVELS.L3.y1,
  roof: LEVELS.L3.y1 + 0.6,
  phi0: 40,
  phi1: 320,
  count: 36,
}

export const PROFILES = {
  L1: makeProfile(L1, {
    bottom: 0,
    soffitBack: 0,
    backTop: soffitAt(L2, L2_BOTTOM, L2_SOFFIT_BACK, L1.d1 + BACK_T),
    led: [0.5, 0.82],
    accent: true,
    solid: true, // 實心落地：不畫底面
  }),
  L2: makeProfile(L2, {
    bottom: L2_BOTTOM,
    soffitBack: L2_SOFFIT_BACK,
    backTop: SUITE.base,
    led: [L2_BOTTOM + 0.22, L2_BOTTOM + 0.82],
  }),
  // 4 樓：坐在包廂屋頂上；最後一排收在 5 樓簷口之前
  L4: makeProfile(
    { d0: L4.d0, d1: L5.d0, y0: L4.y0, y1: L4.y1 },
    {
      bottom: SUITE.roof,
      soffitBack: SUITE.roof,
      backTop: soffitAt(L5, L5_BOTTOM, L5_SOFFIT_BACK, L5.d0 + BACK_T),
      led: null,
    },
  ),
  L5: makeProfile(L5, {
    bottom: L5_BOTTOM,
    soffitBack: L5_SOFFIT_BACK,
    backTop: L5.y1 + 1.4,
    led: [L5_BOTTOM + 0.18, L5_BOTTOM + 0.58],
  }),
}

// ---------- 低階建構器 ----------
class Builder {
  constructor(groups = 1) {
    this.pos = []
    this.uv = []
    this.col = []
    this.idx = Array.from({ length: groups }, () => [])
  }
  v(p, u, v, c) {
    this.pos.push(p[0], p[1], p[2])
    this.uv.push(u, v)
    this.col.push(c.r, c.g, c.b)
    return this.pos.length / 3 - 1
  }
  // 兩條等長點列之間鋪四邊形帶
  strip(A, B, g, c = WHITE, us = null, vA = 0, vB = 1) {
    const s = this.pos.length / 3
    for (let j = 0; j < A.length; j++) {
      const u = us ? us[j] : 0
      this.v(A[j], u, vA, c)
      this.v(B[j], u, vB, c)
    }
    const list = this.idx[g]
    for (let j = 0; j < A.length - 1; j++) {
      const a = s + j * 2
      list.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  // 平面多邊形：pts2 為 2D 輪廓（三角化用）、to3 把 2D 點轉成 3D
  poly(pts2, to3, g, c = WHITE) {
    const contour = pts2.map(([a, b]) => new THREE.Vector2(a, b))
    const tris = THREE.ShapeUtils.triangulateShape(contour, [])
    const s = this.pos.length / 3
    for (const [a, b] of pts2) this.v(to3(a, b), 0, 0, c)
    const list = this.idx[g]
    for (const [i, j, k] of tris) list.push(s + i, s + j, s + k)
  }
  get empty() {
    return this.pos.length === 0
  }
  build() {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3))
    const all = []
    this.idx.forEach((list, g) => {
      if (list.length) geo.addGroup(all.length, list.length, g)
      for (const i of list) all.push(i)
    })
    geo.setIndex(all)
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
    geo.computeBoundingBox()
    return geo
  }
}

// ---------- 弧線取樣 ----------
function phiSamples(a, b) {
  const n = Math.max(1, Math.ceil(Math.abs(b - a) / SEG_DEG))
  return Array.from({ length: n + 1 }, (_, j) => a + ((b - a) * j) / n)
}
const at = (d, y, phi) => {
  const e = ellipsePoint(d, phi)
  return [e.x, y, e.z]
}
const arc = (d, y, phis) => phis.map((p) => at(d, y, p))
// 沿弧累積長度（座椅貼圖 u 座標用）
function arcU(d, phis, offset = 0) {
  const us = [offset]
  let prev = ellipsePoint(d, phis[0])
  for (let j = 1; j < phis.length; j++) {
    const e = ellipsePoint(d, phis[j])
    us.push(us[j - 1] + Math.hypot(e.x - prev.x, e.z - prev.z))
    prev = e
  }
  return us.map((u) => u / (SEAT_PITCH * ATLAS_SEATS))
}

// ---------- 剖面邊 ----------
// 回傳 [{ a:[d,y], b:[d,y], g, c, skip }]，首尾相接成封閉輪廓
// mode: 'seat' 一般座位區；'aisle' 走道（每排兩階）；'vom' 出入口（rows r0..r1 挖空）
function profileEdges(P, mode = 'seat', vom = null) {
  const E = []
  const add = (a, b, g, c, skip = false) => E.push({ a, b, g, c, skip })
  const tread = mode === 'aisle' ? G.STRUCT : G.TREAD
  const tc = mode === 'aisle' ? C.aisle : WHITE
  add([P.d0, P.bottom], [P.d0, P.curb], G.STRUCT, C.fascia)
  add([P.d0, P.curb], [P.d0 + CURB_T, P.curb], G.STRUCT, C.fascia)
  add([P.d0 + CURB_T, P.curb], [P.d0 + CURB_T, P.h(0)], G.STRUCT, C.concrete)
  const N = P.rows
  for (let i = 0; i < N; i++) {
    const [dS, dE, h] = [P.dS(i), P.dE(i), P.h(i)]
    if (vom && i >= vom.r0 && i <= vom.r1) continue
    if (vom && i === vom.r0 - 1) {
      // 出入口前一排：踏面照常，接著是通道地板與黑色洞口
      add([dS, h], [dE, h], G.TREAD, WHITE)
      add([dE, h], [P.dE(vom.r1), h], G.STRUCT, C.vom)
      add([P.dE(vom.r1), h], [P.dE(vom.r1), P.h(vom.r1 + 1)], G.MOUTH, WHITE)
      continue
    }
    if (mode === 'aisle' && i < N - 1) {
      const m = (dS + dE) / 2
      const hm = h + P.rise / 2
      add([dS, h], [m, h], tread, tc)
      add([m, h], [m, hm], tread, C.concrete)
      add([m, hm], [dE, hm], tread, tc)
      add([dE, hm], [dE, P.h(i + 1)], tread, C.concrete)
      continue
    }
    add([dS, h], [dE, h], tread, tc)
    if (i < N - 1) add([dE, h], [dE, P.h(i + 1)], tread, mode === 'aisle' ? C.concrete : tc)
  }
  const hN = P.h(N - 1)
  add([P.d1, hN], [P.d1, P.backTop], G.STRUCT, C.dark)
  add([P.d1, P.backTop], [P.d1 + BACK_T, P.backTop], G.STRUCT, C.concrete)
  add([P.d1 + BACK_T, P.backTop], [P.d1 + BACK_T, P.soffitBack], G.STRUCT, C.dark, P.solid)
  add([P.d1 + BACK_T, P.soffitBack], [P.d0, P.bottom], G.STRUCT, C.dark, P.solid)
  return E
}

function sweep(B, edges, phis) {
  for (const e of edges) {
    if (e.skip) continue
    B.strip(arc(e.a[0], e.a[1], phis), arc(e.b[0], e.b[1], phis), e.g, e.c)
  }
}
const capAt = (B, pts2, phi, g, c) => B.poly(pts2, (d, y) => at(d, y, phi), g, c)

// 一排座椅（椅墊＋椅背）：dE = 該排後緣、h = 踏面高
function seatRow(S, dE, h, a, b) {
  if (b - a < 0.05) return
  const phis = phiSamples(a, b)
  const us = arcU(dE - 0.45, phis, 0.04)
  const panF = arc(dE - 0.8, h + 0.4, phis)
  const panB = arc(dE - 0.36, h + 0.46, phis)
  const top = arc(dE - 0.2, h + 0.98, phis)
  S.strip(panF, panB, 0, WHITE, us, 0, 0.5)
  S.strip(panB, top, 0, WHITE, us, 0.5, 1)
}

// ---------- 看台分區 ----------
// out：可傳入既有的 builder（合併多區成一個 mesh，用在不開放區與 4 樓）
export function buildBowlSection(section, opts = {}, out = null) {
  const P = PROFILES[section.level]
  const own = !out
  const B = out?.main ?? new Builder(5)
  const S = out?.seats ?? new Builder(1)
  const L = out?.led ?? (P.led ? new Builder(1) : null)
  const { phi0, phi1 } = section
  const mid = (phi0 + phi1) / 2
  const dMid = (P.d0 + P.d1) / 2
  const aDeg = metersToDeg(AISLE, dMid, mid)
  const sA = phi0 + aDeg
  const sB = phi1 - aDeg

  // 出入口（vomitory）：靠走道一側約 30% 處，挖掉中段幾排
  let vom = null
  if (opts.vom) {
    const W = phi1 - phi0
    const c = mid < 180 ? phi0 + W * 0.3 : phi1 - W * 0.3
    const w = metersToDeg(3.2, P.d0 + 7, c)
    const r0 = Math.round(P.rows * 0.24)
    vom = { r0, r1: r0 + 5, p0: c - w / 2, p1: c + w / 2 }
  }

  const aisle = profileEdges(P, 'aisle')
  const seat = profileEdges(P, 'seat')
  sweep(B, aisle, phiSamples(phi0, sA))
  sweep(B, aisle, phiSamples(sB, phi1))
  if (vom) {
    sweep(B, seat, phiSamples(sA, vom.p0))
    sweep(B, profileEdges(P, 'vom', vom), phiSamples(vom.p0, vom.p1))
    sweep(B, seat, phiSamples(vom.p1, sB))
  } else {
    sweep(B, seat, phiSamples(sA, sB))
  }

  // 兩端封面（走道剖面）
  const contour = aisle.map((e) => e.a)
  capAt(B, contour, phi0, G.STRUCT, C.dark)
  capAt(B, contour, phi1, G.STRUCT, C.dark)
  // 走道半階與座位區交界的小立面
  for (let i = 0; i < P.rows - 1; i++) {
    const m = (P.dS(i) + P.dE(i)) / 2
    const h = P.h(i)
    const q = [
      [m, h],
      [P.dE(i), h],
      [P.dE(i), h + P.rise / 2],
      [m, h + P.rise / 2],
    ]
    capAt(B, q, sA, G.STRUCT, C.concrete)
    capAt(B, q, sB, G.STRUCT, C.concrete)
  }

  // 出入口側牆、玻璃欄杆
  if (vom) {
    const { r0, r1, p0, p1 } = vom
    const hf = P.h(r0 - 1)
    const wall = [[P.dS(r0), hf]]
    for (let i = r0; i <= r1; i++) wall.push([P.dS(i), P.h(i)], [P.dE(i), P.h(i)])
    wall.push([P.dE(r1), hf])
    capAt(B, wall, p0, G.STRUCT, C.aisle)
    capAt(B, wall, p1, G.STRUCT, C.aisle)
    for (const p of [p0, p1]) {
      const lo = [at(P.dS(r0), P.h(r0), p), at(P.dE(r1), P.h(r1), p)]
      const hi = [at(P.dS(r0), P.h(r0) + 0.95, p), at(P.dE(r1), P.h(r1) + 0.95, p)]
      B.strip(lo, hi, G.GLASS)
      const e = metersToDeg(0.05, P.d0 + 7, p)
      B.strip(
        [at(P.dS(r0), P.h(r0) + 0.95, p - e), at(P.dE(r1), P.h(r1) + 0.95, p - e)],
        [at(P.dS(r0), P.h(r0) + 0.95, p + e), at(P.dE(r1), P.h(r1) + 0.95, p + e)],
        G.STRUCT,
        C.rail,
      )
    }
    const phis = phiSamples(p0, p1)
    const dB = P.dE(r1) + 0.05
    const hB = P.h(r1 + 1)
    B.strip(arc(dB, hB, phis), arc(dB, hB + 0.9, phis), G.GLASS)
  }

  // 前緣玻璃欄杆＋金屬扶手
  const all = phiSamples(phi0, phi1)
  const top = P.curb + RAIL_H
  B.strip(arc(P.d0 + 0.08, P.curb, all), arc(P.d0 + 0.08, top, all), G.GLASS)
  B.strip(arc(P.d0, top, all), arc(P.d0 + 0.14, top, all), G.STRUCT, C.rail)
  // 1 樓背牆（2 樓簷下）：藍色間接燈
  if (P.accent) B.strip(arc(P.d1 - 0.02, P.backTop - 0.5, all), arc(P.d1 - 0.02, P.backTop - 0.36, all), G.ACCENT)
  // 前牆 LED 飾帶（票價色）
  if (L && P.led) L.strip(arc(P.d0 - 0.03, P.led[0], all), arc(P.d0 - 0.03, P.led[1], all), 0)

  // 座椅
  let seatCount = 0
  const rowsInfo = []
  for (let i = 0; i < P.rows; i++) {
    const spans = vom && i >= vom.r0 && i <= vom.r1 ? [[sA, vom.p0], [vom.p1, sB]] : [[sA, sB]]
    for (const [a, b] of spans) {
      seatRow(S, P.dE(i), P.h(i), a, b)
      const n = Math.floor(((b - a) * localRadius(P.dE(i), mid) * Math.PI) / 180 / SEAT_PITCH)
      seatCount += n
      rowsInfo.push({ d: P.dE(i) - 0.5, h: P.h(i), a, b, n })
    }
  }

  const info = {
    seatCount,
    rowsInfo,
    // 選取外框：前緣與後緣兩條弧，兩側斜線相連
    outline: [
      ...arc(P.d0 - 0.15, P.curb + 0.15, all),
      ...arc(P.d1 + 0.15, P.h(P.rows - 1) + 1.1, [...all].reverse()),
      at(P.d0 - 0.15, P.curb + 0.15, phi0),
    ],
    anchors: [
      new THREE.Vector3(...at(P.d0, top + 0.4, mid)),
      new THREE.Vector3(...at(P.d1, P.h(P.rows - 1) + 1.6, mid)),
    ],
  }
  if (!own) return info
  return { main: B.build(), seats: S.build(), led: L && !L.empty ? L.build() : null, ...info }
}

// 合併多區（不開放區、4 樓）
export function buildMergedBowl(sections, opts = () => ({})) {
  const out = { main: new Builder(5), seats: new Builder(1), led: new Builder(1) }
  for (const s of sections) buildBowlSection(s, opts(s), out)
  return { main: out.main.build(), seats: out.seats.build(), led: out.led.empty ? null : out.led.build() }
}

// 4 樓：401–417，與 5 樓同樣分布在 40°–320°
export const L4_SECTIONS = Array.from({ length: 17 }, (_, i) => ({
  id: `4${String(i + 1).padStart(2, '0')}`,
  level: 'L4',
  phi0: SUITE.phi0 + ((SUITE.phi1 - SUITE.phi0) * i) / 17,
  phi1: SUITE.phi0 + ((SUITE.phi1 - SUITE.phi0) * (i + 1)) / 17,
}))

// ---------- 3 樓包廂帶 ----------
// group 0 = 包廂玻璃（暖光）、1 = 結構、2 = 陽台玻璃欄杆
export function buildSuites() {
  const s = SUITE
  const B = new Builder(3)
  const S = new Builder(1)
  const phis = phiSamples(s.phi0, s.phi1)
  // 玻璃 u：每間包廂一格
  const gu = arcU(s.glassD, phis)
  const total = gu[gu.length - 1]
  const us = gu.map((u) => (u / total) * s.count)
  const E = [
    [[s.d0, s.base], [s.d0, s.balcony], 1, C.fascia],
    [[s.d0, s.balcony], [s.glassD, s.balcony], 1, C.concrete],
    [[s.glassD, s.ceiling], [s.d0, s.ceiling], 1, C.dark],
    [[s.d0, s.ceiling], [s.d0, s.roof], 1, C.fascia],
    [[s.d0, s.roof], [s.d1, s.roof], 1, C.concrete],
    [[s.d1, s.roof], [s.d1, s.base], 1, C.dark],
    [[s.d1, s.base], [s.d0, s.base], 1, C.dark],
  ]
  for (const [a, b, g, c] of E) B.strip(arc(a[0], a[1], phis), arc(b[0], b[1], phis), g, c)
  B.strip(arc(s.glassD, s.balcony, phis), arc(s.glassD, s.ceiling, phis), 0, WHITE, us, 0, 1)
  // 端面
  const contour = [
    [s.d0, s.base],
    [s.d0, s.balcony],
    [s.glassD, s.balcony],
    [s.glassD, s.ceiling],
    [s.d0, s.ceiling],
    [s.d0, s.roof],
    [s.d1, s.roof],
    [s.d1, s.base],
  ]
  capAt(B, contour, s.phi0, 1, C.dark)
  capAt(B, contour, s.phi1, 1, C.dark)
  // 包廂之間的隔牆
  for (let k = 1; k < s.count; k++) {
    const p = s.phi0 + ((s.phi1 - s.phi0) * k) / s.count
    const q = [
      [s.d0, s.balcony],
      [s.glassD, s.balcony],
      [s.glassD, s.ceiling],
      [s.d0, s.ceiling],
    ]
    capAt(B, q, p, 1, C.concrete)
  }
  // 陽台欄杆
  B.strip(arc(s.d0 + 0.06, s.balcony, phis), arc(s.d0 + 0.06, s.balcony + 0.95, phis), 2)
  B.strip(arc(s.d0, s.balcony + 0.95, phis), arc(s.d0 + 0.12, s.balcony + 0.95, phis), 1, C.rail)
  // 陽台一排沙發座椅
  seatRow(S, s.glassD - 0.05, s.balcony, s.phi0 + 0.3, s.phi1 - 0.3)
  return { main: B.build(), seats: S.build() }
}

// ---------- 場地區塊 ----------
// 低矮平台＋一排排面向舞台（-z）的座椅；LED = 地面上一圈票價色光框
export function buildFloorBlock(zone) {
  const { x0, x1, z0, z1 } = zone
  const H = FLOOR_DECK
  const B = new Builder(5)
  const S = new Builder(1)
  const L = new Builder(1)
  const p = (x, y, z) => [x, y, z]
  // 平台頂面＋四個側面
  B.strip([p(x0, H, z0), p(x1, H, z0)], [p(x0, H, z1), p(x1, H, z1)], G.TREAD)
  B.strip([p(x0, 0, z0), p(x1, 0, z0)], [p(x0, H, z0), p(x1, H, z0)], G.STRUCT, C.fascia)
  B.strip([p(x0, 0, z1), p(x1, 0, z1)], [p(x0, H, z1), p(x1, H, z1)], G.STRUCT, C.fascia)
  B.strip([p(x0, 0, z0), p(x0, 0, z1)], [p(x0, H, z0), p(x0, H, z1)], G.STRUCT, C.fascia)
  B.strip([p(x1, 0, z0), p(x1, 0, z1)], [p(x1, H, z0), p(x1, H, z1)], G.STRUCT, C.fascia)

  // 座椅排（每排 0.9 m）
  const usable = z1 - z0 - 0.4
  const rows = Math.floor(usable / ROW_DEPTH)
  const start = z0 + 0.2 + (usable - rows * ROW_DEPTH) / 2
  const xa = x0 + 0.3
  const xb = x1 - 0.3
  const us = [0.02, (xb - xa) / (SEAT_PITCH * ATLAS_SEATS) + 0.02]
  const rowsInfo = []
  for (let r = 0; r < rows; r++) {
    const zs = start + r * ROW_DEPTH
    const panF = [p(xa, H + 0.4, zs + 0.12), p(xb, H + 0.4, zs + 0.12)]
    const panB = [p(xa, H + 0.46, zs + 0.54), p(xb, H + 0.46, zs + 0.54)]
    const top = [p(xa, H + 0.98, zs + 0.7), p(xb, H + 0.98, zs + 0.7)]
    S.strip(panF, panB, 0, WHITE, us, 0, 0.5)
    S.strip(panB, top, 0, WHITE, us, 0.5, 1)
    rowsInfo.push({ z: zs + 0.4, h: H, a: xa, b: xb, n: Math.floor((xb - xa) / SEAT_PITCH) })
  }
  // 地面光框
  const o = 0.25
  const w = 0.22
  const y = 0.025
  const ring = (k) => [
    [p(x0 - k, y, z0 - k), p(x1 + k, y, z0 - k)],
    [p(x1 + k, y, z0 - k), p(x1 + k, y, z1 + k)],
    [p(x1 + k, y, z1 + k), p(x0 - k, y, z1 + k)],
    [p(x0 - k, y, z1 + k), p(x0 - k, y, z0 - k)],
  ]
  const inner = ring(o)
  const outer = ring(o + w)
  inner.forEach((seg, i) => L.strip(seg, outer[i], 0))

  const cx = (x0 + x1) / 2
  const oy = H + 1.25
  const e = 0.35
  return {
    main: B.build(),
    seats: S.build(),
    led: L.build(),
    seatCount: rows * Math.floor((xb - xa) / SEAT_PITCH),
    rowsInfo,
    floor: true,
    outline: [
      [x0 - e, oy, z0 - e],
      [x1 + e, oy, z0 - e],
      [x1 + e, oy, z1 + e],
      [x0 - e, oy, z1 + e],
      [x0 - e, oy, z0 - e],
    ],
    anchors: [new THREE.Vector3(cx, H + 1.8, z0), new THREE.Vector3(cx, H + 1.8, z1)],
  }
}

// ---------- 螢光棒光點（已售完區＝滿場觀眾） ----------
const SPECK_COLORS = ['#5b8cff', '#7fc4ff', '#9fb6ff', '#ffffff', '#4f7dff'].map((c) => new THREE.Color(c))
export function buildSpecks(info, density = 0.22, seed = 1) {
  let s = seed * 9301 + 49297
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  const pos = []
  const col = []
  const seeds = []
  for (const r of info.rowsInfo) {
    const n = Math.round(r.n * density)
    for (let k = 0; k < n; k++) {
      const t = rnd()
      const y = r.h + 1.25 + rnd() * 0.5
      if (info.floor) pos.push(lerp(r.a, r.b, t), y, r.z + (rnd() - 0.5) * 0.3)
      else {
        const e = ellipsePoint(r.d + (rnd() - 0.5) * 0.3, lerp(r.a, r.b, t))
        pos.push(e.x, y, e.z)
      }
      const c = SPECK_COLORS[Math.floor(rnd() * SPECK_COLORS.length)]
      col.push(c.r, c.g, c.b)
      seeds.push(rnd())
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3))
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1))
  geo.computeBoundingSphere()
  return geo
}

// ---------- 給鏡頭用：某區中央座位的眼睛位置 ----------
// 取該區偏後約 55% 的那排、區中央；eye = 踏面 + 1.2 m（坐姿）
export const EYE_ABOVE_TREAD = 1.2
export function seatEye(zone) {
  if (zone.kind === 'floor') {
    return new THREE.Vector3((zone.x0 + zone.x1) / 2, FLOOR_DECK + EYE_ABOVE_TREAD, lerp(zone.z0, zone.z1, 0.6))
  }
  const P = PROFILES[zone.level]
  const i = Math.round(0.55 * (P.rows - 1))
  return new THREE.Vector3(...at(P.dE(i) - 0.5, P.h(i) + EYE_ABOVE_TREAD, (zone.phi0 + zone.phi1) / 2))
}

// 已選區的補光位置：看台區前方往場內 6 m、高於最後一排；場地區塊正上方
export function selectionLightPos(zone) {
  if (zone.kind === 'floor') return new THREE.Vector3((zone.x0 + zone.x1) / 2, 9, (zone.z0 + zone.z1) / 2 + 4)
  const P = PROFILES[zone.level]
  return new THREE.Vector3(...at(P.d0 - 6, P.h(P.rows - 1) + 5, (zone.phi0 + zone.phi1) / 2))
}
