import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(rootDir, 'dist');

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

for (const entry of ['index.html', 'css', 'js', 'videos', 'images', 'portrait.jpg']) {
  const sourcePath = join(rootDir, entry);
  if (!existsSync(sourcePath)) continue;
  cpSync(sourcePath, join(distDir, entry), { recursive: true });
}
