// Fahrbahn als Band entlang der Spline, prozeduraler Asphalt, Markierungen, Straßenlaternen, Leitplanken.
import * as THREE from 'three';
import { ROAD_HALF } from './world.js';
import { hookFog, U } from './atmosphere.js';

export const LAMP_SPACING = 48;

export function roadFrame(road, s, out = {}) {
  // Interpolierte Straßenlage an Bogenlänge s (Meter)
  const M = road.M;
  const f = (((s / road.step) % M) + M) % M;
  const i = Math.floor(f), j = (i + 1) % M, t = f - i;
  const L = (a) => a[i] + (a[j] - a[i]) * t;
  out.x = L(road.X); out.z = L(road.Z); out.y = L(road.Y);
  let tx = L(road.TX), tz = L(road.TZ);
  const l = Math.hypot(tx, tz); tx /= l; tz /= l;
  out.tx = tx; out.tz = tz;
  out.k = L(road.K);
  out.bank = L(road.BANK);
  const i2 = (i + 3) % M, i0 = (i - 3 + M) % M;
  out.grade = (road.Y[i2] - road.Y[i0]) / (6 * road.step);
  return out;
}

export function makeRoad(world) {
  const road = world.road;
  const W = ROAD_HALF;
  // Querprofil: [seitlicher Abstand, Höhenversatz]
  const prof = [[-W - 2.2, -0.9], [-W - 0.45, -0.04], [-W, 0.0], [0, 0.03], [W, 0.0], [W + 0.45, -0.04], [W + 2.2, -0.9]];
  const STEP = 2;
  const n = Math.floor(road.M / STEP);
  const pos = [], uv = [], idx = [];
  const fr = {};
  for (let k = 0; k <= n; k++) {
    const s = k * STEP * road.step;
    roadFrame(road, s, fr);
    const rx = -fr.tz, rz = fr.tx;
    for (const [lx, dy] of prof) {
      pos.push(fr.x + rx * lx, fr.y + dy + lx * fr.bank + 0.06, fr.z + rz * lx);
      uv.push(lx, k === n ? n * STEP * road.step : s);
    }
  }
  const P = prof.length;
  for (let k = 0; k < n; k++) for (let c = 0; c < P - 1; c++) {
    const a = k * P + c, b = a + 1, d = (k + 1) * P + c, e = d + 1;
    idx.push(a, b, d, b, e, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNoise = U.uNoise;
    shader.uniforms.uNight = U.uNight;
    shader.uniforms.uWet = U.uWet;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRoad;\nvarying vec3 vRoadW;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRoad = uv;\nvRoadW = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec2 vRoad; varying vec3 vRoadW;
        uniform sampler2D uNoise; uniform float uNight; uniform float uWet;
        const float RW = ${W.toFixed(2)};
        const float LAMP = ${LAMP_SPACING.toFixed(1)};`)
      .replace('#include <map_fragment>', /* glsl */ `
        float lx = vRoad.x, s = vRoad.y, ax = abs(lx);
        vec2 wp = vRoadW.xz;
        vec4 n1 = texture(uNoise, wp * 0.013);
        vec4 n2 = texture(uNoise, wp * 0.19);
        vec4 n3 = texture(uNoise, wp * 1.9);
        float aa = fwidth(lx) * 1.2 + 0.002;
        vec3 asphalt = vec3(0.075, 0.075, 0.08) * (0.82 + 0.3 * n3.a + 0.2 * n2.r);
        // Flicken und Fahrspuren
        asphalt = mix(asphalt, asphalt * 0.72, smoothstep(0.62, 0.66, n1.b) * 0.8);
        float track = exp(-pow((ax - 2.3) / 0.55, 2.0));
        asphalt *= 1.0 - track * 0.18;
        float rough = mix(0.86, 0.62, track);
        // Markierungen
        float edge = smoothstep(RW - 0.42 - aa, RW - 0.42, ax) * (1.0 - smoothstep(RW - 0.28, RW - 0.28 + aa, ax));
        float dash = step(fract(s / 12.0), 0.42);
        float center = (1.0 - smoothstep(0.07, 0.07 + aa, ax)) * dash;
        float paint = max(edge, center) * (0.75 + 0.25 * smoothstep(0.2, 0.6, n2.g));
        vec3 col = mix(asphalt, vec3(0.78, 0.76, 0.7), paint);
        rough = mix(rough, 0.55, paint);
        // Bankett
        float shoulder = smoothstep(RW + 0.02, RW + 0.3, ax);
        vec3 gravel = vec3(0.26, 0.23, 0.19) * (0.7 + 0.5 * n3.r);
        col = mix(col, gravel, shoulder);
        rough = mix(rough, 0.95, shoulder);
        // Nässe bei Nacht leicht glänzend
        rough = mix(rough, rough * 0.55, uWet * (1.0 - shoulder) * smoothstep(0.3, 0.7, n1.g));
        diffuseColor.rgb = col;`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = rough;')
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        // Lichtkegel der Straßenlaternen (rechte Seite, analytisch)
        if (uNight > 0.01) {
          float ds = s - (floor(s / LAMP) + 0.5) * LAMP;
          vec3 d = vec3(ds, 8.2, lx - (RW + 0.2));
          float r2 = dot(d, d);
          float E = 8.2 / (r2 * sqrt(r2));
          totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.72, 0.42) * E * 70.0 * uNight;
        }`);
  };
  mat.customProgramCacheKey = () => 'road';
  hookFog(mat);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // Straßenlaternen
  const lamps = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.14, 8.4, 8, 1);
  poleGeo.translate(0, 4.2, 0);
  const armGeo = new THREE.BoxGeometry(0.1, 0.1, 1.8);
  armGeo.translate(0, 8.35, -0.9);
  const headGeo = new THREE.BoxGeometry(0.34, 0.16, 0.7);
  headGeo.translate(0, 8.25, -1.7);
  const glassGeo = new THREE.BoxGeometry(0.26, 0.04, 0.56);
  glassGeo.translate(0, 8.16, -1.7);
  const poleMat = hookFog(new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.5, metalness: 0.7 }));
  const glassMat = hookFog(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xffb36b, emissiveIntensity: 0 }));
  const count = Math.floor(road.length / LAMP_SPACING);
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, count);
  const arms = new THREE.InstancedMesh(armGeo, poleMat, count);
  const heads = new THREE.InstancedMesh(headGeo, poleMat, count);
  const glass = new THREE.InstancedMesh(glassGeo, glassMat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
  const lampPositions = [];
  for (let k = 0; k < count; k++) {
    const s = (k + 0.5) * LAMP_SPACING;
    roadFrame(road, s, fr);
    const rx = -fr.tz, rz = fr.tx;
    const off = W + 1.9;
    v.set(fr.x + rx * off, fr.y - 0.1, fr.z + rz * off);
    // Arm zeigt zur Straße (lokal -Z)
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(rx, rz));
    m4.compose(v, q, sc);
    poles.setMatrixAt(k, m4); arms.setMatrixAt(k, m4); heads.setMatrixAt(k, m4); glass.setMatrixAt(k, m4);
    lampPositions.push(new THREE.Vector3(fr.x + rx * (W + 0.2), fr.y + 8.1, fr.z + rz * (W + 0.2)));
  }
  for (const im of [poles, arms, heads, glass]) { im.castShadow = im !== glass; im.computeBoundingSphere(); lamps.add(im); }

  // Leitplanken dort, wo es neben der Straße steil bergab geht (beide Seiten)
  const railPos = [], railIdx = [], postM = [];
  const flush = (run) => {
    if (run.length > 3) {
      const base = railPos.length / 3;
      for (const r of run) railPos.push(r[0], r[1] + 0.45, r[2], r[0], r[1] + 0.78, r[2]);
      for (let k = 0; k < run.length - 1; k++) {
        const a = base + k * 2, b = a + 1, c = a + 2, d = a + 3;
        railIdx.push(a, c, b, b, c, d);
      }
    }
    run.length = 0;
  };
  for (const side of [-1, 1]) {
    const run = [];
    for (let k = 0; k < road.M; k += 2) {
      roadFrame(road, k * road.step, fr);
      const rx = -fr.tz, rz = fr.tx;
      const o = side * (W + 0.9);
      const x = fr.x + rx * o, z = fr.z + rz * o;
      const drop = fr.y - world.heightAt(fr.x + rx * side * (W + 7), fr.z + rz * side * (W + 7));
      // Laternenseite (rechts) frei lassen
      if (drop > 2.6 && side < 0) {
        const y = fr.y + o * fr.bank;
        run.push([x, y, z]);
        if (k % 4 === 0) postM.push([x, y, z, Math.atan2(rx, rz)]);
      } else flush(run);
    }
    flush(run);
  }
  const railGeo = new THREE.BufferGeometry();
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPos, 3));
  railGeo.setIndex(railIdx);
  railGeo.computeVertexNormals();
  const railMat = hookFog(new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.35, metalness: 0.85, side: THREE.DoubleSide }));
  const rail = new THREE.Mesh(railGeo, railMat);
  rail.castShadow = true; rail.receiveShadow = true;
  const postGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1); postGeo.translate(0, 0.4, 0);
  const posts = new THREE.InstancedMesh(postGeo, railMat, Math.max(postM.length, 1));
  postM.forEach((p, k) => { m4.compose(v.set(p[0], p[1], p[2]), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p[3]), sc); posts.setMatrixAt(k, m4); });
  posts.count = postM.length;
  posts.castShadow = true;
  posts.computeBoundingSphere();

  const group = new THREE.Group();
  group.add(mesh, lamps, rail, posts);
  return {
    group,
    lampPositions,
    update(night) {
      glassMat.emissiveIntensity = night * 14;
    },
  };
}
