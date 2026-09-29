// Planare Spiegelung für den Ozean: gespiegelte Kamera, halbe Auflösung, nur Gelände/Bäume/Gebäude.
import * as THREE from 'three';

export const REFLECT_LAYER = 2;

export class WaterReflection {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.rt.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
    this.cam = new THREE.PerspectiveCamera();
    this.cam.layers.set(REFLECT_LAYER);
    this.matrix = new THREE.Matrix4();
    this.enabled = true;
    this.scale = 0.5;
    this._size = new THREE.Vector2();
  }

  resize() {
    const s = this.renderer.getDrawingBufferSize(this._size);
    const w = Math.max(1, Math.floor(s.x * this.scale)), h = Math.max(1, Math.floor(s.y * this.scale));
    if (this.rt.width !== w || this.rt.height !== h) this.rt.setSize(w, h);
  }

  update(camera, clipUniform) {
    if (!this.enabled) return;
    this.resize();
    const cam = this.cam;
    const cp = camera.position;
    // Kamera an der Wasserebene y=0 spiegeln
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    cam.position.set(cp.x, -cp.y, cp.z);
    cam.up.set(up.x, -up.y, up.z);
    cam.lookAt(cp.x + dir.x, -cp.y - dir.y, cp.z + dir.z);
    cam.fov = camera.fov; cam.aspect = camera.aspect; cam.near = camera.near; cam.far = camera.far;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const r = this.renderer;
    const prevTarget = r.getRenderTarget();
    const prevAuto = r.shadowMap.autoUpdate;
    const prevAlpha = r.getClearAlpha();
    const prevColor = r.getClearColor(new THREE.Color());
    r.shadowMap.autoUpdate = false;
    clipUniform.value = -0.25;
    r.setRenderTarget(this.rt);
    r.setClearColor(0x000000, 0);
    r.clear();
    r.render(this.scene, cam);
    clipUniform.value = -1e9;
    r.setClearColor(prevColor, prevAlpha);
    r.setRenderTarget(prevTarget);
    r.shadowMap.autoUpdate = prevAuto;

    // Welt -> Textur-UV (gleiche Konvention wie three.js Reflector)
    this.matrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.matrix.multiply(cam.projectionMatrix).multiply(cam.matrixWorldInverse);
  }
}
