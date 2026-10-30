import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import { ellipsePoint } from '../../../data/domeLayout'
import { CLOSED_SECTIONS, formatPrice, getTier, zoneName } from '../../../data/lumen'
import {
  L4_SECTIONS,
  PROFILES,
  SUITE,
  buildBowlSection,
  buildFloorBlock,
  buildMergedBowl,
  buildSpecks,
  buildSuites,
  selectionLightPos,
} from './geometry'
import { createSeatMaterials, disposeSeatMaterials, pickMaterials } from './materials'
import DomLabel, { escapeHtml as esc } from './DomLabel'
import styles from './SeatSections.module.css'

// 臺北大巨蛋 3D：看台與場地座位（演唱會暗場）
// - 1、2、5 樓：一排排真實排距的階梯、座椅條帶、走道階梯、1 樓出入口、前緣玻璃欄杆與 LED 飾帶
// - 3 樓包廂（暖光玻璃帶）、4 樓（窄窄幾排）：中性色、不可點
// - 場地 A／B／C：低平台＋面向舞台的座椅排，地面一圈票價色光框
// - 狀態：票價色 / 懸停（變亮＋微抬＋提示框）/ 已選（白藍發光＋外框＋抬升＋脈動補光＋藥丸標籤）
//         / 已售完（深灰斜線＋螢光棒光點）/ 不開放（近乎全黑）

const LIFT_SELECTED = 0.9
const LIFT_HOVER = 0.3
const OUTLINE_CORE = [2.2, 2.9, 4.6] // HDR：讓後製 bloom 發亮
const OUTLINE_GLOW = [0.35, 0.6, 1.6]

const noRaycast = () => null
const block = (e) => e.stopPropagation()
const blockerHandlers = { onPointerOver: block, onPointerMove: block, onClick: block }

// 1 樓偶數區有出入口（舞台後方不開放的區除外）
const hasVom = (zone) => zone.level === 'L1' && Number(zone.id.slice(1)) % 2 === 0
const hashId = (id) => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7)

const statusOf = (zone) =>
  zone.soldOut
    ? { text: '已售完', cls: styles.sold }
    : zone.left
      ? { text: `剩 ${zone.left} 席`, cls: styles.few }
      : { text: '有票', cls: styles.ok }

function tipHtml(zone) {
  const tier = getTier(zone.tier)
  const st = statusOf(zone)
  return `<div class="${styles.tip}">
    <div class="${styles.tipHead}">
      <span class="${styles.swatch}" style="background:${zone.soldOut ? '#8E8E93' : tier.hex}"></span>
      <span>${esc(zoneName(zone))}<span class="${styles.tipTier}">・${esc(tier.name)}</span></span>
    </div>
    <div class="${styles.tipRow}">
      <span class="${styles.price}">NT$ ${formatPrice(tier.price)}</span>
      <span class="${st.cls}">${st.text}</span>
    </div>
  </div>`
}

const pillHtml = (zone) =>
  `<div class="${styles.pill}"><span class="${styles.check}">✓</span><span>${esc(zoneName(zone))}<span class="${styles.pillTier}">・${esc(getTier(zone.tier).name)}</span></span></div>`

// 抬升動畫：簡易彈簧（略帶回彈），靜止時不更新
function useLift(target) {
  const ref = useRef()
  const s = useRef({ y: 0, v: 0 })
  const invalidate = useThree((st) => st.invalidate)
  useEffect(() => invalidate(), [target, invalidate])
  useFrame((state, delta) => {
    const a = s.current
    if (!ref.current) return
    if (Math.abs(target - a.y) < 0.002 && Math.abs(a.v) < 0.002) {
      if (a.y !== target) {
        a.y = target
        a.v = 0
        ref.current.position.y = target
      }
      return
    }
    const dt = Math.min(delta, 1 / 30)
    a.v += ((target - a.y) * 170 - a.v * 19) * dt
    a.y += a.v * dt
    ref.current.position.y = a.y
    state.invalidate()
  })
  return ref
}

// 已選外框：螢幕空間粗細的線（遠近都看得到），不做深度測試 → 被 2 樓遮住時也能看到輪廓
function SelectionOutline({ points }) {
  const glow = useRef()
  useFrame(({ clock }) => {
    const m = glow.current?.material
    if (m) m.opacity = 0.22 + 0.16 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 3.2))
  })
  return (
    <>
      <Line
        ref={glow}
        points={points}
        color={OUTLINE_GLOW}
        lineWidth={10}
        transparent
        opacity={0.3}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        renderOrder={20}
        raycast={noRaycast}
      />
      <Line
        points={points}
        color={OUTLINE_CORE}
        lineWidth={2.4}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        renderOrder={21}
        raycast={noRaycast}
      />
    </>
  )
}

