// Low-poly models built from primitives. All original designs.
// Hero: Wadget (small black alien) riding a TURBO chained walrus (boosters, thrusters, chrome harness).
import * as THREE from 'three';
import { std, glow, additive, rimify, part, grp, pick, Tex } from './util.js';

const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 14, 10),
  sphLo: new THREE.SphereGeometry(1, 8, 6),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 6),
  cone: new THREE.ConeGeometry(1, 1, 6),
  cone4: new THREE.ConeGeometry(1, 1, 4),
  tor: new THREE.TorusGeometry(1, 0.2, 8, 20),
};
export { G as GEO };
const B = (p, m, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => part(p, G.box, m, x, y, z, rx, ry, rz, sx, sy, sz);
const S = (p, m, x, y, z, r, sy = 1, sz = 1) => part(p, G.sph, m, x, y, z, 0, 0, 0, r, r * sy, r * sz);
const C = (p, m, x, y, z, r, h, rx = 0, ry = 0, rz = 0, r2) => { const mm = part(p, G.cyl, m, x, y, z, rx, ry, rz, r, h, r2 ?? r); return mm; };
const K = (p, m, x, y, z, r, h, rx = 0, ry = 0, rz = 0, geo = G.cone) => part(p, geo, m, x, y, z, rx, ry, rz, r, h, r);

// ---------------------------------------------------------------- the spiked disc shield (identical to the original throw)
export function buildDisc(scale = 1) {
  const g = new THREE.Group(), spin = grp(g);
  const red = glow(0xff2a1a, 2.6), metal = std(0x3a3a40, { metalness: 0.9, roughness: 0.3 }), steel = std(0xc8c8d0, { metalness: 1, roughness: 0.22 });
  part(spin, G.tor, red, 0, 0, 0, Math.PI / 2, 0, 0, 0.3, 0.3, 0.3);
  C(spin, metal, 0, 0, 0, 0.27, 0.05);
  C(spin, red, 0, 0.03, 0, 0.1, 0.03);
  part(spin, G.tor, steel, 0, 0, 0, Math.PI / 2, 0, 0, 0.17, 0.17, 0.12);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2, s = K(spin, steel, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4, 0.05, 0.22, 0, 0, 0, G.cone4);
    s.rotation.set(0, -a, -Math.PI / 2); s.rotateZ(0.5);
  }
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.5), additive(0xff2a1a, 0.55, { map: Tex.ring(), side: THREE.DoubleSide }));
  halo.rotation.x = -Math.PI / 2; spin.add(halo);
  g.scale.setScalar(scale); g.userData.spin = spin; g.userData.halo = halo;
  return g;
}

