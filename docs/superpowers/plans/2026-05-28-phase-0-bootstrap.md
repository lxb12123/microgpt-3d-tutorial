# Phase 0 — Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working Next.js + R3F + Blender MCP pipeline that deploys to GitHub Pages and serves `/sandbox-check` showing a rotating hello cube loaded from a `.glb` asset.

**Architecture:** Next.js 15 with App Router + Nextra v3 for MDX docs, statically exported (`output: 'export'`) to GitHub Pages under `/microgpt-3d-tutorial/`. R3F shell (`SceneViewer`) wraps every 3D canvas with `ErrorBoundary`, WebGL availability check, and static PNG fallback. Blender MCP Server produces test asset (`_hello.glb`). CI workflow (`.github/workflows/deploy.yml`) runs typecheck → lint → unit tests → asset validation → build → Playwright smoke → deploy.

**Tech Stack:** pnpm, Next.js 15, Nextra 3, TypeScript 5, Tailwind CSS 3, `three`, `@react-three/fiber`, `@react-three/drei`, Vitest, React Testing Library, jsdom, Playwright, ESLint (`eslint-config-next`), GitHub Actions, Blender + Blender MCP Server.

**Reference spec:** `docs/superpowers/specs/2026-05-28-microgpt-3d-tutorial-design.md` (§3 layout, §4 Layer 1, §5 Blender workflow + asset standard, §7 error handling, §8 CI workflow, §9 Phase 0).

**Repo URL:** https://github.com/lxb12123/microgpt-3d-tutorial (default branch `main`).

---

## Task 1: Initialize pnpm project

**Files:**
- Create: `package.json`

- [ ] **Step 1: Run `pnpm init`**

```bash
pnpm init
```

Expected: creates `package.json` with default scaffold.

- [ ] **Step 2: Replace `package.json` with the canonical version below**

```json
{
  "name": "microgpt-3d-tutorial",
  "version": "0.0.0",
  "private": true,
  "description": "An interactive 3D-visualized tutorial for Karpathy's pure-Python microGPT.",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "check-assets": "node scripts/check-assets.mjs",
    "e2e:ci": "playwright test",
    "analyze": "ANALYZE=true next build"
  },
  "engines": {
    "node": ">=20.10.0",
    "pnpm": ">=9.0.0"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: initialize pnpm project with canonical scripts"
```

---

## Task 2: Install Next.js + Nextra v3 + TypeScript + Tailwind

**Files:**
- Modify: `package.json` (adds dependencies)
- Create: `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, `app/globals.css`

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add next@latest react@latest react-dom@latest nextra@latest nextra-theme-docs@latest
```

Expected: `package.json` lists `next`, `react`, `react-dom`, `nextra`, `nextra-theme-docs` under dependencies. Verify Nextra version is `>=3.0.0`.

- [ ] **Step 2: Install dev deps**

```bash
pnpm add -D typescript @types/react @types/react-dom @types/node tailwindcss postcss autoprefixer
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "out"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
import nextra from 'nextra';

const withNextra = nextra({
  // Nextra v3 reads MDX from the `content/` directory by default.
  // Empty options object keeps defaults; override only if necessary.
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/microgpt-3d-tutorial',
  images: { unoptimized: true },
  reactStrictMode: true,
  // Make GitHub Pages serve trailing-slash URLs consistently
  trailingSlash: true,
};

export default withNextra(nextConfig);
```

- [ ] **Step 5: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './content/**/*.{md,mdx}',
    './components/**/*.{ts,tsx}',
    './mdx-components.tsx',
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create `postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: Create `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 8: Run typecheck to verify config**

```bash
pnpm typecheck
```

Expected: no errors. (`next-env.d.ts` will be auto-generated on first build; if typecheck complains about it, run `pnpm build` once first.)

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs app/globals.css
git commit -m "chore: install Next.js + Nextra v3 + TS + Tailwind with static-export config"
```

---

## Task 3: Minimal app shell + verify `pnpm dev`

**Files:**
- Create: `app/layout.tsx`, `app/[[...mdxPath]]/page.tsx`, `content/index.mdx`, `content/_meta.ts`, `mdx-components.tsx`

- [ ] **Step 1: Create `app/layout.tsx`**

```tsx
import './globals.css';
import { Layout, Navbar } from 'nextra-theme-docs';
import { Head } from 'nextra/components';
import { getPageMap } from 'nextra/page-map';
import 'nextra-theme-docs/style.css';

