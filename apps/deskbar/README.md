# Deskbar

A BUSY Bar-style status, focus timer, and Jira time-tracking app for a
Spotify Car Thing running [bridgething](https://bridgething.com).

It's not a literal clone of BUSY Bar: bridgething's screen is a small
color touch LCD, not an RGB LED matrix, and its SDK doesn't give you
direct control over the things a physical BUSY Bar handles (system Do Not
Disturb, app blocking, a camera/mic presence sensor). Here's what you get
instead:

- **Home is today's ledger:** the time you've logged today leads the
  screen, with every worklog from today listed under it. With nothing
  logged yet, the list is a calendar of the next two hours instead: turn
  the dial (or drag or tap the calendar) to set a first focus, and press
  it to open Focus Setup at that length. Status lives in the preset tabs
  along the top: press or tap Available / Busy / Focus and that tab
  lights up in its color, saved on the device so it survives a reload or
  reboot. Sit idle on Home for 3 minutes and it dims to a clock (digital,
  analog, in words, or hours stacked over minutes, 12h or 24h, set in settings); any
  touch, preset press, or dial nudge wakes it back up. That first input
  only wakes the screen; it never doubles as a tap on whatever's
  underneath.
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
  reachable. Sessions under a minute log nothing. Starting a session can
  move its issue to a status you name (say In Progress), and session
  worklogs can round to the nearest 5 or 15 minutes.
- **Synced with Jira:** Home's ledger matches Jira. Worklogs you add
  from Jira's site or another device show up on launch, when the screen
  wakes from the idle clock, when you come back to Home, and every 10
  minutes (at most once per 30 seconds); ones deleted there drop out. A line under the total says when it last
  synced ("Synced 4 min ago"); tap it, or pull the ledger down, to sync
  right away. Pulling down the issue list on Focus Setup or Log Time Now
  re-runs your JQL for new tickets, keeping the issue you picked.
- **Recent issues:** the last five issues you logged to in the past week
  stay in the issue list, marked Recent, even after your JQL stops
  returning them.
- **Log time now:** Log time to an issue directly, no timer required,
  from Home's fourth preset. It starts at your default focus length.
- **Receipt and undo:** Every worklog, from a session or Log Time Now,
  ends on a receipt showing what was logged, to which issue, and today's
  new total, with 8 seconds to undo it by touch or with Back. With a
  Done status set, the receipt can also move the issue there.
- **Clock and now playing:** A dock along the bottom of Home and Focus
  Running shows the time and whatever your phone's Spotify is playing.
  Tap the clock to dim Home to the idle clock right away. Tap the track
  for a full-screen player: presets 1-4 are previous, play/pause, next
  and like (saves the track to your Spotify library), the dial seeks,
  pressing the dial plays/pauses, Close or Back closes it. With no phone
  connected it just says "Nothing playing". It sits at the bottom because
  the top-right corner is under the dial and bridgething's notification
  toasts.
- **Lyrics, queue and artist:** The player follows along with timed
  lyrics (the line being sung and the next one), toggled with its Lyrics
  button. Tap the playlist or album to see all of it with Spotify's queue
  on top, or tap the artist for their top tracks. In those lists, tap a
  track to play it, or add it to the queue without interrupting what's
  playing by swiping it right, from its ⋯ menu, or by holding the dial
  press.
- **Deleting a worklog:** tap any row in Home's ledger, or point the dial
  at it and press, to delete it in place. That removes its worklog from
  Jira too (entries logged before this feature existed don't have a
  worklog id to delete by, so those only get removed from Deskbar).
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
__deskbarMock.setFetchFault('/worklog', { unreachable: 'timeout' }); // Jira itself unreachable (DNS/timeout/etc.)
__deskbarMock.clearFetchFault('/worklog');
__deskbarMock.clearAllFetchFaults();

// Push a config change, as if the phone app had just saved new settings.
__deskbarMock.setConfig({ focusWebhookUrl: 'https://example.com/webhook' });

// Phone stops reporting playback, so Home's dock shows "Nothing playing"; pass true to resume.
__deskbarMock.setNowPlaying(false);
```

The mock also plays the tracker: it keeps every worklog it receives (in
`localStorage` under `deskbar-mock-tracker:worklogs`), so sync, undo and
delete round-trip, and adding an entry there by hand stands in for time
logged from another device on the next sync.

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
- **Timezone:** IANA name, only needed if the device's clock isn't
  already set to yours
- **Clock format:** `12h` (default) or `24h`, for every clock in the app
- **Idle clock face:** `digital` (default), `analog`, `words`, or
  `stacked`
- **Status when a focus session starts:** e.g. `In Progress`; blank skips
  the move
- **Done status:** e.g. `Done`; adds the receipt's move button
- **Rounding:** `off` (default), `5` or `15` minutes, for focus
  sessions; never below one step

The settings page has a **Test connection** button that checks the Jira
site, email and token you've typed before you save, and a pasted issue
or board link becomes the site address when you leave the field.

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
bun run bump deskbar patch -m "Keep the focus issue on one line"
git commit -am "fix(deskbar): keep the focus issue on one line" && git push
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
chromium`) through Home (with a seeded ledger), Focus Setup, Focus Running, Paused, Now Playing, and Log Time Now, at
the device's actual 800x480, so they can't drift out of sync with a UI
change the way a manually-captured set can. `bun run shot deskbar` (from the
repo root) is the CLI's own screenshot command, capturing whatever's on a
physically-connected device's screen over CDP — useful for a quick real-device
check, but it can't seed a specific state (a paused session, a populated
ledger) the way the Playwright script can.

## Physical controls