const Section = memo(function Section({ zone, selected, hovered, interactive, showLabels, mats, onSelect, onHover }) {
  const geo = useMemo(() => {
    const g = zone.kind === 'floor' ? buildFloorBlock(zone) : buildBowlSection(zone, { vom: hasVom(zone) })
    if (zone.soldOut) g.specks = buildSpecks(g, 0.12, hashId(zone.id))
    return g
  }, [zone])
  useEffect(
    () => () => {
      geo.main.dispose()
      geo.seats.dispose()
      geo.led?.dispose()
      geo.specks?.dispose()
    },
    [geo],
  )

  const target = interactive ? (selected ? LIFT_SELECTED : hovered && !zone.soldOut ? LIFT_HOVER : 0) : 0
  const ref = useLift(target)

  const state = zone.soldOut ? 'sold' : selected ? (interactive ? 'sel' : 'soft') : hovered ? 'hover' : 'base'
  const m = useMemo(() => pickMaterials(mats, zone.tier, state), [mats, zone.tier, state])

  const handlers = useMemo(
    () => ({
      onPointerOver: (e) => {
        e.stopPropagation()
        onHover(zone.id, true)
      },
      onPointerMove: block,
      onPointerOut: () => onHover(zone.id, false),
      onClick: (e) => {
        e.stopPropagation()
        if (!zone.soldOut) onSelect?.(zone.id)
      },
    }),
    [zone, onHover, onSelect],
  )

  return (
    <group ref={ref}>
      <mesh geometry={geo.main} material={m.main} {...(interactive ? handlers : null)} />
      <mesh geometry={geo.seats} material={m.seats} raycast={noRaycast} />
      {geo.led && <mesh geometry={geo.led} material={m.led} raycast={noRaycast} />}
      {geo.specks && <points geometry={geo.specks} material={mats.specks} raycast={noRaycast} />}
      {interactive && selected && <SelectionOutline points={geo.outline} />}
      {showLabels && interactive && selected && !hovered && (
        <DomLabel anchors={geo.anchors} follow={ref} html={pillHtml(zone)} zIndex={20} />
      )}
      {showLabels && hovered && <DomLabel anchors={geo.anchors} follow={ref} html={tipHtml(zone)} zIndex={30} />}
    </group>
  )
})

// 舞台後方不開放的看台：合併成一個 mesh，近乎全黑，只擋射線
function ClosedSeating({ mats, interactive }) {
  const geo = useMemo(() => buildMergedBowl(CLOSED_SECTIONS), [])
  useEffect(() => () => [geo.main, geo.seats, geo.led].forEach((g) => g?.dispose()), [geo])
  const main = useMemo(() => [mats.treadClosed, mats.struct, mats.glass, mats.accent, mats.mouth], [mats])
  return (
    <group>
      <mesh geometry={geo.main} material={main} {...(interactive ? blockerHandlers : null)} />
      <mesh geometry={geo.seats} material={mats.seatClosed} raycast={noRaycast} />
      {geo.led && <mesh geometry={geo.led} material={mats.ledSold} raycast={noRaycast} />}
    </group>
  )
}

// 3 樓包廂（暖光玻璃帶）＋ 4 樓（中性色窄帶）
function UpperBands({ mats, interactive }) {
  const geo = useMemo(() => ({ suites: buildSuites(), l4: buildMergedBowl(L4_SECTIONS) }), [])
  useEffect(
    () => () => [geo.suites.main, geo.suites.seats, geo.l4.main, geo.l4.seats].forEach((g) => g.dispose()),
    [geo],
  )
  const suiteMain = useMemo(() => [mats.suiteGlass, mats.struct, mats.glass], [mats])
  const l4Main = useMemo(() => [mats.treadNeutral, mats.struct, mats.glass, mats.accent, mats.mouth], [mats])
  const h = interactive ? blockerHandlers : null
  return (
    <group>
      <mesh geometry={geo.suites.main} material={suiteMain} {...h} />
      <mesh geometry={geo.suites.seats} material={mats.seatSuite} raycast={noRaycast} />
      <mesh geometry={geo.l4.main} material={l4Main} {...h} />
      <mesh geometry={geo.l4.seats} material={mats.seatNeutral} raycast={noRaycast} />
    </group>
  )
}