// ---------------------------------------------------------------- Wadget riding the chained walrus
export function buildHero() {
  // Dark, wet, green-black hide — matches the reference painting (not brown).
  const hide = std(0x2a3830, { roughness: 0.58, metalness: 0.14 });
  const hideWet = std(0x2a4a32, { roughness: 0.36, metalness: 0.22, emissive: 0x1a5a22, emissiveIntensity: 0.4 });
  const belly = std(0x3a5a40, { roughness: 0.5, metalness: 0.1, emissive: 0x1a4a1c, emissiveIntensity: 0.28 });
  const whisk = std(0x1a1814, { roughness: 0.8 });
  const ivory = std(0xfff1d6, { roughness: 0.45, metalness: 0.06, emissive: 0xffe0b0, emissiveIntensity: 0.32 });
  const slime = glow(0x5cff3a, 1.55);
  const slimeDim = glow(0x2aaf20, 1.0);
  const iron = std(0x6a6a72, { metalness: 0.95, roughness: 0.28 });
  const rust = std(0x5a3a22, { metalness: 0.85, roughness: 0.42 });
  const rivet = std(0xc8c8d0, { metalness: 1, roughness: 0.2 });
  const alien = std(0x07070a, { roughness: 0.42 });
  const wEye = std(0x2a1a08, { roughness: 0.45, emissive: 0xffaa44, emissiveIntensity: 0.7 });

  const root = new THREE.Group(), body = grp(root, 0, 0.72, 0);
  const P = { root, body, hips: body, hipY: 0 };

  // plump, huge torso (forward = +z)
  S(body, hide, 0, 0.08, -0.05, 0.92, 0.88, 1.5);
  S(body, hideWet, 0, -0.12, 0.08, 0.82, 0.78, 1.32);
  S(body, belly, 0, -0.22, 0.1, 0.7, 0.62, 1.15);
  // metal harness plates + straps around the chest
  B(body, iron, 0, 0.38, 0.08, 1.02, 0.1, 1.55);
  B(body, rust, 0, 0.12, 0.08, 0.13, 0.75, 1.75);
  for (const z of [-0.6, 0.15, 0.75]) B(body, iron, 0, 0.08, z, 1.65, 0.1, 0.13);
  for (const s of [-1, 1]) {
    B(body, iron, s * 0.76, 0.28, 0.1, 0.09, 0.5, 1.2);
    for (const z of [-0.4, 0.35]) S(body, rivet, s * 0.78, 0.4, z, 0.045);
  }
  // heavy chains wrapped around the body (more of them, slightly diagonal)
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, z = -0.85 + i * 0.17;
    part(body, G.tor, i % 2 ? rust : iron, 0, 0.02, z, 0.35 + (i % 3) * 0.08, a * 0.12, 0.4, 0.78, 0.58, 0.58);
  }
  // hanging chain loops
  P.chains = [];
  for (const s of [-1, 1]) {
    let prev = grp(body, s * 0.62, -0.12, 0.25);
    for (let i = 0; i < 6; i++) {
      const l = grp(prev, 0, -0.16, 0); part(l, G.tor, iron, 0, 0, 0, 0, 0, Math.PI / 2, 0.075, 0.075, 0.075);
      P.chains.push(l); prev = l;
    }
  }

  // head
  const head = grp(body, 0, 0.18, 1.2); P.head = head; P.chest = head;
  S(head, hide, 0, 0.06, 0.04, 0.58, 1.05, 1.15);
  S(head, hideWet, 0, -0.1, 0.18, 0.42, 0.8, 1.0);
  // muzzle / nose
  S(head, hide, 0, -0.06, 0.48, 0.3, 0.72, 0.9);
  S(head, std(0x0e0a08, { roughness: 0.55 }), 0, 0.0, 0.68, 0.1, 0.7, 0.6);
  for (const s of [-1, 1]) {
    S(head, std(0x0a0a08), s * 0.24, 0.2, 0.4, 0.075, 0.7, 0.6);   // sockets
    S(head, wEye, s * 0.24, 0.2, 0.44, 0.04, 0.7, 0.55);            // small amber eyes
    S(head, hide, s * 0.46, 0.06, 0.06, 0.09, 1.1, 0.7);            // cheeks
    for (let k = 0; k < 3; k++) B(head, whisk, s * 0.52, -0.02 + k * 0.055, 0.4, 0.36, 0.012, 0.012, 0, 0, s * (0.35 + k * 0.16));
  }
  // metal crown / harness on the head — Wadget stands on this
  C(head, iron, 0, 0.48, -0.02, 0.4, 0.1, 0, 0, 0, 0.36);
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2;
    B(head, iron, Math.sin(a) * 0.38, 0.58, Math.cos(a) * 0.34, 0.05, 0.22, 0.05);
  }
  for (const s of [-1, 1]) S(head, rivet, s * 0.36, 0.5, 0.2, 0.035);
  // a chain collar under the crown
  part(head, G.tor, rust, 0, 0.28, 0.05, 0.9, 0.15, 0, 0.42, 0.42, 0.42);

  // long ivory tusks + heavy toxic-green slime drips
  P.tusks = []; P.drips = [];
  const addDrip = (parent, x, y, z, r) => {
    const d = S(parent, slime, x, y, z, r);
    d.userData.baseScale = d.scale.clone(); d.userData.baseY = y;
    P.drips.push(d);
    return d;
  };
  for (const s of [-1, 1]) {
    const tusk = grp(head, s * 0.24, -0.04, 0.54); tusk.rotation.x = -0.48; tusk.rotation.z = s * 0.28;
    C(tusk, ivory, 0, -0.58, 0.04, 0.12, 1.18, 0, 0, 0, 0.04);
    addDrip(tusk, 0, -1.16, 0.02, 0.06);
    addDrip(tusk, 0, -0.7, 0.05, 0.04);
    // slime strand along the tusk
    const strand = C(tusk, slimeDim, 0.01, -0.85, 0.06, 0.024, 0.85);
    strand.userData.baseScale = strand.scale.clone(); strand.userData.baseY = -0.85; P.drips.push(strand);
    P.tusks.push(tusk);
  }
  // extra drips hanging from the mouth
  for (const s of [-0.07, 0.07, 0]) addDrip(head, s, -0.28, 0.64, s === 0 ? 0.055 : 0.038);

  // flippers: front = legs (hip/knee API for existing anim/warp), rear stored too
  const mkFlip = (x, z, front) => {
    const hip = grp(body, x, -0.38, z), knee = grp(hip, 0, -0.15, front ? 0.15 : -0.1);
    C(hip, hide, 0, -0.08, 0, 0.2, 0.38, front ? 1.1 : -0.9, 0, x > 0 ? -0.3 : 0.3, 0.15);
    B(knee, hide, 0, -0.02, front ? 0.24 : -0.2, 0.24, 0.09, 0.52);
    return { hip, knee };
  };
  P.legL = mkFlip(-0.58, 0.58, true); P.legR = mkFlip(0.58, 0.58, true);
  P.rearL = mkFlip(-0.52, -0.9, false); P.rearR = mkFlip(0.52, -0.9, false);
  const tail = grp(body, 0, 0.0, -1.32); P.tail = tail;
  S(tail, hide, 0, 0, -0.15, 0.3, 0.7, 1.2);

  // ---------------------------------------------------------------- Wadget: small featureless black alien, huge pink eyes, BOTH arms raised
  // Eyes stay tonemapped (emissive) so bloom cannot blow them into a giant pink orb.
  const eyeMat = std(0x1a0010, { roughness: 0.3, emissive: 0xff2a9a, emissiveIntensity: 2.4 });
  const wadget = grp(head, 0, 0.72, -0.04); P.wadget = wadget;
  wadget.scale.setScalar(1.12);
  B(wadget, alien, 0, 0.1, 0, 0.15, 0.22, 0.13);                 // skinny torso
  S(wadget, alien, 0, 0.38, 0.0, 0.2, 1.12, 1.08);               // oversized smooth head
  // big almond pink eyes, slightly slanted / intense
  for (const s of [-1, 1]) {
    S(wadget, alien, s * 0.075, 0.4, 0.155, 0.085, 0.85, 0.5);   // sockets
    const e = S(wadget, eyeMat, s * 0.075, 0.4, 0.195, 0.07, 0.85, 0.48);
    e.rotation.z = s * -0.22;
    e.userData.base = { x: 0.07, y: 0.07 * 0.85, z: 0.07 * 0.48 };
    if (s < 0) P.eyeL = e; else P.eyeR = e;
  }
  // tiny legs tucked on the crown
  for (const s of [-1, 1]) B(wadget, alien, s * 0.07, -0.02, 0.02, 0.055, 0.14, 0.07);
  // arms UP in a V (disc lives in the raised right hand)
  const mkArm = side => {
    const sh = grp(wadget, side * 0.12, 0.22, 0), el = grp(sh, 0, 0.17, 0), hand = grp(el, 0, 0.15, 0);
    C(sh, alien, 0, 0.085, 0, 0.032, 0.17); C(el, alien, 0, 0.07, 0, 0.028, 0.15);
    S(hand, alien, 0, 0.02, 0, 0.045);
    sh.rotation.set(0.28, side * 0.12, side * 0.95);
    el.rotation.x = 0.22;
    return { sh, el, hand };
  };
  P.armL = mkArm(-1); P.armR = mkArm(1);
  P.discMount = grp(P.armR.hand, 0.06, 0.03, 0.02); P.discMount.rotation.z = Math.PI / 2;

  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 20), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; root.add(sh); P.shadow = sh;
  root.traverse(o => { if (o.isMesh && o !== sh) o.castShadow = true; });
  return P;
}

