// Deterministic GIF recorder for the Overview Forward/Loss/Sample sandbox.
// Run AFTER `pnpm build`:  node scripts/record-overview-gifs.mjs
// Strategy: serve out/ → open the page at 2x DPR → for each mode, scrub the
// timeline 0→1 capturing canvas frames → encode each clip with ffmpeg
// (palettegen + paletteuse) → write public/diagrams/overview-<mode>-<scheme>.gif.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 4178;
const BASE = `http://localhost:${PORT}/microgpt-3d-tutorial`;
const MODES = ['forward', 'loss', 'sample'];
const SCHEMES = ['light', 'dark'];
const FRAMES = 40;       // frames across t=0→1
const FPS = 14;
const HOLD = 14;         // extra repeats of the final frame (~1s end-hold)
const DURATION = 3.2;
const OUT_DIR = 'public/diagrams';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });
}

async function ffmpegGif(framePattern, outPath) {
  const palette = `${outPath}.png`;
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', framePattern,
    '-vf', 'scale=480:-1:flags=lanczos,palettegen=max_colors=128', palette]);
  await run('ffmpeg', ['-y', '-framerate', String(FPS), '-i', framePattern, '-i', palette,
    '-lavfi', 'scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer',
    '-loop', '0', outPath]);
  await rm(palette, { force: true });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const serve = spawn('sh', ['-c',
    `mkdir -p .pw-serve && ln -sfn "$(pwd)/out" .pw-serve/microgpt-3d-tutorial && ` +
    `pnpm exec serve .pw-serve -l ${PORT} --no-clipboard --no-port-switching`],
    { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));

  const browser = await chromium.launch();
  try {
    for (const scheme of SCHEMES) {
      const ctx = await browser.newContext({
        colorScheme: scheme,
        viewport: { width: 900, height: 760 },
        deviceScaleFactor: 2,
      });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/01-overview/`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForSelector('canvas', { timeout: 20000 });
      await page.waitForTimeout(1800); // weights load + first paint + font ready

      const canvas = page.locator('canvas').first();

      for (const mode of MODES) {
        const label = mode[0].toUpperCase() + mode.slice(1);
        await page.getByRole('radio', { name: label }).click();
        await page.waitForTimeout(800); // let troika generate SDF glyphs for this mode

        const tmp = await mkdtemp(join(tmpdir(), `ov-${mode}-${scheme}-`));
        for (let f = 0; f < FRAMES; f++) {
          const frac = f / (FRAMES - 1);
          await page.evaluate((secs) => {
            const el = document.querySelector('input[type=range]');
            if (!el) return;
            const setter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype, 'value').set;
            setter.call(el, String(secs));
            el.dispatchEvent(new Event('input', { bubbles: true }));
          }, frac * DURATION);
          await page.waitForTimeout(70); // let the seeked frame render
          const n = String(f).padStart(3, '0');
          await canvas.screenshot({ path: join(tmp, `frame-${n}.png`) });
        }
        for (let h = 0; h < HOLD; h++) {
          const src = String(FRAMES - 1).padStart(3, '0');
          const dst = String(FRAMES + h).padStart(3, '0');
          await cp(join(tmp, `frame-${src}.png`), join(tmp, `frame-${dst}.png`));
        }
        const out = join(OUT_DIR, `overview-${mode}-${scheme}.gif`);
        await ffmpegGif(join(tmp, 'frame-%03d.png'), out);
        await rm(tmp, { recursive: true, force: true });
        console.log('wrote', out);
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
    serve.kill();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
