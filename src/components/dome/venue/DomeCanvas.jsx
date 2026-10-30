import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js'
import { STAGE } from '../../../data/domeLayout'
import Cutaway from './Cutaway'
import Ground from './Ground'
import Facade from './Facade'
import Roof from './Roof'
import StageRig from './StageRig'

// 臺北大巨蛋：演唱會暗場
// Canvas、燈光、後製（光暈、色調映射、暗角、顆粒）、建築本體與舞台；
// children = 鏡頭系統與看台分區（由其他模組提供）

RectAreaLightUniformsLib.init()


const { screen } = STAGE

// 燈光：
// - 低強度的半球光＋上方柔光：讓看台票價顏色保持接近圖例色（不會被染色或過曝）
// - 主螢幕的暖色面光：LUMEN 主視覺的光灑到舞台、地面與前排看台
// - 幾盞彩色聚光：藍紫色打在屋頂與兩側（不投影）
function Lights() {
  const targets = useMemo(
    () => ({
      stage: new THREE.Object3D(),
      roof: new THREE.Object3D(),
      left: new THREE.Object3D(),
      right: new THREE.Object3D(),
    }),
    [],
  )
  useEffect(() => {
    targets.stage.position.set(0, 0, -34)
    targets.roof.position.set(0, 76, -12)
    targets.left.position.set(-70, 60, -20)
    targets.right.position.set(70, 60, -20)
    Object.values(targets).forEach((t) => t.updateMatrixWorld())
  }, [targets])
  return (
    <group>
      <hemisphereLight args={['#b4c0e6', '#20222c', 0.5]} />
      <directionalLight position={[30, 200, 140]} intensity={0.62} color="#e6ebff" />
      <rectAreaLight
        width={screen.width}
        height={screen.height}
        intensity={4.2}
        color="#ffae62"
        position={[0, screen.y0 + screen.height / 2, screen.z + 0.8]}
        rotation-y={Math.PI}
      />
      <spotLight
        position={[0, STAGE.rigTop - 1, STAGE.z1 - 2]}
        target={targets.stage}
        angle={0.75}
        penumbra={1}
        intensity={2.2}
        decay={0}
        color="#ffbf7a"
      />
      <spotLight position={[0, 24, -56]} target={targets.roof} angle={0.62} penumbra={1} intensity={2.4} decay={0} color="#7650ff" />
      <spotLight position={[-20, 30, -58]} target={targets.left} angle={0.7} penumbra={1} intensity={1.6} decay={0} color="#4d63ff" />
      <spotLight position={[20, 30, -58]} target={targets.right} angle={0.7} penumbra={1} intensity={1.6} decay={0} color="#8a4dff" />
    </group>
  )
}

function Post() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.18} intensity={0.9} radius={0.74} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <Vignette offset={0.3} darkness={0.55} />
      <Noise opacity={0.028} premultiply blendFunction={BlendFunction.SCREEN} />
    </EffectComposer>
  )
}

const labelStyle = {
  position: 'absolute',
  left: 0,
  top: 0,
  transform: 'translate(-9999px, 0)',
  padding: '6px 12px',
  borderRadius: 999,
  background: 'rgba(20, 22, 28, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  color: '#fff',
  fontFamily: 'inherit',
  fontSize: 12.5,
  fontWeight: 600,
  letterSpacing: '0.04em',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
  opacity: 0,
  transition: 'opacity 0.25s ease',
  zIndex: 5,
}

export default function DomeCanvas({ children }) {
  const labelRef = useRef(null)
  return (
    <>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ fov: 35, near: 0.5, far: 2600, position: [0, 210, 250] }}
        gl={{ antialias: false, stencil: false, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#07080c']} />
        <fog attach="fog" args={['#0a0c13', 480, 1500]} />
        <Lights />
        <Ground />
        <Facade />
        <Roof />
        <StageRig />
        {children}
        <Cutaway labelRef={labelRef} />
        <Post />
      </Canvas>
      <div ref={labelRef} style={labelStyle} aria-hidden="true">
        STAGE 舞台
      </div>
    </>
  )
}
