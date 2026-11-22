// The heist itself: one room, a thief, patrolling guards with vision cones,
// sweeping security cameras, loot to grab and an alarm meter. The world
// advances in fixed steps; the renderer only paints what is here.
import { ALARM, CAMERA, GUARD, LIVES, LOOT_VALUE, PLAYER, STEP } from './config.js';
import { LEVELS } from './levels.js';

export const EVENT_NONE = 0;
export const EVENT_GRAB = 1;
export const EVENT_CAUGHT = 2;
export const EVENT_LEVEL = 4; // diamond grabbed and the thief reached the exit
export const EVENT_WIN = 8; // the last level is done
export const EVENT_OVER = 16; // caught with no lives left
export const EVENT_LOCKDOWN = 32; // the alarm just hit 100

const TAU = Math.PI * 2;

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// True when the segment from (x1,y1) to (x2,y2) crosses any wall: sample
// points along it, so a wall between a guard and the thief blocks the view.
function segmentBlocked(x1, y1, x2, y2, walls) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    for (const wall of walls) {
      if (pointInRect(x, y, wall)) return true;
    }
  }
  return false;
}

// True when `viewer` (at x,y, facing `angle`) can see the target point.
function canSee(viewer, angle, halfAngle, range, tx, ty, walls) {
  const dx = tx - viewer.x;
  const dy = ty - viewer.y;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (Math.abs(angleDiff(Math.atan2(dy, dx), angle)) > halfAngle) return false;
  return !segmentBlocked(viewer.x, viewer.y, tx, ty, walls);
}

// Move a circle against the walls, one axis at a time, so it slides along them.
function moveCircle(body, dx, dy, walls) {
  const nextX = body.x + dx;
  let hit = false;
  for (const wall of walls) {
    if (
      nextX + body.radius > wall.x && nextX - body.radius < wall.x + wall.w &&
      body.y + body.radius > wall.y && body.y - body.radius < wall.y + wall.h
    ) { hit = true; break; }
  }
  if (!hit) body.x = nextX;
  const nextY = body.y + dy;
  hit = false;
  for (const wall of walls) {
    if (
      body.x + body.radius > wall.x && body.x - body.radius < wall.x + wall.w &&
      nextY + body.radius > wall.y && nextY - body.radius < wall.y + wall.h
    ) { hit = true; break; }
  }
  if (!hit) body.y = nextY;
}

