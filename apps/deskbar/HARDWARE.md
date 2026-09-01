# Hardware notes

What's confirmed about the Car Thing versus what's inferred or guessed,
all in one place, so it doesn't only live in code comments and git
history. Wherever something's confirmed, the note says how: on real
hardware, or by reading bridgething's own source, rather than just
asserting it.

## Display

- 800×480 touch LCD, ~235ppi (3.97" diagonal): confirmed, this is the
  panel bridgething documents and targets.
- About 2.4x denser than a typical desktop monitor. Sizes that read fine
  on a laptop (14-16px body text, 44px touch targets) show up as fine
  print and unreliable tap targets here, so `styles.css` scales
  everything up accordingly instead of using desktop-web defaults.
- Desktop-browser testing (`npm run dev`/`dev:mock`) will always look
  oversized next to how the UI reads on-device, for the same reason.

## Physical controls

Confirmed by reading bridgething's own source
(`packages/create-bridgething/template/CLAUDE.md` and
`.../reference/develop.md`, via `gh api`): `@bridgething/client`'s
`hardware` surface only covers display-backlight control. Every physical
input reaches the webapp as a plain browser event, not through the SDK:

| Control     | Event                                 | Confirmed how                                               |
| ----------- | ------------------------------------- | ----------------------------------------------------------- |
| Preset 1-4  | `keydown` key `"1"`-`"4"`             | bridgething source (develop.md)                             |
| Mode        | `keydown` key `"m"`                   | bridgething source (develop.md)                             |
| Back        | `keydown` key `"Escape"`              | bridgething source (develop.md)                             |
| Rotary dial | `wheel`, horizontal `deltaX`          | bridgething source (develop.md)                             |
| Dial push   | `keydown` key `"Enter"` **and** `" "` | **real hardware**: both fire; not documented by bridgething |
| Touch       | normal pointer/touch events           | bridgething source (develop.md)                             |

**Dial push-button**: bridgething's own docs only describe the dial as
rotate-only. There's no press/click event anywhere in its docs or the
daemon's Rust source. But the Car Thing hardware itself (which predates
bridgething) does have a clickable dial, per hands-on confirmation and
community reverse-engineering docs
(`err4o4/spotify-car-thing-reverse-engineering` issue #23,
superbird-tool), mapped to either `Space` or `Enter` at the input-driver
level. Tested directly on-device: **both fire**. Deskbar binds both
(`useKeydown` handlers checking `e.key === 'Enter' || e.key === ' '`)
rather than picking one.

**"m" is never free to bind.** Confirmed by reading the daemon's own
source (`crates/core/src/input/evdev_listener.rs`): a separate low-level
listener watches raw `KEY_M` across whatever webapp is active, and on 5
presses within 1500ms it forces the kiosk back to the launcher
(`trigger_hub_switch`). A single "m" keydown still reaches the active
webapp's handler first, though. Deskbar briefly bound "m" to Start Focus
early on, which meant the _first_ press of a user's go-home gesture also
kicked off an unwanted focus session, fixed by leaving "m" completely
unbound. Don't rebind it to something "safer"; just leave it alone.

Wheel events from the dial arrive as a burst of small deltas per
physical detent, not one clean tick. `useRotaryStep`
(`src/physicalControls.ts`) accumulates `deltaX` and fires a step once
the accumulated magnitude crosses 100, resetting after each step. That
threshold was tuned empirically, not derived from any spec.

Every `keydown` handler in Deskbar ignores `e.repeat` (see `useKeydown`).
Holding a preset down shouldn't repeat-fire whatever it's bound to.

**Preset buttons sit above the screen, not below, and are spaced evenly
across the full screen width.** Confirmed by the user, hands-on, across
two passes. The first version of Home's `.button-hint` legend (①-④) was
inset to match the screen's normal 20px/28px content padding, same as
everything else on Home, and the user reported it looked "slightly
misaligned" against the real buttons. Removing that inset, flush against
the screen's true edges (`margin: -20px -28px ...` cancels `.screen`'s
padding for this one element), with 4 even grid columns spanning the full
800px, fixed it. So the buttons themselves are edge-to-edge and evenly
spaced, not inset to match where the rest of the UI's content margin
sits. They're laid out as 4 fixed grid columns (not a centered flex row)
so labels 1-3 stay lined up under their buttons even when the 4th one's
blank (no Jira configured); a centered row would re-flow and drift out
of alignment instead. Each tab is also tinted to match the tile it
controls (Available/Busy/Focus), so it reads as the physical button's
own color continuing down into the screen rather than a separate
floating badge.

The same flush-edge treatment carries over to the Duration picker's
preset row (`PresetHint` in `DurationPicker.tsx`, used on Focus Setup
and Log Time Now), since those presets are bound to the same physical
buttons 1-4. Unlike Home's tabs, though, these have no per-status color
to borrow. A duration has no matching tile, so only the
currently-selected preset gets a tint (generic `--focus` blue) instead
of every tab having its own color.

## Screen occlusion / safe zones

Two different things occlude the top-right corner of the screen, and
they're not the same kind of constraint:

- **The physical rotary dial**: confirmed by the user, hands-on. The
  dial is mounted over the top-right corner and physically covers part
  of the screen. This is a **permanent physical obstruction**, not just
  a visual one; a control placed under it can be genuinely hard or
  impossible to press. The exact pixel extent hasn't been measured, so
  treat it as "the top-right corner, roughly the first row of controls."
  A large, full-width tap target holds up better here than a
  precisely-avoided corner, since the target then extends into safe
  territory too, regardless of exactly where the dial's edge falls (see
  `.history-row` in `styles.css`: the whole row is the tap target, and
  its "delete" hint icon sits at the row's _left_ end, not under the
  dial).
- **bridgething's own notification/pairing toast overlay**: confirmed by
  reading bridgething's source directly, in `crates/core/src/overlay`
  (`overlay.js` and `mod.rs`): `.toasts { position:absolute; top:8px;
right:8px; width:46%; max-width:300px; }`. Up to 3 toasts stack
  downward (each ~70-100px), each auto-dismissing after 5s. Worst case
  that's a ~300px-wide, ~280px-tall opaque box in the top-right corner,
  though most of the time it's just one ~90px-tall toast. This overlay
  is `pointer-events:none`, so it never blocks taps; it only visually
  covers whatever's underneath while a toast is showing. `styles.css`
  documents this as `--toast-safe-w`/`--toast-safe-h`.
- Everything else bridgething renders (call/connection banners, volume
  level, voice-turn indicator, Bluetooth pairing PIN modal) shows up
  top-center or bottom-center, not top-right.

**How to apply**: keep interactive controls out of the top-right corner
on every screen. For anything that has to span toward that side (a list
row, a wide control), favor one large tap target over a small one
precisely positioned to dodge the corner; a large target still has safe
room on it even if the exact obstruction boundary is off by a bit. The
dial is the stricter of the two constraints (it can make a tap fail
outright, not just be briefly obscured), so design for it first and the
toast overlay second.

## Open questions

Nothing physical-control-related is unconfirmed right now. If a future
screen ever needs to tell the dial push's `Enter` apart from its `" "`
(say, binding them to different actions), that would need on-device
confirmation of which one is "really" the dial and which is just a
coincidence of the input driver's key mapping. Right now Deskbar treats
them as interchangeable, and that's untested.
