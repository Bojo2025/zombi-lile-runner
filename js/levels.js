// ZOMBI LILE RUNNER - the 8-level campaign across Mauritius.
// enemies: weights for spawn picks. obstacles: kinds that can appear. terrain: flat | climb | boats.
// Every level ends in a gauntlet and then a multi-phase arena boss (see `boss`).
// vehicle: jeep | jetski | quad | boat | tractor — a ride-with-rockets pickup, themed per level.
window.ZR_LEVELS = [
  { id: 1, name: 'Port Louis', sub: 'Caudan Waterfront & the harbour', bg: 'bg1', length: 2520, speed: 330, terrain: 'flat', gaps: 0.18,
    ground: 'cobble', amb: 'city', fog: 'rgba(255,140,60,0.10)', tint: 'rgba(40,20,10,0.10)',
    enemies: { walker: 6, crawler: 2, brute: 1, sprinter: 3, tank: 1, helmet: 2, bloater: 1, flyer: 1, leaper: 1 },
    outfit: 'city', obstacles: ['crate', 'barrel', 'banner', 'bollard'], vehicle: 'jeep',
    event: { at: 0.48, kind: 'horde', types: ['walker', 'sprinter', 'tank', 'helmet'], n: 12, text: 'DOCK HORDE!' },
    intro: 'It starts here. The Caudan crowds are turning. Grab the sabre, steal a jeep on the quay, and face the GRAN DOCKER.',
    boss: { form: 'docker', name: 'GRAN DOCKER', title: 'THE GRAN DOCKER BLOCKS THE QUAY!', death: 'GRAN DOCKER DECAPITATED!', hp: 22, minion: 'walker', proj: 'crate' } },
  { id: 2, name: 'Pereybere Beach', sub: 'North coast lagoon', bg: 'bg2', length: 2680, speed: 350, terrain: 'flat', gaps: 0,
    ground: 'sand', amb: 'beach', fog: 'rgba(120,255,200,0.07)', tint: 'rgba(0,40,30,0.08)',
    enemies: { walker: 5, crawler: 2, fish: 4, brute: 1, sprinter: 2, spitter: 2, flyer: 2, bloater: 1, leaper: 2 },
    outfit: 'swim', obstacles: ['rock', 'parasol', 'pirogue', 'sandcastle'], vehicle: 'jetski',
    event: { at: 0.47, kind: 'horde', types: ['fish', 'flyer', 'leaper'], n: 10, text: 'REEF SURGE!' },
    intro: 'Swimmers have turned, and the reef fish are leaping out of the water. Ride a jet-ski. The REKIN ZOMBI waits in the lagoon.',
    boss: { form: 'shark', name: 'REKIN ZOMBI', title: 'THE REKIN ZOMBI BREACHES!', death: 'REKIN ZOMBI DECAPITATED!', hp: 24, minion: 'fish', proj: 'fish' } },
  { id: 3, name: 'Chamarel Forest', sub: 'Waterfall gorge & the Seven Coloured Earths', bg: 'bg3', length: 2840, speed: 365, terrain: 'flat', gaps: 0.14,
    ground: 'forest', amb: 'forest', fog: 'rgba(120,255,140,0.12)', tint: 'rgba(0,20,0,0.22)',
    enemies: { walker: 3, turner: 4, monkey: 4, crawler: 2, flyer: 2, leaper: 2, helmet: 1, tank: 1, spitter: 1 },
    outfit: 'hiker', obstacles: ['log', 'branch', 'roots', 'rock'], vehicle: 'quad',
    event: { at: 0.48, kind: 'horde', types: ['monkey', 'turner', 'flyer'], n: 11, text: 'THE TREES TURN!' },
    intro: 'Hikers are turning right in front of you, and the monkeys have caught it too. Grab a quad. GRAN SINGE rules this gorge.',
    boss: { form: 'gorilla', name: 'GRAN SINGE', title: 'GRAN SINGE DROPS FROM THE TREES!', death: 'GRAN SINGE DECAPITATED!', hp: 26, minion: 'monkey', proj: 'rock' } },
  { id: 4, name: 'Le Pouce Climb', sub: 'Up the ridge to Pieter Both', bg: 'bg4', length: 2760, speed: 330, terrain: 'climb', gaps: 0.1,
    ground: 'rock', amb: 'mountain', fog: 'rgba(200,160,255,0.10)', tint: 'rgba(30,0,40,0.12)',
    enemies: { walker: 4, brute: 2, crawler: 2, boulder: 3, tank: 2, helmet: 2, leaper: 2, flyer: 2, sprinter: 2 },
    outfit: 'hiker', obstacles: ['rock', 'overhang', 'rock'], vehicle: 'jeep',
    event: { at: 0.46, kind: 'horde', types: ['boulder', 'tank', 'helmet'], n: 9, text: 'ROCKFALL!' },
    intro: 'Climb! Zombies stagger down the trail and boulders roll from the summit. A jeep is parked on the ridge. The ROC GEANT is waiting.',
    boss: { form: 'rock', name: 'ROC GEANT', title: 'THE ROC GEANT AWAKENS!', death: 'ROC GEANT DECAPITATED!', hp: 28, minion: 'boulder', proj: 'rock' } },
  { id: 5, name: 'Flic-en-Flac Beach', sub: 'West coast, tourist season gone wrong', bg: 'bg5', length: 3000, speed: 395, terrain: 'flat', gaps: 0,
    ground: 'sand', amb: 'beach', fog: 'rgba(255,220,140,0.08)', tint: 'rgba(40,20,0,0.06)',
    enemies: { walker: 6, crawler: 2, brute: 2, turner: 2, sprinter: 3, bloater: 2, spitter: 2, flyer: 2, helmet: 1 },
    outfit: 'tourist', obstacles: ['lounger', 'parasol', 'cooler', 'lounger'], vehicle: 'jetski',
    event: { at: 0.48, kind: 'horde', types: ['walker', 'bloater', 'sprinter', 'spitter'], n: 12, text: 'TOURIST STAMPEDE!' },
    intro: 'Sun hats, cameras, mixed crowds of holiday-makers turned wrong. Steal a jet-ski. THE BLOATER has claimed the beach.',
    boss: { form: 'bloater', name: 'THE BLOATER', title: 'THE BLOATER ROLLS IN!', death: 'THE BLOATER DECAPITATED!', hp: 30, minion: 'walker', proj: 'head' } },
  { id: 6, name: 'Pirogue Run', sub: 'Open sea, boat to boat', bg: 'bg6', length: 2960, speed: 380, terrain: 'boats', gaps: 1,
    ground: 'deck', amb: 'sea', fog: 'rgba(120,180,255,0.08)', tint: 'rgba(0,10,40,0.18)',
    enemies: { boarder: 5, walker: 2, jumper: 3, fish: 2, sprinter: 2, flyer: 2, tank: 1, bloater: 1, helmet: 1, leaper: 2 },
    outfit: 'fisher', obstacles: ['barrel', 'net', 'boom'], vehicle: 'boat',
    event: { at: 0.47, kind: 'horde', types: ['boarder', 'jumper', 'fish', 'flyer'], n: 11, text: 'BOARDING PARTY!' },
    intro: 'Leap from pirogue to pirogue, or take a speedboat through the swell. KAPITENN LANMER is on the last boat.',
    boss: { form: 'captain', name: 'KAPITENN LANMER', title: 'KAPITENN LANMER BOARDS YOU!', death: 'KAPITENN LANMER DECAPITATED!', hp: 32, minion: 'walker', proj: 'anchor' } },
  { id: 7, name: 'Sugar Cane Fields', sub: 'The cane hides crawlers', bg: 'bg7', length: 3400, speed: 420, terrain: 'flat', gaps: 0.08,
    ground: 'dirt', amb: 'cane', fog: 'rgba(255,170,60,0.12)', tint: 'rgba(40,15,0,0.12)',
    enemies: { walker: 4, crawler: 4, brute: 2, turner: 2, tank: 2, helmet: 2, bloater: 2, sprinter: 3, spitter: 2, leaper: 2 },
    outfit: 'cane', obstacles: ['bundle', 'stones', 'cart', 'pipe'], vehicle: 'tractor',
    event: { at: 0.48, kind: 'horde', types: ['crawler', 'tank', 'bloater', 'sprinter'], n: 13, text: 'CANE SWARM!' },
    intro: 'Cane cutters with straw hats and something crawling between the rows. Climb onto a tractor. GRAN KOUPE is coming through the crop.',
    boss: { form: 'harvester', name: 'GRAN KOUPE', title: 'GRAN KOUPE CUTS A PATH!', death: 'GRAN KOUPE DECAPITATED!', hp: 34, minion: 'crawler', proj: 'cane' } },
  { id: 8, name: 'Samara', sub: 'Le Morne Brabant at sunset - the last beach', bg: 'bg8', length: 3120, speed: 430, terrain: 'flat', gaps: 0.06,
    ground: 'darksand', amb: 'sunset', fog: 'rgba(255,40,40,0.12)', tint: 'rgba(60,0,0,0.12)',
    enemies: { walker: 4, crawler: 2, brute: 2, fish: 2, monkey: 1, sprinter: 3, tank: 2, helmet: 2, bloater: 2, flyer: 2, leaper: 2, spitter: 2 },
    outfit: 'mix', obstacles: ['rock', 'driftwood', 'palmleaf'], vehicle: 'jetski',
    event: { at: 0.46, kind: 'horde', types: ['brute', 'tank', 'bloater', 'sprinter', 'flyer'], n: 14, text: 'THE LAST HORDE!' },
    intro: 'The outbreak ends where the island ends. Ride whatever still runs. Reach Samara and face the GRAN ZOMBI.',
    boss: { form: 'granzombi', name: 'GRAN ZOMBI', title: 'THE GRAN ZOMBI RISES!', death: 'GRAN ZOMBI DECAPITATED!', hp: 40, minion: 'brute', proj: 'head' } }
];

