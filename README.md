# Deskbar

A BUSY Bar–style status, focus timer, and Jira time-tracking app for a
Spotify Car Thing running [bridgething](https://bridgething.com).

It is not a literal clone of BUSY Bar — bridgething's screen is a small
color touch LCD, not an RGB LED matrix, and the SDK does not expose the
things a physical hardware device like BUSY Bar controls directly (system
Do Not Disturb, app blocking, a camera/mic presence sensor). What it does
give you, built here:

- **Status display** — tap Available / Busy / Focus; the current status is
  shown full-screen and persisted on the device (survives a reload/reboot).
- **Focus timer** — pick a duration, optionally attach a Jira issue, and run
  a full-screen countdown.
- **Jira time tracking** — the focus-setup screen lists issues from a
  configurable JQL query (defaults to "assigned to me, unresolved"); when a
  focus session ends (naturally or early), the elapsed time is logged to
  that issue's worklog via the Jira REST API.
- **Log time now** — log time to an issue directly, without running a
  timer, from Home's fourth preset.
- **Today** — a running total of time logged today, tappable from Home, with
  a list of each session. Any entry can be deleted, which removes its
  worklog from Jira too (entries logged before this existed have no
  worklog id to delete by, so those are removed from Deskbar only).
- **Focus automation hook** — since bridgething has no API for toggling a
  phone's or PC's Do Not Disturb, Deskbar instead POSTs a small JSON event
  (`focus.started` / `focus.stopped`) to an optional webhook URL you
  configure. Point that at a Home Assistant webhook, an IFTTT Webhooks
  applet, or an Apple Shortcuts personal-automation trigger, and have _that_
  flip DND / block apps. This is the honest substitute for BUSY Bar's
  built-in phone/PC app blocking, which bridgething's SDK doesn't expose.

All of the above is verified against the real `@bridgething/client@0.11.0`
and `@bridgething/lib@0.11.0` TypeScript definitions (pulled from npm), not
just the prose docs — this project type-checks and builds cleanly against
them.

## Setup

Requires Node 20+ (works with `npm`, `pnpm`, or `bun`).

```sh
npm install
npm run build
```

`npm run build` type-checks, builds with Vite, then zips `dist/` together
with `manifest.json` and `icon.png` into
`build/<manifest id>-<version>.zip` — that zip is the installable bundle.

`npm run dev` runs a normal Vite dev server for iterating on the UI in a
regular browser. The bridgething SDK client auto-connects to the on-device
daemon and simply won't find one there, so screens that need live device
data (config, the timer's persisted state) will sit in their loading/empty
state until you load the zip onto an actual Car Thing.

`npm run dev:mock` (`VITE_MOCK=1`) swaps in an in-browser fake bridgething
client instead, so you can exercise the whole app — status, focus timer,
Jira issue picker, worklog logging, webhook firing — without a real
on-device daemon. There's no dev-server/network path to a real Car Thing
(`@bridgething/client@0.11.0` fails to decode the daemon's first message
over an actual network link, only over loopback), so the mock is the
fastest inner loop; see "Installing it on the device" below for testing
against real hardware.

The UI is tuned for the Car Thing's 800x480 touch LCD (~235ppi) — expect
desktop-browser testing to look oversized relative to how it reads on
device.

### Testing failure paths

The mock always succeeds, so worklog/webhook failure toasts, error states,
and config pushes from the phone don't happen on their own. In mock mode
only, `window.__deskbarMock` is wired up in the browser console for exactly
this:

```js
// Fail every request whose URL contains this substring, until cleared.
__deskbarMock.setFetchFault('/worklog', { status: 500 });
__deskbarMock.setFetchFault('/webhook', { throws: true }); // simulate a dead connection, not just a bad response
__deskbarMock.clearFetchFault('/worklog');
__deskbarMock.clearAllFetchFaults();

// Push a config change, as if the phone app had just saved new settings.
__deskbarMock.setConfig({ focusWebhookUrl: 'https://example.com/webhook' });
```

### Development

- `npm run lint` / `npm run format` (or `format:check`) — ESLint and
  Prettier.
- `npm test` (or `test:watch`) — Vitest; runs against the mock client
  (`.env.test` sets `VITE_MOCK=1`), so no daemon or hardware is needed.
- `.github/workflows/ci.yml` runs format, lint, typecheck, test, and build
  on every push/PR to `main`.

## Configuration (set from your phone, not on the device)

Deskbar declares its settings as manifest `config` fields, which the
bridgething companion phone app renders as a normal settings form for the
app (masking the API token since it's a `secret` field) — no custom
settings page needed:

- **Jira site URL** — e.g. `https://yourteam.atlassian.net`
- **Jira account email**
- **Jira API token** — create one at
  `https://id.atlassian.com/manage-profile/security/api-tokens`
- **JQL for the issue picker** — defaults to
  `assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC`
- **Focus webhook URL** — optional
- **Default focus length** — minutes

Time tracking and the issue picker degrade gracefully if Jira isn't
configured: Focus mode still works as a plain timer.

## Installing it on the device

The bridgething docs I could confirm cover **catalog-based distribution**,
not a specific "sideload this one zip" flow — I did not find a documented
drag-and-drop/dev-server install path, so don't take its absence here as
confirmation it doesn't exist; check the companion app itself and the
[bridgething GitHub repo](https://github.com/JoeyEamigh/bridgething) /
its Discord for a faster inner loop before assuming you need the catalog
route for every iteration.

The confirmed route:

1. Host the built zip somewhere with `Access-Control-Allow-Origin: *` on
   the response (e.g. a GitHub Pages / R2 / S3 bucket).
2. Compute its sha256: `shasum -a 256 build/<file>.zip`.
3. Fill in `catalog.example.json` (rename to `catalog.json`) with that
   URL, hash, and version, and host it too, same CORS requirement.
4. Add your catalog's URL as a source in the bridgething companion app,
   then install Deskbar from it.

Bump `manifest.json`'s `version` and re-run `npm run build` for updates;
list newest-first in the catalog per the publishing docs.

## Physical controls

The Car Thing's presets, rotary dial, and Back button reach the webapp as
plain `keydown`/`wheel` DOM events (bridgething doesn't route them through
`@bridgething/client`), so each screen binds them directly:

- **Presets 1-3** pick a status on Home; **preset 4** opens Log Time Now
  (once Jira is configured). **Presets 1-4** pick a duration preset on
  Focus Setup and Log Time Now.
- **Dial** scrolls the issue list on Focus Setup/Log Time Now
  (auto-scrolling to keep the selection visible).
- **Back / Escape** cancels or ends a session on Focus Setup/Running/Log
  Time Now/Today.
- The **Today** summary and history rows are touch-only — no physical
  binding, since Home's presets/dial are already spoken for.
- **Dial push-button** starts a focus session on Focus Setup. bridgething
  doesn't document this button's keycode; confirmed on real hardware that it
  fires both Enter and Space, so both are bound.
- **Mode ("m") is intentionally left unbound.** The daemon watches raw
  `KEY_M` across the active webapp for a 5-rapid-press go-home gesture; an
  app-level binding on "m" would fire on the gesture's first press too. Do
  not bind Start (or anything else) to "m".

The Car Thing's physical dial and bridgething's notification toasts both
occlude the screen's top-right corner — keep new interactive UI out of that
area (the Focus Setup duration row is clustered left for this reason).

## Project layout

```
manifest.json          bridgething app manifest (id, config fields, permissions)
icon.png                app icon
index.html, src/        the webapp itself (React + TypeScript + Vite)
  src/bridgething.ts     BridgethingClient singleton + config helpers
  src/session.ts         status/focus-timer state, persisted via client.store
  src/history.ts          logged-time history, persisted via client.store
  src/jira.ts             Jira REST calls via client.net.fetch (search + worklog)
  src/webhook.ts          optional focus-start/stop webhook POST
  src/mockClient.ts       dev:mock's fake client, incl. fault injection
  src/ErrorBoundary.tsx   top-level render-error fallback
  src/App.tsx, styles.css  the UI
  src/*.test.ts(x)        Vitest unit tests
scripts/package-webapp.mjs   zips dist/ + manifest.json + icon.png after `vite build`
catalog.example.json    example catalog.v1 document for self-hosted distribution
.github/workflows/ci.yml    lint/typecheck/test/build on push and PR
```

## Known gaps / next steps

- No on-device DND/app-blocking — see the webhook note above.
- The issue picker is tap-to-select from a JQL result list; there's no
  on-device text search, since a touchscreen-only keyboard flow wasn't
  worth the complexity for a first pass. Narrow results with the JQL field
  instead (e.g. scope it to one project).
- Mic/camera-based auto-busy-detection (like BUSY Bar's call detection) has
  no analog here — bridgething's `phone` surface only exposes the connected
  phone's _cellular_ call state, not "an app like Zoom/Meet is capturing the
  mic," so it wasn't included in this pass.