// Walk/run/idle pose helper for anything with legL/legR/armL/armR.
export function animLimbs(P, phase, amt, opt = {}) {
  const s = Math.sin(phase), c = Math.cos(phase);
  if (P.legL && P.legL.hip) {
    P.legL.hip.rotation.x = s * 0.7 * amt; P.legR.hip.rotation.x = -s * 0.7 * amt;
    P.legL.knee.rotation.x = Math.max(0, -c) * 0.9 * amt + (opt.crouch || 0); P.legR.knee.rotation.x = Math.max(0, c) * 0.9 * amt + (opt.crouch || 0);
  }
  if (!opt.noArms && P.armL && P.armL.sh) {
    P.armL.sh.rotation.x = -s * 0.6 * amt; P.armR.sh.rotation.x = s * 0.6 * amt;
    P.armL.el.rotation.x = -0.3 - 0.3 * amt; P.armR.el.rotation.x = -0.3 - 0.3 * amt;
  }
  if (P.hips && P.hipY !== undefined) P.hips.position.y = P.hipY - Math.abs(c) * 0.05 * amt - (opt.crouch || 0) * 0.25;
}

// Keep Wadget's arms in the raised V-pose (disc in the right hand). Never let locomotion overwrite this.
export function poseWadgetArms(P, t = 0) {
  if (!P.armL || !P.armL.sh) return;
  const wag = 0.07 * Math.sin(t * 3);
  P.armL.sh.rotation.set(0.28 + wag, -0.12, 0.95);
  P.armL.el.rotation.set(0.22, 0, 0.08);
  P.armR.sh.rotation.set(0.28 - wag, 0.12, -0.95);
  P.armR.el.rotation.set(0.18, 0, -0.08);
}

// Walrus-specific locomotion: flipper gallop, body bob, Wadget bouncing with arms up, slime drips.
// CRITICAL: pulse eyes/drips from their authored base scale — never setScalar(1), which would balloon them.
export function animWalrus(P, phase, amt, t) {
  const s = Math.sin(phase), c = Math.cos(phase);
  P.body.position.y = Math.abs(c) * 0.08 * amt;
  P.body.rotation.z = s * 0.08 * amt;
  P.head.rotation.x = Math.sin(phase * 0.5) * 0.08 * amt;
  P.head.rotation.y = s * 0.06 * amt;
  P.legL.hip.rotation.x = 1.0 + s * 0.7 * amt; P.legR.hip.rotation.x = 1.0 - s * 0.7 * amt;
  P.legL.knee.rotation.x = 0.2 + Math.max(0, -c) * 0.4 * amt; P.legR.knee.rotation.x = 0.2 + Math.max(0, c) * 0.4 * amt;
  if (P.rearL) {
    P.rearL.hip.rotation.x = -0.9 - s * 0.5 * amt; P.rearR.hip.rotation.x = -0.9 + s * 0.5 * amt;
  }
  if (P.tail) P.tail.rotation.y = s * 0.25 * amt;
  if (P.chains) P.chains.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + i) * 0.15 * (0.4 + amt); });
  if (P.drips) P.drips.forEach((d, i) => {
    const k = 0.75 + 0.35 * Math.abs(Math.sin(t * 3 + i));
    if (d.userData.baseScale) d.scale.copy(d.userData.baseScale).multiplyScalar(k);
    if (d.userData.baseY != null) d.position.y = d.userData.baseY - 0.1 * Math.abs(Math.sin(t * 4 + i));
  });
  if (P.wadget) {
    P.wadget.position.y = 0.72 + Math.abs(c) * 0.05 * amt;
    P.wadget.rotation.z = -s * 0.08 * amt;
    poseWadgetArms(P, t);
    if (P.eyeL && P.eyeL.userData.base) {
      const pulse = 1 + 0.08 * Math.sin(t * 8), b = P.eyeL.userData.base;
      P.eyeL.scale.set(b.x * pulse, b.y * pulse, b.z * pulse);
      P.eyeR.scale.set(b.x * pulse, b.y * pulse, b.z * pulse);
    }
  }
}

// ---------------------------------------------------------------- generic humanoid (robot bandits etc.)
function humanoid(m, d = {}) {
  const h = d.h || 1;
  const root = new THREE.Group(), body = grp(root, 0, 0.5 * h, 0), hips = grp(body, 0, 0.42 * h, 0);
  const P = { root, body, hips, hipY: 0.42 * h };
  B(hips, m.pants, 0, 0, 0, 0.32, 0.16, 0.2);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = grp(hips, side * 0.09, -0.05, 0), knee = grp(hip, 0, -0.42 * h, 0);
    C(hip, m.pants, 0, -0.21 * h, 0, d.leg || 0.08, 0.42 * h); C(knee, m.pants, 0, -0.21 * h, 0, (d.leg || 0.08) * 0.85, 0.42 * h);
    B(knee, m.shoes, 0, -0.44 * h, 0.04, 0.11, 0.07, 0.24);
    legs.push({ hip, knee });
  }
  P.legL = legs[0]; P.legR = legs[1];
  const chest = grp(hips, 0, 0.08, 0); P.chest = chest;
  B(chest, m.shirt, 0, 0.27 * h, 0, 0.38 * (d.bulk || 1), 0.46 * h, 0.22);
  C(chest, m.skin, 0, 0.53 * h, 0, 0.06, 0.1);
  const head = grp(chest, 0, 0.63 * h, 0); P.head = head;
  S(head, m.skin, 0, 0.04, 0, 0.12, 1.1, 1.05);
  const mkArm = side => {
    const sh = grp(chest, side * (0.23 * (d.bulk || 1)), 0.46 * h, 0), el = grp(sh, 0, -0.29 * h, 0), hand = grp(el, 0, -0.27 * h, 0);
    C(sh, m.sleeve || m.shirt, 0, -0.14 * h, 0, 0.065, 0.29 * h); C(el, m.sleeve || m.shirt, 0, -0.13 * h, 0, 0.055, 0.27 * h);
    S(hand, m.skin, 0, -0.02, 0, 0.055);
    return { sh, el, hand };
  };
  P.armR = mkArm(1); P.armL = mkArm(-1);
  return P;
}

