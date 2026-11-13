// ZOMBI LILE RUNNER - WebAudio synth: sound effects, adaptive horror music, per-level ambience,
// loud combat SFX, music ducking, and Mauritian Creole hero voice lines (see js/voice.js).
// Audio starts after the first user gesture (browser autoplay rule), including an iOS silent-buffer unlock.
(function () {
  'use strict';
  var A = {}, ctx = null, master, musicBus, sfxBus, voiceBus, ambBus, delay, delayFb, limiter, comp, noiseBuf = null;
  var muted = false, musicOn = false, mode = 'title', intensity = 0, nextStep = 0, step = 0;
  var drone = null, amb = null, ambKind = null, ambTimer = 0, musicGain = 0.34;
  var voiceBufs = {}, voiceReady = false, lastVoiceAt = {}, voiceUnlockTried = false;

  function ACCtor() { return window.AudioContext || window.webkitAudioContext; }

  function setupGraph() {
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3.5;
    comp.attack.value = 0.004; comp.release.value = 0.16;
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
    limiter.attack.value = 0.001; limiter.release.value = 0.06;
    master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = musicGain; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.85; sfxBus.connect(master);
    voiceBus = ctx.createGain(); voiceBus.gain.value = 2.4; voiceBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.28; ambBus.connect(master);
    delay = ctx.createDelay(1.0); delay.delayTime.value = 0.33; delayFb = ctx.createGain(); delayFb.gain.value = 0.38;
    var dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2200;
    delay.connect(dl); dl.connect(delayFb); delayFb.connect(delay); dl.connect(musicBus);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextStep = ctx.currentTime + 0.1;
  }

  function silentUnlock() {
    // iOS / WebKit: a silent buffer started inside the user-gesture call stack unlocks audio.
    try {
      var b = ctx.createBuffer(1, 1, ctx.sampleRate);
      var s = ctx.createBufferSource(); s.buffer = b; s.connect(master); s.start(0);
    } catch (e) {}
  }

  A.init = function () {
    var AC = ACCtor(); if (!AC) return;
    if (!ctx) { ctx = new AC(); setupGraph(); decodeVoices(); }
    if (ctx.state === 'suspended') {
      var p = ctx.resume();
      if (p && p.catch) p.catch(function () {});
    }
    silentUnlock();
  };
  A.ready = function () { return !!ctx; };
  A.setMuted = function (m) { muted = m; if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05); };
  A.isMuted = function () { return muted; };
  A.suspend = function () { if (ctx && ctx.state === 'running') ctx.suspend(); };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); silentUnlock(); };

  function env(g, t, a, peak, dec, sus, rel, len) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sus), t + a + dec);
    if (len !== undefined) { g.gain.setValueAtTime(Math.max(0.0001, sus), t + len); g.gain.exponentialRampToValueAtTime(0.0001, t + len + rel); }
  }
  function osc(type, f, t, len, vol, dest, opt) {
    opt = opt || {};
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.to), t + (opt.toT || len));
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
    if (opt.fTo) fl.frequency.exponentialRampToValueAtTime(Math.max(1, opt.fTo), t + len);
    var g = ctx.createGain(); env(g, t, opt.a || 0.004, vol, opt.d || len * 0.6, opt.s || 0.0001, opt.r || 0.04, len);
    s.connect(fl); fl.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + len + 0.2);
  }

  // Brief music duck so combat SFX and shouts sit on top of the score.
  A.duck = function (amount, hold, rise) {
    if (!ctx || !musicBus) return;
    var t = ctx.currentTime, g = musicBus.gain;
    var a = amount == null ? 0.75 : amount;
    hold = hold == null ? 0.16 : hold;
    rise = rise == null ? 0.18 : rise;
    try { g.cancelScheduledValues(t); } catch (e) {}
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(musicGain * (1 - a), t + 0.025);
    g.linearRampToValueAtTime(musicGain, t + 0.025 + hold + rise);
  };

  function steelSwoosh(t, vol) {
    noise(t, 0.18, vol * 0.95, 'bandpass', 5200, null, { fTo: 700, q: 3.2, a: 0.002 });
    noise(t, 0.12, vol * 0.55, 'highpass', 5000, null, { fTo: 1400, q: 0.8 });
    osc('sine', 2100, t, 0.14, vol * 0.28, null, { to: 420, lp: 5000 });
    osc('triangle', 1400, t, 0.1, vol * 0.16, null, { to: 280 });
  }
  function fleshChop(t, vol) {
    noise(t, 0.08, vol * 1.05, 'highpass', 2200);
    noise(t + 0.02, 0.22, vol * 0.85, 'lowpass', 800, null, { q: 3.2 });
    noise(t + 0.01, 0.12, vol * 0.45, 'bandpass', 1400, null, { q: 2 });
    osc('sine', 200, t, 0.16, vol * 0.7, null, { to: 55 });
    osc('square', 90, t, 0.07, vol * 0.18, null, { to: 40, lp: 400 });
  }
  function deathGroan(t, vol) {
    var f = 90 + Math.random() * 50, len = 0.45 + Math.random() * 0.2;
    osc('sawtooth', f * 1.2, t, len, vol * 0.45, null, { to: f * 0.7, lp: 700, a: 0.04, d: len * 0.5, s: vol * 0.2, r: 0.12 });
    noise(t, len, vol * 0.22, 'bandpass', 400, null, { q: 3, a: 0.05 });
  }

  // ---------------- SFX ----------------
  A.sfx = function (name, p) {
    if (!ctx || muted) return; var t = ctx.currentTime; p = p || 0;
    switch (name) {
      case 'jump': osc('square', 260, t, 0.12, 0.22, null, { to: 520, lp: 1800 }); break;
      case 'djump': osc('square', 380, t, 0.12, 0.2, null, { to: 820, lp: 2400 }); noise(t, 0.12, 0.14, 'highpass', 2500); break;
      case 'land': noise(t, 0.08, 0.28, 'lowpass', 400); break;
      case 'slide': noise(t, 0.35, 0.3, 'bandpass', 900, null, { fTo: 300, q: 0.7 }); break;
      case 'swing':
        steelSwoosh(t, 1.05); A.duck(0.55, 0.1, 0.12); break;
      case 'cleave':
        steelSwoosh(t, 1.1); fleshChop(t + 0.03, 1.15);
        osc('sawtooth', 160, t, 0.28, 0.28, null, { to: 50, lp: 900 });
        deathGroan(t + 0.06, 0.9); A.duck(0.8, 0.22, 0.2); break;
      case 'spin':
        for (var i = 0; i < 4; i++) steelSwoosh(t + i * 0.09, 0.85);
        fleshChop(t + 0.12, 1.0); fleshChop(t + 0.28, 0.9);
        osc('sawtooth', 120, t, 0.5, 0.28, null, { to: 480, lp: 1500 });
        deathGroan(t + 0.15, 0.85); A.duck(0.85, 0.35, 0.25); break;
      case 'chop':
        steelSwoosh(t, 0.7); fleshChop(t, 1.2); deathGroan(t + 0.05, 1.0);
        A.duck(0.8, 0.2, 0.18); break;
      case 'splat': noise(t, 0.25, 0.5, 'lowpass', 500, null, { q: 4 }); osc('sine', 120, t, 0.12, 0.35, null, { to: 40 }); break;
      case 'thud': osc('sine', 140, t, 0.18, 0.55, null, { to: 45 }); noise(t, 0.1, 0.35, 'lowpass', 600); break;
      case 'stomp': osc('square', 200, t, 0.1, 0.22, null, { to: 90, lp: 900 }); noise(t, 0.08, 0.3, 'lowpass', 800); break;
      case 'hurt': osc('sawtooth', 300, t, 0.3, 0.35, null, { to: 90, lp: 1400 }); noise(t, 0.2, 0.3, 'bandpass', 1200); A.duck(0.4, 0.15, 0.15); break;
      case 'coin': osc('square', 988, t, 0.06, 0.16, null, { lp: 4000 }); osc('square', 1319, t + 0.06, 0.12, 0.16, null, { lp: 4000 }); break;
      case 'power': [523, 659, 784, 1047].forEach(function (f, k) { osc('triangle', f, t + k * 0.07, 0.14, 0.22, null, { send: 0.3 }); }); break;
      case 'heal': [392, 523, 659].forEach(function (f, k) { osc('sine', f, t + k * 0.08, 0.25, 0.24, null, { send: 0.3 }); }); break;
      case 'splash': noise(t, 0.5, 0.45, 'lowpass', 1400, null, { fTo: 300 }); noise(t, 0.15, 0.3, 'highpass', 3000); break;
      case 'turn': osc('sawtooth', 90, t, 0.9, 0.2, null, { to: 60, lp: 600, detune: 15 }); noise(t, 0.6, 0.2, 'bandpass', 500, null, { q: 6 }); break;
      case 'moan': A.moan(p); break;
      case 'screech': osc('sawtooth', 900, t, 0.3, 0.22, null, { to: 1500, lp: 3000, q: 6 }); osc('sawtooth', 950, t, 0.3, 0.14, null, { to: 1400, lp: 3000 }); break;
      case 'roar': osc('sawtooth', 70, t, 1.2, 0.55, null, { to: 45, lp: 700, q: 4 }); osc('sawtooth', 73, t, 1.2, 0.4, null, { to: 48, lp: 500 }); noise(t, 1.1, 0.4, 'bandpass', 300, null, { q: 2 }); A.duck(0.7, 0.6, 0.3); break;
      case 'level': [440, 554, 659, 880].forEach(function (f, k) { osc('triangle', f, t + k * 0.12, 0.35, 0.24, null, { send: 0.4 }); }); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, k) { osc('triangle', f, t + k * 0.14, 0.4, 0.26, null, { send: 0.4 }); osc('square', f / 2, t + k * 0.14, 0.3, 0.08, null, { lp: 1200 }); }); break;
      case 'over': [330, 311, 294, 220].forEach(function (f, k) { osc('sawtooth', f, t + k * 0.28, 0.4, 0.22, null, { lp: 900, send: 0.4 }); }); break;
      case 'click': osc('square', 660, t, 0.04, 0.12, null, { lp: 3000 }); break;
      case 'thunder': noise(t, 2.2, 0.7, 'lowpass', 220, null, { a: 0.05, d: 1.5, s: 0.05 }); break;
      case 'pistol':
        noise(t, 0.07, 0.85, 'lowpass', 1800); osc('square', 420, t, 0.05, 0.55, null, { to: 90, lp: 2400 });
        osc('sine', 180, t, 0.08, 0.45, null, { to: 50 }); A.duck(0.55, 0.08, 0.1); break;
      case 'shotgun':
        noise(t, 0.22, 1.05, 'lowpass', 1400); noise(t, 0.12, 0.7, 'bandpass', 900, null, { q: 0.6 });
        osc('sine', 90, t, 0.16, 0.7, null, { to: 30 }); osc('square', 200, t, 0.08, 0.4, null, { to: 60, lp: 800 });
        A.duck(0.8, 0.16, 0.16); break;
      case 'rocket':
        noise(t, 0.18, 0.45, 'bandpass', 600, null, { fTo: 300, q: 0.8 });
        osc('sawtooth', 240, t, 0.35, 0.35, null, { to: 80, lp: 900 });
        osc('sine', 140, t, 0.3, 0.25, null, { to: 50 }); break;
      case 'explode':
        osc('sine', 70, t, 0.45, 0.95, null, { to: 22 }); osc('sawtooth', 55, t, 0.5, 0.55, null, { to: 20, lp: 400 });
        noise(t, 0.55, 1.05, 'lowpass', 500); noise(t + 0.04, 0.3, 0.55, 'highpass', 2000);
        A.duck(0.9, 0.35, 0.28); break;
      case 'spit':
        noise(t, 0.2, 0.4, 'bandpass', 1200, null, { q: 3 }); osc('square', 260, t, 0.16, 0.18, null, { to: 120, lp: 1400 }); break;
      case 'armor':
        osc('square', 620, t, 0.08, 0.35, null, { to: 280, lp: 3000 }); osc('triangle', 880, t, 0.1, 0.22, null, { to: 400 });
        noise(t, 0.08, 0.3, 'highpass', 3000); break;
      case 'engine':
        osc('sawtooth', 70, t, 0.18, 0.16, null, { to: 90, lp: 400 }); noise(t, 0.18, 0.12, 'lowpass', 250); break;
    }
  };
  A.moan = function (pitch) {
    if (!ctx || muted) return; var t = ctx.currentTime, f = 85 + (pitch || Math.random()) * 70, len = 0.9 + Math.random() * 0.6;
    var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f * 1.15, t); o.frequency.linearRampToValueAtTime(f, t + len * 0.4); o.frequency.linearRampToValueAtTime(f * 0.8, t + len);
    var vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 5 + Math.random() * 3; vg.gain.value = 4; vib.connect(vg); vg.connect(o.frequency);
    var f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.setValueAtTime(500, t); f1.frequency.linearRampToValueAtTime(320, t + len); f1.Q.value = 5;
    var f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1100; f2.Q.value = 7;
    var g = ctx.createGain(); env(g, t, 0.12, 0.35, len * 0.5, 0.18, 0.2, len);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(sfxBus);
    o.start(t); vib.start(t); o.stop(t + len + 0.4); vib.stop(t + len + 0.4);
  };

  // ---------------- Voice lines (Creole shouts) ----------------
  function dataUriToBuf(uri) {
    var raw = atob(uri.split(',')[1]), buf = new ArrayBuffer(raw.length), v = new Uint8Array(buf);
    for (var i = 0; i < raw.length; i++) v[i] = raw.charCodeAt(i);
    return buf;
  }
  function decodeVoices() {
    var lines = window.ZR_VOICE_LINES || [];
    if (!ctx || !lines.length) return;
    var left = lines.length;
    lines.forEach(function (line) {
      if (!line.data) { left--; if (!left) voiceReady = true; return; }
      try {
        ctx.decodeAudioData(dataUriToBuf(line.data).slice(0), function (buf) {
          voiceBufs[line.event] = buf; left--; if (!left) voiceReady = true;
        }, function () { left--; if (!left) voiceReady = true; });
      } catch (e) { left--; if (!left) voiceReady = true; }
    });
  }
  function speakFallback(text) {
    if (!text || typeof speechSynthesis === 'undefined') return;
    try {
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR'; u.rate = 1.12; u.pitch = 0.9; u.volume = 1;
      var vs = speechSynthesis.getVoices() || [], fr = null;
      for (var i = 0; i < vs.length; i++) if ((vs[i].lang || '').toLowerCase().indexOf('fr') === 0) { fr = vs[i]; break; }
      if (fr) u.voice = fr;
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function playBuffer(buf, dest, vol) {
    var s = ctx.createBufferSource(), g = ctx.createGain();
    g.gain.value = vol || 1;
    s.buffer = buf; s.connect(g); g.connect(dest || voiceBus); s.start(0);
  }
  // Play the line mapped to this event. Cooldowns stop spam (hurt / low-health / jump especially).
  var VOICE_CD = { jump: 0.16, hurt: 1.5, lowhp: 6, chop: 0.5, cleave: 0.55, spin: 0.9,
    weapon: 1.2, vehicle: 1.2, bossIn: 3, bossOut: 3, clear: 3, levelStart: 3 };
  A.voice = function (event) {
    if (!event) return;
    if (!ctx) A.init();
    if (!ctx || muted) return;
    var now = ctx.currentTime;
    var cd = VOICE_CD[event] != null ? VOICE_CD[event] : 0.45;
    if (now - (lastVoiceAt[event] || -99) < cd) return;
    // hurt / lowhp may talk over a recent jump; other lines share a short global gap
    var gGap = (event === 'hurt' || event === 'lowhp') ? 0.12 : (event === 'jump' ? 0 : 0.32);
    if (gGap && now - (lastVoiceAt._any || -99) < gGap) return;
    lastVoiceAt[event] = now;
    if (event !== 'jump') lastVoiceAt._any = now;
    var line = null, lines = window.ZR_VOICE_LINES || [];
    for (var i = 0; i < lines.length; i++) if (lines[i].event === event) { line = lines[i]; break; }
    if (!line) return;
    A.duck(event === 'jump' ? 0.45 : 0.82, event === 'jump' ? 0.12 : 0.4, event === 'jump' ? 0.12 : 0.22);
    var buf = voiceBufs[event];
    if (buf && buf.length > 16) {
      playBuffer(buf, voiceBus, event === 'jump' ? 1.15 : 1.35);
    } else {
      speakFallback(line.text);
    }
  };

  // ---------------- Music ----------------
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
      if (s16 === 0 || s16 === 3) kick(t, s16 === 0 ? 0.45 : 0.3);
      var b = BELL[s % 32]; if (b) osc('sine', N(b), t, 1.2, 0.07, musicBus, { a: 0.003, d: 0.9, s: 0.002, detune: 8, send: 0.6 });
      if (s % 64 === 32) osc('sawtooth', N(57), t, 3, 0.03, musicBus, { a: 1.2, lp: 700, d: 1, s: 0.03, r: 1.5 });
      return;
    }
    if (s16 === 0 || s16 === 3 || (I > 0.6 && (s16 === 8 || s16 === 11))) kick(t, 0.5);
    if (I > 0.1 && BASS[s16]) osc('sawtooth', N(BASS[s16] - 12), t, 0.22, 0.2, musicBus, { lp: 300 + I * 900, lpTo: 120, q: 4, d: 0.15, s: 0.02 });
    if (I > 0.3) { if (s16 % 2 === 0 || I > 0.8) hat(t, s16 % 4 === 2 ? 0.07 : 0.035); if (s16 === 4 || s16 === 12) snare(t, 0.16); }
    if (I > 0.5 && s16 % (I > 0.85 ? 1 : 2) === 0) osc('square', N(ARP[(s + Math.floor(s / 64) * 4) % 16]), t, 0.1, 0.035, musicBus, { lp: 2600, d: 0.08, s: 0.003, send: 0.5 });
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

  // Headless / OfflineAudioContext peak test. Renders each named SFX into its own time slice
  // and returns { name, peak, rms } so we can prove the buffers are not silent.
  A.measureSfx = function (names) {
    names = names || ['swing', 'chop', 'cleave', 'spin'];
    var OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OC) return Promise.reject(new Error('no OfflineAudioContext'));
    var sr = 44100, slice = 0.7, dur = slice * names.length + 0.1;
    var oc = new OC(2, Math.ceil(sr * dur), sr);
    var saved = { ctx: ctx, master: master, musicBus: musicBus, sfxBus: sfxBus, voiceBus: voiceBus, ambBus: ambBus, delay: delay, noiseBuf: noiseBuf, muted: muted };
    ctx = oc; muted = false; setupGraph();
    names.forEach(function (n, i) {
      var t0 = oc.currentTime; // always 0 at this point
      // shift by temporarily wrapping currentTime — Offline starts at 0, so schedule by faking start via delay in our sfx by using a scheduled version.
      // Our sfx uses ctx.currentTime (0). Instead, call a delayed version:
      (function (name, when) {
        var orig = oc.currentTime;
        // monkey-patch: generate at 'when' by temporarily defining a local t.
        A.sfx._at = when;
      })(n, i * slice);
    });
    // Directly schedule each sfx at i*slice by jumping a fake clock:
    // Re-implement scheduling: call internal after setting a fake currentTime is impossible.
    // So inject a start offset by wrapping A.sfx's t.
    return (function () {
      // Recreate: call the raw generators at offsets by swapping a getT.
      // Simplest reliable approach: startRendering after scheduling via a local helper.
      // We'll rebuild buses already done; now schedule by copying sfx with offset.
      // Use Oscillator/noise through the existing functions by offsetting ctx via a proxy is hard.
      // Instead, call A.sfx in a loop after moving a global tOffset.
      return Promise.resolve();
    })().then(function () {
      // schedule properly
      var realSfx = A.sfx;
      // Temporarily wrap currentTime
      var times = [];
      names.forEach(function (n, i) {
        times.push(i * slice);
      });
      // Because AudioContext.currentTime is 0 and read-only, we schedule by creating
      // a second setup: call generators with explicit t. We'll just fire all at 0 in
      // separate offline contexts instead (simpler, always correct).
      ctx = saved.ctx; master = saved.master; musicBus = saved.musicBus; sfxBus = saved.sfxBus;
      voiceBus = saved.voiceBus; ambBus = saved.ambBus; delay = saved.delay; noiseBuf = saved.noiseBuf; muted = saved.muted;
      return measureEach(names, OC, sr, slice);
    });
  };
  function measureEach(names, OC, sr, slice) {
    var results = [];
    function one(i) {
      if (i >= names.length) return Promise.resolve(results);
      var oc = new OC(2, Math.ceil(sr * slice), sr);
      var saved = { ctx: ctx, master: master, musicBus: musicBus, sfxBus: sfxBus, voiceBus: voiceBus, ambBus: ambBus, delay: delay, noiseBuf: noiseBuf, muted: muted, drone: drone, amb: amb };
      ctx = oc; muted = false; drone = null; amb = null; setupGraph();
      A.sfx(names[i]);
      return oc.startRendering().then(function (buf) {
        var ch0 = buf.getChannelData(0), ch1 = buf.getChannelData(1);
        var peak = 0, sum = 0;
        for (var n = 0; n < ch0.length; n++) {
          var v = Math.max(Math.abs(ch0[n]), Math.abs(ch1[n]));
          if (v > peak) peak = v;
          sum += v * v;
        }
        results.push({ name: names[i], peak: peak, rms: Math.sqrt(sum / ch0.length) });
        ctx = saved.ctx; master = saved.master; musicBus = saved.musicBus; sfxBus = saved.sfxBus;
        voiceBus = saved.voiceBus; ambBus = saved.ambBus; delay = saved.delay; noiseBuf = saved.noiseBuf;
        muted = saved.muted; drone = saved.drone; amb = saved.amb;
        return one(i + 1);
      });
    }
    return one(0);
  }
  A.voiceEvents = function () { return (window.ZR_VOICE_LINES || []).map(function (l) { return l.event; }); };
  A.voiceDecoded = function () { return Object.keys(voiceBufs); };
  window.ZRAudio = A;
})();
