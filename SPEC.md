# Autodesk Platform Hub — POC Specification

> A static, GitHub Pages–deployable proof of concept that presents Autodesk as a unified platform. End users navigate a three-level hierarchy (**Customer → Module → Submodule**) into deep-linked punch-out URLs. Admins build and edit the hierarchy entirely in the browser and export the result as a portable `config.json`.

---

## 1. Goals & Non-Goals

### Goals
- Demonstrate Autodesk as one unified platform surface across multiple customer environments.
- Let a non-technical user create, edit, and reorder customers / modules / submodules in the browser.
- Resolve submodule URLs through variable templates so a single project ID drives many deep links.
- Run as a fully static site on GitHub Pages with a flat file structure.
- Be fully portable: configuration moves between machines and deployments via a single JSON file.

### Non-Goals (POC)
- No backend, no database, no server-side auth.
- No persisting uploaded image files (logos are referenced by URL only).
- No real authentication or RBAC — the admin route is open.
- No SSO, no Autodesk APIs, no live data — submodules are static punch-outs only.
- No mobile-first polish; desktop-tablet baseline only.

---

## 2. Locked-In Decisions

| Decision | Choice |
|---|---|
| Stack | **Vanilla HTML / CSS / JavaScript** — no framework, no build step |
| File structure | **Flat** — every source file at the repo root except `/assets/` |
| Persistence | **Working state in `localStorage` + manual Export / Import JSON**. No committed `config.json` is read at startup. |
| Logos | **External URLs only** — no file uploads, no committed images |
| Admin access | **Open** — anyone can edit at the `#/admin` route |
| Variable scope | **Customer-level + per-submodule overrides** |
| Seed content | **None** — first visit shows an empty-state CTA |
| Routing | **Hash-based** (e.g. `#/customer/acme/operations`) |
| In-scope extras | Drag-and-drop reordering, Test URL button, Missing-variable badges, Import schema validation |
| Themes | Light (white + Autodesk blue) and Dark, toggleable |
| Icon library | **Lucide** via CDN (open source, 1,600+ SVG icons) |

---

## 3. Information Architecture

```
Autodesk Platform Hub  (home)
└── Customer (tile)
    └── Module (tab)
        └── Submodule (card)
            → resolved external URL (opens in new tab)
```

- **Customer**: a tenant / account / company. Has a name, logo URL, and a dictionary of variables.
- **Module**: a domain tab inside a customer (e.g. Operations, Data Governance, Digital Twin).
- **Submodule**: a clickable card inside a module that resolves to an external URL.

---

## 4. User Flows

### 4.1 End-user (consumer) flow
1. User lands at `index.html` → sees the **Autodesk Platform Hub** header with Autodesk logo and a grid of customer tiles.
2. User clicks a customer tile → routes to `#/customer/{customerId}` → shows module tabs.
3. The first module is auto-selected; user can click any tab to switch.
4. Inside the selected module, user sees a grid of submodule cards (icon + name + description).
5. Each card shows a small badge if any variables in its URL template are unresolved.
6. User clicks a card → app substitutes variables → opens the resolved URL in a new tab (`target="_blank" rel="noopener noreferrer"`).
7. If variables are missing, the click is blocked and a toast explains what's missing.

### 4.2 Admin flow
The admin route is `#/admin`. It is a single page with four collapsible sections:

1. **Customers** — list of all customers, add / edit / delete / reorder.
2. **Modules & Submodules** — drill into a selected customer, manage its module tabs and the submodules inside each.
3. **Variables** — edit the customer's variable dictionary (key/value pairs) and the per-submodule variable overrides.
4. **Import / Export** — download current config as `config.json`, upload to restore, reset to empty.

Editing semantics:
- All changes are immediate against in-memory state and persisted to `localStorage` on every change.
- An "unsaved-to-file" indicator next to the **Export** button reminds the admin to download the JSON if they want to share or commit it.

---

## 5. Data Model

The single source of truth is one JavaScript object that mirrors `config.json` exactly.

