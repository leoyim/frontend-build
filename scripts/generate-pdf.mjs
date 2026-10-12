// 构建期预生成整本电子书 PDF。
// 思路：先把已构建好的静态站点用本地 HTTP 服务挂到 baseUrl 前缀下，
// 再用无头 Chromium 逐个打开文档页（让 mermaid 在真实浏览器里渲染成 SVG），
// 抽取每页 article 内容，拼成「封面 + 目录 + 正文」的单一文档，
// 最后用 page.pdf 导出为带书签（outline）的 PDF，产物落到 build/pdf/。
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const OUT_DIR = path.join(BUILD_DIR, 'pdf');
const OUT_FILE = path.join(OUT_DIR, 'frontend-build-ebook.pdf');

// 必须与 docusaurus.config.ts 的 baseUrl 保持一致
const BASE_URL = '/frontend-build/';

// 书籍元信息（用于封面与页脚）
const BOOK = {
  title: '前端打包构建',
  subtitle: '从底层原理到工程实践',
  tagline: '一本由真实互动教学沉淀而成的技术电子书',
  url: 'ebook.leoyim.cn/frontend-build/',
  version: '1.0.0',
};

// 章节顺序严格对照 sidebars.ts，保证 PDF 与站内阅读顺序一致。
// md 指向对应源文件，用于推算本页应渲染的 mermaid 图数量（图是浏览器端 hydration 后才出现的）。
const SECTIONS = [
  { group: '前言', route: 'docs/', md: 'docs/README.md', label: '本书简介' },
  { group: '前言', route: 'docs/SUMMARY', md: 'docs/SUMMARY.md', label: '完整目录' },
  { group: '正文', route: 'docs/chapters/01-frontend-build-basics', md: 'docs/chapters/01-frontend-build-basics.md', label: '第 1 章 · 前端构建基础' },
  { group: '正文', route: 'docs/chapters/02-core-build-principles', md: 'docs/chapters/02-core-build-principles.md', label: '第 2 章 · 核心构建原理' },
  { group: '正文', route: 'docs/chapters/03-webpack-and-vite', md: 'docs/chapters/03-webpack-and-vite.md', label: '第 3 章 · Webpack 与 Vite' },
  { group: '正文', route: 'docs/chapters/04-next-generation-tools', md: 'docs/chapters/04-next-generation-tools.md', label: '第 4 章 · 新一代构建工具' },
  { group: '正文', route: 'docs/chapters/05-build-performance', md: 'docs/chapters/05-build-performance.md', label: '第 5 章 · 构建性能优化' },
  { group: '正文', route: 'docs/chapters/06-ai-assisted-build', md: 'docs/chapters/06-ai-assisted-build.md', label: '第 6 章 · AI 辅助构建工程' },
  { group: '正文', route: 'docs/chapters/07-practice-and-selection', md: 'docs/chapters/07-practice-and-selection.md', label: '第 7 章 · 工程实践与选型' },
  { group: '实践', route: 'docs/practice/examples', md: 'docs/practice/examples/README.md', label: '示例代码' },
  { group: '决策', route: 'docs/decisions/tool-selection', md: 'docs/decisions/tool-selection.md', label: '工具选型决策记录' },
  { group: '附录', route: 'docs/appendix/glossary', md: 'docs/appendix/glossary.md', label: '术语表' },
  { group: '附录', route: 'docs/appendix/configuration-reference', md: 'docs/appendix/configuration-reference.md', label: '配置参考' },
  { group: '附录', route: 'docs/appendix/references', md: 'docs/appendix/references.md', label: '参考资料' },
];

