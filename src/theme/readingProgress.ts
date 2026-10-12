// 电子书阅读增强：页面顶部阅读进度条
if (typeof window !== 'undefined') {
  const BAR_ID = 'ebook-reading-progress';

  const update = () => {
    const bar = document.getElementById(BAR_ID);
    if (!bar) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
    bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  };

  const ensureBar = () => {
    if (!document.getElementById(BAR_ID)) {
      const bar = document.createElement('div');
      bar.id = BAR_ID;
      document.body.appendChild(bar);
    }
    update();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureBar);
  } else {
    ensureBar();
  }
  window.addEventListener('scroll', update, {passive: true});
  window.addEventListener('resize', update);
}