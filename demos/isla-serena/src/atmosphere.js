// Tageszeit, Sonne/Mond, physikalischer Himmel (Cubemap), Himmelskuppel, Nebel für alle Materialien.
import * as THREE from 'three';
import atmosGLSL from './glsl/atmos.glsl';
import skyCommonGLSL from './glsl/sky_common.glsl';

export const SKY_SCALE = 0.55;   // Skalierung der Himmelsstrahldichte relativ zur Sonne
export const SUN_I = 22.0;       // Sonnenintensität der Streurechnung
export const SUN_LIGHT = 4.2;    // DirectionalLight-Intensität bei voller Sonne

// Gemeinsame Uniforms (gleiche Objekte in allen Materialien -> automatisch aktuell)
export const U = {
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
  uSunDisk: { value: new THREE.Color() },
  uCloudSun: { value: new THREE.Color() },
  uCloudAmb: { value: new THREE.Color() },
  uFogColor: { value: new THREE.Color() },
  uFogSunColor: { value: new THREE.Color() },
  uFogParams: { value: new THREE.Vector4(0.00042, 0.0035, 10.0, 0.96) },
  uNight: { value: 0 },
  uTime: { value: 0 },
  uCloudCover: { value: 0.68 },
  uNoise: { value: null },
  uSkyCube: { value: null },
  uGroundColor: { value: new THREE.Color() },
  uAmbient: { value: new THREE.Color() },
  uSunLight: { value: new THREE.Color() },
  uWet: { value: 0 },
};

// ---------- JS-Port der Streurechnung (für Nebel-, Licht- und Wolkenfarben) ----------
const RP = 6371e3, RA = 6471e3;
const KR = [5.5e-6, 13.0e-6, 22.4e-6], KM = 21e-6, SHR = 8e3, SHM = 1.2e3;
function rsi(r0, rd, sr) {
  const a = rd[0] * rd[0] + rd[1] * rd[1] + rd[2] * rd[2];
  const b = 2 * (rd[0] * r0[0] + rd[1] * r0[1] + rd[2] * r0[2]);
  const c = r0[0] * r0[0] + r0[1] * r0[1] + r0[2] * r0[2] - sr * sr;
  const d = b * b - 4 * a * c;
  if (d < 0) return [1e5, -1e5];
  const s = Math.sqrt(d);
  return [(-b - s) / (2 * a), (-b + s) / (2 * a)];
}
function atmosJS(r, r0, pSun, iSun, g = 0.758) {
  const I = 12, J = 6;
  const p = rsi(r0, r, RA);
  if (p[0] > p[1]) return [0, 0, 0];
  p[1] = Math.min(p[1], rsi(r0, r, RP)[0] > 0 ? rsi(r0, r, RP)[0] : p[1]);
  const is = (p[1] - Math.max(p[0], 0)) / I;
  let it = 0, oR = 0, oM = 0;
  const tR = [0, 0, 0], tM = [0, 0, 0];
  const mu = r[0] * pSun[0] + r[1] * pSun[1] + r[2] * pSun[2];
  const gg = g * g;
  const pR = (3 / (16 * Math.PI)) * (1 + mu * mu);
  const pM = ((3 / (8 * Math.PI)) * ((1 - gg) * (mu * mu + 1))) / (Math.pow(1 + gg - 2 * mu * g, 1.5) * (2 + gg));
  for (let i = 0; i < I; i++) {
    const ip = [r0[0] + r[0] * (it + is / 2), r0[1] + r[1] * (it + is / 2), r0[2] + r[2] * (it + is / 2)];
    const h = Math.hypot(ip[0], ip[1], ip[2]) - RP;
    const sR = Math.exp(-h / SHR) * is, sM = Math.exp(-h / SHM) * is;
    oR += sR; oM += sM;
    const pl = rsi(ip, pSun, RP);
    const lit = pl[0] > 0 && pl[0] < pl[1] ? 0 : 1;
    const js = rsi(ip, pSun, RA)[1] / J;
    let jt = 0, jR = 0, jM = 0;
    for (let j = 0; j < J; j++) {
      const jp = [ip[0] + pSun[0] * (jt + js / 2), ip[1] + pSun[1] * (jt + js / 2), ip[2] + pSun[2] * (jt + js / 2)];
      const jh = Math.hypot(jp[0], jp[1], jp[2]) - RP;
      jR += Math.exp(-jh / SHR) * js; jM += Math.exp(-jh / SHM) * js;
      jt += js;
    }
    for (let c = 0; c < 3; c++) {
      const at = Math.exp(-(KM * (oM + jM) + KR[c] * (oR + jR))) * lit;
      tR[c] += sR * at; tM[c] += sM * at;
    }
    it += is;
  }
  return [0, 1, 2].map((c) => iSun * (pR * KR[c] * tR[c] + pM * KM * tM[c]));
}
// Transmission entlang des Sonnenstrahls ab Höhe alt
function transmittance(sun, alt) {
  const r0 = [0, RP + alt, 0];
  const pl = rsi(r0, sun, RP);
  if (pl[0] > 0 && pl[0] < pl[1]) return [0, 0, 0];
  const L = rsi(r0, sun, RA)[1];
  const S = 24, st = L / S;
  let oR = 0, oM = 0;
  for (let i = 0; i < S; i++) {
    const t = (i + 0.5) * st;
    const h = Math.hypot(sun[0] * t, r0[1] + sun[1] * t, sun[2] * t) - RP;
    oR += Math.exp(-h / SHR) * st; oM += Math.exp(-h / SHM) * st;
  }
  return KR.map((k) => Math.exp(-(k * oR + KM * 1.1 * oM)));
}

