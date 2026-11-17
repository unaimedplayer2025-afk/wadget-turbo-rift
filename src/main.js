// WADGET: TURBO RIFT — off-road F-Zero-style racer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Snd, SFX } from './audio.js';
import { rnd, pick, clamp, lerp, damp, angLerp, glow, additive, Tex, std } from './util.js';
import { buildTurboHero, animTurboWalrus, animLimbs, buildPickup, GADGETS, RIVALS, buildDisc } from './models.js';
import { buildTracks, buildSky, TRACKS, TRACK_IDS, sampleAt, project, wrapDist, deltaS, logTrackInfo } from './tracks.js';

const Q = new URLSearchParams(location.search);
if (Q.has('seed')) { let a = +Q.get('seed') || 1; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const CAPTURE = Q.has('capture'), DEMO = Q.has('demo') || CAPTURE;
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
if (TOUCH) document.body.classList.add('touch');
const $ = id => document.getElementById(id);

const LAPS = 3, RIDE = 0.95, GRAV = 64;
const MAX_SPD = 86, BOOST_SPD = 148, ROCKET_SPD = 180;
const ACCEL = 50, BRAKE = 78, COAST = 14, STEER = 2.05;

// ------------------------------------------------------------------------------------------ renderer
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
let pixelRatio = Math.min(window.devicePixelRatio || 1, Q.has('lowfx') ? 0.75 : 1.5);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.008);
const camera = new THREE.PerspectiveCamera(64, 16 / 9, 0.2, 1600);
const titleCam = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 400);
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envTex; scene.environmentIntensity = 0.55;
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera); composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(480, 270), 0.7, 0.5, 0.7); composer.addPass(bloom);
composer.addPass(new OutputPass());
let useBloom = !Q.has('lowfx');
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); composer.setSize(w, h); composer.setPixelRatio(pixelRatio);
  bloom.resolution.set(w / 2, h / 2);
  for (const c of [camera, titleCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------------------------------ world
buildTracks();
if (Q.has('debug')) logTrackInfo();
const sky = buildSky(); scene.add(sky);
const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun, sun.target);
for (const id of TRACK_IDS) { TRACKS[id].group.visible = false; scene.add(TRACKS[id].group); }

const PICKS = [
  { kind: 'single', trackId: 'isle' },
  { kind: 'single', trackId: 'prairie' },
  { kind: 'single', trackId: 'grid' },
  { kind: 'cup' }
];
const G = {
  mode: 'title', trackId: (Q.get('track') && TRACKS[Q.get('track')]) ? Q.get('track') : 'isle',
  pick: 0, cup: null,
  t: 0, raceT: 0, countT: 0, shake: 0, racers: [],
  titleT: 0, endT: 0, flash: 0, showcase: CAPTURE, demoStarted: false
};
G.pick = Q.has('cup') ? 3 : Math.max(0, PICKS.findIndex(p => p.trackId === G.trackId));
window.__game = G;

function applyTrack(id) {
  const T = TRACKS[id]; if (!T) return;
  G.trackId = id; G.track = T;
  for (const k of TRACK_IDS) TRACKS[k].group.visible = k === id;
  scene.fog.color.set(T.fog.color); scene.fog.density = T.fog.density;
  const u = sky.material.uniforms;
  u.top.value.set(T.sky.top); u.horizon.value.set(T.sky.horizon); u.bottom.value.set(T.sky.bottom);
  u.sun.value.set(T.sky.sun); u.sunOn.value = T.sky.sunOn; u.flash.value = 0;
  hemi.color.set(T.lights.hemi[0]); hemi.groundColor.set(T.lights.hemi[1]); hemi.intensity = T.lights.hemi[2];
  sun.color.set(T.lights.dir[0]); sun.intensity = T.lights.dir[1]; sun.position.set(...T.lights.dir[2]);
  renderer.toneMappingExposure = T.lights.exposure; bloom.strength = T.lights.bloom;
  document.documentElement.style.setProperty('--accent', T.palette.accent);
  document.documentElement.style.setProperty('--accent2', T.palette.accent2);
  $('year').textContent = T.year; $('eraName').textContent = T.name;
  RaceMusic.set(T.music || 'audio/gameplay');
  if (typeof updatePickUI === 'function') updatePickUI();
  ensurePickups(T);
}

function pickSrc(base) {
  if (/\.(ogg|mp3|wav|m4a)$/i.test(base)) return base;
  const a = document.createElement('audio');
  const ogg = a.canPlayType('audio/ogg; codecs="vorbis"') || a.canPlayType('audio/ogg; codecs="opus"');
  return ogg ? base + '.ogg' : base + '.mp3';
}
const RaceMusic = {
  el: null, url: null, vol: 0,
  set(url) {
    const src = pickSrc(url || 'audio/gameplay');
    if (src === this.url) { this.sync(); return; }
    this.url = src;
    if (this.el) { this.el.pause(); this.el = null; }
    const a = new Audio(); a.loop = true; a.preload = 'auto'; a.src = src; a.volume = 0; this.el = a; this.vol = 0;
    this.sync();
  },
  sync() {
    if (!this.el) return;
    const want = G.mode !== 'title' && Snd.unlocked && !Snd.muted;
    if (want && this.el.paused) { const p = this.el.play(); if (p && p.catch) p.catch(() => {}); }
  },
  update(dt) {
    const want = G.mode !== 'title' && Snd.unlocked && !Snd.muted;
    this.vol = want ? Math.min(0.55, this.vol + dt * 0.8) : Math.max(0, this.vol - dt * 0.7);
    if (this.el) {
      if (want && this.el.paused) this.sync();
      try { this.el.volume = this.vol; } catch (e) {}
      if (!want && this.vol <= 0 && !this.el.paused) this.el.pause();
    }
  }
};

function ensurePickups(T) {
  for (const p of T.pickups) {
    if (!p.mesh) {
      p.mesh = buildPickup(p.kind);
      T.group.add(p.mesh);
    }
    placePickup(T, p);
  }
}
function placePickup(T, p) {
  const sm = sampleAt(T, p.s);
  p.mesh.position.copy(sm.p).addScaledVector(sm.b, p.lateral).addScaledVector(sm.n, 1.6);
  p.mesh.visible = !p.taken;
}

// ------------------------------------------------------------------------------------------ particles
const PN = 900;
const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pData = [];
for (let i = 0; i < PN; i++) { pData.push({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, r: 1, gg: 1, b: 1 }); pPos[i * 3 + 1] = -999; }
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const points = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.35, map: Tex.dot(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
points.frustumCulled = false; scene.add(points);
let pNext = 0; const tmpC = new THREE.Color();

// Spiked sawblade disc on a chain — same model / glow / feel as WADGET: Chain of Ages.
const CHAIN_N = 18;
const disc = buildDisc(1.25); disc.visible = false; scene.add(disc);
const chain = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.05, 0.05, 0.18),
  new THREE.MeshStandardMaterial({ color: 0x8a8a90, metalness: 1, roughness: 0.3, emissive: 0x400800, emissiveIntensity: 0.65 }),
  CHAIN_N
);
chain.instanceMatrix.setUsage(THREE.DynamicDrawUsage); chain.frustumCulled = false; chain.visible = false; scene.add(chain);
const discState = { state: 'held', pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0, cool: 0, hits: new Set(), target: null };
const handPos = new THREE.Vector3(), bez = new THREE.Vector3(), prevPt = new THREE.Vector3();
const cm = new THREE.Matrix4(), cq = new THREE.Quaternion(), cs = new THREE.Vector3(1, 1, 1);
let discAIWait = 0;

