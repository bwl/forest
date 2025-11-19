import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

const nodeVertexShader = `
  uniform float time;
  attribute float highlight;
  attribute float phase;
  attribute float filter;
  attribute vec3 nodeColor;
  varying float vHighlight;
  varying float vPulse;
  varying float vFilter;
  varying vec3 vNodeColor;
  #include <common>
  #include <uv_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    vHighlight = highlight;
    vFilter = filter;
    vNodeColor = nodeColor;
    float pulse = sin(time * 0.9 + phase);
    vPulse = pulse;
    #include <uv_vertex>
    #include <color_vertex>
    #include <begin_vertex>
    transformed *= (1.0 + 0.08 * pulse);
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`

const nodeFragmentShader = `
  varying float vHighlight;
  varying float vPulse;
  varying vec3 vNodeColor;
  varying float vFilter;
  uniform vec3 baseColor;
  uniform vec3 highlightColor;
  uniform vec3 hoverColor;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  #include <fog_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    #include <clipping_planes_fragment>
    float glow = 0.45 + 0.35 * (vPulse * 0.5 + 0.5);
    // Use per-node color instead of uniform baseColor
    vec3 color = vNodeColor;
    if (vHighlight > 0.5) {
      color = mix(color, highlightColor, 0.7);
      glow += 0.1;
    }
    if (vHighlight > 1.5) {
      color = mix(color, hoverColor, 0.85);
      glow += 0.25;
    }
    float visibility = mix(0.18, 1.0, clamp(vFilter, 0.0, 1.0));
    gl_FragColor = vec4(color * glow * visibility, visibility);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const edgeVertexShader = `
  uniform float time;
  attribute float highlight;
  attribute float phase;
  attribute float opacity;
  attribute float filter;
  varying float vHighlight;
  varying float vPulse;
  varying float vOpacity;
  varying float vFilter;
  #include <common>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    vHighlight = highlight;
    vOpacity = opacity;
    vFilter = filter;
    float wave = sin(time * 0.6 + phase);
    vPulse = wave;
    #include <color_vertex>
    #include <begin_vertex>
    transformed += normal * wave * 0.06;
    #include <project_vertex>
    #include <logdepthbuf_vertex>
    #include <clipping_planes_vertex>
    #include <fog_vertex>
  }
`

const edgeFragmentShader = `
  varying float vHighlight;
  varying float vPulse;
  varying float vOpacity;
  varying float vFilter;
  uniform vec3 baseColorA;
  uniform vec3 baseColorB;
  #include <common>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  #include <fog_pars_fragment>

  void main() {
    #include <logdepthbuf_fragment>
    #include <clipping_planes_fragment>
    float glow = 0.35 + 0.35 * (vPulse * 0.5 + 0.5);
    vec3 color = mix(baseColorA, baseColorB, clamp(vHighlight, 0.0, 1.0));
    if (vHighlight > 1.5) {
      color = mix(color, vec3(0.796, 0.294, 0.086), 0.7);
      glow += 0.2;
    }
    // Use per-edge opacity based on score, boosted by highlight state
    float baseAlpha = vOpacity * (0.45 + 0.35 * clamp(vHighlight, 0.0, 1.0));
    float visibility = mix(0.12, 1.0, clamp(vFilter, 0.0, 1.0));
    float alpha = baseAlpha * visibility;
    gl_FragColor = vec4(color * glow, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

// Solarized Light colors (default)
const lightNodeBase = new THREE.Color('#586e75')
const lightNodeHighlight = new THREE.Color('#859900')
const lightNodeHover = new THREE.Color('#cb4b16')
const lightEdgeBase = new THREE.Color('#93a1a1')
const lightEdgeHighlight = new THREE.Color('#268bd2')

// Solarized Dark colors
const darkNodeBase = new THREE.Color('#839496')
const darkNodeHighlight = new THREE.Color('#859900')
const darkNodeHover = new THREE.Color('#cb4b16')
const darkEdgeBase = new THREE.Color('#586e75')
const darkEdgeHighlight = new THREE.Color('#268bd2')

export const NodeGlowMaterial = shaderMaterial(
  {
    time: 0,
    baseColor: lightNodeBase.clone(),
    highlightColor: lightNodeHighlight.clone(),
    hoverColor: lightNodeHover.clone()
  },
  nodeVertexShader,
  nodeFragmentShader
)

export const EdgeTrailMaterial = shaderMaterial(
  {
    time: 0,
    baseColorA: lightEdgeBase.clone(),
    baseColorB: lightEdgeHighlight.clone()
  },
  edgeVertexShader,
  edgeFragmentShader
)

/**
 * Update node material colors based on theme
 */
export function updateNodeMaterialColors(material: NodeGlowMaterialImpl, theme: 'light' | 'dark') {
  if (theme === 'dark') {
    material.uniforms.baseColor.value.copy(darkNodeBase)
    material.uniforms.highlightColor.value.copy(darkNodeHighlight)
    material.uniforms.hoverColor.value.copy(darkNodeHover)
  } else {
    material.uniforms.baseColor.value.copy(lightNodeBase)
    material.uniforms.highlightColor.value.copy(lightNodeHighlight)
    material.uniforms.hoverColor.value.copy(lightNodeHover)
  }
}

/**
 * Update edge material colors based on theme
 */
export function updateEdgeMaterialColors(material: EdgeTrailMaterialImpl, theme: 'light' | 'dark') {
  if (theme === 'dark') {
    material.uniforms.baseColorA.value.copy(darkEdgeBase)
    material.uniforms.baseColorB.value.copy(darkEdgeHighlight)
  } else {
    material.uniforms.baseColorA.value.copy(lightEdgeBase)
    material.uniforms.baseColorB.value.copy(lightEdgeHighlight)
  }
}

export type NodeGlowMaterialImpl = THREE.ShaderMaterial & {
  uniforms: {
    time: { value: number }
    baseColor: { value: THREE.Color }
    highlightColor: { value: THREE.Color }
    hoverColor: { value: THREE.Color }
  }
}

export type EdgeTrailMaterialImpl = THREE.ShaderMaterial & {
  uniforms: {
    time: { value: number }
    baseColorA: { value: THREE.Color }
    baseColorB: { value: THREE.Color }
  }
}
