// GPU-Gras: Halme wandern kachelweise mit der Kamera mit, Höhe/Maske kommen aus den Terrain-Texturen.
import * as THREE from 'three';
import { hookFog, U } from './atmosphere.js';
import { terrainUniforms, terrainParsGLSL } from './terrain.js';

export function makeGrass(count, tile = 66) {
  const base = new THREE.BufferGeometry();
  // Halm: 3 Segmente, 7 Vertices. position.x = Seite (-1..1), position.y = Höhe (0..1)
  const P = [-1, 0, 0, 1, 0, 0, -0.8, 0.33, 0, 0.8, 0.33, 0, -0.5, 0.66, 0, 0.5, 0.66, 0, 0, 1, 0];
  const I = [0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6];
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(21).fill(0), 3));
  geo.setIndex(I);
  const off = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    off[i * 4] = Math.random() * tile;
    off[i * 4 + 1] = Math.random() * tile;
    off[i * 4 + 2] = Math.random();
    off[i * 4 + 3] = Math.random();
  }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  geo.instanceCount = count;
  base.dispose();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, terrainUniforms, { uTime: U.uTime, uNoise: U.uNoise, uTile: { value: tile }, uSunLight: U.uSunLight, uSunDir: U.uSunDir });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        ${terrainParsGLSL}
        attribute vec4 aOff;
        uniform float uTime; uniform float uTile; uniform sampler2D uNoise;
        varying vec3 vGrassCol; varying float vGrassH; varying vec3 vGrassW;`)
      .replace('#include <beginnormal_vertex>', /* glsl */ `
        vec2 cam = cameraPosition.xz;
        vec2 wxz = cam + mod(aOff.xy - cam + uTile * 0.5, uTile) - uTile * 0.5;
        vec4 tn = texture(uNormalTex, terrUV(wxz));
        vec3 gN = tn.xyz * 2.0 - 1.0;
        float roadD = tn.a * 64.0;
        float gh = terrHeight(wxz);
        vec4 nz = texture(uNoise, wxz * 0.0019);
        vec4 nz2 = texture(uNoise, wxz * 0.027);
        float dryness = smoothstep(0.32, 0.72, nz.r + (nz2.g - 0.5) * 0.35 + gh * 0.0009);
        float mask = smoothstep(0.86, 0.92, gN.y) * smoothstep(6.4, 8.0, roadD) * smoothstep(2.6, 4.0, gh) * smoothstep(320.0, 250.0, gh);
        mask *= smoothstep(0.25, 0.5, nz2.r + aOff.w * 0.35);
        float dist = distance(wxz, cam);
        float fade = 1.0 - smoothstep(uTile * 0.3, uTile * 0.48, dist);
        float hgt = (0.22 + 0.42 * aOff.z * aOff.z) * mix(1.0, 0.75, dryness) * mask * fade;
        float ang = aOff.w * 6.2831;
        vec2 fdir = vec2(cos(ang), sin(ang));
        vec2 side = vec2(-fdir.y, fdir.x);
        // Wind: Böen als wandernde Rauschwellen
        float gust = texture(uNoise, wxz * 0.012 - vec2(uTime * 0.035, uTime * 0.02)).r;
        vec2 wind = vec2(0.8, 0.45) * (gust * 1.3 - 0.25) + vec2(sin(uTime * 2.3 + aOff.w * 30.0), cos(uTime * 1.9 + aOff.z * 20.0)) * 0.1;
        float y = position.y;
        vec2 bend = (fdir * 0.25 + wind) * y * y * hgt;
        vec3 objectNormal = normalize(vec3(fdir.x * 0.3 + position.x * side.x * 0.4, 1.0, fdir.y * 0.3 + position.x * side.y * 0.4));
        vec3 gcol = mix(vec3(0.09, 0.15, 0.035), vec3(0.34, 0.3, 0.12), dryness);
        vGrassCol = gcol * (0.75 + 0.5 * aOff.z);
        vGrassH = y;`)
      .replace('#include <begin_vertex>', /* glsl */ `
        float w = 0.032 * (1.0 - y * 0.85) * (0.7 + aOff.w * 0.6);
        vec3 transformed = vec3(wxz.x + side.x * position.x * w + bend.x, gh + y * hgt - 0.03 * (1.0 - y * hgt), wxz.y + side.y * position.x * w + bend.y);
        vGrassW = transformed;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSunLight; uniform vec3 uSunDir;
        varying vec3 vGrassCol; varying float vGrassH; varying vec3 vGrassW;`)
      .replace('#include <map_fragment>', /* glsl */ `
        diffuseColor.rgb = vGrassCol * mix(0.35, 1.15, vGrassH);`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        {
          vec3 vd = normalize(vGrassW - cameraPosition);
          float back = pow(max(dot(vd, uSunDir), 0.0), 4.0);
          totalEmissiveRadiance += diffuseColor.rgb * uSunLight * back * 0.4 * vGrassH;
        }`);
  };
  mat.customProgramCacheKey = () => 'grass';
  hookFog(mat);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  return { mesh, setCount(n) { geo.instanceCount = Math.min(n, count); } };
}
