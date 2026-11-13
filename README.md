# ZOMBI LILE RUNNER

A mobile-first 2D auto-runner set in Mauritius. Kevin ("Bojo") runs on his own from Port Louis to Samara.
You jump, slide and swing the sabre. Pick up bigger blades, guns and even vehicles with rocket launchers while you run.
A cut to the head (or a full cleave) still kills a zombie with the sabre; stomping or a body hit only staggers it.
Every level is a long run that ends in a gauntlet and a multi-phase arena boss. The title screen reads **BOJO VS ZOMBIES** next to **ZOMBI LILE**.

This game is separate from the 3D **Zombi Lile** game in `../zombi-lile/`, which has not been changed.

## How to run

**On a PC or Mac:** unzip `zombi-lile-runner.zip` and double-click `index.html`. It opens in Chrome, Edge, Firefox or Safari.
You don't need a server, an install or an internet connection. All images are embedded in `js/assets.js` and every sound is synthesised live (hero shouts live in `js/voice.js`).
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
| Sabre, 2 quick taps: **cleave** (cuts the zombie in half; required for helmets; works on brutes and boulders) | Double-tap the right half | Press twice quickly |
| Sabre, 3 quick taps: **spin storm** (spinning slash that kills every zombie around you; needs a full SPIN meter) | Triple-tap the right half | Press three times quickly |
| Guns (pistol, shotgun, rocket) | **Auto-fire** while the gun is equipped. Tap-right is still the sabre. | Same: guns auto-fire, X/J still slashes |
| Vehicle rockets | Auto-fire, or tap the right half to fire | X / J also fires a rocket while you are riding |
| Pause | ‖ button | P or Esc |

The tutorial overlay explains this on the first RUN! (and any time under HOW TO PLAY), and a hint overlay shows for the first seconds of each level.
- **SPIN meter** (bottom right): each kill fills it by 20%. When it's full it flashes "SPIN x3!".
- **Brutes** are too tall for a normal chop. Slide under them, chop their head while jumping, or cleave them.
- **Tanks** need two sabre hits to stagger, then a head chop. A cleave, spin, shotgun or rocket skips the armour.
- **Helmets** bounce a single chop (and pistol shots). Cleave, spin, shotgun or rocket to break them.
- **Crawlers**: jump over them or chop them low. **Spitters** lob acid - swipe down and slide under it. **Flyers** (gulls or bats) come in at head height. **Bloaters** explode if you stay too close; kill them from range.
- **Overhead obstacles** (banners, parasols, branches, rock overhangs, the boat boom, irrigation pipes): slide under. **Low obstacles** and **gaps** (harbour water, ravines, the sea between pirogues): jump. Jet-skis and speedboats can ride the water.
- **Power-ups:** **Dholl puri** = +1 heart. **Gato piment** = fire sabre for 9 s (longer reach, SPIN refills). **Alouda** = coin magnet and double score for 9 s. **Rs coins** = +10 points each (also banked).
- **Weapon pickups** (crate with an icon, 14-18 s, plus ammo for guns): **Big Sabre** (longer reach, wider arc), **Pistol** (auto headshots), **Shotgun** (close spread, knocks a group back), **Rocket Launcher** (rare, splash explosion, heavy screen shake). Firearm kills count and heads still pop off. Guns also chip bosses, at reduced damage, so the arena fight still matters.
- **Vehicles** (themed per level, timed ride, own HP): jeep/4x4 (roads and the climb), jet-ski (beaches), quad (forest), speedboat (Pirogue Run), tractor (cane fields). You run zombies down and auto-fire (or tap-fire) rockets. When the timer ends or the vehicle's HP hits 0, Bojo is ejected.
- You start with 3 hearts (5 max) and get +1 heart for clearing a level. Hitting a zombie, an obstacle or falling in water costs a heart (or vehicle HP if you are riding).
- **Game over** offers "try this level again" or a restart from Port Louis. Your best score, coin bank, daily challenges and equipped outfit are saved in the browser (localStorage).

## Daily challenges and outfits

Each local day, the title screen offers **3 seeded daily challenges** (for example: kill 50 with the sabre only, collect a pile of Rs coins, beat a boss without getting hit, crush zombies from a vehicle). Progress and rewards are saved. Finishing one banks Rs.

**Outfits** tint the existing cartoon Bojo (no new photo art). Open OUTFITS from the title screen:

| Outfit | How to unlock |
|---|---|
| Navy Polo | Starting look |
| Teacher | Clear Port Louis |
| Dodo Shirt | Clear Flic-en-Flac |
| Sega Dancer | Finish 3 daily challenges (lifetime) |
| Commando | Clear all 8 levels |
| Golden Bojo | Bank 1,500 Rs, or collect 500 Rs in a single run |