export const metadata = {
  title: 'microGPT 3D Tutorial',
  description: 'Interactive 3D visualization of Karpathy\'s pure-Python microGPT.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const pageMap = await getPageMap();
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head />
      <body>
        <Layout
          navbar={<Navbar logo={<b>microGPT 3D</b>} />}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/lxb12123/microgpt-3d-tutorial/tree/main"
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create the Nextra catch-all route at `app/[[...mdxPath]]/page.tsx`**

```tsx
import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from '../../mdx-components';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata({ params }: { params: Promise<{ mdxPath?: string[] }> }) {
  const { mdxPath } = await params;
  const { metadata } = await importPage(mdxPath);
  return metadata;
}

export default async function Page({ params }: { params: Promise<{ mdxPath?: string[] }> }) {
  const { mdxPath } = await params;
  const result = await importPage(mdxPath);
  const { default: MDXContent, toc, metadata } = result;
  const components = useMDXComponents({});
  const Wrapper = components.wrapper;
  return Wrapper ? (
    <Wrapper toc={toc} metadata={metadata}>
      <MDXContent />
    </Wrapper>
  ) : (
    <MDXContent />
  );
}
```

- [ ] **Step 3: Create `mdx-components.tsx` at the repo root**

```tsx
import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';

const docsComponents = getDocsMDXComponents();

export function useMDXComponents(components: Record<string, React.ComponentType>) {
  return {
    ...docsComponents,
    ...components,
  };
}
```

- [ ] **Step 4: Create `content/index.mdx`**

```mdx
# microGPT 3D Tutorial

Bootstrap successful. Phase 0 milestone reached.
```

- [ ] **Step 5: Create `content/_meta.ts`**

```ts
export default {
  index: 'Home',
};
```

- [ ] **Step 6: Run dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:3000/microgpt-3d-tutorial/` in a browser. Expected: "microGPT 3D Tutorial" heading with "Bootstrap successful" body, Nextra layout chrome (sidebar + navbar) visible.

Press Ctrl+C to stop.

- [ ] **Step 7: Run `pnpm build` to verify static export**

```bash
pnpm build
```

Expected: build succeeds, an `out/` directory is created. If Nextra reports a missing `mdxPath` segment, double-check Step 2's exact filename `app/[[...mdxPath]]/page.tsx` (note double brackets).

- [ ] **Step 8: Commit**

```bash
git add app/ content/ mdx-components.tsx
git commit -m "feat(bootstrap): minimal Nextra v3 app shell with /index page"
```

---

## Task 4: Install + configure Vitest + React Testing Library

**Files:**
- Modify: `package.json` (deps)
- Create: `vitest.config.ts`, `vitest.setup.ts`, `__tests__/smoke.test.ts`

- [ ] **Step 1: Install deps**

```bash
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/__tests__/**/*.test.{ts,tsx,mjs}'],
    exclude: ['node_modules', 'out', '.next', 'tests/e2e/**'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Write a failing smoke test at `__tests__/smoke.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

describe('vitest smoke', () => {
  it('runs in jsdom and confirms arithmetic still works', () => {
    expect(1 + 1).toBe(2);
    expect(typeof window).toBe('object');
  });
});
```

- [ ] **Step 5: Run tests and verify green**

```bash
pnpm test
```

Expected: 1 test passes; `window` exists (proving jsdom env).

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts vitest.setup.ts __tests__/smoke.test.ts
git commit -m "test: configure Vitest + RTL with jsdom env"
```

---

## Task 5: Install + configure Playwright

**Files:**
- Modify: `package.json` (deps)
- Create: `playwright.config.ts`, `tests/e2e/home.spec.ts`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

const PORT = 4173;

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
    command: `pnpm exec serve out -l ${PORT} --no-clipboard --no-port-switching`,
    port: PORT,
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

- [ ] **Step 3: Install `serve` (used by Playwright to host the static export)**

```bash
pnpm add -D serve
```

- [ ] **Step 4: Write a failing home-page smoke test at `tests/e2e/home.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('home page renders the bootstrap heading', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: /microGPT 3D Tutorial/i })).toBeVisible();
  expect(errors, `unexpected console errors: ${errors.join('\n')}`).toEqual([]);
});
```

- [ ] **Step 5: Build + run e2e**

```bash
pnpm build
pnpm e2e:ci
```

Expected: 1 test passes. If `serve` exits with port-already-in-use, kill the stray process first.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml playwright.config.ts tests/e2e/home.spec.ts
git commit -m "test: configure Playwright e2e against static export"
```

---

## Task 6: Install R3F + drei + three

**Files:**
- Modify: `package.json` (deps)

- [ ] **Step 1: Install runtime deps**

```bash
pnpm add three @react-three/fiber @react-three/drei
pnpm add -D @types/three
```

