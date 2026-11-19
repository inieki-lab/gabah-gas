# GABAH UI/UX Redesign — Design Specification

**Project:** GABAH — General Asset & Business Administration Hub
**Organization:** PT Food Station Tjipinang Jaya (Perseroda)
**Framework:** React 19 + Tailwind CSS v4 + Lucide React
**Date:** 2026-11-19
**Branch:** `feat/gabah-enterprise-theme-complete`
**Target:** `main` (via PR)

---

## 1. Design Objectives

This redesign transforms GABAH from a functional internal tool into a professional enterprise ERP dashboard. The goal is not superficial branding but a cohesive visual system that improves:

- **Scannability** — users can find data, actions, and status quickly.
- **Authority** — a clean, restrained interface signals a production enterprise application, not a prototype.
- **Usability** — consistent spacing, readable tables, clear form controls, and predictable navigation.
- **Accessibility** — sufficient contrast, visible focus states, keyboard support, and responsive behavior.

## 2. Design Principles

1. **Enterprise, not decorative.** No gradients, no excess shadows, no decorative cards. The interface is a working tool for business users.
2. **Dense but readable.** Use available screen width effectively. Avoid overly narrow centered content. Aim for high information density without sacrificing readability.
3. **Status semantics preserved.** Success = green, Warning = amber, Danger = red, Info/blue. Do not recolor status badges into green.
4. **Consistent spacing.** Use Tailwind's spacing scale (0.25rem increments) and a 4px baseline grid.
5. **Component reuse.** Reuse existing React/Tailwind components. Do not introduce a new UI library. Do not duplicate design systems.
6. **No breaking changes.** The redesign must not change RBAC, navigation permissions, API contracts, form validation, or business workflows.

## 3. Color Palette and Design Tokens

### 3.1 Primary Colors

| Token | Hex | Usage |
|---|---|---|
| `green-950` | `#123B2B` | High-contrast text, dark brands, footer |
| `green-900` | `#174D36` | Dark brand, hover dark states |
| `green-800` | `#176B45` | Primary action, active nav item, brand logo |
| `green-700` | `#218653` | Hover states, active icons |
| `green-600` | `#2D9B63` | Focus ring, accent, active states |
| `green-100` | `#E5F4EB` | Selected surface, active badge, subtle highlights |
| `green-50` | `#F1F8F3` | Soft background, calm sections |

### 3.2 Surfaces

| Token | Hex | Usage |
|---|---|---|
| `canvas` | `#F4F8F5` | Main workspace background |
| `surface` | `#FFFFFF` | Cards, forms, modals, sidebar |
| `border` | `#E1EBE4` | Lines, dividers, borders |

### 3.3 Text

| Token | Hex | Usage |
|---|---|---|
| `text-primary` | `#172B20` | Body text, headings |
| `text-secondary` | `#687B70` | Metadata, helper text, placeholders |

### 3.4 Semantic Status Colors (preserved)

| Token | Hex | Usage |
|---|---|---|
| `success` | `#176B45` (green-800) | Success state |
| `warning` | `#F7B733` (gold) | Warning / pending |
| `danger` | `#FC4A1A` (coral) | Error / urgent / destructive |
| `info` | `#2D9B63` (green-600) / blue | Information |

**Rule:** Do not convert every badge into green. Keep semantic distinction between status types.

## 4. Typography

**Font:** Plus Jakarta Sans (already referenced in `src/index.css`).

| Level | Class | Size |
|---|---|---|
| Page title | `text-xl sm:text-2xl font-bold tracking-tight` | 20–24px |
| Section title | `text-base sm:text-lg font-semibold` | 16–18px |
| Body | `text-xs sm:text-sm` | 14–16px |
| Metadata | `text-[10px] sm:text-[11px]` | 10–12px |
| Table cell (body) | `text-xs` | 14px |
| Table header | `text-xs font-semibold` | 14px |

**Rules:**
- Do not oversize headings.
- Do not leave excessive whitespace.
- Keep line-height at 1.5 for body text, 1.2 for headings.

## 5. Spacing and Sizing Standards