// ---------------------------------------------------------------- little killer zombie dinosaurs (small, fast, rotting, glowing eyes)
export function buildZombieDino() {
  const rot = std(pick([0x3a5a28, 0x4a6a22, 0x2a4a18]), { roughness: 0.9 });
  const bone = std(0xd8d0b8, { roughness: 0.55 });
  const gut = std(0x4a1810, { roughness: 0.7, emissive: 0x1a0804 });
  const eyeC = pick([0x39ff3a, 0xff2a1a, 0xff6a00]);
  const eye = glow(eyeC, 4);
  const root = new THREE.Group(), body = grp(root, 0, 0.55, 0), hips = grp(body, 0, 0, 0);
  const P = { root, body, hips, hipY: 0 };
  S(hips, rot, 0, 0.05, 0, 0.22, 0.85, 1.4);
  S(hips, gut, 0, -0.02, 0.05, 0.16, 0.6, 1.0);
  // exposed ribs
  for (let i = 0; i < 4; i++) B(hips, bone, 0, 0.08, -0.12 + i * 0.08, 0.28, 0.02, 0.02, 0.4);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = grp(hips, side * 0.1, -0.05, -0.05), knee = grp(hip, 0, -0.28, 0);
    C(hip, rot, 0, -0.14, 0, 0.06, 0.28); C(knee, rot, 0, -0.16, 0, 0.045, 0.3);
    B(knee, rot, 0, -0.32, 0.08, 0.08, 0.04, 0.18);
    K(knee, bone, 0, -0.34, 0.18, 0.02, 0.08, 1.2);
    legs.push({ hip, knee });
  }
  P.legL = legs[0]; P.legR = legs[1];
  // little arms
  const chest = grp(hips, 0, 0.08, 0.15); P.chest = chest;
  const mkArm = side => {
    const sh = grp(chest, side * 0.14, 0.05, 0.05), el = grp(sh, 0, -0.1, 0), hand = grp(el, 0, -0.08, 0);
    C(sh, rot, 0, -0.05, 0, 0.03, 0.12); C(el, bone, 0, -0.04, 0, 0.02, 0.1);
    K(hand, bone, 0, -0.03, 0.02, 0.015, 0.06, 1.2);
    return { sh, el, hand };
  };
  P.armR = mkArm(1); P.armL = mkArm(-1);
  // neck + head
  const neck = grp(chest, 0, 0.12, 0.12); neck.rotation.x = -0.5;
  C(neck, rot, 0, 0.08, 0, 0.07, 0.2);
  const head = grp(neck, 0, 0.2, 0.08); P.head = head; head.rotation.x = 0.6;
  B(head, rot, 0, 0, 0.12, 0.2, 0.16, 0.36);
  B(head, bone, 0, -0.02, 0.14, 0.16, 0.04, 0.3);   // jaw / teeth plate
  for (let i = 0; i < 5; i++) for (const s of [-1, 1]) K(head, bone, s * 0.05, -0.06, 0.02 + i * 0.06, 0.012, 0.05);
  for (const s of [-1, 1]) S(head, eye, s * 0.07, 0.06, 0.16, 0.03);
  // rotting tail
  let prev = grp(hips, 0, 0.05, -0.28);
  for (let i = 0; i < 6; i++) { const t = grp(prev, 0, 0, -0.1); S(t, i % 2 ? bone : rot, 0, 0, 0, 0.07 - i * 0.008, 0.8, 1.1); prev = t; }
  P.muzzle = grp(head, 0, 0, 0.32);
  return P;
}

// ---------------------------------------------------------------- robot train bandits (steampunk / robot outlaws)
export function buildTrainBandit() {
  const iron = std(pick([0x6a5a48, 0x4a4a52, 0x5a4030]), { metalness: 0.85, roughness: 0.4 });
  const brass = std(0xb8863a, { metalness: 1, roughness: 0.3 });
  const dark = std(0x1a1612, { metalness: 0.7, roughness: 0.5 });
  const eye = glow(0xff9a2a, 3);
  const leather = std(0x3a2214, { roughness: 0.85 });
  const m = { pants: iron, shoes: dark, shirt: iron, sleeve: iron, skin: iron };
  const P = humanoid(m, { bulk: 1.15, h: 1.05 });
  // boiler chest + smokestack
  B(P.chest, brass, 0, 0.28, 0.12, 0.22, 0.22, 0.08);
  S(P.chest, glow(0xff6a1a, 1.2), 0, 0.28, 0.16, 0.05);
  C(P.chest, dark, 0, 0.58, -0.04, 0.04, 0.22);
  S(P.chest, std(0x333333), 0, 0.7, -0.04, 0.06, 0.5, 1);
  // cowboy hat
  C(P.head, leather, 0, 0.16, 0, 0.2, 0.04);
  C(P.head, leather, 0, 0.22, 0, 0.1, 0.1);
  B(P.head, leather, 0, 0.16, -0.14, 0.12, 0.02, 0.12, 0.2);
  // visor eyes
  B(P.head, dark, 0, 0.06, 0.12, 0.2, 0.05, 0.03);
  for (const s of [-1, 1]) S(P.head, eye, s * 0.05, 0.06, 0.14, 0.025);
  // star badge
  B(P.chest, brass, 0.12, 0.4, 0.12, 0.06, 0.06, 0.02, 0, 0, 0.8);
  // six-shooter
  const gun = grp(P.armR.hand, 0, -0.04, 0.06);
  B(gun, dark, 0, 0, 0.05, 0.05, 0.08, 0.24); B(gun, brass, 0, -0.07, -0.02, 0.04, 0.12, 0.05);
  P.muzzle = grp(gun, 0, 0.01, 0.2); P.prop = gun;
  // gear shoulder
  part(P.armL.sh, G.tor, brass, 0, 0, 0, 0, 0, Math.PI / 2, 0.08, 0.08, 0.06);
  return P;
}

