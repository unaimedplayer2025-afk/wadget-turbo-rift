// Audio: procedural WebAudio SFX + title / gameplay music hooks.
// Swap the title/intro song by replacing audio/title-theme.ogg and audio/title-theme.mp3
// (Safari/iOS fallback; picked with canPlayType).
// Gameplay music lives in audio/gameplay.{ogg,mp3} and is faded in from main.js (RaceMusic).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const Snd = {
  ac: null, master: null, title: null, titleVol: 0, unlocked: false, muted: false, duck: 1, noiseBuf: null, onTitle: true,
  eng: null,
  init() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.45; this.master.connect(this.ac.destination);
        const n = this.ac.sampleRate; this.noiseBuf = this.ac.createBuffer(1, n, n); const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
    }
    if (this.ac && this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    this.unlocked = true;
    if (this.onTitle) this.playTitle();   // play() inside the user gesture unlocks the element (iOS)
  },
  makeTitle() {
    if (this.title) return;
    const a = new Audio(); a.loop = true; a.preload = 'auto';
    const ogg = a.canPlayType('audio/ogg; codecs="vorbis"') || a.canPlayType('audio/ogg; codecs="opus"');
    a.src = ogg ? 'audio/title-theme.ogg' : 'audio/title-theme.mp3';
    a.volume = 0; this.title = a;
  },
  playTitle() {
    this.makeTitle();
    if (this.title.paused && !this.muted && this.unlocked) { try { this.title.volume = this.titleVol; } catch (e) {} const p = this.title.play(); if (p && p.catch) p.catch(() => {}); }
  },
  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.45;
    if (this.title) { if (m) this.title.pause(); else if (this.onTitle) this.playTitle(); }
    if (this.eng && this.eng.out) this.eng.out.gain.value = m ? 0 : this.eng.want || 0;
  },
  toggleMute() { this.setMuted(!this.muted); if (!this.muted && !this.unlocked) this.init(); return this.muted; },
  update(dt) {
    this.duck += (1 - this.duck) * Math.min(1, dt * 2);
    const want = this.onTitle && this.unlocked && !this.muted;
    this.titleVol = want ? Math.min(0.6, this.titleVol + dt * 0.9) : Math.max(0, this.titleVol - dt * 0.65);
    if (this.title) {
      if (want && this.title.paused) this.playTitle();
      try { this.title.volume = clamp(this.titleVol * (0.6 + 0.4 * this.duck), 0, 1); } catch (e) {}
      if (!want && this.titleVol <= 0 && !this.title.paused) this.title.pause();
    }
  },
  tone(f, d, type = 'square', v = 0.15, f2 = 0, delay = 0) {
    if (!this.ac || this.muted) return; this.duck = Math.min(this.duck, 0.6);
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(1, f2), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d + 0.05);
  },
  noise(d, v = 0.3, freq = 1000, type = 'lowpass', f2 = 0) {
    if (!this.ac || this.muted) return; this.duck = Math.min(this.duck, 0.6);
    const t = this.ac.currentTime, s = this.ac.createBufferSource(), fl = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = this.noiseBuf; fl.type = type; fl.frequency.setValueAtTime(freq, t); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    s.connect(fl); fl.connect(g); g.connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + d + 0.05);
  },
  // looping engine: two saws + exhaust noise, pitch-tracked to speed (0..1)
  startEngine() {
    if (!this.ac || this.eng) return;
    const out = this.ac.createGain(); out.gain.value = 0; out.connect(this.master);
    const fl = this.ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 400; fl.Q.value = 0.7; fl.connect(out);
    const o1 = this.ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 50;
    const o2 = this.ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 76;
    const g1 = this.ac.createGain(); g1.gain.value = 0.04; o1.connect(g1); g1.connect(fl);
    const g2 = this.ac.createGain(); g2.gain.value = 0.025; o2.connect(g2); g2.connect(fl);
    const ns = this.ac.createBufferSource(); ns.buffer = this.noiseBuf; ns.loop = true;
    const nfl = this.ac.createBiquadFilter(); nfl.type = 'bandpass'; nfl.frequency.value = 800; nfl.Q.value = 0.6;
    const ng = this.ac.createGain(); ng.gain.value = 0.03; ns.connect(nfl); nfl.connect(ng); ng.connect(out);
    o1.start(); o2.start(); ns.start();
    this.eng = { out, o1, o2, fl, nfl, ng, want: 0 };
  },
  stopEngine() {
    if (!this.eng) return;
    try { this.eng.o1.stop(); this.eng.o2.stop(); } catch (e) {}
    try { this.eng.out.disconnect(); } catch (e) {}
    this.eng = null;
  },
  engine(speed, boost, on) {
    if (!this.ac || !this.unlocked) return;
    if (on && !this.eng) this.startEngine();
    if (!this.eng) return;
    const t = this.ac.currentTime;
    const k = Math.max(0, Math.min(1, speed));
    const target = (on && !this.muted) ? (0.016 + k * 0.055 + (boost ? 0.02 : 0)) : 0;
    this.eng.want = target;
    this.eng.out.gain.setTargetAtTime(this.muted ? 0 : target, t, 0.08);
    const f = 42 + k * 180 + (boost ? 50 : 0);
    this.eng.o1.frequency.setTargetAtTime(f, t, 0.06);
    this.eng.o2.frequency.setTargetAtTime(f * 1.51, t, 0.06);
    this.eng.fl.frequency.setTargetAtTime(300 + k * 1800, t, 0.08);
    this.eng.nfl.frequency.setTargetAtTime(500 + k * 1600, t, 0.08);
  }
};
export const SFX = {
  throw()  { Snd.noise(0.2, 0.2, 2600, 'bandpass', 700); Snd.tone(260, 0.18, 'sawtooth', 0.05, 900); },
  catch()  { Snd.tone(1300, 0.05, 'square', 0.05, 900); Snd.noise(0.05, 0.12, 4000, 'highpass'); },
  hit()    { Snd.tone(900, 0.06, 'square', 0.08, 300); Snd.noise(0.08, 0.25, 3000); },
  clang()  { Snd.tone(1400, 0.12, 'triangle', 0.08, 700); Snd.tone(2100, 0.1, 'square', 0.03, 1500); Snd.noise(0.07, 0.2, 5000, 'highpass'); },
  boom()   { Snd.noise(0.5, 0.5, 900, 'lowpass', 80); Snd.tone(110, 0.4, 'sawtooth', 0.15, 30); },
  bigboom(){ Snd.noise(1.4, 0.6, 700, 'lowpass', 40); Snd.tone(70, 1.2, 'sawtooth', 0.2, 20); },
  jump()   { Snd.tone(180, 0.12, 'square', 0.07, 360); },
  pad()    { Snd.tone(150, 0.5, 'sine', 0.2, 900); Snd.noise(0.4, 0.15, 3000, 'bandpass', 600); },
  land()   { Snd.tone(70, 0.12, 'square', 0.08, 35); Snd.noise(0.1, 0.12, 400); },
  pickup() { Snd.tone(523, 0.08, 'square', 0.09); Snd.tone(784, 0.1, 'square', 0.09, 0, 0.08); Snd.tone(1046, 0.2, 'square', 0.09, 0, 0.16); },
  start()  { Snd.tone(110, 0.6, 'sawtooth', 0.12, 55); Snd.noise(0.5, 0.3, 500); },
  win()    { [523, 659, 784, 1046].forEach((f, i) => Snd.tone(f, 0.25, 'square', 0.08, 0, i * 0.14)); },
  boost()  { Snd.noise(0.35, 0.28, 900, 'bandpass', 2400); Snd.tone(90, 0.4, 'sawtooth', 0.12, 280); },
  rocket() { Snd.noise(0.6, 0.35, 700, 'lowpass', 2000); Snd.tone(80, 0.7, 'sawtooth', 0.16, 400); },
  spring() { Snd.tone(140, 0.18, 'square', 0.1, 520); Snd.tone(80, 0.2, 'sine', 0.08, 40); },
  grapple(){ Snd.tone(900, 0.08, 'square', 0.06, 400); Snd.noise(0.15, 0.16, 2500, 'bandpass', 600); Snd.tone(220, 0.25, 'sawtooth', 0.07, 140); },
  heli()   { Snd.noise(0.5, 0.18, 1200, 'bandpass', 800); Snd.tone(240, 0.4, 'triangle', 0.05, 180); },
  glove()  { Snd.noise(0.18, 0.35, 800, 'lowpass', 200); Snd.tone(90, 0.16, 'square', 0.14, 40); },
  bump()   { Snd.noise(0.12, 0.22, 500, 'lowpass', 180); Snd.tone(70, 0.1, 'square', 0.08, 40); },
  skid()   { Snd.noise(0.22, 0.12, 1800, 'bandpass', 2800); },
  lap()    { Snd.tone(880, 0.1, 'square', 0.08); Snd.tone(1174, 0.16, 'square', 0.08, 0, 0.1); },
  count()  { Snd.tone(440, 0.12, 'square', 0.09); },
  go()     { Snd.tone(660, 0.12, 'square', 0.1); Snd.tone(880, 0.25, 'square', 0.1, 0, 0.1); },
  finish() { [523, 659, 784, 1046, 1318].forEach((f, i) => Snd.tone(f, 0.28, 'square', 0.09, 0, i * 0.12)); },
  dash()   { Snd.noise(0.16, 0.14, 1800, 'bandpass', 4000); }
};
