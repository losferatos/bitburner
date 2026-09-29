// GPU-Terrain: gemeinsame Gitter-Geometrien je LOD, Höhe per texelFetch aus der Heightmap.
import * as THREE from 'three';
import { N, CELL, HALF } from './world.js';
import { hookFog, U } from './atmosphere.js';

const CH = 256;               // Chunkgröße in m
const CHUNKS = (N * CELL) / CH; // 16
const LODS = [128, 64, 32, 16];

function makeGrid(segs) {
  const s = CH / segs;
  const pos = [];
  const idx = [];
  for (let j = 0; j <= segs; j++) for (let i = 0; i <= segs; i++) pos.push(i * s, 0, j * s);
  const v = (i, j) => j * (segs + 1) + i;
  for (let j = 0; j < segs; j++) for (let i = 0; i < segs; i++) {
    const a = v(i, j), b = v(i, j + 1), c = v(i + 1, j), d = v(i + 1, j + 1);
    idx.push(a, b, c, c, b, d);
  }
  // Schürzen gegen Risse zwischen LOD-Stufen
  const edge = (list) => {
    const base = pos.length / 3;
    for (const k of list) pos.push(pos[k * 3], 1, pos[k * 3 + 2]);
    for (let e = 0; e < list.length - 1; e++) {
      const a = list[e], b = list[e + 1], c = base + e, d = base + e + 1;
      idx.push(a, b, c, c, b, d, a, c, b, c, d, b);
    }
  };
  const top = [], bottom = [], left = [], right = [];
  for (let i = 0; i <= segs; i++) { top.push(v(i, 0)); bottom.push(v(i, segs)); left.push(v(0, i)); right.push(v(segs, i)); }
  edge(top); edge(bottom); edge(left); edge(right);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(0), 3));
  g.setIndex(idx);
  return g;
}

export function makeTerrainTextures(world) {
  const heightTex = new THREE.DataTexture(world.H, N, N, THREE.RedFormat, THREE.FloatType);
  heightTex.minFilter = heightTex.magFilter = THREE.NearestFilter;
  heightTex.needsUpdate = true;
  const normalTex = new THREE.DataTexture(world.NRM, N, N, THREE.RGBAFormat);
  normalTex.minFilter = THREE.LinearMipmapLinearFilter;
  normalTex.magFilter = THREE.LinearFilter;
  normalTex.generateMipmaps = true;
  normalTex.anisotropy = 8;
  normalTex.needsUpdate = true;
  return { heightTex, normalTex };
}

export const terrainUniforms = {
  uHeight: { value: null },
  uNormalTex: { value: null },
  uTerr: { value: new THREE.Vector3(HALF, CELL, N) },
  uClipY: { value: -1e9 },
};

export const terrainParsGLSL = /* glsl */ `
uniform highp sampler2D uHeight;
uniform sampler2D uNormalTex;
uniform vec3 uTerr;
vec2 terrUV(vec2 wxz) { return (wxz + uTerr.x) / (uTerr.y * uTerr.z) + 0.5 / uTerr.z; }
float terrHeight(vec2 wxz) {
  vec2 f = (wxz + uTerr.x) / uTerr.y;
  vec2 i = floor(f); vec2 t = f - i;
  ivec2 c = ivec2(clamp(i, vec2(0.0), vec2(uTerr.z - 2.0)));
  float a = texelFetch(uHeight, c, 0).r, b = texelFetch(uHeight, c + ivec2(1, 0), 0).r;
  float d = texelFetch(uHeight, c + ivec2(0, 1), 0).r, e = texelFetch(uHeight, c + ivec2(1, 1), 0).r;
  return mix(mix(a, b, t.x), mix(d, e, t.x), t.y);
}
`;

