---
name: Deskbar
description: Today's logged Jira time, a focus timer, and busy/available/focus status on an 800x480 Car Thing.
colors:
  control-black: '#0b0d10'
  panel-graphite: '#16191d'
  edge-steel: '#262b31'
  off-white: '#f5f6f7'
  muted-slate: '#8a9099'
  focus-blue: '#3b82f6'
  go-green: '#2ecc71'
  stop-red: '#e74c3c'
typography:
  display:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '104px'
    fontWeight: 800
    lineHeight: 1
    letterSpacing: '-0.02em'
    fontFeature: 'tnum'
  total:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '72px'
    fontWeight: 800
    lineHeight: 1
    letterSpacing: '-0.03em'
    fontFeature: 'tnum'
  headline:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '34px'
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  title:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '26px'
    fontWeight: 800
  body:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '20px'
    fontWeight: 500
    lineHeight: 1.35
  label:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '16px'
    fontWeight: 800
  small:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '16px'
    fontWeight: 600
  keycap:
    fontFamily: "'Inter Variable', -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: '13px'
    fontWeight: 800
    letterSpacing: '0.04em'
rounded:
  keycap: '6px'
  tab: '8px'
  row: '12px'
  control: '14px'
  art: '18px'
  pill: '999px'
spacing:
  xs: '8px'
  sm: '14px'
  md: '16px'
  screen-y: '20px'
  screen-x: '28px'
components:
  button-primary:
    backgroundColor: '{colors.focus-blue}'
    textColor: '#ffffff'
    rounded: '{rounded.control}'
    padding: '16px'
  button-secondary:
    backgroundColor: '{colors.panel-graphite}'
    textColor: '{colors.off-white}'
    rounded: '{rounded.control}'
    padding: '16px'
  button-danger:
    textColor: '{colors.stop-red}'
    rounded: '{rounded.control}'
    padding: '16px'
  status-tab:
    backgroundColor: '{colors.panel-graphite}'
    textColor: '{colors.off-white}'
    typography: '{typography.label}'
    padding: '9px 4px'
  status-tab-lit-available:
    backgroundColor: '{colors.go-green}'
    textColor: '{colors.control-black}'
    typography: '{typography.label}'
  status-tab-lit-busy:
    backgroundColor: '{colors.stop-red}'
    textColor: '{colors.control-black}'
    typography: '{typography.label}'
  status-tab-lit-focus:
    backgroundColor: '{colors.focus-blue}'
    textColor: '{colors.control-black}'
    typography: '{typography.label}'
  preset-tab:
    backgroundColor: '{colors.panel-graphite}'
    textColor: '{colors.off-white}'
    typography: '{typography.label}'
    padding: '9px 4px'
  today-total:
    textColor: '{colors.off-white}'
    typography: '{typography.total}'
  list-row:
    backgroundColor: '{colors.panel-graphite}'
    rounded: '{rounded.row}'
    padding: '12px 36px 12px 14px'
    height: '52px'
  filter-chip:
    backgroundColor: '{colors.panel-graphite}'
    textColor: '{colors.muted-slate}'
    rounded: '{rounded.pill}'
    padding: '6px 14px'
  receipt:
    textColor: '{colors.off-white}'
    rounded: '{rounded.control}'
    padding: '14px 16px 0'
  keycap:
    typography: '{typography.keycap}'
    rounded: '{rounded.keycap}'
    padding: '2px 7px'
  now-playing-chip:
    backgroundColor: '{colors.panel-graphite}'
    rounded: '{rounded.control}'
    padding: '7px 16px 7px 7px'
    height: '56px'
---

# Design System: Deskbar

## Overview

**Creative North Star: "The Desk Instrument"**

Deskbar is a purpose-built gadget, not a web page that happens to be small. The screen is a fixed 800x480 landscape
pane read at arm's length, framed by physical hardware: four preset buttons above it, a rotary dial over its top-right
corner, a Back button, and a Mode button. The design treats that hardware as part of the interface. The preset tabs hang
from the top edge as if the buttons' own material continued into the glass, presses on hardware flash their on-screen
twins, the dial's current target is always lit in Focus Blue, and controls name their physical twin with a small keycap.

