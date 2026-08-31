// Assembles the GitHub Pages release site: the built zip, a catalog.json
// pointing at it, the app icon, and a tiny index page. Runs in the release
// workflow after `npm run build`; needs GITHUB_REPOSITORY (owner/repo),
// which GitHub Actions sets automatically.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const buildDir = path.join(root, 'build');
const siteDir = path.join(root, 'site');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));

const zipName = `${manifest.id}-${manifest.version}.zip`;
const zipPath = path.join(buildDir, zipName);
if (!existsSync(zipPath)) {
  console.error(`${zipName} not found in build/ — run \`npm run build\` first.`);
  process.exit(1);
}

const repo = process.env.GITHUB_REPOSITORY; // "owner/name"
if (!repo) {
  console.error('GITHUB_REPOSITORY is not set — this script expects to run inside a GitHub Actions workflow.');
  process.exit(1);
}
const [owner, repoName] = repo.split('/');
const baseUrl = `https://${owner}.github.io/${repoName}`;

const zipBytes = await readFile(zipPath);
const sha256 = createHash('sha256').update(zipBytes).digest('hex');

mkdirSync(siteDir, { recursive: true });
await copyFile(zipPath, path.join(siteDir, zipName));
if (manifest.icon && existsSync(path.join(root, manifest.icon))) {
  await copyFile(path.join(root, manifest.icon), path.join(siteDir, manifest.icon));
}

const catalog = {
  schema: 'catalog.v1',
  updated_at: new Date().toISOString(),
  repo: {
    name: `${manifest.name} (self-hosted)`,
    description: manifest.description,
    homepage: `https://github.com/${repo}`,
    icon: manifest.icon ? `${baseUrl}/${manifest.icon}` : undefined,
  },
  apps: [
    {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      download: {
        url: `${baseUrl}/${zipName}`,
        sha256,
      },
      permissions: manifest.permissions,
      role: manifest.role,
    },
  ],
};

await writeFile(path.join(siteDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');

await writeFile(
  path.join(siteDir, 'index.html'),
  `<!doctype html>
<title>${manifest.name} catalog</title>
<body style="font: 15px/1.5 system-ui; max-width: 34rem; margin: 3rem auto; padding: 0 1rem;">
<h1>${manifest.name}</h1>
<p>Currently published: v${manifest.version}</p>
<p>Add this catalog's URL as a source in the bridgething companion app:</p>
<pre style="padding: 0.75rem 1rem; background: #f3f3f3; overflow-x: auto;">${baseUrl}/catalog.json</pre>
<p>Built from <a href="https://github.com/${repo}">${repo}</a>.</p>
</body>
`,
);

console.log(`Release site ready in site/ — catalog.json points at ${baseUrl}/${zipName}`);
