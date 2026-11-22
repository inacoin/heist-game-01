// The screenshot scenes behind ?shot=start|play|alarm|win. Each one plays
// the real rules forward from a fresh world, steered by an autopilot, so the
// frame is what a short game really looks like and the same seed always
// gives the same frame.
import { STEP } from './config.js';
import {
  EVENT_CAUGHT,
  EVENT_LEVEL,
  EVENT_LOCKDOWN,
  EVENT_OVER,
  EVENT_WIN,
} from './world.js';
import { SCREEN_LEVEL, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 15; // the thief is a step from the diamond: case still full, $900 banked
const ALARM_SECONDS = 20;
const WIN_SECONDS = 150;
const SAMPLE = STEP;

/** Pick a step direction toward `target` that no cone sees, if there is one. */
function safeDirection(world, target, sneak) {
  const player = world.state.player;
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 4) return { x: 0, y: 0, sneak, grab: false };
  const base = Math.atan2(dy, dx);
  const stepLen = sneak ? 88 : 178;
  for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const angle = base + offset;
    const nx = player.x + Math.cos(angle) * stepLen * SAMPLE;
    const ny = player.y + Math.sin(angle) * stepLen * SAMPLE;
    if (!world.seesPoint(nx, ny)) {
      return { x: Math.cos(angle), y: Math.sin(angle), sneak, grab: false };
    }
  }
  // Every way is watched: sneak straight at the target anyway.
  return { x: Math.cos(base), y: Math.sin(base), sneak: true, grab: false };
}

/** The current goal: the small loot first, the diamond last, then the exit.
 * Clearing the small pieces before the big prize keeps the diamond in its
 * case — and the frame — for most of the heist. */
function currentTarget(world) {
  const player = world.state.player;
  let best = null;
  let bestDist = Infinity;
  for (const item of world.state.loot) {
    if (item.taken || item.kind === 'diamond') continue;
    const d = Math.hypot(item.x - player.x, item.y - player.y);
    if (d < bestDist) { bestDist = d; best = item; }
  }
  if (best !== null) return { x: best.x, y: best.y, loot: best };
  const diamond = world.state.loot.find((item) => item.kind === 'diamond');
  if (!diamond.taken) return { x: diamond.x, y: diamond.y, loot: diamond };
  const exit = world.state.level.exit;
  return { x: exit.x + exit.w / 2, y: exit.y + exit.h / 2, loot: null };
}

export function autopilotStep(world) {
  const player = world.state.player;
  // Grab first: standing on loot, take it even under a cone.
  const near = world.nearestLoot();
  if (near !== null && near.dist < 32) {
    return { x: 0, y: 0, sneak: false, grab: true };
  }
  // Seen right now: run away from the watcher, on ground no cone covers.
  let watcher = null;
  for (const guard of world.state.guards) {
    if (guard.seesThief) { watcher = guard; break; }
  }
  if (watcher === null) {
    for (const camera of world.state.cameras) {
      if (camera.seesThief) { watcher = camera; break; }
    }
  }
  if (watcher !== null) {
    const away = Math.atan2(player.y - watcher.y, player.x - watcher.x);
    for (const offset of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const angle = away + offset;
      const nx = player.x + Math.cos(angle) * 178 * SAMPLE;
      const ny = player.y + Math.sin(angle) * 178 * SAMPLE;
      if (!world.seesPoint(nx, ny)) {
        return { x: Math.cos(angle), y: Math.sin(angle), sneak: false, grab: false };
      }
    }
    return { x: Math.cos(away), y: Math.sin(away), sneak: false, grab: false };
  }
  // Unseen: creep toward the goal on ground no cone covers. When every way
  // forward is watched, wait in place, sneaking, for the cone to sweep past.
  const target = currentTarget(world);
  const input = safeDirection(world, target, false);
  if (input.x === 0 && input.y === 0) {
    return { x: 0, y: 0, sneak: true, grab: false };
  }
  for (const guard of world.state.guards) {
    if (Math.hypot(guard.x - player.x, guard.y - player.y) < 160) input.sneak = true;
  }
  return input;
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title over a live room. play: 26 seconds of a careful heist.
 * alarm: a reckless dash into a cone until the lockdown starts. win: a full
 * careful play-through of level 1 to its clear screen.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) {
      world.step(STEP, { x: 0, y: 0, sneak: false, grab: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'alarm') {
    let locked = false;
    for (let i = 0; i < ALARM_SECONDS / STEP; i += 1) {
      const diamond = world.state.loot.find((item) => item.kind === 'diamond');
      const input = {
        x: (diamond.x - world.state.player.x) / Math.max(1, Math.hypot(diamond.x - world.state.player.x, diamond.y - world.state.player.y)),
        y: (diamond.y - world.state.player.y) / Math.max(1, Math.hypot(diamond.x - world.state.player.x, diamond.y - world.state.player.y)),
        sneak: false,
        grab: false,
      };
      const events = world.step(STEP, input, false);
      if (events & EVENT_LOCKDOWN) locked = true;
      if (locked && world.state.alarm >= 95) break;
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    for (let i = 0; i < WIN_SECONDS / STEP; i += 1) {
      const events = world.step(STEP, autopilotStep(world), false);
      if (events & EVENT_LEVEL) return { screen: SCREEN_LEVEL, best: 0 };
      if (events & EVENT_WIN) return { screen: SCREEN_WIN, best: 0 };
      if (events & EVENT_OVER) break;
    }
    // The careful run did not finish the room: show the play frame instead.
    return { screen: SCREEN_PLAY, best: 0 };
  }
  // play: the cover shot — a careful heist in full swing.
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    const events = world.step(STEP, autopilotStep(world), false);
    if (events & (EVENT_OVER | EVENT_LEVEL | EVENT_WIN)) break;
  }
  return { screen: SCREEN_PLAY, best: 0 };
}
