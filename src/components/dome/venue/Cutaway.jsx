import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CUT } from './materials'
import { DECK, deckY } from './geometry'
import { STAGE_LABEL_POS } from './StageRig'

// 每一幀依相機位置更新屋頂剖切（在 CameraRig 之後、後製輸出之前執行）：
// - 相機在屋頂外面（俯瞰、平面、側面視角）→ uOpen 漸變到 1：屋蓋與近相機側往下剖開，
//   鋼構網格留成半透明細線，看台不會被擋住
// - 相機在場內（座位視野、舞台視角）→ uOpen 漸變到 0：完整的室內屋頂
// 同時把「STAGE 舞台」標籤投影到畫面上（直接改 DOM，不觸發 React 重繪）

const v = new THREE.Vector3()
const LABEL = new THREE.Vector3(...STAGE_LABEL_POS)
const damp = (cur, target, k, dt) => cur + (target - cur) * (1 - Math.exp(-k * dt))

export default function Cutaway({ labelRef }) {
  useFrame(({ camera, size, clock }, delta) => {
    const dt = Math.min(delta, 0.1)
    const p = camera.position
    CUT.uTime.value = clock.elapsedTime

    // 相機是否在屋頂內側
    const r = Math.hypot(p.x / DECK.ax, p.z / DECK.az)
    // 在建築外側、低於屋頂時（例如從街道看）看不到看台，保留完整外觀
    const inside = r < 1 && p.y < deckY(r) - 0.5
    const target = inside ? 0 : r < 1.05 ? 1 : THREE.MathUtils.smoothstep(p.y, 55, 85)
    CUT.uOpen.value = damp(CUT.uOpen.value, target, 5, dt)

    // 相機的水平方向與「側看程度」（正上方俯視 = 0）
    const nx = p.x / 94
    const nz = p.z / 124
    const len = Math.hypot(nx, nz) || 1
    const lean = Math.atan2(Math.hypot(p.x, p.z), Math.max(1, p.y - 30))
    const strength = THREE.MathUtils.smoothstep(lean, 0.25, 0.8)
    const c = CUT.uCam.value
    c.x = damp(c.x, nx / len, 6, dt)
    c.y = damp(c.y, nz / len, 6, dt)
    c.z = damp(c.z, strength, 6, dt)

    // 舞台標籤
    const el = labelRef?.current
    if (el) {
      v.copy(LABEL).project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05
      if (visible) {
        const x = ((v.x + 1) / 2) * size.width
        const y = ((1 - v.y) / 2) * size.height
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
        el.style.opacity = '1'
      } else {
        el.style.opacity = '0'
      }
    }
  }, 0.5)
  return null
}
