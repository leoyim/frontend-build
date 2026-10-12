import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const siteUrl = 'https://ebook.leoyim.cn';
// 自定义域名下，GitHub Pages 会把 artifact 根目录直接映射到域名根路径（仓库名段不进 URL），
// 因此要让站点落在 /frontend-build/ 子路径，必须由 CI 把构建产物放进 artifact 的
// frontend-build/ 子目录里（见 .github/workflows/deploy.yml），baseUrl 与之一致。
const siteBaseUrl = '/frontend-build/';
// PDF 由 scripts/generate-pdf.mjs 在构建后生成，链接检查阶段该文件尚不存在，
// 因此这里使用绝对地址，既避免误报断链，也保证下载入口稳定可点。
const bookPdfUrl = `${siteUrl}${siteBaseUrl}pdf/frontend-build-ebook.pdf`;

const config: Config = {
  title: '前端打包构建：从底层原理到工程实践',
  tagline: '由真实互动教学沉淀而成的技术电子书',
  favicon: 'img/favicon.svg',
  future: {
    v4: true,
  },
  url: siteUrl,
  baseUrl: siteBaseUrl,
  onBrokenLinks: 'warn',
  // 源内容中的中文锚点沿用原书标题 slug 习惯，与 Docusaurus 生成规则不完全一致；
  // 为不修改原文内容，这里忽略锚点不匹配的告警。
  onBrokenAnchors: 'ignore',
  clientModules: ['./src/theme/prismDiff.ts', './src/theme/readingProgress.ts'],

  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  markdown: {
    // 正文全部为纯 Markdown（无 JSX），使用 detect 模式按 CommonMark 解析，
    // 避免 MDX 对 `<`、`{` 等字符的严格解析导致构建失败。
    format: 'detect',
    mermaid: true,
  },

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        indexDocs: true,
        indexBlog: false,
        indexPages: false,
        docsRouteBasePath: '/docs',
        docsDir: 'docs',
        hashed: true,
        language: ['en', 'zh'],
        removeDefaultStopWordFilter: true,
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 8,
        searchResultContextMaxLength: 60,
        explicitSearchResultPath: true,
        searchBarShortcut: true,
        searchBarShortcutHint: true,
        searchBarPosition: 'right',
        fuzzyMatchingDistance: 1,
      } satisfies Record<string, unknown>,
    ],
    '@docusaurus/theme-mermaid',
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          path: 'docs',
          // 保留文件名中的编号前缀（01-、02-…），使文档 id / URL 与源文件名一一对应
          numberPrefixParser: false,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  customFields: {
    version: '1.0.0',
  },

  themeConfig: {
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    tableOfContents: {
      minHeadingLevel: 2,
      maxHeadingLevel: 3,
    },
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '前端打包构建',
      logo: {
        alt: '前端打包构建',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: '目录',
        },
        {
          to: '/docs/appendix/glossary',
          position: 'right',
          label: '术语表',
        },
        {
          href: bookPdfUrl,
          position: 'right',
          label: '下载 PDF',
        },
      ],
    },
    footer: {
      style: 'dark',
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['diff', 'bash', 'json', 'yaml'],
    },
    mermaid: {
      theme: {light: 'default', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;