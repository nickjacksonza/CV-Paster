/* Packs the files that need to go on the web server into one zip, for uploading
   through a hosting file manager. */

import { mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'dist/cv-paster-site.zip');

await mkdir(join(root, 'dist'), { recursive: true });
await rm(target, { force: true });

try {
  await run('zip', ['-r', '-q', target, 'index.html', 'assets', 'src', 'vendor'], { cwd: root });
} catch (error) {
  console.error('This needs the "zip" command. Install it, or copy the folders across by hand.');
  process.exit(1);
}

console.log('dist/cv-paster-site.zip written');
