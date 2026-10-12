import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    {type: 'doc', id: 'README', label: '本书简介'},
    {type: 'doc', id: 'SUMMARY', label: '完整目录'},
    {
      type: 'category',
      label: '正文',
      collapsed: false,
      items: [
        {type: 'doc', id: 'chapters/01-frontend-build-basics', label: '第 1 章 · 前端构建基础'},
        {type: 'doc', id: 'chapters/02-core-build-principles', label: '第 2 章 · 核心构建原理'},
        {type: 'doc', id: 'chapters/03-webpack-and-vite', label: '第 3 章 · Webpack 与 Vite'},
        {type: 'doc', id: 'chapters/04-next-generation-tools', label: '第 4 章 · 新一代构建工具'},
        {type: 'doc', id: 'chapters/05-build-performance', label: '第 5 章 · 构建性能优化'},
        {type: 'doc', id: 'chapters/06-ai-assisted-build', label: '第 6 章 · AI 辅助构建工程'},
        {type: 'doc', id: 'chapters/07-practice-and-selection', label: '第 7 章 · 工程实践与选型'},
      ],
    },
    {
      type: 'category',
      label: '实践',
      collapsed: true,
      items: [
        {type: 'doc', id: 'practice/examples/README', label: '示例代码'},
      ],
    },
    {
      type: 'category',
      label: '决策',
      collapsed: true,
      items: [{type: 'doc', id: 'decisions/tool-selection', label: '工具选型决策记录'}],
    },
    {
      type: 'category',
      label: '附录',
      collapsed: true,
      items: [
        {type: 'doc', id: 'appendix/glossary', label: '术语表'},
        {type: 'doc', id: 'appendix/configuration-reference', label: '配置参考'},
        {type: 'doc', id: 'appendix/references', label: '参考资料'},
      ],
    },
  ],
};

export default sidebars;