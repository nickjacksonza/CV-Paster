/* Builds dist/cv-paster.html: the whole tool in one file.

   The split source files need a web server, because browsers refuse to load
   modules from file://. The single file can be opened by double-clicking it. */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Dependency order, so the concatenated file still runs top to bottom. */
const MODULES = [
  'src/normalize.js',
  'src/dates.js',
  'src/parser.js',
  'src/blocks.js',
  'src/extract.js',
  'src/sample.js',
  'src/app.js',
];

function stripModuleSyntax(source) {
  return source
    .replace(/^\s*import\s+[^;]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^\s*export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^(\s*)export\s+(const|let|function|class|async function)/gm, '$1$2');
}

const [html, css] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'assets/styles.css'), 'utf8'),
]);

const scripts = [];
for (const path of MODULES) {
  scripts.push(`/* ---- ${path} ---- */\n${stripModuleSyntax(await readFile(join(root, path), 'utf8'))}`);
}

/* The replacements go through functions, so a $ in the source is not read as a
   replacement pattern. */
const bundle = html
  .replace('<link rel="stylesheet" href="assets/styles.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="src/app.js"></script>', () => `<script type="module">\n${scripts.join('\n')}\n</script>`);

await mkdir(join(root, 'dist'), { recursive: true });
await writeFile(join(root, 'dist/cv-paster.html'), bundle, 'utf8');

console.log(`dist/cv-paster.html written (${Math.round(bundle.length / 1024)} KB)`);
