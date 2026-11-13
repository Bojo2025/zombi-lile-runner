# ZOMBI LILE RUNNER

A mobile-first 2D auto-runner set in Mauritius. Kevin runs on his own from Port Louis to Samara.
You jump, slide and swing the sabre. There are no guns, and only a cut to the head (or a full
cleave) kills a zombie. Stomping a zombie or hitting its body only makes it stagger.

This game is separate from the 3D **Zombi Lile** game in `../zombi-lile/`, which has not been changed.

## How to run

**On a PC or Mac:** unzip `zombi-lile-runner.zip` and double-click `index.html`. It opens in Chrome, Edge, Firefox or Safari.
You don't need a server, an install or an internet connection. All images are embedded in `js/assets.js` and every sound is synthesised live.
Sound starts after your first click or key press, because browsers block sound until you interact.

**On a phone:** a phone can't open a local `index.html` from a zip very easily, so use one of these:
1. Put the folder on any static web host (GitHub Pages, Netlify drop, or your own site) and open the URL on the phone.
   For example, upload the folder to `https://yoursite/zombi-lile-runner/`.
2. Or run `python3 -m http.server 8000` in this folder on your PC, then open `http://<PC-IP>:8000` on a phone connected to the same Wi-Fi.
3. On Android, you can also copy the folder to the phone and open `index.html` in a file-browser app that opens it in Chrome.

Hold the phone sideways (landscape). In portrait you'll see a "turn your phone" hint with a *Play anyway* button.
On iPhone, use **Share → Add to Home Screen** to get it full screen.

### URL options
| Option | What it does |
|---|---|
| `index.html?level=5` | RUN! starts at level 5 (1-8) |
| `index.html?demo=1` | Demo mode: the game plays itself (autopilot) and moves through the levels in order |
| `index.html?demo=1&level=8` | Demo of the Samara finale and the Gran Zombi boss |
| `&capture=1` | Frame-stepped rendering, used by the test and recording scripts |

## Controls

| Action | Phone (touch) | Keyboard |
|---|---|---|
| Jump (hold for higher, tap again in the air to double-jump with a flip) | Tap the **left half** of the screen, or swipe up | Space, ↑ or W |
| Slide (swipe down in the air to drop fast and slide on landing) | **Swipe down** anywhere | ↓ or S |
| Sabre, 1 tap: **head chop** (slices the head off) | Tap the **right half** | X, J, K, Enter or → |
| Sabre, 2 quick taps: **cleave** (cuts the zombie in half; works on big brutes and smashes boulders) | Double-tap the right half | Press twice quickly |
| Sabre, 3 quick taps: **spin storm** (spinning slash that kills every zombie around you; needs a full SPIN meter) | Triple-tap the right half | Press three times quickly |
| Pause | ‖ button | P or Esc |

The tutorial overlay explains this on the first RUN! (and any time under HOW TO PLAY), and a hint overlay shows for the first seconds of each level.
- **SPIN meter** (bottom right): each kill fills it by 20%. When it's full it flashes "SPIN x3!".
- **Brutes** (big zombies) are too tall for a normal chop. Slide under them, chop their head while jumping, or cleave them.
- **Crawlers**: jump over them or chop them low. **Overhead obstacles** (banners, parasols, branches, rock overhangs, the boat boom, irrigation pipes): slide under. **Low obstacles** and **gaps** (harbour water, ravines, the sea between pirogues): jump.
- **Power-ups:** **Dholl puri** = +1 heart. **Gato piment** = fire sabre for 9 s (longer reach, SPIN refills). **Alouda** = coin magnet and double score for 9 s. **Rs coins** = +10 points each.
- You start with 3 hearts (5 max) and get +1 heart for clearing a level. Hitting a zombie, an obstacle or falling in water costs a heart.
- **Game over** offers "try this level again" or a restart from Port Louis. Your best score is saved in the browser (localStorage).

## The 8 levels (in order)
1. **Port Louis**: Caudan Waterfront, the harbour cranes, Marché Central and colonial facades, with harbour-water gaps between the quays.
2. **Pereybere Beach**: zombie swimmers (rotting cartoon undead in trunks and one-piece swimsuits), and reef fish that leap out of the lagoon and turn into zombies mid-air.
3. **Chamarel Forest**: the waterfall gorge and the Seven Coloured Earths. Hikers turn into zombies right in front of you, and monkeys turn into zombie monkeys and leap from the trees.
4. **Le Pouce Climb**: an uphill run with diagonal scrolling toward Le Pouce and Pieter Both. Zombies stagger down the trail and boulders roll down (jump them or cleave them).
5. **Flic-en-Flac Beach**: zombie tourists with sunburn, Hawaiian shirts, sun hats, caps and cameras, plus sun loungers, parasols and coolers.
6. **Pirogue Run**: open sea, jumping from boat to boat. Zombies climb over the side and leap from passing boats, with lightning storms.
7. **Sugar Cane Fields**: cane cutters in straw hats, crawlers hidden in the rows, cane carts and bundles. This level is faster.
8. **Samara**: Le Morne Brabant at a blood-red sunset, the last beach. It ends with the boss **GRAN ZOMBI** (14 HP): slide under his swipe, jump or bat away the heads he throws, and chop or cleave him. Then you get the **MAURITIUS IS SAVED!** victory screen.

