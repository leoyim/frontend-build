// 构建期预生成整本电子书 PDF。
// 思路：先把已构建好的静态站点用本地 HTTP 服务挂到 baseUrl 前缀下，
// 再用无头 Chromium 逐个打开文档页（让 mermaid 在真实浏览器里渲染成 SVG），
// 抽取每页 article 内容，拼成「目录 + 14 篇正文」导出带页码与书签的正文 PDF；
// 封面是全幅设计页（含构建主题插图），单独无页脚渲染；最后合并两者并迁移书签树，
// 产物落到 build/pdf/。
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { PDFDocument, PDFName, PDFHexString, PDFNumber, PDFNull, PDFRef } from 'pdf-lib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BUILD_DIR = path.join(ROOT, 'build');
const OUT_DIR = path.join(BUILD_DIR, 'pdf');
const OUT_FILE = path.join(OUT_DIR, 'frontend-build-ebook.pdf');
// 封面 / 正文先分别渲染为临时 PDF，再合并（封面不带页眉页脚，正文带页码）
const COVER_TMP = path.join(OUT_DIR, '.cover.tmp.pdf');
const BODY_TMP = path.join(OUT_DIR, '.body.tmp.pdf');
// 封面独立 HTML 与插图临时挂到 build/ 下，由本地静态服务提供，渲染完即删
const COVER_WEB_DIR = path.join(BUILD_DIR, '__cover');
const COVER_ART_SRC = path.join(ROOT, 'scripts/cover/cover-art.jpg');

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

// 正文打印样式：分页、隐藏交互元素、避免代码/表格溢出，保证配色正确输出。
// 封面是独立全幅文档（见 buildCoverHtml），不放这里。
const PRINT_CSS = `
  @page { size: A4; }
  html, body { background: #fff !important; color: #1f2328 !important; margin: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

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

// 专业技术书封面：全幅深色设计 + 构建流水线插图，独立渲染为无页眉页脚的单页 PDF。
function buildCoverHtml() {
  const date = new Date().toISOString().slice(0, 10);
  const chips = ['正文 7 章', '架构图 26 幅', '全文 14 篇', '附录 · 术语 / 配置 / 参考'];
  return `<!doctype html>