```jsonc
{
  "schemaVersion": 1,
  "brand": {
    "title": "Autodesk Platform Hub",
    "logoUrl": "assets/autodesk-logo.svg"
  },
  "theme": "light",                  // "light" | "dark"
  "customers": [
    {
      "id": "acme",                  // slug, unique, lowercase, [a-z0-9-]
      "name": "ACME Construction",
      "logoUrl": "https://...",      // external URL only
      "variables": {                 // customer-level variables
        "projectId": "b.12345",
        "accountId": "acc.98765",
        "hubId": "hub.55555"
      },
      "modules": [
        {
          "id": "operations",
          "name": "Operations",
          "icon": "hard-hat",        // Lucide icon name
          "submodules": [
            {
              "id": "issues",
              "name": "Issues",
              "icon": "circle-alert",
              "description": "Field issues and resolutions",
              "urlMode": "template", // "fixed" | "template"
              "url": "https://example.autodesk.com/projects/{projectId}/issues",
              "variables": {         // submodule-level overrides (optional)
                "view": "open"
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### Field rules
- `id` values are generated as URL-safe slugs from the name and validated to be unique within their parent scope.
- `schemaVersion` is an integer the app uses to gate import compatibility.
- `logoUrl` is always a string URL (http/https or repo-relative path like `assets/...`). Empty string is allowed and renders a placeholder.
- `urlMode = "fixed"` means the URL is used verbatim (no substitution).
- `urlMode = "template"` means `{variable}` tokens in `url` are substituted at click time.
- `variables` at the submodule level **override** same-keyed customer variables for that submodule only.

---

## 6. URL Variable System

### 6.1 Resolution order
When a submodule is clicked, the app resolves the URL using this lookup order (first hit wins):
1. Submodule's own `variables` map.
2. Parent customer's `variables` map.

### 6.2 Syntax
- Tokens are `{variableName}` — curly braces, no spaces, alphanumeric and `_` only.
- A token with no value in either scope is **unresolved**.
- Resolved values are passed through `encodeURIComponent` before substitution so they are safe in path and query positions.

### 6.3 Validation
- On every edit and on import, the app scans every templated URL and produces a list of unresolved tokens per submodule.
- Submodule cards show a small warning badge `n missing` if any are unresolved.
- Clicking a card with unresolved variables is blocked; a toast lists the missing tokens.

### 6.4 Test-URL preview
- Each submodule's admin editor has a **Test URL** button.
- Clicking it shows the fully resolved URL in a copyable text field, with unresolved tokens highlighted in red.
- A secondary **Open in new tab** action launches the resolved URL only if there are no unresolved tokens.

---

## 7. Routing

Hash-based routing — no server config needed for GitHub Pages.

| Route | Screen |
|---|---|
| `#/` | Customer grid (home) |
| `#/customer/{customerId}` | Customer detail (first module auto-selected) |
| `#/customer/{customerId}/{moduleId}` | Customer detail with specific module tab active |
| `#/admin` | Admin interface |
| `#/admin/customer/{customerId}` | Admin scoped to a specific customer's modules/submodules |

- Unknown routes redirect to `#/`.
- The browser back / forward buttons must work correctly.
- Each route updates `document.title` (e.g. `ACME Construction — Operations · Autodesk Platform Hub`).

---

## 8. File Structure (flat)

```
/index.html
/styles.css
/app.js                  // app bootstrap, routing, view rendering
/state.js                // in-memory state, localStorage sync, schema validation
/admin.js                // admin UI logic (forms, drag-drop, variable editor)
/icons.js                // Lucide icon helpers + icon picker logic
/url.js                  // variable substitution + URL validation
/schema.js               // JSON schema definition + validator
/README.md
/SPEC.md                 // this document
/assets/
  /autodesk-logo.svg     // brand logo (placeholder until real asset provided)
```

> All `.js` files are loaded via `<script type="module">` from `index.html`. No bundler. No transpilation.

---

## 9. Visual Design

### 9.1 Themes

Light (default):
- Background: `#ffffff`
- Surface (cards, tabs): `#f7f9fc`
- Border / dividers: `#e1e6ee`
- Text primary: `#0d1b2a`
- Text secondary: `#4a5a72`
- Primary (Autodesk blue): `#0696d7`
- Primary hover: `#0578ad`
- Danger: `#d64545`
- Success: `#2f9e6d`

