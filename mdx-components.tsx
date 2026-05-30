import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { AutogradSandbox } from '@/components/3d';

const docsComponents = getDocsMDXComponents();

export function useMDXComponents(components: Record<string, React.ComponentType>) {
  return {
    ...docsComponents,
    AutogradSandbox,
    // AttentionSandbox / OverviewSandbox will be wired in tasks C6 / D4.
    ...components,
  };
}