// ---------------------------------------------------------------- cow terminators (chrome cyborg cows)
export function buildCowTerm(scale = 1, boss = false) {
  const chrome = std(0xc8ccd6, { metalness: 1, roughness: 0.22 });
  const dark = std(0x2a2c32, { metalness: 0.9, roughness: 0.4 });
  const eyeM = glow(0xff1a10, 5);
  const root = new THREE.Group(), body = grp(root, 0, boss ? 1.4 : 0.85, 0);
  const P = { root, body, hips: body, hipY: 0, eyes: [] };
  S(body, chrome, 0, 0.1, -0.05, boss ? 0.95 : 0.55, 0.8, 1.5);
  B(body, dark, 0, 0.05, -0.05, boss ? 0.5 : 0.28, boss ? 0.7 : 0.4, boss ? 1.6 : 0.95);
  const core = S(body, glow(0xff2010, boss ? 3 : 1.6), 0, 0.15, 0.4, boss ? 0.12 : 0.07); P.core = core;
  // mechanical legs
  const legs = [];
  const feet = [[-0.35, 0.45], [0.35, 0.45], [-0.38, -0.5], [0.38, -0.5]];
  feet.forEach(([x, z], i) => {
    const hip = grp(body, x * (boss ? 1.6 : 1), -0.2, z * (boss ? 1.5 : 1)), knee = grp(hip, 0, boss ? -0.7 : -0.4, 0);
    C(hip, chrome, 0, boss ? -0.35 : -0.2, 0, boss ? 0.1 : 0.06, boss ? 0.7 : 0.4);
    C(knee, dark, 0, boss ? -0.35 : -0.2, 0, boss ? 0.08 : 0.05, boss ? 0.7 : 0.38);
    B(knee, chrome, 0, boss ? -0.75 : -0.42, 0.08, boss ? 0.22 : 0.14, boss ? 0.08 : 0.05, boss ? 0.32 : 0.2);
    legs.push({ hip, knee });
    if (i === 0) P.legL = { hip, knee }; if (i === 1) P.legR = { hip, knee };
  });
  // neck + head
  const chest = grp(body, 0, 0.25, 0.6); P.chest = chest;
  C(chest, chrome, 0, 0.15, 0.15, boss ? 0.16 : 0.1, boss ? 0.5 : 0.3, 0.8);
  const head = grp(chest, 0, 0.35, 0.4); P.head = head;
  B(head, chrome, 0, 0.05, 0.15, boss ? 0.7 : 0.42, boss ? 0.45 : 0.28, boss ? 0.7 : 0.42);
  B(head, dark, 0, 0.05, 0.36, boss ? 0.5 : 0.3, boss ? 0.18 : 0.1, 0.04);
  for (const s of [-1, 1]) {
    const e = S(head, eyeM, s * (boss ? 0.18 : 0.1), 0.1, 0.38, boss ? 0.07 : 0.04); P.eyes.push(e);
    // chrome horns / antenna
    K(head, chrome, s * (boss ? 0.22 : 0.13), 0.28, 0.0, boss ? 0.06 : 0.035, boss ? 0.45 : 0.28, -0.6, 0, s * -0.3);
  }
  // ears
  for (const s of [-1, 1]) B(head, chrome, s * (boss ? 0.38 : 0.22), 0.15, -0.05, boss ? 0.08 : 0.05, boss ? 0.22 : 0.14, 0.04, 0, 0, s * 0.5);
  // stub arms for volley pose / shoulder cannons
  const mkArm = side => {
    const sh = grp(body, side * (boss ? 0.85 : 0.45), 0.35, 0.1), el = grp(sh, 0, boss ? -0.45 : -0.25, 0), hand = grp(el, 0, boss ? -0.4 : -0.22, 0);
    C(sh, dark, 0, boss ? -0.2 : -0.1, 0, boss ? 0.1 : 0.06, boss ? 0.4 : 0.22);
    B(hand, dark, 0, 0, 0.1, boss ? 0.16 : 0.1, boss ? 0.12 : 0.08, boss ? 0.4 : 0.22);
    return { sh, el, hand };
  };
  P.armR = mkArm(1); P.armL = mkArm(-1);
  const gun = grp(P.armR.hand, 0, 0, 0.2);
  B(gun, dark, 0, 0, 0, 0.1, 0.1, 0.4);
  P.muzzle = grp(gun, 0, 0, 0.25);
  if (boss) {
    for (const s of [-1, 1]) {
      const c = grp(body, s * 0.9, 0.7, 0.1);
      B(c, dark, 0, 0, 0, 0.3, 0.2, 0.5); C(c, chrome, 0, 0, 0.3, 0.08, 0.4, Math.PI / 2, 0, 0);
      P['can' + (s > 0 ? 'R' : 'L')] = grp(c, 0, 0, 0.55);
    }
    S(body, glow(0xff2010, 3), 0, 0.3, 0.7, 0.18);
  }
  // udder-like ammo drum (tasteful mechanical cylinder, not a gag close-up)
  C(body, dark, 0, -0.25, -0.1, boss ? 0.18 : 0.1, boss ? 0.25 : 0.14);
  root.scale.setScalar(scale);
  return P;
}

// ---------------------------------------------------------------- Matrix-style tentacled sentinel drones (flying)
export function buildMatrixSentinel(scale = 1) {
  const shell = std(0x1a2218, { metalness: 0.85, roughness: 0.3 });
  const chrome = std(0x8aa090, { metalness: 1, roughness: 0.25 });
  const eyeM = glow(0x39ff6a, 5);
  const root = new THREE.Group(), body = grp(root); const P = { root, body, tentacles: [], fans: [] };
  // squid / bug body
  S(body, shell, 0, 0, 0, 0.55, 0.7, 1.15);
  B(body, chrome, 0, 0, 0.2, 0.3, 0.15, 0.7);
  // glowing green "lens" eye
  const eye = S(body, eyeM, 0, 0.05, 0.7, 0.16); P.eye = eye;
  const iris = S(body, glow(0xccffcc, 3), 0, 0.05, 0.82, 0.06); P.iris = iris;
  // small hover vanes
  for (const s of [-1, 1]) {
    const pod = grp(body, s * 0.55, 0.15, -0.1);
    C(pod, chrome, 0, 0, 0, 0.16, 0.08);
    const fan = grp(pod, 0, 0.02, 0); for (let i = 0; i < 4; i++) B(fan, shell, 0, 0, 0, 0.36, 0.015, 0.05, 0, i * Math.PI / 4, 0);
    P.fans.push(fan);
  }
  // tentacles
  for (let t = 0; t < 8; t++) {
    const a = t / 8 * Math.PI * 2;
    let prev = grp(body, Math.cos(a) * 0.25, Math.sin(a) * 0.2 - 0.1, -0.4);
    const segs = [];
    for (let i = 0; i < 6; i++) {
      const n = grp(prev, 0, 0, -0.22); S(n, i % 2 ? chrome : shell, 0, 0, 0, 0.07 - i * 0.008, 0.8, 1.1);
      segs.push(n); prev = n;
    }
    P.tentacles.push({ root: segs[0], segs, phase: a });
  }
  C(body, shell, 0, -0.1, 0.55, 0.04, 0.35, Math.PI / 2, 0, 0); P.muzzle = grp(body, 0, -0.1, 0.75);
  // faint search cone (green, low opacity so it doesn't wash the screen)
  const light = grp(root, 0, -0.1, 0.3); P.light = light;
  const coneGeo = new THREE.ConeGeometry(0.9, 6, 16, 1, true); coneGeo.translate(0, -3, 0);
  const beam = new THREE.Mesh(coneGeo, additive(0x39ff6a, 0.04, { side: THREE.DoubleSide })); light.add(beam);
  root.scale.setScalar(scale);
  return P;
}

