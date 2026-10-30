import * as THREE from 'three'
import { TIERS } from '../../../data/lumen'
import { ATLAS_SEATS } from './geometry'

// 看台材質：全部共用（每種狀態一份），卸載時統一 dispose
// 原則：座椅＝票價色（帶一點自發光，暗場也認得出圖例色）；踏面＝同色系深色；
//       前牆 LED 飾帶＝票價色柔光；只有「已選」用 HDR 顏色讓 bloom 明顯發亮

export const ACCENT = '#1A5DD6'

// 座椅貼圖：上半 = 椅背、下半 = 椅墊；8 個座位亮度略不同（實景的黑灰白斑點 → 只保留明暗、不改色相）
function makeSeatAtlas() {
  const cw = 64
  const W = cw * ATLAS_SEATS
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  g.clearRect(0, 0, W, H)
  const tones = [1, 0.86, 0.95, 0.74, 0.98, 0.9, 0.8, 0.96]
  const shade = (t, k) => {
    const v = Math.round(255 * Math.min(1, t * k))
    return `rgb(${v},${v},${v})`
  }
  for (let i = 0; i < ATLAS_SEATS; i++) {
    const x = i * cw
    const t = tones[i]
    // 椅背（上半，畫布 y = 0 是椅背頂端）
    let grad = g.createLinearGradient(0, 2, 0, 62)
    grad.addColorStop(0, shade(t, 1.06))
    grad.addColorStop(0.18, shade(t, 0.98))
    grad.addColorStop(1, shade(t, 0.7))
    g.fillStyle = grad
    g.beginPath()
    g.roundRect(x + 5, 2, cw - 10, 60, [16, 16, 4, 4])
    g.fill()
    // 椅墊（下半，畫布 y = 64 是椅墊後緣、127 是前緣）
    grad = g.createLinearGradient(0, 66, 0, 126)
    grad.addColorStop(0, shade(t, 0.62))
    grad.addColorStop(1, shade(t, 0.92))
    g.fillStyle = grad
    g.beginPath()
    g.roundRect(x + 4, 64, cw - 8, 61, [3, 3, 12, 12])
    g.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  return tex
}

// 包廂玻璃：暖色室內光、窗框、隔間、家具剪影
function makeSuiteTexture() {
  const W = 256
  const H = 128
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#ffe6b8')
  grad.addColorStop(0.35, '#e9a95e')
  grad.addColorStop(1, '#7a4a20')
  g.fillStyle = grad
  g.fillRect(0, 0, W, H)
  // 天花板嵌燈
  g.fillStyle = '#fff6e0'
  for (let x = 24; x < W; x += 52) g.fillRect(x, 6, 10, 4)
  // 家具與人影
  g.fillStyle = 'rgba(40,22,10,0.85)'
  let s = 3
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < 7; k++) {
    const w = 14 + rnd() * 26
    const h = 18 + rnd() * 26
    g.fillRect(16 + rnd() * (W - 48), H - h, w, h)
  }
  // 窗框：細直框＋包廂分隔粗框＋橫框
  g.fillStyle = '#1b120a'
  for (let x = 64; x < W; x += 64) g.fillRect(x - 1, 0, 3, H)
  g.fillRect(0, 0, 8, H)
  g.fillRect(W - 4, 0, 4, H)
  g.fillRect(0, 22, W, 3)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

// 已售完：世界座標斜線（不靠顏色辨識），各種幾何、不同 UV 都對得齊
function withHatch(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHatchW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHatchW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHatchW;\nfloat totalEmissiveRadianceHatch = 1.0;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= totalEmissiveRadianceHatch;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          float k = (vHatchW.x + vHatchW.z + vHatchW.y * 0.7) / 2.4;
          float tri = abs(fract(k) - 0.5) * 2.0;
          float fw = fwidth(k) * 2.0;
          float st = smoothstep(0.5 - fw, 0.5 + fw, tri);
          diffuseColor.rgb *= mix(1.0, 0.22, st);
          totalEmissiveRadianceHatch = mix(1.0, 0.22, st);
        }`,
      )
  }
  m.customProgramCacheKey = () => 'seat-hatch'
  return m
}

// 螢光棒光點：大小隨距離縮放（遠處 1.5 px）、各自閃爍
function makeSpeckMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 520 }, uPR: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      attribute vec3 aColor;
      uniform float uTime;
      uniform float uScale;
      uniform float uPR;
      varying vec3 vC;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (1.1 + aSeed * 2.4) + aSeed * 37.0));
        vC = aColor;
        gl_PointSize = clamp(uScale / -mv.z, 1.5, 5.0) * uPR;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      varying float vA;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = dot(p, p);
        if (r > 1.0) discard;
        float f = exp(-r * 2.5);
        gl_FragColor = vec4(vC * 0.85 * vA * f, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
}

export function createSeatMaterials() {
  const seatTex = makeSeatAtlas()
  const suiteTex = makeSuiteTexture()
  const side = THREE.DoubleSide
  const white = new THREE.Color('#ffffff')
  const black = new THREE.Color('#000000')

  const seat = (color, emissive, ei, extra) =>
    new THREE.MeshStandardMaterial({
      color,
      map: seatTex,
      alphaTest: 0.5,
      side,
      roughness: 0.72,
      metalness: 0,
      emissive,
      emissiveMap: seatTex,
      emissiveIntensity: ei,
      ...extra,
    })
  const tread = (color, emissive, ei) =>
    new THREE.MeshStandardMaterial({ color, side, roughness: 0.9, metalness: 0, emissive, emissiveIntensity: ei })
  const basic = (color, extra) => new THREE.MeshBasicMaterial({ color, side, ...extra })

  const M = { seat: {}, seatHover: {}, tread: {}, treadHover: {}, led: {}, ledHover: {} }
  for (const t of TIERS) {
    const c = new THREE.Color(t.hex)
    M.seat[t.id] = seat(c, c, 0.42)
    M.seatHover[t.id] = seat(c.clone().lerp(white, 0.35), c, 0.8)
    M.tread[t.id] = tread(c.clone().lerp(black, 0.64), c, 0.09)
    M.treadHover[t.id] = tread(c.clone().lerp(black, 0.45), c, 0.2)
    M.led[t.id] = basic(c.clone().multiplyScalar(0.85))
    // 懸停的飾帶略超過 1 → 很輕微的光暈
    M.ledHover[t.id] = basic(c.clone().multiplyScalar(1.5), { toneMapped: false })
  }

  // 已選：白藍色座椅＋脈動自發光（不論票價都一眼看出）
  M.seatSel = seat(new THREE.Color('#ffffff'), new THREE.Color('#9dbcff'), 1.6)
  M.treadSel = tread(new THREE.Color('#2a4fa0'), new THREE.Color('#3f7bff'), 0.9)
  M.ledSel = basic(new THREE.Color(2.0, 2.6, 4.2), { toneMapped: false })

  // 已售完：深灰＋斜線
  M.seatSold = withHatch(seat(new THREE.Color('#a3a7ae'), new THREE.Color('#a3a7ae'), 0.4))
  M.treadSold = withHatch(tread(new THREE.Color('#5a5d64'), new THREE.Color('#5a5d64'), 0.3))
  M.ledSold = basic(new THREE.Color('#2e3138'))

  // 不開放（舞台後方）：幾乎全黑
  M.seatClosed = seat(new THREE.Color('#25282e'), black, 0)
  M.treadClosed = tread(new THREE.Color('#111216'), black, 0)

  // 3 樓包廂、4 樓：中性淡色
  M.seatNeutral = seat(new THREE.Color('#9da3ad'), new THREE.Color('#9da3ad'), 0.1)
  M.treadNeutral = tread(new THREE.Color('#25282e'), black, 0)
  M.seatSuite = seat(new THREE.Color('#d8c6a8'), new THREE.Color('#f0c98a'), 0.22)

  // 共用結構（頂點色：前牆淺灰、混凝土、深色背牆…）
  M.struct = new THREE.MeshStandardMaterial({ vertexColors: true, side, roughness: 0.86, metalness: 0.05 })
  M.glass = new THREE.MeshStandardMaterial({
    color: '#b4c8e2',
    side,
    transparent: true,
    opacity: 0.16,
    roughness: 0.15,
    metalness: 0.3,
    depthWrite: false,
  })
  M.accent = basic(new THREE.Color('#2a63ff').multiplyScalar(0.95))
  M.mouth = basic(new THREE.Color('#060b16'))
  M.suiteGlass = new THREE.MeshStandardMaterial({
    color: '#100c08',
    side,
    roughness: 0.35,
    metalness: 0.1,
    emissive: '#ffffff',
    emissiveMap: suiteTex,
    emissiveIntensity: 0.62,
  })
  M.specks = makeSpeckMaterial()

  M.textures = [seatTex, suiteTex]
  return M
}

export function disposeSeatMaterials(M) {
  const seen = new Set()
  const walk = (v) => {
    if (!v || seen.has(v)) return
    seen.add(v)
    if (v instanceof THREE.Material || v instanceof THREE.Texture) v.dispose()
    else if (Array.isArray(v)) v.forEach(walk)
    else if (typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(M)
}

// 依狀態挑一組材質：[踏面, 結構, 玻璃, 間接燈, 洞口]、座椅、LED
// state: base | hover | sel | soft（不可互動時的已選：只稍微亮一點）| sold
export function pickMaterials(M, tier, state) {
  const t =
    state === 'sold'
      ? [M.treadSold, M.seatSold, M.ledSold]
      : state === 'sel'
        ? [M.treadSel, M.seatSel, M.ledSel]
        : state === 'hover' || state === 'soft'
          ? [M.treadHover[tier], M.seatHover[tier], M.ledHover[tier]]
          : [M.tread[tier], M.seat[tier], M.led[tier]]
  return { main: [t[0], M.struct, M.glass, M.accent, M.mouth], seats: t[1], led: t[2] }
}