Dark:
- Background: `#0b1220`
- Surface: `#121a2b`
- Border: `#1f2a40`
- Text primary: `#e8eef7`
- Text secondary: `#9aa7bd`
- Primary: `#3ab6ec`
- Primary hover: `#5fc7f1`
- Danger: `#e06b6b`
- Success: `#4cc28d`

Both themes:
- Font: system stack — `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- Border radius: `10px` on cards and tiles, `6px` on inputs, `999px` on chips.
- Shadow (light only): `0 1px 2px rgba(13,27,42,0.05), 0 1px 3px rgba(13,27,42,0.08)`.
- Focus ring: `2px solid` primary, `2px` offset, always visible on keyboard focus.

### 9.2 Layout

Home (`#/`):
```
+------------------------------------------------------------+
|  [Autodesk logo]  Autodesk Platform Hub        [☀ / 🌙] [Admin] |
+------------------------------------------------------------+
|                                                            |
|   Customers                                                |
|                                                            |
|   ┌──────────┐  ┌──────────┐  ┌──────────┐                 |
|   │  [logo]  │  │  [logo]  │  │   +      │                 |
|   │  ACME    │  │  Globex  │  │ Add new  │                 |
|   └──────────┘  └──────────┘  └──────────┘                 |
|                                                            |
+------------------------------------------------------------+
```

- Customer tile grid: CSS Grid, `repeat(auto-fill, minmax(220px, 1fr))`, `gap: 20px`.
- Each tile: 16:9 logo area on top, customer name below, full tile is the click target.
- The "Add new" tile is a dashed-border placeholder that opens the admin "create customer" dialog.

Customer detail (`#/customer/{id}`):
```
+------------------------------------------------------------+
|  ← Home    [logo] ACME Construction        [☀ / 🌙] [Admin]|
+------------------------------------------------------------+
|  [Operations] [Data Governance] [Digital Twin] [...]       |
+------------------------------------------------------------+
|                                                            |
|   ┌──────────┐  ┌──────────┐  ┌──────────┐                 |
|   │  ⚠ icon  │  │  icon    │  │  icon    │                 |
|   │  Issues  │  │ Work Ord │  │ Reviews  │                 |
|   │  desc..  │  │  desc... │  │ desc...  │                 |
|   │ [1 miss] │  │          │  │          │                 |
|   └──────────┘  └──────────┘  └──────────┘                 |
+------------------------------------------------------------+
```

- Tabs are horizontally scrollable on narrow viewports.
- Submodule grid: same auto-fill grid as customer tiles.
- A missing-variable badge appears at the bottom-right of any card that has unresolved tokens.

Admin (`#/admin`):
- Two-column layout. Left: customer list (selectable, drag-reorderable). Right: editor for the selected customer (or a "Create new customer" placeholder).
- The right panel uses tabs: **Profile** | **Modules & Submodules** | **Variables** | **Import / Export**.
- Modules tab uses an accordion: each module expands to show its submodules with drag handles.

### 9.3 Theme toggle
- Single icon button (sun / moon from Lucide) in the top-right header.
- Persists choice in `localStorage` under key `aph.theme`.
- Honors `prefers-color-scheme` for the very first visit only.

---

## 10. Component Inventory

A coding agent should implement these as plain functions that return DOM nodes (no framework needed):

| Component | File | Purpose |
|---|---|---|
| `Header` | `app.js` | Logo, title, theme toggle, admin button |
| `CustomerGrid` | `app.js` | Renders tiles + "Add new" tile |
| `CustomerTile` | `app.js` | Single tile (logo, name, click-through) |
| `ModuleTabs` | `app.js` | Horizontal tab strip with active state |
| `SubmoduleGrid` | `app.js` | Grid of cards, missing-var badges |
| `SubmoduleCard` | `app.js` | Icon, name, description, badge, click handler |
| `AdminShell` | `admin.js` | Left-rail + right-panel layout |
| `CustomerEditor` | `admin.js` | Form: name, logoUrl, slug |
| `ModuleEditor` | `admin.js` | Inline editable module row + submodule accordion |
| `SubmoduleEditor` | `admin.js` | Form: name, icon picker, description, urlMode, url, overrides |
| `VariableEditor` | `admin.js` | Key/value pair list with add/remove |
| `IconPicker` | `icons.js` | Modal with search field + filtered Lucide grid |
| `ImportExportPanel` | `admin.js` | Export, Import, Reset buttons + validation report |
| `Toast` | `app.js` | Transient bottom-right messages (success / warn / error) |
| `Dialog` | `app.js` | Modal wrapper with focus trap |

