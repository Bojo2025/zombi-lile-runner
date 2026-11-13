// ZOMBI LILE RUNNER - WebAudio synth: sound effects, adaptive horror music, per-level ambience.
// Nothing is loaded from disk; every sound is generated. Audio starts after the first tap (browser rule).
(function () {
  'use strict';
  var A = {}, ctx = null, master, musicBus, sfxBus, ambBus, delay, delayFb, noiseBuf = null;
  var muted = false, musicOn = false, mode = 'title', intensity = 0, nextStep = 0, step = 0;
  var drone = null, amb = null, ambKind = null, ambTimer = 0;

  A.init = function () {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.35; ambBus.connect(master);
    delay = ctx.createDelay(1.0); delay.delayTime.value = 0.33; delayFb = ctx.createGain(); delayFb.gain.value = 0.38;
    var dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    delay.connect(dl); dl.connect(delayFb); delayFb.connect(delay); dl.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextStep = ctx.currentTime + 0.1;
    // iOS unlock: play a silent buffer inside the gesture
    var s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(master); s.start(0);
  };
  A.ready = function () { return !!ctx; };
  A.setMuted = function (m) { muted = m; if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05); };
  A.isMuted = function () { return muted; };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  function env(g, t, a, peak, dec, sus, rel, len) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + dec);
    if (len !== undefined) { g.gain.setValueAtTime(Math.max(0.0001, sus), t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + rel); }
  }
  function osc(type, f, t, len, vol, dest, opt) {
    opt = opt || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(opt.to, t + (opt.toT || len));
    if (opt.detune) o.detune.value = opt.detune;
    env(g, t, opt.a || 0.005, vol, opt.d || len * 0.5, opt.s || vol * 0.3, opt.r || 0.05, len);
    var last = g;
    if (opt.lp) { var f1 = ctx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.setValueAtTime(opt.lp, t); if (opt.lpTo) f1.frequency.exponentialRampToValueAtTime(opt.lpTo, t + len); f1.Q.value = opt.q || 1; g.connect(f1); last = f1; }
    o.connect(g); last.connect(dest || sfxBus);
    if (opt.send) { var sg = ctx.createGain(); sg.gain.value = opt.send; last.connect(sg); sg.connect(delay); }
    o.start(t); o.stop(t + len + (opt.r || 0.05) + 0.05);
    return o;
  }
  function noise(t, len, vol, type, f, dest, opt) {
    opt = opt || {};
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var fl = ctx.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1000, t); fl.Q.value = opt.q || 1;
    if (opt.fTo) fl.frequency.exponentialRampToValueAtTime(opt.fTo, t + len);
    var g = ctx.createGain(); env(g, t, opt.a || 0.004, vol, opt.d || len * 0.6, opt.s || 0.0001, opt.r || 0.04, len);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + len + 0.2);
  }

  // ---------------- SFX ----------------
  A.sfx = function (name, p) {
    if (!ctx || muted) return; var t = ctx.currentTime; p = p || 0;
    switch (name) {
      case 'jump': osc('square', 260, t, 0.12, 0.12, null, { to: 520, lp: 1800 }); break;
      case 'djump': osc('square', 380, t, 0.12, 0.11, null, { to: 820, lp: 2400 }); noise(t, 0.12, 0.08, 'highpass', 2500); break;
      case 'land': noise(t, 0.08, 0.15, 'lowpass', 400); break;
      case 'slide': noise(t, 0.35, 0.18, 'bandpass', 900, null, { fTo: 300, q: 0.7 }); break;
      case 'swing': noise(t, 0.16, 0.32, 'bandpass', 3500, null, { fTo: 700, q: 2.5 }); osc('sine', 900, t, 0.1, 0.05, null, { to: 300 }); break;
      case 'cleave': noise(t, 0.26, 0.4, 'bandpass', 2400, null, { fTo: 300, q: 2 }); osc('sawtooth', 160, t, 0.25, 0.14, null, { to: 50, lp: 900 }); break;
      case 'spin':
        for (var i = 0; i < 4; i++) noise(t + i * 0.09, 0.14, 0.28, 'bandpass', 4200 - i * 600, null, { fTo: 900, q: 3 });
        osc('sawtooth', 120, t, 0.5, 0.12, null, { to: 480, lp: 1500 }); break;
      case 'chop': // wet decapitation
        noise(t, 0.09, 0.45, 'highpass', 1800); noise(t + 0.03, 0.22, 0.35, 'lowpass', 700, null, { q: 3 });
        osc('sine', 180, t + 0.02, 0.16, 0.25, null, { to: 60 }); break;
      case 'splat': noise(t, 0.25, 0.3, 'lowpass', 500, null, { q: 4 }); osc('sine', 120, t, 0.12, 0.2, null, { to: 40 }); break;
      case 'thud': osc('sine', 140, t, 0.18, 0.35, null, { to: 45 }); noise(t, 0.1, 0.2, 'lowpass', 600); break;
      case 'stomp': osc('square', 200, t, 0.1, 0.12, null, { to: 90, lp: 900 }); noise(t, 0.08, 0.18, 'lowpass', 800); break;
      case 'hurt': osc('sawtooth', 300, t, 0.3, 0.22, null, { to: 90, lp: 1400 }); noise(t, 0.2, 0.2, 'bandpass', 1200); break;
      case 'coin': osc('square', 988, t, 0.06, 0.08, null, { lp: 4000 }); osc('square', 1319, t + 0.06, 0.12, 0.08, null, { lp: 4000 }); break;
      case 'power': [523, 659, 784, 1047].forEach(function (f, k) { osc('triangle', f, t + k * 0.07, 0.14, 0.14, null, { send: 0.3 }); }); break;
      case 'heal': [392, 523, 659].forEach(function (f, k) { osc('sine', f, t + k * 0.08, 0.2, 0.16, null, { send: 0.3 }); }); break;
      case 'splash': noise(t, 0.5, 0.3, 'lowpass', 1400, null, { fTo: 300 }); noise(t, 0.15, 0.2, 'highpass', 3000); break;
      case 'turn': osc('sawtooth', 90, t, 0.9, 0.12, null, { to: 60, lp: 600, detune: 15 }); noise(t, 0.6, 0.12, 'bandpass', 500, null, { q: 6 }); break;
      case 'moan': A.moan(p); break;
      case 'screech': osc('sawtooth', 900, t, 0.3, 0.12, null, { to: 1500, lp: 3000, q: 6 }); osc('sawtooth', 950, t, 0.3, 0.08, null, { to: 1400, lp: 3000 }); break;
      case 'roar': osc('sawtooth', 70, t, 1.2, 0.35, null, { to: 45, lp: 700, q: 4 }); osc('sawtooth', 73, t, 1.2, 0.25, null, { to: 48, lp: 500 }); noise(t, 1.1, 0.25, 'bandpass', 300, null, { q: 2 }); break;
      case 'level': [440, 554, 659, 880].forEach(function (f, k) { osc('triangle', f, t + k * 0.12, 0.35, 0.16, null, { send: 0.4 }); }); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, k) { osc('triangle', f, t + k * 0.14, 0.4, 0.17, null, { send: 0.4 }); osc('square', f / 2, t + k * 0.14, 0.3, 0.05, null, { lp: 1200 }); }); break;
      case 'over': [330, 311, 294, 220].forEach(function (f, k) { osc('sawtooth', f, t + k * 0.28, 0.4, 0.14, null, { lp: 900, send: 0.4 }); }); break;
      case 'click': osc('square', 660, t, 0.04, 0.07, null, { lp: 3000 }); break;
      case 'thunder': noise(t, 2.2, 0.5, 'lowpass', 220, null, { a: 0.05, d: 1.5, s: 0.05 }); break;
    }
  };
  A.moan = function (pitch) {
    if (!ctx || muted) return; var t = ctx.currentTime, f = 85 + (pitch || Math.random()) * 70, len = 0.9 + Math.random() * 0.6;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.15, t); o.frequency.linearRampToValueAtTime(f, t + len * 0.4); o.frequency.linearRampToValueAtTime(f * 0.8, t + len);
    var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5 + Math.random() * 3; vg.gain.value = 4; vib.connect(vg); vg.connect(o.frequency);
    var f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(320, t + len); f1.Q.value = 5;
    var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 7;
    var g = ctx.createGain(); env(g, t, 0.12, 0.22, len * 0.5, 0.12, 0.2, len);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfxBus);
    o.start(t); vib.start(t); o.stop(t + len + 0.4); vib.stop(t + len + 0.4);
  };

  // ---------------- Music ----------------
  // A minor / phrygian horror palette. 16th-note step sequencer with lookahead scheduling.
  var N = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };
  var BASS = [45, 0, 45, 0, 46, 0, 45, 0, 48, 0, 46, 0, 45, 0, 44, 0];
  var ARP = [69, 72, 75, 72, 70, 74, 77, 74, 69, 72, 76, 72, 68, 71, 74, 71];
  var BELL = [81, 0, 0, 0, 80, 0, 0, 0, 77, 0, 0, 0, 76, 0, 0, 0, 75, 0, 0, 0, 77, 0, 0, 0, 80, 0, 0, 0, 0, 0, 0, 0];
  A.setMusic = function (m, inten) { mode = m; if (inten !== undefined) intensity = inten; musicOn = m !== 'off'; ensureDrone(); };
  A.setIntensity = function (i) { intensity = Math.max(0, Math.min(1.2, i)); };
  function ensureDrone() {
    if (!ctx) return;
    if (!musicOn) { if (drone) { drone.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4); } return; }
    if (!drone) {
      var g = ctx.createGain(); g.gain.value = 0.0001; var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 3;
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.09; lg.gain.value = 140; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
      [N(33), N(33) * 1.006, N(34) * 0.5 * 2].forEach(function (f, k) { var o = ctx.createOscillator(); o.type = k === 2 ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
      lp.connect(g); g.connect(musicBus); drone = { g: g, lp: lp };
    }
    drone.g.gain.setTargetAtTime(0.16, ctx.currentTime, 0.6);
  }
  function kick(t, v) { osc('sine', 120, t, 0.18, v, musicBus, { to: 38, toT: 0.12, d: 0.12, s: 0.001 }); }
  function hat(t, v) { noise(t, 0.04, v, 'highpass', 7000, musicBus, { d: 0.03 }); }
  function snare(t, v) { noise(t, 0.16, v, 'bandpass', 1800, musicBus, { q: 0.8, d: 0.12 }); osc('triangle', 190, t, 0.08, v * 0.6, musicBus, { to: 120 }); }
  function schedule(t, s) {
    var I = mode === 'boss' ? 1.15 : intensity, s16 = s % 16;
    if (mode === 'title') {
      if (s16 === 0 || s16 === 3) kick(t, s16 === 0 ? 0.45 : 0.3);           // heartbeat
      var b = BELL[s % 32]; if (b) osc('sine', N(b), t, 1.2, 0.07, musicBus, { a: 0.003, d: 0.9, s: 0.002, detune: 8, send: 0.6 });
      if (s % 64 === 32) osc('sawtooth', N(57), t, 3, 0.03, musicBus, { a: 1.2, lp: 700, d: 1, s: 0.03, r: 1.5 });
      return;
    }
    // layer 0: heartbeat kick
    if (s16 === 0 || s16 === 3 || (I > 0.6 && (s16 === 8 || s16 === 11))) kick(t, 0.5);
    // layer 1: bass ostinato
    if (I > 0.1 && BASS[s16]) osc('sawtooth', N(BASS[s16] - 12 + (Math.floor(s / 64) % 2 ? 0 : 0)), t, 0.22, 0.2, musicBus, { lp: 300 + I * 900, lpTo: 120, q: 4, d: 0.15, s: 0.02 });
    // layer 2: hats + snare
    if (I > 0.3) { if (s16 % 2 === 0 || I > 0.8) hat(t, s16 % 4 === 2 ? 0.07 : 0.035); if (s16 === 4 || s16 === 12) snare(t, 0.16); }
    // layer 3: eerie arpeggio through delay
    if (I > 0.5 && s16 % (I > 0.85 ? 1 : 2) === 0) osc('square', N(ARP[(s + Math.floor(s / 64) * 4) % 16]), t, 0.1, 0.035, musicBus, { lp: 2600, d: 0.08, s: 0.003, send: 0.5 });
    // layer 4: dissonant stabs / string swells
    if (I > 0.7 && s % 32 === 0) { [57, 58, 64].forEach(function (m) { osc('sawtooth', N(m), t, 1.4, 0.035, musicBus, { a: 0.5, d: 0.6, s: 0.03, lp: 1400, r: 0.6, detune: (Math.random() - 0.5) * 20 }); }); }
    if (I > 0.95 && s16 === 14) osc('sawtooth', N(81), t, 0.25, 0.05, musicBus, { to: N(80), lp: 3000, send: 0.4 });
  }
  A.update = function (dt) {
    if (!ctx) return;
    if (musicOn) {
      var bpm = mode === 'title' ? 70 : 86 + 50 * Math.min(1, intensity) + (mode === 'boss' ? 14 : 0);
      var spb = 60 / bpm / 4;
      if (nextStep < ctx.currentTime - 0.5) nextStep = ctx.currentTime + 0.05;
      while (nextStep < ctx.currentTime + 0.12) { if (!muted) schedule(nextStep, step); step++; nextStep += spb; }
      if (drone) drone.lp.Q.value = 3 + intensity * 6;
    }
    // ambient random events
    ambTimer -= dt;
    if (ambKind && ambTimer <= 0 && !muted) {
      var t = ctx.currentTime; ambTimer = 1.5 + Math.random() * 3.5;
      if (ambKind === 'forest') { var f = 2000 + Math.random() * 2000; for (var k = 0; k < 3; k++) osc('sine', f, t + k * 0.11, 0.07, 0.05, ambBus, { to: f * 1.3 }); if (Math.random() < 0.3) A.sfx('screech'); }
      else if (ambKind === 'city') { if (Math.random() < 0.5) { var o = osc('sine', 700, t, 2.4, 0.03, ambBus, { a: 0.3, d: 1, s: 0.03, r: 0.5 }); var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 1.2; lg.gain.value = 180; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 3); } else noise(t, 0.4, 0.06, 'bandpass', 600, ambBus); }
      else if (ambKind === 'beach' || ambKind === 'sunset') { var g0 = 1400 + Math.random() * 500; osc('triangle', g0, t, 0.25, 0.04, ambBus, { to: g0 * 0.6 }); osc('triangle', g0 * 1.1, t + 0.3, 0.2, 0.03, ambBus, { to: g0 * 0.7 }); }
      else if (ambKind === 'sea') { osc('sine', 110 + Math.random() * 40, t, 0.6, 0.05, ambBus, { to: 80, lp: 400 }); if (Math.random() < 0.25) A.sfx('thunder'); }
      else if (ambKind === 'cane') { osc('sawtooth', 600, t, 0.18, 0.04, ambBus, { to: 380, lp: 1800, q: 5 }); osc('sawtooth', 580, t + 0.25, 0.2, 0.04, ambBus, { to: 360, lp: 1800, q: 5 }); }
      else if (ambKind === 'mountain') { noise(t, 2.5, 0.07, 'bandpass', 500 + Math.random() * 500, ambBus, { a: 0.8, d: 1.5, s: 0.02, q: 3 }); }
      if (Math.random() < 0.35) A.moan(Math.random());
    }
  };
  A.setAmbience = function (kind) {
    if (!ctx) return; if (kind === ambKind) return; ambKind = kind;
    if (amb) { try { amb.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3); var old = amb; setTimeout(function () { try { old.s.stop(); } catch (e) {} }, 1500); } catch (e) {} amb = null; }
    if (!kind) return;
    var s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    var f = ctx.createBiquadFilter(); var g = ctx.createGain(); g.gain.value = 0.0001;
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    var cfg = { city: ['lowpass', 260, 0.18, 0.05, 0.05], beach: ['lowpass', 700, 0.22, 0.12, 0.18], sunset: ['lowpass', 600, 0.2, 0.1, 0.15],
      forest: ['bandpass', 1800, 0.05, 0.2, 0.02], mountain: ['bandpass', 600, 0.16, 0.07, 0.12], sea: ['lowpass', 500, 0.3, 0.15, 0.22], cane: ['highpass', 2500, 0.07, 0.3, 0.04] }[kind] || ['lowpass', 400, 0.1, 0.1, 0.05];
    f.type = cfg[0]; f.frequency.value = cfg[1]; lfo.frequency.value = cfg[3]; lg.gain.value = cfg[4];
    lfo.connect(lg); lg.connect(g.gain); s.connect(f); f.connect(g); g.connect(ambBus);
    g.gain.setTargetAtTime(cfg[2], ctx.currentTime, 0.8); s.start(); lfo.start();
    amb = { s: s, g: g }; ambTimer = 1;
  };
  window.ZRAudio = A;
})();
