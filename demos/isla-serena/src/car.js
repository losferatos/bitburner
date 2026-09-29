// Sportwagen: Modell laden, Materialien, Räder, Fahrwerk, Scheinwerfer, Fahrlogik entlang der Straße.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import carGlb from '../assets/ferrari.glb';
import aoPng from '../assets/ferrari_ao.png';
import { roadFrame } from './road.js';
import { hookFog } from './atmosphere.js';

export const PAINTS = [
  { name: 'Rosso Corsa', color: 0xa50c0c },
  { name: 'Blu Tour de France', color: 0x0d2a6e },
  { name: 'Giallo Modena', color: 0xe8b40c },
  { name: 'Nero Daytona', color: 0x0b0b0d },
  { name: 'Bianco Avus', color: 0xd8d8d4 },
  { name: 'Verde British', color: 0x0f3322 },
];

export async function loadCar() {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const buf = carGlb.buffer.slice(carGlb.byteOffset, carGlb.byteOffset + carGlb.byteLength);
  const gltf = await loader.parseAsync(buf, '');
  const model = gltf.scene.children[0];

  const bodyMat = new THREE.MeshPhysicalMaterial({ color: PAINTS[0].color, metalness: 0.55, roughness: 0.3, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 1.2 });
  const detailsMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 1.0, roughness: 0.28 });
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0c0f, metalness: 0.1, roughness: 0.02, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.5 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 0.0, roughness: 0.1, metalness: 0.3 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff1a0a, emissiveIntensity: 0.4, roughness: 0.2 });

  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const n = o.name;
    if (n === 'body') o.material = bodyMat;
    else if (/^rim_|trim$|^trim/.test(n)) o.material = detailsMat;
    else if (n === 'glass') o.material = glassMat;
    else if (n === 'lights') o.material = headMat;
    else if (n === 'lights_red' || n === 'leds') o.material = tailMat;
    if (n === 'glass') o.castShadow = false;
    hookFog(o.material);
  });

  const wheels = ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].map((n) => {
    const w = model.getObjectByName(n);
    w.rotation.order = 'YXZ';
    return w;
  });

  // Kontaktschatten (AO) unter dem Auto
  const aoTex = new THREE.TextureLoader().load(aoPng);
  aoTex.colorSpace = THREE.NoColorSpace;
  const ao = new THREE.Mesh(
    new THREE.PlaneGeometry(0.655 * 4, 1.3 * 4),
    new THREE.MeshBasicMaterial({ map: aoTex, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, premultipliedAlpha: true, depthWrite: false })
  );
  ao.rotation.x = -Math.PI / 2;
  ao.position.y = 0.015;
  ao.renderOrder = 2;

  // Aufbau: root (Straßenlage) -> body (Wanken/Nicken) -> model
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body, ao);
  body.add(model);

  // Unterkante auf 0 bringen
  const bb = new THREE.Box3().setFromObject(model);
  model.position.y -= bb.min.y;

  // Scheinwerfer
  const heads = [];
  for (const side of [-1, 1]) {
    const l = new THREE.SpotLight(0xfff1dc, 0, 140, 0.38, 0.6, 1.5);
    l.position.set(side * 0.62, 0.72, -1.95);
    l.target.position.set(side * 1.2, 0.0, -30);
    body.add(l, l.target);
    heads.push(l);
  }
  // Leuchtkegel (volumetrischer Eindruck, additiv)
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uI: { value: 0 } },
    vertexShader: /* glsl */ `varying float vL; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ vL = -position.y / 26.0; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `uniform float uI; varying float vL; varying vec3 vN; varying vec3 vV; varying float vD;
      void main(){ float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float a = (1.0 - smoothstep(0.0, 1.0, vL)) * smoothstep(0.0, 0.04, vL) * edge * uI * smoothstep(2.0, 9.0, vD);
        gl_FragColor = vec4(vec3(1.0, 0.94, 0.82) * a * 0.09, 1.0); }`,
  });
  const beamGeo = new THREE.ConeGeometry(4.6, 26, 24, 1, true);
  beamGeo.translate(0, -13, 0);
  for (const side of [-1, 1]) {
    const b = new THREE.Mesh(beamGeo, beamMat);
    b.position.set(side * 0.62, 0.72, -2.0);
    b.rotation.x = -Math.PI / 2 + 0.04;
    b.frustumCulled = false;
    b.renderOrder = 5;
    body.add(b);
  }

  return { root, body, model, wheels, bodyMat, detailsMat, glassMat, headMat, tailMat, heads, beamMat, beamGeo, ao, aoMat: ao.material };
}

// Fahrdynamik: Geschwindigkeit nach Kurvenkrümmung, Lenkung, Wanken, Federung, Gänge für den Sound
export class Driver {
  constructor(car, road, heightAt) {
    this.car = car;
    this.road = road;
    this.heightAt = heightAt;
    this.s = 120;
    this.v = 24;
    this.lane = 2.25;
    this.roll = 0; this.pitch = 0; this.steer = 0; this.spin = 0;
    this.accel = 0;
    this.gear = 3; this.rpm = 3000; this.throttle = 0.5;
    this.fr = {}; this.frA = {}; this.frB = {};
    this.pos = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.speedScale = 1;
  }

  targetSpeed() {
    // Vorausschau: engste Kurve in den nächsten 90 m
    let kMax = 0;
    for (let d = 0; d <= 110; d += 10) {
      roadFrame(this.road, this.s + d + this.v * 0.6, this.frA);
      kMax = Math.max(kMax, Math.abs(this.frA.k));
    }
    const vCurve = Math.sqrt(6.5 / Math.max(kMax, 1e-4));
    return Math.min(46, Math.max(15, vCurve)) * this.speedScale;
  }

  update(dt) {
    const vt = this.targetSpeed();
    const a = vt > this.v ? Math.min(4.2, (vt - this.v) * 0.9) : Math.max(-8.5, (vt - this.v) * 1.6);
    this.accel += (a - this.accel) * Math.min(1, dt * 3);
    this.v = Math.max(0, this.v + this.accel * dt);
    this.s = (this.s + this.v * dt) % this.road.length;
    this.throttle = THREE.MathUtils.clamp(0.35 + this.accel * 0.2, 0, 1);

    const f = roadFrame(this.road, this.s, this.fr);
    const rx = -f.tz, rz = f.tx;
    const x = f.x + rx * this.lane, z = f.z + rz * this.lane;
    const y = f.y + this.lane * f.bank + 0.06 + 0.03;
    this.pos.set(x, y, z);
    // Blickrichtung aus Punkt voraus (glatter)
    const g = roadFrame(this.road, this.s + 2.5, this.frB);
    const ax = g.x + -g.tz * this.lane, az = g.z + g.tx * this.lane;
    const ay = g.y + this.lane * g.bank + 0.09;
    this.fwd.set(ax - x, ay - y, az - z).normalize();

    const root = this.car.root;
    root.position.copy(this.pos);
    const back = this.fwd.clone().negate();
    const up0 = new THREE.Vector3(-f.bank * rx, 1, -f.bank * rz).normalize();
    const right = new THREE.Vector3().crossVectors(up0, back).normalize();
    const up = new THREE.Vector3().crossVectors(back, right).normalize();
    root.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, back));

    // Wanken aus Querbeschleunigung, Nicken aus Längsbeschleunigung
    const latA = this.v * this.v * f.k;
    this.roll += (THREE.MathUtils.clamp(-latA * 0.0065, -0.045, 0.045) - this.roll) * Math.min(1, dt * 4);
    this.pitch += (THREE.MathUtils.clamp(this.accel * 0.0035, -0.03, 0.02) - this.pitch) * Math.min(1, dt * 4);
    const t = performance.now() * 0.001;
    const bump = Math.sin(t * 13.1) * 0.002 + Math.sin(t * 7.3 + 1) * 0.0025;
    this.car.body.rotation.set(this.pitch, 0, this.roll);
    this.car.body.position.y = bump * (this.v / 30);

    // Lenkung + Raddrehung
    this.steer += (Math.atan(f.k * 2.66) * 1.4 - this.steer) * Math.min(1, dt * 6);
    this.spin -= (this.v * dt) / 0.34;
    const w = this.car.wheels;
    for (let i = 0; i < 4; i++) {
      w[i].rotation.x = this.spin;
      w[i].rotation.y = i < 2 ? this.steer : 0;
    }

    // Gänge / Drehzahl (für den Motorsound)
    const ratios = [0, 3.2, 2.3, 1.75, 1.4, 1.15, 0.95, 0.8];
    const rpmFor = (gr) => 900 + this.v * ratios[gr] * 92;
    if (rpmFor(this.gear) > 7000 && this.gear < 7) this.gear++;
    else if (this.gear > 1 && rpmFor(this.gear - 1) < (this.accel > 1.0 ? 5600 : 3900)) this.gear--;
    this.rpm += (rpmFor(this.gear) - this.rpm) * Math.min(1, dt * 8);
  }
}
