import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'

// 浮在 3D 位置上的 DOM 標籤（取代 drei <Html>）
// drei Html 每個標籤各開一個 React root，在 React 19 StrictMode 下 unmount 會延遲執行、把新內容清掉；
// 這裡直接操作一個 div：內容用 innerHTML、位置在 useFrame 投影，StrictMode 重掛也安全
//
// anchors：候選錨點（區域座標）；每格挑畫面上「最靠上」且在鏡頭前方的那個
// follow：錨點跟著這個物件（抬升動畫）一起動
// resolve(out, camera)：自訂錨點（世界座標），回傳 false = 隱藏

const _w = new THREE.Vector3()
const _c = new THREE.Vector3()
const _n = new THREE.Vector3()

// 世界座標 → 畫面 px；在鏡頭後方或離畫面太遠回傳 null
function project(world, camera, size, out) {
  _c.copy(world).applyMatrix4(camera.matrixWorldInverse)
  if (_c.z > -camera.near) return null
  _n.copy(world).project(camera)
  if (Math.abs(_n.x) > 1.25 || Math.abs(_n.y) > 1.25) return null
  out.x = ((_n.x + 1) / 2) * size.width
  out.y = ((1 - _n.y) / 2) * size.height
  return out
}

export const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

export default function DomLabel({ anchors, follow, resolve, html, zIndex = 10 }) {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  const el = useMemo(() => document.createElement('div'), [])
  const last = useRef({ x: NaN, y: NaN, vis: null })
  const tmp = useMemo(() => ({ a: new THREE.Vector2(), best: new THREE.Vector2() }), [])

  useLayoutEffect(() => {
    el.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;will-change:transform;display:none;'
    el.style.zIndex = String(zIndex)
    gl.domElement.parentNode?.appendChild(el)
    last.current = { x: NaN, y: NaN, vis: null }
    invalidate()
    return () => el.remove()
  }, [el, gl, zIndex, invalidate])

  useLayoutEffect(() => {
    el.innerHTML = html
  }, [el, html])

  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld()
    let found = null
    if (resolve) {
      if (resolve(_w, camera)) found = project(_w, camera, size, tmp.best)
    } else if (anchors) {
      if (follow?.current) follow.current.updateWorldMatrix(true, false)
      for (const a of anchors) {
        _w.copy(a)
        if (follow?.current) _w.applyMatrix4(follow.current.matrixWorld)
        const p = project(_w, camera, size, tmp.a)
        if (p && (!found || p.y < found.y)) found = tmp.best.copy(p)
      }
    }
    const L = last.current
    const vis = !!found
    if (vis !== L.vis) {
      el.style.display = vis ? 'block' : 'none'
      L.vis = vis
    }
    if (!vis) return
    const x = Math.round(found.x * 2) / 2
    const y = Math.round(found.y * 2) / 2
    if (x !== L.x || y !== L.y) {
      el.style.transform = `translate3d(${x}px,${y}px,0)`
      L.x = x
      L.y = y
    }
  })

  return null
}
