'use client';

import dynamic from 'next/dynamic';

export const AutogradSandbox = dynamic(
  () => import('./autograd/AutogradSandbox').then((m) => m.AutogradSandbox),
  { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
);

// Placeholders that later tasks (C6 / D4) will replace with real components.
// Disabled until those modules exist so `tsc --noEmit` stays green.
// export const AttentionSandbox = dynamic(
//   () => import('./attention/AttentionSandbox').then((m) => m.AttentionSandbox),
//   { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
// );

// export const OverviewSandbox = dynamic(
//   () => import('./overview/OverviewSandbox').then((m) => m.OverviewSandbox),
//   { ssr: false, loading: () => <p>Loading 3D sandbox…</p> },
// );
