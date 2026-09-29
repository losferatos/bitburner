// Kameraregie: automatischer Schnitt zwischen Einstellungen, manuelle Orbit-Kamera per Maus.
import * as THREE from 'three';
import { roadFrame } from './road.js';

const v3 = () => new THREE.Vector3();

export class Director {
  constructor(camera, driver, world, dom) {
    this.camera = camera;
    this.driver = driver;
    this.world = world;
    this.auto = true;
    this.shotTime = 0;
    this.shotLen = 9;
    this.idx = 0;
    this.pos = v3(); this.look = v3(); this.vel = v3();
    this.fr = {};
    this.manual = false;
    this.orbit = { yaw: 2.6, pitch: 0.18, dist: 8.5 };
    this.lastInput = 0;
    this.shots = [
      { name: 'Verfolgung', len: 11, fn: (t, s) => this.chase(t, s) },
      { name: 'Straßenrand', len: 8, init: (s) => this.initRoadside(s), fn: (t, s) => this.roadside(t, s) },
      { name: 'Frontkamera', len: 7, fn: (t, s) => this.rigid(t, s, [0.0, 0.62, -2.7], [0, 0.9, 3], 58) },
      { name: 'Drohne', len: 11, init: (s) => { s.a0 = Math.random() * 6.28; }, fn: (t, s) => this.drone(t, s) },
      { name: 'Seitenfahrt', len: 8, init: (s) => { s.side = Math.random() < 0.5 ? -1 : 1; }, fn: (t, s) => this.sideTrack(t, s) },
      { name: 'Radkamera', len: 7, fn: (t, s) => this.rigid(t, s, [-1.25, 0.42, 2.6], [-0.6, 0.55, -6], 68) },
      { name: 'Panorama', len: 12, init: (s) => { s.a0 = Math.random() * 6.28; }, fn: (t, s) => this.aerial(t, s) },
      { name: 'Heckkamera', len: 7, fn: (t, s) => this.rigid(t, s, [0.0, 1.05, 3.8], [0, 0.7, -8], 62) },
    ];
    this.state = {};
    this.cut(0);

    // Maussteuerung: Ziehen = orbitieren, Rad = Abstand
    let drag = null;
    dom.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; dom.setPointerCapture?.(e.pointerId); });
    dom.addEventListener('pointerup', () => { drag = null; });
    dom.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag = { x: e.clientX, y: e.clientY };
      if (!this.manual) this.enterManual();
      this.orbit.yaw -= dx * 0.006;
      this.orbit.pitch = THREE.MathUtils.clamp(this.orbit.pitch + dy * 0.004, -0.05, 1.3);
      this.lastInput = performance.now();
    });
    dom.addEventListener('wheel', (e) => {
      if (!this.manual) this.enterManual();
      this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * Math.exp(e.deltaY * 0.001), 4, 60);
      this.lastInput = performance.now();
      e.preventDefault();
    }, { passive: false });
  }

  get name() { return this.manual ? 'Freie Kamera' : this.shots[this.idx].name; }

  enterManual() {
    this.manual = true;
    this.lastInput = performance.now();
  }

  cut(i) {
    this.manual = false;
    this.idx = ((i % this.shots.length) + this.shots.length) % this.shots.length;
    this.shotTime = 0;
    this.state = { first: true };
    const sh = this.shots[this.idx];
    sh.init?.(this.state);
    this.shotLen = sh.len;
  }

  next() { this.cut(this.idx + 1); }

  // --- Einstellungen ---
  carPoint(local) {
    return v3().set(...local).applyMatrix4(this.driver.car.root.matrixWorld);
  }

  chase(t, s) {
    const d = this.driver;
    const back = d.fwd.clone().multiplyScalar(-7.2);
    const target = d.pos.clone().add(back).add(v3().set(0, 2.1, 0));
    if (s.first) { this.pos.copy(target); s.first = false; }
    this.pos.lerp(target, 0.08);
    this.look.copy(d.pos).addScaledVector(d.fwd, 4).add(v3().set(0, 0.9, 0));
    this.camera.fov = 52;
  }

  rigid(t, s, off, look, fov) {
    this.pos.copy(this.carPoint(off));
    this.look.copy(this.carPoint(look));
    this.camera.fov = fov;
  }

  initRoadside(s) {
    const d = this.driver;
    s.s = d.s + 85;
    const f = roadFrame(d.road, s.s, {});
    const side = Math.random() < 0.6 ? 1 : -1;
    const off = side * (9 + Math.random() * 6);
    s.p = v3().set(f.x - f.tz * off, 0, f.z + f.tx * off);
    s.p.y = Math.max(this.world.heightAt(s.p.x, s.p.z), 0.5) + 1.2 + Math.random() * 1.5;
  }
  roadside(t, s) {
    this.pos.copy(s.p);
    this.look.copy(this.driver.pos).add(v3().set(0, 0.7, 0));
    const dist = this.pos.distanceTo(this.driver.pos);
    this.camera.fov = THREE.MathUtils.clamp(dist * 0.55, 18, 55);
  }

  drone(t, s) {
    const a = s.a0 + t * 0.18;
    const p = this.driver.pos;
    this.pos.set(p.x + Math.cos(a) * 16, p.y + 6.5 + Math.sin(t * 0.3) * 1.5, p.z + Math.sin(a) * 16);
    this.look.copy(p).add(v3().set(0, 0.6, 0));
    this.camera.fov = 48;
  }

  sideTrack(t, s) {
    const d = this.driver;
    const rx = -d.fwd.z, rz = d.fwd.x;
    const target = d.pos.clone().add(v3().set(rx * s.side * 5.5, 0.9, rz * s.side * 5.5)).addScaledVector(d.fwd, 1.5 - t * 0.25);
    if (s.first) { this.pos.copy(target); s.first = false; }
    this.pos.lerp(target, 0.2);
    this.look.copy(d.pos).add(v3().set(0, 0.55, 0));
    this.camera.fov = 40;
  }

  aerial(t, s) {
    const p = this.driver.pos;
    const a = s.a0 + t * 0.05;
    const r = 140 - t * 5;
    this.pos.set(p.x + Math.cos(a) * r, p.y + 70 - t * 3.2, p.z + Math.sin(a) * r);
    this.look.copy(p);
    this.camera.fov = 38;
  }

  manualCam() {
    const p = this.driver.pos;
    const heading = Math.atan2(this.driver.fwd.x, this.driver.fwd.z);
    const o = this.orbit;
    const a = heading + o.yaw;
    this.pos.set(p.x + Math.sin(a) * Math.cos(o.pitch) * o.dist, p.y + 0.8 + Math.sin(o.pitch) * o.dist, p.z + Math.cos(a) * Math.cos(o.pitch) * o.dist);
    this.look.copy(p).add(v3().set(0, 0.7, 0));
    this.camera.fov = 50;
  }

  update(dt) {
    this.driver.car.root.updateMatrixWorld(true);
    if (this.manual) {
      // nach 25 s ohne Eingabe zurück zur Regie
      if (this.auto && performance.now() - this.lastInput > 25000) this.cut(this.idx + 1);
      else this.manualCam();
    }
    if (!this.manual) {
      this.shotTime += dt;
      if (this.auto && this.shotTime > this.shotLen) this.next();
      this.shots[this.idx].fn(this.shotTime, this.state);
    }
    if (this.debugCam) {
      const c = this.debugCam;
      this.pos.set(c[0], c[1], c[2]); this.look.set(c[3], c[4], c[5]); this.camera.fov = c[6] || 50;
    }
    // nicht unter das Gelände / Wasser
    const gh = Math.max(this.world.heightAt(this.pos.x, this.pos.z), 0.6);
    if (this.pos.y < gh + 0.35) this.pos.y = gh + 0.35;
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.camera.updateProjectionMatrix();
  }
}