<html lang="zh-Hans">
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { width: 210mm; height: 297mm; }
  body { font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans CJK SC', sans-serif; }
  .cover {
    position: relative; width: 210mm; height: 297mm; overflow: hidden;
    color: #e8f0ff;
    background:
      radial-gradient(120% 70% at 50% -8%, rgba(56,119,238,.30), transparent 60%),
      radial-gradient(90% 55% at 88% 112%, rgba(10,197,255,.16), transparent 60%),
      linear-gradient(158deg, #0a1128 0%, #0f1f42 50%, #080f24 100%);
    display: flex; flex-direction: column;
    padding: 19mm 19mm 13mm 22mm;
  }
  /* 顶部/底部渐隐的点阵纹理，暗示依赖网络 */
  .cover::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background-image: radial-gradient(rgba(140,180,255,.13) 0.8px, transparent 0.8px);
    background-size: 5mm 5mm;
    -webkit-mask-image: linear-gradient(180deg, transparent, #000 16%, #000 84%, transparent);
            mask-image: linear-gradient(180deg, transparent, #000 16%, #000 84%, transparent);
  }
  /* 左侧品牌色竖条 */
  .side-bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 3mm;
    background: linear-gradient(180deg, #2f81f7, #0ac5ff 55%, #2f81f7);
  }
  .top-row { position: relative; display: flex; justify-content: space-between; align-items: center; }
  .kicker {
    font-size: 8.5pt; letter-spacing: 3.5px; font-weight: 600; color: #7cc4ff;
  }
  .version { font-size: 8.5pt; letter-spacing: 2px; color: #7086ad; }

  .hero {
    position: relative; margin-top: 7mm; height: 76mm; border-radius: 3mm; overflow: hidden;
    border: 1px solid rgba(120,175,255,.35);
    background: #0a1734;
    box-shadow: 0 0 26mm rgba(30,110,255,.20), inset 0 0 12mm rgba(18,55,130,.35);
  }
  .hero img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center 44%; }
  .hero::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(180deg, rgba(10,17,40,.42) 0%, transparent 18%, transparent 78%, rgba(10,17,40,.5) 100%);
  }
  .hero .hero-tag {
    position: absolute; left: 5mm; bottom: 4mm; z-index: 2;
    font-size: 8.5pt; letter-spacing: 3px; color: #a9d4ff;
    background: rgba(10,23,52,.62); border: 1px solid rgba(124,196,255,.35);
    padding: 1.6mm 4mm; border-radius: 100px;
  }

  .title-block { position: relative; margin-top: 12mm; }
  .title {
    font-size: 38pt; font-weight: 800; line-height: 1.18; letter-spacing: 3px;
    text-shadow: 0 2px 18mm rgba(40,120,255,.5);
  }
  .subtitle {
    margin-top: 5mm; display: flex; align-items: center; gap: 4mm;
    font-size: 16.5pt; font-weight: 500; color: #7cc4ff; letter-spacing: 1.5px;
  }
  .subtitle .rule { display: inline-block; width: 14mm; height: 2px; background: linear-gradient(90deg, #0ac5ff, transparent); }
  .tagline { margin-top: 7mm; font-size: 11pt; color: #9fb4d8; line-height: 1.85; letter-spacing: .5px; }

  .chips { position: relative; margin-top: 9mm; display: flex; flex-wrap: wrap; gap: 3mm; }
  .chip {
    font-size: 9pt; letter-spacing: 1px; color: #c2dcff;
    border: 1px solid rgba(124,196,255,.38); border-radius: 100px;
    padding: 2mm 5mm; background: rgba(20,60,130,.28);
  }

  .spacer { flex: 1; }

  .footer-meta {
    position: relative; border-top: 1px solid rgba(140,180,255,.22);
    padding-top: 5mm; display: flex; justify-content: space-between; align-items: baseline;
    font-size: 9.5pt; color: #8fa6cf; letter-spacing: .5px;
  }
  .footer-meta .url { color: #cfe1ff; font-weight: 600; letter-spacing: 1px; }
</style>
</head>
<body>
  <div class="cover">
    <div class="side-bar"></div>
    <div class="top-row">
      <div class="kicker">FRONTEND BUILD ENGINEERING · 技术电子书</div>
      <div class="version">VERSION ${escapeHtml(BOOK.version)}</div>
    </div>

    <div class="hero">
      <img id="art" src="cover-art.jpg" alt="前端构建流水线插图：模块经编译核心打包为产物">
      <div class="hero-tag">MODULE GRAPH · BUNDLER · NATIVE TOOLING</div>
    </div>

    <div class="title-block">
      <div class="title">${escapeHtml(BOOK.title)}</div>
      <div class="subtitle"><span class="rule"></span>${escapeHtml(BOOK.subtitle)}</div>
      <div class="tagline">${escapeHtml(BOOK.tagline)}</div>
    </div>

    <div class="chips">
      ${chips.map((c) => `<span class="chip">${escapeHtml(c)}</span>`).join('')}
    </div>

    <div class="spacer"></div>

    <div class="footer-meta">
      <span class="url">${escapeHtml(BOOK.url)}</span>
      <span>导出于 ${date}</span>
    </div>
  </div>
  <script>
    // 原图右下角带生成水印，这里在浏览器内裁掉底部 8% 后再使用
    (async () => {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'cover-art.jpg'; });
      const w = img.naturalWidth;
      const h = Math.floor(img.naturalHeight * 0.92);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h, 0, 0, w, h);
      document.getElementById('art').src = canvas.toDataURL('image/jpeg', 0.92);
      document.documentElement.dataset.coverReady = '1';
    })();
  </script>
</body>
</html>`;
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

// 合并「封面 + 正文」。pdf-lib 合并不保留源大纲，因此遍历正文 PDF 的 /Outlines
// 树，在新文档里重建一棵等价书签树（标题/层级/跳转目标全部保留，页码随合并自动平移）。
async function mergePdfWithOutline(coverPath, bodyPath, outPath) {
  const coverSrc = await PDFDocument.load(fs.readFileSync(coverPath));
  const bodySrc = await PDFDocument.load(fs.readFileSync(bodyPath));
  const doc = await PDFDocument.create();
  await doc.copyPages(coverSrc, coverSrc.getPageIndices());
  const bodyPages = await doc.copyPages(bodySrc, bodySrc.getPageIndices());

  // 源正文页对象引用 -> 新文档页引用。
  // 直接遍历源页树取间接引用（PDFPage.node.ref 在懒加载场景下可能为空）。
  const bodyCtx = bodySrc.context;
  const rootCatalog = bodyCtx.lookup(bodyCtx.trailerInfo.Root);
  const pageMap = new Map();
  const pageRefs = [];
  const walkPageTree = (kidRef) => {
    const kid = bodyCtx.lookup(kidRef);
    const kids = kid.get(PDFName.of('Kids'));
    if (kids && typeof kids.asArray === 'function') {
      kids.asArray().forEach(walkPageTree);
    } else {
      pageRefs.push(kidRef);
    }
  };
  walkPageTree(rootCatalog.get(PDFName.of('Pages')));
  pageRefs.forEach((ref, i) => pageMap.set(ref.toString(), bodyPages[i].ref));

  const outlinesRef = rootCatalog.get(PDFName.of('Outlines'));

  if (outlinesRef && outlinesRef !== PDFNull) {
    const srcRoot = bodyCtx.lookup(outlinesRef);
    const numOrNull = (v) => (v && typeof v.asNumber === 'function' ? PDFNumber.of(v.asNumber()) : PDFNull);

    const buildItem = (srcRef) => {
      const src = bodyCtx.lookup(srcRef);
      const dict = doc.context.obj({});
      const ref = doc.context.register(dict);

      const title = src.get(PDFName.of('Title'));
      if (title && typeof title.decodeText === 'function') {
        dict.set(PDFName.of('Title'), PDFHexString.fromText(title.decodeText()));
      }

      const dest = src.get(PDFName.of('Dest'));
      if (dest && typeof dest.get === 'function') {
        const first = dest.get(0);
        const targetRef = first instanceof PDFRef ? pageMap.get(first.toString()) : undefined;
        if (targetRef) {
          dict.set(
            PDFName.of('Dest'),
            doc.context.obj([
              targetRef,
              PDFName.of('XYZ'),
              numOrNull(dest.get(2)),
              numOrNull(dest.get(3)),
              numOrNull(dest.get(4)),
            ]),
          );
        }
      }

      const firstChild = src.get(PDFName.of('First'));
      const kids = firstChild && firstChild !== PDFNull ? buildSiblings(firstChild) : [];
      return { ref, dict, src, kids };
    };

    const buildSiblings = (firstRef) => {
      const items = [];
      let cur = firstRef;
      while (cur && cur !== PDFNull) {
        items.push(buildItem(cur));
        const next = items[items.length - 1].src.get(PDFName.of('Next'));
        cur = next && next !== PDFNull ? next : null;
      }
      items.forEach((item, i) => {
        if (i > 0) item.dict.set(PDFName.of('Prev'), items[i - 1].ref);
        if (i < items.length - 1) item.dict.set(PDFName.of('Next'), items[i + 1].ref);
        if (item.kids.length) {
          item.dict.set(PDFName.of('First'), item.kids[0].ref);
          item.dict.set(PDFName.of('Last'), item.kids[item.kids.length - 1].ref);
          const count = item.src.get(PDFName.of('Count'));
          if (count && count !== PDFNull) item.dict.set(PDFName.of('Count'), PDFNumber.of(count.asNumber()));
          item.kids.forEach((k) => k.dict.set(PDFName.of('Parent'), item.ref));
        }
      });
      return items;
    };

    const srcFirst = srcRoot.get(PDFName.of('First'));
    if (srcFirst && srcFirst !== PDFNull) {
      const top = buildSiblings(srcFirst);
      const newRoot = doc.context.obj({ Type: PDFName.of('Outlines') });
      const newRootRef = doc.context.register(newRoot);
      newRoot.set(PDFName.of('First'), top[0].ref);
      newRoot.set(PDFName.of('Last'), top[top.length - 1].ref);
      const countAll = (items) => items.reduce((n, it) => n + 1 + countAll(it.kids), 0);
      newRoot.set(PDFName.of('Count'), PDFNumber.of(countAll(top)));
      top.forEach((item, i) => {
        item.dict.set(PDFName.of('Parent'), newRootRef);
        if (i > 0) item.dict.set(PDFName.of('Prev'), top[i - 1].ref);
        if (i < top.length - 1) item.dict.set(PDFName.of('Next'), top[i + 1].ref);
      });
      doc.catalog.set(PDFName.of('Outlines'), newRootRef);
      doc.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
    }
  }

  doc.setTitle(`${BOOK.title}：${BOOK.subtitle}`);
  doc.setLanguage('zh-CN');
  fs.writeFileSync(outPath, await doc.save());
}

async function main() {
  if (!fs.existsSync(path.join(BUILD_DIR, 'index.html'))) {
    throw new Error('未找到 build/ 产物，请先执行 npm run build');
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 准备封面页的临时站点目录（HTML + 插图），渲染完删除
  fs.rmSync(COVER_WEB_DIR, { recursive: true, force: true });
  fs.mkdirSync(COVER_WEB_DIR, { recursive: true });
  fs.copyFileSync(COVER_ART_SRC, path.join(COVER_WEB_DIR, 'cover-art.jpg'));
  fs.writeFileSync(path.join(COVER_WEB_DIR, 'index.html'), buildCoverHtml());

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

    // 正文 = 目录 + 14 篇（封面独立成页，见下方 renderCover）
  const bodyHtml = [
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

  const footerTemplate = `
    <div style="width:100%; font-size:9px; color:#8b949e; padding:0 18mm; display:flex; justify-content:space-between;">
      <span>${escapeHtml(BOOK.title)}：${escapeHtml(BOOK.subtitle)}</span>
      <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
    </div>`;

  // 正文 PDF：带页码与书签（书签需同时开启 tagged）
  await page.pdf({
    path: BODY_TMP,
    format: 'A4',
    printBackground: true,
    outline: true,
    tagged: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate,
    margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' },
  });

  // 封面 PDF：全幅、无页眉页脚
  const coverPage = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  await coverPage.goto(`${origin}${BASE_URL}__cover/`, { waitUntil: 'load', timeout: 60000 });
  await coverPage.waitForFunction(
    () => document.documentElement.dataset.coverReady === '1',
    { timeout: 30000 },
  );
  await coverPage.emulateMedia({ media: 'print' });

  // 调试用：设置 PDF_DEBUG_SHOT=1 时导出封面/目录/含图章节的预览图，便于人工核对排版
  if (process.env.PDF_DEBUG_SHOT) {
    await coverPage.screenshot({ path: path.join(OUT_DIR, '_debug_cover.png') });
    await page.emulateMedia({ media: 'print' });
    for (const [sel, name] of [
      ['.pdf-toc', 'toc'],
      ['.pdf-section:nth-of-type(6)', 'chapter2-mermaid'],
    ]) {
      const el = await page.$(sel);
      if (el) await el.screenshot({ path: path.join(OUT_DIR, `_debug_${name}.png`) });
    }
    await page.emulateMedia({ media: 'screen' });
    console.log('已输出调试图截图：build/pdf/_debug_*.png');
  }

  await coverPage.pdf({
    path: COVER_TMP,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  });

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  // 合并封面与正文，并把正文的书签树迁移到合并后的 PDF
  await mergePdfWithOutline(COVER_TMP, BODY_TMP, OUT_FILE);
  fs.rmSync(COVER_TMP, { force: true });
  fs.rmSync(BODY_TMP, { force: true });
  fs.rmSync(COVER_WEB_DIR, { recursive: true, force: true });

  const size = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(2);
  console.log(`PDF 生成完成：${path.relative(ROOT, OUT_FILE)}（${size} MB，共 ${sections.length} 篇）`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});