export function makeTerrain(world, textures) {
  terrainUniforms.uHeight.value = textures.heightTex;
  terrainUniforms.uNormalTex.value = textures.normalTex;

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, terrainUniforms, { uNoise: U.uNoise, uNight: U.uNight });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${terrainParsGLSL}\nvarying vec3 vTerrWorld;`)
      .replace('#include <beginnormal_vertex>', /* glsl */ `
        vec2 tWXZ = (modelMatrix * vec4(position.x, 0.0, position.z, 1.0)).xz;
        ivec2 tTC = ivec2(clamp(floor((tWXZ + uTerr.x) / uTerr.y + 0.5), vec2(0.0), vec2(uTerr.z - 1.0)));
        float tH = texelFetch(uHeight, tTC, 0).r;
        vec3 objectNormal = texelFetch(uNormalTex, tTC, 0).xyz * 2.0 - 1.0;`)
      .replace('#include <begin_vertex>', /* glsl */ `
        vec3 transformed = vec3(position.x, tH - position.y * 12.0, position.z);
        vTerrWorld = vec3(tWXZ.x, transformed.y, tWXZ.y);`);

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${terrainParsGLSL}\nuniform sampler2D uNoise;\nuniform float uNight;\nuniform float uClipY;\nvarying vec3 vTerrWorld;`)
      .replace('#include <map_fragment>', /* glsl */ `
        if (vTerrWorld.y < uClipY) discard;
        vec2 wp = vTerrWorld.xz;
        float th = vTerrWorld.y;
        vec4 tNrm = texture(uNormalTex, terrUV(wp));
        vec3 tN = normalize(tNrm.xyz * 2.0 - 1.0);
        float roadD = tNrm.a * 64.0;
        vec4 nz = texture(uNoise, wp * 0.0019);
        vec4 nz2 = texture(uNoise, wp * 0.027);
        vec4 nz3 = texture(uNoise, wp * 0.31);
        float slope = 1.0 - tN.y;
        float dryness = smoothstep(0.32, 0.72, nz.r + (nz2.g - 0.5) * 0.35 + th * 0.0009);
        vec3 grassA = vec3(0.085, 0.15, 0.04);
        vec3 grassB = vec3(0.30, 0.27, 0.11);
        vec3 macchia = vec3(0.07, 0.10, 0.045);
        vec3 grass = mix(grassA, grassB, dryness);
        grass = mix(grass, macchia, smoothstep(0.55, 0.75, nz2.b) * 0.7);
        grass *= 0.78 + 0.44 * nz3.a;
        // Fels: triplanar, damit Steilwände nicht verzerrt sind
        vec3 bw = pow(abs(tN), vec3(4.0)); bw /= dot(bw, vec3(1.0));
        vec3 wq = vTerrWorld;
        float rA = texture(uNoise, wq.zy * 0.045).b * bw.x + texture(uNoise, wq.xy * 0.045).b * bw.z + texture(uNoise, wq.xz * 0.045).b * bw.y;
        float rB = texture(uNoise, wq.zy * 0.19).r * bw.x + texture(uNoise, wq.xy * 0.19).r * bw.z + texture(uNoise, wq.xz * 0.19).r * bw.y;
        float rC = texture(uNoise, wq.zy * 0.9).a * bw.x + texture(uNoise, wq.xy * 0.9).a * bw.z + texture(uNoise, wq.xz * 0.9).a * bw.y;
        vec3 rock = mix(vec3(0.33, 0.3, 0.27), vec3(0.56, 0.52, 0.46), nz2.b);
        rock *= 0.55 + 0.55 * rA + 0.25 * (rB - 0.5) + 0.15 * (rC - 0.5);
        rock *= 0.93 + 0.07 * sin(th * 0.45 + nz2.r * 9.0 + nz.g * 12.0);
        rock = mix(rock, vec3(0.2, 0.24, 0.12) * (0.7 + 0.6 * rB), smoothstep(0.62, 0.8, rB * 0.6 + nz2.g * 0.6) * 0.55);
        rock *= 0.85;
        vec3 sand = vec3(0.66, 0.58, 0.44) * (0.9 + 0.18 * nz3.a);
        float wet = smoothstep(1.1, 0.2, th);
        sand = mix(sand, sand * 0.55, wet);
        vec3 dirt = vec3(0.30, 0.25, 0.19) * (0.85 + 0.3 * nz3.r);
        float rockW = smoothstep(0.33, 0.5, slope + (nz2.r - 0.5) * 0.25 + smoothstep(260.0, 420.0, th) * 0.25);
        float sandW = smoothstep(3.2, 1.4, th + (nz2.g - 0.5) * 2.5);
        float dirtW = smoothstep(9.5, 5.8, roadD + (nz3.r - 0.5) * 2.0);
        vec3 col = mix(grass, rock, rockW);
        col = mix(col, sand, sandW * (1.0 - rockW * 0.6));
        col = mix(col, dirt, dirtW * 0.85);
        col = mix(col, vec3(0.22, 0.24, 0.20) * (0.8 + 0.4 * nz2.r), smoothstep(-0.5, -4.0, th));
        diffuseColor.rgb = col;
        float tRough = mix(0.92, 0.78, rockW);
        tRough = mix(tRough, 0.45, wet * sandW);
        float tBump = mix(nz3.r * 0.6 + texture(uNoise, wp * 1.7).a * 0.4, rA * 3.2 + rB * 0.9 + rC * 0.15, rockW);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = tRough;')
      .replace('#include <normal_fragment_maps>', /* glsl */ `
        normal = normalize((viewMatrix * vec4(tN, 0.0)).xyz);
        {
          vec3 vSigmaX = dFdx(-vViewPosition), vSigmaY = dFdy(-vViewPosition);
          vec3 R1 = cross(vSigmaY, normal), R2 = cross(normal, vSigmaX);
          float fDet = dot(vSigmaX, R1);
          vec2 dB = vec2(dFdx(tBump), dFdy(tBump)) * mix(1.2, 1.0, rockW);
          vec3 vGrad = sign(fDet) * (dB.x * R1 + dB.y * R2);
          normal = normalize(abs(fDet) * normal - vGrad);
        }`);
  };
  mat.customProgramCacheKey = () => 'terrain';
  hookFog(mat);

  const geos = LODS.map(makeGrid);
  const group = new THREE.Group();
  const chunks = [];
  for (let cj = 0; cj < CHUNKS; cj++) for (let ci = 0; ci < CHUNKS; ci++) {
    const x0 = -HALF + ci * CH, z0 = -HALF + cj * CH;
    // Höhenbereich des Chunks
    let mn = 1e9, mx = -1e9;
    const i0 = ci * (CH / CELL), j0 = cj * (CH / CELL);
    for (let j = j0; j <= Math.min(j0 + CH / CELL, N - 1); j += 2) for (let i = i0; i <= Math.min(i0 + CH / CELL, N - 1); i += 2) {
      const h = world.H[j * N + i]; if (h < mn) mn = h; if (h > mx) mx = h;
    }
    const mesh = new THREE.Mesh(geos[0], mat);
    mesh.position.set(x0, 0, z0);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    const box = new THREE.Box3(new THREE.Vector3(x0, mn - 12, z0), new THREE.Vector3(x0 + CH, mx + 1, z0 + CH));
    const center = box.getCenter(new THREE.Vector3());
    // Chunks komplett unter Wasser weit draußen braucht niemand
    chunks.push({ mesh, box, center, deep: mx < -6 });
    group.add(mesh);
  }

  const frustum = new THREE.Frustum();
  const m = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  function update(camera, lodBias = 1) {
    m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(m, camera.coordinateSystem, camera.reversedDepth);
    for (const c of chunks) {
      const vis = !c.deep && frustum.intersectsBox(c.box);
      c.mesh.visible = vis;
      if (!vis) continue;
      const d = c.box.distanceToPoint(camera.position) * lodBias;
      const lod = d < 260 ? 0 : d < 700 ? 1 : d < 1500 ? 2 : 3;
      c.mesh.geometry = geos[lod];
    }
  }
  return { group, update, material: mat };
}