SETTINGS (and the pause screen) toggle **phone vibration** on hits, big kills and explosions (`navigator.vibrate`, ignored where the phone does not support it).

## The 8 levels (in order)

Each run to the boss is about **3.5-4.2 minutes** (plus the arena fight). Waves, breather stretches, a mid-level named horde, weapon and vehicle pickups, and a short **gauntlet** just before the arena. Speed and density rise across the campaign and within each level. The HUD distance bar still tracks how far you are through the level.

1. **Port Louis** (~3.8 min, jeep): Caudan Waterfront, harbour cranes, Marché Central, harbour-water gaps. Dock horde mid-run. Boss: **GRAN DOCKER** (22 HP, 3 phases — charge, crate throws, dock-zombie minions, enrage).
2. **Pereybere Beach** (~3.8 min, jet-ski): zombie swimmers, reef fish that leap and turn mid-air, gulls, spitters. Reef surge mid-run. Boss: **REKIN ZOMBI** (24 HP — lunge, tail slam, zombie-fish minions).
3. **Chamarel Forest** (~3.9 min, quad): hikers turning in front of you, zombie monkeys, bats. The trees turn mid-run. Boss: **GRAN SINGE** (26 HP — charge, ground slam, monkey minions).
4. **Le Pouce Climb** (~4.2 min, jeep): uphill run toward Le Pouce and Pieter Both, boulders, tanks and helmets. Rockfall mid-run. Boss: **ROC GEANT** (28 HP — charge, boulder projectiles, ground slam).
5. **Flic-en-Flac Beach** (~3.8 min, jet-ski): mixed zombie tourists (sun hats, Hawaiian shirts, cameras — varied looks, not defined by race), spitters and bloaters. Tourist stampede mid-run. Boss: **THE BLOATER** (30 HP — belly charge, thrown heads, tourist minions).
6. **Pirogue Run** (~3.9 min, speedboat): open sea, boat to boat, boarding zombie sailors, leaping fish, storms. Boarding party mid-run. Boss: **KAPITENN LANMER** (32 HP — charge, thrown anchors, boarding minions).
7. **Sugar Cane Fields** (~4.0 min, tractor): cane-cutter zombies, crawlers in the rows, tanks and bloaters. Cane swarm mid-run. Boss: **GRAN KOUPE** (34 HP — charge, flung cane, crawler minions).
8. **Samara** (~3.6 min, jet-ski): Le Morne Brabant at a blood-red sunset. The last horde, then the final boss **GRAN ZOMBI** (40 HP, 3 phases). The killing blow plays in slow motion with a zoom-in. Then **MAURITIUS IS SAVED!**

When you reach the end of a level the auto-run locks into an arena and the level boss walks on.
Each boss now has **2-3 phases**. After a third of its health, and again near a third remaining, it roars, summons a minion wave and changes the mix of attacks. At low HP it **enrages** (faster charges, more projectiles and more minions). Body hits still only stagger; once staggered, a chop, cleave, spin or a gunshot to the head deals damage. The killing blow is a big decapitation (with slow-motion and zoom), then the next level (or the victory screen after Samara).

## Sound and music
Combat SFX and music are generated with the WebAudio API in `js/audio.js`. Hero shouts are short spoken clips in `js/voice.js`.
Sound starts after your first tap, click or key press (including an iOS silent-buffer unlock). Slash and gun sounds play loud over the music: SFX have a high gain bus, the master has a compressor and limiter, and a hit ducks the music briefly.
- **Hero voice (Mauritian Creole, French fr-FR TTS), mapped to exact events, with cooldowns so lines don't spam:**
  - Level start: **"Ala mo vini"**
  - Every jump: **"Hep"** (short, with a tiny cooldown)
  - Single-slash head chop (a kill): **"Ahhhh"**
  - Double-slash cleave: **"Ala to la"**
  - Triple-slash spin: **"Mort ene fois ta"**
  - Weapon pickup: **"Gete sa!"**
  - Vehicle pickup: **"Anou ale!"**
  - Boss appears: **"Enn gro zombi!"**
  - Boss killed: **"Fini toi!"**
  - Taking damage: **"Aie!"**
  - Low health: **"Atansion!"**
  - Level complete: **"Bravo!"**
  The list lives in `window.ZR_VOICE_LINES` in `js/voice.js`. To change a line, edit `LINES` in `tools/make_voices.py` and re-run that script (needs the Piper binary + a French model). Existing clips are kept bit-identical unless you pass `--force`. If a clip is missing or fails to decode, the game falls back to the browser's `speechSynthesis` with a `fr-FR` voice.
