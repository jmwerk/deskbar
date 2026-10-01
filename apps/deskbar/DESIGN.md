---
name: Deskbar
description: Today's logged Jira time, a focus timer, and busy/available/focus status on an 800x480 Car Thing.
colors:
  control-black: "#0b0d10"
  panel-graphite: "#16191d"
  edge-steel: "#262b31"
  off-white: "#f5f6f7"
  muted-slate: "#8a9099"
  focus-blue: "#3b82f6"
  go-green: "#2ecc71"
  stop-red: "#e74c3c"
typography:
  display:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "104px"
    fontWeight: 800
    lineHeight: 1
    fontFeature: "tnum"
  total:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "72px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  headline:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "26px"
    fontWeight: 800
  body:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.35
  label:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 800
  eyebrow:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    letterSpacing: "0.08em"
  keycap:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 800
    letterSpacing: "0.04em"
rounded:
  keycap: "6px"
  tab: "8px"
  row: "12px"
  control: "14px"
  art: "18px"
  pill: "999px"
spacing:
  xs: "8px"
  sm: "14px"
  md: "16px"
  screen-y: "20px"
  screen-x: "28px"
components:
  button-primary:
    backgroundColor: "{colors.focus-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.control}"
    padding: "16px"
  button-secondary:
    backgroundColor: "{colors.panel-graphite}"
    textColor: "{colors.off-white}"
    rounded: "{rounded.control}"
    padding: "16px"
  button-danger:
    textColor: "{colors.stop-red}"
    rounded: "{rounded.control}"
    padding: "16px"
  status-tab:
    backgroundColor: "{colors.panel-graphite}"
    textColor: "{colors.off-white}"
    typography: "{typography.label}"
    padding: "9px 4px"
  status-tab-lit-available:
    backgroundColor: "{colors.go-green}"
    textColor: "{colors.control-black}"
    typography: "{typography.label}"
  status-tab-lit-busy:
    backgroundColor: "{colors.stop-red}"
    textColor: "{colors.control-black}"
    typography: "{typography.label}"
  status-tab-lit-focus:
    backgroundColor: "{colors.focus-blue}"
    textColor: "{colors.control-black}"
    typography: "{typography.label}"
  preset-tab:
    backgroundColor: "{colors.panel-graphite}"
    textColor: "{colors.off-white}"
    typography: "{typography.label}"
    padding: "9px 4px"
  today-total:
    textColor: "{colors.off-white}"
    typography: "{typography.total}"
  list-row:
    backgroundColor: "{colors.panel-graphite}"
    rounded: "{rounded.row}"
    padding: "12px 14px"
    height: "52px"
  filter-chip:
    backgroundColor: "{colors.panel-graphite}"
    textColor: "{colors.muted-slate}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  receipt:
    textColor: "{colors.off-white}"
    rounded: "{rounded.control}"
    padding: "14px 16px 0"
  keycap:
    typography: "{typography.keycap}"
    rounded: "{rounded.keycap}"
    padding: "2px 7px"
  now-playing-chip:
    backgroundColor: "{colors.panel-graphite}"
    rounded: "{rounded.control}"
    padding: "7px 16px 7px 7px"
    height: "56px"
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
- **Stop Red** (`stop-red`): the Busy status, destructive actions (End Focus, Delete), the End Focus fill while an M tap
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
tint, the same box on issue rows, ledger rows and the duration.

**The Dark-On-Lamp Rule.** Text on a solid signal fill is Control Black. White on Go Green is about 2:1, and white on the
red and blue fills sits under 4:1.

## Typography

**Body Font:** System sans (`-apple-system, 'Segoe UI', Roboto, sans-serif`)

**Character:** One neutral system face pushed to heavy weights (700 to 800) so it reads at arm's length on a 235ppi
panel. Hierarchy comes from size and weight, not from font pairing.

### Hierarchy
- **Display** (800, 104px, line-height 1): the focus countdown. The dimmed clock uses 96px in Muted Slate.
- **Total** (800, 72px, line-height 1, -0.02em): today's logged total on Home.
- **Headline** (800, 34px, 1.15): the now-playing track title.
- **Title** (800, 26px): screen headings, the dock clock, the receipt's logged amount.
- **Body** (400 to 700, 17 to 20px): list rows (19px issue rows, 17px ledger rows), action buttons (20px, 700), hints
  and the today total's meta line (18 to 20px).
