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

## Setup

This app is part of the `deskbar` bun workspace at the repo root — see the
[root README](../../README.md) for `bun install` and the shared `dev`/`push`/
`check` commands. From here:

```sh
bun run dev          # Vite dev server against a connected Car Thing
bun run dev:mock     # in-browser fake bridgething client, no hardware needed
bun run dev:device   # show the dev server on the Car Thing's own screen
bun run build        # writes dist/ (main app + settings.html)
```

`dev` connects through the dev server's own daemon proxy, so it needs a Car
Thing plugged in over USB; anything that needs live device data sits in a
loading/empty state without one. `dev:mock` (`VITE_MOCK=1`) swaps in an
in-browser fake client instead, so you can exercise the whole app (status,
focus timer, Jira issue picker, worklog logging, webhook firing) without any
hardware at all — this is the fastest inner loop and the one CI runs tests
against.

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

- `bun run lint` / `bun run format` (or `format:check`): ESLint and
  Prettier. Not part of the root `bun run check` gate (this template
  ships neither tool) — CI runs them as their own steps.
- `bun run test` (or `test:watch`): Vitest; runs against the mock client
  (`.env.test` sets `VITE_MOCK=1`), so you don't need a daemon or
  hardware.
- `.github/workflows/ci.yml` at the repo root runs format, lint, test,
  and `bun run check` (typecheck + build + catalog validation) on every
  push/PR to `main`.

## Configuration

Deskbar declares its settings as manifest `config` fields, which both the
bridgething companion phone app's auto-generated form and this app's own
settings page (`settings/`, built from `settings.html` per the manifest's
`settings` field) read and write via `@bridgething/client/settings`:

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

```sh
bun run --cwd apps/deskbar push    # build and install onto a USB-connected Car Thing
bun run --cwd apps/deskbar share   # zip dist/ to hand to someone directly
```

Or from the repo root: `bun run push deskbar` / `bun run share deskbar`.

## Releasing

```sh
bun run bump deskbar patch -m "Fix the wind direction arrow"
git commit -am "deskbar: fix the wind direction arrow" && git push
```

Pushing to `main` builds every changed app and republishes the catalog to
GitHub Pages automatically — see `.github/workflows/publish.yml` at the repo
root. There is no separate tag/release step: `bun run bump` is what moves the
version, and `bun run check` (part of CI) refuses a PR that changed this app
without bumping it. `bun run publish --dry-run` from the repo root assembles
what would be published, into `site/`, without pushing anything.

Regenerate `screenshots/*.png` with `bun run screenshots` rather than
capturing them by hand. It drives the real app in `dev:mock` mode
(Playwright + Chromium, installed once via `bunx playwright install
chromium`) through Home, Focus Setup, Focus Running, Paused, and Today, at
the device's actual 800x480, so they can't drift out of sync with a UI
change the way a manually-captured set can. `bun run shot deskbar` (from the
repo root) is the CLI's own screenshot command, capturing whatever's on a
physically-connected device's screen over CDP — useful for a quick real-device
check, but it can't seed a specific state (a paused session, a populated
Today list) the way the Playwright script can.

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
public/manifest.json    bridgething app manifest (id, config fields, permissions, art)
public/icon.png          app icon
catalog.json             store listing (author, homepage, screenshots, min_libbridgething_version)
CHANGELOG.md              per-version release notes; read by `bun run bump`/`publish`
screenshots/              catalog screenshots
HARDWARE.md               confirmed-vs-guessed physical hardware behavior
index.html, src/          the webapp itself (React + TypeScript + Vite + Tailwind)
  src/App.tsx              top-level orchestration: config/session/history state, screen routing
  src/daemon.ts            daemon ws url + dev-mode proxy path (generated, do not hand-edit)
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
  src/index.css            Tailwind + the design-token @theme block
settings/                 the settings webapp (settings.html/main.tsx/style.css), built separately
scripts/bridgething.ts, push.ts, share.ts   generated dev/push/share tooling, do not hand-edit
scripts/capture-screenshots.mjs             regenerates screenshots/*.png via Playwright against dev:mock
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
  the Jira-prefixed fields in `public/manifest.json`'s `config` and
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

[MIT](../../LICENSE)
