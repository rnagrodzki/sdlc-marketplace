import { cp, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteRoot = join(__dirname, '..');
const repoRoot = join(siteRoot, '..');
const srcDocs = join(repoRoot, 'docs');
const destDocs = join(siteRoot, 'src', 'content-source');

await mkdir(destDocs, { recursive: true });
await cp(srcDocs, destDocs, { recursive: true });
console.log('Docs copied to src/content-source/');
