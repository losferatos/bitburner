// Mediterrane Vegetation: Pinien, Zypressen, Olivenbäume, Macchia-Büsche, Felsen.
// Zwei LOD-Stufen je Art: ein dynamischer Nahbereich (volle Geometrie, wirft Schatten) und ein statischer Fernbereich.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { simplex, rand } from './noise.js';
import { hookFog, U } from './atmosphere.js';
import { N, CELL, HALF, ROAD_HALF } from './world.js';

const tmpC = new THREE.Color();

function blob(radius, detail, sx, sy, sz, cx, cy, cz, color, seed, bump = 0.22) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const nrm = new Float32Array(p.count * 3);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const l = Math.hypot(x, y, z) || 1;
    const nx = x / l, ny = y / l, nz = z / l;
    const d = 1 + bump * simplex(nx * 2.1 + seed, ny * 2.1 + nz * 1.7 - seed) + bump * 0.45 * simplex(nx * 5.3 - seed, nz * 5.3 + ny * 4.1);
    x = nx * radius * d * sx; y = ny * radius * d * sy; z = nz * radius * d * sz;
    p.setXYZ(i, x + cx, y + cy, z + cz);
    // weiche, kugelige Normalen (wirkt wie Laubvolumen)
    const n = new THREE.Vector3(nx / sx, ny / sy, nz / sz).normalize();
    nrm.set([n.x, n.y, n.z], i * 3);
    const shade = 0.55 + 0.45 * (ny * 0.5 + 0.5);
    tmpC.copy(color).multiplyScalar(shade);
    col.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

