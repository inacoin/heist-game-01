// Takes the 4 Midnight Fox Heist screenshots with the installed Chromium,
// over CDP (Node 22's built-in WebSocket — no Playwright needed).
// Reads shots.json, serves game/ on :8080, captures each ?shot= pose.
// Run from the repository root: node tools/shots.mjs
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const DEBUG_PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
      if (res.ok) return await res.json();
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('chromium devtools did not come up');
}

// Minimal CDP client over Node's built-in WebSocket.
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const listeners = [];
  const ready = new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  };
  return {
    ready,
    on: (fn) => listeners.push(fn),
    send: (method, params = {}) => new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    }),
    close: () => ws.close(),
  };
}

const server = spawn('node', ['serve.ts'], { cwd: root, stdio: 'pipe' });
await sleep(1500);
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  `--remote-debugging-port=${DEBUG_PORT}`, '--window-size=1280,720', 'about:blank',
], { stdio: 'pipe' });

const errors = [];
try {
  await getJson('/json/version');
  for (const shot of shots) {
    const target = await (await fetch(
      `http://127.0.0.1:${DEBUG_PORT}/json/new?http://localhost:8080/${shot.query}`,
      { method: 'PUT' },
    )).json();
    const cdp = connect(target.webSocketDebuggerUrl);
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    cdp.on((msg) => {
      if (msg.method === 'Runtime.exceptionThrown') errors.push(`${shot.name} pageerror: ${msg.params.exceptionDetails.text} ${msg.params.exceptionDetails.exception?.description || ''}`);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push(`${shot.name} console: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
      }
    });
    let ready = false;
    for (let i = 0; i < 40; i++) {
      const r = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      if (r.result?.value) { ready = true; break; }
      await sleep(250);
    }
    if (!ready) errors.push(`${shot.name}: __shotReady never became true`);
    await sleep(600);
    const shotRes = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
    const out = join(root, 'screenshots', shot.name);
    writeFileSync(out, Buffer.from(shotRes.data, 'base64'));
    const size = statSync(out).size;
    console.log(shot.name, size, 'bytes', size <= 262144 ? 'OK' : 'TOO BIG');
    if (size > 262144) errors.push(`${shot.name}: ${size} bytes over the 256 KiB cap`);
    cdp.close();
  }
} finally {
  chrome.kill();
  server.kill();
}
if (errors.length) {
  console.log('ERRORS:');
  for (const e of errors) console.log(' -', e);
  process.exitCode = 1;
} else {
  console.log('no page errors');
}