- **Music:** a dark horror score that builds as you go. It starts with a low drone and heartbeat kick, then adds a bass ostinato, hats and snare, an eerie arpeggio through a delay, and dissonant string stabs. The tempo rises from about 86 to 136 BPM with level and distance, and there's a separate boss mode. The title screen has its own music-box and heartbeat theme.
- **Sound effects:** sabre swing, cleave, spin, wet decapitation chop, pistol shot, shotgun blast, rocket whoosh, explosion, splat, stomp, hurt, coins, power-ups, splashes, zombie moans, monkey screech, the transformation sound, the boss roar and a light vehicle engine.
- **Ambience for each level:** city hum and sirens, waves and gulls, forest birds, mountain wind, storm and thunder at sea, rustling cane and crows.

## File structure
```
zombi-lile-runner/
├── index.html            # entry point (open this)
├── README.md
├── css/style.css         # full-screen responsive layout, menus, rotate hint
├── js/
│   ├── assets.js         # all artwork embedded as base64 data URIs (works from file://)
│   ├── voice.js          # Creole hero shouts as base64 WAVs (works from file://)
│   ├── audio.js          # WebAudio synth: SFX, music, ambience, voice playback, ducking
│   ├── levels.js         # the 8-level campaign, bosses, outfits and vehicle stats
│   ├── art.js            # vector puppets: Kevin, zombies, vehicles, guns, obstacles, pickups, parallax scenery
│   └── game.js           # engine: physics, combat, weapons, vehicles, bosses, dailies, outfits, HUD, input, demo
├── assets/               # source paintings and the cartoon Kevin head
├── tools/
│   ├── make_assets.py    # cut-out/resize the art and rebuild js/assets.js (Pillow + numpy)
│   ├── make_voices.py    # build js/voice.js from Piper French TTS (optional rebuild)
│   ├── test_headless.js  # headless Chrome test (desktop + mobile touch emulation), writes screenshots/
│   ├── record_preview.js # records preview/runner-preview.mp4 (needs ffmpeg)
│   ├── art_test.html     # sprite sheet viewer for the character art
│   └── shot.js           # helper used with art_test.html
├── screenshots/          # title, tutorial, levels, bosses, weapons, zombies, vehicle, outfits, dailies
└── preview/runner-preview.mp4
```

## How it's built
- **Kevin** is a skeletal vector puppet (polo, jeans, arms, legs and sabre) wearing a cartoon head drawn from his photo. Unlockable outfits retint the polo and jeans and add small overlays (a tie, a dodo print, a sega sash, commando webbing, a gold glow).
  He has poses for running, jumping, a double-jump somersault, sliding, the slash arc, the overhead cleave, the spin storm, riding a vehicle and getting hurt, and they animate smoothly at any resolution.
- **Zombies** are hunched, limping puppets with torn jagged clothes and reaching clawed hands, wearing generated zombie heads. There are outfit sets for each level, plus distinct silhouettes for sprinters, tanks, crawlers, leapers, spitters, helmets, bloaters, flyers, fish and monkeys.
  Decapitations send the head spinning off while the body staggers with a blood fountain and falls. Cleaves cut a snapshot of the zombie into two halves that fly apart. Gore stays cartoonish.
- **Rendering:** a full-screen canvas scaled for devicePixelRatio (capped for performance). It's landscape-first, and portrait shows extra sky. Touch scrolling and zoom are disabled.

## Testing
```
npm i puppeteer-core        # once, anywhere
NODE_PATH=<that>/node_modules node tools/test_headless.js     # → "NO CONSOLE ERRORS" + screenshots/
NODE_PATH=<that>/node_modules node tools/record_preview.js    # → preview/runner-preview.mp4
```
The test loads the game from `file://` in headless Chrome. It measures sabre and gun SFX through an OfflineAudioContext (peak amplitude must be audible), checks that all 12 voice clips decode, plays all 8 levels to the end in demo mode, snaps each arena boss (including a mid-fight phase change), beats all 8 bosses, and opens the game over, victory, outfits and daily-challenge screens.
It also emulates an 844×390 phone with touch (tap left to jump, tap right to slash, swipe down to slide) and a portrait rotation.

## Known limitations
- It has only been tested in headless Chrome (desktop and mobile emulation). It hasn't been tried on a real iPhone or Android phone, so frame rate on older phones is unknown. Vibration needs a real device; headless Chrome will ignore it.
- Difficulty hasn't been tuned by a human player yet. The level layouts are generated from a seed, with a new seed for each run.
- Daily challenges use the device's local date. There is no online leaderboard.
- The preview video has no sound, because the audio is synthesised live in the browser.
