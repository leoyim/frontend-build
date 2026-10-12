import {type ReactNode} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {useThemeConfig} from '@docusaurus/theme-common';
export default function Footer(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  const {footer} = useThemeConfig();
  if (!footer) return null;
  const version = (siteConfig.customFields as {version?: string}).version;
  return (
    <footer
      style={{
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 1rem',
        fontSize: 12,
        backgroundColor: 'var(--ifm-footer-background-color, #1b1b1d)',
        color: 'var(--ifm-footer-color, #8b949e)',
        borderTop: '1px solid var(--ifm-color-emphasis-200)',
      }}>
      {version && <span>v{version}</span>}
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
        }}>
        <a
          href="https://github.com/leoyim/leoyim-doc-template/tree/master"
          target="_blank"
          rel="noopener noreferrer"
          style={{color: 'inherit', textDecoration: 'underline'}}>
          文档项目模板：leoyim-doc-template
        </a>
        <span>
          Copyright &copy; {new Date().getFullYear()} 前端打包构建电子书
        </span>
      </span>
    </footer>
  );
}