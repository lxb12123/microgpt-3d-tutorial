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
