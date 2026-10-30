import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FIELD, GRADE_Y, ROOF, SHELL, STAGE } from '../../../data/domeLayout'
import { COLORS, noRaycast } from './materials'
import { fillInstances, ringXZ } from './geometry'

// 地面：下沉的場地（演唱會深色鋪面，微反光）、看台底座、舞台前的暖光、
// 周邊廣場與路燈、遠處低調的城市剪影、夜空漸層

function ellipseGeo(ax, az, segs = 160, holeAx, holeAz) {
  const s = new THREE.Shape()
  s.absellipse(0, 0, ax, az, 0, Math.PI * 2)
  if (holeAx) {
    const h = new THREE.Path()
    h.absellipse(0, 0, holeAx, holeAz, 0, Math.PI * 2, true)
    s.holes.push(h)
  }
  const g = new THREE.ShapeGeometry(s, segs)
  g.rotateX(-Math.PI / 2)
  return g
}

// 場地地面：深色、略帶光澤的鋪面（主螢幕的面光會在上面形成倒影般的高光）
function FieldFloor() {
  const geo = useMemo(() => ellipseGeo(FIELD.rx + 0.6, FIELD.rz + 0.6, 128), [])
  return (
    <mesh geometry={geo} position-y={0.005} raycast={noRaycast}>
      <meshStandardMaterial color={COLORS.floor} roughness={0.38} metalness={0.2} />
    </mesh>
  )
}

// 舞台前方地面的暖色光暈（加法混合的漸層面）
function StageGlow() {
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(128, 40, 4, 128, 40, 230)
    g.addColorStop(0, 'rgba(255,190,110,1)')
    g.addColorStop(0.35, 'rgba(255,140,60,0.45)')
    g.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  const w = 100
  const d = 64
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.06, STAGE.z1 + d / 2 - 14]} raycast={noRaycast} renderOrder={1}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial
        map={tex}
        color={new THREE.Color(0.42, 0.3, 0.2)}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

// 廣場、路燈、樹
function Plaza() {
  const ground = useMemo(() => ellipseGeo(1400, 1400, 96, ROOF.rx - 3.4, ROOF.rz - 3.4), [])
  const paving = useMemo(() => ellipseGeo(ROOF.rx + 34, ROOF.rz + 34, 160, ROOF.rx - 3.4, ROOF.rz - 3.4), [])
  const lamps = useRef()
  const trees = useRef()
  const { lampM, treeM } = useMemo(() => {
    const lampM = []
    const treeM = []
    const q = new THREE.Quaternion()
    const rand = mulberry(7)
    for (const [d, n] of [[26, 64]]) {
      for (let i = 0; i < n; i++) {
        const [x, z] = ringXZ(SHELL.wallD + d, (i / n) * 360)
        lampM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GRADE_Y + 4, z), q, new THREE.Vector3(0.32, 0.32, 0.32)))
      }
    }
    for (let i = 0; i < 170; i++) {
      const d = 30 + rand() * 40
      const [x, z] = ringXZ(SHELL.wallD + d, rand() * 360)
      const s = 1.8 + rand() * 1.8
      treeM.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GRADE_Y + s * 0.9, z), q, new THREE.Vector3(s, s * 1.2, s)))
    }
    return { lampM, treeM }
  }, [])
  useLayoutEffect(() => {
    fillInstances(lamps.current, lampM)
    fillInstances(trees.current, treeM)
  }, [lampM, treeM])
  return (
    <group>
      <mesh geometry={ground} position-y={GRADE_Y - 0.05} raycast={noRaycast}>
        <meshStandardMaterial color={COLORS.ground} roughness={0.95} />
      </mesh>
      <mesh geometry={paving} position-y={GRADE_Y} raycast={noRaycast}>
        <meshStandardMaterial color="#161921" roughness={0.8} />
      </mesh>
      <instancedMesh ref={lamps} args={[null, null, lampM.length]} raycast={noRaycast}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color('#ffc58a').multiplyScalar(1.3)} />
      </instancedMesh>
      <instancedMesh ref={trees} args={[null, null, treeM.length]} raycast={noRaycast}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#13221b" roughness={1} flatShading />
      </instancedMesh>
    </group>
  )
}

