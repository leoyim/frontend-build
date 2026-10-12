import Layout from '@theme-original/DocItem/Layout';
import type {Props} from '@theme/DocItem/Layout';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import {MermaidThemeProvider} from '@site/src/context/MermaidThemeContext';
export default function DocItemLayoutWrapper(props: Props): React.ReactNode {
  const {frontMatter} = useDoc();
  const mermaidTheme = (frontMatter as Record<string, unknown>)?.mermaidTheme as string | undefined;
  return (
    <MermaidThemeProvider theme={mermaidTheme ?? null}>
      <Layout {...props} />
    </MermaidThemeProvider>
  );
}