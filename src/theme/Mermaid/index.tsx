import React, {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import OriginalMermaid from '@theme-original/Mermaid';
import styles from './styles.module.css';
import {useMermaidThemeOverride} from '@site/src/context/MermaidThemeContext';
function useIsClient() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => setIsClient(true), []);
  return isClient;
}
function downloadJpg(svgEl: SVGElement) {
  const clone = svgEl.cloneNode(true) as SVGElement;
  const bbox = (svgEl as SVGSVGElement).getBBox?.() ?? {width: 800, height: 600};
  clone.setAttribute('viewBox', `0 0 ${bbox.width} ${bbox.height}`);
  clone.setAttribute('width', String(bbox.width));
  clone.setAttribute('height', String(bbox.height));
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const blob = new Blob([svgStr], {type: 'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(bbox.width * dpr);
    canvas.height = Math.round(bbox.height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, bbox.width, bbox.height);
    ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
    canvas.toBlob((jpgBlob) => {
      if (!jpgBlob) return;
      const jpgUrl = URL.createObjectURL(jpgBlob);
      const a = document.createElement('a');
      a.href = jpgUrl;
      a.download = 'diagram.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(jpgUrl);
    }, 'image/jpeg', 0.95);
    URL.revokeObjectURL(url);
  };
  img.src = url;
}
function Controls({
  wrapperRef,
  onFullscreen,
}: {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  onFullscreen: () => void;
}) {
  const [scale, setScale] = useState(1);
  const applyScale = useCallback(
    (s: number) => {
      const container = wrapperRef.current;
      if (!container) return;
      const svg = container.querySelector('svg');
      if (svg) {
        svg.style.transform = `scale(${s})`;
        svg.style.transformOrigin = 'top left';
        svg.style.transition = 'transform 0.15s ease';
      }
    },
    [wrapperRef],
  );
  const zoomIn = useCallback(() => {
    setScale((s) => {
      const next = Math.min(Math.round(s * 1.3 * 100) / 100, 5);
      applyScale(next);
      return next;
    });
  }, [applyScale]);
  const zoomOut = useCallback(() => {
    setScale((s) => {
      const next = Math.max(Math.round((s / 1.3) * 100) / 100, 0.2);
      applyScale(next);
      return next;
    });
  }, [applyScale]);
  const reset = useCallback(() => {
    setScale(1);
    applyScale(1);
  }, [applyScale]);
  useEffect(() => {
    applyScale(scale);
  }, [applyScale, scale]);
  const handleDownload = useCallback(() => {
    const svg = wrapperRef.current?.querySelector('svg');
    if (svg) downloadJpg(svg);
  }, [wrapperRef]);
  return (
    <div className={styles.toolbar}>
      <button className={styles.btn} onClick={zoomIn} title="Zoom in">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      <button className={styles.btn} onClick={zoomOut} title="Zoom out">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 8h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      <span className={styles.pct}>{Math.round(scale * 100)}%</span>
      <button className={styles.btn} onClick={reset} title="Reset zoom">
        1:1
      </button>
      <button className={styles.btn} onClick={handleDownload} title="Download JPG">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1v10M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
      <button className={styles.btn} onClick={onFullscreen} title="Fullscreen">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}
function FullscreenOverlay({
  value,
  onClose,
}: {
  value: string;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const handleDownload = useCallback(() => {
    const svg = containerRef.current?.querySelector('svg');
    if (svg) downloadJpg(svg);
  }, []);
  return (
    <div className={styles.fullscreenOverlay} onClick={onClose}>
      <div className={styles.fullscreenToolbar}>
        <button className={styles.btn} onClick={handleDownload} title="Download JPG">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1v10M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
            <path d="M2 13h12" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
        <button className={styles.btn} onClick={onClose} title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        </button>
      </div>
      <div
        ref={containerRef}
        className={styles.fullscreenContent}
        onClick={(e) => e.stopPropagation()}
      >
        <OriginalMermaid value={value} />
      </div>
    </div>
  );
}
export default function MermaidWrapper(props: {value: string}): ReactNode {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const frontmatterTheme = useMermaidThemeOverride();
  const [fullscreen, setFullscreen] = useState(false);
  const resolvedValue = useMemo(() => {
    const v = props.value;
    if (/%%\{init/.test(v)) {
      return v;
    }
    if (frontmatterTheme) {
      return `%%{init: {'theme':'${frontmatterTheme}'}}%%\n${v}`;
    }
    return v;
  }, [props.value, frontmatterTheme]);
  return (
    <>
      <div className={styles.wrapper}>
        <div ref={wrapperRef} className={styles.stage}>
          <OriginalMermaid value={resolvedValue} />
        </div>
        {isClient && (
          <Controls wrapperRef={wrapperRef} onFullscreen={() => setFullscreen(true)} />
        )}
      </div>
      {isClient && fullscreen && (
        <FullscreenOverlay value={resolvedValue} onClose={() => setFullscreen(false)} />
      )}
    </>
  );
}