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