function emit(pos, n, color, spd = 6, o = {}) {
  for (let k = 0; k < n; k++) {
    const i = pNext; pNext = (pNext + 1) % PN; const d = pData[i];
    const c = Array.isArray(color) ? pick(color) : color; tmpC.set(c);
    const th = Math.random() * Math.PI * 2, ph = Math.acos(rnd(-1, 1)), s = spd * rnd(0.3, 1);
    d.vx = Math.sin(ph) * Math.cos(th) * s + (o.vx || 0); d.vy = Math.cos(ph) * s * (o.flat ? 0.2 : 1) + (o.up || 0); d.vz = Math.sin(ph) * Math.sin(th) * s + (o.vz || 0);
    d.life = d.max = rnd(0.4, 1) * (o.life || 0.7); d.g = o.g ?? 6; d.drag = o.drag ?? 1.6; d.r = tmpC.r * (o.bright || 2); d.gg = tmpC.g * (o.bright || 2); d.b = tmpC.b * (o.bright || 2);
    pPos[i * 3] = pos.x + (o.spread ? rnd(-o.spread, o.spread) : 0); pPos[i * 3 + 1] = pos.y + (o.spreadY ? rnd(0, o.spreadY) : 0); pPos[i * 3 + 2] = pos.z + (o.spread ? rnd(-o.spread, o.spread) : 0);
  }
}
function updateParticles(dt) {
  for (let i = 0; i < PN; i++) {
    const d = pData[i]; if (d.life <= 0) continue;
    d.life -= dt; const k = Math.max(0, d.life / d.max), dr = Math.exp(-d.drag * dt);
    d.vx *= dr; d.vz *= dr; d.vy = d.vy * dr - d.g * dt;
    pPos[i * 3] += d.vx * dt; pPos[i * 3 + 1] += d.vy * dt; pPos[i * 3 + 2] += d.vz * dt;
    pCol[i * 3] = d.r * k; pCol[i * 3 + 1] = d.gg * k; pCol[i * 3 + 2] = d.b * k;
    if (d.life <= 0) { pPos[i * 3 + 1] = -999; pCol[i * 3] = pCol[i * 3 + 1] = pCol[i * 3 + 2] = 0; }
  }
  pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------ racers
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpF = new THREE.Vector3();
let player = null;

function makeRacer(opt) {
  const P = opt.build();
  if (opt.isPlayer) P.root.scale.setScalar(1.18);
  scene.add(P.root);
  const r = {
    isPlayer: !!opt.isPlayer, name: opt.name, color: opt.color, id: opt.id, P,
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    yaw: 0, pitch: 0, roll: 0, speed: 0, onGround: true,
    s: 0, lateral: 0, hintS: 0, boost: opt.isPlayer ? 40 : 30,
    gadget: null, gadgetT: 0, gadgetUsed: 0,
    lap: 0, ck: 0, finished: false, finishT: 0, place: 1, placeProg: 0,
    stun: 0, airT: 0, bestLap: 0, lapStart: 0, lastLap: 0,
    skill: opt.skill ?? 0.85, aiOff: (Math.random() - 0.5) * 1.2,
    wantGadget: false, wantBoost: false, accel: 0, steer: 0, brake: 0
  };
  return r;
}

function clearRacers() {
  for (const r of G.racers) scene.remove(r.P.root);
  G.racers = []; player = null;
}

function spawnField(atS, tight = false) {
  clearRacers();
  const T = G.track, len = T.length;
  const start = wrapDist(atS != null ? atS : (len - 16), len);
  player = makeRacer({ isPlayer: true, name: 'WADGET', color: '#5cff3a', id: 'wadget', build: buildTurboHero, skill: 1 });
  G.racers.push(player);
  const order = RIVALS.slice();
  for (let i = 0; i < 5; i++) {
    const def = order[i];
    const skill = 0.70 + i * 0.028 + rnd(-0.03, 0.03);
    G.racers.push(makeRacer({ name: def.name, color: def.color, id: def.id, build: () => def.build(1), skill }));
  }
  // grid: player mid-pack (index 2 visually in a 2-wide grid)
  const slots = [player, ...G.racers.slice(1)];
  // rearrange so player is 4th on the grid (row 2)
  const grid = [slots[1], slots[2], player, slots[3], slots[4], slots[5]];
  G.racers = grid;
  for (let i = 0; i < grid.length; i++) {
    const row = i >> 1, side = i % 2 ? 2.3 : -2.3;
    const s = wrapDist(start - row * (tight ? 6 : 9), len);
    const sm = sampleAt(T, s);
    const r = grid[i];
    r.s = r.hintS = s; r.lateral = side;
    r.pos.copy(sm.p).addScaledVector(sm.b, side).addScaledVector(sm.n, RIDE);
    r.yaw = Math.atan2(sm.t.x, sm.t.z);
    r.pitch = Math.asin(clamp(sm.t.y, -1, 1));
    r.roll = -sm.bank; r.speed = 0; r.vel.set(0, 0, 0);
    r.lap = 0; r.ck = 0; r.finished = false; r.boost = r.isPlayer ? 55 : 35 + rnd(0, 20);
    r.gadget = null; r.gadgetT = 0; r.onGround = true; r.airT = 0; r.stun = 0; r.spinOutT = 0;
    r.bestLap = 0; r.lapStart = 0; r.lastLap = 0;
    poseRacer(r);
  }
  player = G.racers.find(r => r.isPlayer);
  resetDisc();
}

function poseRacer(r) {
  const P = r.P;
  P.root.position.copy(r.pos);
  P.root.rotation.order = 'YXZ';
  P.root.rotation.y = r.yaw;
  P.root.rotation.x = r.pitch;
  P.root.rotation.z = r.roll;
  if ((r.spinOutT || 0) > 0) {
    const u = r.spinOutT;
    P.root.rotation.z = r.roll + u * 14;
    P.root.rotation.x = r.pitch + Math.sin(u * 18) * 0.55;
    P.root.rotation.y = r.yaw + Math.sin(u * 11) * 0.45;
  }
  if (P.shadow) { P.shadow.visible = r.onGround; P.shadow.position.y = -RIDE + 0.05; }
}

function currentMax(r) {
  let m = MAX_SPD * (0.92 + (r.skill - 0.8) * 0.5);
  if (r.rocketT > 0) m = ROCKET_SPD;
  else if (r.boosting) m = BOOST_SPD;
  const pr = project(G.track, r.pos, r.hintS);
  if (pr.surface === 'mud' && pr.onRoad) m *= 0.72;
  if (!pr.onRoad && r.onGround) m *= 0.58;
  if (r.stun > 0) m *= 0.35;
  return m;
}

function useGadget(r) {
  if (!r.gadget || r.gadgetT > 0) return;
  const k = r.gadget; r.gadget = null;
  if (k === 'rocket') { r.rocketT = 1.55; r.boosting = true; if (r.isPlayer) SFX.rocket(); }
  else if (k === 'spring') {
    r.onGround = false; r.vel.y = 22; r.airT = 0; r.springT = 0.5;
    const f = tmpF.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
    r.vel.x += f.x * 8; r.vel.z += f.z * 8;
    if (r.isPlayer) SFX.spring();
  } else if (k === 'grapple') {
    r.grappleT = 0.85; r.grappleS = r.s + 36;
    if (r.isPlayer) SFX.grapple();
  } else if (k === 'heli') { r.heliT = 2.4; if (r.isPlayer) SFX.heli(); }
  else if (k === 'glove') {
    r.gloveT = 0.45;
    if (r.isPlayer) SFX.glove();
    // punch nearest rival ahead
    let best = null, bd = 8;
    for (const o of G.racers) {
      if (o === r || o.finished) continue;
      const d = r.pos.distanceTo(o.pos);
      const ahead = deltaS(r.s, o.s, G.track.length);
      if (d < bd && ahead > -2 && ahead < 14) { bd = d; best = o; }
    }
    if (best) {
      const away = tmpV.subVectors(best.pos, r.pos).setY(0);
      if (away.lengthSq() < 1e-4) away.set(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
      away.normalize();
      best.vel.addScaledVector(away, 38); best.vel.y += 8; best.speed *= 0.45; best.stun = 0.7; best.onGround = false;
      emit(best.pos, 18, [0xff2a6a, 0xffffff], 10, { up: 4 });
      if (r.isPlayer) SFX.bump();
    }
  }
  r.gadgetUsed++;
}

function updateRacer(r, dt) {
  const T = G.track, len = T.length;
  if (r.finished) {
    r.speed = damp(r.speed, 22, 2, dt);
    const sm = sampleAt(T, r.s + r.speed * dt);
    r.s = wrapDist(r.s + r.speed * dt, len);
    r.pos.copy(sm.p).addScaledVector(sm.b, r.lateral).addScaledVector(sm.n, RIDE);
    r.yaw = angLerp(r.yaw, Math.atan2(sm.t.x, sm.t.z), 0.15);
    poseRacer(r);
    return;
  }
  r.stun = Math.max(0, r.stun - dt);
  r.spinOutT = Math.max(0, (r.spinOutT || 0) - dt);
  r.throwT = Math.max(0, (r.throwT || 0) - dt);
  r.rocketT = Math.max(0, (r.rocketT || 0) - dt);
  r.grappleT = Math.max(0, (r.grappleT || 0) - dt);
  r.heliT = Math.max(0, (r.heliT || 0) - dt);
  r.gloveT = Math.max(0, (r.gloveT || 0) - dt);
  r.springT = Math.max(0, (r.springT || 0) - dt);

  if (r.grappleT > 0) {
    const sm = sampleAt(T, r.grappleS);
    const target = sm.p.clone().addScaledVector(sm.n, RIDE);
    r.pos.lerp(target, clamp(dt * 3.2, 0, 1));
    r.s = wrapDist(lerp(r.s, r.grappleS, 0.2) + 40 * dt, len); // pull forward
    r.hintS = r.s;
    r.speed = Math.max(r.speed, MAX_SPD * 0.95);
    r.yaw = angLerp(r.yaw, Math.atan2(sm.t.x, sm.t.z), 0.35);
    r.onGround = true;
  }

  const acc = r.accel, brk = r.brake, steerIn = r.stun > 0 ? 0 : r.steer;
  r.boosting = !!(r.wantBoost && r.boost > 1 && r.rocketT <= 0);
  if (r.boosting) { r.boost = Math.max(0, r.boost - 30 * dt); if (r.boost <= 0) r.boosting = false; }
  else r.boost = Math.min(100, r.boost + (r.isPlayer ? 8.4 : 6.0) * dt);
  if (r.rocketT > 0) r.boosting = true;

  const cap = currentMax(r);
  if (G.mode === 'countdown') {
    r.speed = 0;
  } else {
    if (brk > 0) r.speed = Math.max(0, r.speed - BRAKE * brk * dt);
    else if (acc > 0) r.speed = Math.min(cap, r.speed + ACCEL * acc * (r.boosting ? 1.8 : 1) * dt);
    else r.speed = Math.max(0, r.speed - COAST * dt);
    if (r.speed > cap) r.speed = damp(r.speed, cap, 3, dt);
  }

  const steerRate = STEER * (1.15 - clamp(r.speed / BOOST_SPD, 0, 1) * 0.55);
  r.yaw += steerIn * steerRate * dt;

  const fwd = tmpF.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
  if (r.grappleT <= 0) {
    if (r.onGround) {
      r.vel.x = fwd.x * r.speed; r.vel.z = fwd.z * r.speed;
      // follow road slope
      const pr0 = project(T, r.pos, r.hintS);
      r.vel.y = pr0.t.y * r.speed;
    } else {
      r.vel.x = damp(r.vel.x, fwd.x * r.speed, 1.2, dt);
      r.vel.z = damp(r.vel.z, fwd.z * r.speed, 1.2, dt);
      const gMul = r.heliT > 0 ? 0.18 : 1;
      r.vel.y -= GRAV * gMul * dt;
      if (r.heliT > 0 && r.vel.y < -6) r.vel.y = -6;
      if (r.heliT > 0 && acc > 0) r.vel.y += 10 * dt;
    }
    r.pos.addScaledVector(r.vel, dt);
  }

  const pr = project(T, r.pos, r.hintS);
  r.hintS = pr.s; r.lateral = pr.lateral;
  // lap / checkpoint
  const ds = deltaS(r.s, pr.s, len);
  if (ds > -40 && ds < 80) {
    const prevS = r.s;
    r.s = pr.s;
    if (pr.s > len * 0.4 && pr.s < len * 0.7) r.ck = 1;
    if (r.ck && prevS > len * 0.7 && pr.s < len * 0.25) {
      r.ck = 0; r.lap += 1;
      const lt = G.raceT - r.lapStart; r.lastLap = lt; r.lapStart = G.raceT;
      if (!r.bestLap || lt < r.bestLap) r.bestLap = lt;
      if (r.isPlayer && r.lap < LAPS) { SFX.lap(); showMsg('LAP ' + (r.lap + 1), r.lastLap ? fmtTime(r.lastLap) : '', 1.2); }
      if (r.lap >= LAPS) {
        r.finished = true; r.finishT = G.raceT;
        if (r.isPlayer) maybeFinish();
      }
    }
  } else {
    // projection jumped; snap hint
    r.s = pr.s;
  }

  const roadY = pr.p.y + pr.n.y * RIDE;
  const onRoad = pr.onRoad && !pr.gap;
  if (r.onGround) {
    // unstick if gap / cliff
    const ahead = sampleAt(T, r.s + Math.max(6, r.speed * 0.12));
    if (pr.gap || ahead.gap || (ahead.p.y < pr.p.y - 3.5 && pr.jump || ahead.p.y < pr.p.y - 5)) {
      r.onGround = false; r.airT = 0;
      r.vel.set(fwd.x * r.speed, Math.max(r.vel.y, pr.t.y * r.speed + (pr.jump ? 16 : 6)), fwd.z * r.speed);
      if (r.isPlayer && pr.jump) SFX.jump();
    } else if (onRoad) {
      r.pos.copy(pr.p).addScaledVector(pr.n, RIDE).addScaledVector(pr.b, clamp(pr.lateral, -pr.w * 0.5 + 0.6, pr.w * 0.5 - 0.6) === pr.lateral ? pr.lateral : clamp(pr.lateral, -pr.w * 0.5 - 0.2, pr.w * 0.5 + 0.2));
      // wall bump
      if (Math.abs(pr.lateral) > pr.w * 0.5 + 0.15) {
        const push = Math.sign(pr.lateral) * (Math.abs(pr.lateral) - pr.w * 0.5);
        r.pos.addScaledVector(pr.b, -push);
        r.speed *= 0.82;
        if (r.isPlayer && Math.random() < 0.08) SFX.skid();
      }
      if (!r.isPlayer) {
        const tight = T.id === 'prairie' || pr.wall;
        const destLat = clamp(r.aiOff * (tight ? 0.22 : 0.4), tight ? -0.4 : -1.0, tight ? 0.4 : 1.0);
        r.pos.addScaledVector(pr.b, (destLat - pr.lateral) * Math.min(1, dt * (tight ? 6.0 : 2.4)));
      }
      r.pitch = damp(r.pitch, Math.asin(clamp(pr.t.y, -1, 1)), 8, dt);
      r.roll = damp(r.roll, -pr.bank - steerIn * 0.18, 8, dt);
    } else {
      // off road terrain
      const gy = T.groundFn(r.pos.x, r.pos.z) + 0.6;
      if (r.pos.y <= gy + 0.2) { r.pos.y = gy + 0.6; r.vel.y = 0; r.speed *= 0.99; }
      else { r.onGround = false; r.airT = 0; }
      r.pitch = damp(r.pitch, 0, 4, dt); r.roll = damp(r.roll, -steerIn * 0.2, 4, dt);
    }
  } else {
    r.airT += dt;
    r.pitch = damp(r.pitch, clamp(r.vel.y * 0.02, -0.5, 0.5), 3, dt);
    r.roll = damp(r.roll, -steerIn * 0.25, 3, dt);
    // arcade assist: drift back toward the ribbon while airborne
    if (!pr.gap) {
      const tight = T.id === 'prairie' || pr.wall;
      const aiLike = !r.isPlayer || (DEMO && !G.showcase);
      const dest = aiLike
        ? clamp((r.aiOff || 0) * (tight ? 0.2 : 0.4), tight ? -0.4 : -1.0, tight ? 0.4 : 1.0)
        : clamp(pr.lateral, -pr.w * 0.35, pr.w * 0.35);
      const pull = dt * (aiLike ? (tight ? 5.5 : 2.4) : 1.6);
      r.pos.x += (pr.p.x + pr.b.x * dest - r.pos.x) * pull;
      r.pos.z += (pr.p.z + pr.b.z * dest - r.pos.z) * pull;
    }
    if (onRoad && r.pos.y <= roadY + 0.35 && r.vel.y <= 4) {
      r.onGround = true; r.pos.y = roadY; r.vel.y = 0;
      if (r.isPlayer && r.airT > 0.35) SFX.land();
      r.airT = 0;
    } else if (!onRoad) {
      const gy = T.groundFn(r.pos.x, r.pos.z);
      if (r.pos.y < gy + 0.7 && r.vel.y <= 0) {
        if (gy < -20) {
          // void respawn
          const sm = sampleAt(T, r.s);
          r.pos.copy(sm.p).addScaledVector(sm.n, RIDE + 2);
          r.vel.set(sm.t.x * r.speed * 0.4, 0, sm.t.z * r.speed * 0.4);
          r.speed *= 0.4; r.yaw = Math.atan2(sm.t.x, sm.t.z); r.onGround = true;
          if (r.isPlayer) { SFX.boom(); flash(0.4); }
        } else {
          r.pos.y = gy + 0.7; r.onGround = true; r.vel.y = 0; r.speed *= 0.7;
          if (gy < -2 && r.isPlayer) { emit(r.pos, 10, [0xff6a10, 0xffee44], 5, { up: 3 }); } // lava splash
        }
      }
    }
  }

  // boost pads
  if (r.onGround) {
    for (const pad of T.pads) {
      const d = deltaS(pad.s, r.s, len);
      if (Math.abs(d) < 4 && Math.abs(r.lateral) < pad.w * 0.55) {
        r.boost = Math.min(100, r.boost + 70 * dt);
        r.speed = Math.min(BOOST_SPD, r.speed + 80 * dt);
        if (r.isPlayer && Math.random() < 0.2) SFX.pad();
      }
    }
  }
  // pickups
  if (r.isPlayer) {
    for (const p of T.pickups) {
      if (p.taken) { p.resetT -= dt; if (p.resetT <= 0) { p.taken = false; p.mesh.visible = true; } continue; }
      if (r.pos.distanceTo(p.mesh.position) < 2.6) {
        p.taken = true; p.resetT = 8; p.mesh.visible = false;
        r.gadget = p.kind; SFX.pickup();
        if (!DEMO) {
          const def = GADGETS.find(g => g.id === p.kind);
          showMsg(def ? def.name : 'GADGET', 'PRESS SPACE', 1.0);
        }
      }
    }
  } else if (!r.gadget && r.stun <= 0) {
    // AI silently grabs nearby pickups
    for (const p of T.pickups) {
      if (p.taken) continue;
      if (Math.abs(deltaS(p.s, r.s, len)) < 3 && Math.abs(r.lateral - p.lateral) < 4) {
        // don't steal from the player visually too often; 40%
        if (Math.random() < 0.45) r.gadget = p.kind;
      }
    }
  }

  // Keep AI (and demo autopilot) on the racing line, especially in the prairie canyon.
  if ((!r.isPlayer || (DEMO && !G.showcase)) && (r.grappleT || 0) <= 0 && !r.finished && (r.spinOutT || 0) <= 0 && r.stun <= 0) {
    const tight = T.id === 'prairie' || pr.wall;
    const destLat = clamp(r.aiOff * (tight ? 0.2 : 0.4), tight ? -0.4 : -1.0, tight ? 0.4 : 1.0);
    const ahead = sampleAt(T, r.s + 18);
    const hold = (ahead.jump || ahead.gap || pr.jump) ? 0 : destLat;
    if (!pr.gap && (Math.abs(pr.lateral) > Math.min(2.2, pr.w * 0.42) || !pr.onRoad || (!r.onGround && Math.abs(pr.lateral) > 1.1))) {
      r.pos.copy(pr.p).addScaledVector(pr.n, RIDE).addScaledVector(pr.b, hold);
      r.yaw = angLerp(r.yaw, Math.atan2(pr.t.x, pr.t.z), 0.55);
      r.lateral = hold; r.hintS = pr.s;
      if (r.speed < MAX_SPD * 0.5) r.speed = MAX_SPD * 0.6;
      r.onGround = true;
    } else if (!pr.gap && r.onGround) {
      r.pos.addScaledVector(pr.b, (hold - pr.lateral) * Math.min(1, dt * (tight ? 6.5 : 2.6)));
    }
  }

  poseRacer(r);

  // anim
  const phase = G.t * (4 + r.speed * 0.08);
  const amt = clamp(r.speed / MAX_SPD, 0, 1);
  if (r.isPlayer) {
    animTurboWalrus(r.P, phase, amt, G.t, {
      boost: r.boosting ? 1 : r.speed / MAX_SPD * 0.35, rocket: r.rocketT > 0,
      heli: r.heliT > 0, spring: r.springT > 0, springT: r.springT,
      glove: r.gloveT > 0, gloveT: 0.45 - r.gloveT, grapple: r.grappleT > 0, dt
    });
  } else {
    if (r.P.legL) animLimbs(r.P, phase, amt * 0.6);
    if (r.P.wheels) r.P.wheels.forEach(w => { w.rotation.x += r.speed * dt * 1.4; });
    if (r.P.fans) r.P.fans.forEach(f => { f.rotation.y += dt * 20; });
    if (r.P.rider && r.P.rider.legL) animLimbs(r.P.rider, phase, 0.3);
    r.P.body.position.y = (r.P.hips === r.P.body ? 0 : 0) + Math.abs(Math.sin(phase)) * 0.04 * amt;
  }

  // exhaust / dirt
  if (r.boosting || r.rocketT > 0) {
    const back = tmpV.copy(r.pos).addScaledVector(fwd, -1.8);
    emit(back, r.isPlayer ? 3 : 1, [0xff4a10, 0xffee66, 0xffffff], 8, { vx: -fwd.x * 10, vz: -fwd.z * 10, g: -1, life: 0.35, spread: 0.3 });
  } else if (r.onGround && r.speed > 20 && !onRoad) {
    emit(r.pos, 1, pr.surface === 'mud' ? [0x4a2a10, 0x2a1a08] : [0x8a6a3a, 0xc8a060], 3, { up: 2, g: 8, life: 0.4, spread: 0.4, flat: 1 });
  }
}

function collideRacers() {
  for (let i = 0; i < G.racers.length; i++) {
    for (let j = i + 1; j < G.racers.length; j++) {
      const a = G.racers[i], b = G.racers[j];
      const d = a.pos.distanceTo(b.pos);
      const rad = 2.3;
      if (d < rad && d > 1e-4) {
        const n = tmpV.subVectors(a.pos, b.pos).setY(0).normalize();
        const push = (rad - d) * 0.5;
        a.pos.addScaledVector(n, push); b.pos.addScaledVector(n, -push);
        const rel = a.speed - b.speed;
        a.speed -= rel * 0.18; b.speed += rel * 0.18;
        a.vel.addScaledVector(n, 4); b.vel.addScaledVector(n, -4);
        if ((a.isPlayer || b.isPlayer) && Math.random() < 0.05) SFX.bump();
      }
    }
  }
}

function rankRacers() {
  const len = G.track.length;
  for (const r of G.racers) {
    r.placeProg = (r.finished ? 10000 + (10000 - r.finishT) : 0) + r.lap * len + r.s;
  }
  const sorted = G.racers.slice().sort((a, b) => b.placeProg - a.placeProg);
  sorted.forEach((r, i) => { r.place = i + 1; });
}

// ------------------------------------------------------------------------------------------ spiked disc (always-on weapon)
function getHandPos(out) {
  if (player && player.P && player.P.discMount) {
    player.P.root.updateMatrixWorld(true);
    player.P.discMount.getWorldPosition(out);
    return out;
  }
  if (player) out.copy(player.pos).y += 1.7;
  return out;
}
function resetDisc() {
  discState.state = 'held'; discState.t = 0; discState.cool = 0; discState.target = null; discState.hits.clear();
  discState.vel.set(0, 0, 0); chain.visible = false;
}
function findDiscTarget() {
  if (!player || !G.track) return null;
  const fwdX = Math.sin(player.yaw), fwdZ = Math.cos(player.yaw);
  let best = null, bs = 1e9;
  for (const e of G.racers) {
    if (e.isPlayer || e.finished || (e.spinOutT || 0) > 0.35) continue;
    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 28 || d < 1.2) continue;
    const ang = Math.acos(clamp((dx * fwdX + dz * fwdZ) / (d || 1), -1, 1));
    if (ang > 0.9 && d > 8) continue;
    const ahead = deltaS(player.s, e.s, G.track.length);
    if (ahead < -5) continue;
    const s = d * 0.35 + ang * 9;
    if (s < bs) { bs = s; best = e; }
  }
  return best;
}
function discHit(e) {
  discState.hits.add(e);
  e.stun = 1.5; e.spinOutT = 1.5;
  e.speed *= 0.26;
  const away = tmpV.copy(discState.vel).setY(0);
  if (away.lengthSq() < 1e-4) away.set(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  away.normalize();
  e.vel.addScaledVector(away, 24); e.vel.y += 10; e.onGround = false;
  emit(tmpV2.copy(e.pos).setY(e.pos.y + 1.15), 24, [0xff2a1a, 0xffc23a, 0xffffff], 12, { up: 5 });
  SFX.clang(); SFX.hit();
  G.shake = Math.max(G.shake, 0.32);
}
function throwDisc() {
  if (!player || player.finished) return false;
  if (G.mode !== 'race' && G.mode !== 'countdown') return false;
  if (discState.state !== 'held' || discState.cool > 0) return false;
  getHandPos(discState.pos);
  discState.target = findDiscTarget();
  const fwd = tmpV.set(Math.sin(player.yaw), 0.08, Math.cos(player.yaw));
  if (discState.target) tmpV.copy(discState.target.pos).sub(discState.pos).setY(0.25);
  if (tmpV.lengthSq() < 1e-4) tmpV.set(Math.sin(player.yaw), 0.08, Math.cos(player.yaw));
  tmpV.normalize();
  const launch = (player.speed || 0) + 30;
  discState.vel.copy(tmpV).multiplyScalar(Math.max(48, launch));
  discState.state = 'out'; discState.t = 0; discState.hits.clear();
  player.throwT = 0.28;
  SFX.throw();
  return true;
}
function scriptThrow() {
  if (!player || !G.track) return throwDisc();
  discState.cool = 0;
  if (discState.state !== 'held') resetDisc();
  let best = findDiscTarget();
  if (!best) {
    best = G.racers.filter(r => !r.isPlayer && !r.finished).sort((a, b) => a.pos.distanceTo(player.pos) - b.pos.distanceTo(player.pos))[0];
    if (best) {
      const sm = sampleAt(G.track, wrapDist(player.s + 22, G.track.length));
      best.s = best.hintS = sm.s; best.lateral = 0.35;
      best.pos.copy(sm.p).addScaledVector(sm.b, 0.35).addScaledVector(sm.n, RIDE);
      best.yaw = player.yaw; best.speed = Math.max(40, player.speed * 0.88);
      best.vel.set(Math.sin(best.yaw) * best.speed, 0, Math.cos(best.yaw) * best.speed);
      poseRacer(best);
    }
  }
  return throwDisc();
}
function maybeAutoDisc(dt) {
  if (!(DEMO || G.showcase) || G.mode !== 'race' || !player) return;
  discAIWait -= dt;
  if (discAIWait > 0) return;
  if (discState.state !== 'held' || discState.cool > 0) return;
  const t = findDiscTarget();
  if (t && player.pos.distanceTo(t.pos) < 20) { throwDisc(); discAIWait = 1.8; }
}
function updateDisc(dt) {
  const spin = disc.userData.spin;
  if (!player || G.mode === 'title') { disc.visible = false; chain.visible = false; return; }
  getHandPos(handPos);
  if (discState.cool > 0) discState.cool = Math.max(0, discState.cool - dt);
  if (discState.state === 'held') {
    disc.position.copy(handPos);
    if (player.P.discMount) player.P.discMount.getWorldQuaternion(disc.quaternion);
    spin.rotation.y += dt * 8;
    chain.visible = false; disc.visible = true;
    if (disc.userData.halo) disc.userData.halo.material.opacity = 0.35;
    return;
  }
  disc.visible = true; chain.visible = true;
  if (disc.userData.halo) disc.userData.halo.material.opacity = 0.75;
  discState.t += dt;
  spin.rotation.y += dt * 38;
  if (discState.state === 'out') {
    if (discState.target && !discState.target.finished) {
      tmpV.copy(discState.target.pos).setY(discState.target.pos.y + 1.05).sub(discState.pos);
      const dist = tmpV.length();
      tmpV.normalize().multiplyScalar((player.speed || 0) + 36);
      discState.vel.lerp(tmpV, 1 - Math.exp(-10 * dt));
      if (dist < 1.7) discState.t = 9;
    }
    discState.pos.addScaledVector(discState.vel, dt);
    if (discState.t > 0.7 || discState.pos.distanceTo(player.pos) > 38) { discState.state = 'back'; discState.t = 0; }
  } else {
    tmpV.subVectors(handPos, discState.pos);
    const dist = tmpV.length();
    tmpV.normalize().multiplyScalar((player.speed || 0) + 55 + discState.t * 50);
    discState.vel.lerp(tmpV, 1 - Math.exp(-14 * dt));
    discState.pos.addScaledVector(discState.vel, dt);
    if (dist < 1.5 || discState.t > 2.2) {
      discState.state = 'held'; discState.cool = 0.55; SFX.catch();
      emit(handPos, 8, 0xff3a1a, 3);
    }
  }
  disc.position.copy(discState.pos);
  tmpV2.set(discState.vel.z, 0, -discState.vel.x);
  if (tmpV2.lengthSq() > 1e-6) { tmpV2.normalize(); disc.quaternion.setFromAxisAngle(tmpV2, 0.25); }
  if (Math.random() < 0.85) emit(discState.pos, 1, [0xff2a1a, 0xff6a2a], 0.55, { g: 0, life: 0.35 });
  const away = discState.pos.distanceTo(player.pos);
  if (away > 5 || discState.t > 0.14) {
    for (const e of G.racers) {
      if (e.isPlayer || e.finished || discState.hits.has(e)) continue;
      if (e.pos.distanceTo(discState.pos) < 2.5) {
        discHit(e);
        if (discState.state === 'out') { discState.state = 'back'; discState.t = 0; }
      }
    }
  }
  const len = handPos.distanceTo(discState.pos), sag = Math.min(1.35, len * 0.08) * (discState.state === 'out' ? 0.4 : 1);
  prevPt.copy(handPos);
  for (let i = 0; i < CHAIN_N; i++) {
    const k = (i + 1) / CHAIN_N; bez.lerpVectors(handPos, discState.pos, k); bez.y -= Math.sin(k * Math.PI) * sag;
    tmpV.subVectors(bez, prevPt); const l = tmpV.length() || 0.001;
    cq.setFromUnitVectors(tmpV2.set(0, 0, 1), tmpV.divideScalar(l));
    cs.set(1, 1, Math.min(4, l / 0.16)); cm.compose(tmpV2.lerpVectors(prevPt, bez, 0.5), cq, cs); chain.setMatrixAt(i, cm); prevPt.copy(bez);
  }
  chain.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------------------------------ AI + demo autopilot
function updateAI(r, dt) {

  const T = G.track, len = T.length;
  const pr = project(T, r.pos, r.hintS);
  const look = 12 + r.speed * 0.14;
  const sm = sampleAt(T, r.s + look);
  const smNear = sampleAt(T, r.s + 7);
  const tight = T.id === 'prairie' || !!(sm.wall || smNear.wall);
  // rubber band vs player: keep a close pack, but don't let leaders run away, or backmarkers warp past
  let skill = r.skill;
  if (player && !r.finished) {
    const gap = (r.lap - player.lap) * len + deltaS(player.s, r.s, len);
    if (gap > 22) skill *= 0.80;
    if (gap > 50) skill *= 0.90;
    if (gap < -55) skill *= 1.08;
  }
  const offMax = tight ? 0.35 : 1.0;
  const weave = tight ? 0.15 : 0.35;
  const targetLat = clamp(r.aiOff * 0.45 + Math.sin(G.t * 0.35 + r.aiOff) * weave, -offMax, offMax);
  const aim = sm.p.clone().addScaledVector(sm.b, targetLat);
  const to = tmpV.subVectors(aim, r.pos); to.y = 0;
  const wantYaw = Math.atan2(to.x, to.z);
  let err = wantYaw - r.yaw; err = Math.atan2(Math.sin(err), Math.cos(err));
  const latErr = (pr.lateral || 0) - targetLat;
  r.steer = clamp(err * (tight ? 2.6 : 2.0) + latErr * (tight ? 0.45 : 0.22), -1, 1);
  r.accel = 1; r.brake = 0;
  if (Math.abs(err) > 0.7 && r.speed > 55) r.brake = tight ? 0.4 : 0.25;
  if (!pr.onRoad || Math.abs(pr.lateral) > pr.w * 0.38) {
    const back = sampleAt(T, r.s + 4);
    const inward = Math.atan2(back.t.x, back.t.z);
    let e2 = inward - r.yaw; e2 = Math.atan2(Math.sin(e2), Math.cos(e2));
    r.steer = clamp(e2 * 3 - Math.sign(pr.lateral || 0) * 0.6, -1, 1);
    r.brake = r.speed > 50 ? 0.35 : 0;
    r.wantBoost = false;
  } else {
    r.wantBoost = Math.abs(err) < 0.22 && r.speed > 40 && r.boost > 25 && !tight;
  }
  if (r.gadget && r.stun <= 0) {
    const ahead = sampleAt(T, r.s + 22);
    const gapSoon = ahead.gap || sampleAt(T, r.s + 35).gap;
    if (r.gadget === 'rocket' && Math.abs(err) < 0.18 && !tight) r.wantGadget = true;
    else if (r.gadget === 'spring' && (ahead.jump || gapSoon)) r.wantGadget = true;
    else if (r.gadget === 'heli' && gapSoon) r.wantGadget = true;
    else if (r.gadget === 'grapple' && (Math.abs(sm.bank) > 0.3 || tight)) r.wantGadget = true;
    else if (r.gadget === 'glove') {
      r.wantGadget = G.racers.some(o => o !== r && o.pos.distanceTo(r.pos) < 6 && deltaS(r.s, o.s, len) > 0 && deltaS(r.s, o.s, len) < 10);
    } else r.wantGadget = false;
  } else r.wantGadget = false;
  r.accel *= (skill > 1 ? 1 : 0.88 + skill * 0.12);
}

function updatePlayerInput() {
  const r = player;
  if (DEMO && G.mode !== 'title') {
    updateAI(r, 0);
    // slightly sharper than AI
    r.accel = 1;
    r.wantBoost = r.wantBoost || r.boost > 40;
    // scripted showcase gadgets handled in director
    if (r.wantGadget) useGadget(r);
    maybeAutoDisc(0.016);
    return;
  }
  r.accel = input.accel ? 1 : 0;
  r.brake = input.brake ? 1 : 0;
  r.steer = input.steer;
  r.wantBoost = input.boost;
  if (input.gadget) { useGadget(r); input.gadget = false; }
  if (input.disc) { throwDisc(); input.disc = false; }
}

// ------------------------------------------------------------------------------------------ input
const input = { accel: false, brake: false, steer: 0, boost: false, gadget: false, disc: false, left: false, right: false };
const keys = new Set();
function syncKeys() {
  input.accel = keys.has('KeyW') || keys.has('ArrowUp');
  input.brake = keys.has('KeyS') || keys.has('ArrowDown');
  const l = keys.has('KeyA') || keys.has('ArrowLeft');
  const rgt = keys.has('KeyD') || keys.has('ArrowRight');
  if (!TOUCH || !(input._touchSteer)) input.steer = (rgt ? 1 : 0) - (l ? 1 : 0);
  input.boost = keys.has('ShiftLeft') || keys.has('ShiftRight');
}
addEventListener('keydown', e => {
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (e.code === 'Space') { e.preventDefault(); }
  if (G.mode === 'title') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { cycleTrack(-1); return; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { cycleTrack(1); return; }
    if (anyStart(e)) { titleInput(); return; }
  }
  if ((G.mode === 'results') && G.endT > 1.1) {
    if (G.cup && G.cup.pendingNext) { resultsContinue(); return; }
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { cycleTrack(-1); return; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { cycleTrack(1); toTitle(); return; }
    if (anyStart(e)) { resultsContinue(); return; }
  }
  keys.add(e.code);
  if (e.code === 'Space' && (G.mode === 'race' || G.mode === 'countdown')) input.gadget = true;
  if ((e.code === 'KeyF' || e.code === 'KeyJ' || e.code === 'Enter' || e.code === 'NumpadEnter') && (G.mode === 'race' || G.mode === 'countdown')) { e.preventDefault(); input.disc = true; }
  syncKeys();
});
addEventListener('keyup', e => { keys.delete(e.code); syncKeys(); });
function anyStart(e) { return e.code && !['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Tab'].includes(e.code); }

$('mute').addEventListener('click', e => { e.stopPropagation(); toggleMute(); });
function toggleMute() { const m = Snd.toggleMute(); $('mute').innerHTML = m ? '&#128263;' : '&#128266;'; RaceMusic.sync(); }

// two-step title + general pointer
addEventListener('pointerdown', e => {
  if (e.target === $('mute') || e.target === $('bDisc') || e.target === $('bGadget')) return;
  if (G.mode === 'title') { titleInput(); return; }
  if (G.mode === 'results' && G.endT > 1.1) { resultsContinue(); return; }
  if ((G.mode === 'race' || G.mode === 'countdown') && e.button === 0 && e.pointerType !== 'touch') {
    if (e.target && e.target.classList && e.target.classList.contains('tbtn')) return;
    input.disc = true;
  }
});

// touch controls
(function setupTouch() {
  if (!TOUCH) return;
  const stick = $('stick'), knob = $('knob');
  let sid = null, origin = null;
  const showStick = (on) => { stick.style.display = on ? 'block' : 'none'; };
  addEventListener('pointerdown', e => {
    if (G.mode === 'title' || G.mode === 'results') return;
    const t = e.target;
    if (t.classList && t.classList.contains('tbtn')) return;
    if (e.clientX < innerWidth * 0.5) {
      sid = e.pointerId; origin = { x: e.clientX, y: e.clientY };
      stick.style.left = (e.clientX - 60) + 'px'; stick.style.bottom = (innerHeight - e.clientY - 60) + 'px';
      showStick(true); knob.style.left = '35px'; knob.style.top = '35px';
    }
  });
  addEventListener('pointermove', e => {
    if (e.pointerId !== sid || !origin) return;
    const dx = e.clientX - origin.x, dy = e.clientY - origin.y;
    const m = Math.hypot(dx, dy), cap = 40, k = m > cap ? cap / m : 1;
    knob.style.left = (35 + dx * k) + 'px'; knob.style.top = (35 + dy * k) + 'px';
    input.steer = clamp((dx * k) / cap, -1, 1);
    input._touchSteer = true;
  });
  addEventListener('pointerup', e => {
    if (e.pointerId === sid) { sid = null; origin = null; showStick(false); input.steer = 0; input._touchSteer = false; }
  });
  const hold = (el, fn) => {
    const on = ev => { ev.preventDefault(); ev.stopPropagation(); fn(true); };
    const off = ev => { ev.preventDefault(); fn(false); };
    el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointerleave', off); el.addEventListener('pointercancel', off);
  };
  hold($('bAccel'), v => { input.accel = v; });
  hold($('bBrake'), v => { input.brake = v; });
  hold($('bBoost'), v => { input.boost = v; });
  $('bGadget').addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); input.gadget = true; });
  if ($('bDisc')) $('bDisc').addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); input.disc = true; });
})();

