// Closed-loop racing tracks: spline, ribbon mesh, scenery, projection.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { std, glow, additive, Tex, rnd, pick, clamp, lerp } from './util.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3();
const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Vector3();
const _m = new THREE.Matrix4(), _qv = new THREE.Quaternion(), _sc = new THREE.Vector3();

const crm = (a, b, c, d, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
};

function sampleSpline(pts, closed = true, spacing = 2.2) {
  const n = pts.length, out = [];
  let dist = 0, prev = null;
  const get = i => pts[(i + n) % n];
  for (let i = 0; i < n; i++) {
    const a = get(i - 1), b = get(i), c = get(i + 1), d = get(i + 2);
    // rough segment length
    const seglen = Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
    const steps = Math.max(2, Math.ceil(seglen / spacing));
    for (let s = 0; s < steps; s++) {
      const u = s / steps;
      const x = crm(a.x, b.x, c.x, d.x, u);
      const y = crm(a.y, b.y, c.y, d.y, u);
      const z = crm(a.z, b.z, c.z, d.z, u);
      const w = crm(a.w ?? 12, b.w ?? 12, c.w ?? 12, d.w ?? 12, u);
      const bank = crm(a.bank ?? 0, b.bank ?? 0, c.bank ?? 0, d.bank ?? 0, u);
      if (prev) dist += Math.hypot(x - prev.x, y - prev.y, z - prev.z);
      const surface = u < 0.5 ? (b.surface || 'dirt') : (c.surface || b.surface || 'dirt');
      const gap = !!(u < 0.5 ? b.gap : c.gap);
      const jump = !!(b.jump || c.jump) && u > 0.6 && !!(b.jump);
      const wall = (u < 0.5 ? b.wall : c.wall) || 0;
      const rec = { x, y, z, w, bank, s: dist, surface, gap, jump, wall };
      out.push(rec);
      prev = rec;
    }
  }
  // close length: add last-to-first already included because we iterated all segments
  // re-stamp s, compute frames
  const length = dist || 1;
  const samples = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[(i + 1) % out.length];
    const t = _t.set(b.x - a.x, b.y - a.y, b.z - a.z);
    if (t.lengthSq() < 1e-8) t.set(0, 0, 1); else t.normalize();
    _b.crossVectors(t, WORLD_UP);
    if (_b.lengthSq() < 1e-6) _b.crossVectors(t, new THREE.Vector3(0, 0, 1));
    _b.normalize(); // right
    _n.crossVectors(_b, t).normalize(); // up
    // bank: rotate n and b around tangent
    if (a.bank) {
      _qv.setFromAxisAngle(t, a.bank);
      _n.applyQuaternion(_qv);
      _b.applyQuaternion(_qv);
    }
    samples.push({
      p: new THREE.Vector3(a.x, a.y, a.z),
      t: t.clone(), n: _n.clone(), b: _b.clone(),
      s: a.s, w: a.w, bank: a.bank, surface: a.surface, gap: a.gap, jump: a.jump, wall: a.wall
    });
  }
  return { samples, length };
}

function surfaceOf(name) {
  if (name === 'mud') return { map: Tex.mud(6), color: 0x8a6a3a, roughness: 0.92, metalness: 0 };
  if (name === 'grid') return { map: Tex.neonRoad(8), color: 0xffffff, roughness: 0.35, metalness: 0.55, emissive: 0x220018, emissiveIntensity: 0.5 };
  if (name === 'packed') return { map: Tex.packed(6), color: 0xc8a060, roughness: 0.85, metalness: 0 };
  if (name === 'ash') return { map: Tex.ash(6), color: 0x8a7a68, roughness: 0.9, metalness: 0 };
  return { map: Tex.dirt(6), color: 0xb08a5a, roughness: 0.88, metalness: 0 };
}

