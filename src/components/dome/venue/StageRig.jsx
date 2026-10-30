import { Suspense, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CONTROL_DESK, FIELD, SKIRT_WALL, STAGE } from '../../../data/domeLayout'
import { CUT, COLORS, noRaycast, withCutaway } from './materials'
import { beamMatrix, fillInstances } from './geometry'

// 舞台（-z 外野端）：被場地橢圓裁成弧形的黑色台面、主 LED 螢幕（LUMEN 主視覺）、
// 左右 IMAG 螢幕、桁架塔與頂部燈光桁架、線陣列喇叭、伸展台、控台、光束

const { z0, z1, height: DECK_H, screen, sideScreen, rigTop } = STAGE
const TOWER_BACK_X = screen.width / 2 + 3.6 // 主螢幕兩側的桁架塔
const TOWER_BACK_Z = screen.z + 1
const TOWER_FRONT_X = 24.5
const TOWER_FRONT_Z = z1 - 1.5

// 舞台標籤的錨點（頂部桁架上方）
export const STAGE_LABEL_POS = [0, rigTop + 6, (TOWER_BACK_Z + TOWER_FRONT_Z) / 2]

// ── 桁架：四根主管＋每面之字形斜撐，全部用同一個 InstancedMesh ──
const UP = new THREE.Vector3(0, 1, 0)
const SIDE = new THREE.Vector3(1, 0, 0)
function truss(out, A, B, s = 1.1, bay = 1.6, t = 0.13) {
  const dir = new THREE.Vector3().subVectors(B, A)
  const len = dir.length()
  dir.normalize()
  const p = new THREE.Vector3().crossVectors(dir, Math.abs(dir.y) > 0.9 ? SIDE : UP).normalize()
  const q = new THREE.Vector3().crossVectors(dir, p).normalize()
  const corners = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([a, b]) => p.clone().multiplyScalar((a * s) / 2).addScaledVector(q, (b * s) / 2))
  const n = Math.max(1, Math.round(len / bay))
  for (const c of corners) out.push(beamMatrix(A.clone().add(c), B.clone().add(c), t, t, p))
  for (let f = 0; f < 4; f++) {
    const c1 = corners[f]
    const c2 = corners[(f + 1) % 4]
    for (let k = 0; k < n; k++) {
      const a = A.clone().addScaledVector(dir, (len * k) / n).add(k % 2 ? c1 : c2)
      const b = A.clone().addScaledVector(dir, (len * (k + 1)) / n).add(k % 2 ? c2 : c1)
      out.push(beamMatrix(a, b, t * 0.7, t * 0.7, c1.clone().add(c2).normalize()))
    }
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z)

function Trusses() {
  const ref = useRef()
  const matrices = useMemo(() => {
    const out = []
    const top = rigTop
    for (const s of [-1, 1]) {
      truss(out, V(s * TOWER_BACK_X, DECK_H, TOWER_BACK_Z), V(s * TOWER_BACK_X, top, TOWER_BACK_Z))
      truss(out, V(s * TOWER_FRONT_X, DECK_H, TOWER_FRONT_Z), V(s * TOWER_FRONT_X, top, TOWER_FRONT_Z))
      truss(out, V(s * TOWER_BACK_X, top, TOWER_BACK_Z), V(s * TOWER_FRONT_X, top, TOWER_FRONT_Z))
      // IMAG 螢幕上方的吊掛桁架
      const ix = sideScreen.x
      const half = sideScreen.width / 2 + 0.8
      const c = Math.cos(sideScreen.yaw)
      const sn = Math.sin(sideScreen.yaw)
      const iy = sideScreen.y0 + sideScreen.height + 1.2
      truss(
        out,
        V(s * (ix - half * c), iy, sideScreen.z - half * sn),
        V(s * (ix + half * c), iy, sideScreen.z + half * sn),
        0.8,
      )
    }
    truss(out, V(-TOWER_BACK_X, rigTop, TOWER_BACK_Z), V(TOWER_BACK_X, rigTop, TOWER_BACK_Z))
    truss(out, V(-TOWER_FRONT_X, rigTop, TOWER_FRONT_Z), V(TOWER_FRONT_X, rigTop, TOWER_FRONT_Z))
    for (const f of [0.33, 0.66]) {
      const z = TOWER_BACK_Z + (TOWER_FRONT_Z - TOWER_BACK_Z) * f
      const x = TOWER_BACK_X + (TOWER_FRONT_X - TOWER_BACK_X) * f
      truss(out, V(-x, rigTop - 0.2, z), V(x, rigTop - 0.2, z), 0.8)
    }
    return out
  }, [])
  useLayoutEffect(() => fillInstances(ref.current, matrices), [matrices])
  return (
    <instancedMesh ref={ref} args={[null, null, matrices.length]} raycast={noRaycast}>
      <boxGeometry />
      <meshStandardMaterial color="#454852" roughness={0.45} metalness={0.35} />
    </instancedMesh>
  )
}

