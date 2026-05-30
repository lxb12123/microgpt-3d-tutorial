'use client';

import dynamic from 'next/dynamic';

export const AutogradSandbox = dynamic(
  () => import('./autograd/AutogradSandbox').then((m) => m.AutogradSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

export const AttentionSandbox = dynamic(
  () => import('./attention/AttentionSandbox').then((m) => m.AttentionSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

// Placeholder that task D4 will replace with the real component.
// Disabled until that module exists so `tsc --noEmit` stays green.

// export const OverviewSandbox = dynamic(
//   () => import('./overview/OverviewSandbox').then((m) => m.OverviewSandbox),
//   { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
// );