function buildRibbon(samples, length, opts = {}) {
  const group = new THREE.Group();
  const bySurf = new Map();
  const curbGeos = [], wallGeos = [], railGeos = [];
  const N = samples.length;
  const uvScale = opts.uvScale || 0.08;
  const curbH = opts.curbH ?? 0.45, curbW = opts.curbW ?? 0.45;
  const pushQuad = (arr, a, b, c, d, u0, u1, v0, v1) => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z]);
    const uv = new Float32Array([u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1]);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    arr.push(g);
  };
  const tmpL0 = new THREE.Vector3(), tmpR0 = new THREE.Vector3(), tmpL1 = new THREE.Vector3(), tmpR1 = new THREE.Vector3();
  const tmpCL0 = new THREE.Vector3(), tmpCR0 = new THREE.Vector3(), tmpCL1 = new THREE.Vector3(), tmpCR1 = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = samples[i], b = samples[(i + 1) % N];
    if (a.gap || b.gap) continue;
    const surf = a.surface || 'dirt';
    if (!bySurf.has(surf)) bySurf.set(surf, []);
    const hw0 = a.w * 0.5, hw1 = b.w * 0.5;
    tmpL0.copy(a.p).addScaledVector(a.b, -hw0);
    tmpR0.copy(a.p).addScaledVector(a.b, hw0);
    tmpL1.copy(b.p).addScaledVector(b.b, -hw1);
    tmpR1.copy(b.p).addScaledVector(b.b, hw1);
    const u0 = a.s * uvScale, u1 = b.s * uvScale;
    pushQuad(bySurf.get(surf), tmpL0, tmpR0, tmpR1, tmpL1, 0, 1, u0, u1);
    const up0 = a.n, up1 = b.n;
    // smooth curb ribbons (top + outer face)
    const lTop0 = tmpL0.clone().addScaledVector(up0, curbH);
    const lOut0 = tmpL0.clone().addScaledVector(a.b, -curbW).addScaledVector(up0, curbH);
    const lBot0 = tmpL0.clone().addScaledVector(a.b, -curbW);
    const lTop1 = tmpL1.clone().addScaledVector(up1, curbH);
    const lOut1 = tmpL1.clone().addScaledVector(b.b, -curbW).addScaledVector(up1, curbH);
    const lBot1 = tmpL1.clone().addScaledVector(b.b, -curbW);
    const rTop0 = tmpR0.clone().addScaledVector(up0, curbH);
    const rOut0 = tmpR0.clone().addScaledVector(a.b, curbW).addScaledVector(up0, curbH);
    const rBot0 = tmpR0.clone().addScaledVector(a.b, curbW);
    const rTop1 = tmpR1.clone().addScaledVector(up1, curbH);
    const rOut1 = tmpR1.clone().addScaledVector(b.b, curbW).addScaledVector(up1, curbH);
    const rBot1 = tmpR1.clone().addScaledVector(b.b, curbW);
    pushQuad(curbGeos, lTop0, lOut0, lOut1, lTop1, 0, 1, u0, u1);
    pushQuad(curbGeos, lOut0, lBot0, lBot1, lOut1, 0, 1, u0, u1);
    pushQuad(curbGeos, rOut0, rTop0, rTop1, rOut1, 0, 1, u0, u1);
    pushQuad(curbGeos, rBot0, rOut0, rOut1, rBot1, 0, 1, u0, u1);
    const wallH = Math.min(8.5, a.wall || opts.defaultWall || 0);
    if (wallH > 0) {
      const vu = wallH * 0.22;   // ~2 tiles tall, tiled along the track by s
      const mkWallQuads = (side) => {
        const out0 = (side < 0 ? tmpL0 : tmpR0).clone().addScaledVector(a.b, side * (curbW + 0.35));
        const out1 = (side < 0 ? tmpL1 : tmpR1).clone().addScaledVector(b.b, side * (curbW + 0.35));
        const top0 = out0.clone().addScaledVector(up0, wallH);
        const top1 = out1.clone().addScaledVector(up1, wallH);
        // face the canyon (inner face first), then a thin top cap
        if (side < 0) {
          pushQuad(wallGeos, out0, out1, top1, top0, u0, u1, 0, vu);
        } else {
          pushQuad(wallGeos, out1, out0, top0, top1, u1, u0, 0, vu);
        }
      };
      mkWallQuads(-1); mkWallQuads(1);
    }
        if (opts.rails) {
      const mkRail = (side, colGeo) => {
        const mid = (side < 0 ? tmpL0.clone().add(tmpL1) : tmpR0.clone().add(tmpR1)).multiplyScalar(0.5)
          .addScaledVector(a.b, side * 0.15).addScaledVector(up0, 0.7);
        const g = new THREE.BoxGeometry(0.12, 0.12, Math.max(0.25, a.p.distanceTo(b.p) + 0.05));
        const basis = new THREE.Matrix4();
        basis.makeBasis(a.b.clone(), a.n.clone(), a.t.clone());
        basis.setPosition(mid);
        g.applyMatrix4(basis);
        colGeo.push(g);
      };
      mkRail(-1, railGeos); mkRail(1, railGeos);
    }
  }
  const mats = {};
  for (const [surf, geos] of bySurf) {
    if (!geos.length) continue;
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const def = surfaceOf(surf);
    const mat = new THREE.MeshStandardMaterial({ ...def, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    group.add(mesh);
    mats[surf] = mat;
  }
  if (curbGeos.length) {
    const merged = mergeGeometries(curbGeos, false);
    if (merged) {
      const curb = new THREE.Mesh(merged, std(opts.curbColor || 0xc8b090, { roughness: 0.7, metalness: 0.1, map: opts.curbMap || null }));
      group.add(curb);
    }
  }
  if (wallGeos.length) {
    const merged = mergeGeometries(wallGeos, false);
    if (merged) {
      const wallMap = opts.wallMap || Tex.rock();
      wallMap.wrapS = wallMap.wrapT = THREE.RepeatWrapping;
      const wall = new THREE.Mesh(merged, std(opts.wallColor || 0x5a4a3a, { roughness: 0.85, map: wallMap }));
      group.add(wall);
    }
  }
  if (railGeos.length) {
    const merged = mergeGeometries(railGeos, false);
    if (merged) {
      const rail = new THREE.Mesh(merged, glow(opts.railColor || 0xff2ad4, 1.4));
      group.add(rail);
    }
  }
  return group;
}

function mergeMesh(geos, mat) {
  if (!geos.length) return null;
  const m = mergeGeometries(geos, false);
  if (!m) return null;
  return new THREE.Mesh(m, mat);
}

function instanced(geo, mat, poses) {
  const mesh = new THREE.InstancedMesh(geo, mat, poses.length);
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i];
    _sc.set(p.s ?? 1, p.sy ?? p.s ?? 1, p.sz ?? p.s ?? 1);
    _qv.setFromEuler(new THREE.Euler(p.rx || 0, p.ry || 0, p.rz || 0));
    _m.compose(new THREE.Vector3(p.x, p.y, p.z), _qv, _sc);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function atS(samples, length, s) {
  s = ((s % length) + length) % length;
  // binary search
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].s <= s) lo = mid; else hi = mid - 1;
  }
  const a = samples[lo], b = samples[(lo + 1) % samples.length];
  const seg = b.s >= a.s ? (b.s - a.s) : (length - a.s + b.s);
  const u = seg > 1e-6 ? (s - a.s < 0 ? (s + length - a.s) : (s - a.s)) / seg : 0;
  const uu = Math.min(1, Math.max(0, u));
  return { a, b, u: uu, i: lo };
}

