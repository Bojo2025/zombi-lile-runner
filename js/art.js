// ZOMBI LILE RUNNER - all drawing: hero, zombies, creatures, obstacles, pickups, parallax scenery.
// Characters are skeletal vector puppets (smooth animation at any resolution) wearing the
// cartoon heads generated from Kevin's photo / zombie art (js/assets.js).
(function () {
  'use strict';
  var IMG = {}, ART = {};
  ART.load = function (done) {
    var keys = Object.keys(window.ZR_ASSETS), left = keys.length;
    keys.forEach(function (k) {
      var im = new Image(); im.onload = im.onerror = function () { if (--left === 0) done(); };
      im.src = window.ZR_ASSETS[k]; IMG[k] = im;
    });
  };
  ART.img = IMG;
  var TAU = Math.PI * 2;
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  ART.hash = hash;
  function P(a, l) { return [Math.sin(a) * l, Math.cos(a) * l]; } // angle from straight-down, + = forward(+x)
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mix(c1, c2, t) {
    var a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    var r = Math.round(lerp(a >> 16, b >> 16, t)), g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1);
  }
  ART.mix = mix;
  var OUT = '#14100e';
  // two-segment limb with cartoon outline
  function limb(c, x, y, a1, l1, a2, l2, w1, w2, col, endCap) {
    var k = P(a1, l1), kx = x + k[0], ky = y + k[1], e = P(a2, l2), ex = kx + e[0], ey = ky + e[1];
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = OUT; c.lineWidth = w1 + 4; c.beginPath(); c.moveTo(x, y); c.lineTo(kx, ky); c.stroke();
    c.lineWidth = w2 + 4; c.beginPath(); c.moveTo(kx, ky); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = col[1] || col[0]; c.lineWidth = w2; c.beginPath(); c.moveTo(kx, ky); c.lineTo(ex, ey); c.stroke();
    c.strokeStyle = col[0]; c.lineWidth = w1; c.beginPath(); c.moveTo(x, y); c.lineTo(kx, ky); c.stroke();
    return [kx, ky, ex, ey];
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  ART.rr = rr;

  // ---------------- SABRE ----------------
  ART.sabre = function (c, x, y, ang, len, glow) {
    c.save(); c.translate(x, y); c.rotate(-ang);
    len = len || 66;
    if (glow) { c.shadowColor = glow; c.shadowBlur = 18; }
    // blade along +y, curved toward +x (edge side)
    c.beginPath(); c.moveTo(-3, 6); c.quadraticCurveTo(-4, len * 0.6, 7, len); c.quadraticCurveTo(10, len * 0.55, 4, 6); c.closePath();
    c.fillStyle = OUT; c.lineWidth = 4; c.strokeStyle = OUT; c.stroke();
    var g = c.createLinearGradient(-4, 0, 10, 0); g.addColorStop(0, '#e9eef4'); g.addColorStop(0.55, '#b7c1cc'); g.addColorStop(1, '#ffffff');
    c.fillStyle = glow ? '#fff2c0' : g; c.fill(); c.shadowBlur = 0;
    c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 10); c.quadraticCurveTo(0, len * 0.6, 6, len - 4); c.stroke();
    // brass guard + grip
    c.fillStyle = '#c9a03a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    rr(c, -8, 2, 16, 5, 2); c.fill(); c.stroke();
    c.beginPath(); c.arc(-7, -5, 8, Math.PI * 0.5, Math.PI * 1.5, false); c.lineWidth = 3; c.strokeStyle = '#c9a03a'; c.stroke();
    c.fillStyle = '#3a2416'; rr(c, -3.5, -14, 7, 16, 3); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
    c.restore();
  };

  // ---------------- HERO ----------------
  var POLO = '#252e4e', POLO_D = '#171e38', POLO_L = '#34406a', JEAN = ['#34528a', '#2a4473'], SKIN = ['#c8794a', '#b56a3f'];
  // h: {pose, phase, at, atype, vy, slideT, hurtT, power, fit, bigSabre, gun, muzzle}
  ART.hero = function (c, h) {
    var p = h.phase, pose = h.pose, at = h.at || 0;
    var polo = (h.fit && h.fit.polo) || POLO, poloD = (h.fit && h.fit.poloD) || POLO_D, poloL = (h.fit && h.fit.poloL) || POLO_L;
    var jean = (h.fit && h.fit.jean) || JEAN, tag = (h.fit && h.fit.tag) || '';
    c.save();
    if (tag === 'gold') { c.shadowColor = 'rgba(255,200,60,0.7)'; c.shadowBlur = 18; }
    var bob = 0, lean = 0.08;
    var tL, sL, tR, sR, aB, fB, aF, fF, sab;
    if (pose === 'run') {
      bob = -Math.abs(Math.sin(p)) * 5;
      tL = Math.sin(p) * 0.85; sL = tL - (0.25 + Math.max(0, Math.cos(p)) * 1.25);
      tR = Math.sin(p + Math.PI) * 0.85; sR = tR - (0.25 + Math.max(0, Math.cos(p + Math.PI)) * 1.25);
      aB = -Math.sin(p) * 0.9; fB = aB + 1.3; aF = Math.sin(p) * 0.6 + 0.5; fF = aF + 1.5; sab = fF + 0.9;
    } else if (pose === 'jump' || pose === 'fall') {
      var up = pose === 'jump'; lean = 0.15;
      tL = up ? 1.1 : 0.6; sL = up ? -0.2 : 0.1; tR = up ? -0.2 : -0.5; sR = up ? -1.4 : -0.9;
      aB = up ? -2.4 : -1.6; fB = aB + 0.6; aF = up ? 2.3 : 1.7; fF = aF + 0.5; sab = fF + 0.4;
      if (h.flip) { c.translate(0, -70); c.rotate(h.flip); c.translate(0, 70); }
    } else if (pose === 'slide') {
      c.translate(-6, 0); c.rotate(-1.15); c.translate(8, 6);
      tL = 1.5; sL = 1.6; tR = 1.0; sR = 1.9; aB = -1.9; fB = -1.2; aF = 2.0; fF = 2.6; sab = 2.8; lean = 0;
    } else { // hurt
      lean = -0.35; tL = 0.5; sL = 0.2; tR = -0.4; sR = -0.9; aB = -2.6; fB = -2.2; aF = 2.6; fF = 2.9; sab = 3.1;
    }
    // attacks override the front arm
    var trail = null;
    if (h.atype === 'slash') { var e = 1 - Math.pow(1 - at, 3); aF = lerp(2.9, 0.7, e); fF = aF + lerp(0.3, -0.2, e); sab = fF + 0.15; trail = [2.95, aF, 'rgba(255,255,255,'];
    } else if (h.atype === 'cleave') { var e2 = at < 0.35 ? at / 0.35 : 1; var e3 = at < 0.35 ? 0 : Math.min(1, (at - 0.35) / 0.4); aF = lerp(lerp(2.4, 3.7, e2), 0.35, e3); fF = aF + 0.1; sab = fF; lean = lerp(-0.1, 0.35, e3); if (e3 > 0) trail = [3.7, aF, 'rgba(255,90,70,']; }
    else if (h.atype === 'spin') { aF = Math.PI / 2 + 0.1; fF = aF; sab = aF; }
    if (h.power && !trail && h.atype !== 'spin') {}
    c.translate(0, bob);
    var sx = 1;
    if (h.atype === 'spin') { sx = Math.cos(at * TAU * 2); c.scale(sx >= 0 ? Math.max(0.15, sx) : Math.min(-0.15, sx), 1); }
    var hipX = 0, hipY = -58, shX = 2 + Math.sin(lean) * 46, shY = -104;
    c.save(); c.translate(hipX, hipY); c.rotate(lean * 0.6); c.translate(-hipX, -hipY);
    // back arm
    var ba = limb(c, shX - 8, shY + 4, aB, 22, fB, 21, 11, 10, [SKIN[1]]);
    c.fillStyle = poloD; c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); var bs = P(aB, 13); c.arc(shX - 8 + bs[0] * 0.5, shY + 4 + bs[1] * 0.5, 9, 0, TAU); c.fill(); c.stroke();
    if (h.gun) ART.gun(c, h.gun, ba[2], ba[3], fB + 1.4, h.muzzle);
    c.restore();
    // back leg
    var lb = limb(c, hipX - 4, hipY, tR, 30, sR, 29, 16, 14, [jean[1]]);
    ART.shoe(c, lb[2], lb[3], sR, true);
    // torso
    c.save(); c.translate(hipX, hipY); c.rotate(lean * 0.6);
    c.beginPath(); c.moveTo(-18, 2); c.lineTo(-21, -40); c.quadraticCurveTo(-20, -50, -8, -50); c.lineTo(12, -50); c.quadraticCurveTo(24, -49, 23, -38); c.lineTo(19, 2); c.closePath();
    c.fillStyle = polo; c.fill(); c.lineWidth = 3.5; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = poloD; c.beginPath(); c.moveTo(-18, 2); c.lineTo(-21, -40); c.lineTo(-12, -40); c.lineTo(-9, 2); c.closePath(); c.fill();
    c.strokeStyle = poloL; c.lineWidth = 2; c.beginPath(); c.moveTo(14, -44); c.lineTo(17, -6); c.stroke();
    c.strokeStyle = poloD; c.lineWidth = 2; c.beginPath(); c.moveTo(6, -48); c.lineTo(6, -30); c.stroke();
    c.fillStyle = '#0f1426'; c.beginPath(); c.arc(6, -40, 1.6, 0, TAU); c.arc(6, -34, 1.6, 0, TAU); c.fill();
    if (tag === 'dodo') { c.fillStyle = '#f2d24a'; for (var di = 0; di < 5; di++) { c.beginPath(); c.arc(-8 + (di % 3) * 10, -36 + Math.floor(di / 3) * 14, 3.2, 0, TAU); c.fill(); } c.fillStyle = '#7a3a16'; c.beginPath(); c.ellipse(6, -28, 5, 6, 0.2, 0, TAU); c.fill(); c.fillStyle = '#e8e0d0'; c.beginPath(); c.arc(4, -30, 1.6, 0, TAU); c.fill(); }
    if (tag === 'sega') { c.fillStyle = '#ffd23a'; c.fillRect(-18, -22, 38, 6); c.fillStyle = '#1a1a1a'; c.fillRect(-18, -18, 38, 2); }
    if (tag === 'army') { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 3; for (var ai = 0; ai < 4; ai++) { c.beginPath(); c.moveTo(-16, -44 + ai * 10); c.lineTo(16, -44 + ai * 10); c.stroke(); } c.fillStyle = '#2a3222'; rr(c, -8, -52, 16, 6, 2); c.fill(); }
    if (tag === 'tie') { c.fillStyle = '#7a1414'; c.beginPath(); c.moveTo(-2, -48); c.lineTo(4, -48); c.lineTo(6, -16); c.lineTo(1, -12); c.lineTo(-4, -16); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    c.fillStyle = jean[0]; c.strokeStyle = OUT; c.lineWidth = 3; rr(c, -19, -2, 39, 9, 3); c.fill(); c.stroke();
    c.fillStyle = '#3b2a1a'; c.fillRect(-18, -1, 37, 3);
    c.restore();
    // front leg
    var lf = limb(c, hipX + 4, hipY, tL, 30, sL, 29, 16, 14, [jean[0]]);
    ART.shoe(c, lf[2], lf[3], sL, false);
    // head (cartoon Kevin) - collar tucks into the polo
    var hi = IMG.heroHead;
    if (hi && hi.width) {
      var HH = 88, HW = HH * hi.width / hi.height;
      c.save(); c.translate(shX + 2, shY + 22 + (pose === 'run' ? Math.sin(p * 2) * 1.2 : 0)); c.rotate(lean * 0.7 + (pose === 'hurt' ? -0.25 : 0));
      c.drawImage(hi, -HW * 0.52, -HH, HW, HH);
      c.restore();
    }
    // front arm + sabre
    c.save(); c.translate(hipX, hipY); c.rotate(lean * 0.6); c.translate(-hipX, -hipY);
    var fa = limb(c, shX + 6, shY + 4, aF, 22, fF, 21, 11, 10, [SKIN[0]]);
    c.fillStyle = polo; c.strokeStyle = OUT; c.lineWidth = 3; var s1 = P(aF, 12); c.beginPath(); c.arc(shX + 6 + s1[0] * 0.45, shY + 4 + s1[1] * 0.45, 9.5, 0, TAU); c.fill(); c.stroke();
    if (trail) {
      var R = 88, a0 = trail[0], a1 = trail[1];
      c.save(); c.translate(shX + 6, shY + 4);
      for (var i = 0; i < 6; i++) {
        var k0 = lerp(a0, a1, i / 6), k1 = lerp(a0, a1, (i + 1) / 6);
        c.strokeStyle = trail[2] + (0.08 + 0.12 * i) + ')'; c.lineWidth = 6 + i * 2.5; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, R, Math.PI / 2 - k0, Math.PI / 2 - k1, k1 > k0); c.stroke();
      }
      c.restore();
    }
    var sLen = 66 + (h.power ? 26 : 0) + (h.bigSabre ? 44 : 0);
    ART.sabre(c, fa[2], fa[3], sab, sLen, h.power ? '#ffb020' : (h.bigSabre ? '#c0e8ff' : null));
    c.fillStyle = SKIN[0]; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.arc(fa[2], fa[3], 6, 0, TAU); c.fill(); c.stroke();
    c.restore();
    c.restore();
    if (h.atype === 'spin') { // whirlwind ring
      c.save(); c.translate(0, -70);
      for (var j = 0; j < 3; j++) { c.strokeStyle = 'rgba(255,' + (200 - j * 60) + ',' + (120 - j * 40) + ',' + (0.55 - j * 0.15) + ')'; c.lineWidth = 10 - j * 3;
        c.beginPath(); c.ellipse(0, 0, 120 + j * 14, 52 + j * 8, 0, at * 30 + j, at * 30 + j + 4.4); c.stroke(); }
      c.restore();
    }
  };
  ART.shoe = function (c, x, y, a, back) {
    c.save(); c.translate(x, y); c.rotate(-a * 0.5);
    c.fillStyle = back ? '#16161a' : '#232328'; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-8, -6); c.lineTo(8, -6); c.quadraticCurveTo(17, -4, 17, 3); c.lineTo(-9, 3); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#e8e4dc'; c.fillRect(-9, 1, 26, 3);
    c.restore();
  };

  // ---------------- HUMAN / ZOMBIE PUPPETS ----------------
  var SKINZ = ['#7f9670', '#86977a', '#6f8a66', '#8c9a6e'];
  var OUTFITS = {
    city: [['#e9e4d6', '#3a3d44', 'tie'], ['#a8312f', '#2c2f38'], ['#3b6aa8', '#4a4a4a'], ['#d9a640', '#2a2d33'], ['#6d4c8a', '#38332e']],
    swim: [['#skin', '#e0462f', 'trunks'], ['#skin', '#2f7de0', 'trunks'], ['#1d6e8f', '#1d6e8f', 'onepiece'], ['#b8325a', '#b8325a', 'onepiece'], ['#skin', '#f2b632', 'trunks']],
    hiker: [['#8f7d4f', '#5d5236', 'pack'], ['#4f7a4d', '#6b5a3c', 'pack'], ['#c0623a', '#3f3f46', 'pack']],
    tourist: [['#e85d8a', '#e9d9b4', 'hawaii hat camera'], ['#33b5c9', '#f0e0bf', 'hawaii cap camera'], ['#f3d23b', '#7b6f5a', 'hawaii hat'], ['#ffffff', '#3d6da8', 'cap camera']],
    fisher: [['#e9e9e9', '#2e3f5c', 'stripes'], ['#c43b30', '#3f4a3c', 'stripes'], ['#e2b33c', '#344055', 'oil']],
    cane: [['#7d3b32', '#4b4537', 'plaid straw'], ['#3f5f8a', '#5a4b38', 'plaid straw'], ['#d0c6a6', '#3e3a33', 'straw']]
  };
  ART.outfit = function (kind, seed) {
    if (kind === 'mix') { var ks = ['city', 'swim', 'hiker', 'tourist', 'fisher', 'cane']; kind = ks[Math.floor(hash(seed * 3.1) * ks.length)]; }
    var list = OUTFITS[kind] || OUTFITS.city; var o = list[Math.floor(hash(seed) * list.length)];
    return { shirt: o[0], pants: o[1], tags: o[2] || '', kind: kind };
  };
  // z: {type, phase, seed, skin, outfit, tr (turn 0..1 for turners), headless, stag}
  ART.zombie = function (c, z, opt) {
    opt = opt || {};
    var t = z.type, ph = z.phase || 0, seed = z.seed || 1;
    if (t === 'crawler') return crawler(c, z, opt);
    if (t === 'monkey') return monkey(c, z, opt);
    if (t === 'fish') return fish(c, z, opt);
    if (t === 'flyer') return flyer(c, z, opt);
    var human = z.tr !== undefined ? 1 - Math.min(1, z.tr) : 0; // 1 = fully human (turner before turning)
    var sc = z.scale || (t === 'brute' ? 1.32 : t === 'boss' ? 2.3 : t === 'tank' ? 1.5 : t === 'bloater' ? 1.28 : t === 'sprinter' ? 0.92 : 1);
    var o = z.outfit, skin = z.skin;
    if (t === 'sprinter') skin = mix(skin, '#a03028', 0.45);
    if (t === 'tank') skin = mix(skin, '#c8c070', 0.35);
    if (t === 'bloater') skin = mix(skin, '#c8d060', 0.5);
    if (t === 'spitter') skin = mix(skin, '#6adf40', 0.35);
    if (t === 'leaper') skin = mix(skin, '#6a4a8a', 0.4);
    if (human > 0) skin = mix(skin, z.humanSkin || '#b97a52', human);
    if (o.tags.indexOf('hawaii') >= 0 && human === 0) skin = mix(skin, '#c28a6a', 0.35); // sunburnt tourist
    var skinD = mix(skin, '#1b2416', 0.3);
    var hunch = lerp(t === 'sprinter' ? 0.22 : t === 'leaper' ? 0.5 : 0.42, 0.05, human), stag = z.stag > 0 ? Math.sin(z.stag * 30) * 0.15 - 0.25 : 0;
    c.save(); c.scale(sc, sc);
    if (t === 'sprinter') { c.scale(0.92, 1.04); }
    var limp = Math.sin(ph * (t === 'sprinter' ? 1.6 : 1)), limp2 = Math.sin(ph * (t === 'sprinter' ? 1.6 : 1) + Math.PI);
    var tA = limp * 0.45 - 0.05, sA = tA + 0.15 + Math.max(0, -Math.cos(ph)) * 0.5;
    var tB = limp2 * 0.25 + 0.1, sB = tB + 0.05; // dragging leg
    if (z.air) { tA = -0.6; sA = 0.2; tB = 0.5; sB = 1.0; }
    if (human > 0 && z.panic) { tA = Math.sin(ph * 2) * 0.8; sA = tA + 0.6; tB = -tA; sB = tB + 0.6; }
    var hipY = -60 + Math.abs(limp) * 2, pants = o.pants === '#skin' ? skin : o.pants, shirt = o.shirt === '#skin' ? skin : o.shirt;
    var onep = o.tags.indexOf('onepiece') >= 0, trunks = o.tags.indexOf('trunks') >= 0;
    var shorts = trunks || o.tags.indexOf('hawaii') >= 0 || o.kind === 'hiker' || o.kind === 'swim';
    // back leg (dragging) - facing LEFT so forward = -x : mirror angles
    c.save(); c.scale(-1, 1);
    var legCol = shorts || onep ? [skinD] : [mix(pants, '#000000', 0.25)];
    var lb = limb(c, 3, hipY, tB, 29, sB, 29, 14, 12, legCol);
    zfoot(c, lb[2], lb[3], skinD, o.kind === 'swim');
    c.restore();
    // back arm (reaching)
    var reach = lerp(1.45, 0.2, human) + Math.sin(ph * 0.5 + seed) * 0.12 + stag;
    if (human > 0 && z.panic) reach = 2.8 + Math.sin(ph * 2) * 0.3;
    c.save(); c.translate(0, hipY); c.rotate(-hunch - stag); c.translate(0, -hipY);
    c.save(); c.scale(-1, 1); limb(c, 4, hipY - 44, reach + 0.15, 22, reach + 0.05, 21, 10, 9, [skinD]); c.restore();
    c.restore();
    // shorts/trousers top + torso
    c.save(); c.translate(0, hipY); c.rotate(-hunch - stag);
    // torso shape with torn hem
    var top = -48;
    c.beginPath(); c.moveTo(-17, top + 4); c.quadraticCurveTo(-18, top - 2, -8, top - 3); c.lineTo(10, top - 3); c.quadraticCurveTo(19, top - 1, 18, top + 6); c.lineTo(17, 0); c.lineTo(-16, 0); c.closePath();
    c.fillStyle = skin; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3.5; c.stroke();
    if (!trunks) { // shirt / swimsuit with torn jagged hem
      c.beginPath(); c.moveTo(-17, top + 4); c.quadraticCurveTo(-18, top - 2, -8, top - 3); c.lineTo(10, top - 3); c.quadraticCurveTo(19, top - 1, 18, top + 6);
      var hemY = onep ? 6 : -4;
      c.lineTo(17, hemY);
      for (var i = 0; i <= 7; i++) { var hx = 17 - i * 4.8; c.lineTo(hx, hemY + (i % 2 ? -6 - hash(seed + i) * 5 : 2)); }
      c.lineTo(-16, hemY); c.closePath();
      c.fillStyle = shirt; c.fill(); c.strokeStyle = OUT; c.lineWidth = 3; c.stroke();
      // rips showing skin
      c.fillStyle = skinD; c.beginPath(); c.ellipse(4 + hash(seed) * 6, -26, 4, 6, 0.4, 0, TAU); c.fill();
      c.fillStyle = 'rgba(110,20,20,0.75)'; c.beginPath(); c.ellipse(-6 + hash(seed * 2) * 8, -14, 5, 3, 0.2, 0, TAU); c.fill();
      if (o.tags.indexOf('stripes') >= 0) { c.strokeStyle = '#2a3a6a'; c.lineWidth = 3; for (var s = 0; s < 4; s++) { c.beginPath(); c.moveTo(-16, -40 + s * 9); c.lineTo(17, -40 + s * 9); c.stroke(); } }
      if (o.tags.indexOf('hawaii') >= 0) { for (var f = 0; f < 7; f++) { c.fillStyle = f % 2 ? '#fff3a0' : '#3fbf6a'; c.beginPath(); c.arc(-12 + hash(seed + f) * 26, -42 + hash(seed + f * 3) * 34, 3, 0, TAU); c.fill(); } }
      if (o.tags.indexOf('plaid') >= 0) { c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; for (var q = 0; q < 4; q++) { c.beginPath(); c.moveTo(-14 + q * 9, -48); c.lineTo(-14 + q * 9, -4); c.stroke(); c.beginPath(); c.moveTo(-16, -40 + q * 9); c.lineTo(17, -40 + q * 9); c.stroke(); } }
      if (o.tags.indexOf('tie') >= 0) { c.fillStyle = '#7a1414'; c.beginPath(); c.moveTo(-9, -48); c.lineTo(-5, -48); c.lineTo(-3, -24); c.lineTo(-8, -20); c.lineTo(-11, -26); c.closePath(); c.fill(); }
      if (o.tags.indexOf('oil') >= 0) { c.fillStyle = 'rgba(30,30,30,0.35)'; c.fillRect(-16, -48, 34, 46); }
    } else { // bare rotten torso: ribs + belly wound
      c.strokeStyle = skinD; c.lineWidth = 2; for (var r = 0; r < 4; r++) { c.beginPath(); c.arc(2, -30 + r * 6, 11, Math.PI * 0.1, Math.PI * 0.9); c.stroke(); }
      c.fillStyle = 'rgba(120,20,20,0.7)'; c.beginPath(); c.ellipse(5, -10, 6, 4, 0, 0, TAU); c.fill();
    }
    if (t === 'tank' || t === 'bloater') {
      c.fillStyle = mix(skin, t === 'bloater' ? '#8a9a30' : '#6a6a40', 0.2);
      c.strokeStyle = OUT; c.lineWidth = 3.5;
      c.beginPath(); c.ellipse(2, 4, t === 'bloater' ? 28 : 24, t === 'bloater' ? 22 : 18, 0.1, 0, TAU); c.fill(); c.stroke();
      if (t === 'bloater') {
        c.strokeStyle = 'rgba(80,20,20,0.7)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(-10, -4); c.quadraticCurveTo(2, 10, 16, 0); c.stroke();
        c.fillStyle = 'rgba(90,140,30,0.55)'; c.beginPath(); c.ellipse(6, 8, 8, 6, 0, 0, TAU); c.fill();
        if (z.fuse) { c.fillStyle = 'rgba(255,80,20,' + (0.3 + 0.5 * Math.abs(Math.sin((z.fuseT || 0) * 20))) + ')'; c.beginPath(); c.ellipse(2, 4, 30, 24, 0, 0, TAU); c.fill(); }
      }
    }
    if (o.tags.indexOf('pack') >= 0) { c.fillStyle = '#5b3a24'; c.strokeStyle = OUT; c.lineWidth = 3; rr(c, 14, -46, 12, 34, 4); c.fill(); c.stroke(); }
    // waistband / shorts
    c.fillStyle = trunks ? pants : onep ? shirt : pants; c.strokeStyle = OUT; c.lineWidth = 3; rr(c, -17, -4, 35, 10, 3); c.fill(); c.stroke();
    if (trunks) { c.fillStyle = 'rgba(255,255,255,0.5)'; for (var d = 0; d < 4; d++) { c.beginPath(); c.arc(-11 + d * 8, 1, 1.8, 0, TAU); c.fill(); } }
    if (o.tags.indexOf('camera') >= 0) { c.strokeStyle = '#222'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-10, -47); c.lineTo(-12, -26); c.moveTo(6, -47); c.lineTo(-4, -26); c.stroke();
      c.fillStyle = '#2b2b2f'; c.strokeStyle = OUT; c.lineWidth = 2; rr(c, -16, -30, 15, 10, 2); c.fill(); c.stroke(); c.fillStyle = '#7fb4ff'; c.beginPath(); c.arc(-8.5, -25, 3, 0, TAU); c.fill(); }
    // neck stump / head
    var neckX = -6, neckY = top - 1;
    if (!z.headless && !opt.noHead) ART.zhead(c, z, neckX, neckY, human);
    else if (z.headless) { // blood fountain stump
      c.fillStyle = '#8a0b0b'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.ellipse(neckX, neckY, 9, 4, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#e8d9c0'; c.beginPath(); c.arc(neckX, neckY, 2.4, 0, TAU); c.fill();
    }
    c.restore();
    // front leg
    c.save(); c.scale(-1, 1);
    var legCol2 = shorts || onep ? [skin] : [pants];
    if ((shorts && !onep) && !trunks) { var lf0 = limb(c, -3, hipY, tA, 29, sA, 29, 14, 12, [skin]); c.fillStyle = pants; c.strokeStyle = OUT; c.lineWidth = 3; c.save(); c.translate(-3, hipY); c.rotate(-tA); rr(c, -9, -2, 18, 16, 3); c.fill(); c.stroke(); c.restore(); zfoot(c, lf0[2], lf0[3], skin, o.kind === 'swim'); }
    else { var lf = limb(c, -3, hipY, tA, 29, sA, 29, 14, 12, legCol2); zfoot(c, lf[2], lf[3], skin, o.kind === 'swim'); }
    c.restore();
    // front arm reaching
    c.save(); c.translate(0, hipY); c.rotate(-hunch - stag); c.translate(0, -hipY);
    var reach2 = lerp(1.6, -0.15, human) + Math.sin(ph * 0.5 + seed + 1.3) * 0.15 + stag;
    if (human > 0 && z.panic) reach2 = 2.9 + Math.sin(ph * 2 + 1) * 0.3;
    c.save(); c.scale(-1, 1);
    var ar = limb(c, -6, hipY - 44, reach2, 22, reach2 - 0.1, 21, 10, 9, [skin]);
    // clawed hand
    c.fillStyle = skin; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.arc(ar[2], ar[3], 5.5, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2; for (var k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(ar[2] + 3, ar[3] + k * 3); c.lineTo(ar[2] + 9, ar[3] + k * 4 + 2); c.stroke(); }
    if (!trunks && !onep) { c.fillStyle = shirt; c.strokeStyle = OUT; c.lineWidth = 2.5; var sh = P(reach2, 10); c.beginPath(); c.arc(-6 + sh[0] * 0.6, hipY - 44 + sh[1] * 0.6, 8.5, 0, TAU); c.fill(); c.stroke(); }
    if (t === 'helmet') {
      c.fillStyle = '#8a94a0'; c.strokeStyle = OUT; c.lineWidth = 3;
      c.beginPath(); c.moveTo(ar[2] - 4, ar[3] + 4); c.lineTo(ar[2] - 28, ar[3] - 22); c.lineTo(ar[2] - 28, ar[3] + 28); c.lineTo(ar[2] - 4, ar[3] + 16); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(ar[2] - 10, ar[3] - 8); c.lineTo(ar[2] - 10, ar[3] + 14); c.stroke();
    }
    if (t === 'spitter') {
      c.fillStyle = '#7dff3a'; c.globalAlpha = 0.85;
      c.beginPath(); c.ellipse(ar[2] - 18, hipY - 70, 6, 4, 0, 0, TAU); c.fill();
      c.globalAlpha = 1;
    }
    c.restore(); c.restore();
    c.restore();
  };
  function zfoot(c, x, y, skin, bare) {
    c.fillStyle = bare ? skin : '#3b3027'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    c.beginPath(); c.ellipse(x + 5, y - 2, 10, 5, 0, 0, TAU); c.fill(); c.stroke();
  }
  // head for walkers / brutes (generated zombie art) or a cartoon human head for turners
  ART.zhead = function (c, z, nx, ny, human) {
    var key = z.head || 'zHead0', im = IMG[key];
    var H = key === 'zHead2' ? 64 : 60;
    c.save(); c.translate(nx, ny); c.rotate(z.headTilt || 0);
    if (human > 0.5) { ART.humanHead(c, z); }
    else if (im && im.width) {
      var W = H * im.width / im.height;
      if (human > 0) { c.globalAlpha = 1; }
      c.drawImage(im, -W * 0.55, -H * 0.93, W, H);
      if (z.type === 'boss') { c.fillStyle = 'rgba(255,0,0,0.85)'; c.shadowColor = '#ff0000'; c.shadowBlur = 12; c.beginPath(); c.arc(-W * 0.3, -H * 0.58, 3.5, 0, TAU); c.fill(); c.shadowBlur = 0; }
    }
    var tags = z.outfit ? z.outfit.tags : '';
    if (tags.indexOf('hat') >= 0 || tags.indexOf('straw') >= 0) {
      var straw = tags.indexOf('straw') >= 0;
      c.fillStyle = straw ? '#d8b860' : '#f1e3b4'; c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(-4, -H * 0.86, 25, 6, -0.12, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-2, -H * 0.93, 14, 10, -0.12, Math.PI, TAU); c.fill(); c.stroke();
      c.fillStyle = straw ? '#8a3a2a' : '#e04a6a'; c.fillRect(-15, -H * 0.92, 25, 4);
    } else if (tags.indexOf('cap') >= 0) {
      c.fillStyle = '#d23a3a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(-2, -H * 0.85, 16, 11, -0.1, Math.PI, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-18, -H * 0.84, 11, 3.5, -0.1, 0, TAU); c.fill(); c.stroke();
    }
    if (z.type === 'helmet') {
      c.fillStyle = '#e2b23a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(-2, -H * 0.88, 20, 12, -0.08, Math.PI, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-4, -H * 0.8, 24, 5, -0.08, 0, TAU); c.fill(); c.stroke();
    }
    if (z.type === 'spitter') {
      c.fillStyle = '#7dff3a';
      c.beginPath(); c.ellipse(-14, -H * 0.22, 5, 3, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-10, -H * 0.05, 2.4, 4, 0.2, 0, TAU); c.fill();
    }
    c.restore();
  };
  ART.humanHead = function (c, z) {
    var s = z.humanSkin || '#b97a52', hair = z.hair || '#2a1c14';
    c.fillStyle = s; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-2, 0); c.lineTo(-4, -10); c.lineTo(6, -10); c.lineTo(5, 0); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-2, -30, 19, 22, 0, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = hair; c.beginPath(); c.ellipse(1, -44, 19, 11, 0.2, Math.PI * 0.95, TAU * 1.02); c.fill();
    c.beginPath(); c.ellipse(10, -36, 9, 14, 0.2, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(-12, -32, 5, 6, 0, 0, TAU); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(-13, -32, 2.6, 0, TAU); c.fill();
    c.strokeStyle = '#3b1d14'; c.lineWidth = 2; c.beginPath(); c.ellipse(-12, -18, 5, z.panic ? 5 : 2, 0, 0, TAU); c.stroke();
    c.fillStyle = mix(s, '#000000', 0.15); c.beginPath(); c.ellipse(9, -29, 4, 6, 0, 0, TAU); c.fill();
  };
  function crawler(c, z, opt) {
    var ph = z.phase || 0, skin = z.skin, skinD = mix(skin, '#1b2416', 0.3), o = z.outfit;
    c.save();
    // legs trailing behind (to the right)
    c.save(); c.scale(-1, 1);
    limb(c, -40, -12, -1.5 + Math.sin(ph) * 0.1, 26, -1.65, 24, 12, 10, [mix(o.pants === '#skin' ? skin : o.pants, '#000000', 0.2)]);
    c.restore();
    // torso horizontal
    c.fillStyle = o.shirt === '#skin' ? skin : o.shirt; c.strokeStyle = OUT; c.lineWidth = 3.5;
    c.beginPath(); c.moveTo(-14, -30); c.quadraticCurveTo(10, -38, 38, -24); c.lineTo(40, -8);
    for (var i = 0; i < 7; i++) c.lineTo(36 - i * 7, -6 + (i % 2) * 5);
    c.lineTo(-14, -12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(110,20,20,0.7)'; c.beginPath(); c.ellipse(16, -20, 6, 4, 0, 0, TAU); c.fill();
    // arms pulling
    var a1 = 1.9 + Math.sin(ph) * 0.5, a2 = 1.9 + Math.sin(ph + Math.PI) * 0.5;
    c.save(); c.scale(-1, 1);
    limb(c, 10, -24, a2, 20, a2 + 0.9, 20, 9, 8, [skinD]);
    limb(c, 14, -24, a1, 20, a1 + 0.9, 20, 9, 8, [skin]);
    c.restore();
    if (!z.headless && !opt.noHead) ART.zhead(c, z, -16, -22, 0);
    else if (z.headless) { c.fillStyle = '#8a0b0b'; c.beginPath(); c.ellipse(-15, -21, 4, 8, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  function monkey(c, z, opt) {
    var ph = z.phase || 0, tr = Math.min(1, z.tr || 0);
    var fur = mix('#7a5636', '#6e7d5a', tr), furD = mix('#4e3522', '#47553a', tr), face = mix('#d9a77c', '#9aa883', tr);
    c.save(); c.scale(1.05, 1.05);
    // tail
    c.strokeStyle = OUT; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(16, -22); c.bezierCurveTo(40, -20, 36, -60 + Math.sin(ph) * 8, 24, -58); c.stroke();
    c.strokeStyle = fur; c.lineWidth = 4; c.stroke();
    var air = z.air;
    c.save(); c.scale(-1, 1);
    limb(c, -12, -22, air ? -1.2 : Math.sin(ph) * 0.6 - 0.2, 14, air ? -0.6 : 0.4, 13, 8, 7, [furD]);
    limb(c, 10, -26, air ? 2.4 : Math.sin(ph + 2) * 0.6 + 0.4, 13, air ? 2.0 : 0.2, 13, 7, 6, [furD]);
    c.restore();
    c.fillStyle = fur; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.ellipse(2, -28, 20, 13, -0.15, 0, TAU); c.fill(); c.stroke();
    c.save(); c.scale(-1, 1);
    limb(c, -14, -22, air ? -1.0 : Math.sin(ph + 1) * 0.6, 14, air ? -0.3 : 0.5, 13, 8, 7, [fur]);
    limb(c, 8, -30, air ? 2.6 : Math.sin(ph + 3) * 0.6 + 0.6, 13, air ? 2.2 : 0.3, 13, 7, 6, [fur]);
    c.restore();
    if (!z.headless && !opt.noHead) ART.monkeyHead(c, z, -16, -34, fur, face, tr);
    else if (z.headless) { c.fillStyle = '#8a0b0b'; c.beginPath(); c.ellipse(-15, -34, 5, 7, 0, 0, TAU); c.fill(); }
    c.restore();
  }
  ART.monkeyHead = function (c, z, x, y, fur, face, tr) {
    c.save(); c.translate(x, y);
    c.fillStyle = fur; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.arc(0, -6, 14, 0, TAU); c.fill(); c.stroke();
    c.beginPath(); c.arc(10, -14, 5, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = face; c.beginPath(); c.ellipse(-5, -4, 9, 8, 0, 0, TAU); c.fill(); c.stroke();
    var eye = tr > 0.5 ? '#ffe14a' : '#2a1a10';
    if (tr > 0.5) { c.shadowColor = '#ff3'; c.shadowBlur = 8; }
    c.fillStyle = eye; c.beginPath(); c.arc(-8, -8, 2.6, 0, TAU); c.arc(-2, -8, 2.6, 0, TAU); c.fill(); c.shadowBlur = 0;
    c.fillStyle = tr > 0.5 ? '#3a0a0a' : '#5a3020'; c.beginPath(); c.ellipse(-7, 0, 4, tr > 0.5 ? 4 : 1.5, 0, 0, TAU); c.fill();
    if (tr > 0.5) { c.fillStyle = '#fff'; c.fillRect(-10, -2, 2, 3); c.fillRect(-6, -2, 2, 3); }
    c.restore();
  };
  function fish(c, z, opt) {
    var tr = Math.min(1, z.tr || 0), ph = z.phase || 0;
    var body = mix('#f08a2a', '#7c9a6e', tr), fin = mix('#ffd34a', '#4f6a44', tr);
    c.save(); c.rotate(z.rot || 0);
    c.fillStyle = fin; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.moveTo(22, 0); c.lineTo(42, -14 + Math.sin(ph * 3) * 4); c.lineTo(40, 14 + Math.sin(ph * 3) * 4); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-4, -14); c.lineTo(10, -26); c.lineTo(16, -12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 26, 15, 0, 0, TAU); c.fill(); c.stroke();
    if (tr < 0.5) { c.fillStyle = '#ffffff'; c.globalAlpha = 0.8; c.fillRect(-2, -14, 5, 28); c.fillRect(10, -12, 4, 24); c.globalAlpha = 1; }
    else { c.strokeStyle = 'rgba(30,40,25,0.8)'; c.lineWidth = 2; for (var i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-6 + i * 6, -12); c.lineTo(-6 + i * 6, 12); c.stroke(); } c.fillStyle = 'rgba(120,20,20,0.8)'; c.beginPath(); c.ellipse(6, 4, 5, 3, 0, 0, TAU); c.fill(); }
    if (!z.headless && !opt.noHead) {
      if (tr > 0.5) { c.shadowColor = '#ff3'; c.shadowBlur = 10; }
      c.fillStyle = tr > 0.5 ? '#ffe14a' : '#ffffff'; c.beginPath(); c.arc(-14, -4, 5, 0, TAU); c.fill(); c.shadowBlur = 0; c.fillStyle = '#111'; c.beginPath(); c.arc(-15, -4, 2.2, 0, TAU); c.fill();
      c.fillStyle = tr > 0.5 ? '#3a0a0a' : '#c0602a'; c.beginPath(); c.moveTo(-26, 2); c.lineTo(-16, 4); c.lineTo(-26, 8); c.closePath(); c.fill();
      if (tr > 0.5) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(-25, 2); c.lineTo(-23, 6); c.lineTo(-21, 2); c.lineTo(-19, 6); c.lineTo(-17, 3); c.fill(); }
    } else if (z.headless) { c.fillStyle = '#8a0b0b'; c.beginPath(); c.ellipse(-12, 0, 4, 12, 0, 0, TAU); c.fill(); }
    c.restore();
  }

  // ---------------- OBSTACLES ----------------
  // each: w, h (hitbox from ground), high (overhead: hitbox y from -h2 to -h)
  function flyer(c, z, opt) {
    opt = opt || {};
    var ph = z.phase || 0, gull = z.flyer !== 'bat', flap = Math.sin(ph * 8) * 0.7;
    c.save();
    if (z.rot) c.rotate(z.rot);
    // wings
    c.fillStyle = gull ? '#e8e0d0' : '#2a1a28'; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(-30, -18 + flap * 24, -58, -6 + flap * 36); c.quadraticCurveTo(-24, 2, 0, 4); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(0, -8); c.quadraticCurveTo(28, -22 - flap * 24, 62, -8 - flap * 34); c.quadraticCurveTo(24, 2, 0, 4); c.closePath(); c.fill(); c.stroke();
    if (gull) { c.fillStyle = '#3a3a40'; c.beginPath(); c.moveTo(-20, -8); c.lineTo(-48, -4 + flap * 20); c.lineTo(-16, 0); c.fill(); }
    // body
    c.fillStyle = gull ? '#d8d0c4' : '#3a2434'; c.strokeStyle = OUT; c.lineWidth = 3;
    c.beginPath(); c.ellipse(4, 2, 16, 10, 0.15, 0, TAU); c.fill(); c.stroke();
    // tail
    c.beginPath(); c.moveTo(16, 0); c.lineTo(28, -8); c.lineTo(26, 6); c.closePath(); c.fill(); c.stroke();
    // zombie head
    if (!z.headless && !opt.noHead) {
      c.save(); c.translate(-10, -4); c.scale(0.7, 0.7); ART.zhead(c, z, 0, 0, 0); c.restore();
    } else if (z.headless) { c.fillStyle = '#8a0b0b'; c.beginPath(); c.ellipse(-10, -4, 6, 4, 0, 0, TAU); c.fill(); }
    // beak / fangs
    if (gull) { c.fillStyle = '#e8a020'; c.beginPath(); c.moveTo(-22, 2); c.lineTo(-34, 6); c.lineTo(-22, 8); c.closePath(); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
    c.restore();
  }

  ART.gun = function (c, kind, x, y, ang, flash) {
    c.save(); c.translate(x, y); c.rotate(-(ang || 0));
    c.fillStyle = '#2a2a2e'; c.strokeStyle = OUT; c.lineWidth = 2.5;
    if (kind === 'pistol') {
      rr(c, -4, -6, 28, 7, 2); c.fill(); c.stroke();
      c.fillStyle = '#3a2a1a'; rr(c, -2, 0, 7, 12, 2); c.fill(); c.stroke();
    } else if (kind === 'shotgun') {
      c.fillStyle = '#5a3a1a'; rr(c, -8, -7, 44, 8, 2); c.fill(); c.stroke();
      c.fillStyle = '#2a2a2e'; rr(c, 20, -6, 18, 6, 1); c.fill(); c.stroke();
      c.fillStyle = '#3a2a1a'; rr(c, -6, 0, 9, 13, 2); c.fill(); c.stroke();
    } else { // rocket
      c.fillStyle = '#3a4a32'; rr(c, -10, -9, 48, 12, 3); c.fill(); c.stroke();
      c.fillStyle = '#8a2a1a'; c.beginPath(); c.moveTo(38, -9); c.lineTo(54, 0); c.lineTo(38, 9); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2a2a2e'; rr(c, -8, 2, 10, 12, 2); c.fill(); c.stroke();
    }
    if (flash) {
      c.fillStyle = '#fff3a0'; c.globalAlpha = 0.95;
      c.beginPath(); c.moveTo(kind === 'pistol' ? 24 : 48, 0); c.lineTo(70, -10); c.lineTo(62, 0); c.lineTo(70, 10); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
  };

  ART.vehicle = function (c, kind, t, flash) {
    t = t || 0;
    c.save(); c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = 3.5;
    if (flash) c.globalAlpha = 0.7;
    function wheel(x, y, r) {
      c.fillStyle = '#1a1a1c'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#6a6a70'; c.beginPath(); c.arc(x, y, r * 0.45, 0, TAU); c.fill();
    }
    if (kind === 'jeep') {
      c.fillStyle = '#3d5a28'; rr(c, -70, -44, 128, 36, 6); c.fill(); c.stroke();
      c.fillStyle = '#2a3e1c'; rr(c, -20, -70, 62, 30, 5); c.fill(); c.stroke();
      c.fillStyle = 'rgba(160,210,255,0.45)'; rr(c, -12, -66, 24, 20, 3); c.fill(); c.stroke();
      c.fillStyle = '#c9a03a'; rr(c, 48, -40, 14, 8, 2); c.fill();
      c.fillStyle = '#2a2a2e'; rr(c, 30, -80, 22, 10, 2); c.fill(); c.stroke(); // rocket rack
      c.fillStyle = '#8a2a1a'; rr(c, 32, -88, 6, 12, 1); c.fill(); rr(c, 42, -88, 6, 12, 1); c.fill();
      wheel(-44, -6, 14); wheel(40, -6, 14);
    } else if (kind === 'quad') {
      c.fillStyle = '#2a3a4a'; rr(c, -56, -36, 100, 26, 6); c.fill(); c.stroke();
      c.fillStyle = '#1a242e'; rr(c, -16, -52, 36, 20, 4); c.fill(); c.stroke();
      c.fillStyle = '#c9a03a'; c.fillRect(-8, -58, 20, 5);
      wheel(-38, -6, 13); wheel(32, -6, 13);
      c.fillStyle = '#8a2a1a'; rr(c, 24, -62, 16, 8, 2); c.fill(); c.stroke();
    } else if (kind === 'tractor') {
      c.fillStyle = '#c43b1e'; rr(c, -60, -50, 100, 40, 6); c.fill(); c.stroke();
      c.fillStyle = '#f0ead0'; rr(c, -20, -86, 46, 40, 4); c.fill(); c.stroke();
      c.fillStyle = 'rgba(160,210,255,0.4)'; rr(c, -12, -80, 28, 22, 3); c.fill(); c.stroke();
      c.fillStyle = '#2a2a2e'; rr(c, 30, -70, 20, 12, 2); c.fill(); c.stroke();
      wheel(-36, -4, 22); wheel(40, -2, 14);
    } else if (kind === 'jetski') {
      c.fillStyle = '#d4202a'; c.beginPath(); c.moveTo(-70, 0); c.quadraticCurveTo(-60, -28, 10, -30); c.lineTo(66, -10); c.quadraticCurveTo(74, 0, 60, 8); c.lineTo(-50, 8); c.quadraticCurveTo(-74, 6, -70, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#1a1a20'; rr(c, -16, -28, 36, 14, 4); c.fill(); c.stroke();
      c.fillStyle = '#c9a03a'; rr(c, 20, -36, 18, 8, 2); c.fill(); c.stroke();
      c.fillStyle = '#8a2a1a'; rr(c, 36, -44, 14, 8, 2); c.fill();
      c.fillStyle = 'rgba(180,230,255,0.35)'; c.beginPath(); c.ellipse(-20, 10, 30, 5, 0, 0, TAU); c.fill();
    } else { // speedboat
      c.fillStyle = '#d8d2c4'; c.beginPath(); c.moveTo(-90, 4); c.quadraticCurveTo(-70, -22, 20, -26); c.lineTo(80, -8); c.quadraticCurveTo(90, 2, 70, 10); c.lineTo(-70, 10); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#2a3a5c'; rr(c, -20, -44, 50, 22, 4); c.fill(); c.stroke();
      c.fillStyle = 'rgba(160,210,255,0.4)'; rr(c, -10, -40, 28, 14, 3); c.fill(); c.stroke();
      c.fillStyle = '#8a2a1a'; rr(c, 40, -36, 22, 10, 2); c.fill(); c.stroke();
      c.fillStyle = '#1a2a44'; c.fillRect(-80, 2, 140, 6);
    }
    c.restore();
  };

  ART.weaponIcon = function (c, kind, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s || 1, s || 1);
    if (kind === 'sabre' || kind === 'bigSabre') ART.sabre(c, 0, 8, Math.PI * 0.85, 44, '#c0e8ff');
    else ART.gun(c, kind === 'rocket' ? 'rocket' : kind, -8, 0, -0.15, false);
    c.restore();
  };

  ART.OBST = {
    crate: { w: 56, h: 56 }, barrel: { w: 44, h: 60 }, bollard: { w: 26, h: 44 }, rock: { w: 64, h: 46 }, sandcastle: { w: 60, h: 44 },
    pirogue: { w: 130, h: 42 }, log: { w: 96, h: 40 }, roots: { w: 70, h: 30 }, lounger: { w: 100, h: 40 }, cooler: { w: 50, h: 40 },
    net: { w: 70, h: 34 }, bundle: { w: 86, h: 42 }, stones: { w: 76, h: 40 }, cart: { w: 110, h: 58 }, driftwood: { w: 110, h: 34 },
    banner: { w: 120, high: 78 }, parasol: { w: 120, high: 78 }, branch: { w: 130, high: 80 }, overhang: { w: 150, high: 80 },
    boom: { w: 160, high: 80 }, pipe: { w: 140, high: 80 }, palmleaf: { w: 140, high: 78 }
  };
  ART.obstacle = function (c, o, t) {
    var k = o.kind; c.save(); c.lineJoin = 'round'; c.strokeStyle = OUT; c.lineWidth = 3;
    var d = ART.OBST[k];
    switch (k) {
      case 'crate': c.fillStyle = '#a8743c'; rr(c, -28, -56, 56, 56, 4); c.fill(); c.stroke(); c.strokeStyle = '#6e4620'; c.lineWidth = 4; c.beginPath(); c.moveTo(-24, -52); c.lineTo(24, -4); c.moveTo(24, -52); c.lineTo(-24, -4); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 3; c.strokeRect(-24, -52, 48, 48); c.fillStyle = '#000'; c.font = 'bold 10px sans-serif'; c.fillText('MU', -9, -26); break;
      case 'barrel': c.fillStyle = o.alt ? '#c0452b' : '#2f6fb0'; rr(c, -22, -60, 44, 60, 8); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(-14, -58, 8, 56); c.strokeStyle = 'rgba(0,0,0,0.5)'; c.beginPath(); c.moveTo(-22, -40); c.lineTo(22, -40); c.moveTo(-22, -20); c.lineTo(22, -20); c.stroke(); c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(0, -36); c.lineTo(7, -24); c.lineTo(-7, -24); c.fill(); break;
      case 'bollard': c.fillStyle = '#2c2c30'; rr(c, -13, -44, 26, 44, 8); c.fill(); c.stroke(); c.fillStyle = '#d6b23a'; c.fillRect(-13, -36, 26, 6); break;
      case 'rock': case 'stones':
        c.fillStyle = k === 'stones' ? '#3d3b3d' : '#6b625a'; c.beginPath(); c.moveTo(-32, 0); c.lineTo(-28, -30); c.lineTo(-8, -46); c.lineTo(16, -40); c.lineTo(32, -18); c.lineTo(32, 0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.moveTo(-24, -28); c.lineTo(-8, -42); c.lineTo(-4, -30); c.fill();
        if (k === 'stones') { c.fillStyle = '#4a4648'; for (var s = 0; s < 3; s++) { c.beginPath(); c.arc(-24 + s * 24, -8, 12, 0, TAU); c.fill(); c.stroke(); } }
        else { c.fillStyle = '#4e7a3a'; c.beginPath(); c.ellipse(-10, -42, 12, 4, -0.4, 0, TAU); c.fill(); }
        break;
      case 'sandcastle': c.fillStyle = '#e8cf8a'; c.fillRect(-30, -28, 60, 28); c.strokeRect(-30, -28, 60, 28); c.fillRect(-12, -44, 24, 16); c.strokeRect(-12, -44, 24, 16); c.fillStyle = '#d23a3a'; c.beginPath(); c.moveTo(0, -44); c.lineTo(0, -60); c.lineTo(10, -55); c.lineTo(0, -52); c.fill(); c.stroke(); break;
      case 'pirogue': c.fillStyle = '#2d78c0'; c.beginPath(); c.moveTo(-65, -36); c.quadraticCurveTo(0, -30, 65, -42); c.quadraticCurveTo(50, 0, 0, 0); c.quadraticCurveTo(-50, 0, -65, -36); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#f0d040'; c.fillRect(-55, -30, 110, 6); c.fillStyle = '#d23a3a'; c.fillRect(-48, -20, 96, 4); break;
      case 'log': c.fillStyle = '#6a4526'; rr(c, -48, -40, 96, 40, 18); c.fill(); c.stroke(); c.fillStyle = '#c99a62'; c.beginPath(); c.ellipse(40, -20, 10, 18, 0, 0, TAU); c.fill(); c.stroke(); c.strokeStyle = '#8a6234'; c.beginPath(); c.ellipse(40, -20, 4, 9, 0, 0, TAU); c.stroke(); c.fillStyle = '#4f7a3a'; c.beginPath(); c.ellipse(-20, -40, 16, 5, 0, 0, TAU); c.fill(); break;
      case 'roots': c.strokeStyle = '#4a2f1a'; c.lineWidth = 9; c.lineCap = 'round'; for (var r = 0; r < 3; r++) { c.beginPath(); c.moveTo(-35 + r * 10, 0); c.quadraticCurveTo(-10 + r * 15, -40, 35 - r * 5, 0); c.stroke(); } break;
      case 'lounger': c.fillStyle = '#ffffff'; c.strokeStyle = OUT; c.beginPath(); c.moveTo(-50, -22); c.lineTo(28, -22); c.lineTo(50, -42); c.lineTo(56, -36); c.lineTo(34, -14); c.lineTo(-50, -14); c.closePath(); c.fill(); c.stroke(); c.fillStyle = o.alt ? '#2f9ad8' : '#e8504a'; c.fillRect(-46, -21, 72, 5); c.strokeStyle = '#ddd'; c.lineWidth = 3; c.beginPath(); c.moveTo(-44, -14); c.lineTo(-44, 0); c.moveTo(26, -14); c.lineTo(26, 0); c.stroke(); break;
      case 'cooler': c.fillStyle = '#e84a3a'; rr(c, -25, -40, 50, 40, 5); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(-25, -40, 50, 10); c.strokeRect(-25, -40, 50, 10); break;
      case 'net': c.fillStyle = '#7b6a45'; c.beginPath(); c.ellipse(0, -16, 35, 17, 0, Math.PI, TAU); c.fill(); c.stroke(); c.strokeStyle = 'rgba(30,20,10,0.6)'; c.lineWidth = 1.5; for (var n = -30; n < 30; n += 8) { c.beginPath(); c.moveTo(n, -2); c.lineTo(n + 10, -30); c.stroke(); } c.fillStyle = '#e0a030'; c.beginPath(); c.arc(14, -26, 5, 0, TAU); c.fill(); break;
      case 'bundle': for (var b = 0; b < 9; b++) { c.strokeStyle = OUT; c.lineWidth = 8; c.beginPath(); c.moveTo(-43, -6 - b * 4); c.lineTo(43, -4 - b * 4); c.stroke(); c.strokeStyle = b % 2 ? '#c9b45a' : '#a99a48'; c.lineWidth = 5; c.stroke(); } c.strokeStyle = '#5a3a20'; c.lineWidth = 4; c.beginPath(); c.moveTo(-20, -2); c.lineTo(-20, -42); c.moveTo(20, -2); c.lineTo(20, -42); c.stroke(); break;
      case 'cart': c.fillStyle = '#8a5a30'; c.fillRect(-55, -58, 110, 36); c.strokeRect(-55, -58, 110, 36); c.fillStyle = '#c9b45a'; for (var q = 0; q < 6; q++) c.fillRect(-52 + q * 18, -70, 14, 14); c.fillStyle = '#2a2a2a'; c.beginPath(); c.arc(-30, -14, 14, 0, TAU); c.arc(30, -14, 14, 0, TAU); c.fill(); c.stroke(); c.fillStyle = '#888'; c.beginPath(); c.arc(-30, -14, 5, 0, TAU); c.arc(30, -14, 5, 0, TAU); c.fill(); break;
      case 'driftwood': c.fillStyle = '#9c8b74'; c.beginPath(); c.moveTo(-55, -10); c.quadraticCurveTo(-10, -40, 55, -24); c.lineTo(52, -8); c.quadraticCurveTo(0, -14, -55, 0); c.closePath(); c.fill(); c.stroke(); c.beginPath(); c.moveTo(10, -26); c.lineTo(24, -48); c.lineTo(30, -44); c.lineTo(20, -24); c.fill(); c.stroke(); break;
      // overhead obstacles: drawn with posts reaching the ground but hitbox only above slide height
      case 'banner':
        post(c, -60, d.high + 80, '#2d2d33'); post(c, 60, d.high + 80, '#2d2d33');
        c.fillStyle = '#c8202a'; c.beginPath(); c.moveTo(-58, -(d.high + 70)); c.lineTo(58, -(d.high + 70)); c.lineTo(58, -d.high); c.quadraticCurveTo(0, -d.high + 8, -58, -d.high); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#ffe9a8'; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText(o.alt ? 'BAZAR' : 'CAUDAN', 0, -(d.high + 30)); break;
      case 'parasol':
        c.strokeStyle = OUT; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -(d.high + 60)); c.stroke(); c.strokeStyle = '#ddd'; c.lineWidth = 3; c.stroke();
        for (var u = 0; u < 6; u++) { c.fillStyle = u % 2 ? '#ffffff' : (o.alt ? '#2f9ad8' : '#e8504a'); c.beginPath(); c.moveTo(0, -(d.high + 64)); c.lineTo(-66 + u * 22, -d.high - 4); c.lineTo(-44 + u * 22, -d.high - 4); c.closePath(); c.fill(); }
        c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -(d.high + 64)); c.lineTo(-66, -d.high - 4); c.lineTo(66, -d.high - 4); c.closePath(); c.stroke(); break;
      case 'branch': case 'palmleaf':
        c.strokeStyle = OUT; c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(80, -(d.high + 120)); c.quadraticCurveTo(20, -(d.high + 10), -70, -(d.high + 14)); c.stroke();
        c.strokeStyle = k === 'branch' ? '#5a3a22' : '#7a6a3a'; c.lineWidth = 11; c.stroke();
        for (var l = 0; l < 9; l++) { var lx = 60 - l * 15, ly = -(d.high + 20) - (l < 3 ? 40 - l * 12 : 0); c.fillStyle = l % 2 ? '#2f6a2a' : '#3f8a35'; c.beginPath(); c.ellipse(lx, ly + 12, 7, 18, 0.5, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke(); }
        if (k === 'branch') { c.strokeStyle = '#3f7a2e'; c.lineWidth = 3; for (var v = 0; v < 3; v++) { c.beginPath(); c.moveTo(-40 + v * 30, -(d.high + 10)); c.quadraticCurveTo(-36 + v * 30, -d.high + 20, -44 + v * 30, -d.high + 40 - v * 8); c.stroke(); } }
        break;
      case 'overhang':
        c.fillStyle = '#5d554f'; c.beginPath(); c.moveTo(-90, -(d.high + 200)); c.lineTo(90, -(d.high + 200)); c.lineTo(80, -(d.high + 30)); c.lineTo(40, -d.high); c.lineTo(-20, -d.high - 6); c.lineTo(-75, -d.high - 20); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#4e7a3a'; c.beginPath(); c.ellipse(0, -d.high - 4, 30, 5, 0, 0, TAU); c.fill(); c.strokeStyle = '#3f6a2e'; c.lineWidth = 2; for (var m = 0; m < 5; m++) { c.beginPath(); c.moveTo(-30 + m * 14, -d.high); c.lineTo(-30 + m * 14, -d.high + 12 + m % 2 * 8); c.stroke(); } break;
      case 'boom':
        c.strokeStyle = OUT; c.lineWidth = 9; c.beginPath(); c.moveTo(70, 0); c.lineTo(70, -(d.high + 140)); c.stroke(); c.strokeStyle = '#8a5a30'; c.lineWidth = 6; c.stroke();
        c.save(); c.translate(70, -(d.high + 10)); c.rotate(Math.sin(t * 2) * 0.05); c.strokeStyle = OUT; c.lineWidth = 12; c.beginPath(); c.moveTo(0, 0); c.lineTo(-150, 0); c.stroke(); c.strokeStyle = '#a8743c'; c.lineWidth = 8; c.stroke();
        c.fillStyle = '#e9e2cc'; c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, -4); c.lineTo(-140, -4); c.lineTo(-20, -130); c.closePath(); c.fill(); c.stroke(); c.restore(); break;
      case 'pipe':
        post(c, -70, d.high + 30, '#6b6b70'); post(c, 70, d.high + 30, '#6b6b70');
        c.fillStyle = '#8a8a92'; rr(c, -80, -(d.high + 22), 160, 22, 10); c.fill(); c.stroke();
        for (var w = 0; w < 4; w++) { c.fillStyle = 'rgba(150,200,255,0.8)'; c.beginPath(); c.ellipse(-50 + w * 33, -d.high + 6 + ((t * 120 + w * 13) % 30), 2, 5, 0, 0, TAU); c.fill(); } break;
    }
    c.restore();
  };
  function post(c, x, h, col) { c.fillStyle = col; c.strokeStyle = OUT; c.lineWidth = 3; c.fillRect(x - 4, -h, 8, h); c.strokeRect(x - 4, -h, 8, h); }

  // ---------------- PICKUPS ----------------
  ART.pickup = function (c, p, t) {
    c.save(); c.translate(0, Math.sin(t * 4 + p.x * 0.01) * 4);
    if (p.kind === 'coin') {
      var s = Math.abs(Math.cos(t * 4 + p.x * 0.02)); c.scale(Math.max(0.15, s), 1);
      c.fillStyle = '#f7c531'; c.strokeStyle = '#7a4c06'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 12, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = '#fff1a8'; c.beginPath(); c.arc(-3, -3, 4, 0, TAU); c.fill();
      c.fillStyle = '#8a5a06'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('Rs', 0, 4);
    } else if (p.kind === 'pistol' || p.kind === 'shotgun' || p.kind === 'rocket' || p.kind === 'sabre' || p.kind === 'bigSabre') {
      c.shadowColor = '#ffcc3a'; c.shadowBlur = 16 + Math.sin(t * 6) * 6;
      c.fillStyle = '#2a1a12'; c.strokeStyle = OUT; c.lineWidth = 3;
      rr(c, -22, -16, 44, 32, 5); c.fill(); c.stroke(); c.shadowBlur = 0;
      c.fillStyle = '#c9a03a'; rr(c, -22, -16, 44, 7, 4); c.fill();
      ART.weaponIcon(c, p.kind, 0, 6, 0.85);
    } else if (p.kind === 'jeep' || p.kind === 'jetski' || p.kind === 'quad' || p.kind === 'boat' || p.kind === 'tractor') {
      c.shadowColor = '#7ad0ff'; c.shadowBlur = 18 + Math.sin(t * 5) * 6;
      c.save(); c.scale(0.55, 0.55); ART.vehicle(c, p.kind, t, false); c.restore();
      c.shadowBlur = 0;
    } else {
      c.shadowColor = p.kind === 'dholl' ? '#ffe08a' : p.kind === 'gato' ? '#ff7a2a' : '#ff8ad8'; c.shadowBlur = 16 + Math.sin(t * 6) * 6;
      if (p.kind === 'dholl') { // dholl puri wrap
        c.fillStyle = '#e8c27a'; c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 0, 24, 14, -0.2, 0, TAU); c.fill(); c.stroke(); c.shadowBlur = 0;
        c.fillStyle = '#c8962e'; for (var i = 0; i < 6; i++) { c.beginPath(); c.arc(-14 + i * 6, -2 + (i % 2) * 4, 1.6, 0, TAU); c.fill(); }
        c.fillStyle = '#d24a2a'; c.beginPath(); c.ellipse(4, -3, 8, 3, -0.2, 0, TAU); c.fill(); c.fillStyle = '#3a8a2a'; c.beginPath(); c.ellipse(-6, 2, 5, 2, 0.3, 0, TAU); c.fill();
      } else if (p.kind === 'gato') { // gato piment
        for (var g = 0; g < 3; g++) { c.fillStyle = '#d08a2a'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.arc(-12 + g * 12, (g % 2) * -6, 9, 0, TAU); c.fill(); c.stroke(); }
        c.shadowBlur = 0; c.fillStyle = '#e0302a'; c.beginPath(); c.moveTo(-4, -18); c.quadraticCurveTo(8, -24, 14, -14); c.lineTo(10, -12); c.quadraticCurveTo(4, -18, -4, -14); c.fill();
      } else { // alouda glass
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.strokeStyle = OUT; c.lineWidth = 3; c.beginPath(); c.moveTo(-12, -20); c.lineTo(12, -20); c.lineTo(9, 18); c.lineTo(-9, 18); c.closePath(); c.fill(); c.stroke(); c.shadowBlur = 0;
        c.fillStyle = '#ff9ad2'; c.beginPath(); c.moveTo(-11, -10); c.lineTo(11, -10); c.lineTo(9, 16); c.lineTo(-9, 16); c.closePath(); c.fill();
        c.fillStyle = '#3a2a2a'; for (var a = 0; a < 5; a++) { c.beginPath(); c.arc(-5 + a * 2.5, 10 - (a % 2) * 5, 1.6, 0, TAU); c.fill(); }
        c.strokeStyle = '#e83a6a'; c.lineWidth = 3; c.beginPath(); c.moveTo(4, -28); c.lineTo(2, 8); c.stroke();
      }
    }
    c.restore();
  };

  // ---------------- SCENERY (procedural mid/near layers per level) ----------------
  function palm(c, x, y, h, s, sway, col) {
    c.save(); c.translate(x, y);
    c.strokeStyle = col || '#3a2a1c'; c.lineWidth = 9 * s; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(18 * s, -h * 0.5, 10 * s + sway, -h); c.stroke();
    c.fillStyle = col || '#1f4a26';
    for (var i = 0; i < 7; i++) {
      var a = -Math.PI / 2 + (i - 3) * 0.48 + sway * 0.01;
      c.save(); c.translate(10 * s + sway, -h); c.rotate(a);
      c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(40 * s, -18 * s, 82 * s, 18 * s); c.quadraticCurveTo(40 * s, -4 * s, 0, 4 * s); c.fill();
      c.restore();
    }
    c.restore();
  }
  ART.palm = palm;
  // draws one parallax layer of repeating procedural elements; f = parallax factor
  ART.layer = function (c, kind, camX, viewW, baseY, t, f, tone) {
    var off = camX * f, spacing, i0, i1, i;
    switch (kind) {
      case 'city': // Port Louis facades, Central Market, Caudan sign, street lamps
        spacing = 150; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) {
          var x = i * spacing - off, r = hash(i), hgt = 95 + r * 95, w = 130 + hash(i + 7) * 20;
          if (hash(i + 21) < 0.3 && i % 9 !== 4 && i % 9 !== 8) continue; // gaps show the harbour behind
          var cols = ['#c45a4a', '#e0b050', '#5aa0b0', '#e08a6a', '#8ab070', '#d0d0c0', '#b070a0'];
          var base = cols[Math.floor(hash(i + 3) * cols.length)];
          c.fillStyle = mix(base, tone || '#20101a', 0.45); c.fillRect(x, baseY - hgt, w, hgt);
          c.fillStyle = mix(base, '#000000', 0.55); c.fillRect(x - 4, baseY - hgt - 8, w + 8, 10);
          var lit = hash(i + 11);
          for (var wy = baseY - hgt + 20; wy < baseY - 30; wy += 34) for (var wx = x + 14; wx < x + w - 20; wx += 30) {
            var on = hash(wx * 0.37 + wy * 0.91 + i) < 0.25; c.fillStyle = on ? (lit > 0.5 ? '#ffcf6a' : '#ff9a4a') : 'rgba(20,10,10,0.6)'; c.fillRect(wx, wy, 14, 20);
            if (!on && hash(wx + wy) < 0.2) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(wx + 3, wy + 4, 8, 16); }
          }
          // wooden balcony on some
          if (r > 0.5) { c.fillStyle = 'rgba(40,20,10,0.8)'; c.fillRect(x + 6, baseY - hgt * 0.55, w - 12, 5); for (var bx = x + 8; bx < x + w - 8; bx += 8) c.fillRect(bx, baseY - hgt * 0.55 - 16, 2, 16); }
          if (i % 9 === 4) { // Central Market
            c.fillStyle = mix('#c9a06a', tone || '#20101a', 0.4); c.fillRect(x, baseY - 170, w + 20, 170);
            c.fillStyle = mix('#7a3a2a', '#000000', 0.3); c.beginPath(); c.moveTo(x - 10, baseY - 170); c.lineTo(x + (w + 20) / 2, baseY - 215); c.lineTo(x + w + 30, baseY - 170); c.fill();
            c.fillStyle = '#1a0e0a'; c.beginPath(); c.arc(x + (w + 20) / 2, baseY - 40, 34, Math.PI, 0); c.fill(); c.fillRect(x + (w + 20) / 2 - 34, baseY - 40, 68, 40);
            c.fillStyle = '#ffe7a8'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText('MARCHÉ CENTRAL', x + (w + 20) / 2, baseY - 140);
          }
          if (i % 9 === 8) { c.fillStyle = '#1a1214'; c.fillRect(x + 20, baseY - hgt - 50, 110, 38); c.fillStyle = '#ff5a3a'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('CAUDAN', x + 75, baseY - hgt - 22); }
        }
        // lamps
        spacing = 260; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) { var lx = i * spacing - off + 60; c.fillStyle = '#18100e'; c.fillRect(lx, baseY - 130, 5, 130); c.fillRect(lx - 14, baseY - 132, 24, 5); var fl = hash(i + Math.floor(t * 8)) < 0.08 ? 0.2 : 1; c.fillStyle = 'rgba(255,210,120,' + 0.85 * fl + ')'; c.beginPath(); c.arc(lx - 12, baseY - 124, 6, 0, TAU); c.fill(); var g = c.createRadialGradient(lx - 12, baseY - 124, 2, lx - 12, baseY - 124, 60); g.addColorStop(0, 'rgba(255,190,90,' + 0.35 * fl + ')'); g.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = g; c.fillRect(lx - 72, baseY - 184, 120, 120); }
        break;
      case 'palms':
        spacing = 210; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) { if (hash(i + 5) < 0.35) continue; palm(c, i * spacing - off + hash(i) * 80, baseY, 150 + hash(i + 2) * 90, 1 + hash(i + 9) * 0.3, Math.sin(t * 1.2 + i) * 6, tone); }
        break;
      case 'trees': // Chamarel forest trunks & vines
        spacing = 120; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) {
          var tx = i * spacing - off + hash(i) * 50, tw = 18 + hash(i + 1) * 26;
          c.fillStyle = tone || '#0f1e12'; c.fillRect(tx, baseY - 600, tw, 600);
          c.beginPath(); c.moveTo(tx - 20, baseY); c.quadraticCurveTo(tx, baseY - 40, tx, baseY - 80); c.lineTo(tx + tw, baseY - 80); c.quadraticCurveTo(tx + tw, baseY - 40, tx + tw + 24, baseY); c.fill();
          c.strokeStyle = tone || '#16301a'; c.lineWidth = 3; c.beginPath(); c.moveTo(tx + tw / 2, baseY - 600); c.quadraticCurveTo(tx + tw / 2 + 30 + Math.sin(t + i) * 6, baseY - 400, tx + tw / 2 + 10, baseY - 260 - hash(i + 4) * 100); c.stroke();
          c.fillStyle = tone || '#132a16'; for (var fl2 = 0; fl2 < 5; fl2++) { c.beginPath(); c.ellipse(tx + tw / 2 + (fl2 - 2) * 30, baseY - 18 - (fl2 % 2) * 10, 26, 10, (fl2 - 2) * 0.3, 0, TAU); c.fill(); }
        }
        break;
      case 'cliffs': // mountain rock spires
        spacing = 260; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) { var cx = i * spacing - off, ch = 160 + hash(i) * 200; c.fillStyle = tone || '#2a2030'; c.beginPath(); c.moveTo(cx - 40, baseY + 400); c.lineTo(cx + 30, baseY - ch); c.lineTo(cx + 60, baseY - ch + 30); c.lineTo(cx + 140 + hash(i + 3) * 60, baseY + 400); c.fill(); c.fillStyle = 'rgba(80,120,60,0.35)'; c.beginPath(); c.ellipse(cx + 50, baseY - ch * 0.4, 30, 12, 0.5, 0, TAU); c.fill(); }
        break;
      case 'cane': // tall sugar cane rows
        spacing = 14; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) { var sx = i * spacing - off, sh = 110 + hash(i) * 60, sw = Math.sin(t * 1.5 + i * 0.3) * 6;
          c.strokeStyle = tone || '#4f6a22'; c.lineWidth = 4; c.beginPath(); c.moveTo(sx, baseY); c.quadraticCurveTo(sx + sw * 0.5, baseY - sh * 0.5, sx + sw, baseY - sh); c.stroke();
          c.strokeStyle = tone || '#6f8a2a'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(sx + sw, baseY - sh); c.quadraticCurveTo(sx + sw + 20, baseY - sh - 10, sx + sw + 30, baseY - sh + 16); c.moveTo(sx + sw, baseY - sh); c.quadraticCurveTo(sx + sw - 18, baseY - sh - 8, sx + sw - 26, baseY - sh + 18); c.stroke(); }
        break;
      case 'boats': // pirogues bobbing in mid distance, some with zombies
        spacing = 520; i0 = Math.floor(off / spacing) - 1; i1 = i0 + Math.ceil(viewW / spacing) + 3;
        for (i = i0; i < i1; i++) { if (hash(i) < 0.3) continue; var px = i * spacing - off + hash(i + 2) * 200, py = baseY + Math.sin(t * 1.6 + i) * 4, bc = ['#2d78c0', '#d23a3a', '#e0b030', '#3aa05a'][i & 3];
          c.save(); c.translate(px, py); c.rotate(Math.sin(t * 1.3 + i) * 0.04); c.fillStyle = mix(bc, '#0a1430', 0.45); c.beginPath(); c.moveTo(-60, -16); c.quadraticCurveTo(0, -10, 60, -20); c.quadraticCurveTo(40, 6, 0, 6); c.quadraticCurveTo(-40, 6, -60, -16); c.fill();
          c.fillStyle = '#0a1426'; c.fillRect(-2, -90, 3, 76); c.fillStyle = 'rgba(230,220,200,0.55)'; c.beginPath(); c.moveTo(0, -88); c.lineTo(36, -24); c.lineTo(0, -24); c.fill();
          if (hash(i + 8) > 0.4) { c.fillStyle = '#16241a'; for (var zz = 0; zz < 2; zz++) { c.beginPath(); c.ellipse(-30 + zz * 22, -36, 6, 14, -0.3, 0, TAU); c.fill(); c.beginPath(); c.arc(-34 + zz * 22, -54, 6, 0, TAU); c.fill(); } }
          c.restore(); }
        break;
    }
  };
  // ground surface drawing between [x0,x1] (screen coords) for straight segment y0->y1
  ART.ground = function (c, style, x0, y0, x1, y1, bottom, worldX0, t) {
    var C = { cobble: ['#5a5550', '#3a3634', '#7a746c'], sand: ['#e8d29a', '#d2b77a', '#f6e6b8'], forest: ['#3a2a1a', '#24180e', '#3f7a2e'], rock: ['#5d554f', '#3f3934', '#5a7a3a'],
      deck: ['#a8743c', '#6e4620', '#c99a62'], dirt: ['#8a4a2a', '#5a2e18', '#a86a3a'], darksand: ['#9a6a5a', '#6a4038', '#c0907a'] }[style] || ['#666', '#444', '#888'];
    c.save();
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x1, bottom); c.lineTo(x0, bottom); c.closePath();
    var g = c.createLinearGradient(0, Math.min(y0, y1), 0, bottom); g.addColorStop(0, C[0]); g.addColorStop(0.35, C[1]); g.addColorStop(1, mix(C[1], '#000000', 0.5));
    c.fillStyle = g; c.fill(); c.clip();
    var slope = (y1 - y0) / Math.max(1, x1 - x0), step = style === 'cobble' ? 26 : 22;
    var startI = Math.floor(worldX0 / step);
    for (var i = 0; ; i++) {
      var wx = (startI + i) * step, sx = x0 + (wx - worldX0); if (sx > x1 + step) break; if (sx < x0 - step) continue;
      var yy = y0 + (sx - x0) * slope, r = hash(startI + i);
      if (style === 'cobble') { for (var row = 0; row < 3; row++) { c.fillStyle = row === 0 ? C[2] : mix(C[2], '#000000', 0.2 + row * 0.15); rr(c, sx + (row % 2) * 13, yy + 4 + row * 13, 22, 10, 4); c.fill(); } }
      else if (style === 'sand' || style === 'darksand') { c.fillStyle = C[2]; c.fillRect(sx, yy, step, 5); c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.arc(sx + r * step, yy + 14 + r * 30, 1.6, 0, TAU); c.fill(); if (r > 0.9) { c.fillStyle = '#fff4e0'; c.beginPath(); c.ellipse(sx + 8, yy + 22, 4, 2.5, 0.4, 0, TAU); c.fill(); } }
      else if (style === 'forest' || style === 'rock') { c.fillStyle = C[2]; c.beginPath(); c.moveTo(sx, yy + 6); for (var b = 0; b <= 4; b++) c.lineTo(sx + b * step / 4, yy - (b % 2 ? 6 + r * 6 : 0)); c.lineTo(sx + step, yy + 8); c.fill(); if (style === 'rock' && r > 0.7) { c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(sx, yy + 20); c.lineTo(sx + 10, yy + 34); c.lineTo(sx + 4, yy + 50); c.stroke(); } }
      else if (style === 'deck') { c.fillStyle = r > 0.5 ? C[2] : C[0]; c.fillRect(sx, yy, step - 2, 12); c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(sx + step - 2, yy, 2, 12); }
      else if (style === 'dirt') { c.fillStyle = C[2]; c.fillRect(sx, yy, step, 4); if (r > 0.6) { c.fillStyle = '#3a3436'; c.beginPath(); c.ellipse(sx + r * 10, yy + 10 + r * 20, 6, 4, 0, 0, TAU); c.fill(); } c.fillStyle = '#5a7a22'; if (r < 0.3) { c.beginPath(); c.moveTo(sx, yy); c.lineTo(sx + 3, yy - 10); c.lineTo(sx + 6, yy); c.fill(); } }
    }
    c.restore();
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  };

  // Themed arena bosses. Origin is at the feet, facing left (same as zombies).
  ART.drawBoss = function (c, z) {
    var form = z.form || 'granzombi';
    if (form === 'shark') { drawSharkBoss(c, z); return; }
    c.save();
    ART.zombie(c, z, {});
    var sc = z.scale || 2.3;
    c.scale(sc, sc);
    if (form === 'docker') {
      // cargo hook hanging from the front reach
      c.save(); c.strokeStyle = '#c4c8d0'; c.fillStyle = '#8a9098'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-28, -70); c.lineTo(-48, -40); c.stroke();
      c.beginPath(); c.arc(-52, -28, 10, -0.4, Math.PI * 1.2); c.stroke();
      c.fillStyle = '#3a2a1a'; rr(c, -8, -8, 16, 12, 2); c.fill(); // boot scuff already
      c.restore();
    } else if (form === 'gorilla') {
      c.fillStyle = 'rgba(40,28,22,0.85)';
      c.beginPath(); c.ellipse(6, -36, 16, 22, 0.2, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(-18, -20, 14, 10, -0.3, 0, TAU); c.fill();
    } else if (form === 'rock') {
      c.fillStyle = '#6b625a'; c.strokeStyle = OUT; c.lineWidth = 2.5;
      for (var i = 0; i < 5; i++) {
        var a = -40 + i * 14, x = -10 + hash(i + 2) * 16;
        c.beginPath(); c.ellipse(x, a, 10 + hash(i) * 6, 7, 0.2, 0, TAU); c.fill(); c.stroke();
      }
    } else if (form === 'bloater') {
      c.fillStyle = z.outfit && z.outfit.shirt ? z.outfit.shirt : '#e85d8a';
      c.strokeStyle = OUT; c.lineWidth = 3;
      c.beginPath(); c.ellipse(2, -18, 28, 22, 0, 0, TAU); c.fill(); c.stroke();
      c.fillStyle = 'rgba(80,20,20,0.35)'; c.beginPath(); c.ellipse(8, -10, 8, 6, 0, 0, TAU); c.fill();
    } else if (form === 'captain') {
      // bicorn / tricorn
      c.fillStyle = '#1a1a22'; c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.beginPath(); c.ellipse(-4, -108, 28, 7, -0.1, 0, TAU); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(-2, -118, 16, 10, -0.1, Math.PI, TAU); c.fill(); c.stroke();
      c.fillStyle = '#c4a24a'; c.fillRect(-12, -112, 20, 3);
      // coat tails
      c.fillStyle = '#2a2030'; c.beginPath(); c.moveTo(12, -8); c.lineTo(26, 16); c.lineTo(8, 4); c.closePath(); c.fill();
      // seaweed tentacle
      c.strokeStyle = '#2a6a48'; c.lineWidth = 5; c.beginPath(); c.moveTo(8, -4);
      c.quadraticCurveTo(30, 10, 18, 28); c.quadraticCurveTo(10, 36, 22, 42); c.stroke();
    } else if (form === 'harvester') {
      // huge cane machete
      c.save(); c.translate(-30, -80); c.rotate(-0.9);
      c.fillStyle = '#c8c4bc'; c.strokeStyle = OUT; c.lineWidth = 2.5;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(70, -8); c.quadraticCurveTo(80, 2, 68, 8); c.lineTo(0, 6); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5a3a1a'; rr(c, -14, -4, 18, 10, 2); c.fill(); c.stroke();
      c.restore();
      // cane leaves on the back
      c.fillStyle = '#3a6a22';
      for (var k = 0; k < 4; k++) { c.beginPath(); c.ellipse(16, -50 - k * 8, 4, 16, 0.4 + k * 0.1, 0, TAU); c.fill(); }
    }
    c.restore();
  };
  function drawSharkBoss(c, z) {
    var ph = z.phase || 0, hurt = z.hurtT > 0, stag = z.stag > 0;
    c.save();
    if (hurt) c.globalAlpha = 0.75;
    if (stag) c.translate(Math.sin(ph * 20) * 4, 0);
    var lunge = (z.state === 'charge' ? -30 : 0) + Math.sin(ph) * 4;
    c.translate(lunge, -70);
    c.rotate(-0.12 + (z.state === 'slam' ? 0.4 : 0) + (z.state === 'dying' ? 0.6 : 0));
    // body
    var skin = z.skin || '#4a6a52', skinD = mix(skin, '#1a2014', 0.35);
    c.fillStyle = skin; c.strokeStyle = OUT; c.lineWidth = 5;
    c.beginPath(); c.ellipse(-10, 0, 130, 48, 0, 0, TAU); c.fill(); c.stroke();
    // belly
    c.fillStyle = mix(skin, '#d8d0b8', 0.45); c.beginPath(); c.ellipse(-6, 16, 100, 22, 0, 0, Math.PI); c.fill();
    // rotting patches
    c.fillStyle = 'rgba(90,20,20,0.7)';
    c.beginPath(); c.ellipse(30, -6, 16, 10, 0.3, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(-40, 8, 12, 8, -0.2, 0, TAU); c.fill();
    // dorsal fin
    c.fillStyle = skinD; c.strokeStyle = OUT; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-20, -44); c.lineTo(10, -110); c.lineTo(30, -40); c.closePath(); c.fill(); c.stroke();
    // tail
    c.beginPath(); c.moveTo(110, 0); c.lineTo(170, -50); c.lineTo(140, 0); c.lineTo(175, 40); c.lineTo(110, 10); c.closePath(); c.fill(); c.stroke();
    // pectoral
    c.beginPath(); c.ellipse(20, 30, 36, 12, 0.5, 0, TAU); c.fill(); c.stroke();
    // head / mouth (left)
    if (!z.headless) {
      c.fillStyle = skin; c.beginPath(); c.moveTo(-120, -20); c.quadraticCurveTo(-190, 0, -130, 28); c.lineTo(-90, 16); c.lineTo(-100, -16); c.closePath(); c.fill(); c.stroke();
      // teeth
      c.fillStyle = '#f3efe0';
      for (var i = 0; i < 6; i++) {
        var tx = -150 + i * 10, ty = (i % 2 ? 8 : -8);
        c.beginPath(); c.moveTo(tx, ty); c.lineTo(tx + 5, ty + (ty > 0 ? 12 : -12)); c.lineTo(tx + 10, ty); c.fill();
      }
      // eye
      c.fillStyle = '#fff3a0'; c.shadowColor = '#ff2020'; c.shadowBlur = 14;
      c.beginPath(); c.ellipse(-140, -18, 10, 12, 0, 0, TAU); c.fill();
      c.shadowBlur = 0; c.fillStyle = '#c01010'; c.beginPath(); c.arc(-143, -18, 5, 0, TAU); c.fill();
    } else {
      c.fillStyle = '#8a0b0b'; c.beginPath(); c.ellipse(-120, 0, 22, 16, 0, 0, TAU); c.fill(); c.stroke();
    }
    c.restore();
  };
  window.ZRArt = ART;
})();