// 桁架塔上的 LED 燈條＋頂部桁架下方一排燈具（亮點）
function RigLights() {
  const strips = useRef()
  const dots = useRef()
  const { stripM, dotM, dotC } = useMemo(() => {
    const stripM = []
    const q = new THREE.Quaternion()
    const h = rigTop - DECK_H - 1
    for (const s of [-1, 1]) {
      for (const [x, z] of [
        [TOWER_BACK_X, TOWER_BACK_Z],
        [TOWER_FRONT_X, TOWER_FRONT_Z],
      ]) {
        for (const dx of [-0.62, 0.62]) {
          stripM.push(
            new THREE.Matrix4().compose(V(s * x + dx, DECK_H + 0.5 + h / 2, z + 0.62), q, V(0.12, h, 0.12)),
          )
        }
      }
    }
    // 舞台台口燈條＋伸展台不算在這裡（見 Deck）
    const dotM = []
    const dotC = []
    const warm = new THREE.Color('#ffd7a0')
    const white = new THREE.Color('#ffffff')
    const n = 17
    for (let i = 0; i < n; i++) {
      const x = -TOWER_FRONT_X + 1.5 + ((2 * TOWER_FRONT_X - 3) * i) / (n - 1)
      dotM.push(new THREE.Matrix4().compose(V(x, rigTop - 1.1, TOWER_FRONT_Z), q, V(0.42, 0.42, 0.42)))
      dotC.push((i % 2 ? warm : white).clone().multiplyScalar(i % 4 === 0 ? 6 : 3.2))
    }
    for (let i = 0; i < 13; i++) {
      const x = -TOWER_BACK_X + 1.5 + ((2 * TOWER_BACK_X - 3) * i) / 12
      dotM.push(new THREE.Matrix4().compose(V(x, rigTop - 1.1, TOWER_BACK_Z), q, V(0.36, 0.36, 0.36)))
      dotC.push(warm.clone().multiplyScalar(2.6))
    }
    return { stripM, dotM, dotC }
  }, [])
  useLayoutEffect(() => {
    fillInstances(strips.current, stripM)
    fillInstances(dots.current, dotM, dotC)
  }, [stripM, dotM, dotC])
  return (
    <group>
      <instancedMesh ref={strips} args={[null, null, stripM.length]} raycast={noRaycast}>
        <boxGeometry />
        <meshBasicMaterial color={new THREE.Color('#ffc46e').multiplyScalar(3)} />
      </instancedMesh>
      <instancedMesh ref={dots} args={[null, null, dotM.length]} raycast={noRaycast}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  )
}

