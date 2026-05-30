import nextra from 'nextra';
import bundleAnalyzer from '@next/bundle-analyzer';

const withNextra = nextra({
  // Nextra v3 reads MDX from the `content/` directory by default.
  // Empty options object keeps defaults; override only if necessary.
});

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
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

// Compose Nextra (innermost) then the analyzer wrapper, so ANALYZE=true
// instruments the final webpack config emitted by Nextra+Next.
export default withBundleAnalyzer(withNextra(nextConfig));