- [ ] **Step 2: Verify install with a typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add three + @react-three/fiber + @react-three/drei"
```

---

## Task 7: TDD — `SceneViewer` base + WebGL detection

**Files:**
- Create: `components/3d/SceneViewer.tsx`, `components/3d/webgl.ts`, `components/3d/__tests__/SceneViewer.test.tsx`

**Why webgl.ts in this task:** jsdom has no WebGL, so R3F's `<Canvas>` throws during effect flush in tests. The component must consult `isWebGLAvailable()` to decide whether to mount the canvas; tests then mock that function to true/false to exercise each branch without ever booting WebGL.

- [ ] **Step 1: Write failing tests at `components/3d/__tests__/SceneViewer.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneViewer } from '../SceneViewer';
import * as webgl from '../webgl';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SceneViewer', () => {
  it('renders the HUD slot when WebGL is available', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(true);

    render(
      <SceneViewer height="400px" fallbackImage="/fallback.png" hud={<div>HUD</div>}>
        <mesh />
      </SceneViewer>
    );

    expect(screen.getByText('HUD')).toBeInTheDocument();
  });

  it('applies the provided height to its outer container', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(true);

    const { container } = render(
      <SceneViewer height="640px" fallbackImage="/fallback.png">
        <mesh />
      </SceneViewer>
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.style.height).toBe('640px');
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
pnpm test components/3d/__tests__/SceneViewer.test.tsx
```

Expected: FAIL with "Cannot find module '../SceneViewer'" or "Cannot find module '../webgl'".

- [ ] **Step 3: Implement `components/3d/webgl.ts`**

```ts
/**
 * True if the current browser can construct a WebGL rendering context.
 * Exported as a named function (not inlined) so tests can mock it.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Implement `components/3d/SceneViewer.tsx`**

```tsx
'use client';

import { Suspense, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as webgl from './webgl';

export interface SceneViewerProps {
  /** CSS height, e.g. "600px" or "60vh". Required so layout never collapses. */
  height: string;
  /** Static image shown if WebGL is unavailable. Path is browser-relative including basePath (e.g. "/microgpt-3d-tutorial/models/previews/foo.png"). */
  fallbackImage: string;
  /** Children rendered inside the R3F `<Canvas>`. */
  children: ReactNode;
  /** Optional HUD rendered above the canvas. */
  hud?: ReactNode;
}

export function SceneViewer({ height, fallbackImage, children, hud }: SceneViewerProps) {
  if (!webgl.isWebGLAvailable()) {
    return (
      <div style={{ width: '100%', height, position: 'relative' }}>
        <img
          src={fallbackImage}
          alt="Your browser doesn't support WebGL — showing static preview"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      {hud ? <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>{hud}</div> : null}
      <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Suspense fallback={null}>{children}</Suspense>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
}
```

Note: `webgl` is imported via namespace (`import * as webgl`) so `vi.spyOn(webgl, 'isWebGLAvailable')` actually replaces the binding the component reads. If you switch to a named import (`import { isWebGLAvailable }`), the spy won't intercept the call and tests will mysteriously see the real implementation.

- [ ] **Step 5: Run tests, expect pass**

```bash
pnpm test components/3d/__tests__/SceneViewer.test.tsx
```

Expected: 2 tests pass. (Mocking `isWebGLAvailable` to true means the canvas branch renders; jsdom still won't actually run WebGL, but RTL's render is synchronous enough that the structural DOM is observable before R3F's WebGL effect fires. If the test flickers due to R3F effects, wrap each render in `act(() => { render(...); })` from `@testing-library/react`.)

- [ ] **Step 6: Commit**

```bash
git add components/3d/SceneViewer.tsx components/3d/webgl.ts components/3d/__tests__/SceneViewer.test.tsx
git commit -m "feat(3d): SceneViewer with WebGL detection + HUD slot (Canvas branch)"
```

---

## Task 8: Add WebGL-unavailable fallback test

The implementation already lives in Task 7. This task adds the test that exercises the other branch (no WebGL → render `<img>`).

**Files:**
- Modify: `components/3d/__tests__/SceneViewer.test.tsx`

- [ ] **Step 1: Append the fallback test to `components/3d/__tests__/SceneViewer.test.tsx`**

```tsx
describe('SceneViewer · WebGL fallback', () => {
  it('renders the fallback image with descriptive alt text when WebGL is unavailable', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(false);

    render(
      <SceneViewer height="400px" fallbackImage="/microgpt-3d-tutorial/models/previews/test.png">
        <mesh />
      </SceneViewer>
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', '/microgpt-3d-tutorial/models/previews/test.png');
    expect(img).toHaveAttribute('alt', expect.stringMatching(/static preview/i));
  });
});
```

- [ ] **Step 2: Run tests, expect all pass**

```bash
pnpm test components/3d/__tests__/SceneViewer.test.tsx
```

Expected: 3 tests pass (2 from Task 7 + 1 here).

- [ ] **Step 3: Commit**

```bash
git add components/3d/__tests__/SceneViewer.test.tsx
git commit -m "test(3d): exercise SceneViewer fallback branch when WebGL is unavailable"
```

---

## Task 9: TDD — ErrorBoundary inside SceneViewer

**Files:**
- Modify: `components/3d/SceneViewer.tsx`, `components/3d/__tests__/SceneViewer.test.tsx`
- Create: `components/3d/SceneErrorBoundary.tsx`

- [ ] **Step 1: Append the failing test**

```tsx
function ThrowingChild(): React.ReactElement {
  throw new Error('boom');
}

describe('SceneViewer · ErrorBoundary', () => {
  it('renders an error card when a child throws during render', () => {
    vi.spyOn(webgl, 'isWebGLAvailable').mockReturnValue(true);
    // Silence React's expected console.error for this test
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <SceneViewer height="400px" fallbackImage="/microgpt-3d-tutorial/models/previews/test.png">
        <ThrowingChild />
      </SceneViewer>
    );

    expect(screen.getByText(/3D scene failed to load/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();

    errSpy.mockRestore();
  });
});
```

If `React` is not already imported at the top of the test file, add `import * as React from 'react';`.

- [ ] **Step 2: Run, expect failure**

```bash
pnpm test components/3d/__tests__/SceneViewer.test.tsx
```

Expected: FAIL ("3D scene failed to load" not found).

- [ ] **Step 3: Implement `components/3d/SceneErrorBoundary.tsx`**

```tsx
'use client';

import { Component, type ReactNode } from 'react';

interface State {
  hasError: boolean;
}

export class SceneErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Surface to dev tools; do not crash the page.
    // eslint-disable-next-line no-console
    console.error('[SceneViewer] caught error in 3D subtree:', error);
  }

  handleReload = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            gap: 8,
            background: '#fff7f7',
            border: '1px solid #f5c2c2',
            borderRadius: 8,
          }}
        >
          <p>3D scene failed to load.</p>
          <button type="button" onClick={this.handleReload}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Wrap children with `SceneErrorBoundary` inside `SceneViewer`**