Speed, zombie density and group sizes increase across the campaign and within each level.

## Sound and music
Everything is generated with the WebAudio API in `js/audio.js`. There are no audio files.
- **Music:** a dark horror score that builds as you go. It starts with a low drone and heartbeat kick, then adds a bass ostinato, hats and snare, an eerie arpeggio through a delay, and dissonant string stabs. The tempo rises from about 86 to 136 BPM with level and distance, and there's a separate boss mode. The title screen has its own music-box and heartbeat theme.
- **Sound effects:** sabre swing, cleave, spin, wet decapitation chop, splats, stomp, hurt, coins, power-ups, splashes, zombie moans, monkey screech, the transformation sound and the boss roar.
- **Ambience for each level:** city hum and sirens, waves and gulls, forest birds, mountain wind, storm and thunder at sea, rustling cane and crows.

## File structure
```
zombi-lile-runner/
├── index.html            # entry point (open this)
├── README.md
├── css/style.css         # full-screen responsive layout, menus, rotate hint
├── js/
│   ├── assets.js         # all artwork embedded as base64 data URIs (works from file://)
│   ├── audio.js          # WebAudio synth: SFX, adaptive music, ambience
│   ├── levels.js         # the 8-level campaign definition
│   ├── art.js            # vector puppets: Kevin, zombies, monkeys, fish, obstacles, pickups, parallax scenery
│   └── game.js           # engine: physics, combat/combos, spawning, boss, particles, HUD, title intro, input, demo autopilot
├── assets/
│   ├── hero_head.png, hero_keyart.png       # cartoon Kevin (generated from his photo, background removed)
│   ├── zombie_head_0..2.png                 # zombie head art
│   ├── title_bg.jpg, bg1..bg8_*.jpg         # title + level background paintings
│   └── source/                              # Kevin's original photo + raw generated art
├── tools/
│   ├── make_assets.py    # cut-out/resize the art and rebuild js/assets.js (Pillow + numpy)
│   ├── test_headless.js  # headless Chrome test (desktop + mobile touch emulation), writes screenshots/
│   ├── record_preview.js # records preview/runner-preview.mp4 (needs ffmpeg)
│   ├── art_test.html     # sprite sheet viewer for the character art
│   └── shot.js           # helper used with art_test.html
├── screenshots/          # title, tutorial, level select, every level (x2), boss, game over, victory, mobile
└── preview/runner-preview.mp4   # 10 s gameplay preview (Port Louis → Pereybere → Pirogue Run)
```

## How it's built
- **Kevin** is a skeletal vector puppet (polo, jeans, arms, legs and sabre) wearing a cartoon head drawn from his photo.
  He has poses for running, jumping, a double-jump somersault, sliding, the slash arc, the overhead cleave, the spin storm and getting hurt, and they animate smoothly at any resolution.
- **Zombies** are hunched, limping puppets with torn jagged clothes and reaching clawed hands, wearing generated zombie heads. There are outfit sets for each level.
  Decapitations send the head spinning off while the body staggers with a blood fountain and falls. Cleaves cut a snapshot of the zombie into two halves that fly apart.
- **Rendering:** a full-screen canvas scaled for devicePixelRatio (capped for performance). It's landscape-first, and portrait shows extra sky. Touch scrolling and zoom are disabled.

## Testing
```
npm i puppeteer-core        # once, anywhere
NODE_PATH=<that>/node_modules node tools/test_headless.js     # → "NO CONSOLE ERRORS" + screenshots/
NODE_PATH=<that>/node_modules node tools/record_preview.js    # → preview/runner-preview.mp4
```
The test loads the game from `file://` in headless Chrome. It plays all 8 levels to the end in demo mode, beats the boss, and opens the game over and victory screens.
It also emulates an 844×390 phone with touch (tap left to jump, tap right to slash, swipe down to slide) and a portrait rotation.

## Known limitations
- It has only been tested in headless Chrome (desktop and mobile emulation). It hasn't been tried on a real iPhone or Android phone, so frame rate on older phones is unknown.
- Difficulty hasn't been tuned by a human player yet. The level layouts are generated from a seed, with a new seed for each run.
- The preview video has no sound, because the audio is synthesised live in the browser.