export function sampleAt(track, s, out = {}) {
  const { samples, length } = track;
  const { a, b, u } = atS(samples, length, s);
  const p = (out.p || new THREE.Vector3()).lerpVectors(a.p, b.p, u);
  const t = (out.t || new THREE.Vector3()).lerpVectors(a.t, b.t, u).normalize();
  const n = (out.n || new THREE.Vector3()).lerpVectors(a.n, b.n, u).normalize();
  const bn = (out.b || new THREE.Vector3()).lerpVectors(a.b, b.b, u).normalize();
  const w = lerp(a.w, b.w, u);
  return { p, t, n, b: bn, w, s: ((s % length) + length) % length, surface: u < 0.5 ? a.surface : b.surface, gap: a.gap || b.gap, jump: a.jump || b.jump, bank: lerp(a.bank, b.bank, u) };
}

export function project(track, pos, hintS) {
  const { samples, length } = track;
  const N = samples.length;
  let start = 0;
  if (hintS != null) {
    const h = atS(samples, length, hintS);
    start = h.i;
  }
  let bestD = 1e15, bestI = start, bestU = 0, bestC = new THREE.Vector3();
  const window = hintS != null ? 28 : N;
  for (let k = 0; k < window; k++) {
    const i = (start + k - (hintS != null ? (window >> 2) : 0) + N * 4) % N;
    const a = samples[i], b = samples[(i + 1) % N];
    const abx = b.p.x - a.p.x, aby = b.p.y - a.p.y, abz = b.p.z - a.p.z;
    const apx = pos.x - a.p.x, apy = pos.y - a.p.y, apz = pos.z - a.p.z;
    const ab2 = abx * abx + aby * aby + abz * abz || 1;
    const u = clamp((apx * abx + apy * aby + apz * abz) / ab2, 0, 1);
    const cx = a.p.x + abx * u, cy = a.p.y + aby * u, cz = a.p.z + abz * u;
    const d = (pos.x - cx) ** 2 + (pos.y - cy) ** 2 + (pos.z - cz) ** 2;
    if (d < bestD) { bestD = d; bestI = i; bestU = u; bestC.set(cx, cy, cz); }
  }
  const a = samples[bestI], b = samples[(bestI + 1) % N];
  const t = _t.lerpVectors(a.t, b.t, bestU).normalize();
  const n = _n.lerpVectors(a.n, b.n, bestU).normalize();
  const bn = _b.lerpVectors(a.b, b.b, bestU).normalize();
  const rel = _q.subVectors(pos, bestC);
  const lateral = rel.dot(bn);
  const w = lerp(a.w, b.w, bestU);
  const seg = b.s >= a.s ? (b.s - a.s) : (length - a.s + b.s);
  const s = (a.s + seg * bestU) % length;
  const gap = a.gap || b.gap;
  const onRoad = !gap && Math.abs(lateral) < w * 0.5 + 0.6 && Math.abs(rel.dot(n)) < 6;
  return {
    s, lateral, onRoad, gap, w,
    p: bestC.clone(), t: t.clone(), n: n.clone(), b: bn.clone(),
    surface: bestU < 0.5 ? a.surface : b.surface,
    jump: a.jump || b.jump,
    wall: a.wall || b.wall,
    dist: Math.sqrt(bestD),
    bank: lerp(a.bank, b.bank, bestU)
  };
}