Replace the `<Canvas>` block in `components/3d/SceneViewer.tsx` with:

```tsx
      <SceneErrorBoundary>
        <Canvas camera={{ position: [3, 3, 3], fov: 50 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[5, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>{children}</Suspense>
          <OrbitControls makeDefault />
        </Canvas>
      </SceneErrorBoundary>
```

Add the import at the top:

```tsx
import { SceneErrorBoundary } from './SceneErrorBoundary';
```

- [ ] **Step 5: Run tests, expect all pass**

```bash
pnpm test components/3d/__tests__/SceneViewer.test.tsx
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/3d/SceneErrorBoundary.tsx components/3d/SceneViewer.tsx components/3d/__tests__/SceneViewer.test.tsx
git commit -m "feat(3d): SceneErrorBoundary catches subtree throws and renders reload card"
```

---

## Task 10: TDD — `scripts/check-assets.mjs` asset validator

**Files:**
- Create: `scripts/check-assets.mjs`, `scripts/__tests__/check-assets.test.mjs`, `scripts/__tests__/fixtures/valid-primitive.glb`, `scripts/__tests__/fixtures/oversized-primitive.glb`

- [ ] **Step 1: Generate test fixtures**

`scripts/__tests__/fixtures/valid-primitive.glb` must be a real `.glb` file ≤ 50 KB and `oversized-primitive.glb` must be a real `.glb` file > 50 KB. Easiest path: copy any small `.glb` from elsewhere on your machine (or use a placeholder generated by Blender) for "valid" and pad the same file with trailing bytes (or use a larger `.glb`) for "oversized."

```bash
mkdir -p scripts/__tests__/fixtures
# Replace these two commands with real .glb files matching the size constraints:
# - valid-primitive.glb: any small .glb < 50KB
# - oversized-primitive.glb: same content + padding so size > 50KB
#
# Example using `dd` to fabricate placeholder bytes (NOT a real .glb — substitute real ones before running tests):
echo "REPLACE WITH REAL .glb < 50KB" > scripts/__tests__/fixtures/valid-primitive.glb
dd if=/dev/zero bs=1024 count=100 >> scripts/__tests__/fixtures/oversized-primitive.glb 2>/dev/null
```

The `check-assets` script inspects only file size and path conventions (kebab-case filename, allowed directory) — it does not parse GLB binary content. So for these unit tests, **the fixture files do not need to be valid `.glb` files**; any file at the correct path with the correct size suffices. The two shell commands above produce: one ~28-byte text file (passes 50KB cap) and one 100KB zero-filled file (exceeds 50KB cap). That is enough for the tests.

For end-to-end validation later (Task 13), the real `_hello.glb` produced by Blender is used.

- [ ] **Step 2: Write failing tests at `scripts/__tests__/check-assets.test.mjs`**

