// Orte an der Straße: weiße Küstendörfer (nachts beleuchtete Fenster), Leuchtturm mit Lichtkegel, Möwen.
import * as THREE from 'three';
import { rand } from './noise.js';
import { hookFog, U } from './atmosphere.js';
import { ROAD_HALF, HALF } from './world.js';
import { roadFrame } from './road.js';

// ---------- Planung (vor der Vegetation, damit dort keine Bäume stehen) ----------
export function planLandmarks(world) {
  const road = world.road;
  const fr = {};
  // Kandidaten für Dörfer: flaches, bewohnbares Gelände neben der Straße
  const scores = [];
  for (let s = 0; s < road.length; s += 40) {
    roadFrame(road, s, fr);
    let good = 0;
    for (const side of [-1, 1]) for (let o = 16; o <= 70; o += 9) for (let a = -60; a <= 60; a += 30) {
      const x = fr.x - fr.tz * side * o + fr.tx * a, z = fr.z + fr.tx * side * o + fr.tz * a;
      const h = world.heightAt(x, z);
      if (h > 3.5 && h < 90 && world.normalYAt(x, z) > 0.94) good++;
    }
    scores.push([s, good]);
  }
  scores.sort((a, b) => b[1] - a[1]);
  const villages = [];
  for (const [s] of scores) {
    const dist = (a, b) => Math.min(Math.abs(a - b), road.length - Math.abs(a - b));
    if (villages.every((v) => dist(v, s) > road.length * 0.28)) villages.push(s);
    if (villages.length >= 2) break;
  }

  const houses = [];
  for (const s0 of villages) {
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 70; tries++) {
      const s = s0 + (rand() - 0.5) * 300;
      roadFrame(road, s, fr);
      const side = rand() < 0.5 ? -1 : 1;
      const o = side * (ROAD_HALF + 9 + Math.pow(rand(), 1.4) * 75);
      const x = fr.x - fr.tz * o, z = fr.z + fr.tx * o;
      const h = world.heightAt(x, z);
      if (h < 3 || world.normalYAt(x, z) < 0.9) continue;
      if (world.roadDistAt(x, z) < ROAD_HALF + 7.5) continue;
      const w = 5.5 + rand() * 4, d = 5 + rand() * 3;
      if (houses.some((q) => (q.x - x) ** 2 + (q.z - z) ** 2 < ((q.w + w) * 0.62) ** 2 + 16)) continue;
      const floors = rand() < 0.45 ? 2 : 1;
      // Ausrichtung: zur Straße, leicht variiert
      const rot = Math.atan2(fr.tx, fr.tz) + (rand() < 0.5 ? 0 : Math.PI / 2) + (rand() - 0.5) * 0.25;
      // Fundament auf den tiefsten Eckpunkt
      let hmin = h;
      for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) hmin = Math.min(hmin, world.heightAt(x + cx * w * 0.5, z + cz * d * 0.5));
      houses.push({ x, y: hmin - 0.4, z, w, d, h: floors * 3.1 + 0.6, rot, flat: rand() < 0.35, tint: rand() });
      placed++;
    }
  }

  // Leuchtturm: exponiertester Küstenpunkt in Straßennähe
  let best = null;
  for (let a = 0; a < Math.PI * 2; a += 0.02) {
    const ca = Math.cos(a), sa = Math.sin(a);
    let lastLand = null;
    for (let r = 1100; r < 2000; r += 6) {
      const h = world.heightAt(ca * r, sa * r);
      if (h > 5) lastLand = [ca * r, h, sa * r, r];
    }
    if (!lastLand) continue;
    const [x, h, z] = lastLand;
    const rd = world.roadDistAt(x, z);
    if (rd > 400 || rd < 30) continue;
    const score = h * 0.7 - rd * 0.05;
    if (!best || score > best.score) best = { x: x - Math.cos(a) * 14, z: z - Math.sin(a) * 14, score, a };
  }
  if (best) best.y = world.heightAt(best.x, best.z);

  const exclude = (x, z) => {
    for (const q of houses) if ((q.x - x) ** 2 + (q.z - z) ** 2 < (q.w + 3.5) ** 2) return true;
    if (best && (best.x - x) ** 2 + (best.z - z) ** 2 < 22 * 22) return true;
    return false;
  };
  return { villages, houses, lighthouse: best, exclude };
}