- **Label** (800, 16px): preset and status tab labels.
- **Eyebrow** (700, 16px, 0.08em, uppercase): "FOCUS SESSION", "NOW PLAYING".
- **Keycap** (800, 12px, 0.04em): the "Back" and "M" keycaps.
- Small metadata (13 to 15px, 600): artist in the dock chip, scrubber times, chips, the receipt summary.

### Named Rules
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
- **Bottom band:** a 56px dock (clock, now-playing chip) or a row of equal-width actions.

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
  window, End Focus reads "Ending…" and fills left to right with 28% red over 1.5s.
- **Press:** every button scales to 0.96 and dims to 90% brightness on `:active` (100ms). Disabled drops to 50% opacity.

### Status Tabs
The signature control on Home: presets 1 to 3 as on-screen tabs, each tinted 22% with its status color. The current
status is lit solid in its color with Control Black text. Tab 4 is "Log time" in plain graphite. Tapping a tab does what
its physical button does.

### Preset Tabs
The on-screen twin of each physical preset elsewhere: four equal columns, 3px gaps, Panel Graphite,
square-top/rounded-bottom (8px), 16px/800 labels or 24px glyphs. A physical press flashes the tab (`scale(0.93)`,
`brightness(1.3)`).

### Today Total and Ledger
Home's reading. The total is 72px/800 Off-White, with "logged today" and "unlogged since 2:07 PM" stacked beside it; it
counts up and glows Go Green for 1.4s when time lands. Below it, the ledger lists every worklog from today as list rows
with a leading × hint, scrolling past what fits. Tapping a row, or a dial press on the dial-selected row, expands it in
place into a red-bordered "Delete from Jira?" confirm with full-width Cancel and Delete. With nothing logged, a dashed
graphite box says what to press next.

### Lists (Issue and Ledger Rows)
- **Corner Style:** 12px.
- **Background:** Panel Graphite with Edge Steel border and row-rest shadow; min height 52px.
- **Content:** a bold Focus Blue issue key, then a Muted Slate one-line summary; ledger rows end with a tabular duration.
- **Selected:** Focus Blue border, 15% blue tint.

### Duration
The duration value sits in a 12px box that is invisible at rest and becomes the dial-target box (blue border, 15% tint)
when the dial is on it, so the row never shifts. A short Muted Slate hint beside it says how to hand the dial back.

### Chips
- **Style:** pill, Panel Graphite, Edge Steel border, 14px/600 Muted Slate.
- **State:** selected takes a Focus Blue border, 20% blue tint and Off-White text.

### Receipt
The proof a worklog landed, top-left with the toast's width cap. A 16% Go Green tint with a 45% green border, 14px
corners, float shadow, and a 260ms rise on an expo-out curve. A green check badge, the amount at 26px/800, "logged to
KEY", the one-line summary and "Today 3h 10m" in 72% Off-White, and an Undo button with a "Back" keycap. A 3px line along
the bottom drains over the 8s undo window and pauses while an undo is in flight.

### Keycaps
Name the physical button that does the same thing as the control they sit in: 12px/800 text, 6px corners, a border at
40% of the text color, 80% opacity, inheriting the host's color ("Back" on Undo, "M" on End Focus).

### Dock and Now-Playing Chip
A 56px bottom band: the dock clock (26px/800) and a flexible now-playing chip (40px art, title 16px/700, artist 13px,
equalizer bars in Go Green that bounce while playing).

### Dimmed Clock
After 3 idle minutes on Home: Control Black, a 6px top edge in the current status color at 70%, a 96px Muted Slate
clock, today's total at 24px/700, and the current track while one is playing.

### Now-Playing Player
The one expressive surface: a full-screen wash built from radial gradients of the artwork's tint (`--art-tint`,
animated over 600ms), with panels and edges switched to translucent black and white so the wash shows through. The
progress fill turns Off-White here because blue fights most artwork.

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
- **Do** honor `prefers-reduced-motion`: the receipt rise, its drain line, the M fill, the count-up and the text pan.

### Don't:
- **Don't** place anything in the top-right corner that has to be pressed or read; the dial and bridgething's toasts own
  it.
- **Don't** put white text on a solid Go Green, Stop Red or Focus Blue fill.
- **Don't** use Go Green, Stop Red or Focus Blue for anything that doesn't carry their meaning.
- **Don't** wrap titles or issue summaries; a wrap pushes actions into the dock.
- **Don't** add a light theme or responsive breakpoints; the screen is fixed dark 800x480.
- **Don't** use translucent edge colors outside the now-playing player and the receipt.
