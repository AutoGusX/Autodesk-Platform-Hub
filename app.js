// app.js — router, consumer views, Toast, Dialog, app bootstrap

import { state, loadState, setTheme, updateConfig, clearFirstRun } from './state.js';
import { validate } from './schema.js';
import { resolveUrl, getMissingTokens, escapeHtml } from './url.js';
import { refreshIcons } from './icons.js';
import { renderAdmin } from './admin.js';

// ─── Router ────────────────────────────────────────────────────────────────

export function parseRoute(hash) {
  const path = (hash || window.location.hash).replace(/^#\/?/, '') || '';
  if (!path) return { view: 'home' };

  if (path === 'admin') return { view: 'admin', customerId: null };

  const adminCust = path.match(/^admin\/customer\/([^/]+)$/);
  if (adminCust) return { view: 'admin', customerId: adminCust[1] };

  const custMod = path.match(/^customer\/([^/]+)\/([^/]+)$/);
  if (custMod) return { view: 'customer', customerId: custMod[1], moduleId: custMod[2] };

  const cust = path.match(/^customer\/([^/]+)$/);
  if (cust) return { view: 'customer', customerId: cust[1], moduleId: null };

  return { view: 'home' };
}

export function navigate(hash) {
  window.location.hash = hash;
}

// ─── Toast ─────────────────────────────────────────────────────────────────

export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const iconMap = { info: 'info', success: 'check-circle', warning: 'alert-triangle', error: 'alert-circle' };
  toast.innerHTML = `
    <i data-lucide="${iconMap[type] || 'info'}" class="icon" aria-hidden="true"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close btn-ghost" aria-label="Dismiss">
      <i data-lucide="x" class="icon" aria-hidden="true"></i>
    </button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => dismissToast(toast));
  container.appendChild(toast);
  refreshIcons(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('toast-visible'));
  });

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.remove('toast-visible');
  toast.addEventListener('transitionend', () => toast.remove(), { once: true });
}

// ─── Dialog ────────────────────────────────────────────────────────────────

/**
 * Shows a modal dialog.
 * @param {object} options
 * @param {string} options.title
 * @param {string} options.body — trusted HTML string for the dialog body
 * @param {string} [options.confirmText]
 * @param {string} [options.cancelText]
 * @param {boolean} [options.danger]
 * @param {function} [options.onReady] — called with the overlay element right after it is mounted
 * @returns {Promise<boolean>}
 */
export function showDialog({ title, body, confirmText = 'Confirm', cancelText = 'Cancel', danger = false, onReady }) {
  return new Promise((resolve) => {
    const container = document.getElementById('dialog-container');
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.innerHTML = `
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div class="dialog-header">
          <h2 class="dialog-title" id="dlg-title">${escapeHtml(title)}</h2>
          <button class="dialog-close btn-ghost" aria-label="Close">
            <i data-lucide="x" class="icon" aria-hidden="true"></i>
          </button>
        </div>
        <div class="dialog-body">${body}</div>
        <div class="dialog-footer">
          <button class="btn btn-ghost dialog-cancel">${escapeHtml(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} dialog-confirm">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    // Resolve first so callers can read form values from the still-attached DOM,
    // then remove the overlay on the next animation frame.
    function close(result) {
      document.removeEventListener('keydown', escHandler);
      resolve(result);
      requestAnimationFrame(() => overlay.remove());
    }

    const escHandler = (e) => {
      if (e.key === 'Escape') close(false);
    };

    overlay.querySelector('.dialog-close').addEventListener('click', () => close(false));
    overlay.querySelector('.dialog-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.dialog-confirm').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    document.addEventListener('keydown', escHandler);

    container.appendChild(overlay);
    refreshIcons(overlay);

    if (onReady) onReady(overlay);

    requestAnimationFrame(() => overlay.querySelector('.dialog-confirm')?.focus());
  });
}

// ─── Header ────────────────────────────────────────────────────────────────