export function wrapDist(s, length) {
  s = ((s % length) + length) % length;
  return s;
}
export function deltaS(from, to, length) {
  let d = to - from;
  if (d > length * 0.5) d -= length;
  if (d < -length * 0.5) d += length;
  return d;
}

// ---------------------------------------------------------------- sky (shared with title)
export function buildSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() }, sun: { value: new THREE.Color() }, sunOn: { value: 0 }, flash: { value: 0 }, time: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform vec3 top, horizon, bottom, sun; uniform float sunOn, flash, time; varying vec3 vP;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5); }
      void main(){
        float y = vP.y; vec3 c = y > 0.0 ? mix(horizon, top, pow(clamp(y * 2.2, 0.0, 1.0), 0.7)) : mix(horizon, bottom, clamp(-y * 6.0, 0.0, 1.0));
        vec2 sp = vec2(atan(vP.x, -vP.z), y);
        if (sunOn > 0.5) {
          vec2 d = vec2(sp.x * 1.0, sp.y - 0.12); float r = length(d);
          float stripes = step(0.0, sin((sp.y) * 160.0 + time * 2.0)) + step(0.11, sp.y);
          float disc = smoothstep(0.205, 0.2, r) * min(1.0, stripes);
          vec3 sc = mix(vec3(1.0, 0.2, 0.6), vec3(1.0, 0.85, 0.2), clamp((sp.y + 0.05) * 3.5, 0.0, 1.0));
          c = mix(c, sc * 0.8, disc * step(-0.02, sp.y)); c += sc * 0.1 * smoothstep(0.5, 0.0, r) * step(-0.02, sp.y);
        }
        vec2 g = floor(vec2(sp.x * 120.0, y * 120.0)); float st = step(0.996, h21(g)) * step(0.15, y);
        c += vec3(st) * (0.6 + 0.4 * sin(time * 3.0 + g.x));
        c += sun * flash * smoothstep(-0.1, 0.4, y);
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -1;
  return m;
}

// ---------------------------------------------------------------- finish gate + boost pad visuals
function buildGate(sample, color = 0xff2ad4) {
  const g = new THREE.Group();
  const hw = sample.w * 0.5 + 0.6;
  const post = std(0x222228, { metalness: 0.7, roughness: 0.3 });
  const bar = glow(color, 1.8);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6.2, 0.4), post);
    p.position.copy(sample.p).addScaledVector(sample.b, s * hw).addScaledVector(sample.n, 3.1);
    g.add(p);
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 0.8, 0.35, 0.35), bar);
  top.position.copy(sample.p).addScaledVector(sample.n, 6.2);
  g.add(top);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 1.6, 1.1), new THREE.MeshBasicMaterial({
    map: Tex.sign('FINISH', '#ffffff', 'rgba(0,0,0,0.45)'), transparent: true, side: THREE.DoubleSide, toneMapped: false
  }));
  banner.position.copy(sample.p).addScaledVector(sample.n, 5.4).addScaledVector(sample.t, 0.2);
  banner.lookAt(banner.position.clone().add(sample.t));
  g.add(banner);
  // start line stripes
  const line = new THREE.Mesh(new THREE.PlaneGeometry(sample.w, 2.2), new THREE.MeshBasicMaterial({
    map: Tex.boost(), transparent: true, opacity: 0.85, side: THREE.DoubleSide, toneMapped: false
  }));
  line.position.copy(sample.p).addScaledVector(sample.n, 0.06);
  line.lookAt(line.position.clone().add(sample.n));
  g.add(line);
  return g;
}

function buildBoostPadMesh(sample, color = 0xffee44) {
  const g = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(sample.w * 0.7, 6), new THREE.MeshBasicMaterial({
    map: Tex.boost(), transparent: true, opacity: 0.95, side: THREE.DoubleSide, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false
  }));
  plane.position.copy(sample.p).addScaledVector(sample.n, 0.08);
  // orient: plane faces up (n), length along tangent
  const basis = new THREE.Matrix4();
  basis.makeBasis(sample.b.clone(), sample.t.clone().negate(), sample.n.clone());
  plane.setRotationFromMatrix(basis);
  plane.position.copy(sample.p).addScaledVector(sample.n, 0.08);
  g.add(plane);
  return g;
}

// ================================================================= TRACK DEFS
function pt(x, y, z, o = {}) { return { x, y, z, w: o.w ?? 13, bank: o.bank ?? 0, surface: o.surface, gap: o.gap, jump: o.jump, wall: o.wall ?? 0 }; }

