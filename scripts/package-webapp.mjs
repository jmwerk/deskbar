// Zips the built webapp into a bridgething-installable bundle:
// index.html + assets at the zip root, plus manifest.json and the icon.
// Run automatically as the last step of `npm run build`.
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const buildDir = path.join(root, 'build');
const manifest = JSON.parse(
  await (await import('node:fs/promises')).readFile(path.join(root, 'manifest.json'), 'utf8'),
);

if (!existsSync(distDir)) {
  console.error('dist/ not found — run `vite build` first (this script is meant to run after it).');
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });

// The manifest and icon must sit next to index.html at the bundle root.
await copyFile(path.join(root, 'manifest.json'), path.join(distDir, 'manifest.json'));
if (manifest.icon && existsSync(path.join(root, manifest.icon))) {
  await copyFile(path.join(root, manifest.icon), path.join(distDir, manifest.icon));
}

const outPath = path.join(buildDir, `${manifest.id}-${manifest.version}.zip`);
const output = createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`\nPackaged ${archive.pointer()} bytes -> ${path.relative(root, outPath)}`);
});

archive.on('warning', err => {
  throw err;
});
archive.on('error', err => {
  throw err;
});

archive.pipe(output);
archive.directory(distDir, false);
await archive.finalize();