function renderHeader(route) {
  const customer = route.customerId
    ? state.config.customers.find(c => c.id === route.customerId)
    : null;

  const isAdmin    = route.view === 'admin';
  const isCustomer = route.view === 'customer';

  const header = document.createElement('header');
  header.className = 'app-header';
  header.innerHTML = `
    <div class="header-inner">
      <div class="header-left">
        ${isCustomer || isAdmin ? `
          <a href="#/" class="header-back btn-ghost" aria-label="Back to home">
            <i data-lucide="arrow-left" class="icon" aria-hidden="true"></i>
          </a>
        ` : ''}
        <a href="#/" class="header-brand" aria-label="${escapeHtml(state.config.brand?.title || 'Autodesk Platform Hub')} home">
          <img src="assets/autodesk-logo-light.png" alt="Autodesk" class="header-logo logo-light">
          <img src="assets/autodesk-logo-dark.png"  alt="Autodesk" class="header-logo logo-dark">
          <span class="header-title">${escapeHtml(state.config.brand?.title || 'Autodesk Platform Hub')}</span>
        </a>
        ${customer ? `
          <span class="header-separator" aria-hidden="true">·</span>
          ${customer.logoUrl ? `
            <img src="${escapeHtml(customer.logoUrl)}" alt="" class="header-customer-logo">
          ` : ''}
          <span class="header-customer-name">${escapeHtml(customer.name)}</span>
        ` : ''}
        ${isAdmin ? `
          <span class="header-separator" aria-hidden="true">·</span>
          <span class="header-admin-badge">Admin</span>
        ` : ''}
      </div>
      <div class="header-right">
        <button class="btn-ghost theme-toggle" id="theme-toggle-btn" aria-label="Toggle theme" title="Switch to ${state.config.theme === 'dark' ? 'light' : 'dark'} mode">
          <i data-lucide="${state.config.theme === 'dark' ? 'sun' : 'moon'}" class="icon" aria-hidden="true"></i>
        </button>
        ${!isAdmin ? `
          <a href="#/admin" class="btn btn-outline admin-btn">
            <i data-lucide="settings" class="icon" aria-hidden="true"></i>
            <span>Admin</span>
          </a>
        ` : ''}
      </div>
    </div>
  `;

  header.querySelector('#theme-toggle-btn').addEventListener('click', () => {
    const next = state.config.theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    const btn = header.querySelector('#theme-toggle-btn');
    const iconEl = btn.querySelector('[data-lucide]');
    if (iconEl) iconEl.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
    btn.title = `Switch to ${next === 'dark' ? 'light' : 'dark'} mode`;
    refreshIcons(btn);
  });

  return header;
}

// ─── Home view ─────────────────────────────────────────────────────────────

function renderCustomerTile(customer) {
  const tile = document.createElement('button');
  tile.className = 'customer-tile';
  tile.setAttribute('aria-label', `Open ${customer.name}`);

  const initials = escapeHtml(customer.name.slice(0, 2).toUpperCase());
  tile.innerHTML = `
    <div class="tile-logo-area">
      ${customer.logoUrl
        ? `<img src="${escapeHtml(customer.logoUrl)}" alt="${escapeHtml(customer.name)}" class="tile-logo">`
        : `<span class="tile-logo-placeholder">${initials}</span>`
      }
    </div>
    <div class="tile-name">${escapeHtml(customer.name)}</div>
  `;

  if (customer.logoUrl) {
    const img = tile.querySelector('.tile-logo');
    img.addEventListener('error', () => {
      tile.querySelector('.tile-logo-area').innerHTML = `<span class="tile-logo-placeholder">${initials}</span>`;
    });
  }

  tile.addEventListener('click', () => navigate(`#/customer/${customer.id}`));
  return tile;
}

function renderAddCustomerTile() {
  const tile = document.createElement('button');
  tile.className = 'customer-tile customer-tile-add';
  tile.setAttribute('aria-label', 'Add new customer');
  tile.innerHTML = `
    <div class="tile-logo-area tile-add-icon">
      <i data-lucide="plus" class="icon icon-xl" aria-hidden="true"></i>
    </div>
    <div class="tile-name">Add Customer</div>
  `;
  tile.addEventListener('click', () => navigate('#/admin'));
  return tile;
}