// ------------------------------------------------------------------------------------------ camera
const camState = { p: new THREE.Vector3(0, 8, 20), look: new THREE.Vector3(), fov: 64 };
function snapCam() {
  if (!player) return;
  const r = player, fwd = tmpF.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
  camState.p.copy(r.pos).addScaledVector(fwd, -6.2).y += 2.5;
  camState.look.copy(r.pos).addScaledVector(fwd, 8).y += 1.0;
  camera.position.copy(camState.p); camera.lookAt(camState.look);
}
function updateCamera(dt) {
  if (!player) return;
  const r = player;
  const fwd = tmpF.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
  const up = tmpV2.set(0, 1, 0);
  const back = 5.7 + r.speed * 0.02 + (r.onGround ? 0 : 1.15);
  const height = 2.3 + r.speed * 0.008 + (r.onGround ? 0 : 0.85);
  const desired = tmpV.copy(r.pos).addScaledVector(fwd, -back).addScaledVector(up, height);
  camState.p.lerp(desired, 1 - Math.exp(-6.2 * dt));
  const look = r.pos.clone().addScaledVector(fwd, 8).addScaledVector(up, 1.05);
  camState.look.lerp(look, 1 - Math.exp(-6 * dt));
  if (G.shake > 0) {
    camState.p.x += (Math.random() - 0.5) * G.shake;
    camState.p.y += (Math.random() - 0.5) * G.shake * 0.5;
    G.shake = Math.max(0, G.shake - dt * 3);
  }
  camera.position.copy(camState.p);
  camera.lookAt(camState.look);
  const wantFov = 62 + clamp(r.speed / ROCKET_SPD, 0, 1) * 18 + (r.boosting ? 4 : 0);
  camState.fov = damp(camState.fov, wantFov, 3, dt);
  if (Math.abs(camera.fov - camState.fov) > 0.1) { camera.fov = camState.fov; camera.updateProjectionMatrix(); }
}