function mulberry(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// 遠處的城市：一圈深色量體，窗戶以世界座標在 shader 裡產生（隨機亮燈）
function City() {
  const ref = useRef()
  const matrices = useMemo(() => {
    const rand = mulberry(42)
    const out = []
    const q = new THREE.Quaternion()
    const e = new THREE.Euler()
    for (let i = 0; i < 420; i++) {
      const ang = rand() * Math.PI * 2
      const dist = 300 + Math.pow(rand(), 0.7) * 650
      const x = Math.cos(ang) * dist * 1.1
      const z = Math.sin(ang) * dist
      if (Math.abs(x) < 170 && Math.abs(z) < 200) continue
      const w = 18 + rand() * 30
      const dd = 18 + rand() * 30
      const h = 10 + Math.pow(rand(), 2.4) * (dist > 550 ? 120 : 45)
      e.set(0, Math.round(rand() * 2) * 0.12, 0)
      q.setFromEuler(e)
      out.push(new THREE.Matrix4().compose(new THREE.Vector3(x, GRADE_Y + h / 2, z), q, new THREE.Vector3(w, h, dd)))
    }
    return out
  }, [])
  useLayoutEffect(() => fillInstances(ref.current, matrices), [matrices])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#0c0e15', roughness: 0.9 })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCityW;\nvarying vec3 vCityN;')
        .replace(
          '#include <project_vertex>',
          `#include <project_vertex>
          vec4 cw = instanceMatrix * vec4(transformed, 1.0);
          vCityW = (modelMatrix * cw).xyz;
          vCityN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal);`,
        )
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vCityW;\nvarying vec3 vCityN;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          if (abs(vCityN.y) < 0.5) {
            vec2 cell = vec2(floor((vCityW.x + vCityW.z) / 3.2), floor(vCityW.y / 3.6));
            vec2 f = fract(vec2((vCityW.x + vCityW.z) / 3.2, vCityW.y / 3.6));
            float lit = step(0.84, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
            float win = step(0.25, f.x) * step(f.x, 0.8) * step(0.3, f.y) * step(f.y, 0.75);
            vec3 tint = mix(vec3(1.0, 0.72, 0.42), vec3(0.65, 0.78, 1.0), step(0.5, fract(cell.x * 0.37)));
            totalEmissiveRadiance += tint * lit * win * 0.22;
          }`,
        )
    }
    m.customProgramCacheKey = () => 'city'
    return m
  }, [])
  return (
    <instancedMesh ref={ref} args={[null, mat, matrices.length]} raycast={noRaycast}>
      <boxGeometry />
    </instancedMesh>
  )
}

// 夜空：底部帶一點城市光害的深藍漸層
function Sky() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 top = vec3(0.012, 0.014, 0.024);
            vec3 hor = vec3(0.045, 0.040, 0.060);
            vec3 glow = vec3(0.10, 0.065, 0.05);
            vec3 col = mix(hor, top, smoothstep(0.0, 0.45, h));
            col += glow * exp(-abs(h) * 14.0) * 0.6;
            col = mix(col, vec3(0.008, 0.009, 0.014), smoothstep(0.0, -0.2, h));
            gl_FragColor = vec4(col, 1.0);
          }`,
      }),
    [],
  )
  return (
    <mesh material={mat} raycast={noRaycast} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[1800, 32, 16]} />
    </mesh>
  )
}

export default function Ground() {
  // 看台底座（避免從縫隙看到外面）
  const base = useMemo(() => ellipseGeo(FIELD.rx + SHELL.wallD + 0.5, FIELD.rz + SHELL.wallD + 0.5, 160), [])
  return (
    <group>
      <Sky />
      <City />
      <Plaza />
      <mesh geometry={base} position-y={-0.08} raycast={noRaycast}>
        <meshStandardMaterial color="#0d0f14" roughness={1} />
      </mesh>
      <FieldFloor />
      <StageGlow />
    </group>
  )
}