// 已選效果：脈動自發光＋一盞常駐的補光（強度 0 時等於關閉；常駐避免燈數變動造成全場重編譯 shader）
function SelectionFX({ mats, zone, active }) {
  const light = useRef()
  const gl = useThree((s) => s.gl)
  const pos = useMemo(() => (zone ? selectionLightPos(zone) : new THREE.Vector3(0, -50, 0)), [zone])
  useFrame(({ clock, invalidate }) => {
    const t = clock.elapsedTime
    mats.specks.uniforms.uTime.value = t
    mats.specks.uniforms.uPR.value = gl.getPixelRatio()
    const p = 0.5 + 0.5 * Math.sin(t * 3.2)
    mats.seatSel.emissiveIntensity = 1.5 + 0.9 * p
    if (light.current) light.current.intensity = active && zone ? 260 + 220 * p : 0
    if (active && zone) invalidate()
  })
  return <pointLight ref={light} position={pos} color="#6f9dff" intensity={0} distance={42} decay={2} />
}

// 樓層標示：放在「畫面遠側、偏 52°」的看台前緣，隨鏡頭移動；4 個晶片由內而外上下疊
const MARKS = [
  { text: '1 樓', d: PROFILES.L1.d0 + 0.5, y: PROFILES.L1.curb + 2.2 },
  { text: '2 樓', d: PROFILES.L2.d0 + 0.5, y: PROFILES.L2.curb + 2.0 },
  { text: '3–4 樓 包廂', d: SUITE.d0, y: (SUITE.balcony + SUITE.ceiling) / 2 },
  { text: '5 樓', d: (PROFILES.L5.d0 + PROFILES.L5.d1) / 2, y: (PROFILES.L5.y0 + PROFILES.L5.y1) / 2 + 2.0 },
]
const _f = new THREE.Vector3()
const _u = new THREE.Vector3()
const wrap = (p) => ((p % 360) + 360) % 360
function markerPhi(camera) {
  camera.getWorldDirection(_f)
  _u.set(0, 1, 0).applyQuaternion(camera.quaternion)
  const x = _f.x + _u.x * 0.6
  const z = _f.z + _u.z * 0.6
  const far = x * x + z * z < 1e-6 ? 0 : (Math.atan2(-x, -z) * 180) / Math.PI
  const ok = (p) => p >= 50 && p <= 310 // 5 樓與包廂只在 40°–320°
  let p = wrap(far + 52)
  if (!ok(p)) p = wrap(far - 52)
  if (!ok(p)) p = p < 180 ? 50 : 310
  return p
}

function LevelMarkers() {
  const items = useMemo(
    () =>
      MARKS.map((m) => ({
        ...m,
        html: `<div class="${styles.level}">${esc(m.text)}</div>`,
        resolve: (out, camera) => {
          const e = ellipsePoint(m.d, markerPhi(camera))
          out.set(e.x, m.y, e.z)
          return true
        },
      })),
    [],
  )
  return items.map((m) => <DomLabel key={m.text} resolve={m.resolve} html={m.html} zIndex={10} />)
}

export default function SeatSections({ zones, selectedId, onSelect, interactive = true, showLabels = true }) {
  const mats = useMemo(createSeatMaterials, [])
  useEffect(() => () => disposeSeatMaterials(mats), [mats])

  const [hoveredId, setHoveredId] = useState(null)
  const onHover = useCallback((id, on) => setHoveredId((h) => (on ? id : h === id ? null : h)), [])
  useEffect(() => {
    if (!interactive) setHoveredId(null)
  }, [interactive])

  // 游標：可售 → pointer；已售完 → not-allowed；只有自己設過才還原
  const hovered = interactive && hoveredId ? zones.find((z) => z.id === hoveredId) : null
  const cursor = hovered ? (hovered.soldOut ? 'not-allowed' : 'pointer') : ''
  const touched = useRef(false)
  useEffect(() => {
    if (!cursor && !touched.current) return
    document.body.style.cursor = cursor
    touched.current = !!cursor
  }, [cursor])
  useEffect(
    () => () => {
      if (touched.current) document.body.style.cursor = ''
    },
    [],
  )

  const selectedZone = selectedId ? zones.find((z) => z.id === selectedId) : null

  return (
    <group>
      {zones.map((z) => (
        <Section
          key={z.id}
          zone={z}
          selected={z.id === selectedId}
          hovered={interactive && z.id === hoveredId}
          interactive={interactive}
          showLabels={showLabels}
          mats={mats}
          onSelect={onSelect}
          onHover={onHover}
        />
      ))}
      <ClosedSeating mats={mats} interactive={interactive} />
      <UpperBands mats={mats} interactive={interactive} />
      <SelectionFX mats={mats} zone={selectedZone} active={interactive} />
      {showLabels && <LevelMarkers />}
    </group>
  )
}
