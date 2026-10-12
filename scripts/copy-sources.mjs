import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, '../docs');
const sourceDir = path.resolve(__dirname, '../static/_source');
if (fs.existsSync(sourceDir)) {
  fs.rmSync(sourceDir, { recursive: true });
}
function copyFiles(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyFiles(srcPath, destPath);
    } else if (entry.isFile() && /\.mdx?$/.test(entry.name)) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
copyFiles(docsDir, sourceDir);
console.log('Markdown sources copied to static/_source/');