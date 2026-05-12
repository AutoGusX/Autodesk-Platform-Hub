# Autodesk Platform Hub

A static, GitHub Pages–deployable proof of concept that presents Autodesk as a unified platform hub. Navigate a three-level hierarchy — **Customer → Module → Submodule** — with deep-linked punch-out URLs and a full in-browser admin interface.

---

## Quick start (local)

No build step needed. Open `index.html` directly in a modern browser:

```
# macOS / Linux
open index.html

# Windows
start index.html
```

> **Note:** Some browsers restrict ES module imports from `file://` origins. If icons or admin features don't load, serve the folder with a local HTTP server:
>
> ```bash
> npx serve .
> # or
> python -m http.server 8080
> ```

---

## Deploying to GitHub Pages

1. Push this folder (all files) to a GitHub repository.
2. In the repo → **Settings → Pages**, set:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or your default), folder: `/ (root)`
3. Save. GitHub will publish the site within ~1 minute.
4. The URL will be `https://<username>.github.io/<repo-name>/`.

Hash-based routing (`#/customer/...`) works natively on Pages — no `404.html` redirect needed.

---

## How to use

### End-user view

| Action | Result |
|---|---|
| Click a customer tile | Opens that customer's module view |
| Click a module tab | Switches the active module |
| Click a submodule card | Opens the resolved URL in a new tab |
| Click a card with a ⚠ badge | Shows which variables are missing |

### Admin (`#/admin`)

| Tab | What you can do |
|---|---|
| **Profile** | Edit customer name and logo URL |
| **Modules & Submodules** | Add, edit, delete, and reorder modules and submodules; pick icons; define URL templates; test URLs |
| **Variables** | Define customer-level key/value variables used in URL templates |
| **Import / Export** | Download `config.json`, upload a config file, or reset everything |

### URL templates

Use `{variableName}` tokens in submodule URLs:

```
https://example.autodesk.com/projects/{projectId}/issues
https://acc.autodesk.com/accounts/{accountId}/reviews
```

Define `projectId` and `accountId` in the customer's **Variables** tab. Submodules can also define their own overrides.

---

## Persistence

All configuration is stored in **browser `localStorage`**. To move configuration between devices or commit it to the repo:

1. Admin → Import / Export → **Export config.json** — downloads the current config.
2. Move the file to another machine (or commit it to the repo as documentation).
3. Admin → Import / Export → **Import config.json** — restores the config.

> The repo does **not** auto-load any `config.json` from the server. `localStorage` is the single source of truth.

---

## File structure

```
/index.html         Entry point
/styles.css         All styles (CSS custom properties for theming)
/app.js             Router, consumer views, Toast, Dialog
/state.js           State management + localStorage sync
/admin.js           Admin UI — editors, drag-and-drop, import/export
/icons.js           Lucide icon helpers + icon picker modal
/url.js             URL variable substitution, slug helpers, escapeHtml
/schema.js          JSON schema validator
/assets/
  autodesk-logo.svg Placeholder brand logo (replace with real asset)
/.nojekyll          Disables Jekyll processing on GitHub Pages
/README.md
/SPEC.md            Full product specification
```

---

## Replacing the logo

Replace `assets/autodesk-logo.svg` with the real Autodesk SVG logo before deployment. The file is referenced in `schema.js → emptyConfig()` as the default `brand.logoUrl`.

---

## Browser support

Requires a modern browser with ES module support (Chrome 80+, Firefox 80+, Safari 14+, Edge 80+).
