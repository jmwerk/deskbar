# deskbar

## 0.8.0

Logging time, from a focus session or Log Time Now, now shows a receipt with what was logged, where, and today's new total, plus 8 seconds to undo it by touch or with Back. Today's total counts up as the time lands. Today always matches what Jira received: sessions under a minute log nothing instead of a phantom 1m. The issue list preselects the issue you last logged to and puts "No issue" last, so the dial no longer skips the first row. Log Time Now queues the worklog to retry when Jira is unreachable, and the -15m preset can no longer end a running session.

Home now leads with the time you've logged today, when you last logged, and every worklog from today, each deletable in place, so the separate Today screen is gone. Status moved into the preset tabs along the top, where the current one lights up.

Focus Setup and Log Time Now open with one line that says what you're about to do, like "Focus for 25 min on DESK-2", in place of a heading and two labels. Under it, today's total shows what it will become once the time is logged, and the clock stays in its spot at the bottom left, as on Home. Log Time Now starts at the time since you last logged today, the same gap Home calls unlogged, instead of the default focus length.

Deskbar now ships its own typeface, Inter, because the Car Thing only has an Arial clone with regular and bold, so the screen finally shows the weights it was designed with. Nothing reads smaller than 16px apart from button keycaps, and muted text is a step heavier so it holds up on black.

The main paths no longer need the touchscreen. A single tap of M ends a focus session; holding M or pressing it five times still goes home without ending it. On Focus Setup and Log Time Now, turning the dial up past the first issue moves it to the duration, and pressing it hands it back. On Home the dial picks a worklog and pressing twice deletes it.

Error messages now say what failed, like "Couldn't log time to DESK-2: Jira returned HTTP 403". The Delete button in the ledger is readable on its red fill, scrolling lists show a slim dark scrollbar, and progress bars move more smoothly.

Focus Running now reads like Home. The issue you're logging to heads the screen, the countdown sits under it, and one line shows what the session has earned so far and today's total as if it were already logged, so the receipt lands on the number you were watching. The end button says what it will do, like "End & log 6m", and both Pause and End show the physical button that does the same thing. The dock shows the clock, as on Home.

The idle clock comes in four faces, picked in settings: digital, analog hands, the time in words ("twenty to ten"), or hours stacked over minutes. A clock format setting switches every clock in the app between 12h and 24h.

Pressing the dial no longer also presses whichever button you last tapped, which could reopen the player or resume a paused session. Album art in bright yellows, greens and cyans now washes the player a shade deeper so its text stays readable. The project chips and the seek bar are easier to hit, and Deskbar loads faster: it now runs on Preact, cutting the app's code by more than half.

## 0.7.1

A long Jira issue summary no longer pushes the focus timer's buttons into the now-playing bar. The issue now stays on one line and scrolls when it's too long to fit.

## 0.7.0

The focus timer now has the now-playing widget along the bottom: tap it for the full-screen player, which shows the focus timer beside Back, or press the dial to play/pause without leaving the timer. Tap the clock in Home's dock to show the screensaver right away. The screensaver only shows the current track while it's playing.

## 0.6.0

Added a bottom dock to Home with a clock, a now-playing widget for the phone's Spotify (tap it for a full-screen player: presets 1-4 are previous, play/pause, next and like, the dial seeks, dial press plays/pauses, Back closes), and today's logged time. The idle screensaver also shows the current track.

The now-playing dock and player were inspired by [gyeonggi](https://github.com/espeon/gyeonggi) by Natalie Bridgers.

## 0.5.1

Update dependencies (React 19.3, Vite 8.3, ESLint 10.11 and tooling)

## 0.5.0

Migrated to the `@bridgething/source` monorepo layout, `@bridgething/client` 0.12.1, React 19,
and push-to-main auto-publish. Rewrote the CSS as a Tailwind v4 design-token system (same DOM and
safe-zone layout throughout, so nothing on screen actually moved) and added a real settings
webapp backed by the existing config fields, replacing the phone app's auto-generated form as the
primary way to edit settings.

## 0.4.0

Fixed dial routing on Focus Setup when Jira isn't configured, let a running countdown be
extended/shortened from the physical presets, clamped active-elapsed time to 0 to fix a
one-second countdown glitch, and added a script to regenerate catalog screenshots automatically.

## 0.3.0

Added an idle screensaver clock (with a timezone override), Slack/Teams focus-webhook payload
formats, pause/resume for a running focus session (instead of only ending it), a retry queue for
worklogs that fail to log at session end, and `HARDWARE.md` as the canonical confirmed-vs-guessed
hardware reference. Added project-key filter chips to the issue picker and an increment-stepper
duration UI with an unlimited mode.

## 0.2.1

Fixed `catalog.json` to match bridgething's real schema.

## 0.2.0

Added Log Time Now and a Today history view, with delete support that also removes the worklog
from Jira. Wired up the Car Thing's physical presets, dial, and Back button. Added Vitest with
mock fault injection, ESLint/Prettier, and CI.

## 0.1.1

First release: status display, a focus timer, and Jira worklog time tracking.