// ---------- Aufbau ----------
export function makeLandmarks(world, plan) {
  const group = new THREE.Group();
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Häuser: Einheitswürfel, Fassaden per Shader (Fenster, Fensterläden, nachts Licht)
  const H = plan.houses;
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  wallMat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = U.uNight;
    shader.uniforms.uNoise = U.uNoise;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHouse; varying vec3 vHouseN; varying float vHouseId;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        vec3 hs = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vHouse = position * hs;
        vHouseN = normal;
        vHouseId = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.11;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uNight; uniform sampler2D uNoise;
        varying vec3 vHouse; varying vec3 vHouseN; varying float vHouseId;
        float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace('#include <map_fragment>', /* glsl */ `
        float u = abs(vHouseN.x) > 0.5 ? vHouse.z : vHouse.x;
        float vy = vHouse.y;
        float side = abs(vHouseN.y) > 0.5 ? 0.0 : 1.0;
        vec2 cell = vec2(floor(u / 2.4 + 0.5), floor(vy / 3.1));
        vec2 f = vec2(u / 2.4 + 0.5 - cell.x, vy / 3.1 - cell.y);
        float win = side * step(0.3, f.x) * step(f.x, 0.7) * step(0.3, f.y) * step(f.y, 0.78) * step(0.6, vy);
        float shut = side * (step(0.16, f.x) * step(f.x, 0.3) + step(0.7, f.x) * step(f.x, 0.84)) * step(0.3, f.y) * step(f.y, 0.78) * step(0.6, vy);
        float grime = texture(uNoise, vHouse.xy * 0.2 + vHouseId).r;
        vec3 wall = diffuseColor.rgb * (0.86 + 0.14 * grime) * mix(0.82, 1.0, smoothstep(0.0, 1.2, vy));
        vec3 shutCol = mix(vec3(0.09, 0.22, 0.2), vec3(0.08, 0.15, 0.3), step(0.5, hh(vec2(vHouseId, 3.0))));
        vec3 col = mix(wall, shutCol, shut);
        col = mix(col, vec3(0.03, 0.035, 0.04), win);
        diffuseColor.rgb = col;
        float lit = win * step(0.42, hh(cell + vHouseId * 7.0 + vHouseN.xz * 13.0));`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
        totalEmissiveRadiance += vec3(1.0, 0.62, 0.3) * lit * uNight * 3.2;`);
  };
  wallMat.customProgramCacheKey = () => 'house';
  hookFog(wallMat);
  const walls = new THREE.InstancedMesh(boxGeo, wallMat, Math.max(1, H.length));

  // Dächer: Walmdach (Terrakotta) oder flach mit Brüstung
  const roofGeo = new THREE.ConeGeometry(0.72, 1, 4, 1);
  roofGeo.rotateY(Math.PI / 4);
  roofGeo.translate(0, 0.5, 0);
  const roofMat = hookFog(new THREE.MeshStandardMaterial({ color: 0xa4502e, roughness: 0.85 }));
  const roofs = new THREE.InstancedMesh(roofGeo, roofMat, Math.max(1, H.length));
  const col = new THREE.Color();
  let nr = 0;
  H.forEach((h, i) => {
    q.setFromAxisAngle(up, h.rot);
    m4.compose(v.set(h.x, h.y, h.z), q, sc.set(h.w, h.h, h.d));
    walls.setMatrixAt(i, m4);
    const t = h.tint;
    col.setRGB(0.86, 0.84, 0.8);
    if (t > 0.7) col.setRGB(0.9, 0.8, 0.62); else if (t > 0.55) col.setRGB(0.93, 0.86, 0.78); else if (t < 0.08) col.setRGB(0.8, 0.84, 0.88);
    walls.setColorAt(i, col);
    if (!h.flat) {
      m4.compose(v.set(h.x, h.y + h.h, h.z), q, sc.set(h.w * 1.02, 1.6 + h.w * 0.08, h.d * 1.02));
      roofs.setMatrixAt(nr++, m4);
    }
  });
  walls.count = H.length; roofs.count = nr;
  for (const im of [walls, roofs]) { im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); group.add(im); }

  // Leuchtturm
  const lh = plan.lighthouse;
  let beam = null, lamp = null;
  if (lh) {
    const tower = new THREE.Group();
    const prof = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(2.3 - t * 0.8, t * 21)); }
    const lathe = new THREE.LatheGeometry(prof, 20).toNonIndexed();
    const lc = new Float32Array(lathe.attributes.position.count * 3);
    for (let i = 0; i < lathe.attributes.position.count; i++) {
      const y = lathe.attributes.position.getY(i);
      const red = Math.floor(y / 3.5) % 2 === 1;
      lc.set(red ? [0.55, 0.06, 0.05] : [0.85, 0.84, 0.8], i * 3);
    }
    lathe.setAttribute('color', new THREE.BufferAttribute(lc, 3));
    const towerMat = hookFog(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
    const t = new THREE.Mesh(lathe, towerMat);
    const metal = hookFog(new THREE.MeshStandardMaterial({ color: 0x1c1f22, roughness: 0.4, metalness: 0.8 }));
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.3, 20), metal); gallery.position.y = 21.1;
    const glassMat = hookFog(new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff0c8, emissiveIntensity: 0.2, roughness: 0.1 }));
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 12), glassMat); lantern.position.y = 22.4;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), metal); dome.position.y = 23.5;
    const house = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 5), hookFog(new THREE.MeshStandardMaterial({ color: 0xe6e0d4, roughness: 0.9 })));
    house.position.set(4.5, 1.7, 0);
    tower.add(t, gallery, lantern, dome, house);
    tower.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    tower.position.set(lh.x, lh.y - 0.5, lh.z);
    group.add(tower);

    // rotierender Lichtkegel (zwei Strahlen)
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uI: { value: 0 } },
      vertexShader: /* glsl */ `varying float vL; varying vec3 vN; varying vec3 vV;
        void main(){ vL = -position.y / 700.0; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform float uI; varying float vL; varying vec3 vN; varying vec3 vV;
        void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 4.0);
          float a = exp(-vL * 4.5) * smoothstep(0.0, 0.02, vL) * edge * uI;
          gl_FragColor = vec4(vec3(1.0, 0.93, 0.78) * a * 0.045, 1.0); }`,
    });
    const cone = new THREE.ConeGeometry(26, 700, 32, 1, true);
    cone.translate(0, -350, 0);
    beam = new THREE.Group();
    for (const dir of [1, -1]) {
      const b = new THREE.Mesh(cone, beamMat);
      b.rotation.z = dir * Math.PI / 2 - dir * 0.03;
      b.frustumCulled = false;
      beam.add(b);
    }
    beam.position.set(lh.x, lh.y - 0.5 + 22.4, lh.z);
    beam.renderOrder = 6;
    group.add(beam);
    const spriteMat = new THREE.SpriteMaterial({ color: 0xfff0d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const g = cv.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,240,200,0.5)'); grd.addColorStop(1, 'rgba(255,220,160,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    spriteMat.map = new THREE.CanvasTexture(cv);
    lamp = new THREE.Sprite(spriteMat);
    lamp.scale.setScalar(9);
    lamp.position.copy(beam.position);
    group.add(lamp);
    beam.userData = { beamMat, glassMat, spriteMat };
  }

  // Möwen: kleine Schwärme über der Küste
  const gullGeo = new THREE.BufferGeometry();
  gullGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.35, 0, 0, 0.3, 0, 0.05, 0.05, // Körper
    0, 0.02, -0.1, 0, 0.02, 0.12, -0.8, 0.0, 0.0, // linker Flügel
    0, 0.02, 0.12, 0, 0.02, -0.1, 0.8, 0.0, 0.0, // rechter Flügel
  ], 3));
  gullGeo.computeVertexNormals();
  const gullMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.8, side: THREE.DoubleSide });
  gullMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        float ph = instanceMatrix[3].x * 0.3 + instanceMatrix[3].z * 0.17;
        float flap = sin(uTime * 7.0 + ph) * 0.55 + 0.15;
        transformed.y += abs(transformed.x) * flap;
        transformed.x *= 1.0 - abs(flap) * 0.15;`);
  };
  hookFog(gullMat);
  const flocks = [];
  const fr = {};
  for (let k = 0; k < 4; k++) {
    // entlang der Küste verteilte Kreiszentren
    const s = (k / 4) * world.road.length + 300;
    roadFrame(world.road, s, fr);
    const len = Math.hypot(fr.x, fr.z);
    flocks.push({ cx: fr.x + (fr.x / len) * 90, cz: fr.z + (fr.z / len) * 90, y: Math.max(fr.y, 5) + 22 });
  }
  if (lh) flocks.push({ cx: lh.x, cz: lh.z, y: lh.y + 34 });
  const GN = flocks.length * 7;
  const gulls = new THREE.InstancedMesh(gullGeo, gullMat, GN);
  gulls.frustumCulled = false;
  const gdata = [];
  for (let i = 0; i < GN; i++) gdata.push({ f: flocks[i % flocks.length], r: 12 + rand() * 30, w: (0.25 + rand() * 0.25) * (rand() < 0.5 ? -1 : 1), a: rand() * 6.28, h: rand() * 12, s: 0.9 + rand() * 0.4 });
  group.add(gulls);

  return {
    group,
    update(time, night) {
      if (beam) {
        beam.rotation.y = time * 0.7;
        beam.userData.beamMat.uniforms.uI.value = night;
        beam.userData.glassMat.emissiveIntensity = 0.3 + night * 30;
        beam.userData.spriteMat.opacity = night;
        lamp.visible = night > 0.02;
        beam.visible = night > 0.02;
      }
      for (let i = 0; i < GN; i++) {
        const g = gdata[i];
        const a = g.a + time * g.w;
        const x = g.f.cx + Math.cos(a) * g.r, z = g.f.cz + Math.sin(a) * g.r;
        const y = g.f.y + g.h + Math.sin(time * 0.3 + i) * 3;
        const heading = a + (g.w > 0 ? Math.PI / 2 : -Math.PI / 2);
        q.setFromEuler(new THREE.Euler(0, -heading + Math.PI / 2, (g.w > 0 ? -0.35 : 0.35), 'YXZ'));
        m4.compose(v.set(x, y, z), q, sc.setScalar(g.s));
        gulls.setMatrixAt(i, m4);
      }
      gulls.instanceMatrix.needsUpdate = true;
    },
  };
}