// mermaid 图在源文件里的数量 = 页面上应渲染出的图数量
function expectedMermaidCount(mdRel) {
  const file = path.join(ROOT, mdRel);
  if (!fs.existsSync(file)) return 0;
  return (fs.readFileSync(file, 'utf8').match(/^```mermaid\b/gm) || []).length;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// 把 build/ 挂载到 BASE_URL 前缀下的最小静态服务
function startServer() {
  const server = http.createServer((req, res) => {
    try {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (!urlPath.startsWith(BASE_URL)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      let rel = urlPath.slice(BASE_URL.length);
      if (rel === '' || rel.endsWith('/')) rel += 'index.html';
      const filePath = path.normalize(path.join(BUILD_DIR, rel));
      if (!filePath.startsWith(BUILD_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      let target = filePath;
      if (!fs.existsSync(target) || !fs.statSync(target).isFile()) {
        const idx = path.join(filePath, 'index.html');
        if (fs.existsSync(idx)) target = idx;
        else {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
      }
      const ext = path.extname(target).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(target).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// 等待 mermaid 图全部渲染为 SVG。
// 图由客户端 hydration 后生成，静态 HTML 里没有，因此按源码推算的期望数量来等待。
async function waitForMermaid(page, expected) {
  if (expected <= 0) return;
  await page
    .waitForFunction(
      (n) => document.querySelectorAll('.docusaurus-mermaid-container svg, svg[id^="mermaid"]').length >= n,
      expected,
      { timeout: 25000 },
    )
    .catch(() => {
      console.warn(`  ! mermaid 渲染等待超时（期望 ${expected} 张），按当前状态继续`);
    });
}

// 打印样式：分页、隐藏交互元素、避免代码/表格溢出，保证配色正确输出
const PRINT_CSS = `
  @page { size: A4; }
  html, body { background: #fff !important; color: #1f2328 !important; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

  .pdf-cover {
    break-after: page;
    min-height: 235mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: center;
  }
  .pdf-cover .cover-title { font-size: 34pt; font-weight: 800; line-height: 1.25; margin: 0 0 6mm; }
  .pdf-cover .cover-subtitle { font-size: 20pt; font-weight: 500; color: #0969da; margin: 0 0 14mm; }
  .pdf-cover .cover-tagline { font-size: 12pt; color: #57606a; margin: 0 0 4mm; }
  .pdf-cover .cover-meta { font-size: 10.5pt; color: #8b949e; margin-top: 26mm; line-height: 1.9; }

  .pdf-toc { break-after: page; }
  .pdf-toc .toc-heading { font-size: 24pt; font-weight: 700; margin: 0 0 10mm; }
  .pdf-toc .toc-group { font-size: 13pt; font-weight: 700; color: #0969da; margin: 8mm 0 3mm; }
  .pdf-toc .toc-entry { font-size: 12pt; margin: 0 0 2.6mm 4mm; line-height: 1.5; }

  .pdf-section { break-before: page; }
  .pdf-section article { font-size: 11.5pt; line-height: 1.75; }

  /* 隐藏只对交互有意义的元素 */
  .hash-link, .theme-doc-breadcrumbs, .theme-doc-toc-desktop,
  .theme-doc-footer, .pagination-nav, .theme-doc-tags,
  .navbar, .footer, .theme-doc-sidebar-container, .tocCollapsible_ { display: none !important; }

  /* 代码块与表格在打印时不能靠滚动条，需完整展开 */
  .markdown pre, .markdown table, .markdown .tableWrapper,
  .markdown [class*="codeBlock"], .markdown [class*="tableWrapper"] {
    overflow: visible !important;
  }
  .markdown pre { white-space: pre-wrap !important; word-break: break-word; }
  .markdown code { word-break: break-word; }
  .markdown table { width: 100%; table-layout: fixed; font-size: 10pt; }
  .markdown table td, .markdown table th { word-break: break-word; }

  /* 避免关键块被跨页截断 */
  pre, blockquote, table, figure, .docusaurus-mermaid-container {
    break-inside: avoid; page-break-inside: avoid;
  }
  h1, h2, h3 { break-after: avoid; }

  /* mermaid 图自适应页面宽度 */
  .docusaurus-mermaid-container, [class*="mermaid"] { text-align: center; }
  .docusaurus-mermaid-container svg, [class*="mermaid"] svg { max-width: 100% !important; height: auto !important; }
`;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildCover() {
  const date = new Date().toISOString().slice(0, 10);
  return `
    <div class="cover-title">${escapeHtml(BOOK.title)}</div>
    <div class="cover-subtitle">${escapeHtml(BOOK.subtitle)}</div>
    <div class="cover-tagline">${escapeHtml(BOOK.tagline)}</div>
    <div class="cover-meta">
      <div>${escapeHtml(BOOK.url)}</div>
      <div>版本 ${escapeHtml(BOOK.version)} · 导出于 ${date}</div>
    </div>`;
}

function buildToc(sections) {
  let html = '<div class="toc-heading">目录</div>';
  let currentGroup = null;
  for (const s of sections) {
    if (s.group !== currentGroup) {
      currentGroup = s.group;
      html += `<div class="toc-group">${escapeHtml(currentGroup)}</div>`;
    }
    html += `<div class="toc-entry">${escapeHtml(s.label)}</div>`;
  }
  return html;
}

async function main() {
  if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    throw new Error('未找到 build/ 产物，请先执行 npm run build');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const server = await startServer();
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;
  console.log(`本地预览服务：${origin}${BASE_URL}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ colorScheme: 'light' });

  const sections = [];
  let mermaidExpected = 0;
  let mermaidRendered = 0;
  for (const def of SECTIONS) {
    const url = `${origin}${BASE_URL}${def.route}`;
    const expected = expectedMermaidCount(def.md);
    console.log(`抓取：${def.label}${expected ? `（mermaid ${expected}）` : ''}`);
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    // mermaid 由 hydration 渲染，且可能被 React 重渲染短暂清空，
    // 因此"等到期望数量"后再复检，未达标就重试，避免偶发丢图。
    let rendered = 0;
    let html = '';
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await waitForMermaid(page, expected);
      await page.waitForTimeout(300);
      const data = await page.evaluate(() => {
        const article = document.querySelector('article');
        if (!article) return { html: '', rendered: 0 };
        const svgs = article.querySelectorAll('.docusaurus-mermaid-container svg, svg[id^="mermaid"]');
        return { html: article.innerHTML, rendered: svgs.length };
      });
      rendered = data.rendered;
      html = data.html;
      if (rendered >= expected) break;
    }
    if (rendered < expected) {
      console.warn(`  ! ${def.label} 的 mermaid 图未渲染齐：${rendered}/${expected}`);
    }
    mermaidExpected += expected;
    mermaidRendered += rendered;
    sections.push({ ...def, html });
  }
  console.log(`mermaid 图：${mermaidRendered}/${mermaidExpected} 已渲染为 SVG`);

  const bodyHtml = [
    `<section class="pdf-cover">${buildCover()}</section>`,
    `<section class="pdf-toc">${buildToc(sections)}</section>`,
    ...sections.map(
      (s) => `<section class="pdf-section"><article class="theme-doc-markdown markdown">${s.html}</article></section>`,
    ),
  ].join('\n');

  // 停留在真实站点页面上替换 body：保留已加载的全局样式，并把绝对资源路径解析到本地服务
  await page.goto(`${origin}${BASE_URL}docs/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-theme-choice', 'light');
  });
  await page.addStyleTag({ content: PRINT_CSS });
  await page.evaluate((html) => {
    document.body.innerHTML = html;
  }, bodyHtml);

  const headerTemplate = '<div></div>';
  const footerTemplate = `
    <div style="width:100%; font-size:9px; color:#8b949e; padding:0 18mm; display:flex; justify-content:space-between;">
      <span>${escapeHtml(BOOK.title)}：${escapeHtml(BOOK.subtitle)}</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`;

  // 调试用：设置 PDF_DEBUG_SHOT=1 时导出封面/目录/含图章节的预览图，便于人工核对排版
  if (process.env.PDF_DEBUG_SHOT) {
    await page.emulateMedia({ media: 'print' });
    const shots = [
      ['.pdf-cover', 'cover'],
      ['.pdf-toc', 'toc'],
      ['.pdf-section:nth-of-type(6)', 'chapter2-mermaid'],
    ];
    for (const [sel, name] of shots) {
      const el = await page.$(sel);
      if (el) await el.screenshot({ path: path.join(OUT_DIR, `_debug_${name}.png`) });
    }
    await page.emulateMedia({ media: 'screen' });
    console.log('已输出调试图截图：build/pdf/_debug_*.png');
  }

  await page.pdf({
    path: OUT_FILE,
    format: 'A4',
    printBackground: true,
    // 生成书签（PDF outline）需同时开启 tagged，否则 Chromium 不会写入大纲
    outline: true,
    tagged: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
  });

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  const size = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`PDF 生成完成：${path.relative(ROOT, OUT_FILE)}（${size} MB，共 ${sections.length} 篇）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});