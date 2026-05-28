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
