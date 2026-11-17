import * as THREE from 'three';
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const angLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

export function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o }); }
export function glow(color, intensity = 2) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), toneMapped: false }); }
export function additive(color, opacity = 0.5, o = {}) { return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...o }); }

// Neon rim light (fresnel emissive) fresnel; shares one shader program.
export function rimify(mat, rimColor, strength = 2.6, power = 2.0) {
  const rim = { value: new THREE.Color(rimColor).multiplyScalar(strength) }, pw = { value: power };
  mat.userData.rim = rim;
  mat.onBeforeCompile = sh => {
    sh.uniforms.rimColor = rim; sh.uniforms.rimPow = pw;
    sh.fragmentShader = 'uniform vec3 rimColor; uniform float rimPow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n float rimF = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);\n totalEmissiveRadiance += rimColor * pow(rimF, rimPow);');
  };
  mat.customProgramCacheKey = () => 'rim';
  return mat;
}

// Shorthand: add a mesh to a parent at a position.
export function part(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.scale.set(sx, sy, sz); parent.add(m); return m;
}
export function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); if (parent) parent.add(g); return g; }

// ---- canvas textures ----
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat); }
  return t;
}
export const Tex = {
  grid(rep) {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#07010f'; g.fillRect(0, 0, w, h);
      g.shadowBlur = 10; g.shadowColor = '#ff2ad4'; g.strokeStyle = '#ff3ae0'; g.lineWidth = 5; g.strokeRect(0, 0, w, h);
      g.shadowColor = '#2af0ff'; g.strokeStyle = 'rgba(60,220,255,0.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    }, rep);
  },
  ground2098(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#1a1816'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const v = 10 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v + 8},${v + 4},${v},0.6)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 2 + Math.random() * 5); }
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 12; i++) { const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(0,0,0,0.7)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }, rep);
  },
  concrete() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#6a6660'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { const v = 70 + Math.random() * 60 | 0; g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(20,18,16,0.7)'; g.lineWidth = 1.5; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += Math.random() * 40; g.lineTo(x, y); } g.stroke(); }
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,4,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
  },
  windows(lit, colors) {
    return canvasTex(128, 256, (g, w, h) => {
      g.fillStyle = '#0a0612'; g.fillRect(0, 0, w, h);
      for (let y = 8; y < h - 8; y += 16) for (let x = 6; x < w - 6; x += 14) {
        if (Math.random() < lit) { g.fillStyle = pick(colors); g.globalAlpha = 0.5 + Math.random() * 0.5; g.fillRect(x, y, 8, 9); }
        else { g.fillStyle = '#140c20'; g.globalAlpha = 1; g.fillRect(x, y, 8, 9); }
      }
      g.globalAlpha = 1;
    });
  },
  sign(text, color, bg = 'rgba(0,0,0,0)', font = 'bold italic 84px "Arial Black", Impact, sans-serif') {
    return canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = color; g.shadowBlur = 24; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 4);
      g.shadowBlur = 0; g.fillStyle = '#fff'; g.globalAlpha = 0.55; g.fillText(text, w / 2, h / 2 + 4);
    });
  },
  dot() {
    return canvasTex(64, 64, (g, w) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  },
  smoke() {
    return canvasTex(128, 128, (g, w) => {
      for (let i = 0; i < 18; i++) { const x = 30 + Math.random() * 68, y = 30 + Math.random() * 68, r = 14 + Math.random() * 30; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }
    });
  },
  ring() {
    return canvasTex(128, 128, (g, w) => { const gr = g.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,1)'); gr.addColorStop(0.7, 'rgba(255,255,255,0.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
  },
  sea(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#03260e'); bg.addColorStop(1, '#02180a'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(40,255,80,0.28)'; g.lineWidth = 2;
      for (let i = 0; i < 18; i++) { g.beginPath(); const y = 20 + i * 28; g.moveTo(0, y); for (let x = 0; x <= w; x += 16) g.lineTo(x, y + Math.sin(x * 0.04 + i) * 6); g.stroke(); }
      for (let i = 0; i < 80; i++) { const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(90,255,120,0.35)'); gr.addColorStop(1, 'rgba(90,255,120,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }, rep);
  },
  prairie(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#6a4a22'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8000; i++) { const v = 70 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v + 30},${v},${v - 30},0.55)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1 + Math.random() * 2); }
      for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(40,28,10,0.35)'; g.lineWidth = 1; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
    }, rep);
  },
  rock() {
    const tex = canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#2a2420'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { const v = 30 + Math.random() * 50 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 12},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2); }
      for (let i = 0; i < 16; i++) { g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 50; y += Math.random() * 30; g.lineTo(x, y); } g.stroke(); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },
  matrix(rep) {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#020804'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(30,255,80,0.35)'; g.lineWidth = 1;
      for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
      g.fillStyle = 'rgba(60,255,110,0.55)';
      for (let i = 0; i < 40; i++) g.fillRect((Math.random() * 8 | 0) * 32 + 1, (Math.random() * 8 | 0) * 32 + 1, 30, 30);
    }, rep);
  },
  wood() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#5a3a1a'; g.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 8) { g.strokeStyle = `rgba(${40 + Math.random() * 30 | 0},${20 + Math.random() * 16 | 0},8,0.6)`; g.lineWidth = 3; g.beginPath(); g.moveTo(0, y + Math.random() * 4); g.lineTo(w, y + Math.random() * 4); g.stroke(); }
    });
  },
  dirt(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#3a2a1c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { const v = 40 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v + 20},${v - 5},${v - 20},0.55)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 1 + Math.random() * 3); }
      for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(20,12,6,0.4)'; g.lineWidth = 2; g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); }
    }, rep);
  },
  ash(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#2a221c'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8000; i++) { const v = 30 + Math.random() * 50 | 0; g.fillStyle = `rgba(${v + 16},${v},${v - 8},0.6)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2); }
      for (let i = 0; i < 18; i++) { const x = Math.random() * w, y = Math.random() * h, r = 16 + Math.random() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(80,30,10,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }, rep);
  },
  lava(rep) {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#1a0600'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 12 + Math.random() * 40;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(255,240,120,0.95)'); gr.addColorStop(0.25, 'rgba(255,120,20,0.85)'); gr.addColorStop(1, 'rgba(80,0,0,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      g.strokeStyle = 'rgba(255,80,10,0.5)'; g.lineWidth = 2;
      for (let i = 0; i < 12; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 8; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.4) * 30; g.lineTo(x, y); } g.stroke(); }
    }, rep);
  },
  mud(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#2a1c0e'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 6000; i++) { const v = 25 + Math.random() * 40 | 0; g.fillStyle = `rgba(${v + 18},${v},${v - 8},0.7)`; g.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 6, 2 + Math.random() * 4); }
      for (let i = 0; i < 25; i++) { const x = Math.random() * w, y = Math.random() * h, r = 10 + Math.random() * 28; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(10,6,2,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
    }, rep);
  },
  neonRoad(rep) {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#05020c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,40,200,0.85)'; g.lineWidth = 10; g.shadowBlur = 14; g.shadowColor = '#ff2ad4';
      g.beginPath(); g.moveTo(8, 0); g.lineTo(8, h); g.moveTo(w - 8, 0); g.lineTo(w - 8, h); g.stroke();
      g.shadowColor = '#2af0ff'; g.strokeStyle = 'rgba(60,230,255,0.7)'; g.lineWidth = 3;
      g.beginPath(); g.setLineDash([28, 22]); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.setLineDash([]);
      g.shadowBlur = 0;
      g.fillStyle = 'rgba(40,10,50,0.5)';
      for (let y = 0; y < h; y += 32) g.fillRect(16, y + 4, w - 32, 2);
    }, rep);
  },
  packed(rep) {
    return canvasTex(512, 512, (g, w, h) => {
      g.fillStyle = '#6a4a28'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 7000; i++) { const v = 70 + Math.random() * 60 | 0; g.fillStyle = `rgba(${v + 24},${v},${v - 24},0.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1 + Math.random() * 2); }
      g.strokeStyle = 'rgba(255,220,140,0.18)'; g.lineWidth = 3; g.setLineDash([40, 36]);
      g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke(); g.setLineDash([]);
    }, rep);
  },
  boost() {
    return canvasTex(256, 128, (g, w, h) => {
      g.fillStyle = '#081018'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#ffee66' : '#ff8a10';
        g.beginPath(); g.moveTo(i * 36 - 20, 0); g.lineTo(i * 36 + 10, 0); g.lineTo(i * 36 - 4, h); g.lineTo(i * 36 - 34, h); g.closePath(); g.fill();
      }
    });
  },
  rust() {
    return canvasTex(256, 256, (g, w, h) => {
      g.fillStyle = '#4a2a16'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 4000; i++) { const v = 50 + Math.random() * 70 | 0; g.fillStyle = `rgba(${v + 30},${v - 10},${v - 30},0.45)`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 2); }
    });
  }
};