function renderHomeView() {
  const main = document.createElement('main');
  main.className = 'view-home';
  main.setAttribute('id', 'main-content');

  const customers = state.config.customers;

  if (customers.length === 0) {
    main.innerHTML = `
      <div class="empty-state">
        <i data-lucide="building-2" class="icon empty-state-icon" aria-hidden="true"></i>
        <h2 class="empty-state-title">No customers yet</h2>
        <p class="empty-state-desc">Create your first customer to get started with the Platform Hub.</p>
        <a href="#/admin" class="btn btn-primary">
          <i data-lucide="plus" class="icon" aria-hidden="true"></i>
          Add your first customer
        </a>
      </div>
    `;
  } else {
    const section = document.createElement('section');
    section.className = 'customer-section';
    section.innerHTML = `<h2 class="section-heading">Customers</h2>`;

    const grid = document.createElement('div');
    grid.className = 'customer-grid';
    grid.setAttribute('role', 'list');

    customers.forEach(c => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('role', 'listitem');
      wrapper.appendChild(renderCustomerTile(c));
      grid.appendChild(wrapper);
    });

    const addWrapper = document.createElement('div');
    addWrapper.setAttribute('role', 'listitem');
    addWrapper.appendChild(renderAddCustomerTile());
    grid.appendChild(addWrapper);

    section.appendChild(grid);
    main.appendChild(section);
  }

  return main;
}

// ─── Welcome / first-run view ──────────────────────────────────────────────

function renderWelcomeView() {
  const main = document.createElement('main');
  main.className = 'view-welcome';
  main.setAttribute('id', 'main-content');

  const hasDefault = !!state._defaultConfig;

  main.innerHTML = `
    <div class="welcome-card">
      <div class="welcome-logos">
        <img src="assets/autodesk-logo-light.png" class="welcome-logo logo-light" alt="Autodesk">
        <img src="assets/autodesk-logo-dark.png"  class="welcome-logo logo-dark"  alt="Autodesk">
      </div>
      <h1 class="welcome-title">${escapeHtml(state.config.brand?.title || 'Autodesk Platform Hub')}</h1>
      <p class="welcome-subtitle">How would you like to get started?</p>

      <div class="welcome-options">
        ${hasDefault ? `
          <button class="welcome-opt welcome-opt-featured" id="w-load-default">
            <span class="welcome-opt-icon">
              <i data-lucide="download-cloud" class="icon" aria-hidden="true"></i>
            </span>
            <span class="welcome-opt-text">
              <strong>Load saved configuration</strong>
              <span class="welcome-opt-desc">A config.json was found at this site — load it now</span>
            </span>
          </button>
        ` : ''}

        <label class="welcome-opt" for="w-import-file">
          <span class="welcome-opt-icon">
            <i data-lucide="folder-open" class="icon" aria-hidden="true"></i>
          </span>
          <span class="welcome-opt-text">
            <strong>Import from file</strong>
            <span class="welcome-opt-desc">Browse for a config.json exported from this app</span>
          </span>
          <input type="file" id="w-import-file" accept=".json,application/json" class="file-input-hidden">
        </label>

        <button class="welcome-opt" id="w-scratch">
          <span class="welcome-opt-icon">
            <i data-lucide="plus-square" class="icon" aria-hidden="true"></i>
          </span>
          <span class="welcome-opt-text">
            <strong>Start from scratch</strong>
            <span class="welcome-opt-desc">Create a brand-new empty configuration</span>
          </span>
        </button>
      </div>

      <div id="w-error" class="welcome-error" hidden></div>
    </div>
  `;

  // Load default config.json
  if (hasDefault) {
    main.querySelector('#w-load-default').addEventListener('click', () => {
      const result = updateConfig(state._defaultConfig);
      if (result.valid) {
        clearFirstRun();
        showToast('Configuration loaded from config.json', 'success');
        render();
      } else {
        const errDiv = main.querySelector('#w-error');
        errDiv.hidden = false;
        errDiv.textContent = 'config.json failed validation: ' + (result.errors[0]?.message || 'unknown error');
      }
    });
  }

  // Import from file picker
  main.querySelector('#w-import-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const errDiv = main.querySelector('#w-error');
      try {
        const parsed = JSON.parse(reader.result);
        const result = validate(parsed);
        if (result.valid) {
          updateConfig(parsed);
          clearFirstRun();
          showToast(`"${file.name}" imported`, 'success');
          render();
        } else {
          errDiv.hidden = false;
          errDiv.innerHTML =
            `<strong>Validation errors:</strong><br>` +
            result.errors.slice(0, 3).map(er => escapeHtml(er.message)).join('<br>');
        }
      } catch {
        errDiv.hidden = false;
        errDiv.textContent = 'File is not valid JSON.';
      }
    };
    reader.readAsText(file);
  });

  // Start from scratch
  main.querySelector('#w-scratch').addEventListener('click', () => {
    clearFirstRun();
    render();
  });

  return main;
}

