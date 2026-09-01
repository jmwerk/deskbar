// Builds the release site: re-copies prior zips, validates catalog.json vs bridgething's schema.
//
// Runs after `npm run build`; needs GITHUB_REPOSITORY, set automatically by GitHub Actions.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { copyFile, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = path.resolve(import.meta.dirname, '..');
const buildDir = path.join(root, 'build');
const siteDir = path.join(root, 'site');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

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

mkdirSync(siteDir, { recursive: true });

// --- This version's entry -------------------------------------------

const zipBytes = await readFile(zipPath);
const sha256 = createHash('sha256').update(zipBytes).digest('hex');
const { size } = await stat(zipPath);
await copyFile(zipPath, path.join(siteDir, zipName));

function changelogSinceLastTag() {
  try {
    const tags = execFileSync('git', ['tag', '--sort=-creatordate', '--merged', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
    const currentTag = `v${manifest.version}`;
    const previousTag = tags.find(t => t !== currentTag);
    if (!previousTag) return 'Initial release.';
    const log = execFileSync('git', ['log', '--format=- %s', `${previousTag}..HEAD`], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    return log || null;
  } catch {
    return null;
  }
}

const newVersion = {
  version: manifest.version,
  released_at: new Date().toISOString(),
  download: { url: `${baseUrl}/${zipName}`, size, sha256 },
  permissions: manifest.permissions,
  ...(manifest.role === 'launcher' ? { role: manifest.role } : {}),
  min_libbridgething_version: pkg.dependencies['@bridgething/client'].replace(/^[\^~]/, ''),
  changelog: changelogSinceLastTag(),
};

// Full-replace deploy: carry prior catalog versions/zips forward unless none exist yet.

let priorVersions = [];
try {
  const res = await fetch(`${baseUrl}/catalog.json`);
  if (res.ok) {
    const prior = await res.json();
    const priorApp = prior.apps?.find(a => a.id === manifest.id);
    if (Array.isArray(priorApp?.versions)) priorVersions = priorApp.versions;
  }
} catch {
  // No live catalog yet, or it's unreachable — start fresh.
}

const versions = [newVersion, ...priorVersions.filter(v => v.version !== newVersion.version)];

for (const v of priorVersions) {
  if (v.version === newVersion.version) continue; // this release's zip is already copied above
  const name = `${manifest.id}-${v.version}.zip`;
  const dest = path.join(siteDir, name);
  if (existsSync(dest)) continue;
  try {
    const res = await fetch(v.download.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  } catch (err) {
    console.error(
      `Could not carry forward ${name} (${v.download.url}): ${err.message}. It will 404 once this deploy goes live.`,
    );
  }
}

if (manifest.icon && existsSync(path.join(root, manifest.icon))) {
  await copyFile(path.join(root, manifest.icon), path.join(siteDir, manifest.icon));
}

// Optional screenshots: omit key if none; images sorted by filename set the app card's order.

const screenshotsDir = path.join(root, 'screenshots');
const screenshotUrls = [];
if (existsSync(screenshotsDir)) {
  const files = (await readdir(screenshotsDir)).filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  if (files.length > 0) mkdirSync(path.join(siteDir, 'screenshots'), { recursive: true });
  for (const file of files) {
    await copyFile(path.join(screenshotsDir, file), path.join(siteDir, 'screenshots', file));
    screenshotUrls.push(`${baseUrl}/screenshots/${file}`);
  }
}

const catalog = {
  $schema: 'https://apps.bridgething.com/schemas/catalog/v1.json',
  schema: 'catalog.v1',
  updated_at: new Date().toISOString(),
  repo: {
    name: `${manifest.name} (self-hosted)`,
    description: manifest.description,
    homepage: `https://github.com/${repo}`,
    icon: manifest.icon ? `${baseUrl}/${manifest.icon}` : null,
  },
  apps: [
    {
      id: manifest.id,
      name: manifest.name,
      description: manifest.description,
      author: owner,
      icon: manifest.icon ? `${baseUrl}/${manifest.icon}` : null,
      ...(screenshotUrls.length > 0 ? { screenshots: screenshotUrls } : {}),
      homepage: `https://github.com/${repo}`,
      source: `https://github.com/${repo}`,
      versions,
    },
  ],
  recommended_sources: [],
};

// Validate before publishing to catch schema mismatches early; vendored schema, not a live fetch.

const schema = JSON.parse(await readFile(path.join(import.meta.dirname, 'catalog.schema.v1.json'), 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(catalog)) {
  console.error('Generated catalog.json failed schema validation:');
  for (const e of validate.errors) console.error(`  ${e.instancePath || '<root>'}: ${e.message}`);
  process.exit(1);
}

await writeFile(path.join(siteDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');

await writeFile(
  path.join(siteDir, 'index.html'),
  `<!doctype html>
<title>${manifest.name} catalog</title>
<body style="font: 15px/1.5 system-ui; max-width: 34rem; margin: 3rem auto; padding: 0 1rem;">
<h1>${manifest.name}</h1>
<p>Currently published: v${manifest.version} (${versions.length} version${versions.length === 1 ? '' : 's'} available)</p>
<p>Add this catalog's URL as a source in the bridgething companion app:</p>
<pre style="padding: 0.75rem 1rem; background: #f3f3f3; overflow-x: auto;">${baseUrl}/catalog.json</pre>
<p>Built from <a href="https://github.com/${repo}">${repo}</a>.</p>
</body>
`,
);

console.log(
  `Release site ready in site/ — catalog.json valid, ${versions.length} version(s), points at ${baseUrl}/${zipName}`,
);
