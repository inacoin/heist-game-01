// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between six screens: title,
// play, paused, level clear, victory and busted.
//
// ?seed=N fixes the sparkle pattern. ?shot=start|play|alarm|win (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_CAUGHT,
  EVENT_GRAB,
  EVENT_LEVEL,
  EVENT_LOCKDOWN,
  EVENT_OVER,
  EVENT_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_GRAB, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_LEVEL,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

// A small window onto the game for the smoke test: screen, alarm, lives,
// score, level and time, read live.
window.__game = {
  screen: SCREEN_TITLE,
  get alarm() { return world.state.alarm; },
  get lives() { return world.state.lives; },
  get score() { return world.state.score; },
  get level() { return world.state.levelIndex + 1; },
  get time() { return world.state.time; },
  get lockdown() { return world.state.lockdown; },
};

function runShot(name) {
  const scene = stageShot(name, world);
  window.__game.screen = scene.screen;
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let alarmWasOn = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each grab.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    window.__game.screen = screen;
    announce(`Playing. ${LIVES} lives. Steal the Star Diamond, then reach the exit.`);
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    window.__game.screen = screen;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) audio.win();
    announce(won
      ? `Heist complete. $${world.state.score}. Best $${best}.`
      : `Busted. Score $${world.state.score}. Best $${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_LEVEL) {
        screen = SCREEN_PLAY;
        window.__game.screen = screen;
        announce('Playing the next room.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        window.__game.screen = screen;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        window.__game.screen = screen;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        window.__game.screen = screen;
        announce('Playing.');
      }
    }
    return actions;
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0, sneak: false, grab: false }, true);
      return;
    }
    const direction = input.direction();
    direction.grab = Boolean(actions & ACTION_GRAB);
    const events = world.step(STEP, direction, false);
    if (events & EVENT_GRAB) {
      if (world.diamondTaken()) audio.diamond();
      else audio.grab();
      announce(world.state.message);
    }
    if (events & EVENT_LOCKDOWN) announce('Lockdown! Reach the exit!');
    if (events & EVENT_CAUGHT) {
      audio.caught();
      announce(world.state.lives > 0 ? `Caught! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left.` : 'Caught! No lives left.');
    }
    if (events & EVENT_LEVEL) {
      audio.level();
      screen = SCREEN_LEVEL;
      window.__game.screen = screen;
      announce(`Level clear. $${world.state.score} so far.`);
    } else if (events & EVENT_WIN) {
      endGame(true);
    } else if (events & EVENT_OVER) {
      endGame(false);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    // The alarm drone follows the meter: on in a lockdown, off otherwise.
    const alarmOn = world.state.lockdown > 0;
    if (alarmOn !== alarmWasOn) {
      audio.alarm(alarmOn);
      alarmWasOn = alarmOn;
    }
    renderer.draw(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      window.__game.screen = screen;
      announce('Paused.');
    }
  });

  announce('Midnight Fox Heist. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
