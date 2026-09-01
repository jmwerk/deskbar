# Deskbar

A BUSY Bar-style status, focus timer, and Jira time-tracking app for a
Spotify Car Thing running [bridgething](https://bridgething.com).

It's not a literal clone of BUSY Bar: bridgething's screen is a small
color touch LCD, not an RGB LED matrix, and its SDK doesn't give you
direct control over the things a physical BUSY Bar handles (system Do Not
Disturb, app blocking, a camera/mic presence sensor). Here's what you get
instead:

- **Status display:** Tap Available / Busy / Focus and the status shows
  full-screen, saved on the device so it survives a reload or reboot. Sit
  idle on Home for 3 minutes and it dims down to a plain clock instead of
  leaving the status tiles up forever; any touch, preset press, or dial
  nudge wakes it back up. That first input only wakes the screen; it
  never doubles as a tap on whatever's underneath.
- **Focus timer:** Pick a duration, optionally attach a Jira issue, and
  run a full-screen countdown. You can pause and resume it (Back or a
  touch button toggles this), and paused time never counts toward the
  session, whether it ends on its own or you cut it short.
- **Jira time tracking:** The focus-setup screen pulls issues from a
  configurable JQL query (defaults to "assigned to me, unresolved"). If
  the results span more than one project, chips above the list let you
  narrow things down without touching the JQL field. When a focus session
  ends (naturally or early), the elapsed time gets logged to that issue's
  worklog via the Jira REST API. If that log call fails, the session's
  already ended and you're back on Home, so there's nothing on screen
  left to retry by hand; instead the failed worklog gets queued and
  retried automatically the next time the app launches with Jira
  reachable.
- **Log time now:** Log time to an issue directly, no timer required,
  from Home's fourth preset.
- **Today:** A running total of what you've logged today, tappable from
  Home, with each session listed out. You can delete any entry, which
  removes its worklog from Jira too (entries logged before this feature
  existed don't have a worklog id to delete by, so those only get removed
  from Deskbar).
- **Focus automation hook:** bridgething has no API for toggling a
  phone's or PC's Do Not Disturb, so instead Deskbar POSTs an event
  (`focus.started` / `focus.stopped`) to an optional webhook URL you set
  up. The **webhook payload format** setting decides its shape: "json"
  (the default: a small `{event, issueKey, durationS}` payload) works
  well for pointing at a Home Assistant webhook, an IFTTT Webhooks applet,
  or an Apple Shortcuts automation trigger to flip DND or block apps. It's
  the honest substitute for BUSY Bar's built-in app blocking, which
  bridgething's SDK just doesn't expose. Or pick "slack"/"teams" to post
  a plain-text status message straight to a
  [Slack](https://api.slack.com/messaging/webhooks) or
  [Teams](https://learn.microsoft.com/microsoftteams/platform/webhooks-and-connectors/how-to/connectors-using)
  incoming webhook URL instead.

Everything above is verified against the real `@bridgething/client@0.11.0`
and `@bridgething/lib@0.11.0` TypeScript definitions (pulled straight from
npm), not just the prose docs. This project type-checks and builds
cleanly against them.

## Setup

You'll need Node 22.22+, 24.15+, or 26+ (jsdom, which the test suite uses,
sets that floor; see `engines` in package.json). Easiest is to just run
26+, which is what this is developed and CI'd against; works fine with
`npm`, `pnpm`, or `bun`.

```sh
npm install
npm run build
```

`npm run build` type-checks, builds with Vite, then zips `dist/` together
with `manifest.json` and `icon.png` into
`build/<manifest id>-<version>.zip`. That zip is what you actually
install.

`npm run dev` runs a normal Vite dev server for iterating on the UI in a
regular browser. The bridgething SDK client tries to auto-connect to the
on-device daemon and just won't find one there, so any screen that needs
live device data (config, the timer's persisted state) sits in its
loading/empty state until you load the zip onto an actual Car Thing.

`npm run dev:mock` (`VITE_MOCK=1`) swaps in an in-browser fake bridgething
client instead, so you can exercise the whole app (status, focus timer,
Jira issue picker, worklog logging, webhook firing) without a real
on-device daemon. There's no dev-server/network path to a real Car Thing
(`@bridgething/client@0.11.0` fails to decode the daemon's first message
over an actual network link, only over loopback), so the mock is the
fastest inner loop; see "Installing it on the device" below for testing
against real hardware.

The UI is tuned for the Car Thing's 800x480 touch LCD (~235ppi): expect
desktop-browser testing to look oversized compared to how it reads on
device. The physical rotary dial also sits over the screen's top-right
corner, permanently covering part of it, and a desktop browser won't show
you that either, so it's easy to place a control there without noticing.
Read "Physical controls" below before adding new interactive UI.

### Testing failure paths

The mock always succeeds, so worklog/webhook failure toasts, error
states, and config pushes from the phone won't happen on their own. In
mock mode only, `window.__deskbarMock` is wired up in the browser console
for exactly this:

```js
// Fail every request whose URL contains this substring, until cleared.
__deskbarMock.setFetchFault('/worklog', { status: 500 });
__deskbarMock.setFetchFault('/webhook', { throws: true }); // simulate a dead connection, not just a bad response
__deskbarMock.clearFetchFault('/worklog');
__deskbarMock.clearAllFetchFaults();

// Push a config change, as if the phone app had just saved new settings.
__deskbarMock.setConfig({ focusWebhookUrl: 'https://example.com/webhook' });
```

To exercise the pending-worklog retry queue: fail `/worklog` (above), end
a focus session, confirm you see the error toast and that Today doesn't
count it, then run `__deskbarMock.clearAllFetchFaults()` and reload the
page. The queued worklog should recover on its own with a
"Recovered…" toast.

### Development

- `npm run lint` / `npm run format` (or `format:check`): ESLint and
  Prettier.
- `npm test` (or `test:watch`): Vitest; runs against the mock client
  (`.env.test` sets `VITE_MOCK=1`), so you don't need a daemon or
  hardware.
- `.github/workflows/ci.yml` runs format, lint, typecheck, test, and
  build on every push/PR to `main`.

## Configuration (set from your phone, not on the device)

Deskbar declares its settings as manifest `config` fields, so the
bridgething companion phone app renders them as a normal settings form
for the app (masking the API token since it's a `secret` field). No
custom settings page needed:

- **Jira site URL:** e.g. `https://yourteam.atlassian.net`
- **Jira account email**
- **Jira API token:** create one at
  `https://id.atlassian.com/manage-profile/security/api-tokens`
- **JQL for the issue picker:** defaults to
  `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`
- **Focus webhook URL:** optional
- **Focus webhook payload format:** `json` (default), `slack`, or `teams`
- **Default focus length:** minutes

If Jira isn't configured, time tracking and the issue picker just degrade
gracefully. Focus mode still works fine as a plain timer.

## Installing it on the device

The bridgething docs I could confirm cover **catalog-based distribution**,
not a specific "sideload this one zip" flow. I didn't find a documented
drag-and-drop/dev-server install path, but don't take that absence as
proof it doesn't exist. Check the companion app itself and the
[bridgething GitHub repo](https://github.com/JoeyEamigh/bridgething) (or
its Discord) for a faster inner loop before assuming you need the catalog
route for every iteration.

### Releasing (automated)

Push a version tag and it builds, tests, and publishes a self-hosted
catalog to GitHub Pages. See `.github/workflows/release.yml`:

```sh
# 1. bump the version in both manifest.json and package.json
# 2. commit that, then:
git tag v0.2.0
git push origin v0.2.0
```

The workflow refuses to run if the tag doesn't match `manifest.json`'s
`version` (a copy-paste guard), then runs the same checks as CI, builds,
and hands off to `scripts/build-catalog-site.mjs`, which:

- Computes the new zip's sha256 and size, then pulls the _previous_ live
  `catalog.json` (if any) forward, merging this version into that app's
  `versions` array (newest-first) instead of replacing it. A device stuck
  on an older `min_libbridgething_version` can still fall back to
  whichever earlier version it's compatible with, per bridgething's own
  resolution logic. Older versions' zip files get re-copied into the new
  deploy too, since a Pages deploy fully replaces the site each time and
  would otherwise 404 them.
- Validates the generated `catalog.json` against bridgething's real
  catalog.v1 JSON Schema (vendored at `scripts/catalog.schema.v1.json`,
  from `packages/catalog/schema.v1.json` in
  [JoeyEamigh/bridgething](https://github.com/JoeyEamigh/bridgething))
  before deploying, and fails the release rather than publish something
  invalid. The schema's considerably richer than a single flat
  version/download pair (per-version `min_libbridgething_version`,
  `released_at`, `changelog`, etc.). The first release found that out the
  hard way.
- Picks up anything image-like in `screenshots/` and adds it to the app's
  `screenshots` array in filename order (the store shows the first one on
  the card). If the folder's empty, the key gets omitted entirely, since
  the schema wants it left off rather than sent as `[]`.

Regenerate `screenshots/*.png` with `npm run screenshots` rather than
capturing them by hand. It drives the real app in `dev:mock` mode
(Playwright + Chromium, installed once via `npx playwright install
chromium`) through Home, Focus Setup, Focus Running, Paused, and Today, at
the device's actual 800x480, so they can't drift out of sync with a UI
change the way a manually-captured set can.

Everything then deploys to `https://<owner>.github.io/<repo>/`. GitHub
Pages serves it with `Access-Control-Allow-Origin: *`, which is exactly
what bridgething's catalog fetch needs.

**One-time setup** (already done for this repo, `jmwerk/deskbar`; you'd
only need this again if you fork it):

- GitHub → repo Settings → Pages → set "Build and deployment" source to
  "GitHub Actions".
- The `github-pages` deployment environment GitHub creates only allows
  deploys from `main` by default; since this deploys from a tag, add a
  `v*` tag rule under Settings → Environments → github-pages → Deployment
  branches and tags, or the run fails with "not allowed to deploy to
  github-pages due to environment protection rules."

Then, on the phone: add `https://<owner>.github.io/<repo>/catalog.json`
as a catalog source in the bridgething companion app, and install/update
Deskbar from it.

### Releasing (manual / self-hosted elsewhere)

If you'd rather not use GitHub Pages, `scripts/build-catalog-site.mjs`
needs `GITHUB_REPOSITORY` set (Actions normally supplies this), so do it
by hand instead:

1. `npm run build`, then host the zip somewhere that sends
   `Access-Control-Allow-Origin: *` on the response (R2, S3, another
   static host).
2. Compute its sha256 and size: `shasum -a 256 build/<file>.zip` and
   `wc -c < build/<file>.zip`.
3. Fill in `catalog.example.json` (rename to `catalog.json`) with that
   URL, hash, and size, and host it too under the same CORS requirement.
   It's the real [catalog.v1 schema](https://apps.bridgething.com/schemas/catalog/v1.json)
   (`scripts/catalog.schema.v1.json` has a local copy). Each app entry
   holds a `versions` array, newest-first, not a single flat version, so
   add a new entry to that array per release instead of overwriting the
   one there. That way devices stuck on an older
   `min_libbridgething_version` can still fall back to a compatible
   version.
4. Add your catalog's URL as a source in the bridgething companion app,
   then install Deskbar from it.

## Physical controls

The Car Thing's presets, rotary dial, and Back button all reach the
webapp as plain `keydown`/`wheel` DOM events (bridgething doesn't route
them through `@bridgething/client`), so each screen binds them directly
via the shared `useKeydown`/`useRotaryStep` hooks in
`src/physicalControls.ts`:

- **Presets 1-3** pick a status on Home; **preset 4** opens Log Time Now
  (once Jira is configured). **Presets 1-4** pick a duration preset on
  Focus Setup and Log Time Now.
- **Dial** scrolls the issue list on Focus Setup/Log Time Now
  (auto-scrolling to keep the selection visible).
- **Back / Escape** cancels on Focus Setup/Log Time Now, and backs out of
  Today (or dismisses its delete-confirm step first). On Focus Running it
  **toggles pause/resume** instead of ending the session. Ending it is a
  separate touch button, available from either state.
- **Dial push-button** starts a focus session on Focus Setup (both
  `Enter` and `Space` are bound; see [HARDWARE.md](HARDWARE.md) for
  why).
- The **Today** summary and history rows are touch-only; no physical
  binding, since Home's presets and dial are already spoken for.
- **Mode ("m") is intentionally left unbound.** See
  [HARDWARE.md](HARDWARE.md), and don't rebind it.

[HARDWARE.md](HARDWARE.md) is the canonical place for what's confirmed
about the hardware itself versus guessed (the dial push-button's keycode,
the "m" gesture conflict, the two different top-right screen-occlusion
constraints and why the dial is the stricter one). This section is just
Deskbar's own mapping on top of that.

## Project layout

```
manifest.json           bridgething app manifest (id, config fields, permissions)
icon.png                app icon
screenshots/            catalog screenshots (picked up by build-catalog-site.mjs)
HARDWARE.md             confirmed-vs-guessed physical hardware behavior
LICENSE                 MIT
index.html, src/        the webapp itself (React + TypeScript + Vite)
  src/App.tsx              top-level orchestration: config/session/history state, screen routing
  src/config.ts            Config type + parseConfig
  src/format.ts            formatClock / formatDuration
  src/physicalControls.ts  useKeydown / useRotaryStep (see HARDWARE.md)
  src/bridgething.ts       BridgethingClient singleton + config helpers
  src/session.ts           status/focus-timer state, persisted via client.store
  src/history.ts           logged-time history, persisted via client.store
  src/retryQueue.ts        worklogs that failed to log at session end, retried on launch
  src/jira.ts              Jira REST calls via client.net.fetch (search/worklog create+delete)
  src/webhook.ts           optional focus-start/stop webhook POST
  src/mockClient.ts        dev:mock's fake client, incl. fault injection
  src/ErrorBoundary.tsx    top-level render-error fallback
  src/Toast.tsx, icons.tsx, DurationPicker.tsx, IssuePicker.tsx   shared UI
  src/screens/             Home, FocusSetup, LogTimeNow, History, FocusRunning
  src/*.test.ts(x)         Vitest unit tests, one per source file
scripts/package-webapp.mjs      zips dist/ + manifest.json + icon.png after `vite build`
scripts/build-catalog-site.mjs  builds the GitHub Pages release site (zip + catalog.json)
scripts/catalog.schema.v1.json  vendored copy of bridgething's real catalog.v1 schema
scripts/capture-screenshots.mjs regenerates screenshots/*.png via Playwright against dev:mock (`npm run screenshots`)
catalog.example.json    example catalog.v1 document for self-hosted distribution
.github/workflows/ci.yml         lint/typecheck/test/build on push and PR
.github/workflows/release.yml    builds + publishes a release to GitHub Pages on a version tag
```

## Known gaps / next steps

- No on-device DND/app-blocking: see the webhook note above.
- The issue picker works by tapping to select from a JQL result list;
  there's no on-device text search, since building a touchscreen-only
  keyboard flow wasn't worth the complexity for a first pass. When
  results span more than one project, tappable chips help narrow it
  down; the JQL field is still the more powerful way to scope results
  (e.g. to one project) before they ever reach the device.
- Mic/camera-based auto-busy-detection (like BUSY Bar's call detection)
  has no analog here: bridgething's `phone` surface only exposes the
  connected phone's _cellular_ call state, not "an app like Zoom/Meet is
  capturing the mic," so it didn't make it into this pass.
- Jira is the only time-tracking backend right now, simply because it's
  what I use day to day, not because anything here assumes Jira
  specifically. The integration is a small, isolated surface
  (`searchIssues` / `logWork` / `deleteWorklog` in `src/jira.ts`, plus
  the Jira-prefixed fields in `manifest.json`'s `config` and
  `src/config.ts`), so swapping in or adding Linear, GitHub Issues,
  Asana, or anything else with worklog-style time tracking should mean
  writing an equivalent module against that same shape rather than
  touching the rest of the app.

## Contributing

Issues and PRs are welcome, including for anything in the list above.
The time-tracking backend in particular was built against Jira first
because that's what I happened to need, not because the app is
Jira-specific under the hood: status, the focus timer, and the
physical-controls handling don't know or care what tracker is on the
other end. If you use Linear, GitHub Issues, Asana, or something similar
and want to add support for it, that's a genuinely approachable first
contribution, and I'm happy to help scope it out in an issue before you
write any code.

## License

[MIT](LICENSE)
