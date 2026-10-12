import {type ReactNode} from 'react';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

const readingPaths = [
  {
    title: '想建立完整心智模型',
    desc: '按顺序读 01 → 07，从浏览器模块机制一直走到选型决策。',
    to: '/docs/chapters/01-frontend-build-basics',
    cta: '从第 1 章开始',
  },
  {
    title: '只想知道 Webpack 和 Vite 怎么选',
    desc: '第 3 章 → 第 7 章 §7.5 决策矩阵。',
    to: '/docs/chapters/03-webpack-and-vite',
    cta: '进入第 3 章',
  },
  {
    title: '手上有个老项目想提速',
    desc: '第 4 章 §4.3（Rspack）→ 第 7 章 §7.6（迁移评估）。',
    to: '/docs/chapters/04-next-generation-tools',
    cta: '进入第 4 章',
  },
  {
    title: '想复习关键结论',
    desc: '术语表，快速回看核心概念与适用条件。',
    to: '/docs/appendix/glossary',
    cta: '打开术语表',
  },
  {
    title: '想看踩过哪些坑',
    desc: '各章「常见误区」，认知误区与修正过程。',
    to: '/docs/chapters/07-practice-and-selection',
    cta: '查看常见误区',
  },
  {
    title: '想动手',
    desc: '示例配置代码，把知识落到能跑的代码上。',
    to: '/docs/practice/examples',
    cta: '开始动手',
  },
];

const facts = [
  ['7', '章正文'],
  ['22', '节课程内容'],
  ['3', '天互动教学'],
  ['v1.0.0', '版本'],
];

export default function Home(): ReactNode {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>
      <div className="ebook-cover">
        <header style={{textAlign: 'center', padding: '5rem 0 2.5rem'}}>
          <div className="container">
            <p
              style={{
                letterSpacing: '0.3em',
                fontSize: '0.8rem',
                color: 'var(--ifm-color-primary)',
                marginBottom: '1rem',
                textTransform: 'uppercase',
              }}>
              技术电子书
            </p>
            <Heading as="h1" style={{fontSize: '2.75rem', marginBottom: '0.75rem'}}>
              前端打包构建
            </Heading>
            <p
              style={{
                fontSize: '1.35rem',
                fontWeight: 500,
                color: 'var(--ifm-color-emphasis-800)',
                marginBottom: '1rem',
              }}>
              从底层原理到工程实践
            </p>
            <p
              style={{
                fontSize: '1.05rem',
                color: 'var(--ifm-color-emphasis-600)',
                marginBottom: '2rem',
                maxWidth: 560,
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.9,
              }}>
              一本由真实互动教学沉淀而成的技术读物。把三天的讲解、追问、批改与纠错，
              重组成可以独立阅读、系统复习、实践验证的知识体系。
            </p>
            <div style={{display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap'}}>
              <Link
                to="/docs/chapters/01-frontend-build-basics"
                className="button button--primary button--lg"
                style={{fontWeight: 600}}>
                开始阅读
              </Link>
              <Link
                to="/docs/SUMMARY"
                className="button button--secondary button--lg"
                style={{fontWeight: 600}}>
                查看完整目录
              </Link>
            </div>
            <div
              style={{
                display: 'flex',
                gap: '2.5rem',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginTop: '2.5rem',
              }}>
              {facts.map(([value, label]) => (
                <div key={label} style={{textAlign: 'center'}}>
                  <div
                    style={{
                      fontSize: '1.6rem',
                      fontWeight: 700,
                      color: 'var(--ifm-color-primary)',
                      lineHeight: 1.2,
                    }}>
                    {value}
                  </div>
                  <div
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--ifm-color-emphasis-600)',
                    }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </header>
      </div>

      <main>
        <section style={{padding: '1rem 0 3rem'}}>
          <div className="container">
            <Heading
              as="h2"
              style={{textAlign: 'center', marginBottom: '0.5rem', fontSize: '1.6rem'}}>
              选择你的阅读路径
            </Heading>
            <p
              style={{
                textAlign: 'center',
                color: 'var(--ifm-color-emphasis-600)',
                marginBottom: '2rem',
              }}>
              不必从头读到尾 —— 按你当下的问题进入。
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '1rem',
                maxWidth: 960,
                margin: '0 auto',
              }}>
              {readingPaths.map((p) => (
                <Link
                  key={p.title}
                  to={p.to}
                  style={{
                    display: 'block',
                    padding: '1.25rem',
                    borderRadius: 'var(--ifm-global-radius)',
                    border: '1px solid var(--ifm-color-emphasis-300)',
                    background: 'var(--ifm-background-surface-color)',
                    color: 'inherit',
                    textDecoration: 'none',
                  }}>
                  <Heading as="h3" style={{marginBottom: '0.5rem', fontSize: '1.05rem'}}>
                    {p.title}
                  </Heading>
                  <p
                    style={{
                      margin: '0 0 0.75rem',
                      color: 'var(--ifm-color-emphasis-700)',
                      fontSize: '0.9rem',
                      lineHeight: 1.7,
                    }}>
                    {p.desc}
                  </p>
                  <span
                    style={{
                      fontSize: '0.85rem',
                      color: 'var(--ifm-color-primary)',
                      fontWeight: 500,
                    }}>
                    {p.cta} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}