// 台面：矩形與場地橢圓的交集（後緣貼著外野看台的弧線）
function Deck() {
  const { deck, runway, edge, runEdge } = useMemo(() => {
    const ax = FIELD.rx + 0.8
    const az = FIELD.rz + 0.8
    const hw = Math.min(STAGE.width / 2, ax * Math.sqrt(1 - (z1 / az) ** 2))
    // shape 平面：x = 世界 x，y = 世界 −z
    const s = new THREE.Shape()
    const a0 = Math.acos(Math.max(-1, Math.min(1, -z1 / az)))
    s.moveTo(-hw, -z1)
    const N = 48
    for (let i = 0; i <= N; i++) {
      const t = -a0 + (2 * a0 * i) / N
      s.lineTo(Math.min(hw, Math.max(-hw, ax * Math.sin(t))), az * Math.cos(t))
    }
    s.lineTo(hw, -z1)
    s.closePath()
    const deck = new THREE.ExtrudeGeometry(s, { depth: DECK_H, bevelEnabled: false, curveSegments: 4 })
    deck.rotateX(-Math.PI / 2)

    // 伸展台：前端圓弧
    const { width, length } = STAGE.runway
    const r = width / 2
    const zs = -z1 + 0.5
    const ze = -z1 - length + r
    const rs = new THREE.Shape()
    rs.moveTo(-r, zs)
    rs.lineTo(-r, ze)
    rs.absarc(0, ze, r, Math.PI, Math.PI * 2, false)
    rs.lineTo(r, zs)
    rs.closePath()
    const runway = new THREE.ExtrudeGeometry(rs, { depth: DECK_H - 0.6, bevelEnabled: false, curveSegments: 24 })
    runway.rotateX(-Math.PI / 2)

    // 台口與伸展台邊緣的燈條
    const edge = new THREE.BoxGeometry(2 * hw - 0.4, 0.16, 0.12)
    edge.translate(0, DECK_H - 0.35, z1 + 0.06)
    const pts = rs.getPoints(24).map((p) => new THREE.Vector3(p.x, DECK_H - 0.6 + 0.02, -p.y))
    const runEdge = new THREE.BufferGeometry().setFromPoints(pts)
    return { deck, runway, edge, runEdge }
  }, [])
  const glow = useMemo(() => new THREE.Color('#ffb860').multiplyScalar(4), [])
  return (
    <group>
      <mesh geometry={deck} raycast={noRaycast}>
        <meshStandardMaterial color={COLORS.stage} roughness={0.35} metalness={0.2} />
      </mesh>
      <mesh geometry={runway} raycast={noRaycast}>
        <meshStandardMaterial color="#121318" roughness={0.25} metalness={0.3} />
      </mesh>
      <mesh geometry={edge} raycast={noRaycast}>
        <meshBasicMaterial color={glow} />
      </mesh>
      <lineLoop geometry={runEdge} raycast={noRaycast}>
        <lineBasicMaterial color={glow} />
      </lineLoop>
      {/* 樂手平台（左右兩個） */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 9.5, DECK_H + 0.5, screen.z + 4]} raycast={noRaycast}>
          <boxGeometry args={[9, 1, 5]} />
          <meshStandardMaterial color="#17181d" roughness={0.5} />
        </mesh>
      ))}
    </group>
  )
}