function islePoints() {
  // Loop around a central volcano, lava jump on the south, mud on the west, hairpin north.
  return [
    pt(0, 0.4, 130, { w: 15, surface: 'ash' }),
    pt(40, 0.4, 140, { w: 14, surface: 'ash' }),
    pt(90, 0.8, 120, { w: 14, bank: 0.25, surface: 'dirt' }),
    pt(125, 1.2, 80, { w: 13, bank: 0.4, surface: 'dirt' }),
    pt(145, 1.6, 30, { w: 13, bank: 0.45, surface: 'dirt' }),
    pt(140, 2.2, -25, { w: 13, bank: 0.2, surface: 'dirt' }),
    pt(115, 5.0, -70, { w: 12, surface: 'ash' }),          // climb to ramp
    pt(85, 12.0, -95, { w: 11, surface: 'ash' }),
    pt(50, 16.5, -110, { w: 11, surface: 'ash', jump: 1 }), // lip
    pt(10, 10.0, -118, { w: 12, gap: 1 }),                  // lava gap
    pt(-30, 1.2, -120, { w: 13, surface: 'dirt' }),         // landing
    pt(-70, 0.4, -100, { w: 13, surface: 'mud' }),
    pt(-110, 0.2, -60, { w: 12, bank: -0.25, surface: 'mud', wall: 7 }),
    pt(-135, 0.3, -10, { w: 12, bank: -0.3, surface: 'mud', wall: 8 }),
    pt(-140, 1.4, 45, { w: 12, bank: -0.3, surface: 'dirt', wall: 6 }),
    pt(-120, 5.5, 95, { w: 12, bank: -0.15, surface: 'ash' }),
    pt(-80, 9.0, 125, { w: 12, surface: 'ash' }),
    pt(-35, 7.0, 145, { w: 11, bank: 0.55, surface: 'ash' }), // hairpin
    pt(5, 2.4, 150, { w: 13, bank: 0.3, surface: 'ash' }),
    pt(20, 0.6, 140, { w: 14, surface: 'ash' })
  ];
}

function prairiePoints() {
  // Winding canyon, trestle jump, long banked sweeper, packed-dirt straights.
  return [
    pt(0, 1, 0, { w: 14, surface: 'packed' }),
    pt(50, 1, 20, { w: 14, surface: 'packed' }),
    pt(110, 1.4, 10, { w: 13, surface: 'packed' }),
    pt(160, 2, -30, { w: 13, bank: 0.3, surface: 'dirt', wall: 10 }),
    pt(180, 2.4, -90, { w: 12, bank: 0.4, surface: 'dirt', wall: 12 }),
    pt(150, 3, -150, { w: 12, bank: 0.2, surface: 'dirt', wall: 12 }),
    pt(80, 6, -190, { w: 12, surface: 'packed', wall: 8 }),
    pt(20, 10, -200, { w: 11, surface: 'packed' }),
    pt(-20, 14, -190, { w: 11, surface: 'packed', jump: 1 }), // trestle lip
    pt(-70, 9, -170, { w: 12, gap: 1 }),
    pt(-110, 1.5, -140, { w: 13, surface: 'dirt' }),
    pt(-160, 1, -90, { w: 13, bank: -0.35, surface: 'dirt', wall: 11 }),
    pt(-190, 1.2, -20, { w: 12, bank: -0.45, surface: 'dirt', wall: 11 }),
    pt(-180, 1.6, 60, { w: 12, bank: -0.35, surface: 'packed', wall: 9 }),
    pt(-140, 2, 120, { w: 13, bank: -0.2, surface: 'packed' }),
    pt(-70, 1.4, 160, { w: 14, surface: 'packed' }),
    pt(10, 1, 150, { w: 14, bank: 0.35, surface: 'packed' }),
    pt(60, 1, 90, { w: 14, bank: 0.2, surface: 'packed' }),
    pt(40, 1, 30, { w: 14, surface: 'packed' })
  ];
}

function gridPoints() {
  // Angular F-Zero neon circuit with a big mid-air gap and banked corners.
  return [
    pt(0, 8, 0, { w: 14, surface: 'grid' }),
    pt(80, 8, 0, { w: 14, surface: 'grid' }),
    pt(150, 8, 10, { w: 13, surface: 'grid' }),
    pt(200, 9, 60, { w: 13, bank: 0.55, surface: 'grid' }),
    pt(210, 10, 130, { w: 13, bank: 0.55, surface: 'grid' }),
    pt(170, 11, 190, { w: 13, bank: 0.4, surface: 'grid' }),
    pt(90, 12, 210, { w: 14, surface: 'grid' }),
    pt(20, 14, 210, { w: 12, surface: 'grid' }),
    pt(-30, 18, 200, { w: 12, surface: 'grid', jump: 1 }),
    pt(-90, 16, 180, { w: 12, gap: 1 }),                    // void gap
    pt(-150, 10, 150, { w: 13, surface: 'grid' }),
    pt(-200, 9, 90, { w: 13, bank: -0.5, surface: 'grid' }),
    pt(-210, 8, 10, { w: 13, bank: -0.5, surface: 'grid' }),
    pt(-180, 8, -70, { w: 13, bank: -0.35, surface: 'grid' }),
    pt(-110, 8, -120, { w: 14, surface: 'grid' }),
    pt(-20, 8, -130, { w: 14, surface: 'grid' }),
    pt(60, 8, -110, { w: 14, bank: 0.4, surface: 'grid' }),
    pt(100, 8, -50, { w: 14, bank: 0.25, surface: 'grid' }),
    pt(60, 8, -10, { w: 14, surface: 'grid' })
  ];
}

