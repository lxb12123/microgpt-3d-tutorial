// Deterministic GIF recorder for the Overview Forward/Loss/Sample sandbox.
// Run AFTER `pnpm build`:  node scripts/record-overview-gifs.mjs
//
// Strategy: serve out/ → for EACH (scheme, mode) open a FRESH page (one page per
// clip keeps the number of WebGL ops low so the headless GL context doesn't get
// dropped mid-capture) → scrub the timeline 0→1 capturing canvas frames →
// encode each clip with ffmpeg (palettegen + paletteuse).
//
// Headless WebGL on this stack is flaky per page-mount (a GPU-process race): the
// app's one-shot isWebGLAvailable() probe can cache `false` and fall back to a
// broken <img>, or the canvas can mount but render nothing. openReady() defends
// against both — it pre-warms the GPU on about:blank, retries the load, and
// verifies the canvas actually drew something (screenshot byte size) before we
// commit to capturing a clip; the browser is relaunched if a context is wedged.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, cp, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4178;
const BASE = `http://localhost:${PORT}/microgpt-3d-tutorial`;
// MODES/SCHEMES can be narrowed via env (e.g. MODES=loss) to re-record only the
// clips whose visuals changed, without churning the others.
const MODES = (process.env.MODES?.split(',') ?? ['forward', 'loss', 'sample']);
const SCHEMES = (process.env.SCHEMES?.split(',') ?? ['light', 'dark']);
const FRAMES = 40;       // frames across t=0→1
const FPS = 14;
const HOLD = 14;         // extra repeats of the final frame (~1s end-hold)
const DURATION = 3.2;
const OUT_DIR = 'public/diagrams';
const MIN_RENDER_BYTES = 12000; // a live scene frame is ~30–60 KB; a blank one ~7 KB
const FLAGS = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=swiftshader'];

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

// Crop the canvas to the content band (the scene leaves large empty margins top
// and bottom) and encode at a generous 760px wide with a full 256-colour palette
// and NO dithering — flat SDF text and bars stay crisp instead of being softened
// by a downscale-to-480 + dithered palette. The 760px GIF is downsampled by the
// browser at the page's display width, which looks sharper than a native-480 GIF
// (and shows more detail on retina). `crop=in_w` keeps full width (no horizontal
// clipping); the 640px-tall band at y=180 is fixed by the 560px scene height.
const VF = 'crop=in_w:640:0:180,scale=760:-1:flags=lanczos';

async function ffmpegGif(framePattern, outPath) {
  const palette = `${outPath}.png`;
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', framePattern,
    '-vf', `${VF},palettegen=max_colors=256`, palette]);
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', framePattern, '-i', palette,
    '-lavfi', `${VF}[x];[x][1:v]paletteuse=dither=none`,
    '-loop', '0', outPath]);
  await rm(palette, { force: true });
}

const setHud = (page, vis) => page.evaluate((v) => {
  const hud = document.querySelector('[data-hud]');
  if (hud) hud.style.visibility = v;
}, vis);

const seek = (page, t) => page.evaluate((secs) => {
  const el = document.querySelector('input[type=range]');
  if (!el) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, String(secs));
  el.dispatchEvent(new Event('input', { bubbles: true }));
}, t * DURATION);

const fellBack = async (page) => (await page.locator('img[alt*="WebGL"]').count()) > 0;