// LED 螢幕：黑色外框＋發光畫面（顏色 >1 讓亮部產生光暈）
function Screen({ width, height, position, rotationY = 0, map, gain = 2 }) {
  const color = useMemo(() => new THREE.Color(gain, gain, gain), [gain])
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position-z={-0.5} raycast={noRaycast}>
        <boxGeometry args={[width + 0.8, height + 0.8, 0.9]} />
        <meshStandardMaterial color="#0b0c0f" roughness={0.6} />
      </mesh>
      <mesh raycast={noRaycast}>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={map} color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

function Screens() {
  const [banner, poster] = useTexture(['/images/banner-lumen.webp', '/images/poster-lumen.webp'])
  const maps = useMemo(() => {
    for (const t of [banner, poster]) {
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
    }
    // IMAG：主視覺裡歌手的特寫（16:9 裁切）
    const imag = banner.clone()
    imag.repeat.set(0.4, 0.4 * (1672 / 941) * (9 / 16))
    imag.offset.set(0.6, 0.27)
    imag.needsUpdate = true
    // 場館大螢幕：海報的太陽＋歌手（16:9 裁切）
    const house = poster.clone()
    house.repeat.set(1, 0.45)
    house.offset.set(0, 0.4)
    house.needsUpdate = true
    return { main: banner, imag, house }
  }, [banner, poster])

  const { x, y0, z, width: sw, height: sh, yaw } = sideScreen
  // 外野弧牆上的場館大螢幕（往後傾，朝向場內）
  const houseW = 25
  const houseH = (houseW * 9) / 16
  const t = 0.52
  const houseD = SKIRT_WALL.d0 + (SKIRT_WALL.d1 - SKIRT_WALL.d0) * Math.pow(t, 1.6) - 1.2
  const houseY = SKIRT_WALL.y0 + (SKIRT_WALL.y1 - SKIRT_WALL.y0) * t
  return (
    <group>
      <Screen
        width={screen.width}
        height={screen.height}
        position={[0, screen.y0 + screen.height / 2, screen.z]}
        map={maps.main}
        gain={2.1}
      />
      {/* 主螢幕下方的黑色遮幕 */}
      <mesh position={[0, (DECK_H + screen.y0) / 2, screen.z - 0.3]} raycast={noRaycast}>
        <boxGeometry args={[screen.width + 0.8, screen.y0 - DECK_H, 0.5]} />
        <meshStandardMaterial color="#08090b" roughness={0.8} />
      </mesh>
      {[-1, 1].map((s) => (
        <Screen
          key={s}
          width={sw}
          height={sh}
          position={[s * x, y0 + sh / 2, z]}
          rotationY={-s * yaw}
          map={maps.imag}
          gain={1.7}
        />
      ))}
      <group position={[0, houseY, -(FIELD.rz + houseD)]} rotation-x={0.42}>
        <Screen width={houseW} height={houseH} position={[0, 0, 0]} map={maps.house} gain={1.15} />
      </group>
    </group>
  )
}

// 線陣列喇叭：掛在前桁架下，略成 J 形
function LineArrays() {
  const geo = useMemo(() => {
    const parts = []
    for (const s of [-1, 1]) {
      for (let k = 0; k < 12; k++) {
        const g = new THREE.BoxGeometry(1.5, 0.8, 1.2)
        g.rotateX(-k * k * 0.004)
        g.translate(s * 21.6, rigTop - 2.2 - k * 0.84, TOWER_FRONT_Z + 0.4 + k * k * 0.012)
        parts.push(g.toNonIndexed())
      }
      // 台面上的超低音
      for (let k = 0; k < 3; k++) {
        const g = new THREE.BoxGeometry(1.4, 1.1, 1.2)
        g.translate(s * (12 + k * 1.6), DECK_H + 0.55, z1 - 1.2)
        parts.push(g.toNonIndexed())
      }
    }
    return mergeGeometries(parts)
  }, [])
  return (
    <mesh geometry={geo} raycast={noRaycast}>
      <meshStandardMaterial color="#141519" roughness={0.6} />
    </mesh>
  )
}

// 控台：場地後段的平台、兩張控台、遮棚與小燈
function ControlDesk() {
  const { x0, x1, z0: dz0, z1: dz1, height } = CONTROL_DESK
  const cx = (x0 + x1) / 2
  const cz = (dz0 + dz1) / 2
  const w = x1 - x0
  const d = dz1 - dz0
  const geo = useMemo(() => {
    const parts = []
    const box = (bw, bh, bd, x, y, z) => {
      const g = new THREE.BoxGeometry(bw, bh, bd)
      g.translate(x, y, z)
      parts.push(g.toNonIndexed())
    }
    box(w, 0.6, d, cx, 0.3, cz) // 平台
    box(w * 0.38, 1.0, 1.4, cx - w * 0.24, 1.1, cz - d * 0.18) // 控台
    box(w * 0.38, 1.0, 1.4, cx + w * 0.24, 1.1, cz - d * 0.18)
    box(w * 0.7, 1.0, 1.2, cx, 1.1, cz + d * 0.22)
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.18, height + 0.6, 0.18, cx + (sx * w) / 2.05, (height + 0.6) / 2, cz + (sz * d) / 2.05)
    box(w + 0.6, 0.2, d + 0.6, cx, height + 0.7, cz) // 遮棚
    return mergeGeometries(parts)
  }, [w, d, cx, cz, height])
  const dots = useRef()
  const { dotM, dotC } = useMemo(() => {
    const dotM = []
    const dotC = []
    const q = new THREE.Quaternion()
    const palette = ['#5be3ff', '#ff5d7a', '#7dff9b', '#ffcf5a', '#9a8bff']
    for (let i = 0; i < 40; i++) {
      const side = i % 3
      const x = side === 2 ? cx - w * 0.33 + (w * 0.66 * (i % 13)) / 12 : cx + (side ? 1 : -1) * w * 0.24 - w * 0.18 + ((i * 7) % 13) * w * 0.03
      const z = side === 2 ? cz + d * 0.22 - 0.62 : cz - d * 0.18 - 0.72
      dotM.push(new THREE.Matrix4().compose(V(x, 1.62, z), q, V(0.16, 0.08, 0.16)))
      dotC.push(new THREE.Color(palette[i % palette.length]).multiplyScalar(2.2))
    }
    return { dotM, dotC }
  }, [cx, cz, w, d])
  useLayoutEffect(() => fillInstances(dots.current, dotM, dotC), [dotM, dotC])
  return (
    <group>
      <mesh geometry={geo} raycast={noRaycast}>
        <meshStandardMaterial color="#1b1d23" roughness={0.6} />
      </mesh>
      {/* 控台螢幕的冷光 */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + s * w * 0.24, 1.75, cz - d * 0.18 + 0.2]} rotation-x={-0.5} raycast={noRaycast}>
          <planeGeometry args={[w * 0.3, 0.7]} />
          <meshBasicMaterial color={new THREE.Color('#7fb4ff').multiplyScalar(1.4)} />
        </mesh>
      ))}
      <instancedMesh ref={dots} args={[null, null, dotM.length]} raycast={noRaycast}>
        <boxGeometry />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
    </group>
  )
}