// ---------- Nebel in alle Standardmaterialien einschleusen ----------
const fogParsVertex = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
#endif`;
const fogVertex = /* glsl */ `
#ifdef USE_FOG
  vec4 fogWP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    fogWP = batchingMatrix * fogWP;
  #endif
  #ifdef USE_INSTANCING
    fogWP = instanceMatrix * fogWP;
  #endif
  vFogWorldPos = (modelMatrix * fogWP).xyz;
#endif`;
const fogParsFragment = /* glsl */ `
#ifdef USE_FOG
  varying vec3 vFogWorldPos;
  uniform vec3 uFogColor;
  uniform vec3 uFogSunColor;
  uniform vec3 uFogSunDir;
  uniform vec4 uFogParams;
  vec3 fogBlendStd(vec3 col, vec3 ro, vec3 wp) {
    vec3 rd = wp - ro; float dist = length(rd); rd /= max(dist, 1e-4);
    float a = uFogParams.x, b = uFogParams.y;
    float ry = rd.y; if (abs(ry) < 1e-4) ry = 1e-4;
    float fogAmt = a * exp(-max(ro.y, -20.0) * b) * (1.0 - exp(-dist * ry * b)) / (ry * b);
    float f = 1.0 - exp(-fogAmt);
    float s = pow(max(dot(rd, uFogSunDir), 0.0), uFogParams.z);
    return mix(col, mix(uFogColor, uFogSunColor, s), clamp(f, 0.0, uFogParams.w));
  }
#endif`;
const fogFragment = /* glsl */ `
#ifdef USE_FOG
  gl_FragColor.rgb = fogBlendStd(gl_FragColor.rgb, cameraPosition, vFogWorldPos);
#endif`;

THREE.ShaderChunk.fog_pars_vertex = fogParsVertex;
THREE.ShaderChunk.fog_vertex = fogVertex;
THREE.ShaderChunk.fog_pars_fragment = fogParsFragment;
THREE.ShaderChunk.fog_fragment = fogFragment;

// Material an den gemeinsamen Nebel anschließen (behält vorhandenes onBeforeCompile)
export function hookFog(material) {
  if (material.__fogHooked) return material;
  material.__fogHooked = true;
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    shader.uniforms.uFogColor = U.uFogColor;
    shader.uniforms.uFogSunColor = U.uFogSunColor;
    shader.uniforms.uFogSunDir = U.uSunDir;
    shader.uniforms.uFogParams = U.uFogParams;
    if (prev) prev.call(material, shader, renderer);
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|fog';
  return material;
}