// ─── Customer detail view ──────────────────────────────────────────────────

function renderSubmoduleCard(submodule, customer) {
  const missing = getMissingTokens(
    submodule.url,
    submodule.urlMode,
    submodule.variables || {},
    customer.variables || {}
  );

  const card = document.createElement('button');
  card.className = `submodule-card${missing.length > 0 ? ' has-missing' : ''}`;
  card.setAttribute(
    'aria-label',
    `${submodule.name}${missing.length ? ` — ${missing.length} variable${missing.length > 1 ? 's' : ''} missing` : ''}`
  );

  card.innerHTML = `
    <div class="submodule-card-icon">
      <i data-lucide="${escapeHtml(submodule.icon || 'square')}" class="icon" aria-hidden="true"></i>
    </div>
    <div class="submodule-card-body">
      <div class="submodule-card-name">${escapeHtml(submodule.name)}</div>
      ${submodule.description
        ? `<div class="submodule-card-desc">${escapeHtml(submodule.description)}</div>`
        : ''}
    </div>
    ${missing.length > 0 ? `
      <div class="missing-badge" title="Missing: ${missing.map(escapeHtml).join(', ')}">
        <i data-lucide="alert-triangle" class="icon icon-xs" aria-hidden="true"></i>
        ${missing.length} missing
      </div>
    ` : ''}
    <i data-lucide="external-link" class="icon icon-sm submodule-arrow" aria-hidden="true"></i>
  `;

  card.addEventListener('click', () => {
    if (missing.length > 0) {
      showToast(`Missing variables: ${missing.join(', ')}`, 'warning');
      return;
    }
    const { resolved } = resolveUrl(
      submodule.url,
      submodule.urlMode,
      submodule.variables || {},
      customer.variables || {}
    );
    window.open(resolved, '_blank', 'noopener,noreferrer');
  });

  return card;
}

