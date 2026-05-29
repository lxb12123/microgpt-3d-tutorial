import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Next.js static export with `basePath: '/microgpt-3d-tutorial'` writes files to
// `out/` flat at the OS level, but URLs reference them under
// `/microgpt-3d-tutorial/`. To bridge: create a sibling directory `.pw-serve/`
// containing a `microgpt-3d-tutorial` symlink that points at `out`, then serve
// `.pw-serve/` so requests hitting `/microgpt-3d-tutorial/*` resolve to files
// in `out/*`. The directory is gitignored.
const SERVE_ROOT = '.pw-serve';
const SYMLINK = `${SERVE_ROOT}/microgpt-3d-tutorial`;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}/microgpt-3d-tutorial`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `mkdir -p ${SERVE_ROOT} && ln -sfn "$(pwd)/out" ${SYMLINK} && pnpm exec serve ${SERVE_ROOT} -l ${PORT} --no-clipboard --no-port-switching`,
    port: PORT,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
