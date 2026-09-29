import { $ } from 'bun';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dir, '..');
const out = join(root, 'build', 'demo');
const branch = process.env.SITE_BRANCH ?? 'gh-pages';

async function build() {
  await rm(out, { recursive: true, force: true });
  // mock mode stands in for the daemon, jira and spotify, so the page runs with no device behind it
  await $`bunx vite build --outDir ${join(out, 'app')} --emptyOutDir --sourcemap false`
    .cwd(join(root, 'apps', 'deskbar'))
    .env({ ...process.env, VITE_MOCK: '1' });
  await cp(join(root, 'demo'), out, { recursive: true });
  console.log(`demo built into ${out}`);
}

async function publish() {
  await $`git fetch --depth 1 origin ${branch}`.cwd(root);
  const tree = await mkdtemp(join(tmpdir(), 'deskbar-demo-'));
  try {
    await $`git worktree add --detach ${tree} FETCH_HEAD`.cwd(root).quiet();
    await rm(join(tree, 'demo'), { recursive: true, force: true });
    await cp(out, join(tree, 'demo'), { recursive: true });
    await $`git add --all demo`.cwd(tree);
    if ((await $`git diff --cached --quiet`.cwd(tree).nothrow()).exitCode === 0) {
      console.log('the demo on the site branch is already up to date');
      return;
    }
    await $`git commit --quiet -m ${'demo: refresh the browser demo'}`.cwd(tree);
    await $`git push origin HEAD:refs/heads/${branch}`.cwd(tree);
  } finally {
    await $`git worktree remove --force ${tree}`.cwd(root).nothrow().quiet();
  }
}

await build();
if (process.argv.includes('--publish')) await publish();
