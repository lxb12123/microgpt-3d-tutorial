// Capture a static dark-theme preview PNG of each lesson sandbox's canvas, so
// SceneViewer's WebGL-unavailable fallback shows a real image instead of a
// broken (white) <img>. Writes public/models/previews/{overview,autograd,attention}.png.
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const PORT = 4192;
const BASE = `http://127.0.0.1:${PORT}/microgpt-3d-tutorial`;
// ROUTES env (comma-separated route prefixes) narrows what gets re-captured,
// e.g. ROUTES=02-autograd to refresh only that preview without churning others.
const ALL_TARGETS = [
  { route: '01-overview', out: 'public/models/previews/overview.png' },
  { route: '02-autograd', out: 'public/models/previews/autograd.png' },
  { route: '03-attention', out: 'public/models/previews/attention.png' },
];
const ROUTES = process.env.ROUTES?.split(',');
const TARGETS = ROUTES ? ALL_TARGETS.filter((t) => ROUTES.includes(t.route)) : ALL_TARGETS;

function serve() {
  return spawn('sh', ['-c',
    `mkdir -p .pw-serve && ln -sfn "$(pwd)/out" .pw-serve/microgpt-3d-tutorial && ` +
    `exec npx serve .pw-serve -l ${PORT} --no-clipboard --no-port-switching`],
    { stdio: 'ignore', detached: true });
}
async function waitReady() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${BASE}/01-overview/`); if (r.ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server not ready');
}

const server = serve();
try {
  await waitReady();
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'],
  });
  for (const { route, out } of TARGETS) {
    const page = await browser.newPage({ colorScheme: 'dark', viewport: { width: 1100, height: 900 } });
    await page.goto(`${BASE}/${route}/`, { waitUntil: 'networkidle' });
    for (let y = 200; y <= 2200; y += 200) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(120);
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    // Weights load async; when they arrive the overview timeline restarts from
    // t=0 (near-empty scene). Wait long enough that playback has advanced into
    // a frame that actually shows tokens + bars before grabbing the still.
    await page.waitForTimeout(5200);
    const canvas = page.locator('canvas').first();
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    // Use page.screenshot+clip (compositor) — element.screenshot can be blank
    // for a WebGL canvas with preserveDrawingBuffer:false.
    await page.screenshot({
      path: out,
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    });
    console.log('captured', out, `${Math.round(box.width)}x${Math.round(box.height)}`);
    await page.close();
  }
  await browser.close();
} finally {
  try { process.kill(-server.pid); } catch {}
}
