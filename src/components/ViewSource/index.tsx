import {useState, useEffect, useCallback, type ReactNode} from 'react';
import {useDoc} from '@docusaurus/plugin-content-docs/client';
import styles from './styles.module.css';
export default function ViewSource({children}: {children: ReactNode}): ReactNode {
  const {metadata} = useDoc();
  const [showSource, setShowSource] = useState(false);
  const [source, setSource] = useState('');
  const [loading, setLoading] = useState(false);
  // metadata.source 形如 @site/docs/xxx.md；静态源码由 copy-sources.mjs 拷贝到
  // static/_source/（不含 docs 段），因此这里去掉 @site/docs/ 前缀做映射。
  const displayPath = metadata.source?.replace('@site/docs/', '') ?? '';
  const sourceUrl = displayPath ? `/_source/${displayPath}` : '';
  useEffect(() => {
    if (showSource && !source && !loading) {
      setLoading(true);
      fetch(sourceUrl)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load');
          return res.text();
        })
        .then(text => {
          setSource(text);
          setLoading(false);
        })
        .catch(() => {
          setSource('// Error: could not load source file');
          setLoading(false);
        });
    }
  }, [showSource, source, loading, sourceUrl]);
  const toggle = useCallback(() => {
    setShowSource(v => !v);
  }, []);
  return (
    <>
      <div className={styles.bar}>
        <span className={styles.sourceFilename}>
          {showSource ? displayPath : ''}
        </span>
        <button
          className={showSource ? styles.toggleActive : styles.toggle}
          onClick={toggle}
          title="Toggle Markdown source view">
          {'</>'} {showSource ? 'Rendered' : 'Source'}
        </button>
      </div>
      {showSource ? (
        <pre className={styles.sourceBlock}>
          <code>{loading ? 'Loading...' : source}</code>
        </pre>
      ) : children}
    </>
  );
}