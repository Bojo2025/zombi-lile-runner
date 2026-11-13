// usage: node tools/shot.js <file.html?query> <out.png> [w h]
const puppeteer = require('puppeteer-core'); const path = require('path');
(async () => {
  const [f, out, w, h] = process.argv.slice(2);
  const b = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const p = await b.newPage(); await p.setViewport({ width: +(w || 1600), height: +(h || 900) });
  p.on('console', m => console.log('console', m.type(), m.text())); p.on('pageerror', e => console.log('pageerror', e.message));
  await p.goto('file://' + path.resolve(f.split('?')[0]) + (f.includes('?') ? '?' + f.split('?')[1] : ''));
  await p.waitForFunction('window.done===true', { timeout: 15000 });
  await p.screenshot({ path: out }); await b.close();
})();
