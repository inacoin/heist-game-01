// Everything the eye sees: the night museum, the thief, the guards and
// their vision cones, the cameras, the loot and the alarm meter — plus the
// title, pause, level-clear, victory and busted screens. The canvas is a
// fixed 1280 x 720 frame, letterboxed into the window.
import { ALARM, HUD_HEIGHT, VIEW } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL = 'level';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;
const GOLD = '#c9a227';
const INK = '#0d0f16';

// Ray vs axis-aligned rectangle: the distance along the ray to the nearest
// wall, or Infinity when the ray misses. Vision cones are clipped with it,
// so a cone never shows through a wall.
function rayWallDistance(x, y, dx, dy, wall) {
  let tmin = 0;
  let tmax = Infinity;
  const axes = [
    { o: x, d: dx, min: wall.x, max: wall.x + wall.w },
    { o: y, d: dy, min: wall.y, max: wall.y + wall.h },
  ];
  for (const axis of axes) {
    if (Math.abs(axis.d) < 1e-9) {
      if (axis.o < axis.min || axis.o > axis.max) return Infinity;
    } else {
      let t1 = (axis.min - axis.o) / axis.d;
      let t2 = (axis.max - axis.o) / axis.d;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

function conePolygon(viewer, angle, halfAngle, range, walls) {
  const rays = 22;
  const points = [{ x: viewer.x, y: viewer.y }];
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let dist = range;
    for (const wall of walls) {
      const hit = rayWallDistance(viewer.x, viewer.y, dx, dy, wall);
      if (hit < dist) dist = hit;
    }
    points.push({ x: viewer.x + dx * dist, y: viewer.y + dy * dist });
  }
  return points;
}

function drawCone(ctx, viewer, angle, halfAngle, range, walls, fill) {
  const points = conePolygon(viewer, angle, halfAngle, range, walls);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawGuard(ctx, guard, time) {
  // Vision cone: amber while patrolling, red while hunting.
  const alerted = guard.mode !== 'patrol';
  drawCone(
    ctx, guard, guard.angle, 0.66, 210, guard.walls,
    alerted ? 'rgba(255, 64, 64, 0.30)' : 'rgba(255, 205, 70, 0.20)',
  );
  // Body: a navy-uniform guard with a cap and a torch glint.
  ctx.fillStyle = '#2c3e63';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 13, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#8fa8d8';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#1b2a4a';
  ctx.beginPath();
  ctx.arc(guard.x, guard.y - 4, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.arc(guard.x + Math.cos(guard.angle) * 13, guard.y + Math.sin(guard.angle) * 13, 3, 0, TAU);
  ctx.fill();
  if (alerted) {
    ctx.fillStyle = '#ff4040';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', guard.x, guard.y - 20);
  }
}

function drawCamera(ctx, camera) {
  drawCone(
    ctx, camera, camera.angle, 0.44, 250, camera.walls,
    camera.seesThief ? 'rgba(255, 64, 64, 0.34)' : 'rgba(255, 70, 70, 0.15)',
  );
  ctx.fillStyle = '#3a3f4a';
  ctx.fillRect(camera.x - 8, camera.y - 6, 16, 12);
  ctx.fillStyle = camera.seesThief ? '#ff3030' : '#c03030';
  ctx.beginPath();
  ctx.arc(camera.x + Math.cos(camera.angle) * 9, camera.y + Math.sin(camera.angle) * 9, 3.5, 0, TAU);
  ctx.fill();
}

function drawLoot(ctx, item, time) {
  if (item.taken) return;
  const twinkle = 0.6 + 0.4 * Math.sin(time * 3 + item.x);
  if (item.kind === 'diamond') {
    // The Star Diamond in a glass case: a bright cyan star that glints.
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x - 26, item.y - 26, 52, 52);
    ctx.fillStyle = `rgba(120, 220, 255, ${0.3 + 0.4 * twinkle})`;
    ctx.beginPath();
    ctx.moveTo(item.x, item.y - 16);
    ctx.lineTo(item.x + 11, item.y - 4);
    ctx.lineTo(item.x + 16, item.y + 10);
    ctx.lineTo(item.x, item.y + 16);
    ctx.lineTo(item.x - 16, item.y + 10);
    ctx.lineTo(item.x - 11, item.y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#eaf7ff';
    ctx.beginPath();
    ctx.arc(item.x, item.y - 2, 4, 0, TAU);
    ctx.fill();
  } else if (item.kind === 'gold') {
    ctx.fillStyle = '#d8a920';
    ctx.fillRect(item.x - 12, item.y - 7, 24, 14);
    ctx.fillStyle = '#f5d76e';
    ctx.fillRect(item.x - 12, item.y - 7, 24, 5);
    ctx.strokeStyle = '#8a6d1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(item.x - 12, item.y - 7, 24, 14);
  } else if (item.kind === 'painting') {
    ctx.fillStyle = '#6b4a1f';
    ctx.fillRect(item.x - 18, item.y - 13, 36, 26);
    ctx.fillStyle = '#7fb069';
    ctx.fillRect(item.x - 14, item.y - 9, 28, 18);
    ctx.fillStyle = '#e9c46a';
    ctx.beginPath();
    ctx.arc(item.x - 4, item.y - 2, 5, 0, TAU);
    ctx.fill();
  } else {
    // Jewels: a small red velvet case with gems.
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(item.x - 13, item.y - 9, 26, 18);
    ctx.fillStyle = '#ff5d8f';
    ctx.beginPath();
    ctx.arc(item.x - 5, item.y, 4, 0, TAU);
    ctx.arc(item.x + 5, item.y, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#8ecae6';
    ctx.beginPath();
    ctx.arc(item.x, item.y - 3, 3, 0, TAU);
    ctx.fill();
  }
}

function drawThief(ctx, player, time) {
  // A black-clad thief in a fox mask: orange ears, pale mask, dark body.
  ctx.fillStyle = '#14161f';
  ctx.beginPath();
  ctx.arc(player.x, player.y, 13, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#c8cfdd';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Fox ears.
  ctx.fillStyle = '#e07b39';
  ctx.beginPath();
  ctx.moveTo(player.x - 9, player.y - 8);
  ctx.lineTo(player.x - 12, player.y - 19);
  ctx.lineTo(player.x - 3, player.y - 12);
  ctx.closePath();
  ctx.moveTo(player.x + 9, player.y - 8);
  ctx.lineTo(player.x + 12, player.y - 19);
  ctx.lineTo(player.x + 3, player.y - 12);
  ctx.closePath();
  ctx.fill();
  // Pale mask with dark eye slits.
  ctx.fillStyle = '#f2e8d5';
  ctx.beginPath();
  ctx.arc(player.x, player.y - 2, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#14161f';
  ctx.fillRect(player.x - 5, player.y - 4, 4, 2);
  ctx.fillRect(player.x + 1, player.y - 4, 4, 2);
  if (player.sneaking) {
    ctx.fillStyle = 'rgba(160, 200, 255, 0.9)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SNEAKING', player.x, player.y - 24);
  }
}

function alarmColor(value) {
  if (value < 40) return '#58c96b';
  if (value < 70) return '#e8b93b';
  return '#ff4d4d';
}

function formatTime(seconds) {
  const total = Math.floor(seconds);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function drawRoom(state, time) {
    const level = state.level;
    // Floor: dark marble tiles.
    ctx.fillStyle = '#232839';
    ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= VIEW.width; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, HUD_HEIGHT); ctx.lineTo(x, VIEW.height); ctx.stroke();
    }
    for (let y = HUD_HEIGHT; y <= VIEW.height; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(VIEW.width, y); ctx.stroke();
    }
    // Crimson carpet runner down the middle.
    ctx.fillStyle = '#471119';
    ctx.fillRect(560, HUD_HEIGHT, 160, VIEW.height - HUD_HEIGHT);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.strokeRect(560, HUD_HEIGHT, 160, VIEW.height - HUD_HEIGHT);
    // Warm lamp pools.
    for (const lx of [240, 640, 1040]) {
      const glow = ctx.createRadialGradient(lx, 300, 10, lx, 300, 300);
      glow.addColorStop(0, 'rgba(255, 196, 110, 0.14)');
      glow.addColorStop(1, 'rgba(255, 196, 110, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lx - 300, 40, 600, 640);
    }
    // Paintings on the top wall.
    for (const painting of level.paintings) {
      ctx.fillStyle = '#6b4a1f';
      ctx.fillRect(painting.x, painting.y, painting.w, painting.h);
      ctx.fillStyle = `hsl(${painting.hue}, 45%, 42%)`;
      ctx.fillRect(painting.x + 6, painting.y + 6, painting.w - 12, painting.h - 12);
      ctx.fillStyle = `hsl(${(painting.hue + 60) % 360}, 60%, 65%)`;
      ctx.beginPath();
      ctx.arc(painting.x + painting.w / 2, painting.y + painting.h / 2, 10, 0, TAU);
      ctx.fill();
    }
    // The exit door: a green mat on the floor with an EXIT sign.
    const exit = level.exit;
    ctx.fillStyle = '#1d5c33';
    ctx.fillRect(exit.x - 6, exit.y - 6, exit.w + 12, exit.h + 12);
    ctx.fillStyle = '#2f8f4e';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h / 2 + 5);
    // Loot.
    for (const item of state.loot) drawLoot(ctx, item, time);
    // Vision cones first (under the people), then the people.
    for (const guard of state.guards) {
      guard.walls = level.walls;
      drawGuard(ctx, guard, time);
    }
    for (const camera of state.cameras) {
      camera.walls = level.walls;
      drawCamera(ctx, camera);
    }
    drawThief(ctx, state.player, time);
    // Walls on top: stone blocks with a gold trim line.
    for (const wall of level.walls) {
      ctx.fillStyle = '#2e3242';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
      ctx.strokeStyle = '#c9a227';
      ctx.lineWidth = 1;
      ctx.strokeRect(wall.x + 0.5, wall.y + 0.5, wall.w - 1, wall.h - 1);
    }
    // Cosmetic sparkles.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (const sparkle of state.sparkles) {
      const size = 1 + Math.sin(time * sparkle.speed + sparkle.phase);
      if (size > 0.4) ctx.fillRect(sparkle.x, sparkle.y, 2, 2);
    }
    // Vignette: the room is dark at the edges.
    const vignette = ctx.createRadialGradient(640, 392, 260, 640, 392, 720);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, HUD_HEIGHT, VIEW.width, VIEW.height - HUD_HEIGHT);
  }

  function drawHud(state, time) {
    const level = state.level;
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, VIEW.width, HUD_HEIGHT);
    ctx.fillStyle = GOLD;
    ctx.fillRect(0, HUD_HEIGHT - 2, VIEW.width, 2);
    ctx.textBaseline = 'middle';
    // Left: level name and objective.
    ctx.fillStyle = '#f2e8d5';
    ctx.font = 'bold 19px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(level.name, 16, 20);
    ctx.fillStyle = '#9aa3b8';
    ctx.font = '14px sans-serif';
    const objective = state.loot.some((i) => i.kind === 'diamond' && i.taken)
      ? 'DIAMOND SECURED — REACH THE EXIT!'
      : 'STEAL THE STAR DIAMOND, THEN REACH THE EXIT';
    ctx.fillText(objective, 16, 44);
    // Centre: the alarm meter — the biggest thing on the HUD.
    const meterX = 480;
    const meterW = 320;
    const flash = state.alarm >= 70 && Math.sin(time * 10) > 0;
    ctx.fillStyle = flash ? '#ff4d4d' : '#f2e8d5';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM', meterX, 20);
    ctx.fillStyle = '#262b3a';
    roundRect(ctx, meterX, 32, meterW, 16, 4);
    ctx.fill();
    ctx.fillStyle = alarmColor(state.alarm);
    if (state.alarm > 0) {
      roundRect(ctx, meterX, 32, Math.max(8, (meterW * state.alarm) / 100), 16, 4);
      ctx.fill();
    }
    ctx.strokeStyle = '#4a5165';
    ctx.lineWidth = 1;
    roundRect(ctx, meterX, 32, meterW, 16, 4);
    ctx.stroke();
    ctx.fillStyle = '#f2e8d5';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${Math.floor(state.alarm)}%`, meterX + meterW + 10, 40);
    if (state.lockdown > 0) {
      ctx.fillStyle = '#ff4d4d';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`LOCKDOWN ${Math.ceil(state.lockdown)}s`, meterX, 56);
    }
    // Right: loot, lives, timer.
    ctx.textAlign = 'right';
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`$${state.score.toLocaleString('en-US')}`, 1264, 20);
    ctx.fillStyle = '#9aa3b8';
    ctx.font = '14px sans-serif';
    ctx.fillText(`LOOT $${state.levelScore.toLocaleString('en-US')}  •  ${formatTime(state.time)}`, 1264, 44);
    ctx.fillStyle = '#e07b39';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText('●'.repeat(Math.max(0, state.lives)), 1120, 20);
  }

  function drawMessage(state) {
    if (state.messageTime <= 0 || !state.message) return;
    ctx.fillStyle = 'rgba(13, 15, 22, 0.85)';
    const width = ctx.measureText(state.message).width + 36;
    roundRect(ctx, (VIEW.width - width) / 2, HUD_HEIGHT + 14, width, 34, 6);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.message, VIEW.width / 2, HUD_HEIGHT + 32);
  }

  function overlay(title, lines, accent) {
    ctx.fillStyle = 'rgba(5, 6, 12, 0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText(title, VIEW.width / 2, 240);
    ctx.fillStyle = '#f2e8d5';
    ctx.font = '19px sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW.width / 2, 310 + i * 30);
    });
  }

  function draw(state, screen, best) {
    const time = performance.now() / 1000;
    // Letterbox the 1280 x 720 frame into the window.
    const scale = Math.min(canvas.width / VIEW.width, canvas.height / VIEW.height);
    const offsetX = (canvas.width - VIEW.width * scale) / 2;
    const offsetY = (canvas.height - VIEW.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.textBaseline = 'alphabetic';

    if (screen === SCREEN_TITLE) {
      drawRoom(state, time);
      drawHud(state, time);
      overlay('MIDNIGHT FOX HEIST', [
        'Steal the Star Diamond. Don\'t wake the museum.',
        '',
        'WASD / ARROWS — move      SHIFT — sneak      E — grab loot',
        'Stay out of the guards\' cones and the cameras. If the alarm hits 100%, run!',
        '',
        'PRESS ENTER OR CLICK TO START',
        best > 0 ? `BEST HAUL: $${best.toLocaleString('en-US')}` : 'THREE ROOMS. ONE DIAMOND EACH. GET OUT CLEAN.',
      ], GOLD);
      return;
    }
    drawRoom(state, time);
    drawHud(state, time);
    drawMessage(state);
    if (screen === SCREEN_PAUSED) {
      overlay('PAUSED', ['P or ESC to resume', 'Your loot is safe… for now.'], '#9aa3b8');
    } else if (screen === SCREEN_LEVEL) {
      overlay('LEVEL CLEAR!', [
        `Haul this room: $${state.lastHaul.toLocaleString('en-US')}`,
        `Total: $${state.score.toLocaleString('en-US')}`,
        '',
        'PRESS ENTER FOR THE NEXT ROOM',
      ], '#58c96b');
    } else if (screen === SCREEN_WIN) {
      overlay('HEIST COMPLETE!', [
        `The Midnight Fox vanishes into the night with $${state.score.toLocaleString('en-US')}.`,
        `All three rooms cleaned in ${formatTime(state.totalTime)}.`,
        '',
        'PRESS ENTER TO PLAY AGAIN',
      ], GOLD);
    } else if (screen === SCREEN_OVER) {
      overlay('BUSTED!', [
        'The guards caught the Midnight Fox.',
        `Haul: $${state.score.toLocaleString('en-US')}`,
        '',
        'PRESS ENTER TO TRY AGAIN',
      ], '#ff4d4d');
    }
  }

  return { draw };
}
