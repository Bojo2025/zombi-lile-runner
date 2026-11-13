// Headless test: loads index.html from file:// in Chrome (desktop + mobile emulation with touch),
// checks console errors, screenshots title / tutorial / every level / boss / game over / victory.
// Usage: NODE_PATH=<dir containing puppeteer-core> node tools/test_headless.js
const path = require('path'), fs = require('fs');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), URL = 'file://' + path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'screenshots'); fs.mkdirSync(OUT, { recursive: true });
const NAMES = ['portlouis', 'pereybere', 'chamarel', 'lepouce', 'flicenflac', 'pirogue', 'sugarcane', 'samara'];
const errors = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function page(b, q, vp) {
  const p = await b.newPage(); await p.setViewport(vp || { width: 1280, height: 720 });
  p.on('pageerror', e => errors.push((q || '') + ' pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push((q || '') + ' console: ' + m.text()); });
  await p.goto(URL + (q || ''), { waitUntil: 'load' }); await p.waitForFunction('window.__zrReady === true', { timeout: 20000 });
  return p;
}
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const only = process.argv[2];
  // 1. title (real-time animated intro) + tutorial + level select
  if (!only || only === 'title') {
    const p = await page(b, '');
    await sleep(3600); await p.screenshot({ path: path.join(OUT, '01_title.png') });
    await p.click('#btnHow'); await sleep(300); await p.screenshot({ path: path.join(OUT, '02_tutorial.png') });
    await p.click('#btnTutGo'); await sleep(200); await p.click('#btnLevels'); await sleep(300); await p.screenshot({ path: path.join(OUT, '03_level_select.png') });
    await p.close();
  }
  // 1b. audio: confirm slash SFX actually render non-silent audio
  if (!only || only === 'audio' || only === 'title') {
    const p = await page(b, '');
    const audio = await p.evaluate(async () => {
      const AU = window.ZRAudio;
      AU.init();
      await new Promise(r => setTimeout(r, 600));
      const names = ['swing', 'chop', 'cleave', 'spin'];
      const peaks = await AU.measureSfx(names);
      const ev = AU.voiceEvents();
      const decoded = AU.voiceDecoded();
      // fire the gameplay hooks so we know they are callable
      AU.sfx('swing'); AU.sfx('chop'); AU.sfx('cleave'); AU.sfx('spin');
      AU.voice('levelStart'); AU.voice('jump'); AU.voice('chop'); AU.voice('cleave'); AU.voice('spin');
      return { peaks, ev, decoded, ready: AU.ready() };
    });
    console.log('AUDIO', JSON.stringify(audio, null, 2));
    if (!audio.ready) errors.push('AudioContext did not start');
    const need = ['levelStart', 'jump', 'chop', 'cleave', 'spin'];
    need.forEach(n => { if (!(audio.ev || []).includes(n)) errors.push('missing voice event ' + n); if (!(audio.decoded || []).includes(n)) errors.push('voice clip not decoded: ' + n); });
    (audio.peaks || []).forEach(r => {
      if (!(r.peak > 0.05)) errors.push('SFX ' + r.name + ' is silent (peak=' + r.peak + ')');
    });
    if ((audio.peaks || []).length < 4) errors.push('measureSfx returned too few results');
    await p.close();
  }
  // 2. every level in demo/capture mode
  for (let i = 1; i <= 8; i++) {
    if (only && only !== 'levels' && only !== String(i)) continue;
    const p = await page(b, `?demo=1&capture=1&level=${i}`);
    let s = await p.evaluate(() => window.__zrAdvance(75, 1 / 30));
    await p.screenshot({ path: path.join(OUT, `1${i}_level${i}_${NAMES[i - 1]}.png`) });
    s = await p.evaluate(() => { window.__zr.api.teleport(0.55); return window.__zrAdvance(70, 1 / 30); });
    await p.screenshot({ path: path.join(OUT, `1${i}_level${i}_${NAMES[i - 1]}_b.png`) });
    // spawn the end-of-level boss and snapshot it
    s = await p.evaluate(() => { window.__zr.api.teleport(0.99); return window.__zrAdvance(40, 1 / 30); });
    let bg = 0; while ((!s.boss || s.boss === 'dead') && s.mode === 'play' && bg++ < 40) s = await p.evaluate(() => window.__zrAdvance(15, 1 / 30));
    if (s.boss && s.boss !== 'dead') s = await p.evaluate(() => window.__zrAdvance(55, 1 / 30));
    await p.screenshot({ path: path.join(OUT, `2${i}_boss${i}_${NAMES[i - 1]}.png`) });
    console.log('boss', i, s.boss, 'hp', s.bossHp, 'state', s.bossState);
    if (!s.boss) errors.push('level ' + i + ' boss did not spawn');
    // run the rest of the level / beat the boss
    let guard = 0; while (s.mode === 'play' && s.level === i && guard++ < 260) s = await p.evaluate(() => window.__zrAdvance(30, 1 / 30));
    console.log('level', i, 'done ->', JSON.stringify(s));
    await p.close();
  }
  // 3. boss fight + victory
  if (!only || only === 'boss') {
    const p = await page(b, '?demo=1&capture=1&level=8');
    await p.evaluate(() => { window.__zr.api.teleport(0.97); return window.__zrAdvance(60, 1 / 30); });
    let s; for (let k = 0; k < 6; k++) s = await p.evaluate(() => window.__zrAdvance(20, 1 / 30));
    await p.screenshot({ path: path.join(OUT, '30_boss_gran_zombi.png') });
    let guard = 0; while (s.mode === 'play' && guard++ < 200) s = await p.evaluate(() => window.__zrAdvance(30, 1 / 30));
    console.log('boss ->', JSON.stringify(s));
    await sleep(200); await p.screenshot({ path: path.join(OUT, '32_victory.png') });
    await p.close();
  }
  // 4. game over (non-demo)
  if (!only || only === 'over') {
    const p = await page(b, '?capture=1');
    await p.evaluate(() => { localStorage.setItem('zrTut', 'true'); window.__zr.api.startRun(0); document.getElementById('btnCard').click(); window.__zrAdvance(60, 1 / 30); window.__zr.api.gameOver(); return window.__zrAdvance(20, 1 / 30); });
    await sleep(300); await p.screenshot({ path: path.join(OUT, '31_game_over.png') });
    await p.close();
  }
  // 5. mobile emulation with real touch input (landscape + portrait)
  if (!only || only === 'mobile') {
    const vp = { width: 844, height: 390, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: true };
    const p = await page(b, '', vp);
    await sleep(3200);
    await p.screenshot({ path: path.join(OUT, '40_mobile_title_landscape.png') });
    await p.evaluate(() => localStorage.setItem('zrTut', 'true'));
    await p.tap('#btnStart'); await sleep(300);
    await p.screenshot({ path: path.join(OUT, '41_mobile_level_card.png') });
    await p.tap('#btnCard'); await sleep(400);
    const before = await p.evaluate(() => ({ y: window.__zr.hero.y, x: window.__zr.hero.x }));
    await p.touchscreen.tap(150, 250); await sleep(120);
    const jumped = await p.evaluate(() => window.__zr.hero.y);
    await p.touchscreen.tap(700, 250); await sleep(60);
    const slashed = await p.evaluate(() => window.__zr.hero.atype);
    await sleep(900);
    // swipe down to slide
    await p.touchscreen.touchStart(420, 150); await p.touchscreen.touchMove(420, 200); await p.touchscreen.touchMove(420, 280); await p.touchscreen.touchEnd(); await sleep(60);
    const slid = await p.evaluate(() => window.__zr.hero.slideT > 0);
    await sleep(400);
    await p.screenshot({ path: path.join(OUT, '42_mobile_gameplay_landscape.png') });
    console.log('touch: jumpedUp=', jumped < before.y, 'slash=', slashed, 'slide=', slid, 'mode=', await p.evaluate(() => window.__zr.mode));
    if (!(jumped < before.y) || slashed !== 'slash' || !slid) errors.push('touch controls check failed');
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true, isLandscape: false }); await sleep(500);
    await p.screenshot({ path: path.join(OUT, '43_mobile_portrait_rotate_hint.png') });
    await p.tap('#btnRotateOk'); await sleep(500);
    await p.screenshot({ path: path.join(OUT, '44_mobile_portrait_playing.png') });
    await p.close();
  }
  await b.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO CONSOLE ERRORS');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
