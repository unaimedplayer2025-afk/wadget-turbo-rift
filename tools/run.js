// Fast deterministic-step run of the ?capture demo.
const { chromium } = require('playwright');
const STEP = +(process.argv[2] || 4);
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await p.goto('http://localhost:8766/index.html?capture&seed=' + (process.env.SEED || 7)); await p.waitForFunction(() => window.__cap);
  let last = '', t0 = Date.now();
  for (let f = 0; f < 60 * 70 / STEP; f++) {
    const s = await p.evaluate(n => window.__cap.step(n), STEP);
    const key = [s.mode, s.track, s.lap, s.gadget, s.year].join('|');
    if (key !== last) { console.log((s.t).toFixed(1).padStart(6), key, 'spd', s.speed, 'pl', s.place, 's', s.s); last = key; }
    if (s.mode === 'results' && s.t > 50) { console.log('END', s.mode, s.t.toFixed(1)); break; }
  }
  console.log('wall', ((Date.now() - t0) / 1000).toFixed(0), 's  errors', errs.length, errs.slice(0, 8).join('\n'));
  await b.close();
})();