// Open the overview page with WebGL actually drawing. Returns a page whose
// canvas has rendered a non-blank frame, or null (caller relaunches the browser).
async function openReady(browser, scheme) {
  const ctx = await browser.newContext({ colorScheme: scheme, viewport: { width: 900, height: 760 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('about:blank');
  for (let i = 0; i < 10; i++) {
    const ok = await page.evaluate(() => { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); });
    if (ok) break;
    await page.waitForTimeout(300);
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.goto(`${BASE}/01-overview/`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForSelector('canvas, img[alt*="WebGL"]', { timeout: 20000 });
    await page.waitForTimeout(1500); // weights + first paint + font ready
    if (!(await fellBack(page))) {
      // Verify the canvas actually drew something (defends against the
      // mount-time race where a canvas exists but renders blank).
      await seek(page, 0.5);
      await page.waitForTimeout(250);
      const buf = await page.locator('canvas').first().screenshot();
      if (buf.length > MIN_RENDER_BYTES) return page;
    }
    await page.waitForTimeout(400);
  }
  await ctx.close();
  return null;
}

// Capture one clip's frames into a temp dir; returns the dir, or null if the
// scene rendered blank (caller retries). Verifies the most-filled frame.
async function captureClip(page, scheme, mode) {
  const label = mode[0].toUpperCase() + mode.slice(1);
  await page.getByRole('radio', { name: label }).click();
  await page.waitForTimeout(900); // let troika generate this mode's SDF glyphs

  // Canonical sample clip: resample until the draw is a normal single visible
  // character, so the GIF tells the core draw→append→repeat story. (STOP and
  // "drawn from other" are edge cases — explained in the copy and the live
  // sandbox — and would otherwise show up at random for the "anna" preset.)
  if (mode === 'sample') {
    const span = page.locator('[data-hud] span', { hasText: 'sampled' });
    for (let r = 0; r < 30; r++) {
      const txt = await span.innerText().catch(() => '');
      if (/sampled:/.test(txt) && !/STOP/.test(txt) && !/from other/.test(txt)) break;
      await page.getByRole('button', { name: 'resample' }).click();
      await page.waitForTimeout(200);
    }
  }
  await setHud(page, 'hidden');

  const canvas = page.locator('canvas').first();
  const tmp = await mkdtemp(join(tmpdir(), `ov-${mode}-${scheme}-`));
  for (let f = 0; f < FRAMES; f++) {
    await seek(page, f / (FRAMES - 1));
    await page.waitForTimeout(70);
    await canvas.screenshot({ path: join(tmp, `frame-${String(f).padStart(3, '0')}.png`) });
  }
  // The near-final frame is the busiest; if it's blank the context dropped.
  const busy = join(tmp, `frame-${String(FRAMES - 1).padStart(3, '0')}.png`);
  if ((await stat(busy)).size < MIN_RENDER_BYTES) {
    await rm(tmp, { recursive: true, force: true });
    return null;
  }
  for (let h = 0; h < HOLD; h++) {
    await cp(busy, join(tmp, `frame-${String(FRAMES + h).padStart(3, '0')}.png`));
  }
  return tmp;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  // detached so we can kill the whole process group (serve spawns a node child).
  const serve = spawn('sh', ['-c',
    `mkdir -p .pw-serve && ln -sfn "$(pwd)/out" .pw-serve/microgpt-3d-tutorial && ` +
    `exec pnpm exec serve .pw-serve -l ${PORT} --no-clipboard --no-port-switching`],
    { stdio: 'ignore', detached: true });
  // Poll until the static server actually answers before launching the browser.
  const url = `${BASE}/01-overview/`;
  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    try { up = (await fetch(url)).ok; } catch { /* not up yet */ }
    if (!up) await new Promise((r) => setTimeout(r, 500));
  }
  if (!up) { try { process.kill(-serve.pid); } catch {} throw new Error(`serve never came up on ${PORT}`); }

  let browser = await chromium.launch({ args: FLAGS });
  try {
    for (const scheme of SCHEMES) {
      for (const mode of MODES) {
        let tmp = null;
        for (let attempt = 0; attempt < 5 && !tmp; attempt++) {
          let page = null;
          for (let r = 0; r < 4 && !page; r++) {
            page = await openReady(browser, scheme);
            if (!page) { await browser.close(); browser = await chromium.launch({ args: FLAGS }); }
          }
          if (!page) throw new Error(`WebGL never came up for ${scheme}/${mode}`);
          tmp = await captureClip(page, scheme, mode);
          await page.context().close();
        }
        if (!tmp) throw new Error(`scene kept rendering blank for ${scheme}/${mode}`);
        const out = join(OUT_DIR, `overview-${mode}-${scheme}.gif`);
        await ffmpegGif(join(tmp, 'frame-%03d.png'), out);
        await rm(tmp, { recursive: true, force: true });
        console.log('wrote', out);
      }
    }
  } finally {
    await browser.close();
    try { process.kill(-serve.pid); } catch { serve.kill(); }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
