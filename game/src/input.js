// Keyboard and mouse input. Movement is read every frame as a direction;
// actions (grab, pause, confirm) are edge-triggered and taken once.
import { KEYMAP } from './config.js';

export const ACTION_GRAB = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;

export function createInput(canvas) {
  const held = new Set();
  const queued = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let clicked = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      held.add(codeOf(event));
      queued.add(codeOf(event));
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    clicked = true;
    queued.add('MouseClick');
  });
  window.addEventListener('blur', () => {
    held.clear();
  });

  function has(keys) {
    return keys.some((key) => held.has(key));
  }

  return {
    direction() {
      const x = (has(KEYMAP.right) ? 1 : 0) - (has(KEYMAP.left) ? 1 : 0);
      const y = (has(KEYMAP.down) ? 1 : 0) - (has(KEYMAP.up) ? 1 : 0);
      return { x, y, sneak: has(KEYMAP.sneak), grab: false };
    },
    takeActions() {
      let actions = 0;
      if (KEYMAP.grab.some((key) => queued.has(key))) actions |= ACTION_GRAB;
      if (KEYMAP.pause.some((key) => queued.has(key))) actions |= ACTION_PAUSE;
      if (KEYMAP.confirm.some((key) => queued.has(key)) || queued.has('MouseClick')) {
        actions |= ACTION_CONFIRM;
      }
      queued.clear();
      return actions;
    },
    mouse() {
      const wasClicked = clicked;
      clicked = false;
      return { x: mouseX, y: mouseY, clicked: wasClicked };
    },
  };
}