```js
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateAsset, PRIMITIVE_MAX_BYTES } from '../check-assets.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, 'fixtures');

describe('check-assets', () => {
  it('accepts a primitive .glb under the size cap in the correct folder', () => {
    const result = validateAsset({
      absolutePath: path.join(fixtures, 'valid-primitive.glb'),
      repoRelativePath: 'public/models/primitives/valid-primitive.glb',
    });
    expect(result.ok).toBe(true);
  });

  it('rejects a primitive .glb exceeding the size cap', () => {
    const result = validateAsset({
      absolutePath: path.join(fixtures, 'oversized-primitive.glb'),
      repoRelativePath: 'public/models/primitives/oversized-primitive.glb',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeds.*primitive/i);
    expect(PRIMITIVE_MAX_BYTES).toBe(50 * 1024);
  });

  it('rejects files with non-kebab-case names', () => {
    const result = validateAsset({
      absolutePath: path.join(fixtures, 'valid-primitive.glb'),
      repoRelativePath: 'public/models/primitives/Bad_Name.glb',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/kebab-case/i);
  });

  it('rejects files in unknown subdirectories', () => {
    const result = validateAsset({
      absolutePath: path.join(fixtures, 'valid-primitive.glb'),
      repoRelativePath: 'public/models/weird/valid-primitive.glb',
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/unknown.*directory|allowed/i);
  });

  it('allows the special _hello.glb at the models root', () => {
    const result = validateAsset({
      absolutePath: path.join(fixtures, 'valid-primitive.glb'),
      repoRelativePath: 'public/models/_hello.glb',
    });
    expect(result.ok).toBe(true);
  });
});
```

- [ ] **Step 3: Run, expect failure**

```bash
pnpm test scripts/__tests__/check-assets.test.mjs
```

Expected: FAIL ("Cannot find module '../check-assets.mjs'").

- [ ] **Step 4: Implement `scripts/check-assets.mjs`**

```js
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import process from 'node:process';

export const PRIMITIVE_MAX_BYTES = 50 * 1024;
export const SCENE_MAX_BYTES = 300 * 1024;

const ALLOWED_CATEGORIES = new Set(['primitives', 'overview', 'autograd', 'attention', 'previews']);
const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*\.(glb|png)$/;
const HELLO_ROOT_FILE = '_hello.glb';

/**
 * Validate one asset.
 * @param {{ absolutePath: string, repoRelativePath: string }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function validateAsset({ absolutePath, repoRelativePath }) {
  const normalized = repoRelativePath.replace(/\\/g, '/');
  if (!normalized.startsWith('public/models/')) {
    return { ok: false, reason: `not under public/models/: ${normalized}` };
  }

  const relUnderModels = normalized.slice('public/models/'.length);
  const segments = relUnderModels.split('/');

  // Root-level _hello.glb is allowed.
  if (segments.length === 1) {
    if (segments[0] !== HELLO_ROOT_FILE) {
      return { ok: false, reason: `only ${HELLO_ROOT_FILE} is allowed at models/ root; got ${segments[0]}` };
    }
  } else if (segments.length === 2) {
    const [category, filename] = segments;
    if (!ALLOWED_CATEGORIES.has(category)) {
      return { ok: false, reason: `unknown category directory "${category}" (allowed: ${[...ALLOWED_CATEGORIES].join(', ')})` };
    }
    if (!KEBAB_CASE.test(filename)) {
      return { ok: false, reason: `filename "${filename}" is not kebab-case .glb/.png` };
    }
  } else {
    return { ok: false, reason: `unexpected nesting depth for ${normalized}` };
  }

  let size;
  try {
    size = fs.statSync(absolutePath).size;
  } catch (err) {
    return { ok: false, reason: `cannot stat file: ${err.message}` };
  }

  // PNG previews are not size-checked here (covered by a separate manual review).
  if (absolutePath.endsWith('.png')) {
    return { ok: true };
  }

  const isPrimitive = segments[0] === 'primitives' || segments[0] === HELLO_ROOT_FILE;
  const cap = isPrimitive ? PRIMITIVE_MAX_BYTES : SCENE_MAX_BYTES;
  const label = isPrimitive ? 'primitive' : 'scene';
  if (size > cap) {
    return { ok: false, reason: `size ${size}B exceeds ${label} cap of ${cap}B` };
  }

  return { ok: true };
}

async function main() {
  const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
  const modelsRoot = path.join(repoRoot, 'public', 'models');
  if (!fs.existsSync(modelsRoot)) {
    console.log('[check-assets] no public/models/ directory yet — nothing to check.');
    return;
  }

  const failures = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
      } else if (entry.isFile()) {
        const rel = path.relative(repoRoot, abs).split(path.sep).join('/');
        const result = validateAsset({ absolutePath: abs, repoRelativePath: rel });
        if (!result.ok) failures.push({ path: rel, reason: result.reason });
      }
    }
  };
  walk(modelsRoot);

  if (failures.length) {
    console.error(`[check-assets] ${failures.length} asset violation(s):`);
    for (const f of failures) console.error(`  - ${f.path}: ${f.reason}`);
    process.exit(1);
  }
  console.log('[check-assets] all assets pass.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
```