| Scale | Value | Usage |
|---|---|---|
| 0 | 0 | Border-radius 0, margins 0 |
| 0.5 | 0.125rem (2px) | Tight gaps |
| 1 | 0.25rem (4px) | Small gaps |
| 2 | 0.5rem (8px) | Section gaps, icon padding |
| 3 | 0.75rem (12px) | Card content padding |
| 4 | 1rem (16px) | Generic padding |
| 6 | 1.5rem (24px) | Section padding |
| 8 | 2rem (32px) | Page content padding |
| 10 | 2.5rem (40px) | Major section spacing |
| 12 | 3rem (48px) | Large section spacing, dialog padding |

**Rules:**
- Use 4px baseline multiples.
- Do not use arbitrary pixel values; use the scale or Tailwind utilities.
- Sidebar content padding: `p-3` (12px).
- Main content padding: `p-4 sm:p-6 lg:p-8`.

## 6. Sidebar and Navigation Specification

### 6.1 Layout

- Width: `w-64` (256px) on desktop, collapsible on mobile/tablet.
- Background: `bg-[#F8FBF8]` (soft green canvas tint).
- Border: `border-r border-[#E1EBE4]`.

### 6.2 Structure

- **Section labels:** `text-[10px] font-black uppercase tracking-wider text-slate-400`.
- **Menu items:** `text-xs leading-tight truncate`.
- **Active state:** `bg-[#E5F4EB]` (green-100), `text-[#176B45]` (green-800), `ring-1 ring-inset ring-[#CFE7D8]` (green-200), `font-bold`.
- **Hover state:** `text-[#176B45]`, `hover:bg-[#EDF6EF]`.
- **Icons:** `w-4 h-4` (16px), consistent sizing.
- **Badges:** `text-[10px] font-bold px-1.5 py-0.5 rounded-full`.

### 6.3 Behavior

- **Active menu indication:** Clear background + text + ring. Never rely on color alone.
- **Hover:** Subtle background change, icon color change.
- **Keyboard focus:** `focus-visible` outline `2px solid green-600`, `outline-offset: 2px`.
- **Collapse/expand:** If sections are collapsed, no content is hidden below the fold. The sidebar must not overflow.
- **RBAC visibility:** Menu items shown only if the user has the required permission (backend-authoritative).

## 7. Header Specification

### 7.1 Layout