function trunk(pts, r0, r1, sides, color) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const g = new THREE.TubeGeometry(curve, Math.max(2, pts.length * 2), 1, sides, false).toNonIndexed();
  const p = g.attributes.position, n = g.attributes.normal;
  const col = new Float32Array(p.count * 3);
  // Radius entlang der Höhe verjüngen
  const pp = new THREE.Vector3();
  const count = p.count;
  for (let i = 0; i < count; i++) {
    pp.set(p.getX(i), p.getY(i), p.getZ(i));
    // Punkt auf der Kurve finden (Normale zeigt vom Zentrum weg, Radius 1)
    const cx = pp.x - n.getX(i), cy = pp.y - n.getY(i), cz = pp.z - n.getZ(i);
    const t = Math.min(1, Math.max(0, (cy - pts[0][1]) / (pts[pts.length - 1][1] - pts[0][1])));
    const r = r0 + (r1 - r0) * t;
    p.setXYZ(i, cx + n.getX(i) * r, cy + n.getY(i) * r, cz + n.getZ(i) * r);
    col.set([color.r, color.g, color.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

function prism(h, r, sides, color, y0 = 0) {
  const g = new THREE.CylinderGeometry(r * 0.7, r, h, sides, 1, true).toNonIndexed();
  g.translate(0, y0 + h / 2, 0);
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set([color.r, color.g, color.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
}

const bark = new THREE.Color(0.13, 0.095, 0.075);
const barkGrey = new THREE.Color(0.2, 0.19, 0.17);

function makeSpecies() {
  const pineGreen = new THREE.Color(0.075, 0.13, 0.05);
  const cypGreen = new THREE.Color(0.045, 0.085, 0.035);
  const oliveGreen = new THREE.Color(0.17, 0.2, 0.12);
  const shrubGreen = new THREE.Color(0.09, 0.13, 0.055);
  const rockCol = new THREE.Color(0.42, 0.39, 0.35);

  // Pinie (Schirmkiefer): Stamm teilt sich, breite, unregelmäßige Schirmkrone aus vielen Nadelballen
  const pineHi = [
    trunk([[0, -0.4, 0], [0.15, 2.5, 0.05], [0.5, 5.2, 0.2], [1.0, 7.6, 0.4]], 0.34, 0.14, 7, bark),
    trunk([[0.45, 5.0, 0.18], [-0.4, 6.4, -0.3], [-1.3, 7.7, -0.6]], 0.16, 0.09, 5, bark),
    trunk([[0.5, 5.4, 0.2], [1.5, 6.6, -0.5], [2.2, 7.8, -1.1]], 0.14, 0.08, 5, bark),
  ];
  const pineParts = [];
  for (let k = 0; k < 11; k++) {
    const a = (k / 11) * Math.PI * 2 + rand() * 0.4;
    const rr = k === 0 ? 0 : 1.6 + rand() * 1.5;
    pineParts.push([0.4 + Math.cos(a) * rr, 8.3 + rand() * 0.9 - rr * 0.18, -0.2 + Math.sin(a) * rr, 1.25 + rand() * 0.6]);
  }
  pineParts.forEach(([x, y, z, r], k) => {
    const c = pineGreen.clone().multiplyScalar(0.85 + rand() * 0.35);
    pineHi.push(blob(r, 1, 1.3, 0.55, 1.3, x, y, z, c, k * 3.1, 0.3));
  });
  const pineLo = [prism(8.2, 0.3, 4, bark, -0.4), blob(3.6, 0, 1.3, 0.45, 1.3, 0.4, 8.4, -0.2, pineGreen, 1, 0.12)];

  // Zypresse
  const cypHi = [prism(1.6, 0.22, 6, bark, -0.3), blob(1.25, 2, 1.0, 5.2, 1.0, 0, 6.2, 0, cypGreen, 5, 0.12)];
  const cypLo = [blob(1.25, 0, 1.0, 5.2, 1.0, 0, 6.2, 0, cypGreen, 5, 0.05)];

  // Olivenbaum
  const oliveHi = [trunk([[0, -0.3, 0], [0.3, 1.2, -0.2], [0.1, 2.4, 0.2], [0.4, 3.2, 0.1]], 0.32, 0.18, 6, barkGrey)];
  [[0.4, 3.7, 0.1, 1.9], [-0.8, 3.3, 0.6, 1.4], [1.3, 3.2, -0.6, 1.4], [0.1, 4.4, -0.6, 1.3]].forEach(([x, y, z, r], k) =>
    oliveHi.push(blob(r, 1, 1.15, 0.8, 1.15, x, y, z, oliveGreen, 10 + k, 0.3)));
  const oliveLo = [prism(3, 0.3, 4, barkGrey, -0.3), blob(2.6, 0, 1.15, 0.75, 1.15, 0.3, 3.7, 0, oliveGreen, 11, 0.1)];

  // Busch
  const shrubHi = [blob(1.1, 1, 1.3, 0.75, 1.1, 0, 0.55, 0, shrubGreen, 20, 0.35), blob(0.8, 1, 1.2, 0.8, 1.2, 0.8, 0.45, 0.4, shrubGreen, 21, 0.35)];
  const shrubLo = [blob(1.4, 0, 1.3, 0.6, 1.1, 0.3, 0.5, 0.1, shrubGreen, 22, 0.1)];

  // Fels
  const rockHi = [blob(1.0, 2, 1.3, 0.75, 1.0, 0, 0.25, 0, rockCol, 30, 0.35)];
  const rockLo = [blob(1.0, 0, 1.3, 0.75, 1.0, 0, 0.25, 0, rockCol, 30, 0.2)];

  const m = (list) => mergeGeometries(list, false);
  return [
    { name: 'pine', hi: m(pineHi), lo: m(pineLo), leaf: 1, sway: 0.35, height: 10 },
    { name: 'cypress', hi: m(cypHi), lo: m(cypLo), leaf: 1, sway: 0.25, height: 12 },
    { name: 'olive', hi: m(oliveHi), lo: m(oliveLo), leaf: 1, sway: 0.25, height: 5 },
    { name: 'shrub', hi: m(shrubHi), lo: m(shrubLo), leaf: 1, sway: 0.08, height: 1.5 },
    { name: 'rock', hi: m(rockHi), lo: m(rockLo), leaf: 0, sway: 0, height: 1 },
  ];
}

function makeMaterial(sp, isLo, lod) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: sp.leaf ? 0.82 : 0.9, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uSunLight = U.uSunLight;
    shader.uniforms.uSunDir = U.uSunDir;
    shader.uniforms.uLod = lod;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec4 uLod; varying vec3 vVegW; varying float vLeaf;`)
      .replace('#include <begin_vertex>', /* glsl */ `
        vec3 transformed = vec3(position);
        vec3 iPos = vec3(instanceMatrix[3].x, instanceMatrix[3].y, instanceMatrix[3].z);
        float hgt = max(position.y, 0.0) / ${sp.height.toFixed(1)};
        float ph = iPos.x * 0.07 + iPos.z * 0.05;
        float gust = 0.6 + 0.4 * sin(uTime * 0.35 + iPos.x * 0.004);
        float sway = (sin(uTime * 1.25 + ph) * 0.7 + sin(uTime * 2.9 + ph * 1.9) * 0.3) * ${sp.sway.toFixed(2)} * gust * hgt * hgt;
        transformed.x += sway; transformed.z += sway * 0.6;
        vLeaf = step(0.4, position.y) * ${sp.leaf.toFixed(1)};
        // LOD-Übergabe: Fern-LOD blendet Instanzen im Nahbereich aus, Nah-LOD umgekehrt
        float dC = distance(iPos.xz, uLod.xy);
        ${isLo ? 'if (dC < uLod.z || dC > uLod.w) transformed = vec3(0.0);' : ''}
        vVegW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSunLight; uniform vec3 uSunDir; varying vec3 vVegW; varying float vLeaf;`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        {
          // Durchscheinendes Laub im Gegenlicht
          vec3 vd = normalize(vVegW - cameraPosition);
          float back = pow(max(dot(vd, uSunDir), 0.0), 6.0);
          float leafMask = vLeaf * step(vColor.r * 1.15, vColor.g);
          totalEmissiveRadiance += diffuseColor.rgb * vec3(0.9, 1.0, 0.55) * uSunLight * back * 0.32 * leafMask;
        }`);
  };
  mat.customProgramCacheKey = () => `veg-${sp.name}-${isLo ? 'lo' : 'hi'}`;
  hookFog(mat);
  return mat;
}

export function makeVegetation(world, quality, exclude = () => false) {
  const species = makeSpecies();
  const inst = species.map(() => []);
  const road = world.road;

  // Straßenbegleitende Zypressenalleen auf ausgewählten Abschnitten
  const allee = (s) => simplex(s * 0.0011, 3.3) > 0.35;
  for (let s = 0; s < road.length; s += 11) {
    if (!allee(s)) continue;
    const m = Math.floor(s / road.step) % road.M;
    const rx = -road.TZ[m], rz = road.TX[m];
    for (const side of [-1, 1]) {
      const o = side * (ROAD_HALF + 7 + rand() * 2);
      const x = road.X[m] + rx * o, z = road.Z[m] + rz * o;
      const h = world.heightAt(x, z);
      if (h < 2 || world.normalYAt(x, z) < 0.8 || exclude(x, z)) continue;
      inst[1].push([x, h - 0.2, z, rand() * 6.28, 0.85 + rand() * 0.35]);
    }
  }

  // Streuung über die Insel
  const step = 5.5;
  for (let z = -HALF + 4; z < HALF - 4; z += step) {
    for (let x = -HALF + 4; x < HALF - 4; x += step) {
      const px = x + (rand() - 0.5) * step * 0.9, pz = z + (rand() - 0.5) * step * 0.9;
      const h = world.heightAt(px, pz);
      if (h < 1.6) continue;
      const rd = world.roadDistAt(px, pz);
      if (rd < ROAD_HALF + 4.5 || exclude(px, pz)) continue;
      const ny = world.normalYAt(px, pz);
      const forest = simplex(px * 0.0024, pz * 0.0024) * 0.6 + simplex(px * 0.011, pz * 0.011) * 0.4;
      const alt = h / 400;
      const r = rand();
      if (ny < 0.8) {
        // Felsige Hänge: Felsbrocken und vereinzelte Büsche
        if (r < 0.05) inst[4].push([px, h - 0.3, pz, rand() * 6.28, 0.8 + rand() * 2.2]);
        else if (r < 0.07 && ny > 0.7) inst[3].push([px, h - 0.1, pz, rand() * 6.28, 0.7 + rand() * 0.6]);
        continue;
      }
      if (h < 4 && r < 0.012) { inst[4].push([px, h - 0.4, pz, rand() * 6.28, 1 + rand() * 2.5]); continue; }
      const dens = forest + 0.1 - alt * 0.9;
      if (dens > 0.18 && r < 0.42 * Math.min(1, (dens - 0.18) * 3.5)) {
        const t = rand();
        if (alt < 0.4 && t < 0.62) inst[0].push([px, h - 0.25, pz, rand() * 6.28, 0.75 + rand() * 0.5]);
        else if (t < 0.72) inst[1].push([px, h - 0.2, pz, rand() * 6.28, 0.7 + rand() * 0.45]);
        else inst[2].push([px, h - 0.2, pz, rand() * 6.28, 0.8 + rand() * 0.5]);
      } else if (r < 0.1 + Math.max(0, dens) * 0.2) {
        inst[3].push([px, h - 0.1, pz, rand() * 6.28, 0.6 + rand() * 0.9]);
      } else if (r > 0.995 && alt < 0.5) {
        inst[2].push([px, h - 0.2, pz, rand() * 6.28, 0.8 + rand() * 0.5]); // einzelne Olivenbäume auf Wiesen
      }
    }
  }

  const group = new THREE.Group();
  const lod = { value: new THREE.Vector4(0, 0, 230, 3200) };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s3 = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  const types = species.map((sp, k) => {
    const list = inst[k];
    const lo = new THREE.InstancedMesh(sp.lo, makeMaterial(sp, true, lod), Math.max(1, list.length));
    const tint = (i) => { const r = list[i][0] * 12.9898 + list[i][2] * 78.233; const f = (Math.sin(r) * 43758.5453) % 1; return 0.8 + Math.abs(f) * 0.4; };
    list.forEach((t, i) => {
      m4.compose(v.set(t[0], t[1], t[2]), q.setFromAxisAngle(up, t[3]), s3.setScalar(t[4]));
      lo.setMatrixAt(i, m4);
      const g = tint(i); col.setRGB(g, g * (0.95 + 0.1 * Math.abs(Math.sin(i))), g * 0.95);
      lo.setColorAt(i, col);
    });
    lo.count = list.length;
    lo.frustumCulled = false;
    lo.receiveShadow = true;
    const maxHi = Math.min(list.length, quality.treesNear);
    const hi = new THREE.InstancedMesh(sp.hi, makeMaterial(sp, false, lod), Math.max(1, maxHi));
    hi.count = 0;
    hi.frustumCulled = false;
    hi.castShadow = true;
    hi.receiveShadow = true;
    hi.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, maxHi) * 3), 3);
    group.add(lo, hi);
    return { sp, list, lo, hi, maxHi, tint };
  });

  // Gitter-Buckets für die schnelle Nahbereichsauswahl
  const BUCK = 64, NB = Math.ceil((HALF * 2) / BUCK);
  for (const t of types) {
    t.buckets = Array.from({ length: NB * NB }, () => []);
    t.list.forEach((p, i) => {
      const bi = Math.min(NB - 1, Math.max(0, Math.floor((p[0] + HALF) / BUCK)));
      const bj = Math.min(NB - 1, Math.max(0, Math.floor((p[2] + HALF) / BUCK)));
      t.buckets[bj * NB + bi].push(i);
    });
  }

  const last = new THREE.Vector2(1e9, 1e9);
  function update(camera) {
    const cx = camera.position.x, cz = camera.position.z;
    if (Math.hypot(cx - last.x, cz - last.y) < 12) return;
    last.set(cx, cz);
    const R = lod.value.z;
    lod.value.x = cx; lod.value.y = cz;
    const b0i = Math.floor((cx - R + HALF) / BUCK), b1i = Math.floor((cx + R + HALF) / BUCK);
    const b0j = Math.floor((cz - R + HALF) / BUCK), b1j = Math.floor((cz + R + HALF) / BUCK);
    for (const t of types) {
      let n = 0;
      const arr = t.hi.instanceMatrix.array, carr = t.hi.instanceColor.array, lm = t.lo.instanceMatrix.array, lc = t.lo.instanceColor.array;
      for (let bj = Math.max(0, b0j); bj <= Math.min(NB - 1, b1j); bj++) {
        for (let bi = Math.max(0, b0i); bi <= Math.min(NB - 1, b1i); bi++) {
          for (const i of t.buckets[bj * NB + bi]) {
            const p = t.list[i];
            if ((p[0] - cx) ** 2 + (p[2] - cz) ** 2 >= R * R) continue;
            if (n >= t.maxHi) break;
            for (let k = 0; k < 16; k++) arr[n * 16 + k] = lm[i * 16 + k];
            carr[n * 3] = lc[i * 3]; carr[n * 3 + 1] = lc[i * 3 + 1]; carr[n * 3 + 2] = lc[i * 3 + 2];
            n++;
          }
        }
      }
      t.hi.count = n;
      t.hi.instanceMatrix.needsUpdate = true;
      t.hi.instanceColor.needsUpdate = true;
    }
  }
  // Höchster Baumwipfel in der Nähe eines Punktes (für die Kamera)
  const canopyR = [4.2, 1.5, 2.8, 1.6, 1.4];
  function obstacleTop(x, z, pad = 1.0) {
    let top = -1e9;
    const bi0 = Math.floor((x - 8 + HALF) / BUCK), bi1 = Math.floor((x + 8 + HALF) / BUCK);
    const bj0 = Math.floor((z - 8 + HALF) / BUCK), bj1 = Math.floor((z + 8 + HALF) / BUCK);
    types.forEach((t, k) => {
      for (let bj = Math.max(0, bj0); bj <= Math.min(NB - 1, bj1); bj++) for (let bi = Math.max(0, bi0); bi <= Math.min(NB - 1, bi1); bi++) {
        for (const i of t.buckets[bj * NB + bi]) {
          const p = t.list[i];
          const r = canopyR[k] * p[4] + pad;
          if ((p[0] - x) ** 2 + (p[2] - z) ** 2 < r * r) top = Math.max(top, p[1] + t.sp.height * p[4] * 1.1);
        }
      }
    });
    return top;
  }
  const counts = types.map((t) => `${t.sp.name}:${t.list.length}`).join(' ');
  return { group, update, counts, lod, obstacleTop };
}