// ---------- Himmel ----------
export class Sky {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.hour = 17.2;
    this.sun = new THREE.Vector3();
    this.moon = new THREE.Vector3();
    this.lastCubeSun = new THREE.Vector3(9, 9, 9);
    this.cubeTimer = 0;

    // Cubemap mit der Streurechnung
    this.cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    this.cubeCam = new THREE.CubeCamera(1, 10, this.cubeRT);
    this.cubeScene = new THREE.Scene();
    const cubeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uSunDir: U.uSunDir, uMoonDir: U.uMoonDir, uGroundColor: U.uGroundColor },
      vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        ${atmosGLSL}
        uniform vec3 uSunDir; uniform vec3 uMoonDir; uniform vec3 uGroundColor;
        varying vec3 vDir;
        void main(){
          vec3 rd = normalize(vDir);
          vec3 r0 = vec3(0.0, 6372e3, 0.0);
          vec3 d = vec3(rd.x, max(rd.y, 0.0), rd.z); d = normalize(d + vec3(0.0, 0.0001, 0.0));
          vec3 c = atmosphere(d, r0, uSunDir, ${SUN_I.toFixed(1)}, 0.758);
          c += atmosphere(d, r0, uMoonDir, 0.35, 0.6) * vec3(0.75, 0.85, 1.0);
          c *= ${SKY_SCALE.toFixed(3)};
          c += vec3(0.0015, 0.002, 0.004); // Restlicht / Lichtverschmutzung
          // untere Hemisphäre: Boden-/Meeresreflex für die Umgebungsbeleuchtung
          float g = smoothstep(0.0, -0.08, rd.y);
          c = mix(c, uGroundColor, g);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.cubeScene.add(new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), cubeMat));
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.envRT = null;
    U.uSkyCube.value = this.cubeRT.texture;

    // Himmelskuppel
    const domeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      uniforms: U,
      vertexShader: /* glsl */ `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */ `
        ${skyCommonGLSL}
        varying vec3 vWorld;
        void main(){
          vec3 rd = normalize(vWorld - cameraPosition);
          vec3 col = skyColor(cameraPosition, rd, true);
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(70000, 48, 24), domeMat);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // Lichter
    this.light = new THREE.DirectionalLight(0xffffff, SUN_LIGHT);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(2048, 2048);
    const sc = this.light.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70; sc.near = 1; sc.far = 900;
    this.light.shadow.bias = -0.0004;
    this.light.shadow.normalBias = 0.06;
    this.light.shadow.radius = 3;
    scene.add(this.light, this.light.target);
    this.hemi = new THREE.HemisphereLight(0x8899bb, 0x223322, 0.0);
    scene.add(this.hemi);
  }

  setShadowSize(n) {
    this.light.shadow.mapSize.set(n, n);
    if (this.light.shadow.map) { this.light.shadow.map.dispose(); this.light.shadow.map = null; }
  }

  update(dt, focus) {
    // Sonnenbahn: Aufgang im Osten (+X), Mittag im Süden (+Z), Höchststand ~58°
    const th = ((this.hour - 6) / 12) * Math.PI;
    const tilt = THREE.MathUtils.degToRad(32);
    this.sun.set(Math.cos(th), Math.sin(th) * Math.cos(tilt), Math.sin(th) * Math.sin(tilt)).normalize();
    // Mond ungefähr gegenüber, etwas versetzt
    const mth = th + Math.PI * 0.94;
    this.moon.set(Math.cos(mth) * 0.9, Math.sin(mth) * Math.cos(tilt) * 0.9 + 0.12, Math.sin(mth) * Math.sin(tilt) - 0.2).normalize();
    U.uSunDir.value.copy(this.sun);
    U.uMoonDir.value.copy(this.moon);

    const s = [this.sun.x, this.sun.y, this.sun.z];
    const tr = transmittance(s, 2);
    const trHigh = transmittance(s, 2200);
    const night = THREE.MathUtils.smoothstep(-this.sun.y, -0.04, 0.16);
    U.uNight.value = night;

    // Sonnenscheibe
    U.uSunDisk.value.setRGB(tr[0], tr[1], tr[2]).multiplyScalar(260);

    // Nebel-/Horizontfarben
    const r0 = [0, RP + 2, 0];
    const az = Math.atan2(s[2], s[0]);
    const el = 0.035;
    const toward = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const away = [-toward[0], toward[1], -toward[2]];
    const side = [-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const m = [this.moon.x, this.moon.y, this.moon.z];
    const col = (dir) => {
      const a = atmosJS(dir, r0, s, SUN_I);
      const b = atmosJS(dir, r0, m, 0.35, 0.6);
      return [0, 1, 2].map((c) => (a[c] + b[c] * [0.75, 0.85, 1.0][c]) * SKY_SCALE + [0.0015, 0.002, 0.004][c]);
    };
    const cA = col(away), cS = col(side), cT = col(toward), cZ = col([0, 1, 0]);
    U.uFogColor.value.setRGB((cA[0] + cS[0]) / 2, (cA[1] + cS[1]) / 2, (cA[2] + cS[2]) / 2);
    U.uFogSunColor.value.setRGB(cT[0], cT[1], cT[2]);

    // Umgebung / Wolkenlicht
    U.uCloudSun.value.setRGB(trHigh[0], trHigh[1], trHigh[2]).multiplyScalar(1.35 * Math.max(0, Math.min(1, (this.sun.y + 0.08) * 8)));
    U.uAmbient.value.setRGB(cZ[0] * 0.7 + cS[0] * 0.3, cZ[1] * 0.7 + cS[1] * 0.3, cZ[2] * 0.7 + cS[2] * 0.3);
    U.uCloudAmb.value.setRGB(cZ[0] * 0.6 + cS[0] * 0.5, cZ[1] * 0.6 + cS[1] * 0.5, cZ[2] * 0.6 + cS[2] * 0.5);
    const sunUp = Math.max(0, this.sun.y);
    U.uGroundColor.value.setRGB(0.05, 0.065, 0.05).multiplyScalar(0.02 + 1.4 * sunUp).add(new THREE.Color(cS[0] * 0.25, cS[1] * 0.25, cS[2] * 0.25));

    // Direktes Licht: Sonne oder Mond
    const sunW = THREE.MathUtils.smoothstep(this.sun.y, -0.02, 0.05);
    const moonW = (1 - sunW) * THREE.MathUtils.smoothstep(this.moon.y, 0.0, 0.2);
    if (sunW > 0.001) {
      this.light.color.setRGB(tr[0], tr[1], tr[2]);
      this.light.intensity = SUN_LIGHT * sunW;
      this.lightDir = this.sun;
    } else {
      this.light.color.setRGB(0.62, 0.72, 1.0);
      this.light.intensity = 0.32 * moonW;
      this.lightDir = this.moon;
    }
    U.uSunLight.value.copy(this.light.color).multiplyScalar(this.light.intensity);
    this.hemi.intensity = 0.25 * night;
    this.hemi.color.setRGB(0.25, 0.32, 0.55);

    // Schatten folgt dem Fokus (Auto)
    const d = this.lightDir;
    this.light.position.set(focus.x + d.x * 400, focus.y + d.y * 400, focus.z + d.z * 400);
    this.light.target.position.copy(focus);
    // Texelsnapping gegen Schattenflimmern
    this.light.shadow.camera.updateMatrixWorld();

    // Cubemap + PMREM nur bei spürbarer Sonnenbewegung neu
    this.cubeTimer -= dt;
    if (this.cubeTimer <= 0 && this.lastCubeSun.distanceTo(this.sun) > 0.004) {
      this.cubeTimer = 0.35;
      this.lastCubeSun.copy(this.sun);
      this.cubeCam.update(this.renderer, this.cubeScene);
      const env = this.pmrem.fromCubemap(this.cubeRT.texture, this.envRT || undefined);
      this.envRT = env;
      this.scene.environment = env.texture;
    }
  }
}