function renderCustomerView(customerId, activeModuleId) {
  const customer = state.config.customers.find(c => c.id === customerId);
  if (!customer) {
    navigate('#/');
    return document.createElement('div');
  }

  const modules = customer.modules || [];
  const activeModule = (activeModuleId && modules.find(m => m.id === activeModuleId)) || modules[0] || null;

  if (activeModule && !activeModuleId) {
    history.replaceState(null, '', `#/customer/${customerId}/${activeModule.id}`);
  }

  document.title = activeModule
    ? `${customer.name} — ${activeModule.name} · ${state.config.brand.title}`
    : `${customer.name} · ${state.config.brand.title}`;

  const main = document.createElement('main');
  main.className = 'view-customer';
  main.setAttribute('id', 'main-content');

  if (modules.length > 0) {
    const tabStrip = document.createElement('nav');
    tabStrip.className = 'module-tabs';
    tabStrip.setAttribute('role', 'tablist');
    tabStrip.setAttribute('aria-label', 'Modules');

    modules.forEach(mod => {
      const isActive = mod.id === activeModule?.id;
      const tab = document.createElement('button');
      tab.className = `module-tab${isActive ? ' active' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.setAttribute('id', `tab-${mod.id}`);
      tab.innerHTML = `
        <i data-lucide="${escapeHtml(mod.icon || 'square')}" class="icon" aria-hidden="true"></i>
        <span>${escapeHtml(mod.name)}</span>
      `;
      tab.addEventListener('click', () => navigate(`#/customer/${customerId}/${mod.id}`));
      tabStrip.appendChild(tab);
    });
    main.appendChild(tabStrip);
  }

  const content = document.createElement('div');
  content.className = 'module-content';

  if (modules.length === 0) {
    content.innerHTML = `
      <div class="empty-state">
        <i data-lucide="layout" class="icon empty-state-icon" aria-hidden="true"></i>
        <h2 class="empty-state-title">No modules configured</h2>
        <p class="empty-state-desc">Add modules for ${escapeHtml(customer.name)} in the admin panel.</p>
        <a href="#/admin/customer/${customer.id}" class="btn btn-primary">
          <i data-lucide="settings" class="icon" aria-hidden="true"></i>
          Configure in admin
        </a>
      </div>
    `;
  } else if (activeModule) {
    const submodules = activeModule.submodules || [];
    if (submodules.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <i data-lucide="grid" class="icon empty-state-icon" aria-hidden="true"></i>
          <h2 class="empty-state-title">No submodules in ${escapeHtml(activeModule.name)}</h2>
          <p class="empty-state-desc">Add submodules in the admin panel.</p>
          <a href="#/admin/customer/${customer.id}" class="btn btn-primary">
            <i data-lucide="settings" class="icon" aria-hidden="true"></i>
            Configure in admin
          </a>
        </div>
      `;
    } else {
      const grid = document.createElement('div');
      grid.className = 'submodule-grid';
      submodules.forEach(sub => grid.appendChild(renderSubmoduleCard(sub, customer)));
      content.appendChild(grid);
    }
  }

  main.appendChild(content);
  return main;
}

// ─── App render ────────────────────────────────────────────────────────────

function render() {
  const route = parseRoute();
  const app = document.getElementById('app');
  if (!app) return;

  app.innerHTML = '';
  document.documentElement.setAttribute('data-theme', state.config.theme);

  if (route.view === 'home') {
    document.title = state.config.brand?.title || 'Autodesk Platform Hub';
  } else if (route.view === 'admin') {
    document.title = `Admin · ${state.config.brand?.title || 'Autodesk Platform Hub'}`;
  }

  app.appendChild(renderHeader(route));

  let mainContent;
  if (route.view === 'home') {
    mainContent = state.isFirstRun ? renderWelcomeView() : renderHomeView();
  } else if (route.view === 'customer') {
    mainContent = renderCustomerView(route.customerId, route.moduleId);
  } else if (route.view === 'admin') {
    mainContent = renderAdmin(route, showToast, showDialog);
  } else {
    navigate('#/');
    return;
  }

  app.appendChild(mainContent);
  refreshIcons();
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────

async function init() {
  loadState();
  document.documentElement.setAttribute('data-theme', state.config.theme);

  // On first run, eagerly try to fetch config.json from the repo root so the
  // result is ready before the welcome screen is painted.  A 4-second timeout
  // prevents this from blocking the page on a slow or missing file.
  if (state.isFirstRun) {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 4000);
    try {
      const resp = await fetch('./config.json', { signal: controller.signal });
      clearTimeout(timeout);
      if (resp.ok) {
        const json   = await resp.json();
        const result = validate(json);
        if (result.valid) state._defaultConfig = json;
      }
    } catch {
      clearTimeout(timeout);
      // config.json not found or fetch timed out — no default available
    }
  }

  window.addEventListener('hashchange', render);
  render();
}

init();
