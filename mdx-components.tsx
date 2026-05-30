import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs';
import { AutogradSandbox, AttentionSandbox, OverviewSandbox, HomeHero } from '@/components/3d';

const docsComponents = getDocsMDXComponents();

export function useMDXComponents(components: Record<string, React.ComponentType>) {
  return {
    ...docsComponents,
    AutogradSandbox,
    AttentionSandbox,
    OverviewSandbox,
    HomeHero,
    ...components,
  };
}