function placeAlong(track, s, lateral, yOff = 0) {
  const sm = sampleAt(track, s);
  const p = sm.p.clone().addScaledVector(sm.b, lateral).addScaledVector(sm.n, yOff);
  return { p, sm };
}

function addFinishAndPads(track, padList, pickupList, colors) {
  const g = track.group;
  g.add(buildGate(sampleAt(track, 0), colors.gate));
  track.pads = [];
  for (const s of padList) {
    const sm = sampleAt(track, s);
    const m = buildBoostPadMesh(sm, colors.boost);
    g.add(m);
    track.pads.push({ s, w: sm.w * 0.7, mesh: m });
  }
  track.pickups = pickupList.map((q, i) => {
    const kind = q.kind;
    return { s: q.s, lateral: q.lateral || 0, kind, taken: false, mesh: null, resetT: 0 };
  });
}

// --- scenery builders ---
function nearTrack(samples, x, z, margin = 10) {
  let best = 1e9;
  for (let i = 0; i < samples.length; i += 2) {
    const s = samples[i], d = Math.hypot(s.p.x - x, s.p.z - z) - s.w * 0.5;
    if (d < best) best = d;
  }
  return best < margin;
}

function volcano(group, track) {
  const rock = std(0x5a4a3c, { roughness: 0.92, map: Tex.rock() });
  const lavaM = new THREE.MeshStandardMaterial({ color: 0xff6a10, emissive: 0xff3a00, emissiveIntensity: 1.6, roughness: 0.5, map: Tex.lava(2) });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(52, 64, 20), rock);
  cone.position.set(0, 28, 10); group.add(cone);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(11, 3.2, 8, 18), rock);
  lip.rotation.x = Math.PI / 2; lip.position.set(0, 58, 10); group.add(lip);
  const crater = new THREE.Mesh(new THREE.CircleGeometry(10.5, 16), lavaM);
  crater.rotation.x = -Math.PI / 2; crater.position.set(0, 58.3, 10); group.add(crater);
  const glowS = new THREE.Mesh(new THREE.SphereGeometry(10, 12, 8), additive(0xff4a00, 0.4));
  glowS.position.set(0, 59, 10); group.add(glowS);
  const river = new THREE.Mesh(new THREE.PlaneGeometry(100, 50, 1, 1), lavaM);
  river.rotation.x = -Math.PI / 2; river.position.set(10, -1.2, -115); group.add(river);
  const sea = new THREE.Mesh(new THREE.CircleGeometry(480, 40), new THREE.MeshStandardMaterial({
    color: 0x0c3a14, roughness: 0.35, metalness: 0.15, map: Tex.sea(4), emissive: 0x0a4a14, emissiveIntensity: 0.55
  }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -2.4; group.add(sea);
  for (const [x, z, r] of [[20, -100, 18], [-10, -130, 14], [60, -80, 10], [-40, 20, 8]]) {
    const pl = new THREE.Mesh(new THREE.CircleGeometry(r, 14), lavaM);
    pl.rotation.x = -Math.PI / 2; pl.position.set(x, -0.6, z); group.add(pl);
  }
  const poses = [];
  const samples = track && track.samples;
  for (let i = 0; i < 50; i++) {
    const ang = Math.random() * Math.PI * 2, rad = 58 + Math.random() * 150;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (Math.hypot(x, z - 10) < 54) continue;
    if (samples && nearTrack(samples, x, z, 12)) continue;
    poses.push({ x, y: 1.5 + Math.random() * 5, z, s: 3 + Math.random() * 6, sy: 5 + Math.random() * 12, sz: 3 + Math.random() * 6, ry: Math.random() * 6 });
  }
  group.add(instanced(new THREE.ConeGeometry(1, 1, 5), rock, poses));
  const boulders = poses.slice(0, 16).map(pp => ({ ...pp, y: pp.y * 0.4, sy: pp.sy * 0.45 }));
  group.add(instanced(new THREE.DodecahedronGeometry(1, 0), rock, boulders));
}

function mesas(group, track) {
  const rock = std(0xc48a48, { roughness: 0.9, map: Tex.rock() });
  const dirt = std(0x6a4a22, { roughness: 0.95, map: Tex.prairie(2) });
  const ground = new THREE.Mesh(new THREE.CircleGeometry(480, 36), dirt);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; group.add(ground);
  const samples = track && track.samples;
  const poses = [];
  for (let i = 0; i < 22; i++) {
    const ang = i / 22 * Math.PI * 2 + 0.2, rad = 80 + (i % 3) * 45 + Math.random() * 20;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (samples && nearTrack(samples, x, z, 16)) continue;
    poses.push({ x, y: 8 + (i % 5) * 3, z, s: 10 + (i % 4) * 4, sy: 16 + (i % 5) * 6, ry: ang });
  }
  group.add(instanced(new THREE.CylinderGeometry(1, 1.3, 1, 7), rock, poses));
  const cactusM = std(0x2a6a28, { roughness: 0.85 });
  const cactus = new THREE.CylinderGeometry(0.3, 0.4, 3.2, 6);
  const cPos = [];
  for (let i = 0; i < 50; i++) {
    const ang = Math.random() * 6.28, rad = 50 + Math.random() * 220;
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (samples && nearTrack(samples, x, z, 8)) continue;
    cPos.push({ x, y: 1.6, z, s: 0.8 + Math.random() * 1.4, sy: 1 + Math.random(), ry: Math.random() * 6 });
  }
  group.add(instanced(cactus, cactusM, cPos));
}

function buildTrain(group, track) {
  // a looping robot train on a rail offset from the prairie track
  const iron = std(0x3a3a42, { metalness: 0.9, roughness: 0.3 });
  const rust = std(0x6a3a18, { metalness: 0.7, roughness: 0.4 });
  const train = new THREE.Group(); train.name = 'train';
  const mkCar = (isEngine) => {
    const c = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, isEngine ? 4.2 : 3.4), isEngine ? rust : iron);
    box.position.y = 1.1; c.add(box);
    if (isEngine) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1.2, 8), iron);
      stack.position.set(0, 2.4, 1.2); c.add(stack);
    }
    return c;
  };
  const cars = [];
  for (let i = 0; i < 6; i++) { const c = mkCar(i === 0); train.add(c); cars.push(c); }
  group.add(train);
  track._train = { cars, offset: 18, s0: 40 };
}