// Unlockable hero outfits. Colours tint the existing cartoon puppet; no new photo art.
window.ZR_OUTFITS = [
  { id: 'default', name: 'NAVY POLO', how: 'Your starting look.', unlock: { type: 'start' },
    polo: '#252e4e', poloD: '#171e38', poloL: '#34406a', jean: ['#34528a', '#2a4473'], tag: '' },
  { id: 'teacher', name: 'TEACHER', how: 'Clear Port Louis.', unlock: { type: 'level', id: 1 },
    polo: '#f0ebe0', poloD: '#cfc6b6', poloL: '#ffffff', jean: ['#2a2a32', '#1a1a20'], tag: 'tie' },
  { id: 'dodo', name: 'DODO SHIRT', how: 'Clear Flic-en-Flac.', unlock: { type: 'level', id: 5 },
    polo: '#1f8f6a', poloD: '#146a4c', poloL: '#f2d24a', jean: ['#3d6da8', '#2a4a7a'], tag: 'dodo' },
  { id: 'sega', name: 'SEGA DANCER', how: 'Finish 3 daily challenges (lifetime).', unlock: { type: 'challenges', n: 3 },
    polo: '#c41a3a', poloD: '#8a1028', poloL: '#ffd23a', jean: ['#1a1a1a', '#111111'], tag: 'sega' },
  { id: 'army', name: 'COMMANDO', how: 'Clear all 8 levels.', unlock: { type: 'level', id: 8 },
    polo: '#3d4a32', poloD: '#2a3222', poloL: '#6a7a4a', jean: ['#3a3d32', '#2a2c26'], tag: 'army' },
  { id: 'gold', name: 'GOLDEN BOJO', how: 'Bank 1,500 Rs, or grab 500 Rs in one run.', unlock: { type: 'coins', n: 1500 },
    polo: '#d4a017', poloD: '#8a6a10', poloL: '#ffe07a', jean: ['#c9a03a', '#8a7018'], tag: 'gold' }
];

// Vehicle stats. time is the ride length in seconds if the vehicle is not wrecked first.
window.ZR_VEHICLES = {
  jeep:    { id: 'jeep',    name: 'JEEP',      hp: 6, time: 16, speed: 1.22, rockets: 8, label: '4x4' },
  jetski:  { id: 'jetski',  name: 'JET-SKI',   hp: 5, time: 15, speed: 1.34, rockets: 7, label: 'JET-SKI' },
  quad:    { id: 'quad',    name: 'QUAD',      hp: 5, time: 15, speed: 1.26, rockets: 7, label: 'QUAD' },
  boat:    { id: 'boat',    name: 'SPEEDBOAT', hp: 6, time: 16, speed: 1.30, rockets: 8, label: 'SPEEDBOAT' },
  tractor: { id: 'tractor', name: 'TRACTOR',   hp: 8, time: 18, speed: 1.14, rockets: 6, label: 'TRACTOR' }
};
