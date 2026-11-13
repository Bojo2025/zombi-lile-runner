// ZOMBI LILE RUNNER - game engine: auto-runner physics, combat, levels, boss, HUD, title, input.
(function () {
  'use strict';
  var ART = window.ZRArt, AU = window.ZRAudio, LEVELS = window.ZR_LEVELS, IMG = ART.img;
  var Q = {}; location.search.replace(/[?&]([^=&]+)=?([^&]*)/g, function (_, k, v) { Q[k] = decodeURIComponent(v || '1'); });
  var DEMO = !!Q.demo, CAPTURE = !!Q.capture, START_LEVEL = Math.max(1, Math.min(8, +Q.level || 1));
  var GROUND = 440, VH = 540, PXM = 32, GRAV = 2700, TAU = Math.PI * 2;
  var cv = document.getElementById('game'), cx = cv.getContext('2d');
  var W = 960, H = 540, SC = 1, DPR = 1, TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  var $ = function (id) { return document.getElementById(id); };
  var store = { get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };

  // ---------- RNG ----------
  var seedState = 1;
  function rnd() { seedState |= 0; seedState = seedState + 0x6D2B79F5 | 0; var t = Math.imul(seedState ^ seedState >>> 15, 1 | seedState); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function R(a, b) { return a + (b - a) * rnd(); }
  function fx() { return Math.random(); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var G = { mode: 'boot', t: 0, titleT: 0, best: store.get('zrBest', 0), done: store.get('zrDone', {}) };
  window.__zr = G;

  function resize() {
    var iw = window.innerWidth, ih = window.innerHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    if (iw * ih * DPR * DPR > 2560 * 1440) DPR = Math.sqrt(2560 * 1440 / (iw * ih));
    SC = Math.min(ih / VH, iw / 720); W = iw / SC; H = ih / SC;
    cv.width = Math.round(iw * DPR); cv.height = Math.round(ih * DPR);
    cv.style.width = iw + 'px'; cv.style.height = ih + 'px';
    checkRotate();
  }
  function checkRotate() {
    var portrait = window.innerHeight > window.innerWidth * 1.05;
    var show = TOUCH && portrait && !G.rotateOk && (G.mode === 'play' || G.mode === 'card' || G.mode === 'paused') && !DEMO;
    $('rotate').classList.toggle('hidden', !show);
    if (show && G.mode === 'play') pauseGame(true);
  }

  // ---------- LEVEL BUILD ----------
  function buildLevel(idx) {
    var L = LEVELS[idx]; seedState = 1234 + idx * 977 + (G.runSeed || 0);
    var endX = L.length * PXM, segs = [], x = -800, y = GROUND, gapP = Math.min(0.85, L.gaps * 2.2);
    var spd = L.speed;
    while (x < endX + 4000) {
      var len = L.terrain === 'boats' ? R(900, 1500) : gapP > 0 ? R(600, 1200) : 30000;
      if (L.boss && x > endX - 600) len = 6000;
      var slope = 0;
      if (L.terrain === 'climb' && x > 300) slope = [0, -0.18, -0.3, -0.42, -0.3][Math.floor(R(0, 5))];
      segs.push({ x0: x, x1: x + len, y0: y, y1: y + slope * len, boat: L.terrain === 'boats', ph: R(0, 6) });
      y += slope * len; x += len;
      if (x > 1300 && x < endX - 500 && rnd() < gapP) x += (L.terrain === 'boats' ? R(140, 200) : R(115, 175)) * (spd / 360);
    }
    var ents = [], obs = [], pick = [], gaps = [];
    for (var i = 1; i < segs.length; i++) if (segs[i].x0 > segs[i - 1].x1 + 1) gaps.push([segs[i - 1].x1, segs[i].x0]);
    var ew = L.enemies, ekeys = Object.keys(ew), etot = ekeys.reduce(function (s, k) { return s + ew[k]; }, 0);
    function pickEnemy() { var r = rnd() * etot; for (var k = 0; k < ekeys.length; k++) { r -= ew[ekeys[k]]; if (r <= 0) return ekeys[k]; } return ekeys[0]; }
    function nearGap(px, m) { for (var g = 0; g < gaps.length; g++) if (px > gaps[g][0] - m && px < gaps[g][1] + m) return gaps[g]; return null; }
    var pos = DEMO ? 560 : 900, hearts = 0;
    while (pos < endX - 300) {
      var prog = pos / endX, spacing = lerp(560, 360, prog) * (1 - idx * 0.03);
      var g = nearGap(pos, 300);
      if (g) { coinArc(pick, (g[0] + g[1]) / 2, 5, 150); pos = g[1] + 320; continue; }
      var r = rnd();
      if (r < 0.56) {
        var type = pickEnemy(), grp = (type === 'walker' && rnd() < 0.22 + prog * 0.25) ? Math.floor(R(2, 4)) : 1;
        for (var n = 0; n < grp; n++) ents.push(makeEnemy(type, pos + n * 75, L, idx));
        if (rnd() < 0.3) coinLine(pick, pos - 220, 4, -60);
        pos += (grp - 1) * 75;
      } else if (r < 0.86) {
        var kind = L.obstacles[Math.floor(rnd() * L.obstacles.length)], od = ART.OBST[kind];
        obs.push({ kind: kind, x: pos, alt: rnd() < 0.5, w: od.w, h: od.h || 0, high: od.high || 0 });
        if (od.high) coinLine(pick, pos - 40, 4, -26); else if (rnd() < 0.6) coinArc(pick, pos, 4, od.h + 110);
      } else {
        var pr = rnd();
        if (pr < 0.16 && hearts < 2 + (idx > 3 ? 1 : 0)) { pick.push({ kind: 'dholl', x: pos, yo: -90 }); hearts++; }
        else if (pr < 0.25) pick.push({ kind: 'gato', x: pos, yo: -90 });
        else if (pr < 0.32) pick.push({ kind: 'alouda', x: pos, yo: -90 });
        else coinLine(pick, pos, 6, -50 - Math.floor(R(0, 2)) * 60);
      }
      pos += spacing * R(0.8, 1.3);
    }
    return { L: L, idx: idx, segs: segs, ents: ents, obs: obs, pick: pick, endX: endX };
  }
  function coinLine(arr, x, n, yo) { for (var i = 0; i < n; i++) arr.push({ kind: 'coin', x: x + i * 38, yo: yo }); }
  function coinArc(arr, x, n, h) { for (var i = 0; i < n; i++) { var u = (i / (n - 1)) * 2 - 1; arr.push({ kind: 'coin', x: x + u * 90, yo: -40 - (1 - u * u) * h }); } }
  var HEADS = ['zHead0', 'zHead1', 'zHead2'], SKINS = ['#7f9670', '#86977a', '#6f8a66', '#8c9a6e', '#7a8c74'];
  var HUMAN_SKINS = ['#c08a60', '#8a5a3a', '#e0b08a', '#a8724a', '#6a4028', '#d49a70'];
  function makeEnemy(type, x, L, idx) {
    var seed = Math.floor(R(1, 9999)), outfit = ART.outfit(L.outfit, seed);
    var e = { type: type, x: x, y: GROUND, vx: 0, vy: 0, alive: true, phase: R(0, 6), seed: seed, skin: SKINS[seed % SKINS.length], outfit: outfit,
      head: outfit.tags.indexOf('onepiece') >= 0 ? 'zHead1' : (seed % 3 === 0 ? 'zHead1' : 'zHead0'), stag: 0, state: 'idle', moan: R(1, 6) };
    if (type === 'walker') e.vx = -R(28, 58);
    if (type === 'brute') { e.vx = -R(22, 34); e.head = 'zHead2'; }
    if (type === 'crawler') { e.vx = -R(35, 55); e.head = 'zHead0'; }
    if (type === 'turner') { e.tr = 0; e.panic = true; e.humanSkin = HUMAN_SKINS[seed % HUMAN_SKINS.length]; e.hair = ['#2a1c14', '#4a2a1a', '#111', '#6a4a2a'][seed % 4]; e.vx = -R(70, 100); e.trig = R(360, 520); }
    if (type === 'boarder') { e.type = 'walker'; e.climb = 0; e.state = 'climb'; e.vx = -R(30, 50); }
    if (type === 'jumper') { e.type = 'walker'; e.state = 'perchJ'; e.vx = -R(30, 50); }
    if (type === 'monkey') { e.tr = 0; e.state = 'perch'; }
    if (type === 'fish') { e.tr = 0; e.state = 'swim'; }
    if (type === 'boulder') { e.state = 'wait'; e.rot = 0; }
    return e;
  }

  // ---------- TERRAIN QUERIES ----------
  function segAt(x) { var s = G.segs, lo = 0, hi = s.length - 1; while (lo <= hi) { var m = (lo + hi) >> 1; if (x < s[m].x0) hi = m - 1; else if (x > s[m].x1) lo = m + 1; else return s[m]; } return null; }
  function groundAt(x) { var s = segAt(x); if (!s) return null; var y = s.y0 + (x - s.x0) * (s.y1 - s.y0) / (s.x1 - s.x0); if (s.boat) y += Math.sin(G.t * 1.6 + s.ph) * 5; return y; }
  function baseGround(x) { var s = segAt(x); if (s) return s.y0 + (x - s.x0) * (s.y1 - s.y0) / (s.x1 - s.x0); var n = nextSeg(x); return n ? n.y0 : GROUND; }
  function nextSeg(x) { for (var i = 0; i < G.segs.length; i++) if (G.segs[i].x0 > x) return G.segs[i]; return null; }

  // ---------- START / FLOW ----------
  function newHero() { return { x: 200, y: GROUND, vy: 0, grounded: true, jumps: 0, pose: 'run', phase: 0, slideT: 0, hurtT: 0, invuln: 0, atype: null, at: 0, adur: 0.2, chain: 0, lastTap: -9, hold: false, holdT: 0, flip: 0, flipT: 0, airT: 0, queuedSlide: false, prevY: GROUND }; }
  function startRun(levelIdx) { G.score = 0; G.hearts = 3; G.totalKills = 0; G.runSeed = Math.floor(Math.random() * 1000); startLevel(levelIdx); }
  function startLevel(idx) {
    var B = buildLevel(idx);
    G.L = B.L; G.idx = idx; G.segs = B.segs; G.ents = B.ents; G.obs = B.obs; G.pick = B.pick; G.endX = B.endX;
    G.hero = newHero(); G.hero.y = groundAt(200) || GROUND; G.hero.prevY = G.hero.y;
    G.parts = []; G.pieces = []; G.decals = []; G.texts = []; G.projs = [];
    G.camX = G.hero.x - W * 0.27; G.camY = (G.hero.y - GROUND); G.speed = G.L.speed; G.levelT = 0;
    G.kills = 0; G.coins = 0; G.spin = DEMO ? 100 : 40; G.streak = 0; G.streakT = 0; G.shake = 0; G.hitstop = 0; G.flash = 0; G.redFlash = 0;
    G.power = { gato: 0, alouda: 0 }; G.boss = null; G.bossDone = 0; G.levelScore0 = G.score; G.finished = false;
    G.ai = { q: [], cd: 0 }; G.lightning = 0; G.hintT = 7; G.bodyHint = false;
    if (AU.ready()) { AU.setMusic('run', idx / 8); AU.setAmbience(G.L.amb); }
    hideAll();
    if (DEMO) { G.mode = 'play'; showHud(true); return; }
    G.mode = 'card'; showHud(false);
    $('cardKicker').textContent = 'LEVEL ' + (idx + 1) + ' / 8';
    $('cardTitle').textContent = G.L.name.toUpperCase();
    $('cardText').innerHTML = '<i>' + G.L.sub + '</i><br>' + G.L.intro;
    $('btnCard').textContent = 'RUN!'; G.cardAction = 'go'; $('card').classList.remove('hidden');
    checkRotate();
  }
  function levelComplete() {
    G.finished = true; AU.sfx('level');
    var done = G.done; done[G.idx + 1] = true; store.set('zrDone', done);
    G.hearts = Math.min(5, G.hearts + 1);
    if (G.idx === 7) return victory();
    if (DEMO) { startLevel((G.idx + 1) % 8); return; }
    G.mode = 'card'; showHud(false);
    $('cardKicker').textContent = 'LEVEL ' + (G.idx + 1) + ' CLEARED';
    $('cardTitle').textContent = G.L.name.toUpperCase();
    var nx = LEVELS[G.idx + 1];
    $('cardText').innerHTML = 'Heads chopped: <b>' + G.kills + '</b> &nbsp; Rupees: <b>' + G.coins + '</b> &nbsp; Score: <b>' + G.score + '</b><br>+1 heart for surviving.<br><br>Next: <b>' + nx.name + '</b> - ' + nx.sub;
    $('btnCard').textContent = 'NEXT LEVEL'; G.cardAction = 'next'; $('card').classList.remove('hidden');
  }
  function victory() {
    G.mode = 'victory'; showHud(false); AU.sfx('victory'); AU.setMusic('title'); AU.setAmbience('sunset');
    saveBest();
    $('vicText').innerHTML = 'From Port Louis to Samara, the Gran Zombi has lost his head.<br>Final score: <b>' + G.score + '</b> &nbsp; Best: <b>' + G.best + '</b>';
    hideAll(); $('victory').classList.remove('hidden');
  }
  function gameOver() {
    if (G.mode !== 'play') return;
    G.mode = 'over'; AU.sfx('over'); saveBest(); showHud(false);
    $('overText').innerHTML = 'Level ' + (G.idx + 1) + ': ' + G.L.name + ' &nbsp; ' + Math.floor(G.hero.x / PXM) + ' m<br>Score: <b>' + G.score + '</b> &nbsp; Best: <b>' + G.best + '</b>';
    setTimeout(function () { if (G.mode === 'over') { hideAll(); $('over').classList.remove('hidden'); } }, CAPTURE ? 0 : 900);
  }
  function saveBest() { if (G.score > G.best) { G.best = G.score; store.set('zrBest', G.best); } }
  function hideAll() { ['title', 'levels', 'tutorial', 'card', 'pause', 'over', 'victory'].forEach(function (id) { $(id).classList.add('hidden'); }); }
  function showHud(on) { $('btnPause').classList.toggle('hidden', !on); $('btnMute').classList.toggle('hidden', !on); }
  function pauseGame(on) {
    if (on && G.mode === 'play') { G.mode = 'paused'; hideAll(); $('pause').classList.remove('hidden'); AU.suspend(); }
    else if (!on && G.mode === 'paused') { G.mode = 'play'; hideAll(); AU.resume(); }
  }
  function toTitle() { G.mode = 'title'; G.titleT = 3.0; G.L = null; hideAll(); $('title').classList.remove('hidden'); showHud(false); if (AU.ready()) { AU.setMusic('title'); AU.setAmbience(null); } updateBestLine(); }
  function updateBestLine() { $('bestLine').textContent = G.best ? 'BEST SCORE ' + G.best : ''; }

  // ---------- HERO ACTIONS ----------
  function jump() {
    var h = G.hero; if (G.mode !== 'play') return;
    if (h.slideT > 0) h.slideT = 0;
    if (h.grounded || h.airT < 0.1) { h.vy = -930; h.grounded = false; h.jumps = 1; h.hold = true; h.holdT = 0; AU.sfx('jump'); dust(h.x, h.y, 6); }
    else if (h.jumps < 2) { h.vy = -840; h.jumps = 2; h.hold = true; h.holdT = 0; h.flipT = 0.0001; AU.sfx('djump'); ring(h.x, h.y - 20); }
  }
  function release() { if (G.hero) G.hero.hold = false; }
  function slide() {
    var h = G.hero; if (G.mode !== 'play') return;
    if (h.grounded) { if (h.slideT <= 0) AU.sfx('slide'); h.slideT = 0.62; dust(h.x, h.y, 8); }
    else { h.vy = Math.max(h.vy, 1350); h.queuedSlide = true; }
  }
  function slash() {
    var h = G.hero; if (G.mode !== 'play') return;
    if (G.t - h.lastTap < 0.36) h.chain++; else h.chain = 1;
    h.lastTap = G.t;
    if (h.chain >= 3) { if (G.spin >= 100) { doSpin(); h.chain = 0; return; } popText(h.x + 40, h.y - 190, 'SPIN NEEDS A FULL METER', '#ffd0a0', 0.8); doCleave(); return; }
    if (h.chain === 2) return doCleave();
    doSlash();
  }
  function reach() { return 150 + (G.power.gato > 0 ? 80 : 0); }
  function canHit(e) { return e.alive && (e.tr === undefined || e.tr >= 1 || e.type === 'fish' || e.type === 'monkey') && e.state !== 'perch' && e.state !== 'swim' && e.state !== 'perchJ' && e.state !== 'wait' && !(e.state === 'climb' && e.climb < 0.5); }
  function ebox(e) {
    var x = e.x, y = e.y;
    switch (e.type) {
      case 'brute': return [x - 30, y - 205, x + 30, y];
      case 'crawler': return [x - 48, y - 40, x + 45, y];
      case 'monkey': return [x - 26, y - 56, x + 24, y - 4];
      case 'fish': return [x - 28, y - 18, x + 30, y + 18];
      case 'boulder': return [x - 30, y - 60, x + 30, y];
      case 'boss': return [x - 70, y - 350, x + 60, y];
      default: return [x - 24, y - 155, x + 22, y];
    }
  }
  function headPt(e) {
    switch (e.type) {
      case 'brute': return [e.x - 18, e.y - 180];
      case 'crawler': return [e.x - 34, e.y - 30];
      case 'monkey': return [e.x - 18, e.y - 42];
      case 'fish': return [e.x - 16, e.y];
      case 'boulder': return [e.x, e.y - 30];
      case 'boss': return [e.x - 30, e.y - 300];
      default: return [e.x - 14, e.y - 136];
    }
  }
  function doSlash() {
    var h = G.hero; h.atype = 'slash'; h.at = 0; h.adur = 0.22; AU.sfx('swing');
    var rx0 = h.x - 20, rx1 = h.x + reach(), ry0 = h.y - 168, ry1 = h.y + 10, best = null, bd = 1e9, body = null;
    if (G.boss && bossInReach(rx1)) return hitBoss(1);
    G.ents.forEach(function (e) {
      if (!canHit(e) || e.type === 'boulder') return;
      var hp = headPt(e);
      if (hp[0] > rx0 && hp[0] < rx1 + 20 && hp[1] > ry0 && hp[1] < ry1) { var d = hp[0] - h.x; if (d < bd) { bd = d; best = e; } }
      else { var b = ebox(e); if (b[0] < rx1 && b[2] > rx0 && b[1] < ry1 && b[3] > ry0) body = body || e; }
    });
    if (best) decap(best, 'HEAD CHOP!');
    else if (body) { body.stag = 0.7; AU.sfx('thud'); spark(headPt(body)[0], h.y - 110); if (!G.bodyHint) { G.bodyHint = true; popText(body.x, body.y - 230, 'BODY HIT! CLEAVE (2 TAPS) OR JUMP-SLASH', '#ffe0a0', 1.3); } else popText(body.x, body.y - 230, 'STAGGER', '#ffe0a0', 0.5); }
  }
  function doCleave() {
    var h = G.hero; h.atype = 'cleave'; h.at = 0; h.adur = 0.34; AU.sfx('cleave');
    var rx0 = h.x - 20, rx1 = h.x + reach() + 30, ry0 = h.y - 270, ry1 = h.y + 20, best = null, bd = 1e9;
    if (G.boss && bossInReach(rx1)) return hitBoss(2);
    G.ents.forEach(function (e) { if (!canHit(e)) return; var b = ebox(e); if (b[0] < rx1 && b[2] > rx0 && b[1] < ry1 && b[3] > ry0) { var d = b[0] - h.x; if (d < bd) { bd = d; best = e; } } });
    if (best) cleave(best);
  }
  function doSpin() {
    var h = G.hero; h.atype = 'spin'; h.at = 0; h.adur = 0.55; G.spin = 0; AU.sfx('spin'); G.shake = 8; G.flash = 0.25;
    var n = 0, cxh = h.x, cyh = h.y - 70;
    if (G.boss && Math.abs(G.boss.x - h.x) < 300) hitBoss(3);
    G.ents.forEach(function (e) { if (!canHit(e)) return; var b = ebox(e), ex = (b[0] + b[2]) / 2, ey = (b[1] + b[3]) / 2; if (Math.hypot(ex - cxh, (ey - cyh) * 1.3) < 270) { n++; if (n % 2 && e.type !== 'boulder' && e.type !== 'fish') decap(e, null, 200); else cleave(e, 200); } });
    popText(h.x + 30, h.y - 220, n > 0 ? 'SPIN STORM x' + n + '!' : 'SPIN STORM!', '#ffcc3a', 1.2, 1.4);
  }
  function addKill(base) {
    G.streak = G.streakT > 0 ? G.streak + 1 : 1; G.streakT = 2.6; G.kills++; G.totalKills = (G.totalKills || 0) + 1;
    var mult = Math.min(3, 1 + Math.floor(G.streak / 4) * 0.5) * (G.power.alouda > 0 ? 2 : 1);
    G.score += Math.round(base * mult); G.spin = Math.min(100, G.spin + 20); G.hitstop = 0.05; G.shake = Math.max(G.shake, 5);
    if (G.spin >= 100 && !G.spinAnnounced) { G.spinAnnounced = true; popText(G.hero.x + 60, G.hero.y - 250, 'SPIN READY - TRIPLE TAP!', '#ffcc3a', 1.2); }
    if (G.spin < 100) G.spinAnnounced = false;
    return mult;
  }
  function decap(e, txt, base) {
    var hp = headPt(e), mult = addKill(base || 100);
    AU.sfx('chop');
    if (e.type === 'walker' || e.type === 'brute' || e.type === 'turner' || e.type === 'boss') {
      e.headless = true; e.alive = false; e.state = 'dying'; e.dieT = 0;
      var sc = e.type === 'brute' ? 1.32 : e.type === 'boss' ? 2.3 : 1;
      G.pieces.push({ kind: 'head', z: e, sc: sc, x: hp[0], y: hp[1] + 10 * sc, vx: G.speed * 0.5 + R(120, 320), vy: R(-820, -560), rot: 0, vr: R(8, 14) * (fx() < 0.5 ? 1 : -1), life: 4, bounces: 0 });
      blood(hp[0], hp[1] + 20 * sc, 26 * Math.min(sc, 1.5), 1);
    } else {
      splitPieces(e, 'neck'); e.alive = false; e.dead = true;
      blood(hp[0], hp[1], 18, 1);
    }
    if (txt) popText(hp[0], hp[1] - 40, txt + (mult > 1 ? ' x' + mult : ''), '#ffffff', 0.8);
  }
  function cleave(e, base) {
    if (e.type === 'boulder') { e.alive = false; e.dead = true; rocks(e.x, e.y - 30); AU.sfx('thud'); G.score += 50; popText(e.x, e.y - 90, 'SMASH!', '#ddd', 0.7); return; }
    var mult = addKill(base || 150); AU.sfx('cleave'); AU.sfx('splat');
    splitPieces(e, 'half'); e.alive = false; e.dead = true;
    var b = ebox(e); blood((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 40, 1.3); gibs((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 7);
    popText(e.x, b[1] - 30, 'CLEAVED!' + (mult > 1 ? ' x' + mult : ''), '#ff6a5a', 0.9);
  }
  // render a creature to an offscreen canvas, then cut it into two flying pieces
  function snapshot(e) {
    var sc = e.type === 'brute' ? 1.32 : e.type === 'boss' ? 2.3 : 1, w = Math.ceil(200 * sc), h = Math.ceil(260 * sc), res = 1.5;
    var c = document.createElement('canvas'); c.width = w * res; c.height = h * res; var g = c.getContext('2d');
    g.scale(res, res); g.translate(w / 2, h * 0.85); ART.zombie(g, e, {});
    var rc = document.createElement('canvas'); rc.width = c.width; rc.height = c.height; var rg = rc.getContext('2d');
    rg.drawImage(c, 0, 0); rg.globalCompositeOperation = 'source-in'; rg.fillStyle = '#9a0c12'; rg.fillRect(0, 0, rc.width, rc.height);
    return { c: c, rc: rc, w: w, h: h, ox: w / 2, oy: h * 0.85, res: res };
  }
  function splitPieces(e, how) {
    var s = snapshot(e), res = s.res, cut;
    var x0 = e.x - s.ox, y0 = e.y - s.oy;
    if (how === 'half') cut = s.ox;
    else { var hp = headPt(e); cut = hp[0] - x0 + (e.type === 'crawler' ? 14 : 8); }
    var A = { sx: 0, sw: cut }, B = { sx: cut, sw: s.w - cut }, sc = e.type === 'brute' ? 1.32 : e.type === 'boss' ? 2.3 : 1;
    var top = { crawler: 45, fish: 22, monkey: 60 }[e.type] || 150 * sc, bot = e.type === 'fish' ? -18 : 6;
    var ey0 = s.oy - top - s.h / 2, ey1 = s.oy - bot - s.h / 2;
    [A, B].forEach(function (p, i) {
      G.pieces.push({ kind: 'img', img: s.c, res: res, sx: p.sx, sy: 0, sw: p.sw, sh: s.h, x: x0 + p.sx + p.sw / 2, y: y0 + s.h / 2, cx: p.sw / 2, cy: s.h / 2,
        vx: (i === 0 ? R(60, 200) : R(260, 420)) + G.speed * 0.3, vy: R(-520, -300), rot: 0, vr: (i === 0 ? -1 : 1) * R(2, 5), life: 3.5, bounces: 0, rimg: s.rc, cut: cut });
    });
  }
  function bossInReach(rx1) { var b = G.boss; return b && b.alive && b.x - 80 < rx1; }
  function hitBoss(dmg) {
    var b = G.boss; if (!b || !b.alive || b.hurtT > 0) return;
    b.hp -= dmg; b.hurtT = 0.25; b.x += 60 + dmg * 30; b.state = 'back'; b.timer = 0.5; G.shake = 8; G.hitstop = 0.06;
    AU.sfx('chop'); blood(b.x - 40, b.y - 220, 20 + dmg * 8, 1); G.score += 120 * dmg;
    popText(b.x - 40, b.y - 380, ['', 'HIT!', 'CLEAVE!', 'SPIN!'][dmg] + ' -' + dmg, '#ff8a6a', 0.8);
    if (b.hp <= 0) {
      b.alive = false; b.headless = true; b.state = 'dying'; b.dieT = 0; G.bossDone = 3.2; G.score += 5000; addKill(500);
      var hp = [b.x - 30, b.y - 300];
      G.pieces.push({ kind: 'head', z: b, sc: 2.3, x: hp[0], y: hp[1], vx: 380, vy: -980, rot: 0, vr: 9, life: 5, bounces: 0 });
      blood(hp[0], hp[1] + 30, 90, 1.8); AU.sfx('roar'); G.flash = 0.6; G.shake = 18;
      popText(b.x - 60, b.y - 420, 'GRAN ZOMBI DECAPITATED!', '#ffcc3a', 2.5, 1.6);
    }
  }
  function hurt(src) {
    var h = G.hero; if (h.invuln > 0) return;
    G.hearts--; h.invuln = 1.5; h.hurtT = 0.35; G.shake = 12; AU.sfx('hurt'); G.streak = 0;
    blood(h.x, h.y - 90, 10, 0.7); G.flash = 0.15; G.redFlash = 0.5;
    if (DEMO && G.hearts < 1) G.hearts = 1;
    if (G.hearts <= 0) { G.hearts = 0; gameOver(); }
  }

  // ---------- PARTICLES ----------
  function blood(x, y, n, pow) { for (var i = 0; i < n; i++) { var a = -Math.PI / 2 + R(-1.3, 1.3); var v = R(150, 520) * (pow || 1); G.parts.push({ k: 'blood', x: x, y: y, vx: Math.cos(a) * v + G.speed * 0.4, vy: Math.sin(a) * v, r: R(2.5, 6.5), life: R(0.6, 1.2), max: 1.2, col: fx() < 0.7 ? '#c3141c' : '#7e070d' }); } }
  function gibs(x, y, n) { for (var i = 0; i < n; i++) G.parts.push({ k: 'gib', x: x, y: y, vx: R(-100, 400) + G.speed * 0.3, vy: R(-600, -250), r: R(4, 8), life: 2, max: 2, rot: R(0, 6), col: ['#9b2a2a', '#c86a6a', '#6f8a66', '#e8d9c0'][i % 4] }); }
  function dust(x, y, n) { for (var i = 0; i < n; i++) G.parts.push({ k: 'dust', x: x + R(-10, 10), y: y - 4, vx: R(-120, 30), vy: R(-80, -10), r: R(5, 11), life: R(0.3, 0.6), max: 0.6, col: 'rgba(230,215,180,' }); }
  function spark(x, y) { for (var i = 0; i < 10; i++) G.parts.push({ k: 'spark', x: x, y: y, vx: R(-300, 300), vy: R(-300, 200), r: 2, life: 0.3, max: 0.3, col: '#fff2a0' }); }
  function ring(x, y) { G.parts.push({ k: 'ring', x: x, y: y, vx: 0, vy: 0, r: 10, life: 0.35, max: 0.35 }); }
  function rocks(x, y) { for (var i = 0; i < 12; i++) G.parts.push({ k: 'gib', x: x, y: y, vx: R(-200, 300) + G.speed * 0.3, vy: R(-500, -150), r: R(4, 9), life: 1.6, max: 1.6, rot: R(0, 6), col: ['#6b625a', '#4e4844', '#8a8078'][i % 3] }); }
  function shards(o) { var cols = { crate: '#a8743c', barrel: '#2f6fb0', cooler: '#e84a3a', lounger: '#ffffff', sandcastle: '#e8cf8a', bundle: '#c9b45a', cart: '#8a5a30' }; for (var i = 0; i < 14; i++) G.parts.push({ k: 'gib', x: o.x, y: o.y - o.h / 2, vx: R(-100, 400), vy: R(-500, -150), r: R(3, 7), life: 1.4, max: 1.4, rot: R(0, 6), col: cols[o.kind] || '#6b625a' }); }
  function greenPuff(x, y) { for (var i = 0; i < 16; i++) G.parts.push({ k: 'dust', x: x + R(-20, 20), y: y + R(-80, 0), vx: R(-60, 60), vy: R(-120, -20), r: R(6, 14), life: R(0.5, 1), max: 1, col: 'rgba(140,230,90,' }); }
  function splash(x, y) { AU.sfx('splash'); for (var i = 0; i < 18; i++) G.parts.push({ k: 'drop', x: x + R(-20, 20), y: y, vx: R(-160, 160), vy: R(-520, -200), r: R(2, 5), life: 0.9, max: 0.9, col: '#bfefff' }); }
  function popText(x, y, s, col, life, size) {
    for (var i = 0; i < G.texts.length; i++) { var o = G.texts[i]; if (Math.abs(o.y - y) < 26 && Math.abs(o.x - x) < 260) y = o.y - 28; }
    if (G.texts.length > 4) G.texts.shift();
    G.texts.push({ x: x, y: y, s: s, col: col || '#fff', life: life || 0.8, max: life || 0.8, size: size || 1 }); }

  // ---------- UPDATE ----------
  function update(dt) {
    G.t += dt;
    if (G.mode === 'title' || G.mode === 'levels') { G.titleT += dt; return; }
    if (G.mode !== 'play') return;
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    var h = G.hero, L = G.L;
    G.levelT += dt; G.hintT -= dt;
    var prog = clamp(h.x / G.endX, 0, 1);
    var target = G.boss ? 0 : L.speed * (1 + 0.14 * prog);
    G.speed = lerp(G.speed, target, Math.min(1, dt * (G.boss ? 2.5 : 1)));
    AU.setIntensity(G.boss ? 1 : clamp(G.idx / 8 + prog * 0.35 + 0.05, 0, 1));
    if (DEMO) autopilot(dt);
    h.prevY = h.y; h.x += G.speed * dt;
    var g = GRAV; if (h.hold && h.vy < 0 && h.holdT < 0.22) { g = GRAV * 0.5; h.holdT += dt; }
    if (!h.grounded) { h.vy += g * dt; h.y += h.vy * dt; h.airT += dt; }
    var gy = groundAt(h.x);
    if (h.grounded) {
      if (gy === null || gy > h.y + 22) { h.grounded = false; h.airT = 0; }
      else h.y = gy;
    } else if (gy !== null && h.vy >= 0 && h.y >= gy && h.prevY <= gy + 26) {
      h.y = gy; h.vy = 0; h.grounded = true; h.jumps = 0; h.flipT = 0; AU.sfx('land'); dust(h.x, h.y, 5);
      if (h.queuedSlide) { h.queuedSlide = false; h.slideT = 0.62; AU.sfx('slide'); }
    }
    if (h.grounded) h.airT = 0;
    var ref = baseGround(h.x);
    if (!h.grounded && h.y > ref + 260) { // fell into a gap / the sea
      var sgm = nextSeg(h.x) || segAt(h.x);
      splash(h.x, ref + 40); h.invuln = 0; hurt('fall');
      if (G.mode !== 'play') return;
      h.x = sgm.x0 + 40; h.y = groundAt(h.x) - 160; h.vy = 0; h.grounded = false; h.invuln = 1.8;
      popText(h.x + 60, h.y - 60, 'SPLASH!', '#bfefff', 0.8);
    }
    if (h.slideT > 0) h.slideT -= dt;
    if (h.hurtT > 0) h.hurtT -= dt;
    if (h.invuln > 0) h.invuln -= dt;
    if (h.flipT > 0) { h.flipT += dt; if (h.flipT > 0.42) h.flipT = 0; }
    if (h.atype) { h.at += dt / h.adur; if (h.at >= 1) { h.atype = null; h.at = 0; } }
    h.pose = h.hurtT > 0 ? 'hurt' : h.slideT > 0 ? 'slide' : !h.grounded ? (h.vy < 0 ? 'jump' : 'fall') : 'run';
    h.phase += dt * (G.boss ? 6 : G.speed / 30);
    h.flip = h.flipT > 0 ? -(h.flipT / 0.42) * TAU : 0;
    if (h.grounded && fx() < dt * 8 && G.speed > 50) dust(h.x - 10, h.y, 1);
    for (var k in G.power) if (G.power[k] > 0) G.power[k] -= dt;
    if (G.power.gato > 0) G.spin = Math.min(100, G.spin + dt * 30);
    if (G.streakT > 0) G.streakT -= dt; else G.streak = 0;
    G.distAcc = (G.distAcc || 0) + G.speed * dt / PXM; if (G.distAcc >= 1) { G.score += Math.floor(G.distAcc); G.distAcc -= Math.floor(G.distAcc); }
    G.camX = h.x - W * 0.27;
    G.camY = lerp(G.camY, ref - GROUND, Math.min(1, dt * 3));
    updateEnemies(dt); updateObstacles(); updatePickups(dt); updateBoss(dt); updateFx(dt);
    if (G.mode !== 'play') return;
    if (!G.finished && !L.boss && h.x >= G.endX) levelComplete();
    if (L.boss && !G.boss && h.x >= G.endX && !G.finished) spawnBoss();
    if (G.bossDone > 0) { G.bossDone -= dt; if (G.bossDone <= 0 && !G.finished) levelComplete(); }
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
    if (G.flash > 0) G.flash -= dt;
    if (G.redFlash > 0) G.redFlash -= dt;
    if (L.amb === 'sea') { G.lightning -= dt; if (G.lightning < -R(4, 9)) { G.lightning = 0.25; AU.sfx('thunder'); } }
    var cut = G.camX - 400;
    G.ents = G.ents.filter(function (e) { return e.x > cut && !e.dead; });
    G.obs = G.obs.filter(function (o) { return o.x > cut; });
    G.pick = G.pick.filter(function (p) { return p.x > cut && !p.got; });
    G.decals = G.decals.filter(function (d) { return d.x > cut; });
  }
  function hbox() { var h = G.hero; return h.slideT > 0 ? [h.x - 30, h.y - 56, h.x + 36, h.y] : [h.x - 16, h.y - 142, h.x + 18, h.y]; }
  function overlap(a, b) { return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]; }
  function isHumanStill(e) { return e.tr !== undefined && e.tr < 1 && e.type !== 'monkey' && e.type !== 'fish'; }
  function updateEnemies(dt) {
    var h = G.hero, hb = hbox();
    G.ents.forEach(function (e) {
      var dx = e.x - h.x;
      if (dx > W + 300) return;
      e.phase += dt * (e.type === 'monkey' ? 9 : e.type === 'crawler' ? 4 : e.panic ? 9 : 3.2);
      if (e.state === 'dying') { e.dieT += dt; var sc = e.type === 'brute' ? 1.32 : 1; if (e.dieT < 0.7 && fx() < 0.7) G.parts.push({ k: 'blood', x: e.x - 6 * sc, y: e.y - 108 * sc, vx: R(-60, 120), vy: R(-520, -300), r: R(2.5, 5), life: 1, max: 1, col: '#c3141c' }); if (e.dieT > 0.9) e.state = 'corpse'; var gq = groundAt(e.x); if (gq !== null) e.y = gq; return; }
      if (e.state === 'corpse' || !e.alive) return;
      if (e.stag > 0) { e.stag -= dt; e.x += 70 * dt; }
      if (e.moan > 0) { e.moan -= dt; if (e.moan <= 0) { if (dx < W && dx > 0) AU.moan(fx()); e.moan = R(4, 10); } }
      switch (e.state) {
        case 'climb': if (dx < 650) { e.climb = Math.min(1, e.climb + dt * 1.5); if (e.climb >= 1) e.state = 'walk'; } e.y = (groundAt(e.x) || e.y) + (1 - e.climb) * 150; e.baseY = groundAt(e.x) || e.y; return;
        case 'perchJ': e.y = baseGround(e.x) - 300; if (dx < 760) { leapAt(e, 0.95, 'walk'); AU.sfx('moan'); } return;
        case 'perch': if (dx < 700 && e.tr < 1) { if (e.tr === 0) { AU.sfx('screech'); greenPuff(e.x, e.y + 20); } e.tr = Math.min(1, e.tr + dt * 2.2); }
          e.y = baseGround(e.x) - 270; if (e.tr >= 1 && dx < 600) leapAt(e, 0.8, 'run'); return;
        case 'swim': e.y = baseGround(e.x) + 40; if (dx < 720) { leapAt(e, 1.0, 'flop'); splash(e.x, baseGround(e.x)); } return;
        case 'wait': if (dx < 950) { e.state = 'roll'; e.vx = -240; AU.sfx('thud'); } e.y = baseGround(e.x); return;
        case 'air':
          e.vy += 1500 * dt; e.x += e.vx * dt; e.y += e.vy * dt; e.air = true;
          if (e.type === 'fish') { e.tr = clamp(e.tr + dt * 2.2, 0, 1); e.rot = Math.atan2(e.vy, -e.vx) * -0.6; }
          var ga = groundAt(e.x); if (ga !== null && e.vy > 0 && e.y >= ga - (e.type === 'fish' ? 16 : 0)) { e.y = ga; e.air = false; e.rot = 0; e.state = e.next; e.vx = e.next === 'run' ? -140 : e.next === 'flop' ? -70 : -40; dust(e.x, e.y, 6); }
          if (e.y > baseGround(e.x) + 400) { e.dead = true; e.alive = false; }
          break;
        case 'roll': e.x += e.vx * dt; e.rot = (e.rot || 0) + e.vx * dt / 30; var g2 = groundAt(e.x); if (g2 === null) { e.vy += 1500 * dt; e.y += e.vy * dt; } else e.y = g2; break;
        default:
          if (isHumanStill(e)) {
            if (dx < e.trig || e.tr > 0) { if (e.tr === 0) { AU.sfx('turn'); popText(e.x, e.y - 200, 'TURNING!', '#9cff6a', 0.9); } e.tr = Math.min(1, e.tr + dt * 1.4); e.panic = e.tr < 0.3; if (fx() < 0.4) greenPuff(e.x, e.y - 60); if (e.tr >= 1) { e.vx = -R(40, 60); e.type = 'walker'; } }
            e.headTilt = e.tr > 0 && e.tr < 1 ? Math.sin(G.t * 40) * 0.2 : 0;
          }
          if (dx < W + 100 && e.stag <= 0) e.x += (isHumanStill(e) && e.tr > 0.3 ? 0 : e.vx) * dt;
          if (e.type === 'fish' && e.state === 'flop') { e.flopT = (e.flopT || 0) + dt; e.y = (groundAt(e.x) || e.y) - 16 - Math.abs(Math.sin(e.flopT * 7)) * 22; e.rot = Math.sin(e.flopT * 7) * 0.5; }
          else { var g3 = groundAt(e.x); if (g3 !== null) e.y = g3; }
      }
      if (!e.alive || isHumanStill(e) || e.type === 'turner') return;
      if (e.state === 'climb' && e.climb < 0.6) return;
      var b = ebox(e);
      if (overlap(hb, b)) {
        if (h.vy > 0 && h.prevY <= b[1] + 22 && e.type !== 'fish') { h.vy = -720; h.jumps = 1; h.grounded = false; e.stag = 0.9; AU.sfx('stomp'); G.score += 10; popText(e.x, b[1] - 20, 'STAGGER', '#cfe8ff', 0.5); }
        else if (e.stag <= 0 || e.type === 'boulder') { hurt(e); e.stag = 0.8; if (e.type === 'boulder') { e.alive = false; e.dead = true; rocks(e.x, e.y - 30); } }
      }
    });
  }
  function leapAt(e, T, next) {
    var h = G.hero, tx = h.x + G.speed * T + 30, ty = (groundAt(tx) || h.y) - (e.type === 'fish' ? 70 : 0);
    e.vx = (tx - e.x) / T; e.vy = (ty - e.y - 0.5 * 1500 * T * T) / T; e.state = 'air'; e.next = next; e.air = true;
  }
  function updateObstacles() {
    var hb = hbox();
    G.obs.forEach(function (o) {
      var gy = groundAt(o.x); o.y = gy === null ? baseGround(o.x) : gy;
      if (o.broken || o.hitDone) return;
      var b = o.high ? [o.x - o.w / 2, o.y - 300, o.x + o.w / 2, o.y - o.high] : [o.x - o.w / 2 + 6, o.y - o.h + 4, o.x + o.w / 2 - 6, o.y];
      if (overlap(hb, b)) { hurt(o); o.hitDone = true; if (!o.high) { o.broken = true; shards(o); AU.sfx('thud'); } }
    });
  }
  function updatePickups(dt) {
    var h = G.hero, hcx = h.x, hcy = h.y - 70;
    G.pick.forEach(function (p) {
      var gyp = groundAt(p.x); if (!p.mag) p.y = (gyp !== null ? gyp : baseGround(p.x)) + p.yo;
      if (G.power.alouda > 0 && p.kind === 'coin') { var d = Math.hypot(p.x - hcx, p.y - hcy); if (d < 260) { p.mag = true; p.x += (hcx - p.x) * Math.min(1, dt * 9); p.y += (hcy - p.y) * Math.min(1, dt * 9); } }
      if (Math.abs(p.x - hcx) < 34 && Math.abs(p.y - hcy) < (h.slideT > 0 ? 70 : 92)) {
        p.got = true;
        if (p.kind === 'coin') { G.coins++; G.score += 10 * (G.power.alouda > 0 ? 2 : 1); AU.sfx('coin'); G.parts.push({ k: 'spark', x: p.x, y: p.y, vx: 0, vy: -60, r: 3, life: 0.3, max: 0.3, col: '#ffe066' }); }
        else if (p.kind === 'dholl') { G.hearts = Math.min(5, G.hearts + 1); AU.sfx('heal'); popText(p.x, p.y - 30, 'DHOLL PURI! +1 HEART', '#ffe08a', 1.2); }
        else if (p.kind === 'gato') { G.power.gato = 9; G.spin = 100; AU.sfx('power'); popText(p.x, p.y - 30, 'GATO PIMENT! FIRE SABRE', '#ff9a3a', 1.2); }
        else { G.power.alouda = 9; AU.sfx('power'); popText(p.x, p.y - 30, 'ALOUDA! MAGNET + DOUBLE SCORE', '#ff9ad2', 1.2); }
      }
    });
  }
  // ---------- BOSS ----------
  function spawnBoss() {
    var h = G.hero;
    G.boss = { type: 'boss', x: h.x + W * 0.75, y: GROUND, alive: true, hp: 14, max: 14, phase: 0, seed: 77, skin: '#5f7a52', outfit: { shirt: '#7a1010', pants: '#2a2a30', tags: '', kind: 'city' }, head: 'zHead2', state: 'enter', timer: 0, hurtT: 0, stag: 0, throwT: 3, dieT: 0 };
    AU.sfx('roar'); AU.setMusic('boss'); G.shake = 14;
    popText(h.x + 200, h.y - 300, 'THE GRAN ZOMBI RISES!', '#ff3a3a', 2.2, 1.5);
  }
  function updateBoss(dt) {
    var b = G.boss, h = G.hero; if (!b) return;
    b.phase += dt * 2.4; b.y = groundAt(b.x) || GROUND; if (b.hurtT > 0) b.hurtT -= dt;
    if (!b.alive) { b.dieT += dt; if (b.dieT < 1.5) for (var i = 0; i < 3; i++) G.parts.push({ k: 'blood', x: b.x - 14, y: b.y - 250, vx: R(-120, 160), vy: R(-800, -450), r: R(3, 7), life: 1.2, max: 1.2, col: '#c3141c' }); return; }
    var d = b.x - h.x; b.timer -= dt;
    switch (b.state) {
      case 'enter': b.x -= 90 * dt; if (d < 520) { b.state = 'walk'; AU.sfx('roar'); } break;
      case 'walk': b.x -= (70 + (b.max - b.hp) * 6) * dt; b.throwT -= dt;
        if (b.throwT <= 0 && d > 300) { b.throwT = R(2.2, 3.6); bossThrow(); }
        if (d < 200) { b.state = 'windup'; b.timer = 0.75; AU.sfx('moan', 0.1); } break;
      case 'windup': if (b.timer <= 0) { b.state = 'swipe'; b.timer = 0.3; AU.sfx('cleave'); G.shake = 10; } break;
      case 'swipe': if (d < 260 && h.slideT <= 0 && !b.hit) { b.hit = true; hurt(b); } if (b.timer <= 0) { b.state = 'recover'; b.timer = 0.7; b.hit = false; } break;
      case 'recover': if (b.timer <= 0) { b.state = 'back'; b.timer = 0.6; } break;
      case 'back': b.x += 260 * dt; if (b.timer <= 0 || d > 560) b.state = 'walk'; break;
    }
    if (b.x - h.x < 70) { b.x = h.x + 70; if (b.state === 'walk') { b.state = 'windup'; b.timer = 0.5; } }
    G.projs.forEach(function (p) {
      p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 10;
      var gy = groundAt(p.x) || GROUND;
      if (p.y > gy - 14) { p.y = gy - 14; p.vy = -Math.abs(p.vy) * 0.3; p.vx *= 0.7; p.bounce = (p.bounce || 0) + 1; if (p.bounce > 3) p.dead = true; }
      var hb = hbox(); if (!p.dead && overlap(hb, [p.x - 16, p.y - 16, p.x + 16, p.y + 16])) { p.dead = true; hurt(p); blood(p.x, p.y, 8, 0.6); }
      if (!p.dead && h.atype && h.at < 0.5 && p.x - h.x > -10 && p.x - h.x < reach() && p.y > h.y - 200) { p.dead = true; blood(p.x, p.y, 14, 0.8); AU.sfx('chop'); G.score += 50; popText(p.x, p.y - 30, 'BATTED AWAY!', '#fff', 0.6); }
    });
    G.projs = G.projs.filter(function (p) { return !p.dead && p.x > G.camX - 100; });
  }
  function bossThrow() {
    var b = G.boss, h = G.hero, T = 0.95, high = rnd() < 0.35, tx = h.x + 10, ty = h.y - (high ? 120 : 30);
    var sx = b.x - 60, sy = b.y - 300;
    G.projs.push({ x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * 1500 * T * T) / T, rot: 0, high: high, head: ['zHead0', 'zHead1'][Math.floor(fx() * 2)] });
    AU.sfx('swing'); popText(sx, sy - 40, high ? 'SLIDE!' : 'JUMP!', '#ffd0a0', 0.6);
  }
  function updateFx(dt) {
    G.parts.forEach(function (p) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.k === 'blood' || p.k === 'gib' || p.k === 'drop') { p.vy += 1400 * dt; var gy = groundAt(p.x); if (gy !== null && p.y > gy && p.vy > 0) { if (p.k === 'blood') { if (G.decals.length < 90 && fx() < 0.5) G.decals.push({ x: p.x, r: p.r * R(1.2, 2.4), c: p.col }); p.life = 0; } else if (p.k === 'gib') { p.y = gy; p.vy *= -0.3; p.vx *= 0.6; } else p.life = 0; } if (p.rot !== undefined) p.rot += dt * 8; }
      else if (p.k === 'dust') { p.r += dt * 18; p.vx *= 0.96; }
      else if (p.k === 'ring') p.r += dt * 260;
    });
    G.parts = G.parts.filter(function (p) { return p.life > 0; });
    if (G.parts.length > 700) G.parts.splice(0, G.parts.length - 700);
    G.pieces.forEach(function (p) {
      p.life -= dt; if (p.rest) { var gr = groundAt(p.x); if (gr !== null) p.y = gr - p.restR; return; }
      p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      var gy = groundAt(p.x), r = p.kind === 'head' ? 18 * p.sc : Math.min(p.sw, p.sh) * 0.3;
      if (gy !== null && p.y + r > gy && p.vy > 0) { p.y = gy - r; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.6; p.bounces++; if (p.bounces === 1) { G.decals.push({ x: p.x, r: 12 * (p.sc || 1), c: '#7e070d' }); AU.sfx('splat'); } if (p.bounces > 3) { p.rest = true; p.restR = r; } }
      if (p.kind === 'head' && p.life > 3 && fx() < 0.6) G.parts.push({ k: 'blood', x: p.x, y: p.y + 10, vx: R(-40, 40), vy: R(-60, 60), r: R(2, 4), life: 0.6, max: 0.6, col: '#c3141c' });
    });
    G.pieces = G.pieces.filter(function (p) { return p.life > 0 && p.x > G.camX - 300; });
    G.texts.forEach(function (t) { t.life -= dt; t.y -= dt * 40; });
    G.texts = G.texts.filter(function (t) { return t.life > 0; });
  }

  // ---------- AUTOPILOT (demo mode) ----------
  function autopilot(dt) {
    var h = G.hero, ai = G.ai, look = G.speed * 0.5 + 40;
    ai.cd -= dt;
    ai.q = ai.q.filter(function (a) { a.t -= dt; if (a.t <= 0) { a.f(); return false; } return true; });
    if (h.hold && h.holdT > 0.2) release();
    if (h.grounded) { var ahead = h.x + G.speed * 0.17 + 30; if (groundAt(ahead) === null && groundAt(h.x + 10) !== null) { jump(); return; } }
    for (var i = 0; i < G.obs.length; i++) {
      var o = G.obs[i], d = o.x - o.w / 2 - (h.x + 18);
      if (d < -o.w || d > look || o.broken) continue;
      if (!o.high && d > 0 && d < G.speed * 0.2 && h.grounded) { jump(); return; }
      if (o.high && d < G.speed * 0.16 && h.slideT <= 0.12) { slide(); return; }
    }
    if (G.boss && G.boss.alive) {
      var b = G.boss;
      if (b.state === 'windup' && b.timer < 0.35 && h.slideT <= 0) slide();
      G.projs.forEach(function (p) { var dd = p.x - h.x; if (dd > 0 && dd < 200 && p.vx < 0) { if (p.high) { if (h.slideT <= 0) slide(); } else if (ai.cd <= 0) { slash(); ai.cd = 0.3; } } });
      if (b.x - h.x < 220 && ai.cd <= 0 && b.state !== 'windup') { slash(); if (fx() < 0.5) ai.q.push({ t: 0.12, f: slash }); ai.cd = 0.4; }
      return;
    }
    if (ai.cd > 0) return;
    var near = [];
    G.ents.forEach(function (e) { if (!e.alive) return; var dx = e.x - h.x; if (dx > -40 && dx < 280 && canHit(e)) near.push(e); });
    near.sort(function (a, b) { return a.x - b.x; });
    var tgt = near[0]; if (!tgt) return;
    var dx = tgt.x - h.x;
    if (tgt.type === 'boulder') { if (dx < G.speed * 0.28 + 30 && h.grounded) { if (fx() < 0.5) jump(); else { slash(); ai.q.push({ t: 0.1, f: slash }); } ai.cd = 0.5; } return; }
    if (dx > reach() - 15) return;
    var close = near.filter(function (e) { return e.x - h.x < 240; }).length;
    if (close >= 2 && G.spin >= 100) { slash(); ai.q.push({ t: 0.1, f: slash }, { t: 0.2, f: slash }); ai.cd = 0.6; return; }
    if (tgt.type === 'brute' || fx() < 0.3) { slash(); ai.q.push({ t: 0.1, f: slash }); ai.cd = 0.45; return; }
    slash(); ai.cd = 0.25;
  }

  // ---------- RENDER ----------
  function render() {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
    var k = SC * DPR; cx.setTransform(k, 0, 0, k, 0, 0);
    if (!G.L) { renderTitle(); return; }
    renderWorld();
    renderHud();
  }
  function bgImage(img, par, yoff) {
    if (!img || !img.width) return;
    var ih = H * 1.12, iw = Math.max(ih * img.width / img.height, W * 0.6), off = (G.camX * par) % (iw * 2); if (off < 0) off += iw * 2;
    var y = -H * 0.06 + yoff;
    for (var x = -off; x < W; x += iw * 2) {
      cx.drawImage(img, x, y, iw, ih);
      cx.save(); cx.translate(x + iw * 2, y); cx.scale(-1, 1); cx.drawImage(img, 0, 0, iw, ih); cx.restore();
    }
  }
  var MID = { 1: ['city', 0.45, -6], 2: ['palms', 0.5, -40], 3: ['trees', 0.55, -10], 4: ['cliffs', 0.35, 40], 5: ['palms', 0.5, -40], 6: ['boats', 0.4, -70], 7: ['cane', 0.5, -14], 8: ['palms', 0.5, -40] };
  var TONE = { 1: '#2a1410', 2: '#0f2a1c', 3: '#0b180d', 4: '#221a2a', 5: '#2a2a14', 6: null, 7: '#3a4a16', 8: '#14060a' };
  var WATERC = { 1: ['#2a4a5a', '#0e1e2a'], 2: ['#46c8c0', '#0d5a6a'], 5: ['#5ad0d0', '#106070'], 6: ['#24507a', '#06142a'], 8: ['#7a3048', '#2a0a18'] };
  function renderWorld() {
    var L = G.L, t = G.t, sh = G.shake;
    var topY = VH - H;
    cx.save();
    if (sh > 0) cx.translate((fx() - 0.5) * sh, (fx() - 0.5) * sh);
    bgImage(IMG[L.bg], 0.06, clamp(-G.camY * 0.04, -40, 60));
    cx.fillStyle = L.tint; cx.fillRect(0, 0, W, H);
    var oy = -topY - G.camY, groundScreen = GROUND + oy - (L.terrain === 'climb' ? 0 : 0);
    var refScreen = baseGround(G.hero.x) + oy;
    var water = !!WATERC[L.id];
    if (water) {
      var wy = refScreen + (L.id === 6 ? -60 : L.id === 1 ? 30 : -46);
      var wg = cx.createLinearGradient(0, wy, 0, H), wc = WATERC[L.id];
      wg.addColorStop(0, wc[0]); wg.addColorStop(1, wc[1]); cx.fillStyle = wg; cx.fillRect(0, wy, W, H - wy + 10);
      cx.strokeStyle = 'rgba(255,255,255,0.35)'; cx.lineWidth = 2;
      for (var wl = 0; wl < 4; wl++) { cx.beginPath(); var yy = wy + 6 + wl * 16; for (var xx = -20; xx < W + 20; xx += 20) cx.lineTo(xx, yy + Math.sin((xx + G.camX * (0.5 + wl * 0.15)) * 0.03 + t * 2 + wl) * 3); cx.stroke(); }
    }
    var mid = MID[L.id];
    var midY = (L.terrain === 'climb' ? refScreen : GROUND + oy) + mid[2];
    if (L.id !== 6 || true) ART.layer(cx, mid[0], G.camX, W, midY, t, mid[1], TONE[L.id]);
    if (L.id === 3) ART.layer(cx, 'trees', G.camX + 700, W, refScreen + 4, t, 0.8, '#050b06');
    if (L.id === 7) ART.layer(cx, 'cane', G.camX + 300, W, refScreen + 6, t, 0.8, '#2b3a0c');
    var fg = cx.createLinearGradient(0, refScreen - 160, 0, refScreen + 20); fg.addColorStop(0, 'rgba(0,0,0,0)'); fg.addColorStop(1, L.fog); cx.fillStyle = fg; cx.fillRect(0, refScreen - 160, W, 180);
    if (!water) { var ag = cx.createLinearGradient(0, refScreen, 0, H); ag.addColorStop(0, '#0a0608'); ag.addColorStop(1, '#000'); cx.fillStyle = ag; cx.fillRect(0, refScreen + 30, W, H); }
    cx.save(); cx.translate(-G.camX, oy);
    var x0 = G.camX - 50, x1 = G.camX + W + 50;
    G.segs.forEach(function (s) {
      if (s.x1 < x0 || s.x0 > x1) return;
      var a = Math.max(s.x0, x0), b = Math.min(s.x1, x1), ya = groundAt(a), yb = groundAt(b);
      if (s.boat) drawBoat(s, a, b);
      else {
        ART.ground(cx, L.ground, a, ya, b, yb, Math.max(ya, yb) + 900, a, t);
        var si = G.segs.indexOf(s), pv = G.segs[si - 1], nx = G.segs[si + 1];
        if (s.x0 > x0 && (!pv || pv.x1 < s.x0 - 1)) edge(s.x0, groundAt(s.x0), L.ground, -1);
        if (s.x1 < x1 && (!nx || nx.x0 > s.x1 + 1)) edge(s.x1, groundAt(s.x1), L.ground, 1);
      }
    });
    G.decals.forEach(function (d) { var gy = groundAt(d.x); if (gy === null) return; cx.fillStyle = d.c; cx.globalAlpha = 0.85; cx.beginPath(); cx.ellipse(d.x, gy + 1, d.r * 1.6, d.r * 0.45, 0, 0, TAU); cx.fill(); cx.globalAlpha = 1; });
    G.obs.forEach(function (o) { if (o.broken || o.y === undefined || o.x < x0 - 200 || o.x > x1 + 200) return; cx.save(); cx.translate(o.x, o.y); ART.obstacle(cx, o, t); cx.restore(); });
    G.pick.forEach(function (p) { if (p.y === undefined || p.x < x0 || p.x > x1) return; cx.save(); cx.translate(p.x, p.y); ART.pickup(cx, p, t); cx.restore(); });
    G.ents.forEach(function (e) { if (e.x < x0 - 150 || e.x > x1 + 150) return; drawEnemy(e); });
    if (G.boss) drawEnemy(G.boss);
    G.projs.forEach(function (p) { var im = IMG[p.head]; if (!im || !im.width) return; cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.drawImage(im, -20, -26, 40, 40 * im.height / im.width); cx.restore(); });
    G.pieces.forEach(function (p) {
      cx.save(); cx.globalAlpha = Math.min(1, p.life); cx.translate(p.x, p.y); cx.rotate(p.rot);
      if (p.kind === 'head') { cx.scale(p.sc, p.sc); ART.zhead(cx, p.z, 0, 30, 0); cx.fillStyle = '#9a0c0c'; cx.beginPath(); cx.ellipse(2, 28, 9, 4, 0, 0, TAU); cx.fill(); }
      else { cx.drawImage(p.img, p.sx * p.res, p.sy * p.res, p.sw * p.res, p.sh * p.res, -p.cx, -p.cy, p.sw, p.sh); cx.fillStyle = '#a00d12'; var left = p.sx === 0, srcX = left ? p.cut - 7 : p.cut, dstX = left ? p.cx - 7 : -p.cx; cx.drawImage(p.rimg, srcX * p.res, 0, 7 * p.res, p.sh * p.res, dstX, -p.cy, 7, p.sh); }
      cx.restore();
    });
    var h = G.hero;
    if (!(h.invuln > 0 && Math.floor(G.t * 16) % 2 === 0 && h.hurtT <= 0)) {
      cx.save(); cx.translate(h.x, h.y); cx.scale(0.92, 0.92);
      var gsh = groundAt(h.x); if (gsh !== null) { cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.beginPath(); cx.ellipse(0, (gsh - h.y) / 0.92, 26, 6, 0, 0, TAU); cx.fill(); }
      ART.hero(cx, { pose: h.pose, phase: h.phase, at: h.at, atype: h.atype, flip: h.flip, power: G.power.gato > 0 });
      cx.restore();
    }
    G.parts.forEach(function (p) {
      var a = clamp(p.life / p.max, 0, 1);
      if (p.k === 'blood' || p.k === 'drop') { cx.fillStyle = p.col; cx.beginPath(); cx.ellipse(p.x, p.y, p.r * 1.25, p.r, Math.atan2(p.vy, p.vx), 0, TAU); cx.fill(); }
      else if (p.k === 'gib') { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.col; cx.globalAlpha = a; ART.rr(cx, -p.r, -p.r * 0.7, p.r * 2, p.r * 1.4, p.r * 0.5); cx.fill(); cx.strokeStyle = '#14100e'; cx.lineWidth = 1.5; cx.stroke(); cx.restore(); }
      else if (p.k === 'dust') { cx.fillStyle = p.col + (a * 0.45) + ')'; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, TAU); cx.fill(); }
      else if (p.k === 'spark') { cx.fillStyle = p.col; cx.globalAlpha = a; cx.fillRect(p.x - 2, p.y - 2, 4, 4); cx.globalAlpha = 1; }
      else if (p.k === 'ring') { cx.strokeStyle = 'rgba(255,255,255,' + a + ')'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(p.x, p.y, p.r, p.r * 0.4, 0, 0, TAU); cx.stroke(); }
    });
    cx.globalAlpha = 1;
    G.texts.forEach(function (tx) {
      var a = clamp(tx.life / tx.max * 2, 0, 1), s = tx.size * (1 + Math.max(0, (tx.life - tx.max + 0.15)) * 3);
      cx.save(); cx.globalAlpha = a; cx.translate(clamp(tx.x, G.camX + 160, G.camX + W - 160), Math.max(tx.y, VH - H + G.camY + 130)); cx.scale(s, s); cx.font = '900 22px "Trebuchet MS", Arial, sans-serif'; cx.textAlign = 'center';
      cx.lineWidth = 5; cx.strokeStyle = '#1a0406'; cx.strokeText(tx.s, 0, 0); cx.fillStyle = tx.col; cx.fillText(tx.s, 0, 0); cx.restore();
    });
    cx.restore();
    if (L.id === 6) { var wv = function (x) { return refScreen + 62 + Math.sin((x + G.camX) * 0.02 + t * 2.4) * 7; }; cx.fillStyle = 'rgba(16,48,92,0.88)'; cx.beginPath(); cx.moveTo(0, H); for (var f2 = 0; f2 <= W + 20; f2 += 20) cx.lineTo(f2, wv(f2)); cx.lineTo(W, H); cx.fill(); cx.strokeStyle = 'rgba(220,240,255,0.6)'; cx.lineWidth = 2; cx.beginPath(); for (f2 = 0; f2 <= W + 20; f2 += 20) cx.lineTo(f2, wv(f2)); cx.stroke(); }
    weather(L, t);
    cx.restore();
    var vg = cx.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
    if (G.lightning > 0) { cx.fillStyle = 'rgba(220,235,255,' + G.lightning * 1.6 + ')'; cx.fillRect(0, 0, W, H); }
    if (G.flash > 0) { cx.fillStyle = 'rgba(255,255,255,' + G.flash + ')'; cx.fillRect(0, 0, W, H); }
    if (G.redFlash > 0) { cx.fillStyle = 'rgba(200,0,0,' + G.redFlash * 0.5 + ')'; cx.fillRect(0, 0, W, H); }
  }
  function edge(x, y, style, dir) {
    cx.fillStyle = style === 'cobble' ? '#3a3634' : style === 'sand' ? '#c9a868' : '#2a1e16'; cx.fillRect(dir < 0 ? x : x - 10, y, 10, 400);
    cx.fillStyle = 'rgba(0,0,0,0.4)'; cx.fillRect(dir < 0 ? x : x - 3, y, 3, 400);
  }
  function drawBoat(s, a, b) {
    var ya = groundAt(s.x0), yb = groundAt(s.x1), cols = ['#2d78c0', '#d23a3a', '#e0b030', '#3aa05a'], col = cols[Math.floor(s.ph * 10) % 4];
    cx.save();
    cx.beginPath(); cx.moveTo(s.x0 - 30, ya - 14); cx.lineTo(s.x1 + 40, yb - 22); cx.quadraticCurveTo(s.x1, yb + 80, s.x1 - 120, yb + 90); cx.lineTo(s.x0 + 80, ya + 90); cx.quadraticCurveTo(s.x0 - 10, ya + 70, s.x0 - 30, ya - 14); cx.closePath();
    cx.fillStyle = col; cx.fill(); cx.strokeStyle = '#14100e'; cx.lineWidth = 4; cx.stroke();
    cx.fillStyle = '#f2e9d0'; cx.beginPath(); cx.moveTo(s.x0 - 20, ya + 4); cx.lineTo(s.x1 + 30, yb - 4); cx.lineTo(s.x1 + 26, yb + 6); cx.lineTo(s.x0 - 16, ya + 14); cx.fill();
    cx.fillStyle = '#14100e'; cx.font = 'bold 22px sans-serif'; cx.textAlign = 'left'; cx.fillText(['ZOLI', 'TI LAMOUR', 'BONDIE BON', 'LAKAZ'][Math.floor(s.ph * 7) % 4], s.x0 + 120, ya + 50);
    cx.restore();
    ART.ground(cx, 'deck', a, groundAt(a), b, groundAt(b), Math.max(ya, yb) + 16, a, G.t);
  }
  function drawEnemy(e) {
    if (e.state === 'swim' || e.dead) return;
    cx.save(); cx.translate(e.x, e.y);
    if (e.state === 'climb') { cx.beginPath(); cx.rect(-150, -500, 300, 500 - (1 - e.climb) * 150 + 8); cx.clip(); }
    if (e.state === 'perch') { cx.strokeStyle = '#2a1a0e'; cx.lineWidth = 10; cx.beginPath(); cx.moveTo(-60, 2); cx.lineTo(70, -4); cx.stroke(); cx.fillStyle = '#1f4a26'; for (var l = 0; l < 4; l++) { cx.beginPath(); cx.ellipse(-50 + l * 35, -6, 22, 8, 0.3, 0, TAU); cx.fill(); } }
    if (e.state === 'perchJ') { cx.globalAlpha = 0.0; }
    if (e.state === 'dying' || e.state === 'corpse') { var k = clamp((e.dieT - 0.25) / 0.5, 0, 1); cx.rotate(k * 1.45); }
    if (e.stag > 0 && e.alive) cx.translate(Math.sin(G.t * 50) * 3, 0);
    if (e.type === 'boulder') { cx.translate(0, -30); cx.rotate(e.rot || 0); cx.fillStyle = '#6b625a'; cx.strokeStyle = '#14100e'; cx.lineWidth = 4; cx.beginPath(); for (var i = 0; i < 9; i++) { var a = i / 9 * TAU, r = 30 + ART.hash(i + e.seed) * 6; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.closePath(); cx.fill(); cx.stroke(); cx.strokeStyle = 'rgba(0,0,0,0.4)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(-12, -10); cx.lineTo(4, 2); cx.lineTo(-2, 16); cx.stroke(); cx.restore(); return; }
    if (e.type === 'boss' && e.alive) {
      if (e.state === 'windup') cx.translate(Math.sin(G.t * 60) * 4, 0);
      if (e.hurtT > 0) cx.globalAlpha = 0.75;
      var glow = cx.createRadialGradient(0, -200, 20, 0, -200, 260); glow.addColorStop(0, 'rgba(255,0,0,0.25)'); glow.addColorStop(1, 'rgba(255,0,0,0)'); cx.fillStyle = glow; cx.fillRect(-260, -460, 520, 520);
    }
    ART.zombie(cx, e, {});
    if (e.type === 'boss' && e.state === 'windup') { cx.fillStyle = 'rgba(255,60,60,0.9)'; cx.font = '900 54px sans-serif'; cx.textAlign = 'center'; cx.fillText('!', -40, -380); }
    cx.restore();
  }
  function weather(L, t) {
    for (var i = 0; i < 40; i++) {
      var s = ART.hash(i * 3.7), s2 = ART.hash(i * 9.1), x, y;
      switch (L.amb) {
        case 'city': case 'sunset': x = ((s * W * 1.3 - G.camX * 0.2 - t * 30 * (1 + s2)) % (W * 1.3) + W * 1.3) % (W * 1.3); y = ((s2 * H - t * 40 * (0.5 + s)) % H + H) % H; cx.fillStyle = 'rgba(255,' + (L.amb === 'city' ? 150 : 60) + ',60,' + (0.3 + 0.5 * Math.abs(Math.sin(t * 3 + i))) + ')'; cx.fillRect(x, y, 2.5, 2.5); break;
        case 'forest': x = ((s * W - G.camX * 0.3 + Math.sin(t + i) * 20) % W + W) % W; y = (s2 * H * 0.8 + Math.sin(t * 0.7 + i) * 30); cx.fillStyle = 'rgba(180,255,120,' + (0.25 + 0.5 * Math.abs(Math.sin(t * 2 + i))) + ')'; cx.beginPath(); cx.arc(x, y, 2, 0, TAU); cx.fill(); break;
        case 'sea': x = ((s * W * 1.2 - G.camX * 0.6 - t * 200) % (W * 1.2) + W * 1.2) % (W * 1.2); y = ((s2 * H + t * 700) % H); cx.strokeStyle = 'rgba(200,220,255,0.35)'; cx.lineWidth = 1.2; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 6, y + 16); cx.stroke(); break;
        case 'cane': x = ((s * W - G.camX * 0.5 - t * 60) % W + W) % W; y = ((s2 * H * 0.9 + Math.sin(t + i) * 40) % H); cx.fillStyle = 'rgba(60,50,40,0.6)'; cx.fillRect(x, y, 3, 2); break;
        case 'mountain': if (i % 4) break; x = ((s * W * 1.5 - G.camX * 0.8 - t * 30) % (W * 1.5) + W * 1.5) % (W * 1.5) - 200; y = s2 * H * 0.7; cx.fillStyle = 'rgba(220,210,240,0.08)'; cx.beginPath(); cx.ellipse(x, y, 200, 40, 0, 0, TAU); cx.fill(); break;
        default: if (i % 2) break; x = ((s * W - G.camX * 0.4 - t * 20) % W + W) % W; y = s2 * H * 0.6 + Math.sin(t + i) * 10; cx.fillStyle = 'rgba(255,255,255,0.3)'; cx.beginPath(); cx.arc(x, y, 1.6, 0, TAU); cx.fill();
      }
    }
  }
  function heart(x, y, s, full) {
    cx.save(); cx.translate(x, y); cx.scale(s, s); cx.beginPath(); cx.moveTo(0, 6); cx.bezierCurveTo(-14, -4, -8, -16, 0, -8); cx.bezierCurveTo(8, -16, 14, -4, 0, 6); cx.closePath();
    cx.fillStyle = full ? '#e01b24' : 'rgba(0,0,0,0.45)'; cx.fill(); cx.lineWidth = 2.2; cx.strokeStyle = '#1a0406'; cx.stroke();
    if (full) { cx.fillStyle = 'rgba(255,255,255,0.5)'; cx.beginPath(); cx.arc(-4, -6, 2.4, 0, TAU); cx.fill(); } cx.restore();
  }
  function txt(s, x, y, font, fill, lw, align) { cx.font = font; cx.textAlign = align || 'center'; cx.lineWidth = lw || 4; cx.strokeStyle = '#1a0406'; cx.lineJoin = 'round'; cx.strokeText(s, x, y); cx.fillStyle = fill; cx.fillText(s, x, y); }
  function renderHud() {
    var L = G.L, h = G.hero, m = 14;
    var hi = IMG.heroHead; cx.save(); cx.beginPath(); cx.arc(m + 26, m + 26, 26, 0, TAU); cx.fillStyle = '#2a1a2a'; cx.fill(); cx.clip();
    if (hi.width) cx.drawImage(hi, m - 6, m - 4, 64, 64 * hi.height / hi.width); cx.restore();
    cx.lineWidth = 3; cx.strokeStyle = G.redFlash > 0 ? '#ff2a2a' : '#e8d9b0'; cx.beginPath(); cx.arc(m + 26, m + 26, 26, 0, TAU); cx.stroke();
    for (var i = 0; i < 5; i++) heart(m + 70 + i * 26, m + 22, 1, i < G.hearts);
    var py = m + 40;
    if (G.power.gato > 0) { txt('FIRE SABRE ' + Math.ceil(G.power.gato) + 's', m + 60, py + 12, '900 12px "Trebuchet MS", Arial', '#ff9a3a', 3, 'left'); py += 16; }
    if (G.power.alouda > 0) txt('ALOUDA x2 ' + Math.ceil(G.power.alouda) + 's', m + 60, py + 12, '900 12px "Trebuchet MS", Arial', '#ff9ad2', 3, 'left');
    txt(String(G.score), W / 2, m + 28, '900 30px "Trebuchet MS", Arial', '#fff4d8', 6);
    var prog = clamp(h.x / G.endX, 0, 1), bw = Math.min(300, W * 0.32), bx = W / 2 - bw / 2, by = m + 40;
    cx.fillStyle = 'rgba(0,0,0,0.5)'; ART.rr(cx, bx, by, bw, 10, 5); cx.fill();
    cx.fillStyle = '#e01b24'; ART.rr(cx, bx, by, Math.max(10, bw * prog), 10, 5); cx.fill();
    cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(bx + bw * prog, by + 5, 6, 0, TAU); cx.fill();
    txt((G.idx + 1) + '/8  ' + L.name.toUpperCase() + '   ' + Math.min(L.length, Math.floor(h.x / PXM)) + ' m / ' + L.length + ' m', W / 2, by + 28, '800 13px "Trebuchet MS", Arial', '#f3ead8', 4);
    var cxp = W - 130;
    txt('Rs ' + G.coins, cxp, m + 30, '900 20px "Trebuchet MS", Arial', '#f7c531', 5, 'right');
    if (G.streak >= 4) txt('COMBO x' + Math.min(3, 1 + Math.floor(G.streak / 4) * 0.5), cxp, m + 52, '900 16px "Trebuchet MS", Arial', '#ffcc3a', 4, 'right');
    var sx = W - 56, sy = H - 60, full = G.spin >= 100;
    cx.fillStyle = 'rgba(0,0,0,0.5)'; cx.beginPath(); cx.arc(sx, sy, 34, 0, TAU); cx.fill();
    cx.strokeStyle = full ? (Math.floor(G.t * 6) % 2 ? '#ffcc3a' : '#ff7a2a') : '#c8202a'; cx.lineWidth = 6; cx.beginPath(); cx.arc(sx, sy, 30, -Math.PI / 2, -Math.PI / 2 + TAU * G.spin / 100); cx.stroke();
    cx.save(); cx.translate(sx - 8, sy + 16); cx.scale(0.45, 0.45); ART.sabre(cx, 0, 0, Math.PI * 0.82 + Math.sin(G.t * 3) * 0.1, 66, full ? '#ffb020' : null); cx.restore();
    txt(full ? 'SPIN x3!' : 'SPIN', sx, sy + 48, '900 11px "Trebuchet MS", Arial', full ? '#ffcc3a' : '#eee', 3);
    if (G.boss && G.boss.alive) {
      var b = G.boss, bw2 = Math.min(420, W * 0.5), bx2 = W / 2 - bw2 / 2, by2 = m + 82;
      cx.fillStyle = 'rgba(0,0,0,0.6)'; ART.rr(cx, bx2 - 3, by2 - 3, bw2 + 6, 18, 6); cx.fill();
      cx.fillStyle = '#b00a14'; ART.rr(cx, bx2, by2, Math.max(1, bw2 * b.hp / b.max), 12, 5); cx.fill();
      txt('GRAN ZOMBI', W / 2, by2 + 32, '900 14px "Trebuchet MS", Arial', '#ff5a5a', 4);
    }
    if (G.hintT > 0 && !DEMO) {
      var a = Math.min(1, G.hintT / 2) * 0.6;
      cx.fillStyle = 'rgba(60,140,255,' + a * 0.25 + ')'; cx.fillRect(0, H * 0.35, W / 2 - 2, H * 0.65);
      cx.fillStyle = 'rgba(255,60,60,' + a * 0.25 + ')'; cx.fillRect(W / 2 + 2, H * 0.35, W / 2, H * 0.65);
      cx.globalAlpha = a * 1.6;
      txt(TOUCH ? 'TAP LEFT = JUMP' : 'SPACE / \u2191 = JUMP', W * 0.25, H * 0.62, '900 22px "Trebuchet MS", Arial', '#fff', 4);
      txt(TOUCH ? 'TAP RIGHT = SABRE (x1 x2 x3)' : 'X / J = SABRE (x1 x2 x3)', W * 0.75, H * 0.62, '900 22px "Trebuchet MS", Arial', '#fff', 4);
      txt(TOUCH ? 'SWIPE DOWN = SLIDE' : '\u2193 / S = SLIDE', W / 2, H * 0.9, '800 16px "Trebuchet MS", Arial', '#fff', 4);
      cx.globalAlpha = 1;
    }
    if (DEMO) txt('DEMO', m, H - m, '900 14px "Trebuchet MS", Arial', 'rgba(255,255,255,0.75)', 3, 'left');
  }

  // ---------- TITLE (animated horror intro) ----------
  var silC = document.createElement('canvas'); silC.width = 220; silC.height = 260; var silX = silC.getContext('2d');
  var titleZ = [0, 1, 2, 3].map(function (i) { return { type: i === 2 ? 'brute' : 'walker', phase: i * 1.7, seed: i * 31 + 5, skin: '#7f9670', outfit: ART.outfit('city', i * 31 + 5), head: i === 2 ? 'zHead2' : ['zHead0', 'zHead1'][i % 2], stag: 0, speed: 18 + i * 6, x0: i * 0.27 }; });
  function silhouette(z) {
    silX.setTransform(1, 0, 0, 1, 0, 0); silX.globalCompositeOperation = 'source-over'; silX.clearRect(0, 0, 220, 260);
    silX.translate(110, 250); silX.scale(z.type === 'brute' ? 0.66 : 0.85, z.type === 'brute' ? 0.66 : 0.85); ART.zombie(silX, z, {});
    silX.setTransform(1, 0, 0, 1, 0, 0); silX.globalCompositeOperation = 'source-in'; silX.fillStyle = '#07040a'; silX.fillRect(0, 0, 220, 260); silX.globalCompositeOperation = 'source-over';
    return silC;
  }
  function renderTitle() {
    var t = G.titleT, T = G.t;
    var bg = IMG.titleBg, flick = (ART.hash(Math.floor(T * 12)) < 0.07) ? 0.45 : 1, fade = clamp((t - 0.6) / 1.4, 0, 1);
    if (bg && bg.width) { var z = 1.08 + Math.sin(T * 0.1) * 0.03, iw = Math.max(W * z, H * z * bg.width / bg.height), ih = iw * bg.height / bg.width; cx.globalAlpha = fade * flick; cx.drawImage(bg, (W - iw) / 2 + Math.sin(T * 0.13) * 12, (H - ih) / 2, iw, ih); cx.globalAlpha = 1; }
    cx.fillStyle = 'rgba(8,2,6,0.5)'; cx.fillRect(0, 0, W, H);
    var rg = cx.createLinearGradient(0, 0, 0, H); rg.addColorStop(0, 'rgba(90,0,0,0.25)'); rg.addColorStop(1, 'rgba(0,0,0,0.6)'); cx.fillStyle = rg; cx.fillRect(0, 0, W, H);
    titleZ.forEach(function (z, i) {
      z.phase = T * 3 + i; var span = W + 300, x = ((z.x0 * span - T * z.speed) % span + span) % span - 150;
      var sc = 0.85 + (i % 2) * 0.25; cx.globalAlpha = 0.92 * fade; cx.drawImage(silhouette(z), x - 110 * sc, H - 258 * sc, 220 * sc, 260 * sc); cx.globalAlpha = 1;
    });
    for (var f = 0; f < 6; f++) { var fx3 = ((f * 260 + T * (12 + f * 5)) % (W + 600)) - 300, fy = H * (0.55 + (f % 3) * 0.14); var g = cx.createRadialGradient(fx3, fy, 10, fx3, fy, 260); g.addColorStop(0, 'rgba(200,190,210,0.16)'); g.addColorStop(1, 'rgba(200,190,210,0)'); cx.fillStyle = g; cx.fillRect(fx3 - 260, fy - 260, 520, 520); }
    var land = W > H * 1.15;
    var ka = IMG.heroKeyart, kin = clamp((t - 1.2) / 0.8, 0, 1), kfl = (t < 2.6 && ART.hash(Math.floor(T * 20)) < 0.4) ? 0.3 : (ART.hash(Math.floor(T * 9) + 3) < 0.1 ? 0.55 : 1);
    if (ka && ka.width && kin > 0) {
      var kh = land ? H * 0.92 : H * 0.5, kw = kh * ka.width / ka.height, kx = land ? W * 0.06 : W / 2 - kw / 2, ky = land ? H - kh : H * 0.3;
      cx.save(); cx.globalAlpha = kin * kfl * flick; cx.shadowColor = 'rgba(255,20,20,0.9)'; cx.shadowBlur = 30; cx.drawImage(ka, kx, ky + (1 - kin) * 30, kw, kh); cx.restore();
      // under-lighting flicker on his face
    }
    var slam = clamp((t - 2.4) / 0.25, 0, 1);
    if (slam > 0) {
      var tx = land ? W * 0.64 : W / 2, ty = land ? H * 0.3 : H * 0.15, fs = Math.min(land ? W * 0.085 : W * 0.16, 92) * (1 + (1 - slam) * 1.5);
      cx.save(); cx.globalAlpha = slam; cx.textAlign = 'center'; cx.font = '900 ' + fs + 'px Impact, "Arial Black", "Trebuchet MS", sans-serif';
      if (slam < 1) cx.translate((fx() - 0.5) * 16, (fx() - 0.5) * 16);
      cx.lineJoin = 'round'; cx.lineWidth = fs * 0.12; cx.strokeStyle = '#1a0004'; cx.strokeText('ZOMBI LILE', tx, ty);
      var tg = cx.createLinearGradient(0, ty - fs, 0, ty); tg.addColorStop(0, '#ff4a3a'); tg.addColorStop(0.6, '#c0101a'); tg.addColorStop(1, '#6a0008'); cx.fillStyle = tg; cx.fillText('ZOMBI LILE', tx, ty);
      var tw = cx.measureText('ZOMBI LILE').width;
      for (var d = 0; d < 14; d++) {
        var dx = tx - tw / 2 + ART.hash(d * 5.3) * tw, cyc = ((T * (0.25 + ART.hash(d) * 0.3) + ART.hash(d * 2)) % 1), len = cyc * fs * (0.45 + ART.hash(d * 7) * 0.6);
        cx.fillStyle = '#9a0610'; cx.fillRect(dx - 2.5, ty - 6, 5, len); cx.beginPath(); cx.arc(dx, ty - 6 + len, 5, 0, TAU); cx.fill();
        if (cyc > 0.85) { cx.beginPath(); cx.arc(dx, ty + len + (cyc - 0.85) * 600, 3.5, 0, TAU); cx.fill(); }
      }
      cx.font = '900 ' + fs * 0.42 + 'px Impact, "Arial Black", sans-serif'; cx.lineWidth = 5; cx.strokeStyle = '#000'; cx.fillStyle = '#efe6d2';
      cx.strokeText('R U N N E R', tx, ty + fs * 0.62); cx.fillText('R U N N E R', tx, ty + fs * 0.62);
      cx.font = '700 ' + Math.max(12, fs * 0.16) + 'px "Trebuchet MS", Arial'; cx.fillStyle = '#f7d36b'; cx.lineWidth = 3;
      cx.strokeText('Port Louis \u2192 Samara  \u2022  8 levels  \u2022  sabre only', tx, ty + fs * 0.92); cx.fillText('Port Louis \u2192 Samara  \u2022  8 levels  \u2022  sabre only', tx, ty + fs * 0.92);
      cx.restore();
    }
    if (t < 1.6) { cx.fillStyle = 'rgba(0,0,0,' + clamp(1 - t / 1.6, 0, 1) * 0.92 + ')'; cx.fillRect(0, 0, W, H); cx.textAlign = 'center'; cx.fillStyle = 'rgba(230,30,30,' + clamp(Math.sin(t * 2.4), 0, 1) + ')'; cx.font = '700 18px "Courier New", monospace'; cx.fillText('PORT LOUIS, MAURITIUS.  18:13.  THE FIRST ONE TURNS...', W / 2, H / 2); }
    if (ART.hash(Math.floor(T * 3)) < 0.03) { cx.fillStyle = 'rgba(255,255,255,0.15)'; cx.fillRect(0, 0, W, H); }
    var vg = cx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.8)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
    if (G.mode === 'title' && t > 2.7 && $('title').classList.contains('dim')) $('title').classList.remove('dim');
  }

  // ---------- INPUT ----------
  var ptrs = {};
  function firstGesture() { AU.init(); if (!G.audioStarted && AU.ready()) { G.audioStarted = true; if (!G.L) AU.setMusic('title'); else { AU.setMusic('run', G.idx / 8); AU.setAmbience(G.L.amb); } } }
  document.addEventListener('pointerdown', firstGesture, true);
  document.addEventListener('touchend', firstGesture, true);
  document.addEventListener('keydown', firstGesture, true);
  cv.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (G.mode === 'title') { G.titleT = Math.max(G.titleT, 2.7); return; }
    if (G.mode !== 'play' || DEMO) return;
    ptrs[e.pointerId] = { x: e.clientX, y: e.clientY, t: performance.now(), done: false, side: e.clientX < window.innerWidth / 2 ? 'L' : 'R' };
    try { cv.setPointerCapture(e.pointerId); } catch (er) {}
  }, { passive: false });
  cv.addEventListener('pointermove', function (e) {
    var p = ptrs[e.pointerId]; if (!p || p.done) return;
    var dy = e.clientY - p.y, dx = e.clientX - p.x, th = Math.max(26, window.innerHeight * 0.05);
    if (Math.abs(dy) > th && Math.abs(dy) > Math.abs(dx)) { p.done = true; if (dy > 0) slide(); else { jump(); p.held = true; } }
  });
  function ptrEnd(e) { var p = ptrs[e.pointerId]; if (p && !p.done) fireTap(p); if (p && p.held) release(); delete ptrs[e.pointerId]; }
  cv.addEventListener('pointerup', ptrEnd); cv.addEventListener('pointercancel', ptrEnd);
  function fireTap(p) { p.done = true; if (p.side === 'L') { jump(); p.held = true; } else slash(); }
  function pollPointers() { var now = performance.now(); for (var id in ptrs) { var p = ptrs[id]; if (!p.done && now - p.t > 70) fireTap(p); } }
  window.addEventListener('keydown', function (e) {
    var k = e.key;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(k) >= 0) e.preventDefault();
    if (G.mode === 'title' && (k === 'Enter' || k === ' ')) { if (G.titleT < 2.7) G.titleT = 2.7; else $('btnStart').click(); return; }
    if (k === 'p' || k === 'P' || k === 'Escape') { if (G.mode === 'play') pauseGame(true); else if (G.mode === 'paused') pauseGame(false); return; }
    if ((G.mode === 'card' || G.mode === 'levels') && (k === 'Enter' || k === ' ') && !$('card').classList.contains('hidden')) { $('btnCard').click(); return; }
    if (G.mode !== 'play' || DEMO || e.repeat) return;
    if (k === ' ' || k === 'ArrowUp' || k === 'w' || k === 'W') jump();
    else if (k === 'ArrowDown' || k === 's' || k === 'S') slide();
    else if (k === 'x' || k === 'X' || k === 'j' || k === 'J' || k === 'k' || k === 'K' || k === 'Enter' || k === 'ArrowRight') slash();
  });
  window.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') release(); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('touchmove', function (e) { if (e.target === cv) e.preventDefault(); }, { passive: false });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('contextmenu', function (e) { if (e.target === cv) e.preventDefault(); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (G.mode === 'play' && !DEMO) pauseGame(true); AU.suspend(); } else if (G.mode !== 'paused') AU.resume(); });
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', function () { setTimeout(resize, 250); });

  // ---------- MENUS ----------
  function click(id, f) { $(id).addEventListener('click', function (e) { e.stopPropagation(); AU.init(); firstGesture(); AU.sfx('click'); f(); }); }
  click('btnStart', function () {
    if (!store.get('zrTut', false)) { hideAll(); $('tutorial').classList.remove('hidden'); G.mode = 'levels'; G.afterTut = function () { startRun(START_LEVEL - 1); }; }
    else startRun(START_LEVEL - 1);
  });
  click('btnHow', function () { hideAll(); $('tutorial').classList.remove('hidden'); G.mode = 'levels'; G.afterTut = toTitle; });
  click('btnTutGo', function () { store.set('zrTut', true); var f = G.afterTut || toTitle; G.afterTut = null; f(); });
  click('btnLevels', function () {
    hideAll(); G.mode = 'levels'; var grid = $('levelGrid'); grid.innerHTML = '';
    LEVELS.forEach(function (L, i) { var b = document.createElement('button'); b.innerHTML = (G.done[i + 1] ? '\u2605 ' : '') + (i + 1) + '. ' + L.name + '<small>' + L.sub + '</small>'; b.addEventListener('click', function (e) { e.stopPropagation(); AU.init(); AU.sfx('click'); startRun(i); }); grid.appendChild(b); });
    $('levels').classList.remove('hidden');
  });
  click('btnLevelsBack', toTitle);
  click('btnCard', function () { if (G.cardAction === 'next') startLevel(G.idx + 1); else { hideAll(); G.mode = 'play'; showHud(true); checkRotate(); } });
  click('btnPause', function () { pauseGame(true); });
  click('btnResume', function () { pauseGame(false); });
  click('btnQuit', toTitle);
  click('btnMute', function () { AU.setMuted(!AU.isMuted()); $('btnMute').style.opacity = AU.isMuted() ? 0.4 : 1; });
  click('btnRetryLevel', function () { G.score = G.levelScore0; G.hearts = 3; startLevel(G.idx); });
  click('btnRetry', function () { startRun(0); });
  click('btnOverTitle', toTitle);
  click('btnVicAgain', function () { startRun(0); });
  click('btnRotateOk', function () { G.rotateOk = true; checkRotate(); if (G.mode === 'paused') pauseGame(false); });
  ['title', 'levels', 'tutorial', 'card', 'pause', 'over', 'victory', 'rotate'].forEach(function (id) { $(id).addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });

  // ---------- LOOP ----------
  var last = 0;
  function frame(ts) {
    var dt = Math.min(1 / 30, (ts - last) / 1000 || 0); last = ts;
    try { pollPointers(); update(dt); AU.update(dt); render(); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  window.__zrAdvance = function (n, dt) { for (var i = 0; i < n; i++) update(dt); render(); return { mode: G.mode, level: G.idx + 1, x: G.hero ? Math.round(G.hero.x) : 0, score: G.score, hearts: G.hearts, kills: G.kills, ents: G.ents ? G.ents.length : 0 }; };
  G.api = { startRun: startRun, startLevel: startLevel, toTitle: toTitle, jump: jump, slide: slide, slash: slash, victory: victory, levelComplete: levelComplete, spawnBoss: spawnBoss, resize: resize,
    gameOver: function () { G.mode = 'play'; G.hearts = 1; G.hero.invuln = 0; hurt('test'); },
    teleport: function (frac) { var h = G.hero; h.x = G.endX * frac; if (!segAt(h.x)) h.x = nextSeg(h.x).x0 + 50; h.y = groundAt(h.x); h.grounded = true; h.vy = 0; G.camX = h.x - W * 0.27; G.camY = baseGround(h.x) - GROUND; G.ents.forEach(function (e) { if (e.x < h.x + 200) { e.dead = true; e.alive = false; } }); G.obs = G.obs.filter(function (o) { return o.x > h.x + 300; }); } };

  resize();
  ART.load(function () {
    if (DEMO) { G.runSeed = 0; G.score = 0; G.hearts = 3; startLevel(START_LEVEL - 1); }
    else { G.mode = 'title'; G.titleT = 0; $('title').classList.remove('hidden'); $('title').classList.add('dim'); updateBestLine(); }
    window.__zrReady = true;
    if (!CAPTURE) requestAnimationFrame(frame); else render();
  });
})();