export function createWorld(random) {
  const state = {
    levelIndex: 0,
    level: null,
    player: { x: 0, y: 0, angle: -Math.PI / 2, moving: false, sneaking: false },
    guards: [],
    cameras: [],
    loot: [],
    alarm: 0,
    lockdown: 0, // seconds left of a lockdown, 0 when there is none
    lives: LIVES,
    score: 0,
    levelScore: 0,
    lastHaul: 0, // loot value of the room just cleared (for the clear screen)
    time: 0, // seconds in this level
    totalTime: 0,
    grabbed: 0, // loot pieces grabbed in this level
    message: '',
    messageTime: 0,
    sparkles: [], // cosmetic glints, seeded so a shot never drifts
  };

  function setupLevel(index) {
    const level = LEVELS[index];
    state.levelIndex = index;
    state.level = level;
    state.player.x = level.playerStart.x;
    state.player.y = level.playerStart.y;
    state.player.angle = -Math.PI / 2;
    state.player.moving = false;
    state.player.sneaking = false;
    state.guards = level.guards.map((g) => ({
      x: g.path[0][0],
      y: g.path[0][1],
      path: g.path,
      pathIndex: 1,
      pause: 0,
      speed: g.speed,
      angle: 0,
      mode: 'patrol', // patrol | chase | return
      lastSeenX: 0,
      lastSeenY: 0,
      lostTime: 0,
      seesThief: false,
    }));
    state.cameras = level.cameras.map((c) => ({
      x: c.x,
      y: c.y,
      baseAngle: c.baseAngle,
      sweep: c.sweep,
      angle: c.baseAngle,
      phase: random() * TAU,
      seesThief: false,
    }));
    state.loot = level.loot.map((item) => ({ ...item, taken: false }));
    state.alarm = 0;
    state.lockdown = 0;
    state.time = 0;
    state.levelScore = 0;
    state.grabbed = 0;
    state.message = '';
    state.messageTime = 0;
    state.sparkles = [];
    for (let i = 0; i < 26; i += 1) {
      state.sparkles.push({
        x: 40 + random() * 1200,
        y: 100 + random() * 580,
        phase: random() * TAU,
        speed: 0.6 + random() * 1.4,
      });
    }
  }

  function resetLevel() {
    setupLevel(state.levelIndex);
  }

  function reset() {
    state.lives = LIVES;
    state.score = 0;
    state.totalTime = 0;
    setupLevel(0);
  }

  function nearestLoot() {
    let best = null;
    let bestDist = Infinity;
    for (const item of state.loot) {
      if (item.taken) continue;
      const d = Math.hypot(item.x - state.player.x, item.y - state.player.y);
      if (d < bestDist) { bestDist = d; best = item; }
    }
    return best === null ? null : { item: best, dist: bestDist };
  }

  function diamondTaken() {
    return state.loot.some((item) => item.kind === 'diamond' && item.taken);
  }

  // True when any guard or camera would see the point (x, y) right now.
  // The screenshot autopilot uses it to steer around the vision cones.
  function seesPoint(x, y) {
    const level = state.level;
    for (const guard of state.guards) {
      if (canSee(guard, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, x, y, level.walls)) return true;
    }
    for (const camera of state.cameras) {
      if (canSee(camera, camera.angle, CAMERA.coneHalfAngle, CAMERA.range, x, y, level.walls)) return true;
    }
    return false;
  }

  function step(dt, input, attract) {
    const level = state.level;
    const player = state.player;
    let events = EVENT_NONE;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;

    // --- the thief ---------------------------------------------------------
    if (!attract) {
      const speed = input.sneak ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      const len = Math.hypot(input.x, input.y);
      player.moving = len > 0.01;
      player.sneaking = input.sneak && player.moving;
      if (player.moving) {
        const nx = (input.x / len) * speed * dt;
        const ny = (input.y / len) * speed * dt;
        player.angle = Math.atan2(input.y, input.x);
        moveCircle(player, nx, ny, level.walls);
      }
      // Grab loot with E when close enough.
      if (input.grab) {
        const near = nearestLoot();
        if (near !== null && near.dist < 34) {
          near.item.taken = true;
          const value = LOOT_VALUE[near.item.kind];
          state.score += value;
          state.levelScore += value;
          state.grabbed += 1;
          state.message = near.item.kind === 'diamond'
            ? `STAR DIAMOND SECURED — $${value}! NOW REACH THE EXIT!`
            : `${near.item.label} GRABBED — $${value}`;
          state.messageTime = 2.5;
          events |= EVENT_GRAB;
        }
      }
    }

    // --- cameras sweep ------------------------------------------------------
    for (const camera of state.cameras) {
      camera.angle = camera.baseAngle + Math.sin(state.time * CAMERA.sweepSpeed + camera.phase) * camera.sweep;
      camera.seesThief = !attract && canSee(camera, camera.angle, CAMERA.coneHalfAngle, CAMERA.range, player.x, player.y, level.walls);
    }

    // --- guards patrol, chase, give up --------------------------------------
    for (const guard of state.guards) {
      guard.seesThief = !attract && canSee(guard, guard.angle, GUARD.coneHalfAngle, GUARD.coneRange, player.x, player.y, level.walls);
      if (guard.seesThief) {
        guard.mode = 'chase';
        guard.lastSeenX = player.x;
        guard.lastSeenY = player.y;
        guard.lostTime = 0;
      }
      let tx;
      let ty;
      let speed = GUARD.patrolSpeed * guard.speed;
      if (state.lockdown > 0) {
        // During a lockdown every guard hunts the thief's last known spot.
        guard.mode = 'chase';
        tx = guard.lastSeenX || player.x;
        ty = guard.lastSeenY || player.y;
        speed = GUARD.chaseSpeed * guard.speed;
      } else if (guard.mode === 'chase') {
        tx = guard.lastSeenX;
        ty = guard.lastSeenY;
        speed = GUARD.chaseSpeed * guard.speed;
        if (!guard.seesThief) {
          guard.lostTime += dt;
          if (guard.lostTime > GUARD.loseSightSeconds) guard.mode = 'return';
        }
      } else if (guard.mode === 'return') {
        // Walk back to the nearest waypoint, then resume the patrol.
        let best = 0;
        let bestDist = Infinity;
        guard.path.forEach((point, i) => {
          const d = Math.hypot(point[0] - guard.x, point[1] - guard.y);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        guard.pathIndex = best;
        guard.mode = 'patrol';
        guard.pause = 0;
        tx = guard.path[guard.pathIndex][0];
        ty = guard.path[guard.pathIndex][1];
      } else {
        // Patrol: walk the waypoints, pausing at each one.
        if (guard.pause > 0) {
          guard.pause -= dt;
          tx = guard.x;
          ty = guard.y;
        } else {
          tx = guard.path[guard.pathIndex][0];
          ty = guard.path[guard.pathIndex][1];
          const d = Math.hypot(tx - guard.x, ty - guard.y);
          if (d < 6) {
            guard.pathIndex = (guard.pathIndex + 1) % guard.path.length;
            guard.pause = GUARD.waypointPause;
          }
        }
      }
      const dx = tx - guard.x;
      const dy = ty - guard.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 2) {
        guard.angle = Math.atan2(dy, dx);
        moveCircle(guard, (dx / dist) * speed * dt, (dy / dist) * speed * dt, level.walls);
      }
      // A guard that reaches the thief catches them.
      if (!attract && Math.hypot(player.x - guard.x, player.y - guard.y) < GUARD.catchDistance) {
        state.lives -= 1;
        // The loot of this room respawns, so its value comes off the score:
        // dying must never farm points.
        state.score -= state.levelScore;
        events |= EVENT_CAUGHT;
        if (state.lives <= 0) events |= EVENT_OVER;
        else resetLevel();
        return events;
      }
    }

    // --- the alarm meter ------------------------------------------------------
    if (!attract) {
      const sneakFactor = player.sneaking ? PLAYER.sneakFactor : 1;
      let rate = 0;
      for (const guard of state.guards) {
        if (!guard.seesThief) continue;
        const d = Math.hypot(player.x - guard.x, player.y - guard.y);
        rate += (d < GUARD.closeDistance ? GUARD.spotRateClose : GUARD.spotRate) * sneakFactor;
      }
      for (const camera of state.cameras) {
        if (camera.seesThief) rate += CAMERA.spotRate * sneakFactor;
      }
      if (state.lockdown > 0) {
        state.lockdown -= dt;
        state.alarm = ALARM.max;
        if (state.lockdown <= 0) {
          state.alarm = ALARM.afterLockdown;
          state.message = 'LOCKDOWN OVER — STAY OUT OF SIGHT!';
          state.messageTime = 2.5;
        }
      } else if (rate > 0) {
        state.alarm = Math.min(ALARM.max, state.alarm + rate * dt);
        if (state.alarm >= ALARM.max) {
          state.lockdown = ALARM.lockdownSeconds;
          state.message = `LOCKDOWN! REACH THE EXIT IN ${ALARM.lockdownSeconds}s!`;
          state.messageTime = 3;
          events |= EVENT_LOCKDOWN;
        }
      } else {
        state.alarm = Math.max(0, state.alarm - ALARM.decayPerSecond * dt);
      }
    }

    // --- the exit -------------------------------------------------------------
    if (!attract && diamondTaken() && pointInRect(player.x, player.y, level.exit)) {
      const timeBonus = Math.max(0, Math.round((level.parSeconds - state.time) * 10));
      const quietBonus = state.alarm < 30 ? 200 : 0;
      state.lastHaul = state.levelScore + timeBonus + quietBonus;
      state.score += timeBonus + quietBonus;
      state.totalTime += state.time;
      if (state.levelIndex + 1 >= LEVELS.length) {
        events |= EVENT_WIN;
      } else {
        events |= EVENT_LEVEL;
        setupLevel(state.levelIndex + 1);
      }
    }
    return events;
  }

  reset();

  return {
    state,
    step,
    reset,
    resetLevel,
    setupLevel,
    nearestLoot,
    diamondTaken,
    seesPoint,
  };
}