// ------------------------------------------------------------------------------------------ title scene
const titleScene = new THREE.Scene();
titleScene.fog = new THREE.FogExp2(0x04140c, 0.02);
titleScene.environment = envTex;
const titleSky = buildSky(); titleScene.add(titleSky);
{
  const u = titleSky.material.uniforms;
  u.top.value.set(0x061018); u.horizon.value.set(0x3a1020); u.bottom.value.set(0x04180c); u.sun.value.set(0xff6a3a); u.sunOn.value = 0;
}
titleScene.add(new THREE.HemisphereLight(0x6aff8a, 0x1a0808, 1.0));
const tSun = new THREE.DirectionalLight(0xffc8a0, 1.2); tSun.position.set(-8, 16, 6); titleScene.add(tSun);
const tFill = new THREE.DirectionalLight(0xfff4e0, 0.95); tFill.position.set(6, 5, 10); titleScene.add(tFill);
const tChin = new THREE.DirectionalLight(0xfff6e8, 1.05); tChin.position.set(0, -1.2, 9); titleScene.add(tChin);
const titleHero = buildTurboHero(); titleHero.root.position.set(0, 0.15, 0); titleHero.root.scale.setScalar(1.15); titleScene.add(titleHero.root);
const titleDisc = buildDisc(1.15); titleHero.discMount.add(titleDisc);
const titlePed = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 0.45, 16), std(0x2a2a22, { roughness: 0.8, map: Tex.rock() }));
titlePed.position.y = -0.15; titleScene.add(titlePed);
const lavaP = new THREE.Mesh(new THREE.CircleGeometry(7, 20), new THREE.MeshStandardMaterial({ color: 0xff6a10, emissive: 0xff3a00, emissiveIntensity: 1.1, map: Tex.lava(2) }));
lavaP.rotation.x = -Math.PI / 2; lavaP.position.y = -0.38; titleScene.add(lavaP);
const tVolc = new THREE.Mesh(new THREE.ConeGeometry(18, 28, 14), std(0x3a2a22, { roughness: 0.95, map: Tex.rock() }));
tVolc.position.set(-24, 8, -46); titleScene.add(tVolc);
const tGlow = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), additive(0xff4a00, 0.45));
tGlow.position.set(-24, 21, -46); titleScene.add(tGlow);
const tSea = new THREE.Mesh(new THREE.CircleGeometry(80, 24), new THREE.MeshStandardMaterial({ color: 0x0c3a14, map: Tex.sea(3), emissive: 0x0a4a14, emissiveIntensity: 0.4, roughness: 0.4 }));
tSea.rotation.x = -Math.PI / 2; tSea.position.y = -0.5; titleScene.add(tSea);
function updateTitle(dt) {
  G.titleT += dt;
  animTurboWalrus(titleHero, G.titleT * 3, 0.3, G.titleT, { boost: 0.55 + 0.25 * Math.abs(Math.sin(G.titleT * 2)), rocket: true, dt });
  if (titleDisc.userData.spin) titleDisc.userData.spin.rotation.y += dt * 9;
  titleHero.root.rotation.y = 0.45 + Math.sin(G.titleT * 0.25) * 0.35;
  const a = 0.55 + G.titleT * 0.12;
  titleCam.position.set(Math.sin(a) * 6.15, 1.95, Math.cos(a) * 6.15);
  titleCam.lookAt(0, 0.88, 0.4);
  titleSky.material.uniforms.time.value = G.titleT;
}