- Height: `h-16` (64px).
- Background: `bg-white/95 backdrop-blur`, `border-b border-[#E1EBE4]`.
- Shadow: `shadow-[0_1px_2px_rgba(20,60,35,0.04)]`.
- Full-width responsive: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`.

### 7.2 Components

- **Brand:** Left side, green logo square (`w-10 h-10 rounded-xl bg-[#176B45]`), GABAH text in `font-black text-xl tracking-tight`.
- **Search:** Center, `max-w-md`, hidden on mobile, `md:block`.
- **Right actions:** QR scanner, notifications, user profile, logout.
- **Notifications:** Ping counter `bg-[#FC4A1A] white`, `ring-2 ring-white`.

### 7.3 Responsive

- Mobile: hide search, simplify actions, keep notification badge.
- No horizontal overflow; all content within viewport.

## 8. Dashboard Standards

### 8.1 Layout

- **Page title:** Clear context. Do not label by role; use functional titles (e.g., "Dashboard KPI", "Dashboard Staf").
- **KPI cards:** White surface, thin border `#E1EBE4`, subtle shadow.
- **Charts:** Only where supported by real data. Avoid dummy statistics.
- **Recent activity / action shortcuts:** Relevant to the user's role.

### 8.2 Role-aware

- Dashboard content varies by role (Admin GABAH, Karyawan, Humas, GA, IT, etc.).
- Do not show the same dashboard to every user.
- Respect permissions: no widgets the user cannot access.

### 8.3 Data

- All data must come from the backend API (not hardcoded).
- Empty states: clear message + action.
- Loading: skeleton or spinner.
- Error: readable message + retry.

## 9. Table Standards

### 9.1 Typography and Layout

| Property | Value |
|---|---|
| Font size | `text-xs` (14px) |
| Header font | `text-xs font-semibold uppercase tracking-wider` |
| Row height | `min-h-[32px]` minimum, `py-2` padding |
| Padding | `px-4 py-2` |
| Header background | `#F1F8F3` (green-50) |
| Header border | `border-b border-[#E1EBE4]` |
| Row hover | `hover:bg-[#F8FBF8]` |
| Border | `border border-[#E1EBE4] border-collapse` |

### 9.2 Alignment

- **Text columns:** left-aligned.
- **Numeric columns:** right-aligned.
- **Status columns:** center-aligned (badges).

### 9.3 Content Constraints

- **Long text:** wraps with `break-words` or intentional `line-clamp-1` + tooltip.
- **Action buttons:** visible, accessible, `min-w-[24px]`.
- **Empty state:** clear message + CTA.
- **Loading:** skeleton or spinner row.
- **Error:** readable message + retry.
- **Pagination:** must be visible, not clipped.

### 9.4 Responsive Tables

- Wide tables may scroll horizontally **with a visible indication** (e.g., `overflow-x-auto`).
- Improve mobile layout: convert wide tables to cards/stacks when practical.

## 10. Form and Modal Standards

### 10.1 Forms

| Element | Standard |
|---|---|
| Labels | `text-xs font-semibold`, above input |
| Inputs | `w-full px-3 py-2 rounded-lg border border-[#E1EBE4] bg-white text-sm` |
| Focus | `border-green-600 outline-green-600 outline-2 outline-offset-2` |
| Error | `border-red-400`, error message `text-xs text-red-600` |
| Help text | `text-xs text-slate-500` |
| Required | `text-red-400` on label + `required` attribute |
| Disabled | `bg-slate-50 text-slate-400` |
| Read-only | `bg-slate-50 text-slate-500` |

### 10.2 Modals

- **Width:** `max-w-lg` (desktop), `max-w-md` (mobile).
- **Height:** internal scroll `max-h-[85vh] overflow-y-auto`.
- **Header:** `font-bold text-sm`, icon, close button.
- **Footer:** Save/Cancel + action buttons.
- **Responsive:** no modal extends beyond viewport; controls visible.

## 11. Accessibility Requirements

1. **Keyboard:** All interactive elements focusable. Tab order logical.
2. **Focus indicator:** `2px solid green-600`, `outline-offset: 2px`. Visible on all interactive elements.
3. **Contrast:** Text 4.5:1 (normal), 3:1 (large). Use semantic colors, not color alone.
4. **Labels:** All inputs have `<label>` or `aria-label`.
5. **Language:** `lang="id"` on `<html>` and `lang="en"` fallback.
6. **Reduced motion:** Respect `@media (prefers-reduced-motion: reduce)`.
7. **Focus trap:** Modals trap focus when open.
8. **Skip links:** Provide skip-to-content link.

## 12. Component Usage Rules

- **Reuse existing components.** Check `src/components/` before creating new ones.
- **Semantic tokens only.** Use `--gabah-green-*`, `--gabah-canvas`, `--gabah-border` from `src/index.css`.
- **No global overrides.** Keep `src/index.css` scoped to `#root` for enforcement.
- **No `!important`.** Use specificity or restructure instead.
- **No new UI library.** React + Tailwind + Lucide only.

## 13. Screens and Modules Covered

1. Login page
2. Dashboard
3. Sidebar + Header navigation
4. Asset management (catalog, detail, loan, import)
5. Loan management
6. Meeting room reservation
7. Ticket management
8. User administration
9. Role/location administration
10. All Administration tabs
11. Reports
12. Forms and modals (all)

## 14. Known Limitations and Remaining Work

- **UI automation:** no browser automation tool available; visual verification is source-level.
- **Production DB:** no live PostgreSQL in sandbox; DB constraints verified statically.
- **Role simulation:** RBAC behavior verified by code review, not by live UI interaction.
- **Recommended gaps:** table column overflow across all legacy screens; modal resize on tablet.

---

*Documentation last updated: 2026-11-19.*
