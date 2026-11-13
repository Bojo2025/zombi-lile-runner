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
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function vibe(ms) { if (G.vibOn === false) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  var CHAL_MAKE = [
    function (r) { var n = 45 + Math.floor(r * 16); return { kind: 'sabreKills', goal: n, title: 'SABRE ONLY', desc: 'Kill ' + n + ' zombies with the sabre only (no guns).', reward: 80 }; },
    function (r) { var n = 220 + Math.floor(r * 130); return { kind: 'coins', goal: n, title: 'RUPEE RUN', desc: 'Collect ' + n + ' Rs coins today.', reward: 70 }; },
    function (r) { return { kind: 'bossNoHit', goal: 1, title: 'CLEAN BOSS', desc: 'Beat a level boss without taking a hit.', reward: 120 }; },
    function (r) { var n = 25 + Math.floor(r * 16); return { kind: 'gunKills', goal: n, title: 'LOCK AND LOAD', desc: 'Kill ' + n + ' zombies with a gun or rocket.', reward: 90 }; },
    function (r) { var n = 16 + Math.floor(r * 14); return { kind: 'vehicleKills', goal: n, title: 'ROAD RAGE', desc: 'Crush or rocket ' + n + ' zombies from a vehicle.', reward: 90 }; },
    function (r) { var n = 900 + Math.floor(r * 500); return { kind: 'distance', goal: n, title: 'LONG RUN', desc: 'Cover ' + n + ' m in a single run.', reward: 70 }; },
    function (r) { var n = 4 + Math.floor(r * 4); return { kind: 'spins', goal: n, title: 'SPIN MASTER', desc: 'Land ' + n + ' spin storms today.', reward: 80 }; },
    function (r) { var n = 3 + Math.floor(r * 3); return { kind: 'levels', goal: n, title: 'ISLAND HOP', desc: 'Clear ' + n + ' levels today.', reward: 100 }; },
    function (r) { return { kind: 'noHitLevel', goal: 1, title: 'GHOST RUN', desc: 'Clear any level without taking damage.', reward: 130 }; },
    function (r) { var n = 8 + Math.floor(r * 6); return { kind: 'combo', goal: n, title: 'KEEP THE STREAK', desc: 'Reach a kill combo of ' + n + '.', reward: 80 }; }
  ];
  function chalRng(seed) {
    var s = seed | 0;
    return function () { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function hashDate(k) { var h = 2166136261; for (var i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 16777619); return h >>> 0; }
  function loadDaily() {
    var key = todayKey(), saved = store.get('zrDaily', null);
    if (saved && saved.date === key && saved.items && saved.items.length === 3) { G.daily = saved; return saved; }
    var rng = chalRng(hashDate(key) ^ 0xC0FFEE), used = {}, items = [];
    while (items.length < 3) {
      var i = Math.floor(rng() * CHAL_MAKE.length);
      if (used[i]) continue; used[i] = 1;
      var c = CHAL_MAKE[i](rng());
      c.id = c.kind + '-' + items.length; c.prog = 0; c.done = false;
      items.push(c);
    }
    G.daily = { date: key, items: items };
    store.set('zrDaily', G.daily);
    return G.daily;
  }
  function addChal(kind, amt) {
    if (!G.daily) loadDaily();
    var changed = false;
    G.daily.items.forEach(function (c) {
      if (c.done || c.kind !== kind) return;
      c.prog = Math.min(c.goal, (c.prog || 0) + (amt || 1));
      if (c.prog >= c.goal) { c.done = true; changed = true; completeChal(c); }
    });
    store.set('zrDaily', G.daily);
    if (changed) updateDailyLine();
  }
  function setChal(kind, value) {
    if (!G.daily) loadDaily();
    G.daily.items.forEach(function (c) {
      if (c.done || c.kind !== kind) return;
      if (value > (c.prog || 0)) {
        c.prog = Math.min(c.goal, value);
        if (c.prog >= c.goal) { c.done = true; completeChal(c); }
      }
    });
    store.set('zrDaily', G.daily);
  }
  function completeChal(c) {
    G.bank = (G.bank || 0) + c.reward; store.set('zrBank', G.bank);
    G.chalTotal = (G.chalTotal || 0) + 1; store.set('zrChalTotal', G.chalTotal);
    if (G.hero && G.mode === 'play') popText(G.hero.x + 40, G.hero.y - 230, 'CHALLENGE DONE! +' + c.reward + ' Rs', '#ffcc3a', 1.6, 1.15);
    unlockOutfits();
  }
  function outfitUnlocked(o) {
    var u = o.unlock;
    if (!u || u.type === 'start') return true;
    if (u.type === 'level') return !!G.done[u.id];
    if (u.type === 'challenges') return (G.chalTotal || 0) >= u.n;
    if (u.type === 'coins') return (G.bank || 0) >= u.n || (G.runCoinsMax || 0) >= 500;
    return false;
  }
  function currentFit() {
    var list = window.ZR_OUTFITS || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === G.fitId) return list[i];
    return list[0] || { polo: '#252e4e', poloD: '#171e38', poloL: '#34406a', jean: ['#34528a', '#2a4473'], tag: '' };
  }
  function unlockOutfits() {
    var list = window.ZR_OUTFITS || [], news = [];
    var known = store.get('zrFitSeen', { default: true });
    list.forEach(function (o) {
      if (outfitUnlocked(o) && !known[o.id]) { known[o.id] = true; news.push(o.name); }
    });
    store.set('zrFitSeen', known);
    if (news.length && G.hero && G.mode === 'play') popText(G.hero.x, G.hero.y - 260, 'OUTFIT UNLOCKED: ' + news[0], '#ffe07a', 1.8, 1.1);
    return news;
  }
  function dailySummary() {
    if (!G.daily) loadDaily();
    var d = 0; G.daily.items.forEach(function (c) { if (c.done) d++; });
    return d + ' / 3';
  }
  function updateDailyLine() {
    var el = $('dailyLine'); if (!el) return;
    if (!G.daily) loadDaily();
    el.textContent = 'DAILY CHALLENGES ' + dailySummary() + '   ·   BANK Rs ' + (G.bank || 0);
  }
  var WEP = {
    bigSabre: { name: 'BIG SABRE', time: 18 },
    pistol: { name: 'PISTOL', time: 16, ammo: 18, rate: 0.22 },
    shotgun: { name: 'SHOTGUN', time: 15, ammo: 8, rate: 0.75 },
    rocket: { name: 'ROCKET', time: 14, ammo: 4, rate: 1.05 }
  };

  var G = { mode: 'boot', t: 0, titleT: 0, best: store.get('zrBest', 0), done: store.get('zrDone', {}),
    bank: store.get('zrBank', 0), fitId: store.get('zrFit', 'default'), vibOn: store.get('zrVib', true) !== false,
    chalTotal: store.get('zrChalTotal', 0), runCoinsMax: store.get('zrRunCoinsMax', 0) };
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
      var arena = x > endX - 800;
      var len = arena ? 7000 : (L.terrain === 'boats' ? R(900, 1500) : gapP > 0 ? R(600, 1200) : 30000);
      var slope = 0;
      if (!arena && L.terrain === 'climb' && x > 300) slope = [0, -0.18, -0.3, -0.42, -0.3][Math.floor(R(0, 5))];
      segs.push({ x0: x, x1: x + len, y0: y, y1: y + slope * len, boat: L.terrain === 'boats' && !arena, ph: R(0, 6) });
      y += slope * len; x += len;
      if (!arena && x > 1300 && x < endX - 800 && rnd() < gapP) x += (L.terrain === 'boats' ? R(140, 200) : R(115, 175)) * (spd / 360);
    }
    var ents = [], obs = [], pick = [], gaps = [];
    for (var i = 1; i < segs.length; i++) if (segs[i].x0 > segs[i - 1].x1 + 1) gaps.push([segs[i - 1].x1, segs[i].x0]);
    var ew = L.enemies, ekeys = Object.keys(ew), etot = ekeys.reduce(function (s, k) { return s + ew[k]; }, 0);
    function pickEnemy(wave) {
      var r = rnd() * etot; for (var k = 0; k < ekeys.length; k++) { r -= ew[ekeys[k]]; if (r <= 0) return ekeys[k]; } return ekeys[0];
    }
    function nearGap(px, m) { for (var g = 0; g < gaps.length; g++) if (px > gaps[g][0] - m && px < gaps[g][1] + m) return gaps[g]; return null; }
    function band(prog) {
      if (prog < 0.10) return 'intro';
      if (prog < 0.20) return 'breath1';
      if (prog < 0.38) return 'wave2';
      if (prog < 0.52) return 'mid';
      if (prog < 0.62) return 'breath2';
      if (prog < 0.82) return 'hard';
      if (prog < 0.93) return 'gauntlet';
      return 'calm';
    }
    function pickWeapon(prog) {
      var r = rnd();
      if (prog < 0.3) return r < 0.55 ? 'bigSabre' : 'pistol';
      if (prog < 0.6) return r < 0.35 ? 'bigSabre' : r < 0.7 ? 'pistol' : r < 0.92 ? 'shotgun' : 'rocket';
      return r < 0.18 ? 'bigSabre' : r < 0.42 ? 'pistol' : r < 0.78 ? 'shotgun' : 'rocket';
    }
    var pos = DEMO ? 560 : 900, hearts = 0, weps = 0, vehs = 0;
    var eventX = L.event ? L.event.at * endX : -1;
    while (pos < endX - 260) {
      var prog = pos / endX, zone = band(prog);
      var spacing = lerp(620, 380, prog) * (1 - idx * 0.025);
      if (zone === 'intro') spacing *= 1.25;
      if (zone === 'breath1' || zone === 'breath2' || zone === 'calm') spacing *= 1.45;
      if (zone === 'wave2' || zone === 'hard') spacing *= 0.82;
      if (zone === 'gauntlet') spacing *= 0.55;
      if (zone === 'mid') spacing *= 0.7;
      var g = nearGap(pos, 300);
      if (g) { coinArc(pick, (g[0] + g[1]) / 2, 5, 150); pos = g[1] + 320; continue; }
      // mid-level set-piece: a named horde already placed around eventX
      if (L.event && Math.abs(pos - eventX) < 80 && zone === 'mid') {
        var typ = L.event.types || ekeys, n = L.event.n || 10;
        for (var n0 = 0; n0 < n; n0++) ents.push(makeEnemy(typ[n0 % typ.length], pos + n0 * 70, L, idx));
        if (rnd() < 0.7 && weps < 4) { pick.push({ kind: pickWeapon(prog), x: pos - 180, yo: -90 }); weps++; }
        pos += n * 70 + 200;
        continue;
      }
      var r = rnd();
      var wantVeh = L.vehicle && vehs < (idx > 3 ? 2 : 1) && (zone === 'breath1' || zone === 'breath2') && rnd() < 0.55;
      var wantWep = weps < (4 + (idx > 3 ? 1 : 0)) && (zone === 'breath1' || zone === 'breath2' || zone === 'hard') && rnd() < 0.28;
      if (wantVeh) {
        pick.push({ kind: L.vehicle, x: pos, yo: -20 }); vehs++;
        coinLine(pick, pos + 80, 4, -70);
        pos += spacing; continue;
      }
      if (wantWep) {
        pick.push({ kind: pickWeapon(prog), x: pos, yo: -90 }); weps++;
        pos += spacing * 0.8; continue;
      }
      var enemyChance = zone === 'breath1' || zone === 'breath2' || zone === 'calm' ? 0.32 : zone === 'gauntlet' ? 0.72 : zone === 'intro' ? 0.5 : 0.58;
      if (r < enemyChance) {
        var type = pickEnemy(zone === 'hard' || zone === 'gauntlet');
        var grp = 1;
        if ((type === 'walker' || type === 'sprinter' || type === 'crawler') && rnd() < 0.22 + prog * 0.28) grp = Math.floor(R(2, zone === 'gauntlet' ? 5 : 4));
        for (var n = 0; n < grp; n++) ents.push(makeEnemy(type, pos + n * 75, L, idx));
        if (rnd() < 0.3) coinLine(pick, pos - 220, 4, -60);
        pos += (grp - 1) * 75;
      } else if (r < enemyChance + 0.28) {
        var kind = L.obstacles[Math.floor(rnd() * L.obstacles.length)], od = ART.OBST[kind];
        obs.push({ kind: kind, x: pos, alt: rnd() < 0.5, w: od.w, h: od.h || 0, high: od.high || 0 });
        if (od.high) coinLine(pick, pos - 40, 4, -26); else if (rnd() < 0.6) coinArc(pick, pos, 4, od.h + 110);
      } else {
        var pr = rnd();
        if (pr < 0.16 && hearts < 2 + (idx > 3 ? 1 : 0)) { pick.push({ kind: 'dholl', x: pos, yo: -90 }); hearts++; }
        else if (pr < 0.25) pick.push({ kind: 'gato', x: pos, yo: -90 });
        else if (pr < 0.32) pick.push({ kind: 'alouda', x: pos, yo: -90 });
        else if (pr < 0.4 && weps < 5) { pick.push({ kind: pickWeapon(prog), x: pos, yo: -90 }); weps++; }
        else coinLine(pick, pos, 6, -50 - Math.floor(R(0, 2)) * 60);
      }
      pos += spacing * R(0.8, 1.25);
    }
    // guarantee at least one vehicle and two weapons if the level has them
    if (L.vehicle && vehs === 0) pick.push({ kind: L.vehicle, x: endX * 0.22, yo: -20 });
    if (weps < 2) { pick.push({ kind: 'pistol', x: endX * 0.18, yo: -90 }); pick.push({ kind: 'shotgun', x: endX * 0.58, yo: -90 }); }
    return { L: L, idx: idx, segs: segs, ents: ents, obs: obs, pick: pick, endX: endX, eventX: eventX };
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
    if (type === 'sprinter') { e.vx = -R(150, 210); e.head = 'zHead1'; }
    if (type === 'tank') { e.vx = -R(16, 28); e.head = 'zHead2'; e.armor = 2; }
    if (type === 'leaper') { e.vx = -R(40, 70); e.leapCd = R(0.4, 1.6); }
    if (type === 'spitter') { e.vx = -R(10, 24); e.spitCd = R(0.6, 1.8); }
    if (type === 'helmet') { e.vx = -R(20, 36); e.head = 'zHead2'; e.armored = true; }
    if (type === 'bloater') { e.vx = -R(18, 30); e.head = 'zHead1'; }
    if (type === 'flyer') {
      e.vx = -R(50, 90); e.state = 'fly'; e.flyer = (L.amb === 'forest' || L.amb === 'mountain') ? 'bat' : 'gull';
      e.baseH = R(140, 190); e.y = GROUND - e.baseH;
    }
    return e;
  }

  // ---------- TERRAIN QUERIES ----------
  function segAt(x) { var s = G.segs, lo = 0, hi = s.length - 1; while (lo <= hi) { var m = (lo + hi) >> 1; if (x < s[m].x0) hi = m - 1; else if (x > s[m].x1) lo = m + 1; else return s[m]; } return null; }
  function groundAt(x) { var s = segAt(x); if (!s) return null; var y = s.y0 + (x - s.x0) * (s.y1 - s.y0) / (s.x1 - s.x0); if (s.boat) y += Math.sin(G.t * 1.6 + s.ph) * 5; return y; }
  function baseGround(x) { var s = segAt(x); if (s) return s.y0 + (x - s.x0) * (s.y1 - s.y0) / (s.x1 - s.x0); var n = nextSeg(x); return n ? n.y0 : GROUND; }
  function nextSeg(x) { for (var i = 0; i < G.segs.length; i++) if (G.segs[i].x0 > x) return G.segs[i]; return null; }

  // ---------- START / FLOW ----------
  function newHero() { return { x: 200, y: GROUND, vy: 0, grounded: true, jumps: 0, pose: 'run', phase: 0, slideT: 0, hurtT: 0, invuln: 0, atype: null, at: 0, adur: 0.2, chain: 0, lastTap: -9, hold: false, holdT: 0, flip: 0, flipT: 0, airT: 0, queuedSlide: false, prevY: GROUND }; }
  function startRun(levelIdx) { G.score = 0; G.hearts = 3; G.totalKills = 0; G.runCoins = 0; G.runSeed = Math.floor(Math.random() * 1000); G.runHit = false; startLevel(levelIdx); }
  function startLevel(idx) {
    var B = buildLevel(idx);
    G.L = B.L; G.idx = idx; G.segs = B.segs; G.ents = B.ents; G.obs = B.obs; G.pick = B.pick; G.endX = B.endX;
    G.hero = newHero(); G.hero.y = groundAt(200) || GROUND; G.hero.prevY = G.hero.y;
    G.parts = []; G.pieces = []; G.decals = []; G.texts = []; G.projs = [];
    G.camX = G.hero.x - W * 0.27; G.camY = (G.hero.y - GROUND); G.speed = G.L.speed; G.levelT = 0;
    G.kills = 0; G.coins = 0; G.spin = DEMO ? 100 : 40; G.streak = 0; G.streakT = 0; G.shake = 0; G.hitstop = 0; G.flash = 0; G.redFlash = 0;
    G.power = { gato: 0, alouda: 0, bigSabre: 0 }; G.boss = null; G.bossDone = 0; G.levelScore0 = G.score; G.finished = false;
    G.ai = { q: [], cd: 0 }; G.lightning = 0; G.hintT = 7; G.bodyHint = false;
    G.gun = null; G.ride = null; G.shots = []; G.slowmo = 0; G.zoom = 1; G.levelHit = false; G.bossHit = false;
    G.event = (B.eventX > 0 && G.L.event) ? { x: B.eventX, text: G.L.event.text, fired: false } : null;
    G.hero.muzzle = 0;
    if (AU.ready()) { AU.setMusic('run', idx / 8); AU.setAmbience(G.L.amb); }
    hideAll();
    if (DEMO) { G.mode = 'play'; showHud(true); AU.init(); if (AU.ready()) AU.voice('levelStart'); return; }
    G.mode = 'card'; showHud(false);
    $('cardKicker').textContent = 'LEVEL ' + (idx + 1) + ' / 8';
    $('cardTitle').textContent = G.L.name.toUpperCase();
    $('cardText').innerHTML = '<i>' + G.L.sub + '</i><br>' + G.L.intro;
    $('btnCard').textContent = 'RUN!'; G.cardAction = 'go'; $('card').classList.remove('hidden');
    checkRotate();
  }
  function levelComplete() {
    G.finished = true; AU.sfx('level'); AU.voice('clear');
    var done = G.done; done[G.idx + 1] = true; store.set('zrDone', done);
    G.hearts = Math.min(5, G.hearts + 1);
    addChal('levels', 1);
    if (!G.levelHit) addChal('noHitLevel', 1);
    setChal('distance', Math.floor((G.hero && G.hero.x || 0) / PXM));
    if (G.coins > (G.runCoinsMax || 0)) { G.runCoinsMax = G.coins; store.set('zrRunCoinsMax', G.runCoinsMax); }
    unlockOutfits();
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
  function hideAll() { ['title', 'levels', 'tutorial', 'card', 'pause', 'over', 'victory', 'challenges', 'outfits', 'settings'].forEach(function (id) { if ($(id)) $(id).classList.add('hidden'); }); }
  function showHud(on) { $('btnPause').classList.toggle('hidden', !on); $('btnMute').classList.toggle('hidden', !on); }
  function pauseGame(on) {
    if (on && G.mode === 'play') { G.mode = 'paused'; hideAll(); $('pause').classList.remove('hidden'); AU.suspend(); }
    else if (!on && G.mode === 'paused') { G.mode = 'play'; hideAll(); AU.resume(); }
  }
  function toTitle() { G.mode = 'title'; G.titleT = 3.0; G.L = null; hideAll(); $('title').classList.remove('hidden'); showHud(false); if (AU.ready()) { AU.setMusic('title'); AU.setAmbience(null); } updateBestLine(); updateDailyLine(); }
  function updateBestLine() { $('bestLine').textContent = G.best ? 'BEST SCORE ' + G.best + '   ·   BANK Rs ' + (G.bank || 0) : (G.bank ? 'BANK Rs ' + G.bank : ''); }

  // ---------- HERO ACTIONS ----------
  function jump() {
    var h = G.hero; if (G.mode !== 'play') return;
    if (h.slideT > 0) h.slideT = 0;
    if (h.grounded || h.airT < 0.1) { h.vy = -930; h.grounded = false; h.jumps = 1; h.hold = true; h.holdT = 0; AU.sfx('jump'); AU.voice('jump'); dust(h.x, h.y, 6); }
    else if (h.jumps < 2) { h.vy = -840; h.jumps = 2; h.hold = true; h.holdT = 0; h.flipT = 0.0001; AU.sfx('djump'); AU.voice('jump'); ring(h.x, h.y - 20); }
  }
  function release() { if (G.hero) G.hero.hold = false; }
  function slide() {
    var h = G.hero; if (G.mode !== 'play') return;
    if (h.grounded) { if (h.slideT <= 0) AU.sfx('slide'); h.slideT = 0.62; dust(h.x, h.y, 8); }
    else { h.vy = Math.max(h.vy, 1350); h.queuedSlide = true; }
  }
  function slash() {
    var h = G.hero; if (G.mode !== 'play') return;
    if (G.ride) { fireVehicleRocket(); return; }
    if (G.t - h.lastTap < 0.36) h.chain++; else h.chain = 1;
    h.lastTap = G.t;
    if (h.chain >= 3) { if (G.spin >= 100) { doSpin(); h.chain = 0; return; } if (!DEMO && (!G.spinHint || G.t - G.spinHint > 2.5)) { G.spinHint = G.t; popText(h.x + 40, h.y - 190, 'SPIN NEEDS A FULL METER', '#ffd0a0', 0.8); } doCleave(); return; }
    if (h.chain === 2) return doCleave();
    doSlash();
  }
  function reach() { return 150 + (G.power.gato > 0 ? 80 : 0) + (G.power.bigSabre > 0 ? 70 : 0); }
  function canHit(e) { return e.alive && (e.tr === undefined || e.tr >= 1 || e.type === 'fish' || e.type === 'monkey' || e.type === 'flyer') && e.state !== 'perch' && e.state !== 'swim' && e.state !== 'perchJ' && e.state !== 'wait' && !(e.state === 'climb' && e.climb < 0.5); }
  function ebox(e) {
    var x = e.x, y = e.y;
    switch (e.type) {
      case 'brute': return [x - 30, y - 205, x + 30, y];
      case 'tank': return [x - 40, y - 215, x + 42, y];
      case 'bloater': return [x - 36, y - 175, x + 36, y];
      case 'crawler': return [x - 48, y - 40, x + 45, y];
      case 'monkey': return [x - 26, y - 56, x + 24, y - 4];
      case 'fish': return [x - 28, y - 18, x + 30, y + 18];
      case 'boulder': return [x - 30, y - 60, x + 30, y];
      case 'flyer': return [x - 34, y - 22, x + 34, y + 16];
      case 'helmet': return [x - 28, y - 160, x + 26, y];
      case 'sprinter': return [x - 22, y - 148, x + 20, y];
      case 'boss': return bossBox(e);
      default: return [x - 24, y - 155, x + 22, y];
    }
  }
  function headPt(e) {
    switch (e.type) {
      case 'brute': return [e.x - 18, e.y - 180];
      case 'tank': return [e.x - 20, e.y - 200];
      case 'bloater': return [e.x - 16, e.y - 155];
      case 'crawler': return [e.x - 34, e.y - 30];
      case 'monkey': return [e.x - 18, e.y - 42];
      case 'fish': return [e.x - 16, e.y];
      case 'boulder': return [e.x, e.y - 30];
      case 'flyer': return [e.x - 12, e.y - 8];
      case 'helmet': return [e.x - 14, e.y - 142];
      case 'boss': return bossHead(e);
      default: return [e.x - 14, e.y - 136];
    }
  }
  function isHumanoid(e) {
    return { walker: 1, brute: 1, turner: 1, boss: 1, sprinter: 1, tank: 1, leaper: 1, spitter: 1, helmet: 1, bloater: 1 }[e.type];
  }
  function slashBox() {
    var h = G.hero, extra = G.power.bigSabre > 0 ? 36 : 0;
    return { rx0: h.x - 20, rx1: h.x + reach(), ry0: h.y - 168 - extra, ry1: h.y + 10 + (extra ? 8 : 0) };
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
    var tgt = best || body;
    if (tgt && resistChop(tgt, !!best)) return;
    if (best) decap(best, 'HEAD CHOP!');
    else if (body) { body.stag = 0.7; AU.sfx('thud'); spark(headPt(body)[0], h.y - 110); if (!G.bodyHint) { G.bodyHint = true; popText(body.x, body.y - 230, 'BODY HIT! CLEAVE (2 TAPS) OR JUMP-SLASH', '#ffe0a0', 1.3); } else popText(body.x, body.y - 230, 'STAGGER', '#ffe0a0', 0.5); }
  }
  function resistChop(e, onHead) {
    if (e.type === 'helmet') {
      AU.sfx('armor'); spark(headPt(e)[0], headPt(e)[1]); popText(e.x, e.y - 210, 'HELMET! CLEAVE (2 TAPS)', '#cde8ff', 0.9);
      e.stag = 0.25; return true;
    }
    if (e.type === 'tank' && (e.armor || 0) > 0) {
      e.armor -= 1; AU.sfx('thud'); spark(headPt(e)[0], headPt(e)[1]);
      if (e.armor > 0) { popText(e.x, e.y - 230, 'TOO TOUGH!', '#ffe0a0', 0.7); e.stag = 0.2; }
      else { e.stag = 0.9; popText(e.x, e.y - 230, 'STAGGERED! CHOP THE HEAD!', '#ffcc3a', 1.0); }
      return true;
    }
    return false;
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
    G.ents.forEach(function (e) { if (!canHit(e)) return; var b = ebox(e), ex = (b[0] + b[2]) / 2, ey = (b[1] + b[3]) / 2; if (Math.hypot(ex - cxh, (ey - cyh) * 1.3) < 270) { n++; if (n % 2 && e.type !== 'boulder' && e.type !== 'fish') decap(e, null, 200, true); else cleave(e, 200, true); } });
    AU.voice('spin'); addChal('spins', 1); vibe([25, 20, 40]);
    popText(h.x + 30, h.y - 220, n > 0 ? 'SPIN STORM x' + n + '!' : 'SPIN STORM!', '#ffcc3a', 1.2, 1.4);
  }
  function addKill(base, how) {
    G.streak = G.streakT > 0 ? G.streak + 1 : 1; G.streakT = 2.6; G.kills++; G.totalKills = (G.totalKills || 0) + 1;
    var mult = Math.min(3, 1 + Math.floor(G.streak / 4) * 0.5) * (G.power.alouda > 0 ? 2 : 1);
    G.score += Math.round(base * mult); G.spin = Math.min(100, G.spin + 20); G.hitstop = 0.05; G.shake = Math.max(G.shake, 5);
    if (how === 'gun' || how === 'rocket') addChal('gunKills', 1);
    else if (how === 'vehicle') addChal('vehicleKills', 1);
    else addChal('sabreKills', 1);
    setChal('combo', G.streak);
    if (G.streak >= 6 || how === 'rocket' || how === 'spin') vibe([20, 30, 35]);
    if (G.spin >= 100 && !G.spinAnnounced) { G.spinAnnounced = true; popText(G.hero.x + 60, G.hero.y - 250, 'SPIN READY - TRIPLE TAP!', '#ffcc3a', 1.2); }
    if (G.spin < 100) G.spinAnnounced = false;
    return mult;
  }
  function decap(e, txt, base, silent, how) {
    var hp = headPt(e), mult = addKill(base || 100, how || 'sabre');
    AU.sfx('chop'); if (!silent) AU.voice('chop');
    if (e.type === 'bloater') { e.alive = false; explodeAt(e.x, e.y - 40, 170, how !== 'rocket'); if (txt) popText(hp[0], hp[1] - 40, txt, '#ffffff', 0.8); return; }
    if (isHumanoid(e)) {
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
    var silent = arguments[2], how = arguments[3] || 'sabre';
    if (e.type === 'bloater') { var m2 = addKill(base || 150, how); e.alive = false; explodeAt(e.x, e.y - 40, 170, how !== 'rocket'); popText(e.x, e.y - 200, 'CLEAVED!', '#ff6a5a', 0.9); return; }
    var mult = addKill(base || 150, how); AU.sfx('cleave'); AU.sfx('splat'); if (!silent) AU.voice('cleave');
    splitPieces(e, 'half'); e.alive = false; e.dead = true;
    var b = ebox(e); blood((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 40, 1.3); gibs((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, 7);
    popText(e.x, b[1] - 30, 'CLEAVED!' + (mult > 1 ? ' x' + mult : ''), '#ff6a5a', 0.9);
  }
  // render a creature to an offscreen canvas, then cut it into two flying pieces
  function snapshot(e) {
    var sc = e.type === 'brute' ? 1.32 : e.type === 'tank' ? 1.5 : e.type === 'bloater' ? 1.28 : e.type === 'boss' ? 2.3 : 1, w = Math.ceil(200 * sc), h = Math.ceil(260 * sc), res = 1.5;
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
    var A = { sx: 0, sw: cut }, B = { sx: cut, sw: s.w - cut }, sc = e.type === 'brute' ? 1.32 : e.type === 'tank' ? 1.5 : e.type === 'bloater' ? 1.28 : e.type === 'boss' ? 2.3 : 1;
    var top = { crawler: 45, fish: 22, monkey: 60 }[e.type] || 150 * sc, bot = e.type === 'fish' ? -18 : 6;
    var ey0 = s.oy - top - s.h / 2, ey1 = s.oy - bot - s.h / 2;
    [A, B].forEach(function (p, i) {
      G.pieces.push({ kind: 'img', img: s.c, res: res, sx: p.sx, sy: 0, sw: p.sw, sh: s.h, x: x0 + p.sx + p.sw / 2, y: y0 + s.h / 2, cx: p.sw / 2, cy: s.h / 2,
        vx: (i === 0 ? R(60, 200) : R(260, 420)) + G.speed * 0.3, vy: R(-520, -300), rot: 0, vr: (i === 0 ? -1 : 1) * R(2, 5), life: 3.5, bounces: 0, rimg: s.rc, cut: cut });
    });
  }
  function bossDef() { return (G.L && G.L.boss) || { form: 'granzombi', name: 'GRAN ZOMBI', title: 'THE GRAN ZOMBI RISES!', death: 'GRAN ZOMBI DECAPITATED!', hp: 14, minion: 'walker', proj: 'head' }; }
  function bossScale(form) { return { docker: 2.15, shark: 1, gorilla: 2.35, rock: 2.4, bloater: 2.2, captain: 2.25, harvester: 2.2, granzombi: 2.45 }[form] || 2.3; }
  function bossBox(b) {
    if (b.form === 'shark') return [b.x - 200, b.y - 170, b.x + 180, b.y + 16];
    var sc = b.scale || 2.3;
    return [b.x - 50, b.y - 155 * sc, b.x + 50, b.y];
  }
  function bossHead(b) {
    if (b.form === 'shark') return [b.x - 150, b.y - 90];
    var sc = b.scale || 2.3;
    return [b.x - 30, b.y - 136 * sc];
  }
  function bossInReach(rx1) { var b = G.boss; if (!b || !b.alive) return false; var box = bossBox(b); return box[0] < rx1 + 140 && box[2] > G.hero.x - 40; }
  function hitBoss(dmg) {
    var b = G.boss; if (!b || !b.alive || b.hurtT > 0 || b.state === 'dying') return;
    var hp = bossHead(b);
    if (b.stag <= 0) {
      b.stagNeed = (b.stagNeed || 0) + dmg; b.hurtT = 0.06; G.shake = 6; AU.sfx('thud'); spark(hp[0], hp[1]);
      if (b.stagNeed >= 2) {
        b.stag = 1.55; b.stagNeed = 0; b.state = 'stagger'; b.timer = 1.55;
        popText(b.x - 40, b.y - 380, 'STAGGERED! CHOP THE HEAD!', '#ffcc3a', 1.2);
        AU.sfx('roar');
      } else popText(b.x - 40, b.y - 360, 'STAGGER HIM!', '#ffe0a0', 0.7);
      return;
    }
    b.hp -= dmg; b.hurtT = 0.1; G.shake = 8; G.hitstop = 0.03;
    AU.sfx('chop'); blood(hp[0], hp[1], 20 + dmg * 8, 1); G.score += 120 * dmg;
    popText(b.x - 40, b.y - 380, ['', 'HEAD CHOP!', 'CLEAVE!', 'SPIN!'][dmg] + ' -' + dmg, '#ff8a6a', 0.8);
    AU.voice(dmg === 1 ? 'chop' : dmg === 2 ? 'cleave' : 'spin');
    if (b.hp <= 0) killBoss();
  }
  function killBoss() {
    var b = G.boss, d = bossDef();
    b.alive = false; b.headless = true; b.state = 'dying'; b.dieT = 0; G.bossDone = 3.4;
    G.score += 2000 + G.idx * 500; addKill(500, 'sabre');
    G.slowmo = 2.2; G.zoom = 1.1; vibe([80, 40, 90, 40, 140]); AU.voice('bossOut');
    if (!G.bossHit) addChal('bossNoHit', 1);
    var hp = bossHead(b), sc = b.form === 'shark' ? 2.6 : (b.scale || 2.3);
    G.pieces.push({ kind: 'head', z: b, sc: sc, x: hp[0], y: hp[1], vx: 380, vy: -980, rot: 0, vr: 9, life: 5, bounces: 0 });
    blood(hp[0], hp[1] + 30, 90, 1.8); AU.sfx('roar'); G.flash = 0.6; G.shake = 18;
    popText(b.x - 80, b.y - 420, d.death, '#ffcc3a', 2.5, 1.6);
  }
  function hurt(src) {
    var h = G.hero; if (h.invuln > 0) return;
    if (G.ride) {
      G.ride.hp -= 1; G.ride.flash = 0.25; h.invuln = 0.7; AU.sfx('hurt'); vibe(40); G.shake = 8;
      if (G.ride.hp <= 0) eject('wreck');
      return;
    }
    G.hearts--; h.invuln = 1.5; h.hurtT = 0.35; G.shake = 12; AU.sfx('hurt'); G.streak = 0;
    blood(h.x, h.y - 90, 10, 0.7); G.flash = 0.15; G.redFlash = 0.5;
    vibe(80); G.levelHit = true; G.runHit = true; if (G.boss && G.boss.alive) G.bossHit = true;
    if (G.hearts <= 1) AU.voice('lowhp'); else AU.voice('hurt');
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

  // ---------- WEAPONS / VEHICLES / SHOTS ----------
  function giveWeapon(kind) {
    if (kind === 'sabre') kind = 'bigSabre';
    if (kind === 'bigSabre') {
      G.power.bigSabre = WEP.bigSabre.time; AU.sfx('power'); AU.voice('weapon');
      popText(G.hero.x + 40, G.hero.y - 200, 'BIG SABRE!', '#c0e8ff', 1.2); return;
    }
    var w = WEP[kind]; if (!w) return;
    G.gun = { kind: kind, t: w.time, max: w.time, ammo: w.ammo, maxAmmo: w.ammo, cd: 0 };
    AU.sfx('power'); AU.voice('weapon');
    popText(G.hero.x + 40, G.hero.y - 200, w.name + '!', '#ffcc3a', 1.2);
  }
  function mountVehicle(kind) {
    var def = (window.ZR_VEHICLES || {})[kind]; if (!def) return;
    G.ride = { kind: kind, hp: def.hp, max: def.hp, t: def.time, maxT: def.time, ammo: def.rockets, cd: 0.3, flash: 0, def: def };
    AU.sfx('engine'); AU.voice('vehicle');
    popText(G.hero.x + 40, G.hero.y - 210, def.name.toUpperCase() + '!', '#7ad0ff', 1.3, 1.15);
    G.hero.invuln = Math.max(G.hero.invuln, 0.4);
  }
  function eject(why) {
    if (!G.ride) return;
    G.ride = null;
    var h = G.hero; h.vy = -620; h.grounded = false; h.jumps = 1; h.invuln = 1.3;
    AU.sfx('thud'); popText(h.x + 40, h.y - 180, why === 'wreck' ? 'EJECTED!' : 'DISMOUNT!', '#ffe0a0', 1.0);
  }
  function fireVehicleRocket() {
    var r = G.ride, h = G.hero; if (!r || r.ammo <= 0 || r.cd > 0) return;
    r.ammo--; r.cd = 0.7; h.muzzle = 0.1;
    AU.sfx('rocket');
    G.shots.push({ kind: 'rocket', x: h.x + 70, y: h.y - 80, vx: 620 + G.speed, vy: -40, life: 1.4, dmg: 0.9, how: 'vehicle' });
  }
  function autoFireGun(dt) {
    var g = G.gun, h = G.hero; if (!g || G.ride) return;
    g.cd -= dt;
    if (g.t <= 0 || g.ammo <= 0) { G.gun = null; return; }
    if (g.cd > 0) return;
    var aim = false;
    if (G.boss && G.boss.alive && G.boss.x - h.x < 620 && G.boss.x > h.x - 40) aim = true;
    if (!aim) G.ents.forEach(function (e) { if (canHit(e) && e.x - h.x > -20 && e.x - h.x < 580) aim = true; });
    if (aim) fireGun();
  }
  function fireGun() {
    var g = G.gun, h = G.hero; if (!g || g.ammo <= 0 || g.cd > 0) return;
    var def = WEP[g.kind]; g.cd = def.rate; g.ammo--; h.muzzle = 0.09;
    if (g.kind === 'pistol') {
      AU.sfx('pistol');
      G.shots.push({ kind: 'bullet', x: h.x + 36, y: h.y - 102, vx: 980 + G.speed, vy: R(-20, 20), life: 0.7, dmg: 1, how: 'gun' });
    } else if (g.kind === 'shotgun') {
      AU.sfx('shotgun'); G.shake = Math.max(G.shake, 7);
      for (var i = 0; i < 5; i++) G.shots.push({ kind: 'pellet', x: h.x + 40, y: h.y - 100, vx: 820 + G.speed + R(-30, 30), vy: R(-220, 220), life: 0.32, dmg: 1, how: 'gun' });
    } else {
      AU.sfx('rocket');
      G.shots.push({ kind: 'rocket', x: h.x + 44, y: h.y - 100, vx: 560 + G.speed, vy: -20, life: 1.3, dmg: 1, how: 'rocket' });
    }
    if (g.ammo <= 0) G.gun = null;
  }
  function explodeAt(x, y, radius, canHurtHero) {
    AU.sfx('explode'); G.shake = 18; G.flash = 0.28; vibe([40, 25, 80]);
    for (var i = 0; i < 22; i++) {
      var a = R(0, TAU), v = R(80, 520);
      G.parts.push({ k: i % 3 ? 'gib' : 'dust', x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, r: R(4, 10), life: R(0.4, 1), max: 1, rot: R(0, 6), col: i % 2 ? 'rgba(255,120,40,' : 'rgba(255,210,120,' });
    }
    blood(x, y, 18, 1.2);
    G.ents.forEach(function (e) {
      if (!e.alive) return;
      var b = ebox(e), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      if (Math.hypot(cx - x, cy - y) < radius) {
        if (e.type === 'bloater' && !e._boom) { e._boom = true; e.alive = false; explodeAt(e.x, e.y - 40, 150, canHurtHero); }
        else if (e.type === 'boulder') { e.alive = false; e.dead = true; rocks(e.x, e.y - 30); }
        else { e._fromExplode = true; decap(e, 'BOOM!', 120, true, 'rocket'); }
      }
    });
    if (G.boss && G.boss.alive && Math.hypot(G.boss.x - x, (G.boss.y - 140) - y) < radius + 40) hitBoss(0.9);
    if (canHurtHero && G.hero) {
      var hb = hbox(), hx = (hb[0] + hb[2]) / 2, hy = (hb[1] + hb[3]) / 2;
      if (Math.hypot(hx - x, hy - y) < radius * 0.85) hurt('boom');
    }
  }
  function updateShots(dt) {
    var shots = G.shots || [];
    shots.forEach(function (s) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.kind === 'rocket') { s.vy += 80 * dt; G.parts.push({ k: 'dust', x: s.x - 10, y: s.y, vx: -40, vy: R(-20, 20), r: 5, life: 0.25, max: 0.25, col: 'rgba(255,180,80,' }); }
      var hit = false;
      if (G.boss && G.boss.alive) {
        var bb = bossBox(G.boss);
        if (s.x > bb[0] && s.x < bb[2] && s.y > bb[1] && s.y < bb[3]) {
          if (s.kind === 'rocket') { explodeAt(s.x, s.y, 150, false); hitBoss(0.9); }
          else hitBoss(s.kind === 'pellet' ? 0.25 : 0.35);
          hit = true;
        }
      }
      if (!hit) {
        for (var i = 0; i < G.ents.length; i++) {
          var e = G.ents[i]; if (!canHit(e)) continue;
          var b = ebox(e);
          if (s.x > b[0] - 6 && s.x < b[2] + 6 && s.y > b[1] - 6 && s.y < b[3] + 6) {
            if (s.kind === 'rocket') { explodeAt(s.x, s.y, 160, false); }
            else if (e.type === 'helmet' && s.kind === 'bullet') { AU.sfx('armor'); spark(s.x, s.y); popText(e.x, e.y - 200, 'HELMET!', '#cde8ff', 0.5); e.stag = 0.2; }
            else if (e.type === 'tank' && s.kind === 'bullet' && (e.armor || 0) > 0) { resistChop(e, true); }
            else if (e.type === 'boulder') { if (s.kind === 'pellet' || s.kind === 'bullet') { e.alive = false; e.dead = true; rocks(e.x, e.y - 30); G.score += 50; } }
            else {
              if (s.kind === 'pellet') { e.x += 50; e.stag = Math.max(e.stag, 0.35); }
              decap(e, s.kind === 'pellet' ? 'BLAST!' : 'HEADSHOT!', s.kind === 'pellet' ? 80 : 100, false, s.how || 'gun');
            }
            hit = true; break;
          }
        }
      }
      if (hit || s.life <= 0) {
        if (!hit && s.kind === 'rocket') explodeAt(s.x, s.y, 140, false);
        s.dead = true;
      }
    });
    G.shots = shots.filter(function (s) { return !s.dead; });
  }

  // ---------- UPDATE ----------
  function update(dt) {
    G.t += dt;
    if (G.mode === 'title' || G.mode === 'levels') { G.titleT += dt; return; }
    if (G.mode !== 'play') return;
    if (G.hitstop > 0) { G.hitstop -= dt; return; }
    if (G.slowmo > 0) { G.slowmo -= dt; dt *= 0.32; G.zoom = lerp(G.zoom || 1, 1.22, Math.min(1, dt * 8)); }
    else G.zoom = lerp(G.zoom || 1, 1, Math.min(1, dt * 5));
    var h = G.hero, L = G.L;
    G.levelT += dt; G.hintT -= dt;
    var prog = clamp(h.x / G.endX, 0, 1);
    var rideMul = (G.ride && G.ride.def) ? G.ride.def.speed : 1;
    var target = G.boss ? 0 : L.speed * (1 + 0.14 * prog) * rideMul;
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
      if (G.ride && (G.ride.kind === 'jetski' || G.ride.kind === 'boat')) {
        h.y = ref + 8; h.vy = 0; h.grounded = true; h.jumps = 0;
      } else {
        var sgm = nextSeg(h.x) || segAt(h.x);
        splash(h.x, ref + 40); h.invuln = 0; hurt('fall');
        if (G.mode !== 'play') return;
        h.x = sgm.x0 + 40; h.y = groundAt(h.x) - 160; h.vy = 0; h.grounded = false; h.invuln = 1.8;
        popText(h.x + 60, h.y - 60, 'SPLASH!', '#bfefff', 0.8);
      }
    }
    if (h.slideT > 0) h.slideT -= dt;
    if (h.hurtT > 0) h.hurtT -= dt;
    if (h.invuln > 0) h.invuln -= dt;
    if (h.flipT > 0) { h.flipT += dt; if (h.flipT > 0.42) h.flipT = 0; }
    if (h.atype) { h.at += dt / h.adur; if (h.at >= 1) { h.atype = null; h.at = 0; } }
    if (h.muzzle > 0) h.muzzle -= dt;
    h.pose = h.hurtT > 0 ? 'hurt' : h.slideT > 0 ? 'slide' : !h.grounded ? (h.vy < 0 ? 'jump' : 'fall') : 'run';
    h.phase += dt * (G.boss ? 6 : G.speed / 30);
    h.flip = h.flipT > 0 ? -(h.flipT / 0.42) * TAU : 0;
    if (h.grounded && fx() < dt * 8 && G.speed > 50) dust(h.x - 10, h.y, 1);
    for (var k in G.power) if (G.power[k] > 0) G.power[k] -= dt;
    if (G.power.gato > 0) G.spin = Math.min(100, G.spin + dt * 30);
    if (G.gun) { G.gun.t -= dt; if (G.gun.t <= 0 || G.gun.ammo <= 0) G.gun = null; }
    if (G.ride) {
      G.ride.t -= dt; G.ride.cd = (G.ride.cd || 0) - dt; if (G.ride.flash > 0) G.ride.flash -= dt;
      if (G.ride.t <= 0) eject('time');
      else {
        if (G.ride.cd <= 0 && G.ride.ammo > 0) {
          var aimV = !!(G.boss && G.boss.alive);
          if (!aimV) G.ents.forEach(function (e) { if (e.alive && e.x - h.x > -20 && e.x - h.x < 640) aimV = true; });
          if (aimV) fireVehicleRocket();
        }
        if (fx() < dt * 6) AU.sfx('engine');
      }
    }
    autoFireGun(dt);
    if (G.streakT > 0) G.streakT -= dt; else G.streak = 0;
    setChal('distance', Math.floor(h.x / PXM));
    if (G.event && !G.event.fired && h.x >= G.event.x - 80) {
      G.event.fired = true; popText(h.x + 140, h.y - 210, G.event.text, '#ff6a3a', 1.6, 1.25); AU.sfx('roar');
    }
    G.distAcc = (G.distAcc || 0) + G.speed * dt / PXM; if (G.distAcc >= 1) { G.score += Math.floor(G.distAcc); G.distAcc -= Math.floor(G.distAcc); }
    G.camX = h.x - W * 0.27;
    G.camY = lerp(G.camY, ref - GROUND, Math.min(1, dt * 3));
    updateEnemies(dt); updateObstacles(); updatePickups(dt); updateBoss(dt); updateShots(dt); updateFx(dt);
    if (G.mode !== 'play') return;
    if (!G.finished && !G.boss && !G.bossDone && h.x >= G.endX) spawnBoss();
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
  function hbox() {
    var h = G.hero;
    if (G.ride) return [h.x - 50, h.y - 110, h.x + 70, h.y + 8];
    return h.slideT > 0 ? [h.x - 30, h.y - 56, h.x + 36, h.y] : [h.x - 16, h.y - 142, h.x + 18, h.y];
  }
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
        case 'fly':
          e.x += (e.vx - 20) * dt;
          e.y = (baseGround(e.x) || GROUND) - (e.baseH || 160) + Math.sin((e.phase || 0) * 0.9) * 18;
          if (dx < 520 && dx > -40) e.x += -40 * dt;
          break;
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
          if (e.type === 'leaper' && e.stag <= 0) {
            e.leapCd = (e.leapCd || 0) - dt;
            if (e.leapCd <= 0 && dx < 460 && dx > 40) { leapAt(e, 0.7, 'idle'); e.leapCd = R(1.4, 2.4); AU.sfx('moan'); }
          }
          if (e.type === 'spitter' && e.stag <= 0) {
            e.spitCd = (e.spitCd || 0) - dt;
            if (e.spitCd <= 0 && dx < 620 && dx > 80) {
              e.spitCd = R(1.5, 2.3); AU.sfx('spit');
              var T = 0.85, tx = h.x + 20, ty = h.y - 120, sx = e.x - 20, sy = e.y - 130;
              G.projs.push({ kind: 'acid', x: sx, y: sy, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * 1500 * T * T) / T, rot: 0, high: true, r: 14 });
            }
          }
          if (e.type === 'bloater' && dx < 150 && dx > -20 && !e.fuse) { e.fuse = true; e.fuseT = 0.55; popText(e.x, e.y - 200, 'BACK OFF!', '#ff9a3a', 0.7); }
          if (e.fuse) { e.fuseT -= dt; if (e.fuseT <= 0) { e.alive = false; explodeAt(e.x, e.y - 40, 180, true); return; } }
          if (e.type === 'fish' && e.state === 'flop') { e.flopT = (e.flopT || 0) + dt; e.y = (groundAt(e.x) || e.y) - 16 - Math.abs(Math.sin(e.flopT * 7)) * 22; e.rot = Math.sin(e.flopT * 7) * 0.5; }
          else if (e.type !== 'flyer') { var g3 = groundAt(e.x); if (g3 !== null) e.y = g3; }
      }
      if (!e.alive || isHumanStill(e) || e.type === 'turner') return;
      if (e.state === 'climb' && e.climb < 0.6) return;
      var b = ebox(e);
      if (overlap(hb, b)) {
        if (G.ride && e.type !== 'boulder') {
          if (e.type === 'bloater') { e.alive = false; explodeAt(e.x, e.y - 40, 160, false); addKill(80, 'vehicle'); }
          else { decap(e, 'CRUSHED!', 80, false, 'vehicle'); }
          G.shake = Math.max(G.shake, 6);
        } else if (h.vy > 0 && h.prevY <= b[1] + 22 && e.type !== 'fish' && e.type !== 'flyer') { h.vy = -720; h.jumps = 1; h.grounded = false; e.stag = 0.9; AU.sfx('stomp'); G.score += 10; popText(e.x, b[1] - 20, 'STAGGER', '#cfe8ff', 0.5); }
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
        if (p.kind === 'coin') {
          G.coins++; G.bank = (G.bank || 0) + 1; store.set('zrBank', G.bank);
          G.score += 10 * (G.power.alouda > 0 ? 2 : 1); AU.sfx('coin');
          G.parts.push({ k: 'spark', x: p.x, y: p.y, vx: 0, vy: -60, r: 3, life: 0.3, max: 0.3, col: '#ffe066' });
          addChal('coins', 1);
          if (G.coins > (G.runCoinsMax || 0)) { G.runCoinsMax = G.coins; store.set('zrRunCoinsMax', G.runCoinsMax); unlockOutfits(); }
        }
        else if (p.kind === 'dholl') { G.hearts = Math.min(5, G.hearts + 1); AU.sfx('heal'); popText(p.x, p.y - 30, 'DHOLL PURI! +1 HEART', '#ffe08a', 1.2); }
        else if (p.kind === 'gato') { G.power.gato = 9; G.spin = 100; AU.sfx('power'); popText(p.x, p.y - 30, 'GATO PIMENT! FIRE SABRE', '#ff9a3a', 1.2); }
        else if (p.kind === 'alouda') { G.power.alouda = 9; AU.sfx('power'); popText(p.x, p.y - 30, 'ALOUDA! MAGNET + DOUBLE SCORE', '#ff9ad2', 1.2); }
        else if (p.kind === 'pistol' || p.kind === 'shotgun' || p.kind === 'rocket' || p.kind === 'bigSabre' || p.kind === 'sabre') giveWeapon(p.kind);
        else if (p.kind === 'jeep' || p.kind === 'jetski' || p.kind === 'quad' || p.kind === 'boat' || p.kind === 'tractor') mountVehicle(p.kind);
        else { G.power.alouda = 9; AU.sfx('power'); popText(p.x, p.y - 30, 'ALOUDA! MAGNET + DOUBLE SCORE', '#ff9ad2', 1.2); }
      }
    });
  }
  // ---------- BOSS ----------
  function spawnBoss() {
    var h = G.hero, d = bossDef(), form = d.form;
    G.ents.forEach(function (e) { if (e.x > h.x - 80) { e.alive = false; e.dead = true; } });
    G.obs = G.obs.filter(function (o) { return o.x < h.x - 20; });
    var outfits = {
      docker: { shirt: '#e9e4d6', pants: '#2c2f38', tags: 'stripes cap', kind: 'city' },
      shark: { shirt: '#skin', pants: '#skin', tags: 'trunks', kind: 'swim' },
      gorilla: { shirt: '#skin', pants: '#skin', tags: '', kind: 'hiker' },
      rock: { shirt: '#6b625a', pants: '#4a4640', tags: '', kind: 'hiker' },
      bloater: { shirt: '#e85d8a', pants: '#e9d9b4', tags: 'hawaii hat camera', kind: 'tourist' },
      captain: { shirt: '#2a2030', pants: '#2e3f5c', tags: 'stripes', kind: 'fisher' },
      harvester: { shirt: '#7d3b32', pants: '#4b4537', tags: 'plaid straw', kind: 'cane' },
      granzombi: { shirt: '#7a1010', pants: '#2a2a30', tags: '', kind: 'city' }
    };
    var skins = { docker: '#6f8a66', shark: '#4a6a52', gorilla: '#3a3028', rock: '#7a7568', bloater: '#8a9a70', captain: '#5f7a52', harvester: '#6f8a4a', granzombi: '#5f7a52' };
    G.boss = { type: 'boss', form: form, name: d.name, death: d.death, minion: d.minion, proj: d.proj,
      x: h.x + W * 0.72, y: groundAt(h.x + 80) || GROUND, alive: true, hp: d.hp, max: d.hp, phase: 0, seed: 77 + G.idx * 13,
      skin: skins[form] || '#5f7a52', outfit: outfits[form] || outfits.granzombi, head: 'zHead2',
      state: 'enter', timer: 0, hurtT: 0, stag: 0, stagNeed: 0, throwT: 1.6, dieT: 0,
      scale: bossScale(form), atk: 'charge', tele: '!', dodge: 'jump', hit: false };
    AU.sfx('roar'); AU.setMusic('boss'); G.shake = 14; AU.voice('bossIn');
    G.bossHit = false; G.boss.phaseN = 1;
    if (G.ride) eject('time');
    popText(h.x + 160, h.y - 210, d.title, '#ff3a3a', 1.5, 1.15);
  }
  function bossPhaseOf(b) { var r = b.hp / b.max; return r <= 0.33 ? 3 : r <= 0.66 ? 2 : 1; }
  function pickBossAtk(b) {
    var pool = ['charge', 'slam', 'throw', 'summon'];
    if ((b.phaseN || 1) >= 2) pool = pool.concat(['throw', 'slam']);
    if (b.enrage) pool = pool.concat(['charge', 'summon', 'throw']);
    var next = pool[Math.floor(rnd() * pool.length)];
    if (next === b.atk) next = pool[(pool.indexOf(next) + 1 + Math.floor(rnd() * 2)) % pool.length];
    b.atk = next;
    if (next === 'charge') { b.dodge = (b.form === 'shark' || b.form === 'gorilla' || b.form === 'rock') ? 'jump' : 'slide'; b.tele = b.dodge === 'slide' ? 'SLIDE!' : 'JUMP!'; }
    else if (next === 'slam') { b.dodge = 'jump'; b.tele = 'JUMP!'; }
    else if (next === 'throw') { b.dodge = rnd() < 0.4 ? 'slide' : 'jump'; b.tele = b.dodge === 'slide' ? 'SLIDE!' : 'JUMP!'; }
    else { b.dodge = 'jump'; b.tele = '!'; }
  }
  function updateBoss(dt) {
    var b = G.boss, h = G.hero; if (!b) return;
    b.phase += dt * 2.4; var gy = groundAt(b.x) || GROUND; if (b.form !== 'shark' || b.state !== 'charge') b.y = gy;
    if (b.hurtT > 0) b.hurtT -= dt;
    var d = b.x - h.x;
    if (b.stag > 0) { b.stag -= dt; if (d > 170) b.x -= Math.min(240 * dt, d - 160); d = b.x - h.x; if (b.stag <= 0 && b.alive && b.state === 'stagger') { b.state = 'back'; b.timer = 0.35; } }
    if (!b.alive) { b.dieT += dt; if (b.dieT < 1.8) for (var i = 0; i < 4; i++) G.parts.push({ k: 'blood', x: bossHead(b)[0], y: bossHead(b)[1], vx: R(-120, 160), vy: R(-800, -450), r: R(3, 7), life: 1.2, max: 1.2, col: '#c3141c' }); return; }
    var phn = bossPhaseOf(b);
    if (phn > (b.phaseN || 1)) {
      b.phaseN = phn; AU.sfx('roar'); G.shake = 16; G.flash = 0.4; vibe([50, 30, 80]);
      popText(b.x - 40, b.y - 420, phn === 3 ? 'ENRAGED!' : ('PHASE ' + phn + '!'), '#ff3a3a', 1.5, 1.3);
      bossSummon();
      if (phn === 3) { b.enrage = true; bossThrow(false); }
      b.state = 'recover'; b.timer = 0.8;
    }
    b.timer -= dt;
    var rage = 1 + (1 - b.hp / b.max) * 0.7 + G.idx * 0.06 + (b.enrage ? 0.55 : 0) + ((b.phaseN || 1) - 1) * 0.25;
    switch (b.state) {
      case 'enter': b.x -= 110 * dt; if (d < 540) { b.state = 'walk'; b.timer = 0.4; AU.sfx('roar'); } break;
      case 'walk': b.x -= (80 + (b.max - b.hp) * 6) * dt;
        if (d > 260 && b.timer <= 0) b.timer = 0.2;
        if (b.timer <= 0 && d <= 260) { pickBossAtk(b); b.state = 'windup'; b.timer = Math.max(0.4, 0.75 / rage); AU.sfx('moan', 0.1); popText(b.x - 40, b.y - 360, b.tele, '#ffd0a0', 0.7); }
        if (d < 150) { pickBossAtk(b); b.atk = 'charge'; b.dodge = b.dodge || 'slide'; b.state = 'windup'; b.timer = 0.35; } break;
      case 'windup':
        if (b.timer <= 0) {
          if (b.atk === 'charge') { b.state = 'charge'; b.timer = 0.55; b.hit = false; AU.sfx('roar'); G.shake = 8; }
          else if (b.atk === 'slam') { b.state = 'slam'; b.timer = 0.4; bossSlam(); }
          else if (b.atk === 'throw') { b.state = 'throw'; b.timer = 0.35; bossThrow(b.dodge === 'slide'); }
          else { b.state = 'summon'; b.timer = 0.5; bossSummon(); }
        }
        break;
      case 'charge':
        b.x -= (520 + G.idx * 20) * dt;
        if (b.form === 'shark') b.y = gy - 40;
        if (!b.hit && overlap(hbox(), bossBox(b))) {
          var dodged = (b.dodge === 'slide' && h.slideT > 0) || (b.dodge === 'jump' && !h.grounded);
          if (!dodged) { b.hit = true; hurt(b); }
        }
        if (b.timer <= 0 || d < 120) { b.state = 'recover'; b.timer = 0.9; b.y = gy; if (b.x > h.x + 155) b.x = h.x + 155; }
        break;
      case 'slam':
      case 'throw':
      case 'summon':
        if (d > 200) b.x -= 180 * dt;
        if (b.timer <= 0) { b.state = 'recover'; b.timer = 0.7; } break;
      case 'stagger': break;
      case 'recover':
        if (d > 180) b.x -= 220 * dt;
        if (b.timer <= 0) { b.state = 'back'; b.timer = 0.45; } break;
      case 'back': b.x += 120 * dt; if (b.timer <= 0 || d > 230) { b.state = 'walk'; b.timer = Math.max(0.25, 0.6 / rage); } break;
    }
    if (b.x - h.x < 80) b.x = h.x + 80;
    if (b.x - h.x > 780) b.x = h.x + 780;
    updateBossProjs(dt);
  }
  function bossSlam() {
    var b = G.boss, gy = groundAt(b.x) || GROUND;
    G.projs.push({ kind: 'wave', x: b.x - 50, y: gy - 10, vx: -480 - G.idx * 20, vy: 0, rot: 0, high: false, r: 34 });
    AU.sfx('thud'); G.shake = 16; dust(b.x - 40, gy, 14);
    popText(b.x - 80, b.y - 240, 'JUMP!', '#ffd0a0', 0.7);
  }
  function bossSummon() {
    var b = G.boss, type = b.minion || 'walker', n = 2 + (G.idx > 4 ? 1 : 0) + ((b.phaseN || 1) >= 2 ? 1 : 0) + (b.enrage ? 1 : 0);
    var live = 0; G.ents.forEach(function (e) { if (e.alive) live++; });
    if (live > 8) n = 1;
    for (var i = 0; i < n; i++) {
      var e = makeEnemy(type, b.x - 40 - i * 50, G.L, G.idx);
      e.x = b.x + 30 - i * 70; e.y = groundAt(e.x) || b.y; e.state = e.state === 'perch' || e.state === 'swim' || e.state === 'wait' || e.state === 'climb' || e.state === 'perchJ' ? 'idle' : e.state;
      if (e.type === 'fish') { e.state = 'idle'; e.tr = 1; e.vy = -200; }
      if (e.type === 'monkey') { e.state = 'idle'; e.tr = 1; }
      if (e.type === 'boulder') { e.state = 'roll'; e.vx = -240; }
      G.ents.push(e);
    }
    AU.sfx('moan'); popText(b.x - 20, b.y - 300, 'MINIONS!', '#9cff6a', 0.8);
  }
  function updateBossProjs(dt) {
    var h = G.hero;
    G.projs.forEach(function (p) {
      if (p.kind === 'wave') {
        p.x += p.vx * dt; var gy = groundAt(p.x) || GROUND; p.y = gy - 10;
        if (p.x < G.camX - 80) p.dead = true;
        var hb = hbox();
        if (!p.dead && h.grounded && overlap(hb, [p.x - p.r, p.y - 24, p.x + p.r, p.y + 16])) { p.dead = true; hurt(p); }
        return;
      }
      if (p.kind === 'acid') {
        p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot = (p.rot || 0) + dt * 8;
        var gy = groundAt(p.x) || GROUND;
        if (p.y > gy - 8) p.dead = true;
        var hb = hbox();
        if (!p.dead && overlap(hb, [p.x - 14, p.y - 14, p.x + 14, p.y + 14])) {
          if (h.slideT > 0) { p.dead = true; popText(p.x, p.y - 20, 'SLID!', '#b8ff80', 0.5); }
          else { p.dead = true; hurt(p); }
        }
        return;
      }
      p.vy += 1500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 10;
      var gy = groundAt(p.x) || GROUND;
      if (p.y > gy - 14) { p.y = gy - 14; p.vy = -Math.abs(p.vy) * 0.3; p.vx *= 0.7; p.bounce = (p.bounce || 0) + 1; if (p.bounce > 3) p.dead = true; }
      var hb = hbox(); if (!p.dead && overlap(hb, [p.x - 16, p.y - 16, p.x + 16, p.y + 16])) { p.dead = true; hurt(p); blood(p.x, p.y, 8, 0.6); }
      if (!p.dead && h.atype && h.at < 0.5 && p.x - h.x > -10 && p.x - h.x < reach() && p.y > h.y - 200) { p.dead = true; blood(p.x, p.y, 14, 0.8); AU.sfx('chop'); G.score += 50; popText(p.x, p.y - 30, 'BATTED AWAY!', '#fff', 0.6); }
    });
    G.projs = G.projs.filter(function (p) { return !p.dead && p.x > G.camX - 160; });
  }
  function bossThrow(forceHigh) {
    var b = G.boss, h = G.hero, T = 0.9, high = forceHigh != null ? forceHigh : rnd() < 0.35;
    var tx = h.x + 10, ty = h.y - (high ? 120 : 30);
    var sx = b.x - 60, sy = (b.form === 'shark' ? b.y - 80 : b.y - 280);
    var n = 1 + (G.idx > 5 && rnd() < 0.5 ? 1 : 0) + ((G.boss && G.boss.phaseN >= 2) ? 1 : 0) + (G.boss && G.boss.enrage ? 1 : 0);
    for (var i = 0; i < n; i++) {
      G.projs.push({ kind: b.proj || 'head', x: sx, y: sy - i * 20, vx: (tx - sx) / T, vy: (ty - sy - 0.5 * 1500 * T * T) / T + (i ? -80 : 0), rot: 0, high: high, head: ['zHead0', 'zHead1'][Math.floor(fx() * 2)] });
    }
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
    if (h.grounded) { var ahead = h.x + G.speed * 0.17 + 30; if (groundAt(ahead) === null && groundAt(h.x + 10) !== null && !(G.ride && (G.ride.kind === 'jetski' || G.ride.kind === 'boat'))) { jump(); return; } }
    G.projs.forEach(function (p) {
      var dd = p.x - h.x;
      if (dd > -20 && dd < 240) {
        if (p.kind === 'acid' || p.high) { if (h.slideT <= 0) slide(); }
        else if (p.kind === 'wave' || !p.high) { if (h.grounded) jump(); }
      }
    });
    for (var i = 0; i < G.obs.length; i++) {
      var o = G.obs[i], d = o.x - o.w / 2 - (h.x + 18);
      if (d < -o.w || d > look || o.broken) continue;
      if (!o.high && d > 0 && d < G.speed * 0.2 && h.grounded) { jump(); return; }
      if (o.high && d < G.speed * 0.16 && h.slideT <= 0.12) { slide(); return; }
    }
    if (G.boss && G.boss.alive) {
      var b = G.boss;
      if (b.state === 'windup' || b.state === 'slam' || b.state === 'charge') {
        if (b.dodge === 'slide' && h.slideT <= 0) slide();
        else if (b.dodge === 'jump' && h.grounded) jump();
      }
      G.projs.forEach(function (p) { var dd = p.x - h.x; if (dd > -20 && dd < 220) { if (p.kind === 'wave' || !p.high) { if (h.grounded) jump(); } else if (p.high && h.slideT <= 0) slide(); else if (ai.cd <= 0) { slash(); ai.cd = 0.3; } } });
      if (ai.cd <= 0 && b.state !== 'windup' && b.state !== 'charge' && b.state !== 'slam') {
        slash();
        if (b.stag > 0 || b.stagNeed >= 1) ai.q.push({ t: 0.16, f: slash });
        if (b.stag > 0.3 && G.spin >= 100) ai.q.push({ t: 0.30, f: slash });
        ai.cd = b.stag > 0 ? 0.22 : 0.28;
      }
      return;
    }
    if (ai.cd > 0) return;
    var near = [];
    G.ents.forEach(function (e) { if (!e.alive) return; var dx = e.x - h.x; if (dx > -40 && dx < 280 && canHit(e)) near.push(e); });
    near.sort(function (a, b) { return a.x - b.x; });
    var tgt = near[0]; if (!tgt) return;
    var dx = tgt.x - h.x;
    if (tgt.type === 'boulder') { if (dx < G.speed * 0.28 + 30 && h.grounded) { if (fx() < 0.5) jump(); else { slash(); ai.q.push({ t: 0.1, f: slash }); } ai.cd = 0.5; } return; }
    if (tgt.type === 'bloater' && dx < 200) { if (h.grounded && !G.gun && !G.ride) jump(); slash(); ai.cd = 0.3; return; }
    if (tgt.type === 'flyer' && dx < 200 && h.grounded) { jump(); slash(); ai.cd = 0.3; return; }
    if (tgt.type === 'spitter' && dx < 280 && h.slideT <= 0) { /* acid handled above */ }
    if (dx > reach() - 15 && !G.ride && !G.gun) return;
    var close = near.filter(function (e) { return e.x - h.x < 240; }).length;
    if (close >= 2 && G.spin >= 100) { slash(); ai.q.push({ t: 0.1, f: slash }, { t: 0.2, f: slash }); ai.cd = 0.6; return; }
    if (tgt.type === 'helmet' || tgt.type === 'brute' || tgt.type === 'tank' || fx() < 0.3) { slash(); ai.q.push({ t: 0.1, f: slash }); ai.cd = 0.45; return; }
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
    if (G.zoom && G.zoom > 1.02 && G.hero) {
      var zx = W * 0.32, zy = (G.hero.y - G.camY) * 0.5 + H * 0.45;
      cx.translate(zx, zy); cx.scale(G.zoom, G.zoom); cx.translate(-zx, -zy);
    }
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
    G.projs.forEach(function (p) {
      cx.save(); cx.translate(p.x, p.y);
      if (p.kind === 'wave') {
        var r = p.r || 34, a = 0.7 + 0.3 * Math.sin(G.t * 20);
        cx.fillStyle = 'rgba(255,80,40,' + a + ')'; cx.beginPath(); cx.ellipse(0, 0, r, 16, 0, 0, TAU); cx.fill();
        cx.strokeStyle = 'rgba(255,230,180,0.9)'; cx.lineWidth = 3; cx.stroke();
        cx.restore(); return;
      }
      cx.rotate(p.rot || 0);
      if (p.head && IMG[p.head] && IMG[p.head].width) { var im = IMG[p.head]; cx.drawImage(im, -20, -26, 40, 40 * im.height / im.width); }
      else if (p.kind === 'acid') { cx.fillStyle = '#7dff3a'; cx.strokeStyle = '#2a6a10'; cx.lineWidth = 2; cx.beginPath(); cx.ellipse(0, 0, 12, 9, p.rot || 0, 0, TAU); cx.fill(); cx.stroke(); cx.fillStyle = 'rgba(180,255,80,0.5)'; cx.beginPath(); cx.arc(-4, -3, 4, 0, TAU); cx.fill(); }
      else if (p.kind === 'crate' || p.kind === 'cane') { cx.fillStyle = '#8a5a28'; cx.strokeStyle = '#14100e'; cx.lineWidth = 3; ART.rr(cx, -16, -14, 32, 28, 3); cx.fill(); cx.stroke(); }
      else if (p.kind === 'rock') { cx.fillStyle = '#6b625a'; cx.strokeStyle = '#14100e'; cx.lineWidth = 3; cx.beginPath(); cx.arc(0, 0, 16, 0, TAU); cx.fill(); cx.stroke(); }
      else if (p.kind === 'anchor') { cx.strokeStyle = '#c4c8d0'; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(0, -18); cx.lineTo(0, 14); cx.moveTo(-12, 8); cx.quadraticCurveTo(0, 20, 12, 8); cx.stroke(); }
      else if (p.kind === 'fish') { cx.fillStyle = '#4a8a62'; cx.strokeStyle = '#14100e'; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(0, 0, 18, 8, 0, 0, TAU); cx.fill(); cx.stroke(); }
      else { var im2 = IMG.zHead0; if (im2 && im2.width) cx.drawImage(im2, -20, -26, 40, 40 * im2.height / im2.width); }
      cx.restore();
    });
    G.pieces.forEach(function (p) {
      cx.save(); cx.globalAlpha = Math.min(1, p.life); cx.translate(p.x, p.y); cx.rotate(p.rot);
      if (p.kind === 'head') { cx.scale(p.sc, p.sc); ART.zhead(cx, p.z, 0, 30, 0); cx.fillStyle = '#9a0c0c'; cx.beginPath(); cx.ellipse(2, 28, 9, 4, 0, 0, TAU); cx.fill(); }
      else { cx.drawImage(p.img, p.sx * p.res, p.sy * p.res, p.sw * p.res, p.sh * p.res, -p.cx, -p.cy, p.sw, p.sh); cx.fillStyle = '#a00d12'; var left = p.sx === 0, srcX = left ? p.cut - 7 : p.cut, dstX = left ? p.cx - 7 : -p.cx; cx.drawImage(p.rimg, srcX * p.res, 0, 7 * p.res, p.sh * p.res, dstX, -p.cy, 7, p.sh); }
      cx.restore();
    });
    var h = G.hero;
    (G.shots || []).forEach(function (s) {
      cx.save(); cx.translate(s.x, s.y);
      if (s.kind === 'rocket') { cx.fillStyle = '#8a2a1a'; cx.strokeStyle = '#14100e'; cx.lineWidth = 2; ART.rr(cx, -14, -5, 28, 10, 3); cx.fill(); cx.stroke(); cx.fillStyle = '#ffb020'; cx.beginPath(); cx.arc(-14, 0, 5 + Math.sin(G.t * 40) * 2, 0, TAU); cx.fill(); }
      else { cx.fillStyle = s.kind === 'pellet' ? '#ffe08a' : '#fff'; cx.beginPath(); cx.arc(0, 0, s.kind === 'pellet' ? 3.5 : 4, 0, TAU); cx.fill(); }
      cx.restore();
    });
    if (G.ride) {
      cx.save(); cx.translate(h.x + 10, h.y); ART.vehicle(cx, G.ride.kind, G.t, G.ride.flash > 0); cx.restore();
    }
    if (!(h.invuln > 0 && Math.floor(G.t * 16) % 2 === 0 && h.hurtT <= 0)) {
      cx.save(); cx.translate(h.x, h.y - (G.ride ? (G.ride.kind === 'tractor' ? 70 : 52) : 0)); cx.scale(0.92, 0.92);
      var gsh = groundAt(h.x); if (gsh !== null && !G.ride) { cx.fillStyle = 'rgba(0,0,0,0.25)'; cx.beginPath(); cx.ellipse(0, (gsh - h.y) / 0.92, 26, 6, 0, 0, TAU); cx.fill(); }
      ART.hero(cx, { pose: h.pose, phase: h.phase, at: h.at, atype: h.atype, flip: h.flip, power: G.power.gato > 0, fit: currentFit(), bigSabre: G.power.bigSabre > 0, gun: G.gun && G.gun.kind, muzzle: h.muzzle > 0 });
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
    if (e.type === 'boss') ART.drawBoss(cx, e); else ART.zombie(cx, e, {});
    if (e.type === 'boss' && e.state === 'windup') { cx.fillStyle = 'rgba(255,60,60,0.9)'; cx.font = '900 54px sans-serif'; cx.textAlign = 'center'; cx.fillText((e.tele || '!'), 0, e.form === 'shark' ? -160 : -380); }
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
    if (G.power.bigSabre > 0) { txt('BIG SABRE ' + Math.ceil(G.power.bigSabre) + 's', m + 60, py + 12, '900 12px "Trebuchet MS", Arial', '#c0e8ff', 3, 'left'); py += 16; }
    if (G.power.alouda > 0) { txt('ALOUDA x2 ' + Math.ceil(G.power.alouda) + 's', m + 60, py + 12, '900 12px "Trebuchet MS", Arial', '#ff9ad2', 3, 'left'); py += 16; }
    if (G.gun) {
      var gw = 120, gx = m, gy = py + 8;
      cx.fillStyle = 'rgba(0,0,0,0.5)'; ART.rr(cx, gx, gy, gw, 16, 4); cx.fill();
      cx.fillStyle = '#ffcc3a'; ART.rr(cx, gx, gy, Math.max(2, gw * G.gun.t / G.gun.max), 16, 4); cx.fill();
      ART.weaponIcon(cx, G.gun.kind, gx + 14, gy + 8, 0.55);
      txt(WEP[G.gun.kind].name + '  ' + G.gun.ammo, gx + 30, gy + 13, '900 11px "Trebuchet MS", Arial', '#fff', 3, 'left');
      py += 24;
    }
    if (G.ride) {
      var rw = 130, rx = m, ry = py + 8;
      cx.fillStyle = 'rgba(0,0,0,0.5)'; ART.rr(cx, rx, ry, rw, 16, 4); cx.fill();
      cx.fillStyle = '#7ad0ff'; ART.rr(cx, rx, ry, Math.max(2, rw * G.ride.t / G.ride.maxT), 16, 4); cx.fill();
      txt((G.ride.def && G.ride.def.name || 'RIDE') + '  HP ' + G.ride.hp + '  RKT ' + G.ride.ammo, rx + 6, ry + 13, '900 11px "Trebuchet MS", Arial', '#fff', 3, 'left');
      py += 24;
    }
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
      var b = G.boss, bw2 = Math.min(420, W * 0.5), bx2 = W / 2 - bw2 / 2, by2 = m + 96;
      cx.fillStyle = 'rgba(0,0,0,0.6)'; ART.rr(cx, bx2 - 3, by2 - 3, bw2 + 6, 18, 6); cx.fill();
      cx.fillStyle = '#b00a14'; ART.rr(cx, bx2, by2, Math.max(1, bw2 * b.hp / b.max), 12, 5); cx.fill();
      var ptag = b.enrage ? '  -  ENRAGED!' : (b.phaseN > 1 ? '  -  PHASE ' + b.phaseN : '') + (b.stag > 0 ? '  STAGGERED!' : '');
      txt((b.name || 'BOSS') + ptag, W / 2, by2 + 32, '900 14px "Trebuchet MS", Arial', b.enrage ? '#ffcc3a' : '#ff5a5a', 4);
    }
    if (G.hintT > 0 && !DEMO) {
      var a = Math.min(1, G.hintT / 2) * 0.6;
      cx.fillStyle = 'rgba(60,140,255,' + a * 0.25 + ')'; cx.fillRect(0, H * 0.35, W / 2 - 2, H * 0.65);
      cx.fillStyle = 'rgba(255,60,60,' + a * 0.25 + ')'; cx.fillRect(W / 2 + 2, H * 0.35, W / 2, H * 0.65);
      cx.globalAlpha = a * 1.6;
      txt(TOUCH ? 'TAP LEFT = JUMP' : 'SPACE / \u2191 = JUMP', W * 0.25, H * 0.62, '900 22px "Trebuchet MS", Arial', '#fff', 4);
      txt(TOUCH ? 'TAP RIGHT = SABRE  ·  GUNS AUTO-FIRE' : 'X / J = SABRE  ·  GUNS AUTO-FIRE', W * 0.75, H * 0.62, '900 18px "Trebuchet MS", Arial', '#fff', 4);
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
    function dripTitle(str, x, y, fs) {
      cx.font = '900 ' + fs + 'px Impact, "Arial Black", "Trebuchet MS", sans-serif';
      cx.lineJoin = 'round'; cx.lineWidth = Math.max(4, fs * 0.12); cx.strokeStyle = '#1a0004';
      cx.strokeText(str, x, y);
      var tg = cx.createLinearGradient(0, y - fs, 0, y);
      tg.addColorStop(0, '#ff4a3a'); tg.addColorStop(0.6, '#c0101a'); tg.addColorStop(1, '#6a0008');
      cx.fillStyle = tg; cx.fillText(str, x, y);
      var tw = cx.measureText(str).width;
      var align = cx.textAlign || 'center';
      var left = align === 'left' ? x : align === 'right' ? x - tw : x - tw / 2;
      var nd = Math.max(8, Math.round(tw / 26));
      for (var d = 0; d < nd; d++) {
        var dx = left + ART.hash(d * 5.3 + str.length) * tw, cyc = ((T * (0.25 + ART.hash(d) * 0.3) + ART.hash(d * 2 + 11)) % 1);
        var len = cyc * fs * (0.45 + ART.hash(d * 7) * 0.6);
        cx.fillStyle = '#9a0610'; cx.fillRect(dx - 2.5, y - 6, 5, len);
        cx.beginPath(); cx.arc(dx, y - 6 + len, 5, 0, TAU); cx.fill();
        if (cyc > 0.85) { cx.beginPath(); cx.arc(dx, y + len + (cyc - 0.85) * 600, 3.5, 0, TAU); cx.fill(); }
      }
      return tw;
    }
    var land = W > H * 1.15;
    var ka = IMG.heroKeyart, kin = clamp((t - 1.2) / 0.8, 0, 1), kfl = (t < 2.6 && ART.hash(Math.floor(T * 20)) < 0.4) ? 0.3 : (ART.hash(Math.floor(T * 9) + 3) < 0.1 ? 0.55 : 1);
    var kx = 0, ky = 0, kw = 0, kh = 0;
    if (ka && ka.width && kin > 0) {
      var topBand = land ? Math.max(56, Math.min(H * 0.17, 92)) : 0;
      kh = land ? H - topBand - H * 0.02 : H * 0.5;
      kw = kh * ka.width / ka.height;
      kx = land ? W * 0.05 : W / 2 - kw / 2;
      ky = land ? H - kh : H * 0.3;
      cx.save(); cx.globalAlpha = kin * kfl * flick; cx.shadowColor = 'rgba(255,20,20,0.9)'; cx.shadowBlur = 30; cx.drawImage(ka, kx, ky + (1 - kin) * 30, kw, kh); cx.restore();
    }
    var slam = clamp((t - 2.4) / 0.25, 0, 1);
    if (slam > 0) {
      var tx = land ? W * 0.66 : W / 2, ty = land ? H * 0.34 : H * 0.15, fs = Math.min(land ? W * 0.08 : W * 0.16, 92) * (1 + (1 - slam) * 1.5);
      cx.save(); cx.globalAlpha = slam; cx.textAlign = 'center';
      if (slam < 1) cx.translate((fx() - 0.5) * 16, (fx() - 0.5) * 16);
      dripTitle('ZOMBI LILE', tx, ty, fs);
      cx.font = '900 ' + fs * 0.42 + 'px Impact, "Arial Black", sans-serif'; cx.lineWidth = 5; cx.strokeStyle = '#000'; cx.fillStyle = '#efe6d2';
      cx.strokeText('R U N N E R', tx, ty + fs * 0.62); cx.fillText('R U N N E R', tx, ty + fs * 0.62);
      cx.font = '700 ' + Math.max(12, fs * 0.16) + 'px "Trebuchet MS", Arial'; cx.fillStyle = '#f7d36b'; cx.lineWidth = 3;
      cx.strokeText('Port Louis \u2192 Samara  \u2022  8 levels  \u2022  sabre only', tx, ty + fs * 0.92); cx.fillText('Port Louis \u2192 Samara  \u2022  8 levels  \u2022  sabre only', tx, ty + fs * 0.92);
      // "Bojo VS Zombies" — blood-drip title at the top of the character, beside ZOMBI LILE
      var bojo = 'BOJO VS ZOMBIES';
      if (land && kw > 0) {
        var bfs = Math.max(26, Math.min(58, W * 0.05, kw * 0.13));
        var bx = kx + kw * 0.52;
        var by = Math.max(bfs * 0.95, Math.min(H * 0.125, ky + bfs * 0.2));
        if (by > ky + kh * 0.12) by = ky + Math.min(8, kh * 0.04);
        dripTitle(bojo, bx, by, bfs);
      } else {
        var bfs2 = Math.max(20, Math.min(W * 0.085, 54));
        var by2 = ky > 0 ? ky - 10 : H * 0.28;
        var taglineY = ty + fs * 0.92;
        if (by2 < taglineY + bfs2 * 0.7) by2 = taglineY + bfs2 * 0.85;
        dripTitle(bojo, W / 2, by2, bfs2);
      }
      cx.restore();
    }
    if (t < 1.6) { cx.fillStyle = 'rgba(0,0,0,' + clamp(1 - t / 1.6, 0, 1) * 0.92 + ')'; cx.fillRect(0, 0, W, H); cx.textAlign = 'center'; cx.fillStyle = 'rgba(230,30,30,' + clamp(Math.sin(t * 2.4), 0, 1) + ')'; cx.font = '700 18px "Courier New", monospace'; cx.fillText('PORT LOUIS, MAURITIUS.  18:13.  THE FIRST ONE TURNS...', W / 2, H / 2); }
    if (ART.hash(Math.floor(T * 3)) < 0.03) { cx.fillStyle = 'rgba(255,255,255,0.15)'; cx.fillRect(0, 0, W, H); }
    var vg = cx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.8)'); cx.fillStyle = vg; cx.fillRect(0, 0, W, H);
    if (G.mode === 'title' && t > 2.7 && $('title').classList.contains('dim')) $('title').classList.remove('dim');
  }

  // ---------- INPUT ----------
  var ptrs = {};
  function firstGesture() { AU.init(); AU.resume(); if (!G.audioStarted && AU.ready()) { G.audioStarted = true; if (!G.L) AU.setMusic('title'); else { AU.setMusic(G.boss && G.boss.alive ? 'boss' : 'run', G.idx / 8); AU.setAmbience(G.L.amb); } } }
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(function (ev) { document.addEventListener(ev, firstGesture, true); });
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
  function beginPlay() { hideAll(); G.mode = 'play'; showHud(true); checkRotate(); AU.init(); AU.voice('levelStart'); }
  click('btnCard', function () { if (G.cardAction === 'next') startLevel(G.idx + 1); else beginPlay(); });
  click('btnPause', function () { pauseGame(true); });
  click('btnResume', function () { pauseGame(false); });
  click('btnQuit', toTitle);
  click('btnMute', function () { AU.setMuted(!AU.isMuted()); $('btnMute').style.opacity = AU.isMuted() ? 0.4 : 1; });
  click('btnRetryLevel', function () { G.score = G.levelScore0; G.hearts = 3; startLevel(G.idx); });
  click('btnRetry', function () { startRun(0); });
  click('btnOverTitle', toTitle);
  click('btnVicAgain', function () { startRun(0); });
  click('btnRotateOk', function () { G.rotateOk = true; checkRotate(); if (G.mode === 'paused') pauseGame(false); });

  function syncVibeButtons() {
    var lab = 'VIBRATION: ' + (G.vibOn ? 'ON' : 'OFF');
    if ($('btnVibe')) $('btnVibe').textContent = lab;
    if ($('btnVibePause')) $('btnVibePause').textContent = lab;
  }
  function toggleVibe() { G.vibOn = !G.vibOn; store.set('zrVib', G.vibOn); syncVibeButtons(); if (G.vibOn) vibe(30); }
  function openChallenges() {
    hideAll(); G.mode = 'levels'; loadDaily();
    $('chalDate').textContent = G.daily.date;
    $('chalBank').textContent = 'Bank: Rs ' + (G.bank || 0) + '   ·   Challenges done (lifetime): ' + (G.chalTotal || 0);
    var box = $('chalList'); box.innerHTML = '';
    G.daily.items.forEach(function (c) {
      var d = document.createElement('div'); d.className = 'chal' + (c.done ? ' done' : '');
      var pct = Math.min(100, Math.round((c.prog || 0) / c.goal * 100));
      d.innerHTML = '<h3>' + c.title + '</h3><p>' + c.desc + '</p><p>Reward: Rs ' + c.reward + '  ·  ' + (c.prog || 0) + ' / ' + c.goal + '</p><div class="bar"><span style="width:' + pct + '%"></span></div>';
      box.appendChild(d);
    });
    $('challenges').classList.remove('hidden');
  }
  function openOutfits() {
    hideAll(); G.mode = 'levels';
    var grid = $('fitGrid'); grid.innerHTML = '';
    (window.ZR_OUTFITS || []).forEach(function (o) {
      var unlocked = outfitUnlocked(o);
      var b = document.createElement('button');
      b.className = 'fit-card' + (unlocked ? '' : ' locked') + (G.fitId === o.id ? ' on' : '');
      b.innerHTML = '<div class="fit-swatch" style="background:linear-gradient(135deg,' + o.polo + ',' + o.poloD + ' 60%,' + o.jean[0] + ')"></div><b>' + o.name + '</b><small>' + (unlocked ? 'Tap to wear' : o.how) + '</small>';
      b.addEventListener('click', function (e) {
        e.stopPropagation(); AU.init(); AU.sfx('click');
        if (!unlocked) return;
        G.fitId = o.id; store.set('zrFit', o.id); openOutfits();
      });
      grid.appendChild(b);
    });
    $('outfits').classList.remove('hidden');
  }
  function openSettings() { hideAll(); G.mode = 'levels'; syncVibeButtons(); $('settings').classList.remove('hidden'); }
  click('btnChal', openChallenges);
  click('btnFits', openOutfits);
  click('btnSets', openSettings);
  click('btnChalBack', toTitle);
  click('btnFitsBack', toTitle);
  click('btnSetsBack', toTitle);
  click('btnVibe', toggleVibe);
  click('btnVibePause', toggleVibe);
  ['title', 'levels', 'tutorial', 'card', 'pause', 'over', 'victory', 'rotate', 'challenges', 'outfits', 'settings'].forEach(function (id) { if ($(id)) $(id).addEventListener('pointerdown', function (e) { e.stopPropagation(); }); });

  // ---------- LOOP ----------
  var last = 0;
  function frame(ts) {
    var dt = Math.min(1 / 30, (ts - last) / 1000 || 0); last = ts;
    try { pollPointers(); update(dt); AU.update(dt); render(); } catch (err) { console.error(err); }
    requestAnimationFrame(frame);
  }
  window.__zrAdvance = function (n, dt) { for (var i = 0; i < n; i++) update(dt); render(); return { mode: G.mode, level: G.idx + 1, x: G.hero ? Math.round(G.hero.x) : 0, score: G.score, hearts: G.hearts, kills: G.kills, ents: G.ents ? G.ents.length : 0, boss: G.boss && G.boss.alive ? G.boss.form : (G.boss ? 'dead' : null), bossHp: G.boss ? G.boss.hp : 0, bossState: G.boss ? G.boss.state : null, bossPhase: G.boss ? G.boss.phaseN : 0, gun: G.gun && G.gun.kind, ride: G.ride && G.ride.kind, types: (G.ents || []).filter(function (e) { return e.alive; }).map(function (e) { return e.type; }) }; };
  G.api = { startRun: startRun, startLevel: startLevel, toTitle: toTitle, jump: jump, slide: slide, slash: slash, victory: victory, levelComplete: levelComplete, spawnBoss: spawnBoss, resize: resize,
    giveWeapon: giveWeapon, mountVehicle: mountVehicle, fireGun: fireGun, openChallenges: openChallenges, openOutfits: openOutfits, currentFit: currentFit,
    gameOver: function () { G.mode = 'play'; G.hearts = 1; G.hero.invuln = 0; hurt('test'); },
    setOutfit: function (id) { G.fitId = id; store.set('zrFit', id); },
    spawnEnemy: function (type, off) { var e = makeEnemy(type, G.hero.x + (off || 280), G.L, G.idx); if (e.state === 'perch' || e.state === 'swim' || e.state === 'wait' || e.state === 'climb' || e.state === 'perchJ') e.state = 'idle'; if (e.type === 'flyer') { e.state = 'fly'; e.y = G.hero.y - 160; } if (e.type === 'monkey') e.tr = 1; if (e.type === 'fish') e.tr = 1; G.ents.push(e); return e.type; },
    teleport: function (frac) { var h = G.hero; h.x = G.endX * frac; if (!segAt(h.x)) h.x = (nextSeg(h.x) || { x0: h.x }).x0 + 50; h.y = groundAt(h.x) || baseGround(h.x); h.grounded = true; h.vy = 0; G.camX = h.x - W * 0.27; G.camY = baseGround(h.x) - GROUND; G.ents.forEach(function (e) { if (e.x < h.x + 200) { e.dead = true; e.alive = false; } }); G.obs = G.obs.filter(function (o) { return o.x > h.x + 300; }); } };

  resize();
  ART.load(function () {
    if (DEMO) { G.runSeed = 0; G.score = 0; G.hearts = 3; loadDaily(); startLevel(START_LEVEL - 1); }
    else { G.mode = 'title'; G.titleT = 0; $('title').classList.remove('hidden'); $('title').classList.add('dim'); updateBestLine(); loadDaily(); updateDailyLine(); syncVibeButtons(); }
    window.__zrReady = true;
    if (!CAPTURE) requestAnimationFrame(frame); else render();
  });
})();
