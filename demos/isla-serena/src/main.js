import * as THREE from 'three';
import waterNormalsJpg from '../assets/waternormals.jpg';
import { U, Sky, hookFog } from './atmosphere.js';
import { buildWorld } from './world.js';
import { makeNoiseTexture } from './textures.js';
import { makeTerrain, makeTerrainTextures } from './terrain.js';
import { makeOcean } from './ocean.js';
import { makeRoad } from './road.js';
import { makeVegetation } from './vegetation.js';
import { makeGrass } from './grass.js';
import { loadCar, Driver, PAINTS } from './car.js';
import { Director } from './director.js';
import { planLandmarks, makeLandmarks } from './landmarks.js';
import { WaterReflection, REFLECT_LAYER } from './reflection.js';
import { terrainUniforms } from './terrain.js';
import { makePost } from './post.js';
import { CarAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

const QUALITY = {
  1: { name: 'Niedrig', prCap: 0.8, shadow: 1024, grass: 0, treesNear: 1400, rays: false, mblur: false, dof: false, refl: false, lodBias: 1.6 },
  2: { name: 'Mittel', prCap: 1.0, shadow: 2048, grass: 110000, treesNear: 2600, rays: true, mblur: true, dof: true, refl: true, lodBias: 1.0 },
  3: { name: 'Hoch', prCap: 1.5, shadow: 4096, grass: 200000, treesNear: 4200, rays: true, mblur: true, dof: true, refl: true, lodBias: 0.75 },
};
let qLevel = Number(params.get('q')) || 2;
let Q = QUALITY[qLevel];

function progress(p, label) {
  $('load-bar').style.transform = `scaleX(${p.toFixed(3)})`;
  if (label) $('load-status').textContent = label;
}

async function boot() {
  const canvas = $('view');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', reversedDepthBuffer: true, stencil: false });
  } catch (e) {
    $('load-status').textContent = 'WebGL 2 ist in diesem Browser nicht verfügbar.';
    throw e;
  }
  const gl = renderer.getContext();
  if (!gl.getExtension('EXT_color_buffer_float')) {
    $('load-status').textContent = 'Dein Browser unterstützt keine Float-Rendertargets (EXT_color_buffer_float).';
    return;
  }
  // Grafikchip erkennen: integrierte/mobile GPUs starten mit niedriger Qualität
  const dbgInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbgInfo ? String(gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)) : '';
  if (!params.get('q') && /Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple GPU|SwiftShader|llvmpipe|Microsoft Basic/i.test(gpuName)) { qLevel = 1; Q = QUALITY[1]; }
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const reversed = renderer.capabilities.reversedDepthBuffer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xffffff, 1, 2); // aktiviert USE_FOG; eigentliche Formel steckt in atmosphere.js
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, reversed ? 0.1 : 0.4, 100000);

  progress(0.02, 'Rauschtexturen');
  await new Promise((r) => setTimeout(r, 30));
  U.uNoise.value = makeNoiseTexture();

  const world = await buildWorld(renderer, progress);
  const textures = makeTerrainTextures(world);
  const sky = new Sky(renderer, scene);
  sky.hour = Number(params.get('t')) || 17.25;
  sky.setShadowSize(Q.shadow);

  const terrain = makeTerrain(world, textures);
  scene.add(terrain.group);

  const wn = await new THREE.TextureLoader().loadAsync(waterNormalsJpg);
  const ocean = makeOcean(wn);
  scene.add(ocean.mesh);

  const road = makeRoad(world);
  scene.add(road.group);

  progress(0.96, 'Vegetation wird gepflanzt');
  await new Promise((r) => setTimeout(r, 0));
  const plan = planLandmarks(world);
  const veg = makeVegetation(world, Q, plan.exclude);
  scene.add(veg.group);

  const landmarks = makeLandmarks(world, plan);
  scene.add(landmarks.group);

  const grass = makeGrass(QUALITY[3].grass);
  grass.setCount(Q.grass);
  scene.add(grass.mesh);

  progress(0.98, 'Wagen wird vorgefahren');
  const car = await loadCar();
  scene.add(car.root);
  const driver = new Driver(car, world.road, world.heightAt);
  driver.update(0.016);

  const director = new Director(camera, driver, world, canvas, veg);
  const post = makePost(renderer, scene, camera);
  const audio = new CarAudio();

  // Spiegelung: was im Wasser erscheinen soll, liegt zusätzlich auf einer eigenen Ebene
  const reflection = new WaterReflection(renderer, scene);
  const reflectables = [terrain.group, veg.group, landmarks.group, sky.light, sky.hemi];
  for (const g of reflectables) g.traverse((o) => o.layers.enable(REFLECT_LAYER));
  ocean.uniforms.uRefl.value = reflection.rt.texture;

  // Materialien ohne eigenen Hook (z. B. aus dem glTF) an den Nebel anschließen
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach(hookFog); });

  let paint = 0;
  let timeRunning = true;
  let paused = params.has('still');
  let hudVisible = true;
  let letterbox = false;
  let renderScale = 1;

  function resize() {
    const pr = Math.min(window.devicePixelRatio || 1, Q.prCap) * renderScale;
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight, false);
    post.composer.setPixelRatio(pr);
    post.composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  resize();

  function setQuality(l) {
    qLevel = l; Q = QUALITY[l];
    sky.setShadowSize(Q.shadow);
    grass.setCount(Q.grass);
    renderScale = 1;
    resize();
    toast(`Qualität: ${Q.name}`);
  }

  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
  }

  // Zeitsprünge zu markanten Stimmungen
  const MOODS = [[7.1, 'Morgen'], [12.5, 'Mittag'], [16.9, 'Goldene Stunde'], [17.95, 'Sonnenuntergang'], [18.45, 'Blaue Stunde'], [22.5, 'Nacht']];
  function nextMood() {
    const h = sky.hour % 24;
    const m = MOODS.find(([t]) => t > h + 0.05) || MOODS[0];
    sky.hour = m[0];
    toast(m[1]);
  }

  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (k === 'c' || e.key === 'ArrowRight') { director.next(); }
    else if (e.key === 'ArrowLeft') { director.cut(director.idx - 1); }
    else if (k === 'a') { director.auto = !director.auto; toast(director.auto ? 'Automatische Regie an' : 'Automatische Regie aus'); }
    else if (k === 't') { timeRunning = !timeRunning; toast(timeRunning ? 'Zeit läuft' : 'Zeit angehalten'); }
    else if (k === 'n') nextMood();
    else if (e.key === '+' || e.key === ']') { sky.hour += 0.5; }
    else if (e.key === '-' || e.key === '[') { sky.hour -= 0.5; }
    else if (k === 'p') { paint = (paint + 1) % PAINTS.length; car.bodyMat.color.setHex(PAINTS[paint].color); toast(PAINTS[paint].name); }
    else if (k === 'l') { letterbox = !letterbox; }
    else if (k === 'h') { hudVisible = !hudVisible; document.body.classList.toggle('hud-off', !hudVisible); }
    else if (k === 'm') { audio.start(); toast(audio.toggleMute() ? 'Ton aus' : 'Ton an'); }
    else if (k === 'f') { document.fullscreenElement ? document.exitFullscreen?.() : document.documentElement.requestFullscreen?.().catch(() => {}); }
    else if (k === ' ') { paused = !paused; toast(paused ? 'Pause' : 'Weiter'); e.preventDefault(); }
    else if (k === '1' || k === '2' || k === '3') setQuality(Number(k));
    else if (k === '?' || k === 'k') { $('keys').classList.toggle('open'); }
  });
  $('help-btn').addEventListener('click', () => $('keys').classList.toggle('open'));

  // Shader vorkompilieren, damit der erste Schnitt nicht ruckelt
  progress(0.99, 'Shader werden kompiliert');
  sky.update(0.016, driver.pos);
  director.update(0.016);
  terrain.update(camera, Q.lodBias);
  veg.update(camera);
  try { await renderer.compileAsync(scene, camera); } catch { /* optional */ }
  progress(1, 'Bereit');

  $('loader').classList.add('ready');
  const begin = (withSound) => {
    if (withSound) audio.start();
    canvas.focus();
    // Eröffnung: Panoramaflug, danach übernimmt die Regie
    if (!params.has('cam')) director.cut(6);
    $('loader').classList.add('gone');
    setTimeout(() => { $('keys').classList.remove('open'); }, 9000);
    $('keys').classList.add('open');
  };
  $('start-sound').addEventListener('click', () => begin(true));
  $('start-quiet').addEventListener('click', () => begin(false));
  if (params.has('auto')) begin(false);
  if (params.has('cam')) { director.auto = false; director.cut(Number(params.get('cam'))); }
  const noAdapt = params.has('fixed');

  // ---------- Hauptschleife ----------
  let lastT = performance.now();
  let fpsAcc = 0, fpsN = 0, hudT = 0, fps = 60, adaptT = 0, ftAvg = 16;
  const sunCol = new THREE.Color();
  const debug = params.has('debug');
  window.__demo = { gpuName, plan, renderer, scene, camera, sky, director, driver, world, post, veg, U, setQuality, info: () => renderer.info };

  renderer.info.autoReset = false;
  function frame() {
    renderer.info.reset();
    const nowT = performance.now();
    const rawDt = Math.max(0.0001, (nowT - lastT) / 1000);
    lastT = nowT;
    const dt = Math.min(rawDt, 0.05);
    fpsAcc += rawDt; fpsN++;
    ftAvg += (rawDt * 1000 - ftAvg) * 0.05;

    if (!paused) {
      driver.update(dt);
      U.uTime.value += dt;
      if (timeRunning) {
        const golden = Math.abs(sky.sun.y) < 0.28;
        sky.hour += dt * (golden ? 0.011 : 0.045);
        if (sky.hour >= 24) sky.hour -= 24;
      }
    }
    director.update(paused ? 0 : dt);
    sky.update(dt, driver.pos);
    sky.dome.position.copy(camera.position);
    terrain.update(camera, Q.lodBias);
    veg.update(camera);
    ocean.update(camera);

    const night = U.uNight.value;
    road.update(night);
    landmarks.update(U.uTime.value, night);
    // Lichter am Auto
    const lightsOn = THREE.MathUtils.smoothstep(night, 0.15, 0.45);
    for (const h of car.heads) h.intensity = lightsOn * 55;
    car.headMat.emissiveIntensity = 0.2 + lightsOn * 9;
    car.beamMat.uniforms.uI.value = lightsOn;
    const braking = driver.accel < -2.2 ? 1 : 0;
    car.tailMat.emissiveIntensity = 0.5 + lightsOn * 5 + braking * 8;
    ocean.uniforms.uHeadlight.value.set(driver.pos.x + driver.fwd.x * 15, 0, driver.pos.z + driver.fwd.z * 15, lightsOn);
    // Belichtung: nachts etwas nachregeln (Augenadaption)
    const sy = sky.sun.y;
    const expo = sy > 0.25 ? 1.0 : sy > 0.0 ? THREE.MathUtils.lerp(1.55, 1.0, sy / 0.25) : THREE.MathUtils.lerp(1.55, 2.4, THREE.MathUtils.smoothstep(-sy, 0.0, 0.15));
    renderer.toneMappingExposure += (expo - renderer.toneMappingExposure) * Math.min(1, dt * 2);

    sunCol.copy(sky.light.color);
    post.update(U.uTime.value, sky.sun, sunCol, night, camera.aspect, Q.rays);
    post.grade.uniforms.uLetterbox.value += ((letterbox ? 1 : 0) - post.grade.uniforms.uLetterbox.value) * Math.min(1, dt * 4);

    // Wasserspiegelung (vor dem Hauptbild)
    reflection.enabled = Q.refl && camera.position.y < 400;
    reflection.scale = qLevel === 3 ? 0.6 : 0.42;
    if (reflection.enabled) {
      reflection.update(camera, terrainUniforms.uClipY);
      ocean.uniforms.uReflMat.value.copy(reflection.matrix);
    }
    ocean.uniforms.uReflOn.value = reflection.enabled ? 1 : 0;

    const camDist = camera.position.distanceTo(driver.pos);
    audio.update(dt, driver, camDist, THREE.MathUtils.smoothstep(-world.heightAt(camera.position.x, camera.position.z), -40, 5));

    // Bei Schnitten keine Unschärfe über den Bildwechsel
    if (director.cutFlag) { post.cut(); director.cutFlag = false; }
    post.updateDof(director.focus || camDist, director.dof || 0, Q.dof && !params.has('nodof'));
    post.updateMotion(driver.root ? driver.root.position : car.root.position, Q.mblur && !paused && !params.has('nomb'), 0.55);
    post.composer.render(dt);

    // HUD
    hudT += rawDt;
    if (hudT > 0.25) {
      fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; hudT = 0;
      const h = Math.floor(sky.hour), m = Math.floor((sky.hour - h) * 60);
      $('hud-time').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      $('hud-speed').textContent = Math.round(driver.v * 3.6);
      $('hud-gear').textContent = driver.gear;
      $('hud-cam').textContent = director.name + (director.auto ? '' : ' · manuell');
      $('hud-fps').textContent = `${fps.toFixed(0)} fps · ${Math.round(renderer.getPixelRatio() * 100)} % · ${Q.name}`;
      if (debug) {
        const i = renderer.info.render;
        $('hud-fps').textContent += ` · ${i.calls} calls · ${(i.triangles / 1e6).toFixed(2)} M tris`;
      }
    }
    // Adaptive Auflösung: Ziel stabil über 30 fps
    adaptT += rawDt;
    if (adaptT > 1.5 && !noAdapt) {
      adaptT = 0;
      if (ftAvg > 30 && renderScale > 0.55) { renderScale = Math.max(0.55, renderScale - 0.1); resize(); }
      else if (ftAvg < 19 && renderScale < 1) { renderScale = Math.min(1, renderScale + 0.05); resize(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot().catch((e) => {
  console.error(e);
  const s = document.getElementById('load-status');
  if (s) s.textContent = 'Fehler: ' + (e && e.message ? e.message : e);
});