function currentPick() { return PICKS[G.pick] || PICKS[0]; }
function updatePickUI() {
  const el = $('trackPickName'), kind = $('trackPickKind');
  if (!el) return;
  const pk = currentPick();
  if (pk.kind === 'cup') {
    if (kind) kind.textContent = 'MODE';
    el.textContent = 'RIFT CUP';
  } else {
    if (kind) kind.textContent = 'TRACK';
    const T = TRACKS[pk.trackId] || G.track;
    if (T) el.textContent = T.name;
  }
}
function cycleTrack(dir) {
  G.pick = (G.pick + dir + PICKS.length) % PICKS.length;
  const pk = currentPick();
  applyTrack(pk.trackId || 'isle');
  updatePickUI();
}

// ------------------------------------------------------------------------------------------ HUD / messages
let msgT = 0, flashV = 0;
function showMsg(a, b = '', t = 1.6) {
  $('msg').textContent = a; $('sub').textContent = b;
  $('msg').style.opacity = 1; $('sub').style.opacity = b ? 1 : 0;
  msgT = t;
}
function flash(v = 0.7) { flashV = Math.max(flashV, v); }
function fmtTime(t) {
  if (!t && t !== 0) return '--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return m + ':' + s.toFixed(2).padStart(5, '0');
}
function ordinal(n) { const k = n % 10, e = n % 100; if (e !== 11 && k === 1) return n + 'st'; if (e !== 12 && k === 2) return n + 'nd'; if (e !== 13 && k === 3) return n + 'rd'; return n + 'th'; }

