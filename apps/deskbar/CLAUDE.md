# Deskbar-specific notes

Parts specific to this app, on top of the repo-root `CLAUDE.md`.

## Hardware findings

`HARDWARE.md` in this directory is the canonical confirmed-vs-guessed reference for this
device — safe zones (the physical dial's top-right occlusion vs. bridgething's own toast
overlay), the preset button layout, and the dial push-button's keycode. Read it before
touching `src/physicalControls.ts` or any screen's key bindings.

Two facts worth repeating here since getting them wrong breaks the app on real hardware:

- **`m` is never bound.** The daemon's own go-home gesture owns it exclusively; Deskbar tried
  binding it once and a single keydown reached the app before the daemon's 5-press threshold,
  causing an unwanted focus session. Leave it unbound.
- **Both `Enter` and `' '` fire the dial push-button.** Bind both, not just one — confirmed on
  real hardware, not documented by bridgething itself.

## Mock-mode development

`bun run --cwd apps/deskbar dev:mock` (`VITE_MOCK=1`) swaps in `src/mockClient.ts`, a fake
`AppBridgeClient` with fault injection via `window.__deskbarMock` in the browser console. This
has no equivalent in the `@bridgething/source` CLI — it's how the whole app (status, focus
timer, Jira issue picker, worklog logging, webhook firing) gets exercised without a Car Thing
attached, and what `bun run --cwd apps/deskbar test` runs against. See the README's "Testing
failure paths" section for the fault-injection recipe.

## Screenshots

`bun run --cwd apps/deskbar screenshots` runs `scripts/capture-screenshots.mjs`, a Playwright
script against `dev:mock` that seeds specific states (a paused focus session, a populated Today
list) no hardware could easily reproduce on demand. This is separate from — and still needed
alongside — the CLI's own `bun run shot deskbar`, which captures whatever's currently on a
physically-connected device's screen but can't seed state.