function neonCity(group) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(500, 32), new THREE.MeshStandardMaterial({
    color: 0x020308, roughness: 0.7, metalness: 0.3, map: Tex.grid(20), emissive: 0x041008, emissiveIntensity: 0.18
  }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -36; group.add(ground);
  const colA = std(0x0a0612, { roughness: 0.5, metalness: 0.4, map: Tex.windows(0.55, ['#ff2ad4', '#2af0ff', '#ff77cc', '#66ffff']), emissive: 0x220010, emissiveIntensity: 0.3 });
  const colB = std(0x060a08, { roughness: 0.5, metalness: 0.4, map: Tex.windows(0.45, ['#39ff6a', '#c8ffd8', '#2aff80']), emissive: 0x002208, emissiveIntensity: 0.25 });
  const posesA = [], posesB = [];
  for (let i = 0; i < 50; i++) {
    const a = Math.random() * 6.28, r = 40 + Math.random() * 260;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = 18 + Math.random() * 55;
    (i % 2 ? posesA : posesB).push({ x, y: -10 + h / 2, z, s: 6 + Math.random() * 8, sy: h, sz: 6 + Math.random() * 8, ry: (Math.random() * 4 | 0) * Math.PI / 2 });
  }
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), colA, posesA));
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), colB, posesB));
  // floating billboard rings
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2, r = 90;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(8, 0.25, 8, 24), glow(i % 2 ? 0x39ff6a : 0xff2ad4, 1.6));
    ring.position.set(Math.cos(a) * r, 22 + (i % 3) * 6, Math.sin(a) * r);
    ring.rotation.y = a; group.add(ring);
  }
}

function isleGround(x, z) {
  const r = Math.hypot(x, z - 10);
  if (r < 48) return 22 + (48 - r) * 0.9;          // volcano slope (not driveable really)
  // lava basin south
  if (z < -95 && z > -140 && x > -50 && x < 80) return -6;
  const sea = -2.2;
  const hump = Math.sin(x * 0.02) * Math.cos(z * 0.015) * 1.5;
  return Math.max(sea, 0.0 + hump);
}

function prairieGround(x, z) {
  const hills = Math.sin(x * 0.01) * 2 + Math.cos(z * 0.012) * 1.4;
  return -1.2 + hills;
}

function gridGround(/*x, z*/) { return -80; }   // void

function decoratePickups() { /* meshes attached in main via buildPickup */ }

