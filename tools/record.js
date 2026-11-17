// Records the ?capture autopilot run frame-by-frame (fixed 60Hz sim, 30fps output) -> /tmp/wr_frames
const { chromium } = require('playwright'); const fs = require('fs');
const W = +(process.env.W || 1280), H = +(process.env.H || 720), DIR = '/tmp/wr_frames';
(async () => {
  fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR);
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: W, height: H } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  await p.goto('http://localhost:8766/index.html?capture&seed=' + (process.env.SEED || 7)); await p.waitForFunction(() => window.__cap);
  await p.waitForTimeout(400);
  const log = []; let endF = -1;
  for (let f = 0; f < 30 * 62; f++) {
    const s = await p.evaluate(() => window.__cap.step(2));
    await p.screenshot({ path: `${DIR}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 88 });
    log.push({ f, mode: s.mode, track: s.track, t: s.t, speed: s.speed, place: s.place, gadget: s.gadget });
    if (f % 90 === 0) console.log('frame', f, s.mode, s.track, 't', s.t && s.t.toFixed(1), 'spd', s.speed, new Date().toLocaleTimeString());
    if (s.mode === 'results' && endF < 0) endF = f;
    if (endF >= 0 && f - endF > 90) break;
  }
  fs.writeFileSync('/tmp/wr_frames.json', JSON.stringify(log));
  console.log('done frames', log.length, 'errors', errs.length, errs.slice(0, 5));
  await b.close();
})();