- [ ] **Step 5: Run tests, expect all pass**

```bash
pnpm test scripts/__tests__/check-assets.test.mjs
```

Expected: 5 tests pass. (If a fixture file is invalid because Step 1 produced placeholder content, fix the fixture and re-run.)

- [ ] **Step 6: Commit**

```bash
git add scripts/
git commit -m "feat(ci): check-assets.mjs enforces §5 asset rules with TDD coverage"
```

---

## Task 11: Blender MCP setup documentation

**Files:**
- Create: `blender/README.md`

This task is documentation-only. Installing Blender MCP Server is a one-time **human action**; the spec confirmed Blender is already installed but MCP is not. The README captures the exact installation and verification procedure so any future contributor can reproduce it.

- [ ] **Step 1: Create `blender/README.md`**

```markdown
# Blender MCP Workflow

This project generates every `.glb` asset by running a Python script in Blender. The scripts live in `blender/scripts/`; their outputs are committed to `public/models/`.

We orchestrate Blender remotely via [Blender MCP Server](https://github.com/ahujasid/blender-mcp). Once the server is running, an AI agent (or a human via the same protocol) can invoke Blender from outside the GUI.

## One-time setup

1. **Verify Blender is installed.** Blender ≥ 4.0 recommended.

   ```bash
   blender --version
   ```

2. **Install the `blender-mcp` Python package** into the Python environment Blender uses for its addons, then enable the addon inside Blender.

   Specific steps vary by OS and Blender version; consult the upstream README at https://github.com/ahujasid/blender-mcp for the current procedure. After installation, "Blender MCP" should appear under Blender → Preferences → Add-ons.

3. **Start the MCP server inside Blender.** The default port is `9876` on `localhost`.

4. **Smoke test.** From this repo root, run:

   ```bash
   pnpm exec node blender/scripts/_invoke.mjs blender/scripts/_hello_cube.py
   ```

   This dispatches `_hello_cube.py` through the MCP server. On success, `public/models/_hello.glb` exists and is < 50 KB.

   (The `_invoke.mjs` helper is **not yet written** in Phase 0 — for the manual bootstrap, you can instead open `_hello_cube.py` in Blender's text editor and run it directly. Phase 1+ will add the helper for repeatable invocation.)

## Authoring rules (enforced by `scripts/check-assets.mjs`)

- Each `.glb` ≤ 50 KB (primitive) or ≤ 300 KB (scene-level).
- Geometry ≤ 2,000 triangles per file.
- PBR standard nodes only — no image textures.
- Animation names use `play_<verb>` (e.g., `play_forward`).
- Filenames: `kebab-case.glb`; one of `public/models/{primitives,overview,autograd,attention,previews}/` (or root for `_hello.glb`).

See `docs/superpowers/specs/2026-05-28-microgpt-3d-tutorial-design.md` §5 for the authoritative list.

## Troubleshooting

- **MCP server not reachable:** confirm Blender is running, the addon is enabled, and port `9876` is not blocked.
- **Script runs but no `.glb` appears:** the script must end with `bpy.ops.export_scene.gltf(filepath=<absolute path>, export_format='GLB')`. Check the path is absolute, not relative to Blender's CWD (which differs from this repo's root).
```

- [ ] **Step 2: Commit**

```bash
git add blender/README.md
git commit -m "docs(blender): MCP setup, smoke test, and authoring rules"
```

---

## Task 12: Blender hello-cube script + generate `_hello.glb`

**Files:**
- Create: `blender/scripts/_hello_cube.py`, `public/models/_hello.glb`

- [ ] **Step 1: Write `blender/scripts/_hello_cube.py`**

```python
"""
Phase 0 smoke asset: generate a 1m cube and export to public/models/_hello.glb.

Run from Blender's text editor, or via the Blender MCP server.
Always starts from factory defaults so the output is deterministic.
"""
import os
import bpy

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir, os.pardir))
OUTPUT_PATH = os.path.join(REPO_ROOT, 'public', 'models', '_hello.glb')


def main() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, 0.0))

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_apply=True,
    )
    print(f'[hello_cube] wrote {OUTPUT_PATH}')


if __name__ == '__main__':
    main()
```

- [ ] **Step 2: Run the script in Blender**

Choose one path:

- **Option A (manual):** open `blender/scripts/_hello_cube.py` in Blender's text editor and click "Run Script."
- **Option B (MCP):** with Blender MCP server running, send the script through it (consult `blender/README.md`).

