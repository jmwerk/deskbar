---
name: Deskbar
description: Busy/available/focus status, a focus timer, and Jira worklog time tracking on an 800x480 Car Thing.
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
  headline:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.15
  title:
    fontFamily: "-apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "28px"
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
rounded:
  tab: "8px"
  row: "12px"
  control: "14px"
  tile: "18px"
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
  tile-available:
    backgroundColor: "{colors.go-green}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.tile}"
  tile-busy:
    backgroundColor: "{colors.stop-red}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.tile}"
  tile-focus:
    backgroundColor: "{colors.focus-blue}"
    textColor: "#ffffff"
    typography: "{typography.title}"
    rounded: "{rounded.tile}"
  preset-tab:
    backgroundColor: "{colors.panel-graphite}"
    textColor: "{colors.off-white}"
    typography: "{typography.label}"
    padding: "9px 4px"
  issue-row:
    backgroundColor: "{colors.panel-graphite}"
    rounded: "{rounded.row}"
    padding: "12px 14px"
    height: "52px"
  filter-chip:
    backgroundColor: "{colors.panel-graphite}"
    textColor: "{colors.muted-slate}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
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
corner, a Back button. The design treats that hardware as part of the interface. The preset tabs hang from the top edge
as if the buttons' own material continued into the glass, presses on hardware flash their on-screen twins, and the dial's
current target is always lit in Focus Blue.

The surface is near-black and dense, with large, chunky, rounded controls that shrink under a finger. Color is signal:
the three status hues mean Available, Busy and Focus, and appear at full strength only where that meaning is the point.
Everything else is graphite panels, steel edges and slate text. The one place the instrument loosens up is the
now-playing player, which washes the whole screen in the album art's own color.

**Key Characteristics:**
- Dark-only, fixed 800x480, no responsive behavior.
- Chunky, finger-sized, rounded controls with a press-shrink response.
- Preset tabs flush to the top edge, mirroring the physical buttons above the screen.
- Status color carries meaning; the chrome is neutral.
- Bottom-anchored persistent UI; the top-right corner stays empty of interactive controls.
- System sans at heavy weights, tabular numerals for every time value.

## Colors

A neutral graphite instrument body with three saturated signal lamps.

### Primary
- **Focus Blue** (`focus-blue`): the Focus status, the primary action button, the dial's current target (selected issue
  row, focused duration value, selected filter chip), Jira issue keys, the progress fill, and the now-playing wash
  fallback when artwork has no tint.

### Secondary
- **Go Green** (`go-green`): the Available status, success toasts, the liked-track preset, and the now-playing equalizer
  bars.

### Tertiary
- **Stop Red** (`stop-red`): the Busy status, destructive actions (End Focus, Delete), error toasts and error hints.

### Neutral
- **Control Black** (`control-black`): the screen background and the screensaver.
- **Panel Graphite** (`panel-graphite`): every resting surface: preset tabs, rows, chips, secondary buttons, the dock.
- **Edge Steel** (`edge-steel`): 1px borders on panels. Opaque on purpose so it reads identically over black and graphite.
- **Off-White** (`off-white`): primary text.
- **Muted Slate** (`muted-slate`): secondary text, issue summaries, the paused clock, labels, the screensaver clock.

### Named Rules
**The Signal Lamp Rule.** Green, red and blue mean Available, Busy and Focus. Never use them decoratively; red also means
destructive or error, green also means success.

**The Tint, Don't Fill Rule.** Outside the status tiles and the primary button, a signal color appears as a tint mixed
into graphite (14 to 30%) with a 45% border, not as a solid fill.

**The Dial Points Blue Rule.** Whatever the dial will act on is marked in Focus Blue: border plus a 15 to 20% tint.

## Typography

**Body Font:** System sans (`-apple-system, 'Segoe UI', Roboto, sans-serif`)

**Character:** One neutral system face pushed to heavy weights (700 to 800) so it reads at arm's length on a 235ppi
panel. Hierarchy comes from size and weight, not from font pairing.

### Hierarchy
- **Display** (800, 104px, line-height 1): the focus countdown. Tabular numerals. The screensaver clock uses 96px in
  Muted Slate.
- **Headline** (800, 34px, 1.15): the now-playing track title.
- **Title** (700 to 800, 26 to 28px): status tiles, the status banner, screen headings, the dock clock.
- **Body** (400 to 700, 17 to 20px): issue rows (19px), history rows (17px), action buttons (20px, 700), hints (18px).
- **Label** (800, 16px): preset tab labels.
- **Eyebrow** (700, 16px, 0.08em, uppercase): "FOCUS SESSION", "NOW PLAYING".
- Small metadata (13 to 15px, 600): artist in the dock chip, scrubber times, chips.

### Named Rules
**The Tabular Time Rule.** Every clock, countdown, duration and scrubber time uses `font-variant-numeric: tabular-nums`
so digits never jitter.

**The One Line Rule.** Titles and summaries that may run long stay on one line: ellipsis in lists, a slow pan
(ScrollText) where the full text matters.

## Layout

A single fixed 800x480 viewport; nothing reflows. Each screen is a full-viewport flex column with 20px vertical and
28px horizontal padding and a 200ms fade-in.