function updateHud(dt) {
  if (msgT > 0) { msgT -= dt; if (msgT <= 0) { $('msg').style.opacity = 0; $('sub').style.opacity = 0; } }
  if (flashV > 0) { flashV = Math.max(0, flashV - dt * 1.8); $('flash').style.opacity = flashV; }
  if (G.mode === 'title' || !player) return;
  if (G.mode === 'countdown') {
    const n = Math.ceil(3 - G.countT);
    const label = G.countT >= 3 ? 'GO!' : String(Math.max(1, n));
    $('count').textContent = label;
    $('count').style.opacity = 1;
  } else $('count').style.opacity = 0;
  const cupTag = (G.cup && G.cup.active) ? ('  ·  CUP ' + (G.cup.race + 1) + '/3') : '';
  $('lap').textContent = 'LAP ' + Math.min(LAPS, player.lap + 1) + '/' + LAPS + cupTag;
  const rec = player.bestLap ? '  BEST ' + fmtTime(player.bestLap) : '';
  $('times').textContent = fmtTime(G.mode === 'countdown' ? 0 : G.raceT) + rec;
  $('place').innerHTML = player.place + '<small>/' + G.racers.length + '</small>';
  const kmh = Math.round(player.speed * 3.6);
  $('speedo').innerHTML = String(kmh).padStart(3, '0') + ' <span>KM/H</span>';
  $('boost').style.width = clamp(player.boost, 0, 100) + '%';
  const gdef = GADGETS.find(g => g.id === player.gadget);
  $('gadgetSlot').textContent = gdef ? ('GADGET  ' + gdef.name + '  ·  SPACE') : 'GADGET  —';
  const dEl = $('discSlot');
  if (dEl) {
    if (discState.state !== 'held') dEl.textContent = 'DISC  OUT';
    else if (discState.cool > 0) dEl.textContent = 'DISC  ' + discState.cool.toFixed(1);
    else dEl.textContent = 'DISC  READY  ·  F';
  }
  drawMinimap();
}

