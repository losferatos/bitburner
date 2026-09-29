// Nachbearbeitung: Lichtstrahlen, Bloom, Tonemapping, SMAA, Farbgebung/Vignette/Körnung.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

const GodRaysShader = {
  uniforms: {
    tDiffuse: { value: null },
    uSun: { value: new THREE.Vector2(0.5, 0.5) },
    uStrength: { value: 0 },
    uTint: { value: new THREE.Color(1, 0.8, 0.6) },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uStrength; uniform vec3 uTint; uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (uStrength <= 0.0) { gl_FragColor = base; return; }
      vec2 delta = (uSun - vUv);
      float distSun = length(delta * vec2(uAspect, 1.0));
      const int S = 36;
      delta *= 0.95 / float(S);
      vec2 uv = vUv + delta * hash(vUv * 931.7);
      float decay = 1.0, acc = 0.0;
      for (int i = 0; i < S; i++) {
        vec3 c = texture2D(tDiffuse, uv).rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        acc += smoothstep(1.2, 5.0, l) * decay;
        decay *= 0.965;
        uv += delta;
      }
      acc /= float(S);
      float falloff = exp(-distSun * 2.2);
      vec3 col = base.rgb + uTint * acc * uStrength * falloff;
      // Linsenreflexe: Geister entlang der Achse Sonne -> Bildmitte, nur wenn die Sonne sichtbar ist
      vec3 sunC = texture2D(tDiffuse, uSun).rgb;
      float vis = smoothstep(4.0, 30.0, dot(sunC, vec3(0.333)));
      if (vis > 0.0) {
        vec2 axis = uSun - vec2(0.5);
        const float gp[5] = float[5](-0.35, -0.7, -1.0, 0.45, -1.35);
        const float gs[5] = float[5](0.035, 0.06, 0.02, 0.025, 0.09);
        for (int g = 0; g < 5; g++) {
          vec2 c = vec2(0.5) + axis * gp[g];
          float d = length((vUv - c) * vec2(uAspect, 1.0));
          float ring = smoothstep(gs[g], gs[g] * 0.7, d) * (0.35 + 0.65 * smoothstep(gs[g] * 0.4, gs[g], d));
          vec3 tint = g == 1 ? vec3(0.3, 0.6, 1.0) : g == 3 ? vec3(1.0, 0.5, 0.2) : vec3(0.7, 1.0, 0.6);
          col += tint * ring * vis * uStrength * 0.18;
        }
        // Halo-Ring
        float hd = length((vUv - vec2(0.5) - axis * -0.25) * vec2(uAspect, 1.0));
        col += vec3(1.0, 0.75, 0.5) * smoothstep(0.02, 0.0, abs(hd - 0.32)) * vis * uStrength * 0.08;
      }
      gl_FragColor = vec4(col, base.a);
    }`,
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.035 },
    uCA: { value: 0.0009 },
    uLetterbox: { value: 0 },
    uAspect: { value: 1 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uVignette, uGrain, uCA, uLetterbox, uAspect;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 d = vUv - 0.5;
      float r2 = dot(d * vec2(uAspect, 1.0), d * vec2(uAspect, 1.0)) / max(uAspect * uAspect * 0.25 + 0.25, 0.001);
      vec3 col;
      col.r = texture2D(tDiffuse, vUv - d * uCA * r2 * 4.0).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv + d * uCA * r2 * 4.0).b;
      col *= mix(1.0, 1.0 - uVignette, smoothstep(0.15, 1.1, r2));
      float g = hash(vUv * 1733.0 + fract(uTime * 7.13)) - 0.5;
      col += g * uGrain * (0.35 + 0.65 * (1.0 - dot(col, vec3(0.333))));
      // Kino-Balken (2.35:1)
      if (uLetterbox > 0.0) {
        float barH = max(0.0, 0.5 - 0.5 * uAspect / 2.35) * uLetterbox;
        if (vUv.y < barH || vUv.y > 1.0 - barH) col = vec3(0.0);
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export function makePost(renderer, scene, camera) {
  // Float-Tiefenpuffer: zusammen mit Reversed-Z praktisch kein Z-Fighting bis zum Horizont
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(sz.x, sz.y, { type: THREE.HalfFloatType });
  rt.depthTexture = new THREE.DepthTexture(sz.x, sz.y, THREE.FloatType);
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const rays = new ShaderPass(GodRaysShader);
  composer.addPass(rays);
  const size = renderer.getSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.35, 0.55, 1.1);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const smaa = new SMAAPass();
  composer.addPass(smaa);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);

  const sunW = new THREE.Vector3();
  return {
    composer,
    bloom,
    rays,
    grade,
    smaa,
    update(time, sunDir, sunColor, night, aspect, raysOn) {
      grade.uniforms.uTime.value = time;
      grade.uniforms.uAspect.value = aspect;
      rays.uniforms.uAspect.value = aspect;
      bloom.strength = THREE.MathUtils.lerp(0.28, 0.75, night);
      bloom.threshold = THREE.MathUtils.lerp(1.1, 0.8, night);
      // Sonnenposition auf dem Schirm
      sunW.copy(camera.position).addScaledVector(sunDir, 10000).project(camera);
      const facing = camera.getWorldDirection(new THREE.Vector3()).dot(sunDir);
      const onScreen = facing > 0.2 && sunDir.y > -0.03;
      rays.uniforms.uSun.value.set(sunW.x * 0.5 + 0.5, sunW.y * 0.5 + 0.5);
      rays.uniforms.uStrength.value = raysOn && onScreen ? 0.55 * THREE.MathUtils.smoothstep(facing, 0.2, 0.7) * (1 - night) : 0;
      rays.uniforms.uTint.value.copy(sunColor);
      rays.enabled = rays.uniforms.uStrength.value > 0;
    },
  };
}