// Boss alias
export function buildSteer(scale = 1) { return buildCowTerm(scale, true); }


// ---------------------------------------------------------------- TURBO kit: rocket boosters, hover thrusters, chrome harness, gadget rigs
export function buildTurboHero() {
  const P = buildHero();
  const chrome = std(0xc8d0dc, { metalness: 1, roughness: 0.18 });
  const chromeDark = std(0x4a5060, { metalness: 0.95, roughness: 0.28 });
  const coal = std(0x1a1c22, { metalness: 0.7, roughness: 0.4 });
  const accent = glow(0xff3a1a, 2.2);
  const cyan = glow(0x3af0ff, 2.0);
  const body = P.body;

  // chrome racing harness over the iron plates
  B(body, chrome, 0, 0.42, 0.08, 1.08, 0.06, 1.62);
  B(body, chromeDark, 0, 0.34, 0.08, 0.18, 0.16, 1.85);
  for (const z of [-0.7, 0.15, 0.85]) B(body, chrome, 0, 0.16, z, 1.72, 0.06, 0.08);
  // intake scoop on the shoulders / back
  B(body, chromeDark, 0, 0.55, -0.55, 0.7, 0.18, 0.55, 0.35, 0, 0);
  B(body, coal, 0, 0.58, -0.62, 0.5, 0.1, 0.28, 0.35, 0, 0);

  // side rocket pods
  P.boosters = []; P.flames = []; P.thrusters = [];
  for (const s of [-1, 1]) {
    const pod = grp(body, s * 1.05, 0.15, -0.55);
    C(pod, chromeDark, 0, 0, 0, 0.2, 0.85, Math.PI / 2, 0, 0, 0.16);
    C(pod, chrome, 0, 0, 0.38, 0.22, 0.1, Math.PI / 2);
    C(pod, coal, 0, 0, -0.42, 0.14, 0.08, Math.PI / 2);
    // nozzle ring
    part(pod, G.tor, accent, 0, 0, -0.48, 0, 0, 0, 0.12, 0.12, 0.12);
    const flame = grp(pod, 0, 0, -0.55);
    K(flame, glow(0xffee88, 3.2), 0, 0, -0.35, 0.12, 0.7, Math.PI / 2);
    K(flame, glow(0xff4a12, 2.4), 0, 0, -0.2, 0.08, 0.4, Math.PI / 2);
    flame.visible = false;
    P.boosters.push(pod); P.flames.push(flame);
    // hover thrusters under the body
    const thr = grp(body, s * 0.7, -0.55, 0.15);
    C(thr, chromeDark, 0, 0, 0, 0.12, 0.1);
    const glowRing = part(thr, G.tor, cyan, 0, -0.08, 0, Math.PI / 2, 0, 0, 0.08, 0.08, 0.08);
    const jet = K(thr, glow(0x66ffff, 2.2), 0, -0.22, 0, 0.07, 0.28, Math.PI, 0, 0);
    P.thrusters.push({ root: thr, ring: glowRing, jet });
  }
  // rear center booster
  const rear = grp(body, 0, 0.05, -1.45);
  C(rear, chromeDark, 0, 0, 0, 0.22, 0.35, Math.PI / 2, 0, 0, 0.18);
  part(rear, G.tor, accent, 0, 0, -0.2, 0, 0, 0, 0.14, 0.14, 0.14);
  const rearFlame = grp(rear, 0, 0, -0.22);
  K(rearFlame, glow(0xffee88, 3.2), 0, 0, -0.45, 0.16, 0.9, Math.PI / 2);
  K(rearFlame, glow(0xff4a12, 2.4), 0, 0, -0.28, 0.1, 0.5, Math.PI / 2);
  rearFlame.visible = false;
  P.boosters.push(rear); P.flames.push(rearFlame);

  // ---- gadget rigs (hidden until used) ----
  // spring coils under the body
  const springs = grp(body, 0, -0.55, 0); P.springRig = springs; springs.visible = false;
  for (const s of [-1, 1]) {
    const c = grp(springs, s * 0.45, 0, 0.1);
    for (let i = 0; i < 5; i++) part(c, G.tor, chrome, 0, -0.08 * i, 0, Math.PI / 2, 0, 0, 0.1, 0.1, 0.1);
  }

  // heli blades pop out of the crown
  const heli = grp(P.head, 0, 0.85, -0.02); P.heliRig = heli; heli.visible = false;
  C(heli, chrome, 0, 0, 0, 0.06, 0.25);
  const blades = grp(heli, 0, 0.14, 0); P.heliBlades = blades;
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    B(blades, chromeDark, Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55, 1.1, 0.03, 0.16, 0, -a, 0);
  }
  const heliBlur = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), additive(0xc8f0ff, 0.28, { side: THREE.DoubleSide }));
  heliBlur.rotation.x = -Math.PI / 2; blades.add(heliBlur); P.heliBlur = heliBlur;

  // boxing glove on a piston off the right side
  const glove = grp(body, 1.15, 0.35, 0.6); P.gloveRig = glove; glove.visible = false;
  C(glove, chromeDark, 0, 0, -0.15, 0.08, 0.3, Math.PI / 2);
  const fist = grp(glove, 0, 0, 0.2); P.gloveFist = fist;
  B(fist, std(0xff2a2a, { roughness: 0.55, metalness: 0.1 }), 0, 0, 0.15, 0.42, 0.38, 0.5);
  B(fist, std(0xffd24a, { roughness: 0.4 }), 0, 0, -0.12, 0.38, 0.16, 0.12);
  S(fist, std(0xff2a2a, { roughness: 0.55 }), 0, 0.12, 0.32, 0.12);

  // grapple arm from Wadget's left hand (extends a hook on a chain)
  const grap = grp(P.armL.hand, 0, 0.04, 0); P.grappleRig = grap; grap.visible = false;
  C(grap, chrome, 0, 0.08, 0, 0.03, 0.18);
  const hook = grp(grap, 0, 0.2, 0); P.grappleHook = hook;
  K(hook, chrome, 0, 0.08, 0, 0.05, 0.16, Math.PI, 0, 0);
  part(hook, G.tor, chrome, 0, 0.16, 0.04, 0.8, 0, 0, 0.06, 0.06, 0.06);

  // spoiler
  const spoiler = grp(body, 0, 0.7, -1.15);
  B(spoiler, chromeDark, 0, 0.12, 0, 1.5, 0.06, 0.22);
  for (const s of [-1, 1]) B(spoiler, chrome, s * 0.55, 0, 0, 0.06, 0.28, 0.16);

  return P;
}

