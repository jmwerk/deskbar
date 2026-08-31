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
- **Focus automation hook** — since bridgething has no API for toggling a
  phone's or PC's Do Not Disturb, Deskbar instead POSTs a small JSON event
  (`focus.started` / `focus.stopped`) to an optional webhook URL you
  configure. Point that at a Home Assistant webhook, an IFTTT Webhooks
  applet, or an Apple Shortcuts personal-automation trigger, and have *that*
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

- **Presets 1-3** pick a status on Home; **presets 1-4** pick a duration
  preset on Focus Setup.
- **Dial** scrolls the issue list on Focus Setup (auto-scrolling to keep the
  selection visible).
- **Back / Escape** cancels or ends a session on Focus Setup/Running.
- **Dial push-button** starts a focus session on Focus Setup. bridgething
  doesn't document this button's keycode, so both community-suggested
  candidates (Enter and Space) are bound — confirm on real hardware if you
  add a screen that needs to distinguish them.
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
  src/jira.ts             Jira REST calls via client.net.fetch (search + worklog)
  src/webhook.ts          optional focus-start/stop webhook POST
  src/App.tsx, styles.css  the UI
scripts/package-webapp.mjs   zips dist/ + manifest.json + icon.png after `vite build`
catalog.example.json    example catalog.v1 document for self-hosted distribution
```

## Known gaps / next steps

- No on-device DND/app-blocking — see the webhook note above.
- The issue picker is tap-to-select from a JQL result list; there's no
  on-device text search, since a touchscreen-only keyboard flow wasn't
  worth the complexity for a first pass. Narrow results with the JQL field
  instead (e.g. scope it to one project).
- Worklog time is only logged when a focus session ends; there's no
  standalone "log time to an issue right now" action yet.
- Mic/camera-based auto-busy-detection (like BUSY Bar's call detection) has
  no analog here — bridgething's `phone` surface only exposes the connected
  phone's *cellular* call state, not "an app like Zoom/Meet is capturing the
  mic," so it wasn't included in this pass.
