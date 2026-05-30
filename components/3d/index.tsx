'use client';

import dynamic from 'next/dynamic';
import { LazyMount } from './LazyMount';
import type { AutogradSandboxProps } from './autograd/AutogradSandbox';
import type { AttentionSandboxProps } from './attention/AttentionSandbox';
import type { OverviewSandboxProps } from './overview/OverviewSandbox';

// Per-lesson sandboxes are dynamic-imported (no SSR — they need WebGL) AND
// gated behind LazyMount so the three.js + drei + R3F chunk only fetches when
// the reader scrolls toward the sandbox section. Without the gate, Lighthouse
// LCP/TBT on /02-autograd (the heaviest DAG) dropped below the Perf=90 target.

const AutogradSandboxImpl = dynamic(
  () => import('./autograd/AutogradSandbox').then((m) => m.AutogradSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

const AttentionSandboxImpl = dynamic(
  () => import('./attention/AttentionSandbox').then((m) => m.AttentionSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

const OverviewSandboxImpl = dynamic(
  () => import('./overview/OverviewSandbox').then((m) => m.OverviewSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

export function AutogradSandbox(props: AutogradSandboxProps) {
  return <LazyMount><AutogradSandboxImpl {...props} /></LazyMount>;
}

export function AttentionSandbox(props: AttentionSandboxProps) {
  return <LazyMount><AttentionSandboxImpl {...props} /></LazyMount>;
}

export function OverviewSandbox(props: OverviewSandboxProps) {
  return <LazyMount><OverviewSandboxImpl {...props} /></LazyMount>;
}