// ── 光束：加法混合的錐體，沿長度淡出、邊緣柔化，緩慢擺動 ──
const BEAM_VERT = /* glsl */ `
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vCutW;
  void main() {
    vAlong = position.z / 100.0;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vCutW = w.xyz;
    vN = normalize(normalMatrix * normal);
    vec4 mv = viewMatrix * w;
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`
const BEAM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpen;
  uniform vec3 uCam;
  uniform float uNearH;
  uniform float uFarH;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  varying vec3 vCutW;
  void main() {
    // 光束不穿出屋頂：用屋面板的高度剖面淡出
    vec2 q = vCutW.xz / vec2(91.5, 121.5);
    float roofY = 46.0 + 28.0 * pow(max(0.0, 1.0 - dot(q, q)), 0.55) - 3.0;
    float clipH = min(roofY, mix(160.0, uFarH - 6.0, uOpen));
    float top = 1.0 - smoothstep(clipH - 12.0, clipH, vCutW.y);
    float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
    float fall = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.7);
    float a = edge * fall * top;
    gl_FragColor = vec4(uColor * a, 1.0);
  }
`

const BEAMS = [
  // [來源 x, y, z, 方向 yaw（度）, pitch（度，0 = 水平朝觀眾、90 = 朝上）, 顏色, 強度, 擺動相位]
  ...[-18, -10, -3.5, 3.5, 10, 18].map((x, i) => [x, rigTop - 1.2, TOWER_FRONT_Z, x * 1.4, 38 + (i % 2) * 12, '#ffcf8a', 0.32, i]),
  // 主螢幕後方往上散開的「日芒」
  ...[
    [-12, 58],
    [-6, 72],
    [6, 72],
    [12, 58],
  ].map(([x, p], i) => [x, DECK_H + 0.4, screen.z - 1.6, Math.sign(x) * 80, p, '#ffb050', 0.24, i + 3]),
  [-TOWER_FRONT_X, rigTop - 1, TOWER_FRONT_Z, -32, 55, '#7d5bff', 0.36, 1],
  [TOWER_FRONT_X, rigTop - 1, TOWER_FRONT_Z, 32, 55, '#5b74ff', 0.36, 2],
  [-TOWER_BACK_X, rigTop - 1, TOWER_BACK_Z, -55, 68, '#9a5bff', 0.3, 4],
  [TOWER_BACK_X, rigTop - 1, TOWER_BACK_Z, 55, 68, '#5b7dff', 0.3, 5],
]

function Beams() {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.22, 7.5, 100, 28, 1, true)
    g.translate(0, -50, 0) // 頂點在原點，往 −y 延伸
    g.rotateX(-Math.PI / 2) // 改成往 +z 延伸，方便用 yaw / pitch 擺方向
    return g
  }, [])
  const mats = useMemo(
    () =>
      BEAMS.map(([, , , , , color, k]) =>
        new THREE.ShaderMaterial({
          vertexShader: BEAM_VERT,
          fragmentShader: BEAM_FRAG,
          uniforms: { ...CUT, uColor: { value: new THREE.Color(color).multiplyScalar(k) } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      ),
    [],
  )
  const refs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((g, i) => {
      if (!g) return
      const [, , , yaw, pitch, , , ph] = BEAMS[i]
      const y = THREE.MathUtils.degToRad(yaw + Math.sin(t * 0.32 + ph * 1.3) * 9)
      const p = THREE.MathUtils.degToRad(pitch + Math.sin(t * 0.21 + ph) * 7)
      g.rotation.set(-p, y, 0, 'YXZ')
    })
  })
  return (
    <group>
      {BEAMS.map(([x, y, z], i) => (
        <group key={i} position={[x, y, z]} ref={(el) => (refs.current[i] = el)}>
          <mesh geometry={geo} material={mats[i]} raycast={noRaycast} renderOrder={5} frustumCulled={false} />
        </group>
      ))}
    </group>
  )
}

// 吊索（IMAG 與桁架拉到屋頂），剖開時跟屋頂一起隱藏
function Cables() {
  const { geo, mat } = useMemo(() => {
    const pts = []
    const add = (x, y, z) => pts.push(x, y, z, x * 1.04, 66, z * 0.98)
    for (const s of [-1, 1]) {
      add(s * TOWER_FRONT_X, rigTop + 0.6, TOWER_FRONT_Z)
      add(s * TOWER_BACK_X, rigTop + 0.6, TOWER_BACK_Z)
      add(s * (sideScreen.x - 6), sideScreen.y0 + sideScreen.height + 1.6, sideScreen.z - 2.2)
      add(s * (sideScreen.x + 6), sideScreen.y0 + sideScreen.height + 1.6, sideScreen.z + 2.2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const mat = withCutaway(new THREE.LineBasicMaterial({ color: '#2f323b' }), { key: 'stageCable' })
    return { geo, mat }
  }, [])
  return <lineSegments geometry={geo} material={mat} raycast={noRaycast} />
}

export default function StageRig() {
  return (
    <group>
      <Deck />
      <Trusses />
      <RigLights />
      <LineArrays />
      <Cables />
      <ControlDesk />
      <Beams />
      <Suspense fallback={null}>
        <Screens />
      </Suspense>
    </group>
  )
}
