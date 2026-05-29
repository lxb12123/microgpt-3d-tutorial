'use client';

import { useMDXComponents } from '../../mdx-components';

interface ClientPageContentProps {
  MDXContent: React.ComponentType;
  toc: unknown;
  metadata: unknown;
  sourceCode: unknown;
}

export default function ClientPageContent({
  MDXContent,
  toc,
  metadata,
  sourceCode,
}: ClientPageContentProps) {
  const components = useMDXComponents({});
  const Wrapper = components.wrapper;
  return Wrapper ? (
    <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
      <MDXContent />
    </Wrapper>
  ) : (
    <MDXContent />
  );
}
