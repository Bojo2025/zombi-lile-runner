#!/usr/bin/env python3
"""Generate Mauritian Creole hero voice clips (French TTS) and write js/voice.js.

Requires a Piper binary + a French fr_FR model (the Tom medium voice is a good default).

  PIPER=/path/to/piper PIPER_MODEL=/path/to/fr_FR-tom-medium.onnx python3 tools/make_voices.py

To add or change a line, edit LINES below and re-run this script.
"""
import base64, os, subprocess, struct, sys, tempfile, wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PIPER = os.environ.get('PIPER', '/tmp/zr-tts/piper/piper')
MODEL = os.environ.get('PIPER_MODEL', '/tmp/zr-tts/voices/fr_FR-tom-medium.onnx')

# event: when the line plays in the game.
# text:  the written Creole (also used by the speechSynthesis fallback).
# say:   what we send to the French TTS (spelling tweaks for a clearer shout).
# scale: Piper length_scale (< 1 = faster, punchier).
LINES = [
    dict(event='levelStart', text='Ala mo vini',       say='Ala mo vini !',        scale=0.78, pitch=1.06),
    dict(event='jump',       text='Hep',               say='Hep !',                scale=0.52, pitch=1.12),
    dict(event='chop',       text='Ahhhh',             say='Aahhh !',              scale=1.05, pitch=1.03, tempo=0.30),
    dict(event='cleave',     text='Ala to la',         say='Ala to la !',          scale=0.72, pitch=1.07),
    dict(event='spin',       text='Mort ene fois ta',  say='Mort enn fois ta !',   scale=0.76, pitch=1.05),
    dict(event='weapon',     text='Gete sa!',          say='Geté sa !',            scale=0.70, pitch=1.08),
    dict(event='vehicle',    text='Anou ale!',         say='Anou allé !',          scale=0.68, pitch=1.10),
    dict(event='bossIn',     text='Enn gro zombi!',    say='Enn gro zombi !',      scale=0.74, pitch=1.00),
    dict(event='bossOut',    text='Fini toi!',         say='Fini toi !',           scale=0.68, pitch=1.06),
    dict(event='hurt',       text='Aie!',              say='Aïe !',                scale=0.52, pitch=1.16),
    dict(event='lowhp',      text='Atansion!',         say='Atansion !',           scale=0.70, pitch=1.04),
    dict(event='clear',      text='Bravo!',            say='Bravo !',              scale=0.68, pitch=1.08),
]


def run(cmd):
    subprocess.check_call(cmd)


def generate_raw(line, dest):
    env = os.environ.copy()
    env['LD_LIBRARY_PATH'] = str(Path(PIPER).parent) + (':' + env['LD_LIBRARY_PATH'] if env.get('LD_LIBRARY_PATH') else '')
    p = subprocess.run(
        [PIPER, '-m', MODEL, '--length_scale', str(line['scale']),
         '--sentence_silence', '0.02', '--noise_scale', '0.5', '--noise_w', '0.6',
         '-f', str(dest)],
        input=(line['say'] + '\n').encode(),
        env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if p.returncode != 0:
        sys.stderr.write(p.stderr.decode() + '\n')
        raise SystemExit('piper failed for ' + line['text'])


def process(src, dest, pitch, tempo=1.06):
    # Trim, pitch-shift slightly, add presence + grit, compress hard, limit.
    # Two-pass loudnorm to a loud, broadcast-style shout.
    af1 = (
        f'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.015:detection=peak,'
        f'areverse,'
        f'silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.06:detection=peak,'
        f'areverse,'
        f'rubberband=pitch={pitch}:tempo={tempo},'
        f'highpass=f=90,lowpass=f=8500,'
        f'equalizer=f=2800:width_type=h:width=1800:g=6,'
        f'equalizer=f=900:width_type=h:width=400:g=2,'
        f'crystalizer=i=3,'
        f'acompressor=threshold=-22dB:ratio=8:attack=2:release=50:makeup=10,'
        f'alimiter=limit=0.97:level=true'
    )
    tmp = dest.with_suffix('.tmp.wav')
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(src), '-af', af1, '-ar', '22050', '-ac', '1', str(tmp)])
    # second pass: loudness to a very present shout
    run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(tmp),
         '-af', 'loudnorm=I=-9:LRA=5:TP=-0.6:linear=true',
         '-ar', '22050', '-ac', '1', str(dest)])
    tmp.unlink(missing_ok=True)


