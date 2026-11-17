// Screenshots: title + each track mid-race via capture stepping / debug jump.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8766/index.html?capture&seed=7'); await p.waitForFunction(() => window.__cap);
  await p.evaluate(() => window.__cap.step(90));
  await p.screenshot({ path: '/workspace/wadget-racer/screenshot.png', type: 'png' });
  // isle racing
  await p.evaluate(() => { window.__cap.step(180); });
  await p.screenshot({ path: '/workspace/wadget-racer/screenshot-isle.png', type: 'png' });
  // prairie
  await p.evaluate(() => { /* step to wipe */ let s; for (let i = 0; i < 500; i++) s = window.__cap.step(2); return s; });
  const st = await p.evaluate(() => ({ mode: __dbg.G.mode, track: __dbg.G.trackId, t: __dbg.G.t }));
  console.log('after isle block', st);
  await p.screenshot({ path: `/workspace/wadget-racer/screenshot-${st.track}.png`, type: 'png' });
  console.log('errors', errs);
  await b.close();
})();