The instrument's reading is the day's logged time. Home leads with today's total and a ledger of today's worklogs;
status rides in the preset tabs, lit in its signal color. The surface is near-black and dense, with large, chunky,
rounded controls that shrink under a finger. Color is signal: the three status hues mean Available, Busy and Focus, and
appear at full strength only where that meaning is the point. Everything else is graphite panels, steel edges and slate
text. The one place the instrument loosens up is the now-playing player, which washes the whole screen in the album
art's own color.

**Key Characteristics:**

- Dark-only, fixed 800x480, no responsive behavior.
- Today's logged time is the largest thing on Home; status is a lit preset tab.
- Chunky, finger-sized, rounded controls with a press-shrink response.
- Preset tabs flush to the top edge, mirroring the physical buttons above the screen.
- Every action has a physical path, and on-screen keycaps name it.
- Status color carries meaning; the chrome is neutral.
- Bottom-anchored persistent UI; nothing in the top-right corner, interactive or meant to be read.
- System sans at heavy weights, tabular numerals for every time value.

## Colors

A neutral graphite instrument body with three saturated signal lamps.

### Primary

- **Focus Blue** (`focus-blue`): the Focus status, the primary action button, the dial's current target (selected issue
  row, selected ledger row, dial-focused duration, selected filter chip), Jira issue keys, the progress fill, and the
  now-playing wash fallback when artwork has no tint.

### Secondary

- **Go Green** (`go-green`): the Available status, the receipt and success toasts, today's total glowing as time lands,
  the liked-track preset, and the now-playing equalizer bars.

### Tertiary

- **Stop Red** (`stop-red`): the Busy status, destructive actions (End, Delete), the End button's fill while an M tap
  waits, error toasts and error hints.

### Neutral

- **Control Black** (`control-black`): the screen background, the dimmed clock, and text on lit status tabs.
- **Panel Graphite** (`panel-graphite`): every resting surface: preset tabs, rows, chips, secondary buttons, the dock,
  the neutral info toast.
- **Edge Steel** (`edge-steel`): 1px borders on panels. Opaque on purpose so it reads identically over black and graphite.
- **Off-White** (`off-white`): primary text, today's total.
- **Muted Slate** (`muted-slate`): secondary text, issue summaries, the paused clock, labels, the dimmed clock.

### Named Rules

**The Signal Lamp Rule.** Green, red and blue mean Available, Busy and Focus. Never use them decoratively; red also means
destructive or error, green also means success or time logged.

**The Tint, Don't Fill Rule.** Outside a lit status tab and the primary button, a signal color appears as a tint mixed
into graphite (14 to 30%) with a 45% border, not as a solid fill.

**The Dial Points Blue Rule.** Whatever the dial will act on is marked in Focus Blue: a blue border plus a 15 to 20%
tint, the same box on issue rows, ledger rows and the duration. The now-playing player is the one exception: its queue
and artist rows take an Off-White border and an 18% white tint, for the same reason its progress fill is Off-White.

**The Dark-On-Lamp Rule.** Text on a solid signal fill is Control Black: lit status tabs, the confirm Delete button,
badges. White on Go Green is about 2:1, and white on the red and blue fills sits under 4:1. The one exception is the
primary button's 20px/700 Off-White label on Focus Blue, which clears the 3:1 bar for large text.

## Typography

**Font:** Inter Variable, vendored as a 48 KB Latin woff2 in `src/fonts/` (SIL Open Font License, `Inter-OFL.txt`),
falling back to the system sans.

**Character:** One neutral screen face, pushed to heavy weights (700 to 800) for anything that has to be read at arm's
length on a 235ppi panel. Hierarchy comes from size and weight, not from font pairing. The face is vendored because the
Car Thing has only Liberation Sans, which renders every weight from 600 up as one Bold.

### Hierarchy

- **Display** (800, 104px, line-height 1, -0.02em): the focus countdown and the digital dimmed clock (Muted Slate there).
- **Total** (800, 72px, line-height 1, -0.03em): today's logged total on Home.
- **Headline** (800, 34px, 1.15, -0.01em): the now-playing track title.
- **Title** (800, 26px): the setup sentence, the dock clock, the receipt amount, the focus timer pill.
- **Body** (20px; 500 for muted text, 700 for strong): list rows, action buttons, hints, the issue tag, the today
  total's meta line. Muted body text is 500, never 400, so slate on black holds up.
- **Label** (800, 16px): preset and status tab labels, the Unlimited toggle, confirm buttons, Undo.
- **Small** (600, 16px): metadata: the player's source line and list rows, scrubber times, chips (+0.04em,
  they're uppercase keys), the receipt's summary and day total, the dial hint, toasts.
