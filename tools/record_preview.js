// Records a ~10 s gameplay preview (demo autopilot, deterministic frame stepping) to preview/runner-preview.mp4
// Segments: Port Louis (4 s) -> Pereybere Beach (3 s) -> Pirogue Run at sea (3 s).
// Usage: NODE_PATH=<dir containing puppeteer-core> node tools/record_preview.js
const path = require('path'), fs = require('fs'), { execSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const ROOT = path.resolve(__dirname, '..'), FPS = 30, FR = path.join(ROOT, 'preview', 'frames');
const SEGMENTS = [{ level: 1, secs: 4, warm: 12, at: 0 }, { level: 2, secs: 3, warm: 20, at: 0 }, { level: 6, secs: 3, warm: 20, at: 0 }];
(async () => {
  fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true });
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage(); await p.setViewport({ width: 1280, height: 720 });
  p.on('pageerror', e => console.error('pageerror', e.message));
  let n = 0;
  for (const s of SEGMENTS) {
    await p.goto('file://' + path.join(ROOT, 'index.html') + `?demo=1&capture=1&level=${s.level}`, { waitUntil: 'load' });
    await p.waitForFunction('window.__zrReady === true');
    await p.evaluate((at) => { if (at) window.__zr.api.teleport(at); }, s.at);
    await p.evaluate(w => window.__zrAdvance(w, 1 / 30), s.warm);
    for (let i = 0; i < s.secs * FPS; i++) {
      await p.evaluate(fps => window.__zrAdvance(1, 1 / fps), FPS);
      await p.screenshot({ path: path.join(FR, String(n++).padStart(4, '0') + '.jpg'), type: 'jpeg', quality: 90 });
    }
    console.log('segment level', s.level, 'frames so far', n);
  }
  await b.close();
  const out = path.join(ROOT, 'preview', 'runner-preview.mp4');
  execSync(`ffmpeg -y -loglevel error -framerate ${FPS} -i "${FR}/%04d.jpg" -vf "fade=t=in:st=0:d=0.25,fade=t=out:st=9.7:d=0.3" -c:v libx264 -preset slow -pix_fmt yuv420p -crf 20 -movflags +faststart "${out}"`);
  fs.rmSync(FR, { recursive: true, force: true });
  console.log('wrote', out);
})().catch(e => { console.error(e); process.exit(1); });
