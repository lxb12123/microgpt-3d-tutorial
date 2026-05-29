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