def peak_db(path):
    with wave.open(str(path), 'rb') as w:
        data = w.readframes(w.getnframes())
        n = w.getnframes()
        samples = struct.unpack('<' + 'h' * n, data)
    peak = max(abs(s) for s in samples) / 32768.0
    import math
    db = -120 if peak <= 0 else 20 * math.log10(peak)
    return peak, db, n / w.getframerate()


def main():
    if not Path(PIPER).is_file() or not Path(MODEL).is_file():
        raise SystemExit('Piper or model missing. Set PIPER and PIPER_MODEL.')
    outdir = Path('/tmp/zr-tts/final')
    outdir.mkdir(parents=True, exist_ok=True)
    rawdir = Path('/tmp/zr-tts/raw2')
    rawdir.mkdir(parents=True, exist_ok=True)

    # Keep already-embedded clips (the original five lines stay bit-identical)
    # unless --force is passed. New events are always generated.
    existing = {}
    voice_js = ROOT / 'js' / 'voice.js'
    force = '--force' in sys.argv
    if voice_js.is_file() and not force:
        import re
        for m in re.finditer(r"\{\s*event:\s*'([^']+)'\s*,\s*text:\s*'([^']*)'\s*,\s*data:\s*'([^']+)'\s*\}", voice_js.read_text()):
            existing[m.group(1)] = m.group(3)

    entries = []
    for line in LINES:
        raw = rawdir / (line['event'] + '.wav')
        final = outdir / (line['event'] + '.wav')
        if line['event'] in existing and existing[line['event']].startswith('data:audio'):
            print('keep', line['event'], '(existing clip)')
            entries.append((line, existing[line['event']].split(',', 1)[1] if ',' in existing[line['event']] else existing[line['event']]))
            continue
        print('tts', line['event'], repr(line['say']))
        generate_raw(line, raw)
        process(raw, final, line['pitch'], line.get('tempo', 1.06))
        peak, db, dur = peak_db(final)
        print(f"  -> {final.name}: {dur:.2f}s  peak={peak:.3f} ({db:.1f} dBFS)")
        if peak < 0.25:
            raise SystemExit(f'clip {line["event"]} is too quiet (peak {peak})')
        b64 = base64.b64encode(final.read_bytes()).decode('ascii')
        entries.append((line, b64))

    js = []
    js.append('// ZOMBI LILE RUNNER - hero voice lines (Mauritian Creole, French TTS).')
    js.append('//')
    js.append('// Each entry maps to exactly one game event (do not play a random line).')
    js.append('//   event: levelStart | jump | chop | cleave | spin | weapon | vehicle | bossIn | bossOut | hurt | lowhp | clear')
    js.append('//   text:  the spoken Creole; also used by the speechSynthesis fr-FR fallback')
    js.append('//   data:  loud 22 kHz mono WAV, base64 (works from file://)')
    js.append('//')
    js.append('// To change a line:')
    js.append('//   1. Edit LINES in tools/make_voices.py (text + optional "say" spelling).')
    js.append('//   2. Run:  PIPER=... PIPER_MODEL=... python3 tools/make_voices.py')
    js.append('// If you add a line but leave data as "", the game will use speechSynthesis.')
    js.append('(function () {')
    js.append("  'use strict';")
    js.append('  window.ZR_VOICE_LINES = [')
    for i, (line, b64) in enumerate(entries):
        comma = ',' if i < len(entries) - 1 else ''
        payload = b64 if str(b64).startswith('data:') else ('data:audio/wav;base64,' + b64)
        js.append(f"    {{ event: '{line['event']}', text: {line['text']!r}, data: '{payload}' }}{comma}")
    js.append('  ];')
    js.append('})();')
    dest = ROOT / 'js' / 'voice.js'
    dest.write_text('\n'.join(js) + '\n')
    print('wrote', dest, 'bytes', dest.stat().st_size)

if __name__ == '__main__':
    main()
