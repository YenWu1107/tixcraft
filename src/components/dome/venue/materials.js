import * as THREE from 'three'

// 建築本體都不參與點選，避免擋住看台的 raycast
export const noRaycast = () => null

// 夜間演唱會的色票
export const COLORS = {
  bg: '#07080c',
  titanium: '#6E7A8A', // 屋頂鈦金屬（霧面藍灰）
  silver: '#B8BEC6', // 折線下方的菱形板帶
  steel: '#BFC5D2', // 屋頂白色鋼管
  deck: '#0A0B10', // 屋面板內側（近黑）
  concrete: '#22252D', // 內牆、走廊
  skirt: '#AEB3BD', // 外野弧牆（淺灰）
  catwalk: '#8D939D',
  stage: '#0C0D11',
  truss: '#2A2C33',
  floor: '#0E1015', // 場地地面（演唱會鋪面）
  ground: '#0A0C11', // 廣場
  amber: '#FFB25A',
}

// ───────── 屋頂剖切（相機在屋頂外面時，把近相機側與屋蓋掀開）─────────
// 所有「高處」的建築材質共用這組 uniforms，由 Cutaway 元件每一幀更新
// uOpen：0 = 相機在室內（完整屋頂）、1 = 相機在室外（剖開）
// uCam：xy = 相機水平方向（橢圓正規化後的單位向量），z = 偏向側面的程度（0 = 正上方俯視）
export const CUT = {
  uOpen: { value: 0 },
  uCam: { value: new THREE.Vector3(0, 1, 0) },
  uNearH: { value: 41 }, // 近相機側剖到的高度（5 樓最後排上方）
  uFarH: { value: 52 }, // 遠側保留的屋簷高度
  uTime: { value: 0 },
}

// 片段著色器共用：剖切高度、場內燈光的藍紫色泛光
const CUT_COMMON = /* glsl */ `
  uniform float uOpen;
  uniform vec3 uCam;
  uniform float uNearH;
  uniform float uFarH;
  uniform float uTime;
  varying vec3 vCutW;
  float cutHeight(vec3 w) {
    vec2 dir = w.xz / vec2(94.0, 124.0);
    float len = max(length(dir), 1e-3);
    float near = smoothstep(-0.25, 0.45, dot(dir / len, uCam.xy)) * uCam.z;
    near = max(near, 1.0 - smoothstep(0.35, 0.8, len)); // 屋頂中央（吊掛喇叭等）一律剖掉
    float h = mix(uFarH + 10.0 * uCam.z, uNearH, near);
    return mix(160.0, h, uOpen);
  }
  // 舞台燈打到屋頂的泛光：整體藍紫，靠舞台側偏暖、帶幾道慢慢移動的光帶
  vec3 venueWash(vec3 w) {
    float a = atan(w.x, -w.z);
    float bands = 0.55 + 0.45 * sin(a * 7.0 + uTime * 0.35) * sin(w.z * 0.035 - uTime * 0.22);
    vec3 col = mix(vec3(0.20, 0.22, 1.0), vec3(0.55, 0.18, 1.0), 0.5 + 0.5 * sin(a * 2.0 + 0.6));
    float stage = exp(-max(0.0, w.z + 110.0) / 70.0);
    col = mix(col, vec3(1.0, 0.55, 0.22), stage * 0.55);
    return col * (0.55 + 0.45 * bands);
  }
`

// 把剖切／泛光注入 three 內建材質（MeshStandard / MeshBasic / InstancedMesh 都可用）
// ghost：剖開時高處改成半透明（屋頂鋼構保留成細線），否則直接挖掉
// wash：藍紫泛光的強度（emissive），0 = 不加
export function withCutaway(material, { ghost = 0, wash = 0, cut = true, key = '' } = {}) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, CUT)
    shader.uniforms.uWashK = { value: wash }
    shader.uniforms.uGhost = { value: ghost }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutW;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec4 cutW = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cutW = instanceMatrix * cutW;
        #endif
        vCutW = (modelMatrix * cutW).xyz;`,
      )
    let frag = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      ${CUT_COMMON}
      uniform float uWashK;
      uniform float uGhost;`,
    )
    if (cut) {
      const test = ghost
        ? 'float cutAlpha = vCutW.y > cutHeight(vCutW) ? uGhost : 1.0;'
        : 'if (vCutW.y > cutHeight(vCutW)) discard;\nfloat cutAlpha = 1.0;'
      frag = frag.replace('void main() {', `void main() {\n${test}`)
      if (ghost) {
        frag = frag.replace(
          '#include <dithering_fragment>',
          '#include <dithering_fragment>\ngl_FragColor.a *= cutAlpha;',
        )
      }
    }
    if (wash) {
      const anchor = frag.includes('#include <emissivemap_fragment>')
        ? '#include <emissivemap_fragment>'
        : '#include <map_fragment>'
      const target = frag.includes('totalEmissiveRadiance') ? 'totalEmissiveRadiance' : 'diffuseColor.rgb'
      frag = frag.replace(anchor, `${anchor}\n${target} += venueWash(vCutW) * uWashK;`)
    }
    shader.fragmentShader = frag
  }
  material.customProgramCacheKey = () => `cut-${cut}-${ghost}-${wash}-${key}`
  if (ghost) material.transparent = true
  return material
}
