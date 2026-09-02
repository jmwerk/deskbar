# deskbar

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