Expected: `public/models/_hello.glb` exists, size < 50 KB.

- [ ] **Step 3: Verify it passes `check-assets`**

```bash
pnpm check-assets
```

Expected output: `[check-assets] all assets pass.`

If it fails, read the message and adjust either the script (e.g., reduce geometry) or the file path.

- [ ] **Step 4: Commit**

```bash
git add blender/scripts/_hello_cube.py public/models/_hello.glb
git commit -m "feat(blender): hello-cube script + generated _hello.glb smoke asset"
```

---

## Task 13: `/sandbox-check` page that loads `_hello.glb`

**Files:**
- Create: `app/sandbox-check/page.tsx`, `components/3d/HelloCube.tsx`

- [ ] **Step 1: Write `components/3d/HelloCube.tsx`**

```tsx
'use client';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';

const URL = '/microgpt-3d-tutorial/models/_hello.glb';

export function HelloCube() {
  const ref = useRef<Group>(null);
  const { scene } = useGLTF(URL);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.5;
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(URL);
```

- [ ] **Step 2: Write `app/sandbox-check/page.tsx`**

```tsx
import { SceneViewer } from '@/components/3d/SceneViewer';
import { HelloCube } from '@/components/3d/HelloCube';

export const metadata = {
  title: 'Sandbox check — microGPT 3D',
};

export default function SandboxCheckPage() {
  return (
    <main style={{ padding: 24, maxWidth: 960, margin: '0 auto' }}>
      <h1>Sandbox check</h1>
      <p>
        Phase 0 smoke test. If the cube is rotating below, the full pipeline (Blender → .glb →
        Next.js static export → R3F render) is working end-to-end.
      </p>
      <SceneViewer height="480px" fallbackImage="/microgpt-3d-tutorial/models/_hello.png">
        <HelloCube />
      </SceneViewer>
    </main>
  );
}
```

- [ ] **Step 3: Generate a one-off PNG fallback for the hello cube**

The SceneViewer expects a fallback image. For the Phase 0 smoke asset, a placeholder is fine.

Take a screenshot of the rotating cube in your dev browser and save it as `public/models/_hello.png` (PNG, ≤ 50 KB). This file is used only for the WebGL-unavailable branch.

```bash
ls -la public/models/_hello.png
```

Expected: file exists.

- [ ] **Step 4: Run dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:3000/microgpt-3d-tutorial/sandbox-check/`. Expected: a rotating cube. OrbitControls work (click and drag rotates manually).

Press Ctrl+C to stop.

- [ ] **Step 5: Commit**

```bash
git add app/sandbox-check/ components/3d/HelloCube.tsx public/models/_hello.png
git commit -m "feat(sandbox-check): /sandbox-check route loads and rotates _hello.glb"
```

---

## Task 14: Playwright smoke for `/sandbox-check`

**Files:**
- Create: `tests/e2e/sandbox-check.spec.ts`

- [ ] **Step 1: Write `tests/e2e/sandbox-check.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('sandbox-check page loads the hello cube without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/sandbox-check/');

  await expect(page.getByRole('heading', { name: /Sandbox check/i })).toBeVisible();

  // The R3F canvas mounts asynchronously; wait for an actual <canvas> element to appear.
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  // Give R3F + useGLTF a beat to settle.
  await page.waitForTimeout(1_500);

  expect(errors, `unexpected console errors:\n${errors.join('\n')}`).toEqual([]);
});
```

- [ ] **Step 2: Build + run e2e**

```bash
pnpm build
pnpm e2e:ci
```

Expected: 2 tests pass (`home.spec.ts` + `sandbox-check.spec.ts`).

If the canvas never appears, double-check that `_hello.glb` was copied into `out/_next/static/...` by the build (look under `out/models/_hello.glb`).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/sandbox-check.spec.ts
git commit -m "test(e2e): sandbox-check renders canvas with zero console errors"
```

---

## Task 15: ESLint baseline

**Files:**
- Modify: `package.json` (deps)
- Create: `.eslintrc.cjs`, `.eslintignore`

- [ ] **Step 1: Install ESLint config**

```bash
pnpm add -D eslint eslint-config-next
```

- [ ] **Step 2: Create `.eslintrc.cjs`**

```js
module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // R3F components use lowercase JSX intrinsics like <ambientLight />, which Next's
    // default unknown-property rule does not understand. Allow them explicitly.
    'react/no-unknown-property': 'off',
  },
};
```

- [ ] **Step 3: Create `.eslintignore`**

```
node_modules
out
.next
playwright-report
test-results
public/models
```

- [ ] **Step 4: Run lint and fix any issues**

```bash
pnpm lint
```

