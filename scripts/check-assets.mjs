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
