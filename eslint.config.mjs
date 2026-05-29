import nextConfig from 'eslint-config-next/core-web-vitals';

export default [
  ...nextConfig,
  {
    rules: {
      // R3F components use lowercase JSX intrinsics like <ambientLight />, which Next's
      // default unknown-property rule does not understand. Allow them explicitly.
      'react/no-unknown-property': 'off',
    },
  },
  {
    ignores: ['node_modules/**', 'out/**', '.next/**', 'playwright-report/**', 'test-results/**', 'public/models/**'],
  },
];