Expected: 0 errors. If errors appear, fix the offending code (not the rule).

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml .eslintrc.cjs .eslintignore
git commit -m "chore(lint): ESLint baseline with next/core-web-vitals + R3F exception"
```

---

## Task 16: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test

      - name: Check assets
        run: pnpm check-assets

      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium

      - name: Build (static export)
        run: pnpm build

      - name: End-to-end smoke
        run: pnpm e2e:ci

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: out

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit + push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: GitHub Actions deploy workflow with full quality chain"
git push origin main
```

- [ ] **Step 3: Watch the workflow run**

```bash
gh run watch
```

Expected: every step is green. If any step fails, read the log, fix the underlying cause locally, push a new commit, and re-watch. **Do not** add `continue-on-error` or otherwise skip failures.

---

## Task 17: Enable GitHub Pages

This is a one-time, manual repository setting.

- [ ] **Step 1: Open the repo settings**

```bash
gh repo view --web -b main
```

Then navigate to **Settings → Pages**.

- [ ] **Step 2: Set source to "GitHub Actions"**

Under "Build and deployment," set "Source" to **GitHub Actions**. Save.

- [ ] **Step 3: Trigger or wait for the deploy workflow**

If the most recent CI run already completed before Pages was enabled, re-run it:

```bash
gh workflow run deploy.yml
gh run watch
```

- [ ] **Step 4: Verify the deployed site**

Visit:
- `https://lxb12123.github.io/microgpt-3d-tutorial/` — home with "Bootstrap successful" content.
- `https://lxb12123.github.io/microgpt-3d-tutorial/sandbox-check/` — rotating hello cube.

Both should load and the cube should rotate. **This is the Phase 0 exit gate.**

- [ ] **Step 5: Record success in the repo**

No commit needed — Pages settings are not in version control. If you want to leave a paper trail, append a short note to `blender/README.md` or open a GitHub Discussion.

---

## Task 18: Phase 0 README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# microGPT 3D Tutorial

An interactive 3D-visualized tutorial for Andrej Karpathy's [~150-line pure-Python microGPT](https://gist.github.com/karpathy/8627fe009c40f57531cb18360106ce95). Built with Next.js, React Three Fiber, Tailwind, and Blender-authored `.glb` assets. The browser runs a TypeScript port of microGPT inference so every visualization reflects real model output.

**Live site:** https://lxb12123.github.io/microgpt-3d-tutorial/

**Status:** Phase 0 — Bootstrap. Application skeleton, 3D viewer infrastructure, and Blender MCP pipeline are in place. Three full lessons (autograd, attention, overview) ship in Phase 2.

## Quick start

```bash
pnpm install
pnpm dev
# open http://localhost:3000/microgpt-3d-tutorial/
```

## Project layout

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router shell |
| `content/` | MDX lesson content (one file per lesson, Phase 2+) |
| `components/3d/` | R3F components: `SceneViewer` infra, primitives, sandboxes |
| `src/` | English-annotated Python source (`microgpt_annotated.py`) + TypeScript inference port (Phase 1+) |
| `public/models/` | `.glb` assets produced by Blender |
| `blender/` | Blender Python scripts + MCP workflow docs |
| `scripts/` | Build-time helpers (e.g., `check-assets.mjs`) |
| `docs/superpowers/` | Design specs and implementation plans |

## Development scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Local dev server with HMR |
| `pnpm build` | Static export to `out/` |
| `pnpm typecheck` | TS compile check |
| `pnpm lint` | ESLint |
| `pnpm test` | Vitest unit + component tests |
| `pnpm check-assets` | Enforce `.glb` size, naming, location rules |
| `pnpm e2e:ci` | Playwright smoke against the built static export |

## 3D asset authoring

All `.glb` files are produced by Python scripts in `blender/scripts/` run via Blender (typically through the Blender MCP server). See `blender/README.md` for setup and authoring rules.

## License

MIT (planned). See `LICENSE` once added.
```

- [ ] **Step 2: Commit + push**

```bash
git add README.md
git commit -m "docs(readme): project overview, quick start, scripts"
git push origin main
```

- [ ] **Step 3: Verify on GitHub**

```bash
gh repo view --web
```

Confirm the README renders cleanly on the repo home page and links resolve.

---

## Exit Gate (Phase 0 acceptance)

All of the following must be true:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm check-assets`, `pnpm build`, `pnpm e2e:ci` all pass locally.
- [ ] GitHub Actions `deploy.yml` workflow runs green on `main`.
- [ ] https://lxb12123.github.io/microgpt-3d-tutorial/ serves the home page with the bootstrap heading.
- [ ] https://lxb12123.github.io/microgpt-3d-tutorial/sandbox-check/ serves the rotating hello cube (OrbitControls responsive).
- [ ] `README.md` renders correctly on the GitHub repo homepage.
- [ ] All commits land on `main` with conventional commit prefixes.

Once all of the above are checked, Phase 0 is complete and Phase 1 planning can begin.
