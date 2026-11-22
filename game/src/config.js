// MIDNIGHT FOX HEIST — constants for the whole game.
// One logical frame: 1280 x 720. The top 64 px are the HUD bar; the play
// field is the room below it, ringed by walls.
export const VIEW = { width: 1280, height: 720 };
export const HUD_HEIGHT = 64;
export const STEP = 1 / 60;
export const BEST_KEY = 'midnight-fox-heist-best';

// Movement (px per second).
export const PLAYER = {
  walkSpeed: 178,
  sneakSpeed: 88,
  radius: 13,
  // Detection: sneaking halves how fast guards and cameras raise the alarm.
  sneakFactor: 0.5,
};

// Vision: a guard or camera sees the thief inside its cone with a clear line.
export const GUARD = {
  patrolSpeed: 108,
  chaseSpeed: 155,
  radius: 13,
  coneRange: 210,
  coneHalfAngle: 0.66, // ~38 degrees each side
  spotRate: 42, // alarm points per second while the thief is seen
  spotRateClose: 75, // ...when the thief is closer than this many px
  closeDistance: 100,
  catchDistance: 21, // a guard this close catches the thief
  loseSightSeconds: 3, // ...before giving up the chase
  waypointPause: 1.1, // seconds a guard waits at each waypoint
};

export const CAMERA = {
  range: 250,
  coneHalfAngle: 0.44, // ~25 degrees each side
  spotRate: 38,
  sweepSpeed: 0.45, // radians per second
};

// The alarm meter: 0..100. It falls while the thief is unseen.
export const ALARM = {
  max: 100,
  decayPerSecond: 8,
  lockdownSeconds: 20, // at 100 the lockdown starts and guards hunt
  afterLockdown: 55, // alarm value when a survived lockdown ends
};

// Loot values in dollars.
export const LOOT_VALUE = {
  diamond: 1000,
  painting: 400,
  gold: 250,
  jewels: 150,
};

export const LIVES = 3;

// Keys: arrows/WASD move, Shift sneaks, E grabs loot, P/Esc pauses,
// Enter/Space confirms on menus.
export const KEYMAP = {
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  grab: ['KeyE'],
  pause: ['KeyP', 'Escape'],
  confirm: ['Enter', 'Space'],
};