function drawMinimap() {
  const c = $('minimap'); if (!c || !G.track) return;
  const ctx = c.getContext('2d'), W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
  const pts = G.track.samples;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (const s of pts) { if (s.p.x < minX) minX = s.p.x; if (s.p.x > maxX) maxX = s.p.x; if (s.p.z < minZ) minZ = s.p.z; if (s.p.z > maxZ) maxZ = s.p.z; }
  const pad = 10, sx = (W - pad * 2) / Math.max(1, maxX - minX), sz = (H - pad * 2) / Math.max(1, maxZ - minZ);
  const sc = Math.min(sx, sz);
  const xx = x => pad + (x - minX) * sc + (W - pad * 2 - (maxX - minX) * sc) * 0.5;
  const zz = z => pad + (z - minZ) * sc + (H - pad * 2 - (maxZ - minZ) * sc) * 0.5;
  ctx.strokeStyle = G.track.palette.accent; ctx.lineWidth = 2; ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i].p; if (pts[i].gap) { ctx.stroke(); ctx.beginPath(); continue; }
    if (i === 0 || pts[i - 1].gap) ctx.moveTo(xx(p.x), zz(p.z)); else ctx.lineTo(xx(p.x), zz(p.z));
  }
  ctx.closePath(); ctx.stroke();
  for (const r of G.racers) {
    ctx.fillStyle = r.isPlayer ? '#fff' : r.color;
    const rad = r.isPlayer ? 4.2 : 2.6;
    ctx.beginPath(); ctx.arc(xx(r.pos.x), zz(r.pos.z), rad, 0, 6.28); ctx.fill();
  }
}

const CUP_PTS = [10, 7, 5, 3, 2, 1];
function beginCup() {
  G.cup = { active: true, done: false, pendingNext: false, race: 0, tracks: TRACK_IDS.slice(), points: {}, totalT: {} };
  G.trackId = G.cup.tracks[0];
  startGame();
  showMsg('RIFT CUP', 'RACE 1 / 3  ·  ' + G.track.name, 2.4);
}
function awardCupPoints() {
  if (!G.cup || !G.cup.active) return;
  for (const r of G.racers) {
    G.cup.points[r.id] = (G.cup.points[r.id] || 0) + (CUP_PTS[r.place - 1] || 0);
    G.cup.totalT[r.id] = (G.cup.totalT[r.id] || 0) + (r.finished ? r.finishT : G.raceT + 15);
  }
}
function cupSorted() {
  return G.racers.slice().sort((a, b) => {
    const pd = (G.cup.points[b.id] || 0) - (G.cup.points[a.id] || 0);
    if (pd) return pd;
    return (G.cup.totalT[a.id] || 0) - (G.cup.totalT[b.id] || 0);
  });
}
function resultsContinue() {
  if (G.cup && G.cup.active && G.cup.pendingNext) {
    G.cup.pendingNext = false;
    G.cup.race++;
    G.trackId = G.cup.tracks[G.cup.race];
    startGame({ continueCup: true });
    showMsg('RACE ' + (G.cup.race + 1) + ' / 3', G.track.name, 2.2);
    return;
  }
  toTitle();
}
function maybeFinish() {
  if (G.mode !== 'race') return;
  if (player && player.finished) {
    G.mode = 'results'; G.endT = 0; SFX.finish();
    document.body.classList.add('playing');
    $('end').style.display = 'flex';
    awardCupPoints();
    const p = player.place;
    if (G.cup && G.cup.active && G.cup.race < G.cup.tracks.length - 1) {
      G.cup.pendingNext = true;
      const next = TRACKS[G.cup.tracks[G.cup.race + 1]];
      $('endTitle').textContent = 'RACE ' + (G.cup.race + 1) + ' / 3';
      $('endText').textContent = G.track.name + '  ·  ' + ordinal(p).toUpperCase() + '  ·  ' + fmtTime(player.finishT) + '  ·  ' + (G.cup.points[player.id] || 0) + ' PTS';
      const sorted = cupSorted();
      $('standings').innerHTML = sorted.map((r, i) => {
        return `<li class="${r.isPlayer ? 'me' : ''}"><span><span class="pos">${i + 1}</span> ${r.name}</span><span>${G.cup.points[r.id] || 0} PTS</span></li>`;
      }).join('');
      $('endPrompt').textContent = 'PRESS ANY KEY / TAP  ·  NEXT: ' + next.name;
    } else if (G.cup && G.cup.active) {
      G.cup.done = true; G.cup.pendingNext = false;
      const sorted = cupSorted();
      const me = sorted.findIndex(r => r.isPlayer) + 1;
      $('endTitle').textContent = me === 1 ? 'CUP CHAMPION!' : ordinal(me).toUpperCase() + ' IN THE CUP';
      $('endText').textContent = (G.cup.points[player.id] || 0) + ' PTS  ·  ' + fmtTime(G.cup.totalT[player.id] || 0) + ' TOTAL';
      $('standings').innerHTML = sorted.map((r, i) => {
        return `<li class="${r.isPlayer ? 'me' : ''}"><span><span class="pos">${i + 1}</span> ${r.name}</span><span>${G.cup.points[r.id] || 0} PTS  ·  ${fmtTime(G.cup.totalT[r.id] || 0)}</span></li>`;
      }).join('');
      $('endPrompt').textContent = 'PRESS ANY KEY / TAP  ·  ← → NEXT TRACK';
    } else {
      $('endTitle').textContent = p === 1 ? 'YOU WIN!' : ordinal(p).toUpperCase() + ' PLACE';
      $('endText').textContent = G.track.name + '  ·  ' + fmtTime(player.finishT) + (player.bestLap ? '  ·  BEST ' + fmtTime(player.bestLap) : '');
      const sorted = G.racers.slice().sort((a, b) => a.place - b.place);
      $('standings').innerHTML = sorted.map(r => {
        const tm = r.finished ? fmtTime(r.finishT) : 'DNF';
        return `<li class="${r.isPlayer ? 'me' : ''}"><span><span class="pos">${r.place}</span> ${r.name}</span><span>${tm}</span></li>`;
      }).join('');
      $('endPrompt').textContent = 'PRESS ANY KEY / TAP  ·  ← → NEXT TRACK';
    }
    Snd.engine(0, false, false);
  }
}

// ------------------------------------------------------------------------------------------ game flow
let titleArmed = false;
function titleInput() {
  if (!titleArmed) { titleArmed = true; Snd.onTitle = true; Snd.init(); $('prompt').textContent = 'PRESS AGAIN TO START'; return; }
  const pk = currentPick();
  if (pk.kind === 'cup') beginCup();
  else { G.cup = null; G.trackId = pk.trackId; startGame(); }
}
function startGame(opts = {}) {
  applyTrack(G.trackId);
  const frac = opts.frac != null ? opts.frac : null;
  const at = frac != null ? frac * G.track.length : null;
  spawnField(at, !!opts.tight);
  G.mode = opts.skipCount ? 'race' : 'countdown';
  G.countT = 0; G.raceT = 0; G.tKeep = G.t;
  for (const r of G.racers) r.lapStart = 0;
  Snd.onTitle = false; SFX.start(); document.body.classList.add('playing');
  $('end').style.display = 'none';
  snapCam();
  RaceMusic.sync();
  if (G.mode === 'countdown') showMsg(G.track.name, G.track.tagline, 2.2);
  if (opts.speed) for (const r of G.racers) r.speed = opts.speed;
  if (opts.gadget && player) player.gadget = opts.gadget;
  AP.reset();
}
function toTitle() {
  clearRacers(); G.mode = 'title'; G.titleT = 0; document.body.classList.remove('playing');
  if (G.cup) { G.cup.active = false; G.cup.pendingNext = false; }
  $('end').style.display = 'none'; $('count').style.opacity = 0;
  Snd.onTitle = true; if (Snd.unlocked) Snd.playTitle();
  $('prompt').textContent = titleArmed ? 'PRESS AGAIN TO START' : 'TAP OR PRESS ANY KEY';
  RaceMusic.sync(); Snd.engine(0, false, false);
}