- **Top band:** the 4-up preset tab strip cancels the screen padding (`margin: -20px -28px 14px`) to sit flush with the
  top, left and right edges, one column per physical preset.
- **Middle:** the flexible region (tile grid, issue list, countdown, player body).
- **Bottom band:** a 56px dock (clock, now-playing chip, today total) or a row of equal-width actions.

Spacing rhythm is 8px between list rows, 14px between bands and in action rows, 16px between tiles. Persistent and
interactive UI is bottom-anchored. bridgething toasts occupy a 300x280px top-right zone (`--spacing-toast-safe-*`), and
the physical dial occludes part of the top-right corner, so nothing interactive is absolutely positioned there; badges
and hints go top-left.

## Elevation & Depth

A hybrid: tonal layering does most of the work (Control Black under Panel Graphite with Edge Steel borders), and soft
dark shadows lift the few elements meant to feel physical: status tiles, the primary button (a blue glow), rows, album
art and toasts. Full-screen overlays stack by z-index: now-playing 30, screensaver 40, toast 50.

### Shadow Vocabulary
- **Tile lift** (`box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35)`): status tiles and large album art.
- **Row rest** (`box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2)`): issue and history rows.
- **Primary glow** (`box-shadow: 0 4px 12px color-mix(in srgb, var(--color-accent) 45%, transparent)`): the primary button.
- **Toast float** (`box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4)`): in-app toasts.
- **Selected inset** (`box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.55) inset, 0 6px 18px rgba(0, 0, 0, 0.35)`): the
  active status tile.

## Shapes

Generously rounded, never sharp, scaled with the element: 8px for preset tabs and small art, 12px for rows and toasts,
14px for buttons, the dock and banners, 18px for tiles and large art, full pills for chips and toggles. Preset tabs are
square on top and rounded on the bottom so they read as the button's material continuing into the screen.

## Components

### Buttons
Chunky and tactile.
- **Shape:** softly rounded (14px), full-width or equal `flex: 1` splits, 16px padding, 20px/700 text.
- **Primary:** solid Focus Blue with white text and a blue glow.
- **Secondary:** Panel Graphite with an Edge Steel border.
- **Danger:** Stop Red text on a 14% red tint with a 45% red border.
- **Press:** every button scales to 0.96 and dims to 90% brightness on `:active` (100ms). Disabled drops to 50% opacity.

### Status Tiles
The signature control on Home: three equal tiles in a grid, solid status color, 28px/800 white label above a glyph, 18px
corners, tile-lift shadow. The selected tile adds a 4px white inset ring and a white check badge in its top-left corner.

### Preset Tabs
The on-screen twin of each physical preset: four equal columns, 3px gaps, Panel Graphite, square-top/rounded-bottom
(8px), 16px/800 labels or 24px glyphs. A physical press flashes the tab (`scale(0.93)`, `brightness(1.3)`). On Home the
status tabs are tinted 30% with their status color.

### Chips
- **Style:** pill, Panel Graphite, Edge Steel border, 14px/600 Muted Slate.
- **State:** selected takes a Focus Blue border, 20% blue tint and Off-White text.

### Lists (Issue and History Rows)
- **Corner Style:** 12px.
- **Background:** Panel Graphite with Edge Steel border and row-rest shadow; min height 52px.
- **Content:** a bold Focus Blue issue key, then a Muted Slate one-line summary; history rows end with a tabular duration.
- **Selected:** Focus Blue border, 15% blue tint.
- **Confirm state:** a history row expands in place into a red-bordered confirm with full-width Cancel and Delete.

### Dock and Now-Playing Chip
A 56px bottom band: the dock clock (26px/800), a flexible now-playing chip (40px art, title 16px/700, artist 13px,
equalizer bars in Go Green that bounce while playing), and a Today total pill.

### Now-Playing Player
The one expressive surface: a full-screen wash built from radial gradients of the artwork's tint (`--art-tint`,
animated over 600ms), with panels and edges switched to translucent black and white so the wash shows through. The
progress fill turns Off-White here because blue fights most artwork.

### Toasts
Top-left, width-capped clear of the toast safe zone, 12px corners, 16px/600 text, a 22% green or red tint with a 45%
border, toast-float shadow, 200ms fade-in.

## Do's and Don'ts

### Do:
- **Do** mirror every physical preset with a flush top tab and flash it on press.
- **Do** mark the dial's current target in Focus Blue (border plus tint).
- **Do** keep persistent and interactive UI in the bottom band or the left side.
- **Do** use tabular numerals for every time value.
- **Do** give every button the 0.96 press-shrink.
- **Do** honor `prefers-reduced-motion` for continuous motion such as the text pan.

### Don't:
- **Don't** place interactive controls in the top-right corner; the dial and bridgething's toasts own it.
- **Don't** use Go Green, Stop Red or Focus Blue for anything that doesn't carry their meaning.
- **Don't** wrap titles or issue summaries; a wrap pushes actions into the dock.
- **Don't** add a light theme or responsive breakpoints; the screen is fixed dark 800x480.
- **Don't** use translucent edge colors outside the now-playing player.