The Car Thing's presets, rotary dial, and Back button all reach the
webapp as plain `keydown`/`wheel` DOM events (bridgething doesn't route
them through `@bridgething/client`), so each screen binds them directly
via the shared hooks (`useKeydown`, `useRotaryStep`, `useDialPress`,
`useModeTap`) in `src/physicalControls.ts`:

- **Presets 1-3** pick a status on Home; **preset 4** opens Log Time Now
  (once Jira is configured). **Presets 1-4** nudge the duration on
  Focus Setup, Log Time Now and Focus Running.
- **Dial** scrolls the issue list on Focus Setup/Log Time Now
  (auto-scrolling to keep the selection visible). Turning up past the
  first issue moves the dial to the duration (±1 min per detent);
  pressing the dial there hands it back to the list.
- On Home the **dial** walks today's ledger, a **press** asks to delete
  the highlighted worklog, a second press deletes it, and **Back**
  cancels. With nothing logged yet, the **dial** tunes a first focus
  5 minutes per detent and a **press** opens Focus Setup at it.
- **Back / Escape** cancels on Focus Setup/Log Time Now and dismisses a
  delete confirm on Home. On Focus Running it **toggles pause/resume**
  instead of ending the session. Right after time is logged, Back undoes
  it from the receipt (a delete confirm, if one is open, closes first).
- **Mode ("m")**, one tap, ends a running focus session. The End
  button fills while Deskbar waits out the daemon's go-home window
  (~1.5s), so pressing M again or holding it to go home never ends the
  session. M does nothing on any other screen.
- **Now playing** (opened from the dock): **presets 1-4** are
  previous, play/pause, next and like; the **dial** seeks 10s per
  detent; the **dial push-button** plays/pauses; **Back** closes it.
  Home's status presets are inactive while it's open. In the queue and
  artist lists the **dial** walks the tracks, a **press** plays one,
  **holding** the press opens Add to queue / Go to artist, and **Back**
  closes the menu, then the list.
- **Dial push-button** starts a focus session on Focus Setup, logs on
  Log Time Now, and plays/pauses music on Focus Running (both `Enter` and `Space` are bound; see
  [HARDWARE.md](HARDWARE.md) for why).

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
PRODUCT.md, DESIGN.md     product intent and the design system
index.html, src/          the webapp itself (Preact via React compat + TypeScript + Vite + Tailwind)
  src/App.tsx              top-level orchestration: config/session/history state, screen routing
  src/daemon.ts            daemon ws url + dev-mode proxy path (generated, do not hand-edit)
  src/config.ts            Config type + parseConfig
  src/format.ts            formatClock / formatDuration
  src/physicalControls.ts  key, dial, mode-tap and idle hooks (see HARDWARE.md)
  src/bridgething.ts       BridgethingClient singleton + config helpers
  src/session.ts           status/focus-timer state, persisted via client.store
  src/history.ts           logged-time history, persisted via client.store
  src/retryQueue.ts        worklogs that failed to log at session end, retried on launch
  src/issueSelection.ts    issue preselection and dial movement through the issue list
  src/jira.ts              Jira REST calls via client.net.fetch (search, worklogs, transitions)
  src/worklogs.ts          posts, deletes and syncs worklogs; the one seam for another tracker
  src/timesheet.ts         rounding and the sync line
  src/jiraUrl.ts           turns a pasted Jira link into the site address
  src/webhook.ts           optional focus-start/stop webhook POST
  src/mockClient.ts        dev:mock's fake client, incl. fault injection
  src/ErrorBoundary.tsx    top-level render-error fallback
  src/usePlayer.ts         now-playing state, transport, likes and artwork via client.player/library/asset
  src/NowPlaying.tsx       the dock's now-playing chip, the full-screen player, queue and artist lists
  src/music.ts             artwork, lyrics and playlist/album browsing hooks
  src/artTint.ts           picks the player background color from the artwork
  src/ScrollText.tsx       single-line text that pans when it overflows
  src/TuneFocus.tsx        the calendar Home shows with nothing logged yet
  src/usePullToRefresh.ts  pull-down-to-refresh gesture for the ledger and issue lists
  src/PullToRefresh.tsx    the strip a pulled list uncovers
  src/TodayLedger.tsx      Home's list of today's worklogs, with delete in place
  src/Receipt.tsx          the post-log receipt and its undo window
  src/IdleClock.tsx        the idle clock's four faces
  src/useCountUp.ts        animates today's total up to its new value
  src/Toast.tsx, icons.tsx, DurationPicker.tsx, IssuePicker.tsx   shared UI
  src/screens/             Home, FocusSetup, LogTimeNow, FocusRunning
  src/fonts/               Inter Variable (Latin woff2), vendored with its OFL license
  src/*.test.ts(x)         Vitest unit tests (run on React; the device build uses Preact)
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
- Jira is the only time-tracking backend right now. It sits behind
  `src/worklogs.ts` (`postWorklog` / `removeWorklog` /
  `fetchDayWorklogs`), so adding Tempo, Linear, GitHub Issues, Asana, or
  anything else with worklog-style time tracking should mean writing an
  equivalent module and a branch there rather than touching the rest of
  the app. Issues still come from Jira either way.
- Sign-in is by API token. A "Log in with Jira" (OAuth) flow would need a
  hosted token server to hold the client secret, which this app doesn't
  have.

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

## Credits

The clock-and-now-playing dock and the full-screen player were inspired
by [gyeonggi](https://github.com/espeon/gyeonggi) by Natalie Bridgers,
whose FlowState launcher pairs a compact now-playing bar with a
full-screen player for the Car Thing. Deskbar's version is its own
implementation, styled to match the rest of the app.

## License

[MIT](../../LICENSE)
