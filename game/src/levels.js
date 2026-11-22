// The three rooms of the heist. Each level is one room the thief crosses:
// walls (rectangles the thief, guards and sight lines all respect), guard
// patrol paths, wall cameras with a sweep, loot to grab and the exit door.
// Coordinates are in the 1280 x 720 frame; the HUD bar is the top 64 px.
const BORDER = 16;
const TOP = 64;

function borderWalls() {
  return [
    { x: 0, y: TOP, w: 1280, h: BORDER }, // top, under the HUD
    { x: 0, y: 704, w: 1280, h: BORDER }, // bottom
    { x: 0, y: TOP, w: BORDER, h: 656 }, // left
    { x: 1264, y: TOP, w: BORDER, h: 656 }, // right
  ];
}

// A wall segment helper: {x, y, w, h}.
export const LEVELS = [
  {
    name: 'LEVEL 1 — THE GALLERY',
    parSeconds: 90,
    playerStart: { x: 640, y: 640 },
    exit: { x: 596, y: 668, w: 88, h: 36, label: 'EXIT — STREET DOOR' },
    walls: [
      ...borderWalls(),
      { x: 420, y: 200, w: 16, h: 280 }, // gallery divider, gaps top and bottom
      { x: 780, y: 420, w: 280, h: 16 }, // low wing wall
      { x: 900, y: 140, w: 16, h: 180 }, // nook wall
    ],
    guards: [
      { path: [[220, 150], [1120, 150]], speed: 1.0 },
      { path: [[300, 420], [1010, 420]], speed: 1.0 },
      { path: [[1150, 300], [1150, 610]], speed: 0.9 },
    ],
    cameras: [
      { x: 640, y: 82, baseAngle: Math.PI / 2, sweep: 0.7 },
      { x: 1250, y: 380, baseAngle: Math.PI, sweep: 0.6 },
    ],
    loot: [
      { x: 1120, y: 180, kind: 'diamond', label: 'STAR DIAMOND' },
      { x: 300, y: 610, kind: 'gold', label: 'GOLD BARS' },
      { x: 920, y: 610, kind: 'gold', label: 'GOLD BARS' },
      { x: 150, y: 180, kind: 'painting', label: 'OLD MASTER' },
    ],
    paintings: [
      { x: 120, y: 84, w: 90, h: 64, hue: 210 },
      { x: 1000, y: 84, w: 90, h: 64, hue: 20 },
      { x: 500, y: 84, w: 90, h: 64, hue: 140 },
    ],
  },
  {
    name: 'LEVEL 2 — THE VAULT',
    parSeconds: 110,
    playerStart: { x: 640, y: 640 },
    exit: { x: 596, y: 668, w: 88, h: 36, label: 'EXIT — STREET DOOR' },
    walls: [
      ...borderWalls(),
      // The vault: a locked room in the middle, one door at the bottom.
      { x: 520, y: 220, w: 240, h: 16 },
      { x: 520, y: 220, w: 16, h: 240 },
      { x: 744, y: 220, w: 16, h: 240 },
      { x: 520, y: 444, w: 80, h: 16 },
      { x: 680, y: 444, w: 80, h: 16 },
      { x: 200, y: 300, w: 16, h: 200 }, // side wing
      { x: 1060, y: 180, w: 16, h: 220 }, // side wing
    ],
    guards: [
      { path: [[200, 150], [1100, 150]], speed: 1.05 },
      { path: [[640, 500], [640, 660]], speed: 1.0 }, // vault-door guard
      { path: [[300, 560], [1000, 560]], speed: 1.0 },
      { path: [[1150, 250], [1150, 620]], speed: 1.0 },
    ],
    cameras: [
      { x: 640, y: 82, baseAngle: Math.PI / 2, sweep: 0.7 },
      { x: 640, y: 470, baseAngle: Math.PI / 2, sweep: 0.5 }, // watches the vault door
      { x: 1250, y: 200, baseAngle: Math.PI, sweep: 0.6 },
    ],
    loot: [
      { x: 640, y: 300, kind: 'diamond', label: 'STAR DIAMOND' },
      { x: 200, y: 610, kind: 'gold', label: 'GOLD BARS' },
      { x: 1100, y: 610, kind: 'jewels', label: 'JEWEL CASE' },
      { x: 150, y: 150, kind: 'painting', label: 'OLD MASTER' },
      { x: 1130, y: 150, kind: 'gold', label: 'GOLD BARS' },
    ],
    paintings: [
      { x: 300, y: 84, w: 90, h: 64, hue: 280 },
      { x: 900, y: 84, w: 90, h: 64, hue: 45 },
    ],
  },
  {
    name: 'LEVEL 3 — THE PENTHOUSE',
    parSeconds: 130,
    playerStart: { x: 640, y: 640 },
    exit: { x: 596, y: 668, w: 88, h: 36, label: 'EXIT — ROOF DOOR' },
    walls: [
      ...borderWalls(),
      { x: 320, y: 180, w: 16, h: 300 },
      { x: 640, y: 140, w: 16, h: 220 },
      { x: 944, y: 300, w: 16, h: 300 },
      { x: 420, y: 520, w: 440, h: 16 }, // long low wall with gaps at both ends
    ],
    guards: [
      { path: [[180, 150], [1120, 150]], speed: 1.15 },
      { path: [[180, 320], [900, 320]], speed: 1.1 },
      { path: [[500, 620], [1150, 620]], speed: 1.1 },
      { path: [[1150, 220], [1150, 620]], speed: 1.05 },
      { path: [[180, 620], [180, 220]], speed: 1.05 },
    ],
    cameras: [
      { x: 320, y: 82, baseAngle: Math.PI / 2, sweep: 0.8 },
      { x: 960, y: 82, baseAngle: Math.PI / 2, sweep: 0.8 },
      { x: 1250, y: 480, baseAngle: Math.PI, sweep: 0.6 },
      { x: 30, y: 480, baseAngle: 0, sweep: 0.6 },
    ],
    loot: [
      { x: 640, y: 260, kind: 'diamond', label: 'STAR DIAMOND' },
      { x: 180, y: 610, kind: 'gold', label: 'GOLD BARS' },
      { x: 1100, y: 610, kind: 'jewels', label: 'JEWEL CASE' },
      { x: 180, y: 150, kind: 'painting', label: 'OLD MASTER' },
      { x: 1100, y: 150, kind: 'gold', label: 'GOLD BARS' },
      { x: 800, y: 420, kind: 'jewels', label: 'JEWEL CASE' },
    ],
    paintings: [
      { x: 150, y: 84, w: 90, h: 64, hue: 0 },
      { x: 1050, y: 84, w: 90, h: 64, hue: 190 },
      { x: 600, y: 84, w: 90, h: 64, hue: 100 },
    ],
  },
];
