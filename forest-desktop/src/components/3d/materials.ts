import { shaderMaterial } from '@react-three/drei'
import * as THREE from 'three'

const nodeVertexShader = `
  uniform float time;
  attribute float highlight;
  attribute float phase;
  varying float vHighlight;
  varying float vPulse;
  #include <common>
  #include <uv_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    vHighlight = highlight;
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
    vec3 color = baseColor;
    if (vHighlight > 0.5) {
      color = mix(color, highlightColor, 0.7);
      glow += 0.1;
    }
    if (vHighlight > 1.5) {
      color = mix(color, hoverColor, 0.85);
      glow += 0.25;
    }
    gl_FragColor = vec4(color * glow, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const edgeVertexShader = `
  uniform float time;
  attribute float highlight;
  attribute float phase;
  varying float vHighlight;
  varying float vPulse;
  #include <common>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>

  void main() {
    vHighlight = highlight;
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
      color = mix(color, vec3(1.0, 0.6, 0.2), 0.7);
      glow += 0.2;
    }
    float alpha = 0.45 + 0.35 * clamp(vHighlight, 0.0, 1.0);
    gl_FragColor = vec4(color * glow, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

export const NodeGlowMaterial = shaderMaterial(
  {
    time: 0,
    baseColor: new THREE.Color('#2f3c9b'),
    highlightColor: new THREE.Color('#f7c948'),
    hoverColor: new THREE.Color('#ff8855')
  },
  nodeVertexShader,
  nodeFragmentShader
)

export const EdgeTrailMaterial = shaderMaterial(
  {
    time: 0,
    baseColorA: new THREE.Color('#0f1729'),
    baseColorB: new THREE.Color('#3b82f6')
  },
  edgeVertexShader,
  edgeFragmentShader
)

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
