// Belebung: Gegenverkehr (zusammengefasste Kopien des Autos) und Segelboote vor der Küste.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { roadFrame } from './road.js';
import { hookFog, U } from './atmosphere.js';
import { rand } from './noise.js';

const TRAFFIC_PAINTS = [0x1d2f4a, 0xc9c6bd, 0x2b2b2e, 0x6b1a14, 0x355238];

// Alle Teilnetze des Modells je Material zu einer Geometrie verschmelzen (wenige Drawcalls pro Kopie)
function bakeCar(car) {
  car.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(car.body.matrixWorld).invert();
  const groups = new Map();
  car.model.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry;
    const pos = src.attributes.position, nrm = src.attributes.normal;
    const g = new THREE.BufferGeometry();
    const P = new Float32Array(pos.count * 3), Nn = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      P[i * 3] = pos.getX(i); P[i * 3 + 1] = pos.getY(i); P[i * 3 + 2] = pos.getZ(i);
      if (nrm) { Nn[i * 3] = nrm.getX(i); Nn[i * 3 + 1] = nrm.getY(i); Nn[i * 3 + 2] = nrm.getZ(i); }
    }
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3));
    if (src.index) g.setIndex(Array.from(src.index.array));
    else g.setIndex([...Array(pos.count).keys()]);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!nrm) g.computeVertexNormals();
    const m = o.material;
    if (!groups.has(m)) groups.set(m, []);
    groups.get(m).push(g);
  });
  return [...groups.entries()].map(([mat, list]) => ({ mat, geo: mergeGeometries(list, false) }));
}

export function makeTraffic(car, road, count = 3) {
  const baked = bakeCar(car);
  const group = new THREE.Group();
  const cars = [];
  for (let k = 0; k < count; k++) {
    const root = new THREE.Group();
    const paint = car.bodyMat.clone();
    paint.color.setHex(TRAFFIC_PAINTS[k % TRAFFIC_PAINTS.length]);
    hookFog(paint);
    for (const { mat, geo } of baked) {
      const m = new THREE.Mesh(geo, mat === car.bodyMat ? paint : mat);
      m.castShadow = true; m.receiveShadow = true;
      root.add(m);
    }
    for (const side of [-1, 1]) {
      const b = new THREE.Mesh(car.beamGeo, car.beamMat);
      b.position.set(side * 0.62, 0.72, -2.0);
      b.rotation.x = -Math.PI / 2 + 0.04;
      b.frustumCulled = false;
      b.renderOrder = 5;
      root.add(b);
    }
    const ao = new THREE.Mesh(car.ao.geometry, car.aoMat);
    ao.rotation.x = -Math.PI / 2; ao.position.y = 0.015; ao.renderOrder = 2;
    root.add(ao);
    group.add(root);
    cars.push({ root, s: road.length * ((k + 0.35) / count), v: 22 + rand() * 5, vmax: 23 + rand() * 6, fr: {}, fb: {} });
  }
  const lane = -2.25;
  const basis = new THREE.Matrix4(), fwd = new THREE.Vector3(), up = new THREE.Vector3(), right = new THREE.Vector3(), back = new THREE.Vector3();
  return {
    group,
    cars,
    update(dt) {
      for (const c of cars) {
        // Kurvenvorausschau in Fahrtrichtung (abnehmende Bogenlänge)
        let kMax = 0;
        for (let d = 0; d <= 90; d += 15) kMax = Math.max(kMax, Math.abs(roadFrame(road, c.s - d, c.fb).k));
        const vt = Math.min(c.vmax, Math.max(12, Math.sqrt(5.5 / Math.max(kMax, 1e-4))));
        c.v += (vt - c.v) * Math.min(1, dt * 0.8);
        c.s = (c.s - c.v * dt + road.length) % road.length;
        const f = roadFrame(road, c.s, c.fr);
        const rx = -f.tz, rz = f.tx;
        const x = f.x + rx * lane, z = f.z + rz * lane, y = f.y + lane * f.bank + 0.09;
        const g = roadFrame(road, c.s - 2.5, c.fb);
        fwd.set(g.x + -g.tz * lane - x, g.y + lane * g.bank + 0.09 - y, g.z + g.tx * lane - z).normalize();
        back.copy(fwd).negate();
        up.set(-f.bank * rx, 1, -f.bank * rz).normalize();
        right.crossVectors(up, back).normalize();
        up.crossVectors(back, right).normalize();
        c.root.position.set(x, y, z);
        c.root.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, back));
      }
    },
  };
}