- No eyebrows. The player dropped "NOW PLAYING" and Focus Running dropped "FOCUS SESSION"; the content heads each.
- **Keycap** (800, 13px, 0.04em): the "Back" and "M" keycaps.

### Named Rules

**The Sixteen Floor Rule.** Nothing reads smaller than 16px except a keycap (13px). At this panel's density 13 to 15px
text sits at the edge of legibility from arm's length.

**The Tabular Time Rule.** Every clock, countdown, duration, total and scrubber time uses
`font-variant-numeric: tabular-nums` so digits never jitter.

**The One Line Rule.** Titles and summaries that may run long stay on one line: ellipsis in lists, a slow pan
(ScrollText) where the full text matters.

## Layout

A single fixed 800x480 viewport; nothing reflows. Each screen is a full-viewport flex column with 20px vertical and
28px horizontal padding and a 200ms fade-in.

- **Top band:** the 4-up preset tab strip cancels the screen padding (`margin: -20px -28px 14px`) to sit flush with the
  top, left and right edges, one column per physical preset.
- **Middle:** the flexible region. On Home, today's total with its meta stacked beside it, then the ledger, which
  scrolls. Elsewhere the issue list, the countdown, or the player body.
- **Bottom band:** a 56px dock: the clock, then the now-playing chip or, on setup screens, Cancel and the primary
  action.

Spacing rhythm is 8px between list rows, 14px between bands and in action rows, 16px between larger groups. Persistent
and interactive UI is bottom-anchored or left-aligned. bridgething toasts occupy a 300x280px top-right zone
(`--spacing-toast-safe-*`), and the physical dial occludes part of the top-right corner, so nothing that has to be
pressed or read sits there; receipts, toasts and hints go top-left.

## Elevation & Depth

A hybrid: tonal layering does most of the work (Control Black under Panel Graphite with Edge Steel borders), and soft
dark shadows lift the few elements meant to feel physical: the primary button (a blue glow), rows, album art, receipts
and toasts. Full-screen overlays stack by z-index: now-playing 30, dimmed clock 40, receipt and toast 50.

### Shadow Vocabulary