---

## 11. Icon Picker (Lucide)

- Load Lucide via CDN: `https://unpkg.com/lucide@latest`.
- Icon picker renders a searchable grid of all available icon names.
- Search is a simple `String.includes()` against icon names (case-insensitive).
- Selecting an icon stores its **name** (e.g. `"hard-hat"`) in the data model, not the SVG markup.
- At render time, icons are produced via `lucide.createIcons()` or a small helper that injects the SVG for a given name.
- Fallback: if an icon name is unknown (e.g. a renamed icon after a Lucide version bump), render a generic `square` icon and log a warning to the console.

---

## 12. Persistence Model

### 12.1 Working state
- The entire app config lives in a single JS object: `state.config`.
- After every mutation, `state.config` is serialized to `localStorage` under the key `aph.config.v1`.
- On page load, `state.config` is hydrated from `localStorage` if present and schema-valid; otherwise an empty config is created.

### 12.2 Export
- Admin → Import/Export → **Export config.json** triggers a download of the current `state.config` as `config.json` (pretty-printed, 2-space indent).
- Filename includes ISO date: `config-2026-05-12.json` (suggested default).

### 12.3 Import
- Admin → Import/Export → **Import config.json** opens a file picker.
- File is read, JSON-parsed, and run through the schema validator (Section 13).
- If valid: replaces `state.config` entirely (with a confirmation dialog showing a diff summary — "X customers, Y modules, Z submodules will replace your current data").
- If invalid: shows a list of validation errors with paths (e.g. `customers[0].modules[2].submodules[1].url is required`) and does **not** modify state.

### 12.4 Reset
- Admin → Import/Export → **Reset to empty** clears `localStorage` and `state.config` after a confirm dialog.

### 12.5 No baseline `config.json`
- The repo does **not** ship a baseline `config.json` that the app fetches at startup.
- Empty state on first visit is intentional and shows a "Create your first customer" CTA.

---

## 13. JSON Schema & Validation Rules

Implemented in `schema.js` as a hand-rolled validator (no external deps).

### Top-level
- `schemaVersion` must be the integer `1`. Imports with other versions are rejected with a clear "unsupported schema version" message.
- `brand.title` is a non-empty string (max 60 chars).
- `brand.logoUrl` is a string (may be empty).
- `theme` is `"light"` or `"dark"`.
- `customers` is an array.

### Customer
- `id`: non-empty string, matches `/^[a-z0-9][a-z0-9-]{0,40}$/`, unique within `customers`.
- `name`: non-empty string (max 80 chars).
- `logoUrl`: string. If non-empty, must be a valid `http://`, `https://`, or repo-relative path.
- `variables`: object whose keys match `/^[A-Za-z_][A-Za-z0-9_]{0,40}$/` and whose values are strings.
- `modules`: array.

### Module
- `id`: same slug rule as customer, unique within the parent customer's modules.
- `name`: non-empty string (max 60 chars).
- `icon`: string (Lucide icon name).
- `submodules`: array.

### Submodule
- `id`: same slug rule, unique within the parent module's submodules.
- `name`: non-empty string (max 60 chars).
- `icon`: string.
- `description`: string (max 200 chars, may be empty).
- `urlMode`: `"fixed"` or `"template"`.
- `url`: non-empty string. If `urlMode = "template"`, may contain `{variableName}` tokens.
- `variables`: object, same rules as customer variables.

### Validation report shape
```jsonc
{
  "valid": false,
  "errors": [
    { "path": "customers[0].id", "message": "must match /^[a-z0-9][a-z0-9-]{0,40}$/" },
    { "path": "customers[0].modules[1].submodules[0].url", "message": "is required" }
  ]
}
```

---

## 14. Drag-and-Drop Reordering

