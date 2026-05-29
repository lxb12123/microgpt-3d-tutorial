import { generateStaticParamsFor, importPage } from 'nextra/pages';
import { useMDXComponents } from '../../mdx-components';
import ClientPageContent from './client-page';

export const generateStaticParams = generateStaticParamsFor('mdxPath');

export async function generateMetadata({ params }: { params: Promise<{ mdxPath?: string[] }> }) {
  const { mdxPath } = await params;
  const { metadata } = await importPage(mdxPath);
  return metadata;
}

export default async function Page({ params }: { params: Promise<{ mdxPath?: string[] }> }) {
  const { mdxPath } = await params;
  const result = await importPage(mdxPath);
  const { default: MDXContent, toc, metadata, sourceCode } = result;
  return (
    <ClientPageContent MDXContent={MDXContent} toc={toc} metadata={metadata} sourceCode={sourceCode} />
  );
}