- **Art lift** (`box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35)`): large album art.
- **Row rest** (`box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2)`): issue and ledger rows.
- **Primary glow** (`box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent) 45%, transparent)`): the primary button.
- **Float** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4)`): the receipt and in-app toasts.

## Shapes

Generously rounded, never sharp, scaled with the element: 6px for keycaps, 8px for preset tabs and small art, 12px for
rows, toasts and the dial-focused duration, 14px for buttons, the dock and the receipt, 18px for large art, full pills
for chips and toggles. Preset and status tabs are square on top and rounded on the bottom so they read as the button's
material continuing into the screen.

## Components

### Buttons

Chunky and tactile.

- **Shape:** softly rounded (14px), full-width or equal `flex: 1` splits, 16px padding, 20px/700 text.
- **Primary:** solid Focus Blue with white text and a blue glow.
- **Secondary:** Panel Graphite with an Edge Steel border.
- **Danger:** Stop Red text on a 14% red tint with a 45% red border. While an M tap waits out the daemon's go-home
  window, Focus Running's End button reads "Ending…" in Off-White and fills left to right with 28% red over 1.5s (red text on that
  fill would drop under 3:1).
- **Press:** every button scales to 0.96 and dims to 90% brightness on `:active` (100ms). Disabled drops to 50% opacity.
- **Focus:** a tapped button gives up focus once its click is handled, and Enter/Space never activate a focused
  button: those keys are the dial press, and the screen decides what it does.

### Status Tabs

The signature control on Home: presets 1 to 3 as on-screen tabs, each tinted 22% with its status color. The current
status is lit solid in its color with Control Black text. Tab 4 is "Log time" in plain graphite. Tapping a tab does what
its physical button does.

### Preset Tabs

The on-screen twin of each physical preset elsewhere: four equal columns, 3px gaps, Panel Graphite,
square-top/rounded-bottom (8px), 16px/800 labels or 24px glyphs. A physical press flashes the tab (`scale(0.93)`,
`brightness(1.3)`).

### Focus Running

Home's reading carried into the session, left-aligned like Home. The issue heads the screen at 26px/800 (blue key,
Off-White summary, one line that pans when long; "No issue — just a timer" in Muted Slate when there is none). Under it
the 104px countdown (elapsed, counting up, for an unlimited session), then one 20px/700 Muted Slate meta line, always one
line tall so pausing never shifts the buttons: "Paused" in Off-White while paused, "+6m so far" while the session will
log, and "Today 5h 21m", today's total as if this session were already logged, so the receipt on Home lands on the same
number. Time under a minute counts toward neither, since it posts nothing. The meta sits under the clock, not beside it:
an hour-long countdown would push it into the toast corner. A full-width progress bar, then Pause/Resume with a Back
keycap and the End button with an M keycap, labelled with what it does: "End & log 6m", "End · nothing to log" under a
minute, or plain "End" when nothing goes to Jira. The dock matches Home's: wall clock, then the now-playing chip.

### Today Total and Ledger

Home's reading. The total is 72px/800 Off-White, with "logged today" beside it; it
counts up and glows Go Green for 1.4s when time lands. Under the meta lines, a 16px/700 Muted Slate sync
line with a 16px refresh glyph says how fresh the ledger is ("Synced 4 min ago") and syncs on tap, with an overhang
to a 44px target; the glyph spins while syncing, and a failure turns the line Busy Red ("Couldn't sync, tap to
retry"). Below it, the ledger lists every worklog from today as list rows
with a leading × hint, scrolling past what fits. Tapping a row, or a dial press on the dial-selected row, expands it in
place into a red-bordered "Delete from Jira?" confirm with full-width Cancel and Delete. With nothing logged, the ledger becomes
the tuner (below). The ledger matches the tracker: worklogs from other devices and apps appear in
it, sorted by start time, and ones deleted elsewhere drop out.

### Tuner

Home's empty ledger, a radio-style tuning strip for the first focus. A 20px/700 Off-White "Nothing logged yet today"
with a 16px/600 Muted Slate hint beside it, then the readout: the dial's target, so a Focus Blue border and 15% tint,
"25" at 34px/800 tabular with "min" at 20px/700 in 72% Off-White, and a 3px blue stem down into the window. The window
is a 76px Panel Graphite strip with an Edge Steel border whose ends fade out; the scale slides behind a fixed 3px Focus
Blue needle at its centre that stops above the numbers. Ticks hang from the top every 5 minutes (14px, slate at 45%),
every 15 minutes taller (24px, Muted Slate) with a 16px/700 number under them, and the number under the needle turns
Off-White. One dial detent is one tick: the scale glides on a 260ms expo-out and the needle catches with a short
squash. A drag moves the scale with the finger, a tap on a number jumps to it, and the dial press or a tap on the
readout opens Focus Setup at that length. Range 5 to 120 minutes; motion drops under reduced motion.

### Pull to Refresh

Home's ledger and the setup screens' issue list refresh on a downward pull that starts with the list at its top. The
column follows at half the finger's speed (up to 88px) and uncovers a centred 16px/700 Muted Slate strip with a 18px
refresh glyph that turns with the pull: "Pull to refresh", then "Release to refresh" at 56px, then a spinning
"Refreshing…" for at least 450ms. It springs back on a 220ms expo-out (none under reduced motion), and the column is
clipped at its bottom edge so it never slides over the band below. A pull never also taps the row it started on.

### Lists (Issue and Ledger Rows)

- **Corner Style:** 12px.
- **Background:** Panel Graphite with Edge Steel border and row-rest shadow; min height 52px.
- **Content:** a bold Focus Blue issue key, then a Muted Slate one-line summary at 500; ledger rows end with a tabular
  duration. Focus Running's headline uses the same blue key.
- **Selected:** Focus Blue border, 15% blue tint.
- **Dial inset:** rows run full width as the tap target, but their content stops 36px from the right edge
  (`--spacing-dial-inset`), clear of the dial's rim, which reaches about 46px into the screen around the first rows.
- **Recent:** an issue kept from history because the query no longer returns it ends with a 16px/700 Muted Slate
  "Recent".

### Setup Sentence

Focus Setup and Log Time open with one 26px/800 line that names what the primary action will do: "Focus for 25 min on
DESK-2", "Log 20 min to DESK-2", "Focus with no limit and no issue". The issue key is Focus Blue, as in the list; a
Muted Slate "an issue" holds its place while the list loads. The minutes sit in a 12px box that is invisible at rest and
becomes the dial-target box (blue border, 15% tint) when the dial is on it, so the line never shifts. While the dial is
on the minutes, a short Muted Slate "Press when done" follows.

Under it, Home's reading carries on in the Focus Running meta style (20px/700 Muted Slate): "Today 2h 50m → 3h 15m",
with only the after-total in Off-White because that is the number the receipt will land on. Focus Setup's Unlimited toggle rides at the end of
this line as a chip-sized pill, not on the sentence, so a long issue key never pushes it toward the dial's corner.

The bottom band is the dock: Home's wall clock in its usual spot, then Cancel (with a Back keycap) and the primary
action at twice its width, both 56px tall.

### Chips

- **Style:** pill, Panel Graphite, Edge Steel border, 16px/600 Muted Slate, +0.04em. The chip draws at 38px, and an
  invisible overhang into the surrounding gaps makes the touch target 44px.
- **State:** selected takes a Focus Blue border, 20% blue tint and Off-White text.

### Receipt

The proof a worklog landed, top-left with the toast's width cap. A 16% Go Green tint with a 45% green border, 14px
corners, float shadow, and a 260ms rise on an expo-out curve. A green check badge, the amount at 26px/800, "logged to
KEY", the one-line summary and "Today 3h 10m" in 72% Off-White, and an Undo button with a "Back" keycap. A 3px line along
the bottom drains over the 8s undo window and pauses while an undo is in flight. With a Done status set, a "→ Done"
button sits beside Undo and reads "Done ✓" once the issue has moved.

### Keycaps

Name the physical button that does the same thing as the control they sit in: 13px/800 text, 6px corners, a border at
40% of the text color, 80% opacity, inheriting the host's color ("Back" on Undo and Pause, "M" on End).

### Dock and Now-Playing Chip

A 56px bottom band: the dock clock (26px/800) and a flexible now-playing chip (40px art, title 16px/800, artist 16px/600 Muted
Slate, equalizer bars in Go Green that bounce while playing). The bars animate `scaleY`, never `height`, so the endless
loop costs no layout; under reduced motion they hold still at uneven heights, so playing still reads apart from paused.

### Dimmed Clock

After 3 idle minutes on Home: Control Black, the clock in Muted Slate, and the current track while one is playing.
Nothing else, status included. The face is a setting (`clockFace`), and every face stays monochrome slate, with
secondary parts at 70% slate (about 3.4:1, clear of the large-text bar):

- **Digital:** the 104px Display clock.
- **Analog:** a 360px dial of 60 ticks, no numerals and no ring; hour ticks and both round-capped hands in slate, minute
  ticks at 35%. No second hand: the screensaver should sit still.
- **Words:** the time to the nearest five minutes, "twenty to" at 52px/700 over the hour at 120px/800; "noon" and
  "midnight" replace twelve o'clock.
- **Stacked:** two-digit hours over minutes at 184px/800, line-height 0.86, -0.04em, minutes at 70%.

`clockFormat` (12h or 24h) applies to every wall-clock time: the dock clock, "Synced at", and the faces. 24h pads
the hour ("09:41").

### Now-Playing Player

The one expressive surface: a full-screen wash built from radial gradients of the artwork's tint (`--art-tint`,
animated over 600ms), with panels and edges switched to translucent black and white so the wash shows through. The
progress fill turns Off-White here because blue fights most artwork. The tint is darkened by relative luminance, not
HSL lightness, until the 78% Off-White secondary text holds 4.5:1 on it: yellow at 55% lightness is far brighter than
blue at 55%. Bright yellow, green and cyan art therefore wash deeper; blue, red and purple keep their tint. The
scrubber's input overhangs the 28px bar by 8px each way for a 44px touch target, and a cancelled drag drops the seek.

Laid out like Home. The presets stay transport on every view: previous, play/pause, next, like (Go Green tint
while saved).

- **Art:** 232px, top-left, its bottom edge level with the scrubber.
- **Track reading:** beside the art, out to the right edge: the 34px title, then two lines that open lists, each
  with a small chevron and an invisible overhang to a 44px target. The artist (20px/500) opens their top tracks; the
  source line (16px/600: the playing context, "Deep Work", or the album, led by "Paused ·" in Off-White while
  paused) opens the queue. This is the one place reading text runs into the toast corner, by choice: toasts pass in
  about 5s and don't block taps, and the dial covers roughly the tab row above the title.
- **Lyrics:** a 72px band under the art, for tracks with timed lyrics only. The line being sung at 26px/800, and
  the next one under it at 20px/600 in 78% Off-White. Each new line rises 10px into place over 260ms on an
  expo-out curve (a fade under reduced motion); an instrumental gap shows a music glyph. A "Lyrics" toggle in the
  dock, lit Off-White while on, hides and shows the band; the choice is saved on the device. With lyrics off, or a
  track with none (untimed lyrics count as none, having nothing to follow), the band and the toggle are gone and
  the art and track reading center in the room.
- **Dial:** seeks 10s per detent; dial press toggles play/pause; Back closes.
- **Queue and artist lists:** open in place of the player body, keeping the wash, the tabs and the dock. A 26px/800
  heading (the context name, or the artist) with a 20px/700 meta, then 60px rows: 44px art, title 16px/800,
  artists 16px/600, one line each, and a ⋯ button. They work like Spotify's own track lists:
  - **Tap a row** to play it within that playlist, album or artist (returning to the player); the dial walks the
    rows and a press does the same.
  - **Add to queue** by swiping a row right (it slides off a green box that goes solid past 72px, and snaps back
    short of it), from the row's ⋯ menu, or by holding the dial press, the long-press. The ⋯ menu opens in place
    at row height with Add to queue and Go to artist; the dial walks it and Back closes it before leaving the
    list. The row confirms with a Go Green "Added to queue" pill for 2s.
  - **The queue view** lays Spotify's queue over the whole playlist (browsed from the phone up to 500 tracks):
    what's been played, then 16px/700 group labels "Now playing", "Next in queue" (tracks added by hand, in the
    order added; they play before the playlist resumes) and "Next from: Chill Mix". It opens scrolled to the
    playing row with its label and a sliver above in view; the meta reads "14 of 50 · 2 in queue". Tapping a queued
    track jumps to it. Without a context to browse it shows just the queue.
  - The phone's queue order is the truth but its queued flag isn't (tracks added from here can come back
    unflagged), and it pushes no snapshot for a queue change. So Deskbar shows an added track at once, reads the
    queue back, and keeps its own record of what it added: a track stays under "Next in queue" until it plays, and
    only that one leaves, since jumping past queued tracks keeps them queued, as in the app.
  - Spotify's remove, clear and reorder have no SDK commands, so they aren't here. There's no Play next either: the
    app doesn't have one, and the SDK's queue position is ignored by the phone.
  - The row playing carries the Go Green equalizer. Covers load only around the visible rows. Back, or the
    dock's "Now playing" button, returns to the player. Loading, failure and emptiness take the dashed box.
- **Dock:** the wall clock, then the focus timer pill while a session runs or "Today 2h 50m" (Off-White value)
  when Jira is set up, then at the right the Lyrics toggle (on the player, for a track with lyrics) and Close (or
  "Now playing" from a list) with a "Back" keycap.

### Toasts

Top-left, width-capped clear of the toast safe zone, 12px corners, 16px/600 text, float shadow, 200ms fade-in. Success
and error take a 22% green or red tint with a 45% border; info (nothing went wrong, nothing was logged) is plain
graphite with a steel edge.

## Do's and Don'ts

### Do:

- **Do** make today's logged time the largest reading on Home.
- **Do** mirror every physical preset with a flush top tab and flash it on press.
- **Do** give every primary action a physical path, and name it with a keycap when it isn't the obvious one.
- **Do** mark the dial's current target in Focus Blue (border plus tint).
- **Do** keep persistent and interactive UI in the bottom band or on the left side.
- **Do** use tabular numerals for every time value.
- **Do** give every button the 0.96 press-shrink.
- **Do** honor `prefers-reduced-motion`: the receipt rise, its drain line, the M fill, the count-up, the text pan and the
  equalizer stop; screen, dimmed-clock and toast entrances fade without the rise.

### Don't:

- **Don't** place anything in the top-right corner that has to be pressed or read; the dial and bridgething's toasts own
  it. The now-playing player's track reading is the one deliberate exception.
- **Don't** put white text on a solid Go Green, Stop Red or Focus Blue fill.
- **Don't** use Go Green, Stop Red or Focus Blue for anything that doesn't carry their meaning.
- **Don't** wrap titles or issue summaries; a wrap pushes actions into the dock.
- **Don't** add a light theme or responsive breakpoints; the screen is fixed dark 800x480.
- **Don't** use translucent edge colors outside the now-playing player and the receipt.