// anim + gadget visuals. extra = { boost, heli, spring, glove, gloveT, flame }
export function animTurboWalrus(P, phase, amt, t, extra = {}) {
  animWalrus(P, phase, amt, t);
  const boost = extra.boost || 0;
  const flameOn = boost > 0.05 || extra.rocket;
  if (P.flames) P.flames.forEach((f, i) => {
    f.visible = !!flameOn;
    if (flameOn) {
      const k = 0.7 + 0.6 * boost + 0.25 * Math.abs(Math.sin(t * 40 + i));
      f.scale.set(0.8 + 0.3 * boost, 0.8 + 0.3 * boost, k);
    }
  });
  if (P.thrusters) P.thrusters.forEach((th, i) => {
    const k = 0.5 + 0.5 * Math.max(amt, boost) + 0.2 * Math.sin(t * 20 + i);
    if (th.jet) th.jet.scale.set(1, k, 1);
  });
  if (P.heliRig) {
    P.heliRig.visible = !!extra.heli;
    if (extra.heli && P.heliBlades) P.heliBlades.rotation.y += dtSafe(extra.dt) * 28;
  }
  if (P.springRig) {
    P.springRig.visible = !!extra.spring;
    if (extra.spring) P.springRig.scale.y = 0.5 + 0.8 * Math.abs(Math.sin((extra.springT || t) * 10));
  }
  if (P.gloveRig) {
    P.gloveRig.visible = !!extra.glove;
    if (extra.glove && P.gloveFist) {
      const u = Math.min(1, extra.gloveT || 0);
      P.gloveFist.position.z = 0.2 + Math.sin(Math.min(1, u / 0.25) * Math.PI) * 1.4;
    }
  }
  if (P.grappleRig) P.grappleRig.visible = !!extra.grapple;
}

function dtSafe(d) { return d || 0.016; }

// ---------------------------------------------------------------- gadget pickup orb
export const GADGETS = [
  { id: 'rocket', name: 'ROCKET', color: 0xff3a12, accent: 0xffee66 },
  { id: 'spring', name: 'SPRING', color: 0x5cff3a, accent: 0xc8ff80 },
  { id: 'grapple', name: 'GRAPPLE', color: 0xffc020, accent: 0xfff0a0 },
  { id: 'heli', name: 'HELI', color: 0x3ad0ff, accent: 0xc8f4ff },
  { id: 'glove', name: 'GLOVE', color: 0xff2a6a, accent: 0xffa0c0 }
];

export function buildPickup(kind) {
  const def = GADGETS.find(g => g.id === kind) || GADGETS[0];
  const root = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 10), additive(def.color, 0.55));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glow(def.accent, 2.4));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.05, 8, 20), glow(def.color, 1.6));
  ring.rotation.x = Math.PI / 2;
  root.add(shell, core, ring);
  const icon = buildGadgetIcon(kind, def);
  icon.scale.setScalar(0.55); icon.position.y = 0; root.add(icon);
  root.userData = { kind, ring, icon, shell };
  return root;
}

function buildGadgetIcon(kind, def) {
  const g = new THREE.Group(), m = glow(def.accent, 2.2), d = std(def.color, { metalness: 0.4, roughness: 0.4, emissive: def.color, emissiveIntensity: 0.5 });
  if (kind === 'rocket') {
    C(g, d, 0, 0, 0, 0.16, 0.5, Math.PI / 2, 0, 0, 0.1);
    K(g, m, 0, 0, -0.4, 0.12, 0.3, Math.PI / 2);
  } else if (kind === 'spring') {
    for (let i = 0; i < 4; i++) part(g, G.tor, d, 0, -0.2 + i * 0.14, 0, Math.PI / 2, 0, 0, 0.16, 0.16, 0.16);
  } else if (kind === 'grapple') {
    C(g, d, 0, 0, 0, 0.05, 0.45);
    part(g, G.tor, m, 0, 0.28, 0.08, 0.9, 0, 0, 0.12, 0.12, 0.12);
  } else if (kind === 'heli') {
    C(g, d, 0, 0, 0, 0.06, 0.25);
    for (let i = 0; i < 3; i++) B(g, m, 0, 0.14, 0, 0.7, 0.03, 0.1, 0, i * Math.PI * 2 / 3, 0);
  } else {
    B(g, d, 0, 0, 0.05, 0.32, 0.28, 0.36);
    B(g, m, 0, 0, -0.16, 0.28, 0.1, 0.1);
  }
  return g;
}

// ---------------------------------------------------------------- rival racers
function wheels(parent, positions, r = 0.32, width = 0.16) {
  const rubber = std(0x111114, { roughness: 0.7 });
  const rim = std(0xc8c8d0, { metalness: 0.95, roughness: 0.25 });
  const list = [];
  for (const [x, y, z] of positions) {
    const w = grp(parent, x, y, z);
    C(w, rubber, 0, 0, 0, r, width, 0, 0, Math.PI / 2);
    C(w, rim, 0, 0, 0, r * 0.55, width * 1.1, 0, 0, Math.PI / 2);
    list.push(w);
  }
  return list;
}

export function buildBlazejaw(scale = 1) {
  // zombie dino on roller jets
  const P = buildZombieDino();
  const chrome = std(0x8890a0, { metalness: 0.95, roughness: 0.25 });
  const flame = glow(0xff6a1a, 2.2);
  P.wheels = wheels(P.body, [[-0.45, -0.55, 0.4], [0.45, -0.55, 0.4], [-0.4, -0.5, -0.55], [0.4, -0.5, -0.55]], 0.28, 0.14);
  for (const s of [-1, 1]) {
    const pod = grp(P.body, s * 0.55, 0.0, -0.7);
    C(pod, chrome, 0, 0, 0, 0.12, 0.4, Math.PI / 2);
    K(pod, flame, 0, 0, -0.3, 0.1, 0.35, Math.PI / 2);
  }
  P.root.scale.setScalar(scale);
  return P;
}