- Implemented with the HTML5 drag-and-drop API (no library).
- Applies to: customers list, modules list, submodules list (within a single parent).
- Cross-parent drag (e.g. moving a submodule between modules) is **out of scope** for the POC.
- Drag handle is a visible grip icon (`grip-vertical` from Lucide) on the left edge of each row in admin view.
- During drag, the dragged item gets `opacity: 0.6` and the drop target gets a 2px primary-color top border.
- Persisted to `localStorage` on drop.

---

## 15. Empty States

| Screen | Empty state |
|---|---|
| Home with zero customers | Centered card: "No customers yet." + **Add your first customer** button → opens admin create flow |
| Customer with zero modules | Centered card inside tab area: "No modules configured for this customer." + **Configure in admin** link |
| Module with zero submodules | Same pattern, scoped to the module |

---

## 16. Accessibility Baseline (table-stakes only)

- All interactive elements are `<button>` or `<a>` — never bare `<div>` with click handlers.
- All form fields have associated `<label>`s.
- Modals trap focus and close on `Esc`.
- Customer tiles, tabs, and submodule cards are keyboard-activatable (`Enter` / `Space`).
- Focus ring is always visible (no `outline: none` without replacement).

Full WCAG conformance is **not** a POC requirement.

---

## 17. Deployment

- Repo root is the GitHub Pages source.
- Settings → Pages → "Deploy from a branch" → branch `main`, folder `/ (root)`.
- The `404.html` route is **not** needed because routing is hash-based.
- A `.nojekyll` file is included at the root to disable Jekyll processing of any underscore-prefixed assets (defensive; not strictly required for this file set).
- The site is fully usable when opened locally via `file://` as well, with one caveat: the `localStorage` partition is per-origin so `file://` state is separate from the deployed-site state.

---

## 18. Out of Scope / Future

These were considered and explicitly deferred:
- Search / filter on the customer grid.
- Full responsive (phone-first) polish.
- WCAG AA conformance audit.
- Cross-parent drag-and-drop (moving submodules between modules).
- Image uploads / repo-committed logos.
- Real authentication for `/admin`.
- Live Autodesk API integrations.
- Multi-language support.
- Version history / undo of admin edits beyond browser back.
- Commit-to-GitHub from the admin UI (would require an Octokit + PAT flow; reasonable v2 feature).

---

## 19. Acceptance Criteria (definition of done for the POC)

A coding agent's deliverable is complete when all of the following hold:

1. Opening `index.html` (locally or via Pages) on a fresh browser shows the Hub header and an empty-state CTA.
2. Navigating to `#/admin` lets a user create a customer with name, logo URL, and at least one variable.
3. Inside that customer, the user can create modules and submodules, pick icons from the Lucide picker, and define a templated URL.
4. Clicking the submodule from the consumer view opens the resolved URL in a new tab.
5. A submodule with an unresolved variable shows a "missing" badge and clicking it is blocked with an explanatory toast.
6. The **Test URL** button shows the fully resolved URL (or highlights unresolved tokens) without leaving the admin.
7. **Export config.json** downloads a valid JSON file that, when re-imported into a different browser, restores the exact same hierarchy.
8. **Import config.json** rejects malformed files with a readable error list and does not corrupt existing state.
9. Customers, modules, and submodules can be reordered via drag-and-drop and the new order persists across page reloads.
10. The theme toggle switches light ↔ dark, persists across reloads, and respects `prefers-color-scheme` on first visit only.
11. Browser back/forward navigates correctly between home, customer, module, and admin routes.
12. All `.js` files load via `<script type="module">` from `index.html`; no build step is required.
13. The repository contains only the files listed in Section 8 (plus this spec and a README).

---

## 20. Handoff Notes for the Coding Agent

- Keep the JavaScript dependency-free except for Lucide via CDN.
- Prefer small focused functions over classes; the data model is plain JSON, so functional updates are natural.
- Treat `state.config` as immutable per mutation: produce a new object, run it through the schema validator, then commit it.
- The schema validator is the single chokepoint for both runtime edits and imports — do not duplicate validation logic.
- All routes must be reachable by typing the URL directly into the address bar (cold-load support).
- Do **not** auto-fetch any baseline `config.json` from the repo on startup. Empty state is the correct first-visit experience.
- The Autodesk logo in `/assets/autodesk-logo.svg` is a placeholder — replace with the real asset before final deployment.

---

**End of specification.**