// ------------------------------------------------------------------------------------------ showcase director (?capture trailer)
const AP = {
  reset() {},
  events: [],
  setupReel() {
    this.events = [
      { t: 3.4, done: false, fn: () => { startGame({ skipCount: true, frac: 0.30, tight: true, speed: 82, gadget: 'rocket' }); flash(0.5); showMsg('STORM ISLE', 'PREHISTORIA', 2); setTimeoutGadget('rocket', 0.2); setTimeoutGadget('spring', 1.7); } },
      { t: 8.4, done: false, fn: () => { scriptThrow(); } },
      { t: 14.2, done: false, fn: () => { scriptThrow(); } },
      { t: 17.6, done: false, fn: () => { wipeTo('prairie', 0.10, 'grapple'); } },
      { t: 19.8, done: false, fn: () => { scriptThrow(); } },
      { t: 22.0, done: false, fn: () => { if (player) { player.gadget = 'spring'; useGadget(player); } } },
      { t: 25.6, done: false, fn: () => { scriptThrow(); } },
      { t: 28.0, done: false, fn: () => { if (player) player.gadget = 'glove'; } },
      { t: 33.2, done: false, fn: () => { wipeTo('grid', 0.34, 'heli'); } },
      { t: 36.0, done: false, fn: () => { scriptThrow(); } },
      { t: 40.5, done: false, fn: () => { if (player) { player.gadget = 'glove'; useGadget(player); } } },
      { t: 43.8, done: false, fn: () => { scriptThrow(); } },
      { t: 48.5, done: false, fn: () => { forceWin(); } }
    ];
  }
};
function setTimeoutGadget(kind, delay) {
  // scheduled via showcase clock in updateDirector
  AP.events.push({ t: G.t + delay, done: false, fn: () => { if (player) { player.gadget = kind; useGadget(player); } } });
}
function wipeTo(id, frac, gadget) {
  flash(0.85); applyTrack(id);
  const at = frac * G.track.length;
  // keep racers, teleport pack
  for (let i = 0; i < G.racers.length; i++) {
    const r = G.racers[i], row = i >> 1, side = r.lateral || (i % 2 ? 2 : -2);
    const lead = r.isPlayer ? 0 : 8 + row * 7;
    const s = wrapDist(at - lead, G.track.length);
    const sm = sampleAt(G.track, s);
    r.s = r.hintS = s; r.lateral = r.isPlayer ? 0 : side * 0.9;
    r.pos.copy(sm.p).addScaledVector(sm.b, r.lateral).addScaledVector(sm.n, RIDE);
    r.yaw = Math.atan2(sm.t.x, sm.t.z); r.pitch = Math.asin(clamp(sm.t.y, -1, 1));
    r.speed = 78 + (r.isPlayer ? 12 : 0); r.onGround = true; r.vel.set(sm.t.x * r.speed, 0, sm.t.z * r.speed);
    r.finished = false; r.lap = 1; r.ck = 1; r.stun = 0; r.spinOutT = 0; r.heliT = r.rocketT = r.grappleT = 0;
    poseRacer(r);
  }
  resetDisc();
  if (player && gadget) { player.gadget = gadget; useGadget(player); }
  snapCam();
  showMsg(G.track.year + '', G.track.name, 2);
  G.mode = 'race'; document.body.classList.add('playing'); $('end').style.display = 'none';
}
function forceWin() {
  if (!player) return;
  player.finished = true; player.finishT = G.raceT; player.lap = LAPS; player.place = 1;
  const others = G.racers.filter(r => !r.isPlayer).sort((a, b) => b.placeProg - a.placeProg);
  others.forEach((r, i) => { r.finished = true; r.finishT = G.raceT + 1.1 + i * 0.55; r.lap = LAPS; });
  rankRacers(); player.place = 1;
  maybeFinish();
}

function updateDirector() {
  if (!G.showcase) return;
  if (!AP.events.length) AP.setupReel();
  for (const ev of AP.events) {
    if (!ev.done && G.t >= ev.t) { ev.done = true; ev.fn(); }
  }
}

// ------------------------------------------------------------------------------------------ loop
function update(dt) {
  G.t += dt;
  if (sky.material.uniforms) sky.material.uniforms.time.value = G.t;
  if (DEMO && G.mode === 'title' && G.t > 3.0 && !G.demoStarted) {
    G.demoStarted = true;
    if (!titleArmed) { titleArmed = true; Snd.onTitle = true; Snd.init(); }
    if (G.showcase) { /* director will start the race */ }
    else startGame();
  }
  updateDirector();
  if (G.mode === 'title') { updateTitle(dt); updateParticles(dt); return; }

  if (G.track && G.track.update) G.track.update(G.t, dt);
  for (const p of G.track.pickups) {
    if (p.mesh && p.mesh.visible) { p.mesh.rotation.y += dt * 2; p.mesh.position.y += Math.sin(G.t * 3 + p.s) * 0.01; }
  }

  if (G.mode === 'countdown') {
    const prev = G.countT;
    G.countT += dt;
    if (prev < 0.05) SFX.count();
    if (prev < 1 && G.countT >= 1) SFX.count();
    if (prev < 2 && G.countT >= 2) SFX.count();
    if (G.countT >= 3) { G.mode = 'race'; G.raceT = 0; SFX.go(); showMsg('GO!', '', 0.7); for (const r of G.racers) r.lapStart = 0; }
  } else if (G.mode === 'race') {
    G.raceT += dt;
  } else if (G.mode === 'results') {
    G.endT += dt;
  }

  if (G.mode === 'race' || G.mode === 'countdown' || (G.mode === 'results' && G.endT < 3)) {
    if (player) updatePlayerInput();
    for (const r of G.racers) {
      if (!r.isPlayer) {
        updateAI(r, dt);
        if (r.wantGadget) useGadget(r);
      }
      updateRacer(r, dt);
    }
    collideRacers();
    rankRacers();
    updateCamera(dt);
    updateDisc(dt);
    if (player) Snd.engine(clamp(player.speed / ROCKET_SPD, 0, 1), player.boosting, G.mode === 'race' || G.mode === 'countdown');
  } else {
    disc.visible = false; chain.visible = false;
  }
  updateParticles(dt);
}

function render() {
  const tt = G.mode === 'title';
  if (tt) { bloom.strength = 0.4; bloom.threshold = 0.82; renderer.toneMappingExposure = 0.95; }
  else if (G.track) { bloom.strength = G.track.lights.bloom * 0.8; bloom.threshold = 0.8; renderer.toneMappingExposure = G.track.lights.exposure; }
  const s = tt ? titleScene : scene, c = tt ? titleCam : camera;
  if (useBloom) { renderPass.scene = s; renderPass.camera = c; composer.render(); }
  else renderer.render(s, c);
}

let lastT = performance.now(), acc = 0, perfN = 0, perfSum = 0, fpsEl = null;
if (Q.has('fps')) { fpsEl = document.createElement('div'); fpsEl.style.cssText = 'position:fixed;left:8px;bottom:8px;font:12px monospace;color:#0f0;z-index:9'; document.body.appendChild(fpsEl); }
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = Math.min(0.5, Math.max(0, (now - lastT) / 1000)); let dt = Math.min(0.1, rawDt); lastT = now; acc += dt;
  const STEP_DT = 1 / 60; let n = 0;
  while (acc >= STEP_DT && n < 6) { update(STEP_DT); acc -= STEP_DT; n++; }
  if (n === 6) acc = 0;
  Snd.update(rawDt); updateHud(dt); RaceMusic.update(rawDt); render();
  if (G.mode === 'race') {
    perfSum += dt; perfN++;
    if (perfN >= 120) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (fpsEl) fpsEl.textContent = (1 / avg).toFixed(0) + ' fps' + (useBloom ? ' bloom' : '') + ' pr ' + pixelRatio.toFixed(2);
      if (avg > 1 / 38 && !Q.has('hifx')) { if (useBloom) useBloom = false; else if (pixelRatio > 0.6) { pixelRatio = Math.max(0.6, pixelRatio * 0.8); renderer.setPixelRatio(pixelRatio); resize(); } }
    }
  }
}
addEventListener('resize', resize); resize();
applyTrack(G.trackId);
camera.position.set(0, 8, 24); camera.lookAt(0, 1, 0);
renderer.compile(scene, camera); renderer.compile(titleScene, titleCam);

if (CAPTURE) {
  const capState = () => ({
    mode: G.mode, track: G.trackId, lap: player ? player.lap : 0, place: player ? player.place : 0,
    gadget: player ? player.gadget : null, disc: discState.state, discHits: discState.hits.size, boost: player ? Math.round(player.boost) : 0,
    speed: player ? Math.round(player.speed) : 0, t: G.t, s: player ? +player.s.toFixed(1) : 0,
    raceT: G.raceT, year: G.track ? G.track.year : null
  });
  window.__cap = {
    step(n) { for (let i = 0; i < n; i++) update(1 / 60); updateHud(n / 60); render(); return capState(); },
    sim(n) { for (let i = 0; i < n; i++) update(1 / 60); return capState(); }
  };
} else requestAnimationFrame(loop);

if (typeof updatePickUI === 'function') updatePickUI();
window.__dbg = { G, get player() { return player; }, TRACKS, applyTrack, startGame, toTitle, beginCup, Snd, camState, throwDisc, scriptThrow, discState, get titleArmed() { return titleArmed; } };