// Segelboote: schaukeln auf den Wellen, driften langsam; nachts mit Topplicht
export function makeBoats(world, count = 5) {
  const road = world.road;
  const group = new THREE.Group();
  const hullGeo = (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, -4.2); shape.quadraticCurveTo(1.35, -1.5, 1.2, 3.4); shape.lineTo(-1.2, 3.4); shape.quadraticCurveTo(-1.35, -1.5, 0, -4.2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.2, bevelSegments: 2 });
    g.rotateX(Math.PI / 2); g.translate(0, 0.6, 0);
    return g;
  })();
  const hullMat = hookFog(new THREE.MeshStandardMaterial({ color: 0xe9e6de, roughness: 0.45 }));
  const deckMat = hookFog(new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.7 }));
  const sailMat = hookFog(new THREE.MeshStandardMaterial({ color: 0xf2eee4, roughness: 0.8, side: THREE.DoubleSide }));
  const mastMat = hookFog(new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.8, roughness: 0.3 }));
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2d8 });
  const mast = new THREE.CylinderGeometry(0.06, 0.08, 11, 6); mast.translate(0, 6.5, -0.4);
  const main = new THREE.BufferGeometry();
  main.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.6, -0.3, 0, 11.6, -0.35, 0, 1.6, 3.2], 3));
  main.computeVertexNormals();
  const jib = new THREE.BufferGeometry();
  jib.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.4, -0.6, 0, 10.5, -0.5, 0, 1.3, -4.0], 3));
  jib.computeVertexNormals();
  const deck = new THREE.BoxGeometry(1.6, 0.2, 5.5); deck.translate(0, 1.05, 0.2);
  const cabin = new THREE.BoxGeometry(1.2, 0.55, 2.0); cabin.translate(0, 1.4, 0.6);

  // Plätze vor der Küste, von der Straße aus sichtbar
  const spots = [];
  const fr = {};
  for (let tries = 0; tries < 400 && spots.length < count; tries++) {
    const s = rand() * road.length;
    roadFrame(road, s, fr);
    const len = Math.hypot(fr.x, fr.z);
    const ox = fr.x / len, oz = fr.z / len;
    const d = 260 + rand() * 420;
    const x = fr.x + ox * d, z = fr.z + oz * d;
    if (world.heightAt(x, z) > -8) continue;
    if (spots.some((p) => Math.hypot(p.x - x, p.z - z) < 500)) continue;
    spots.push({ x, z, a: rand() * 6.28, ph: rand() * 10 });
  }
  const boats = spots.map((sp) => {
    const b = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, hullMat);
    const dk = new THREE.Mesh(deck, deckMat), cb = new THREE.Mesh(cabin, hullMat);
    const ms = new THREE.Mesh(mast, mastMat);
    const sails = new THREE.Group();
    sails.add(new THREE.Mesh(main, sailMat), new THREE.Mesh(jib, sailMat));
    sails.rotation.y = 0.35;
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), lightMat); top.position.set(0, 12.05, -0.4);
    b.add(hull, dk, cb, ms, sails, top);
    b.traverse((o) => { if (o.isMesh && o !== top) { o.castShadow = false; o.receiveShadow = true; } });
    b.userData = { ...sp, top };
    group.add(b);
    return b;
  });

  return {
    group,
    update(time, night) {
      for (const b of boats) {
        const d = b.userData;
        const t = time + d.ph;
        const drift = Math.sin(t * 0.004) * 160;
        b.position.set(d.x + Math.cos(d.a) * drift, Math.sin(t * 0.9) * 0.25 + Math.sin(t * 1.7 + 1) * 0.12 - 0.35, d.z + Math.sin(d.a) * drift);
        b.rotation.set(Math.sin(t * 0.8) * 0.04, -d.a + Math.PI / 2, Math.sin(t * 0.6 + 2) * 0.08 + 0.12);
        d.top.visible = night > 0.2;
        d.top.scale.setScalar(1 + night * 1.5);
      }
    },
  };
}