function packTrack(id, name, year, tagline, pts, look, sceneryFn, groundFn, pads, pickups, opts) {
  const { samples, length } = sampleSpline(pts, true, 2.4);
  const track = {
    id, name, year, tagline, length, samples,
    palette: look.palette, fog: look.fog, sky: look.sky, lights: look.lights,
    group: new THREE.Group(), groundFn, pads: [], pickups: [],
    music: look.music || null
  };
  const group = track.group;
  group.add(buildRibbon(samples, length, opts.ribbon || {}));
  sceneryFn(group, track);
  const scaleS = s => (s / 800) * length;
  addFinishAndPads(track, pads.map(scaleS), pickups.map(q => ({ ...q, s: scaleS(q.s) })), { gate: look.palette.portal || 0xff2ad4, boost: 0xffee44 });
  if (opts.after) opts.after(group, track);
  track.update = (t, dt) => {
    if (track._train) {
      const tr = track._train;
      for (let i = 0; i < tr.cars.length; i++) {
        const s = wrapDist(tr.s0 + t * 28 - i * 5.2, length);
        const sm = sampleAt(track, s);
        const p = sm.p.clone().addScaledVector(sm.b, tr.offset).addScaledVector(sm.n, 0.2);
        tr.cars[i].position.copy(p);
        tr.cars[i].lookAt(p.clone().add(sm.t));
        tr.cars[i].up.copy(sm.n);
      }
    }
  };
  return track;
}

export const TRACKS = {};
export const TRACK_IDS = ['isle', 'prairie', 'grid'];

export function buildTracks() {
  TRACKS.isle = packTrack(
    'isle', 'STORM ISLE', 'PRE', 'VOLCANIC DIRT CIRCUIT',
    islePoints(),
    {
      palette: { accent: '#5cff3a', accent2: '#ff2ad4', portal: 0x5cff3a, hud: '#7aff5a' },
      fog: { color: 0x042010, density: 0.008 },
      sky: { top: 0x061018, horizon: 0x3a1020, bottom: 0x04180c, sun: 0xff6a3a, sunOn: 0 },
      lights: { hemi: [0x6aff8a, 0x1a0808, 0.95], dir: [0xffc8a0, 1.15, [-18, 48, 8]], exposure: 1.05, bloom: 0.55 }
    },
    volcano, isleGround,
    [90, 280, 520],
    [
      { s: 140, lateral: 3, kind: 'rocket' },
      { s: 240, lateral: -3, kind: 'spring' },
      { s: 400, lateral: 2.5, kind: 'grapple' },
      { s: 620, lateral: -2, kind: 'heli' },
      { s: 740, lateral: 3, kind: 'glove' }
    ],
    { ribbon: { curbColor: 0x5a3a22, wallColor: 0x3a2a22, wallMap: Tex.rock(), defaultWall: 0 } }
  );
  TRACKS.prairie = packTrack(
    'prairie', 'IRON PRAIRIE', '1885', 'CANYON RUN',
    prairiePoints(),
    {
      palette: { accent: '#ffb02a', accent2: '#c8e8ff', portal: 0xffb02a, hud: '#ffc04a' },
      fog: { color: 0x3a2614, density: 0.007 },
      sky: { top: 0x1a0e18, horizon: 0xff6a2a, bottom: 0x4a2010, sun: 0xffc040, sunOn: 1 },
      lights: { hemi: [0xffc090, 0x3a1808, 1.0], dir: [0xffe0b0, 1.4, [20, 48, -10]], exposure: 1.12, bloom: 0.65 }
    },
    mesas, prairieGround,
    [80, 360, 620],
    [
      { s: 120, lateral: -3, kind: 'grapple' },
      { s: 250, lateral: 3, kind: 'rocket' },
      { s: 430, lateral: -2, kind: 'spring' },
      { s: 580, lateral: 3, kind: 'glove' },
      { s: 750, lateral: -3, kind: 'heli' }
    ],
    { ribbon: { curbColor: 0xe0b060, wallColor: 0x9a6a38, wallMap: Tex.rock(), defaultWall: 0 }, after: buildTrain }
  );
  TRACKS.grid = packTrack(
    'grid', 'THE SOURCE GRID', '2199', 'NEON VOID CIRCUIT',
    gridPoints(),
    {
      palette: { accent: '#39ff6a', accent2: '#ff2ad4', portal: 0x39ff6a, hud: '#39ff6a' },
      fog: { color: 0x020805, density: 0.006 },
      sky: { top: 0x000000, horizon: 0x052010, bottom: 0x010302, sun: 0x39ff6a, sunOn: 0 },
      lights: { hemi: [0x4aff80, 0x021008, 0.85], dir: [0xa8ffc0, 1.0, [10, 52, -16]], exposure: 1.02, bloom: 0.48 }
    },
    neonCity, gridGround,
    [60, 300, 700],
    [
      { s: 100, lateral: 3, kind: 'rocket' },
      { s: 260, lateral: -3, kind: 'heli' },
      { s: 420, lateral: 2, kind: 'glove' },
      { s: 560, lateral: -3, kind: 'grapple' },
      { s: 780, lateral: 3, kind: 'spring' }
    ],
    { ribbon: { curbColor: 0x220018, rails: true, railColor: 0x39ff6a, defaultWall: 0 } }
  );
  return TRACKS;
}

export function logTrackInfo() {
  for (const id of TRACK_IDS) {
    const t = TRACKS[id];
    console.log(id, 'length', t.length.toFixed(1), 'samples', t.samples.length);
  }
}
