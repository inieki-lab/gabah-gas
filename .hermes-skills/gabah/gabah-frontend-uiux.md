---
name: gabah-frontend-uiux
description: "GABAH frontend/UX engineering standard. React 19 + TS + Vite + Tailwind; design tokens; RBAC-aware UI; accessibility. Use when creating or changing React components, pages, forms, or navigation."
version: 1.0
category: software-development
created: "2026-11-10"
---

# GABAH Frontend UI/UX Standard

## Design tokens (single accent, no AI-blue/purple gradients)

| Token | Value | Role |
|---|---|---|
| Primary | `#4ABDAC` (teal) | Buttons, links, selected state |
| Secondary | `#206f65` (dark teal) | Text on primary |
| Accent | `#FC4A1A` (peach) | Alerts, warnings, empty-state icons |
| Slate | `#5b6770` / `#e6edf2` | Body text, surfaces |

- One main accent only. No gradients. Consistent spacing, typography, and color.
- Apply `antislop` (antislop-ui / antislop-human / antislop-layoutmobile) quality gates for every UI change. See the `antislop` skill.

## Accessibility (WCAG AA)

- Visible label on every control; `cursor-pointer` for clickable elements; hover/active/disabled states.
- Tap target ≥ 44×44 px (mobile); WCAG AA contrast ≥ 4.5:1 (≥ 3:1 for large text).
- Visible focus indicator; no horizontal overflow on mobile; keyboard-navigable (tab, Enter, Escape).
- Form validation: visible error message tied to `aria-describedby`; `aria-live` for dynamic updates.

## RBAC-aware UI

- Menu visibility is frontend-only; permissions are enforced by the backend. A hidden menu item must NOT be clickable or openable.
- The same role's controls must not hide a permission from the API. If a menu is visible, the endpoint is reachable (and must 403 if denied).
- Badges: status, priority, progress readable at a glance; use icon+label, never color-only.
- Empty/loading/error states shown for every data section (do not delete running features).
- Form layout simple: one primary action per screen, grouped fields, helpers under inputs.

## Navigation

- Left-nav grouped by role; each menu item ties to a `permission_key` (exposed in `/api/auth/me`).
- Active tab resets to the role's safe landing tab on role switch.
- No orphan menus: every visible menu item has an API endpoint and a working page.