export function buildIronMare(scale = 1) {
  // steampunk locomotive-horse cart with a robot bandit riding
  const iron = std(0x5a5a62, { metalness: 0.92, roughness: 0.32 });
  const rust = std(0x6a3a1a, { metalness: 0.7, roughness: 0.45 });
  const brass = std(0xc8a24a, { metalness: 0.9, roughness: 0.3 });
  const coal = std(0x1a1a1c, { roughness: 0.7 });
  const root = new THREE.Group(), body = grp(root, 0, 0.85, 0);
  const P = { root, body, hips: body, hipY: 0 };
  // boiler body
  C(body, iron, 0, 0.1, 0, 0.55, 1.8, Math.PI / 2, 0, 0, 0.48);
  S(body, iron, 0, 0.12, 0.85, 0.5, 0.9, 1);
  C(body, rust, 0, 0.7, 0.2, 0.22, 0.55); // stack
  C(body, coal, 0, 1.0, 0.2, 0.24, 0.08);
  B(body, rust, 0, 0.55, -0.5, 0.7, 0.12, 0.5); // cab roof
  // pistons
  for (const s of [-1, 1]) B(body, brass, s * 0.55, -0.15, 0.1, 0.12, 0.12, 0.9);
  P.wheels = wheels(body, [[-0.55, -0.7, 0.55], [0.55, -0.7, 0.55], [-0.55, -0.7, -0.55], [0.55, -0.7, -0.55]], 0.38, 0.16);
  // rider (bandit), seated
  const rider = buildTrainBandit();
  rider.root.position.set(0, 0.35, -0.35);
  rider.root.scale.setScalar(0.7);
  body.add(rider.root); P.rider = rider;
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.1, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; root.add(sh); P.shadow = sh;
  root.scale.setScalar(scale);
  root.traverse(o => { if (o.isMesh && o !== sh) o.castShadow = true; });
  return P;
}

export function buildMoobicycle(scale = 1) {
  // cow terminator on a chrome hover-sled
  const chrome = std(0xd8dee8, { metalness: 1, roughness: 0.16 });
  const dark = std(0x20242c, { metalness: 0.9, roughness: 0.28 });
  const red = glow(0xff2a1a, 2.4);
  const root = new THREE.Group(), body = grp(root, 0, 0.55, 0);
  const P = { root, body, hips: body, hipY: 0 };
  B(body, chrome, 0, 0, 0, 0.9, 0.18, 2.2);
  B(body, dark, 0, 0.12, -0.2, 0.55, 0.16, 1.2);
  K(body, chrome, 0, 0.02, 1.15, 0.28, 0.5, Math.PI / 2);
  for (const s of [-1, 1]) {
    C(body, dark, s * 0.5, -0.15, 0.5, 0.14, 0.1);
    C(body, dark, s * 0.5, -0.15, -0.7, 0.14, 0.1);
    const jet = K(body, red, s * 0.5, -0.05, -1.15, 0.1, 0.35, Math.PI / 2);
    (P.flames || (P.flames = [])).push(jet);
  }
  const cow = buildCowTerm(0.75, false);
  cow.root.position.set(0, 0.35, -0.15);
  body.add(cow.root); P.rider = cow; P.head = cow.head || cow.root;
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; root.add(sh); P.shadow = sh;
  root.scale.setScalar(scale);
  return P;
}

export function buildGridSquid(scale = 1) {
  const P = buildMatrixSentinel(1.05);
  const chrome = std(0xa8b0aa, { metalness: 1, roughness: 0.2 });
  const green = glow(0x39ff6a, 2.2);
  // race vanes / wings
  for (const s of [-1, 1]) {
    B(P.body, chrome, s * 0.85, 0.05, -0.1, 0.8, 0.04, 0.35, 0, 0, s * 0.25);
    B(P.body, green, s * 0.85, 0.05, -0.1, 0.7, 0.01, 0.08, 0, 0, s * 0.25);
  }
  P.root.scale.setScalar(scale);
  return P;
}

export function buildBoltBison(scale = 1) {
  // junker mechanical bison / armadillo tank
  const rust = std(0x6a3a18, { metalness: 0.7, roughness: 0.48 });
  const iron = std(0x4a4e56, { metalness: 0.9, roughness: 0.3 });
  const glowR = glow(0xff8a2a, 1.8);
  const root = new THREE.Group(), body = grp(root, 0, 0.85, 0);
  const P = { root, body, hips: body, hipY: 0 };
  S(body, rust, 0, 0.05, 0, 0.85, 0.75, 1.45);
  // armor plates
  for (let i = 0; i < 5; i++) B(body, iron, 0, 0.45, -0.6 + i * 0.3, 0.9, 0.12, 0.22, 0.15, 0, 0);
  const head = grp(body, 0, 0.15, 1.05); P.head = head;
  S(head, rust, 0, 0, 0, 0.45, 0.7, 0.8);
  for (const s of [-1, 1]) {
    S(head, glowR, s * 0.2, 0.12, 0.3, 0.07);
    K(head, iron, s * 0.28, 0.05, 0.5, 0.08, 0.45, Math.PI / 2, 0, s * 0.2);
  }
  P.wheels = wheels(body, [[-0.6, -0.7, 0.55], [0.6, -0.7, 0.55], [-0.6, -0.7, -0.7], [0.6, -0.7, -0.7]], 0.36, 0.18);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 16), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.4, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; root.add(sh); P.shadow = sh;
  root.scale.setScalar(scale);
  return P;
}

export const RIVALS = [
  { id: 'blazejaw', name: 'BLAZEJAW', color: '#7aff5a', build: buildBlazejaw },
  { id: 'ironmare', name: 'IRON MARE', color: '#ffb02a', build: buildIronMare },
  { id: 'moobicycle', name: 'MOO-CYCLE', color: '#ff4a3a', build: buildMoobicycle },
  { id: 'gridsquid', name: 'GRID SQUID', color: '#39ff6a', build: buildGridSquid },
  { id: 'boltbison', name: 'BOLT BISON', color: '#ff8a2a', build: buildBoltBison }
];
