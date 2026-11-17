// Smoke test: load, collect console errors, start game via two inputs, run a bit, screenshot.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8766/index.html';
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  await p.screenshot({ path: '/tmp/wr_title.png' });
  const has = await p.evaluate(() => !!window.__dbg);
  if (!has) { console.log('NO __dbg\n' + errs.join('\n')); await b.close(); return; }
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(400);
  const a1 = await p.evaluate(() => ({ mode: __dbg.G.mode, armed: __dbg.titleArmed, unlocked: __dbg.Snd.unlocked }));
  await p.keyboard.press('KeyQ'); await p.waitForTimeout(400);
  const a2 = await p.evaluate(() => ({ mode: __dbg.G.mode, track: __dbg.G.trackId, racers: __dbg.G.racers.length }));
  await p.keyboard.down('KeyW'); await p.waitForTimeout(2500); await p.keyboard.up('KeyW');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: '/tmp/wr_play.png' });
  const st = await p.evaluate(() => {
    const r = __dbg.player;
    return { mode: __dbg.G.mode, track: __dbg.G.trackId, pos: r.pos.toArray().map(v => +v.toFixed(2)), speed: +r.speed.toFixed(1), s: +r.s.toFixed(1), lap: r.lap, place: r.place, len: __dbg.G.track.length };
  });
  console.log(JSON.stringify({ a1, a2, st }, null, 2));
  console.log('ERRORS', errs.length, '\n' + errs.join('\n'));
  await b.close();
})();
