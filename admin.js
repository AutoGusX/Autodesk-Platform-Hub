// admin.js — Admin UI: shell, editors, drag-and-drop, import/export

import {
  state, updateConfig,
  addCustomer, updateCustomer, deleteCustomer, reorderCustomers,
  addModule, updateModule, deleteModule, reorderModules,
  addSubmodule, updateSubmodule, deleteSubmodule, reorderSubmodules,
  markExported
} from './state.js';
import { validate, emptyConfig } from './schema.js';
import { toSlug, ensureUniqueSlug, getMissingTokens, resolveUrl, escapeHtml } from './url.js';
import { refreshIcons, openIconPicker } from './icons.js';

// ─── Module-level admin state ─────────────────────────────────────────────

let adminSt = {
  selectedCustomerId: null,
  activeTab: 'profile',
  expandedModules: new Set(),
};

let _showToast, _showDialog, _adminRoot;

// ─── Entry point ──────────────────────────────────────────────────────────

export function renderAdmin(route, showToast, showDialog) {
  _showToast = showToast;
  _showDialog = showDialog;

  if (route.customerId && !adminSt.selectedCustomerId) {
    adminSt.selectedCustomerId = route.customerId;
  }

  const shell = document.createElement('div');
  shell.className = 'admin-shell';
  _adminRoot = shell;

  shell.appendChild(buildRail());
  shell.appendChild(buildPanel());

  return shell;
}

// ─── Left rail (customer list) ────────────────────────────────────────────

function buildRail() {
  const rail = document.createElement('aside');
  rail.className = 'admin-rail';
  rail.innerHTML = `
    <div class="rail-header">
      <span class="rail-title">Customers</span>
      <button class="btn btn-primary btn-sm" id="rail-add-btn" aria-label="Add customer">
        <i data-lucide="plus" class="icon" aria-hidden="true"></i>
        Add
      </button>
    </div>
    <div class="rail-list" id="rail-list" role="listbox" aria-label="Customer list"></div>
  `;
  rail.querySelector('#rail-add-btn').addEventListener('click', () => openCreateCustomerDialog());
  fillRailList(rail.querySelector('#rail-list'));
  return rail;
}

function fillRailList(container) {
  container.innerHTML = '';
  const customers = state.config.customers;
  if (customers.length === 0) {
    container.innerHTML = `<p class="rail-empty">No customers yet.</p>`;
    return;
  }
  customers.forEach((customer) => {
    container.appendChild(buildRailItem(customer));
  });
}

function buildRailItem(customer) {
  const isSelected = customer.id === adminSt.selectedCustomerId;
  const item = document.createElement('div');
  item.className = `rail-item${isSelected ? ' selected' : ''}`;
  item.draggable = true;
  item.dataset.id = customer.id;
  item.setAttribute('role', 'option');
  item.setAttribute('aria-selected', isSelected ? 'true' : 'false');

  const initials = escapeHtml(customer.name.slice(0, 2).toUpperCase());

  item.innerHTML = `
    <span class="drag-handle rail-drag" aria-hidden="true">
      <i data-lucide="grip-vertical" class="icon icon-sm" aria-hidden="true"></i>
    </span>
    <button class="rail-item-btn" data-id="${escapeHtml(customer.id)}" aria-label="Edit ${escapeHtml(customer.name)}">
      ${customer.logoUrl
        ? `<img src="${escapeHtml(customer.logoUrl)}" alt="" class="rail-avatar" aria-hidden="true">`
        : `<span class="rail-avatar rail-avatar-initials" aria-hidden="true">${initials}</span>`
      }
      <span class="rail-item-name">${escapeHtml(customer.name)}</span>
    </button>
    <button class="btn-ghost btn-icon rail-delete" data-id="${escapeHtml(customer.id)}" aria-label="Delete ${escapeHtml(customer.name)}">
      <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
    </button>
  `;

  item.querySelector('.rail-item-btn').addEventListener('click', () => selectCustomer(customer.id));
  item.querySelector('.rail-delete').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDeleteCustomer(customer.id, customer.name);
  });

  attachDrag(item, 'customer');
  return item;
}

function selectCustomer(id) {
  adminSt.selectedCustomerId = id;
  adminSt.activeTab = 'profile';
  rerenderAdmin();
}

// ─── Right panel ──────────────────────────────────────────────────────────

function buildPanel() {
  const panel = document.createElement('div');
  panel.className = 'admin-panel';

  const customer = adminSt.selectedCustomerId
    ? state.config.customers.find(c => c.id === adminSt.selectedCustomerId)
    : null;

  if (!customer) {
    panel.innerHTML = `
      <div class="empty-state panel-empty-state">
        <i data-lucide="mouse-pointer-click" class="icon empty-state-icon" aria-hidden="true"></i>
        <h2 class="empty-state-title">Select a customer</h2>
        <p class="empty-state-desc">Pick a customer from the list to edit it, or create a new one.</p>
        <button class="btn btn-primary" id="panel-add-btn">
          <i data-lucide="plus" class="icon" aria-hidden="true"></i>
          Add your first customer
        </button>
      </div>
    `;
    panel.querySelector('#panel-add-btn').addEventListener('click', () => openCreateCustomerDialog());
    return panel;
  }

  const TABS = [
    { id: 'profile',     label: 'Profile',              icon: 'user' },
    { id: 'modules',     label: 'Modules & Submodules', icon: 'layout' },
    { id: 'variables',   label: 'Variables',            icon: 'hash' },
    { id: 'importexport',label: 'Import / Export',      icon: 'download' },
  ];

  const tabBar = document.createElement('div');
  tabBar.className = 'panel-tabbar';
  tabBar.setAttribute('role', 'tablist');

  TABS.forEach(tab => {
    const btn = document.createElement('button');
    const isActive = tab.id === adminSt.activeTab;
    btn.className = `panel-tab${isActive ? ' active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('id', `ptab-${tab.id}`);
    btn.innerHTML = `
      <i data-lucide="${tab.icon}" class="icon" aria-hidden="true"></i>
      <span>${tab.label}</span>
    `;
    btn.addEventListener('click', () => {
      adminSt.activeTab = tab.id;
      rerenderAdmin();
    });
    tabBar.appendChild(btn);
  });
  panel.appendChild(tabBar);

  const content = document.createElement('div');
  content.className = 'panel-content';
  content.setAttribute('role', 'tabpanel');

  if      (adminSt.activeTab === 'profile')      content.appendChild(buildProfileTab(customer));
  else if (adminSt.activeTab === 'modules')      content.appendChild(buildModulesTab(customer));
  else if (adminSt.activeTab === 'variables')    content.appendChild(buildVariablesTab(customer));
  else if (adminSt.activeTab === 'importexport') content.appendChild(buildImportExportTab());

  panel.appendChild(content);
  return panel;
}

// ─── Profile tab ──────────────────────────────────────────────────────────

function buildProfileTab(customer) {
  const div = document.createElement('div');
  div.className = 'profile-tab';
  div.innerHTML = `
    <h3 class="tab-section-title">Customer Profile</h3>
    <div class="form-group">
      <label for="cust-name" class="form-label">Customer name <span class="req" aria-hidden="true">*</span></label>
      <input id="cust-name" type="text" class="form-input" value="${escapeHtml(customer.name)}" maxlength="80" placeholder="e.g. ACME Construction" autocomplete="off">
    </div>
    <div class="form-group">
      <label for="cust-id" class="form-label">ID (slug)</label>
      <input id="cust-id" type="text" class="form-input" value="${escapeHtml(customer.id)}" disabled aria-describedby="cust-id-hint">
      <p id="cust-id-hint" class="form-hint">Auto-generated. Cannot be changed after creation.</p>
    </div>
    <div class="form-group">
      <label for="cust-logo" class="form-label">Logo URL</label>
      <input id="cust-logo" type="url" class="form-input" value="${escapeHtml(customer.logoUrl)}" placeholder="https://example.com/logo.svg" autocomplete="off">
      <p class="form-hint">HTTP/HTTPS URL to the customer logo image.</p>
    </div>
    <div class="logo-preview-row">
      <div class="logo-preview" id="logo-preview">
        ${buildLogoPreview(customer.logoUrl)}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" id="save-profile-btn">
        <i data-lucide="save" class="icon" aria-hidden="true"></i>
        Save profile
      </button>
    </div>
  `;

  const logoInput = div.querySelector('#cust-logo');
  const preview   = div.querySelector('#logo-preview');

  logoInput.addEventListener('input', () => {
    preview.innerHTML = buildLogoPreview(logoInput.value.trim());
  });

  div.querySelector('#save-profile-btn').addEventListener('click', () => {
    const name    = div.querySelector('#cust-name').value.trim();
    const logoUrl = logoInput.value.trim();
    if (!name) { _showToast('Customer name is required', 'error'); return; }
    const result = updateCustomer(customer.id, { name, logoUrl });
    if (result.valid) {
      _showToast('Profile saved', 'success');
      rerenderAdmin();
    } else {
      _showToast(`Error: ${result.errors[0]?.message}`, 'error');
    }
  });

  return div;
}

function buildLogoPreview(url) {
  if (!url) return `<span class="logo-preview-placeholder">No logo</span>`;
  return `<img src="${escapeHtml(url)}" alt="Logo preview" class="logo-preview-img" onerror="this.parentNode.innerHTML='<span class=logo-preview-error>Could not load image</span>'">`;
}

// ─── Modules tab ──────────────────────────────────────────────────────────

function buildModulesTab(customer) {
  const div = document.createElement('div');
  div.className = 'modules-tab';

  const hdr = document.createElement('div');
  hdr.className = 'tab-section-header';
  hdr.innerHTML = `
    <h3 class="tab-section-title">Modules &amp; Submodules</h3>
    <button class="btn btn-primary btn-sm" id="add-mod-btn">
      <i data-lucide="plus" class="icon" aria-hidden="true"></i>
      Add Module
    </button>
  `;
  hdr.querySelector('#add-mod-btn').addEventListener('click', () => openCreateModuleDialog(customer.id));
  div.appendChild(hdr);

  const modules = customer.modules || [];
  if (modules.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'inline-empty';
    empty.innerHTML = `<i data-lucide="layout" class="icon" aria-hidden="true"></i> No modules yet. Add one above.`;
    div.appendChild(empty);
    return div;
  }

  const accordion = document.createElement('div');
  accordion.className = 'mod-accordion';
  accordion.dataset.customerId = customer.id;

  modules.forEach(mod => accordion.appendChild(buildModuleBlock(customer, mod)));
  div.appendChild(accordion);
  setupModuleDrag(accordion, customer.id);
  return div;
}

function buildModuleBlock(customer, mod) {
  const isOpen = adminSt.expandedModules.has(mod.id);

  const block = document.createElement('div');
  block.className = `mod-block${isOpen ? ' open' : ''}`;
  block.dataset.id = mod.id;
  block.draggable = true;

  const header = document.createElement('div');
  header.className = 'mod-block-header';
  header.innerHTML = `
    <span class="drag-handle mod-drag" aria-hidden="true">
      <i data-lucide="grip-vertical" class="icon icon-sm" aria-hidden="true"></i>
    </span>
    <button class="mod-toggle btn-ghost" aria-expanded="${isOpen}" aria-controls="mod-body-${escapeHtml(mod.id)}">
      <i data-lucide="${escapeHtml(mod.icon || 'square')}" class="icon" aria-hidden="true"></i>
      <span class="mod-name">${escapeHtml(mod.name)}</span>
      <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" class="icon icon-sm mod-chevron" aria-hidden="true"></i>
    </button>
    <div class="mod-actions">
      <button class="btn-ghost btn-icon mod-edit" aria-label="Edit ${escapeHtml(mod.name)}">
        <i data-lucide="pencil" class="icon icon-sm" aria-hidden="true"></i>
      </button>
      <button class="btn-ghost btn-icon btn-icon-danger mod-delete" aria-label="Delete ${escapeHtml(mod.name)}">
        <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
      </button>
    </div>
  `;

  header.querySelector('.mod-toggle').addEventListener('click', () => {
    if (adminSt.expandedModules.has(mod.id)) adminSt.expandedModules.delete(mod.id);
    else adminSt.expandedModules.add(mod.id);
    rerenderAdmin();
  });
  header.querySelector('.mod-edit').addEventListener('click', () => openEditModuleDialog(customer.id, mod));
  header.querySelector('.mod-delete').addEventListener('click', () => confirmDeleteModule(customer.id, mod.id, mod.name));

  block.appendChild(header);

  if (isOpen) {
    const body = document.createElement('div');
    body.className = 'mod-block-body';
    body.id = `mod-body-${mod.id}`;
    body.appendChild(buildSubmoduleList(customer, mod));

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-ghost btn-sm add-sub-btn';
    addBtn.innerHTML = `<i data-lucide="plus" class="icon" aria-hidden="true"></i> Add Submodule`;
    addBtn.addEventListener('click', () => openCreateSubmoduleDialog(customer.id, mod.id));
    body.appendChild(addBtn);

    block.appendChild(body);
  }

  return block;
}

function buildSubmoduleList(customer, mod) {
  const subs = mod.submodules || [];
  if (subs.length === 0) {
    const p = document.createElement('p');
    p.className = 'inline-empty';
    p.textContent = 'No submodules. Add one below.';
    return p;
  }

  const list = document.createElement('div');
  list.className = 'sub-list';
  list.dataset.moduleId = mod.id;
  list.dataset.customerId = customer.id;

  subs.forEach(sub => list.appendChild(buildSubmoduleRow(customer, mod, sub)));
  setupSubmoduleDrag(list, customer.id, mod.id);
  return list;
}

function buildSubmoduleRow(customer, mod, sub) {
  const missing = getMissingTokens(sub.url, sub.urlMode, sub.variables || {}, customer.variables || {});

  const row = document.createElement('div');
  row.className = 'sub-row';
  row.draggable = true;
  row.dataset.subId = sub.id;

  row.innerHTML = `
    <span class="drag-handle sub-drag" aria-hidden="true">
      <i data-lucide="grip-vertical" class="icon icon-sm" aria-hidden="true"></i>
    </span>
    <i data-lucide="${escapeHtml(sub.icon || 'square')}" class="icon icon-sm sub-row-icon" aria-hidden="true"></i>
    <span class="sub-row-name">${escapeHtml(sub.name)}</span>
    ${missing.length > 0
      ? `<span class="missing-chip" title="Missing: ${missing.map(escapeHtml).join(', ')}">
           <i data-lucide="alert-triangle" class="icon icon-xs" aria-hidden="true"></i>
           ${missing.length} missing
         </span>`
      : ''
    }
    <div class="sub-row-actions">
      <button class="btn-ghost btn-icon sub-edit" aria-label="Edit ${escapeHtml(sub.name)}">
        <i data-lucide="pencil" class="icon icon-sm" aria-hidden="true"></i>
      </button>
      <button class="btn-ghost btn-icon btn-icon-danger sub-delete" aria-label="Delete ${escapeHtml(sub.name)}">
        <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
      </button>
    </div>
  `;

  row.querySelector('.sub-edit').addEventListener('click', () => openEditSubmoduleDialog(customer.id, mod.id, sub));
  row.querySelector('.sub-delete').addEventListener('click', () => confirmDeleteSubmodule(customer.id, mod.id, sub.id, sub.name));
  return row;
}

// ─── Variables tab ────────────────────────────────────────────────────────

function buildVariablesTab(customer) {
  const div = document.createElement('div');
  div.className = 'variables-tab';
  div.innerHTML = `
    <h3 class="tab-section-title">Customer Variables</h3>
    <p class="tab-section-desc">
      Key/value pairs available as <code>{variableName}</code> in all submodule URL templates for this customer.
      Submodules can override individual keys for themselves.
    </p>
    <div class="var-editor" id="var-editor"></div>
    <button class="btn btn-ghost btn-sm" id="add-var-btn">
      <i data-lucide="plus" class="icon" aria-hidden="true"></i>
      Add variable
    </button>
    <div class="form-actions">
      <button class="btn btn-primary" id="save-vars-btn">
        <i data-lucide="save" class="icon" aria-hidden="true"></i>
        Save variables
      </button>
    </div>
  `;

  let vars = { ...(customer.variables || {}) };
  const editor = div.querySelector('#var-editor');

  function redrawVars() {
    editor.innerHTML = '';
    Object.entries(vars).forEach(([k, v]) => {
      editor.appendChild(buildVarRow(k, v, vars, redrawVars));
    });
    refreshIcons(editor);
  }

  redrawVars();

  div.querySelector('#add-var-btn').addEventListener('click', () => {
    let key = 'newVariable';
    let i = 1;
    while (Object.prototype.hasOwnProperty.call(vars, key)) key = `newVariable${i++}`;
    vars[key] = '';
    redrawVars();
    const inputs = editor.querySelectorAll('.var-key');
    inputs[inputs.length - 1]?.focus();
    inputs[inputs.length - 1]?.select();
  });

  div.querySelector('#save-vars-btn').addEventListener('click', () => {
    const current = collectVarsFromEditor(editor);
    const result  = updateCustomer(customer.id, { variables: current });
    if (result.valid) {
      _showToast('Variables saved', 'success');
      vars = { ...current };
    } else {
      _showToast(`Error: ${result.errors[0]?.message}`, 'error');
    }
  });

  return div;
}

function buildVarRow(key, value, vars, redrawVars) {
  const row = document.createElement('div');
  row.className = 'var-row';
  row.innerHTML = `
    <input type="text" class="form-input var-key" value="${escapeHtml(key)}" placeholder="variableName" data-orig="${escapeHtml(key)}" aria-label="Variable name">
    <input type="text" class="form-input var-value" value="${escapeHtml(value)}" placeholder="value" data-key="${escapeHtml(key)}" aria-label="Variable value for ${escapeHtml(key)}">
    <button class="btn-ghost btn-icon btn-icon-danger var-delete" aria-label="Delete variable ${escapeHtml(key)}">
      <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
    </button>
  `;
  row.querySelector('.var-delete').addEventListener('click', () => {
    delete vars[key];
    redrawVars();
  });
  row.querySelector('.var-key').addEventListener('change', (e) => {
    const newKey = e.target.value.trim();
    const orig   = e.target.dataset.orig;
    if (newKey && newKey !== orig) {
      const val = vars[orig];
      delete vars[orig];
      vars[newKey] = val;
      redrawVars();
    }
  });
  row.querySelector('.var-value').addEventListener('change', (e) => {
    vars[e.target.dataset.key] = e.target.value;
  });
  return row;
}

function collectVarsFromEditor(editor) {
  const result = {};
  editor.querySelectorAll('.var-row').forEach(row => {
    const k = row.querySelector('.var-key')?.value.trim();
    const v = row.querySelector('.var-value')?.value || '';
    if (k) result[k] = v;
  });
  return result;
}

// ─── Import / Export tab ──────────────────────────────────────────────────

function buildImportExportTab() {
  const div = document.createElement('div');
  div.className = 'importexport-tab';

  div.innerHTML = `
    <h3 class="tab-section-title">Export</h3>
    <p class="tab-section-desc">
      Download the current configuration as a JSON file. Commit this file to your repo to share or back it up.
      ${state.dirty ? '<span class="dirty-badge"><i data-lucide="alert-circle" class="icon icon-xs" aria-hidden="true"></i> Unsaved changes</span>' : ''}
    </p>
    <button class="btn btn-primary" id="export-btn">
      <i data-lucide="download" class="icon" aria-hidden="true"></i>
      Export config.json
    </button>

    <hr class="tab-divider">

    <h3 class="tab-section-title">Import</h3>
    <p class="tab-section-desc">Upload a previously exported <code>config.json</code>. Current data will be replaced after confirmation.</p>
    <div class="import-row">
      <label for="import-file" class="btn btn-outline import-label" aria-label="Choose a config.json file to import">
        <i data-lucide="upload" class="icon" aria-hidden="true"></i>
        Choose file
      </label>
      <input type="file" id="import-file" accept=".json,application/json" class="file-input-hidden" aria-label="Config file">
      <span id="import-filename" class="import-filename" aria-live="polite">No file chosen</span>
    </div>
    <div id="import-errors" class="import-errors" hidden></div>
    <button class="btn btn-primary" id="import-btn" disabled>
      <i data-lucide="check" class="icon" aria-hidden="true"></i>
      Import
    </button>

    <hr class="tab-divider">

    <h3 class="tab-section-title">Reset</h3>
    <p class="tab-section-desc">Delete all configuration and start fresh. Export first if you want to keep your data.</p>
    <button class="btn btn-danger" id="reset-btn">
      <i data-lucide="trash-2" class="icon" aria-hidden="true"></i>
      Reset to empty
    </button>
  `;

  div.querySelector('#export-btn').addEventListener('click', () => {
    const date     = new Date().toISOString().slice(0, 10);
    const filename = `config-${date}.json`;
    const blob     = new Blob([JSON.stringify(state.config, null, 2)], { type: 'application/json' });
    const url      = URL.createObjectURL(blob);
    const a        = document.createElement('a');
    a.href         = url;
    a.download     = filename;
    a.click();
    URL.revokeObjectURL(url);
    markExported();
    _showToast(`Exported ${filename}`, 'success');
  });

  let pendingImport = null;

  div.querySelector('#import-file').addEventListener('change', (e) => {
    const file      = e.target.files[0];
    const errDiv    = div.querySelector('#import-errors');
    const importBtn = div.querySelector('#import-btn');
    pendingImport   = null;

    if (!file) {
      div.querySelector('#import-filename').textContent = 'No file chosen';
      errDiv.hidden = true;
      importBtn.disabled = true;
      return;
    }

    div.querySelector('#import-filename').textContent = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const result = validate(parsed);
        if (result.valid) {
          pendingImport      = parsed;
          errDiv.hidden      = true;
          importBtn.disabled = false;
        } else {
          errDiv.hidden      = false;
          errDiv.innerHTML   = `
            <p class="import-error-head">
              <i data-lucide="alert-circle" class="icon icon-sm" aria-hidden="true"></i>
              Validation errors in file:
            </p>
            <ul class="import-error-list">
              ${result.errors.map(e =>
                `<li><code>${escapeHtml(e.path)}</code>: ${escapeHtml(e.message)}</li>`
              ).join('')}
            </ul>
          `;
          importBtn.disabled = true;
          pendingImport      = null;
          refreshIcons(errDiv);
        }
      } catch {
        errDiv.hidden    = false;
        errDiv.textContent = 'File is not valid JSON.';
        importBtn.disabled = true;
      }
    };
    reader.readAsText(file);
  });

  div.querySelector('#import-btn').addEventListener('click', async () => {
    if (!pendingImport) return;
    const custCount = pendingImport.customers?.length ?? 0;
    const modCount  = (pendingImport.customers || []).reduce((a, c) => a + (c.modules?.length ?? 0), 0);
    const subCount  = (pendingImport.customers || []).reduce(
      (a, c) => a + (c.modules || []).reduce((b, m) => b + (m.submodules?.length ?? 0), 0), 0
    );

    const ok = await _showDialog({
      title: 'Confirm import',
      body: `
        <p>This will replace your current configuration with:</p>
        <ul class="dialog-list">
          <li><strong>${custCount}</strong> customer${custCount !== 1 ? 's' : ''}</li>
          <li><strong>${modCount}</strong> module${modCount !== 1 ? 's' : ''}</li>
          <li><strong>${subCount}</strong> submodule${subCount !== 1 ? 's' : ''}</li>
        </ul>
        <p>Your current data will be lost unless you exported it first.</p>
      `,
      confirmText: 'Yes, import',
    });

    if (!ok) return;
    const result = updateConfig(pendingImport);
    if (result.valid) {
      adminSt.selectedCustomerId = null;
      adminSt.activeTab = 'profile';
      _showToast('Configuration imported', 'success');
      rerenderAdmin();
    } else {
      _showToast('Import failed: ' + result.errors[0]?.message, 'error');
    }
  });

  div.querySelector('#reset-btn').addEventListener('click', async () => {
    const ok = await _showDialog({
      title: 'Reset configuration?',
      body: `
        <p>This permanently deletes <strong>all</strong> customers, modules, submodules, and variables.</p>
        <p>Export your configuration first if you want to keep it.</p>
      `,
      confirmText: 'Reset everything',
      danger: true,
    });
    if (!ok) return;
    const empty = emptyConfig();
    empty.theme = state.config.theme;
    updateConfig(empty);
    adminSt.selectedCustomerId = null;
    adminSt.activeTab = 'profile';
    _showToast('Configuration reset', 'success');
    rerenderAdmin();
  });

  return div;
}

// ─── Create / edit dialogs ────────────────────────────────────────────────

async function openCreateCustomerDialog() {
  const ok = await _showDialog({
    title: 'Add customer',
    body: `
      <div class="form-group">
        <label for="dlg-cust-name" class="form-label">Name <span class="req" aria-hidden="true">*</span></label>
        <input id="dlg-cust-name" type="text" class="form-input" placeholder="e.g. ACME Construction" maxlength="80" autocomplete="off">
      </div>
      <div class="form-group">
        <label for="dlg-cust-logo" class="form-label">Logo URL</label>
        <input id="dlg-cust-logo" type="url" class="form-input" placeholder="https://example.com/logo.svg" autocomplete="off">
      </div>
    `,
    confirmText: 'Create',
  });

  if (!ok) return;
  const name    = document.querySelector('#dlg-cust-name')?.value.trim();
  const logoUrl = document.querySelector('#dlg-cust-logo')?.value.trim() || '';
  if (!name) { _showToast('Name is required', 'error'); return; }

  const existing = state.config.customers.map(c => c.id);
  const id       = ensureUniqueSlug(toSlug(name), existing);
  const result   = addCustomer({ id, name, logoUrl, variables: {}, modules: [] });

  if (result.valid) {
    adminSt.selectedCustomerId = id;
    adminSt.activeTab = 'profile';
    _showToast(`"${name}" created`, 'success');
    rerenderAdmin();
  } else {
    _showToast('Error: ' + result.errors[0]?.message, 'error');
  }
}

async function confirmDeleteCustomer(id, name) {
  const ok = await _showDialog({
    title: `Delete "${escapeHtml(name)}"?`,
    body: `<p>This permanently deletes this customer and all its modules and submodules.</p>`,
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  if (adminSt.selectedCustomerId === id) adminSt.selectedCustomerId = null;
  deleteCustomer(id);
  _showToast(`"${name}" deleted`, 'success');
  rerenderAdmin();
}

async function openCreateModuleDialog(customerId) {
  let selectedIcon = 'layout';

  const ok = await _showDialog({
    title: 'Add module',
    body: `
      <div class="form-group">
        <label for="dlg-mod-name" class="form-label">Module name <span class="req" aria-hidden="true">*</span></label>
        <input id="dlg-mod-name" type="text" class="form-input" placeholder="e.g. Operations" maxlength="60" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <button type="button" class="btn btn-outline icon-pick-btn" id="dlg-mod-icon-btn">
          <i data-lucide="${selectedIcon}" id="dlg-mod-icon-el" class="icon" aria-hidden="true"></i>
          <span id="dlg-mod-icon-name">${escapeHtml(selectedIcon)}</span>
          <i data-lucide="chevron-down" class="icon icon-sm" aria-hidden="true"></i>
        </button>
      </div>
    `,
    confirmText: 'Create',
    onReady: (overlay) => {
      overlay.querySelector('#dlg-mod-icon-btn')?.addEventListener('click', async () => {
        const icon = await openIconPicker(selectedIcon);
        if (icon) {
          selectedIcon = icon;
          const el = overlay.querySelector('#dlg-mod-icon-el');
          const nm = overlay.querySelector('#dlg-mod-icon-name');
          if (el) el.setAttribute('data-lucide', icon);
          if (nm) nm.textContent = icon;
          refreshIcons(overlay);
        }
      });
    },
  });

  if (!ok) return;
  const name = document.querySelector('#dlg-mod-name')?.value.trim();
  if (!name) { _showToast('Module name is required', 'error'); return; }

  const customer  = state.config.customers.find(c => c.id === customerId);
  const existing  = (customer?.modules || []).map(m => m.id);
  const id        = ensureUniqueSlug(toSlug(name), existing);
  const result    = addModule(customerId, { id, name, icon: selectedIcon, submodules: [] });

  if (result.valid) {
    adminSt.expandedModules.add(id);
    _showToast(`Module "${name}" added`, 'success');
    rerenderAdmin();
  } else {
    _showToast('Error: ' + result.errors[0]?.message, 'error');
  }
}

async function openEditModuleDialog(customerId, mod) {
  let selectedIcon = mod.icon || 'layout';

  const ok = await _showDialog({
    title: 'Edit module',
    body: `
      <div class="form-group">
        <label for="dlg-mod-name" class="form-label">Module name <span class="req" aria-hidden="true">*</span></label>
        <input id="dlg-mod-name" type="text" class="form-input" value="${escapeHtml(mod.name)}" maxlength="60" autocomplete="off">
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <button type="button" class="btn btn-outline icon-pick-btn" id="dlg-mod-icon-btn">
          <i data-lucide="${escapeHtml(selectedIcon)}" id="dlg-mod-icon-el" class="icon" aria-hidden="true"></i>
          <span id="dlg-mod-icon-name">${escapeHtml(selectedIcon)}</span>
          <i data-lucide="chevron-down" class="icon icon-sm" aria-hidden="true"></i>
        </button>
      </div>
    `,
    confirmText: 'Save',
    onReady: (overlay) => {
      overlay.querySelector('#dlg-mod-icon-btn')?.addEventListener('click', async () => {
        const icon = await openIconPicker(selectedIcon);
        if (icon) {
          selectedIcon = icon;
          const el = overlay.querySelector('#dlg-mod-icon-el');
          const nm = overlay.querySelector('#dlg-mod-icon-name');
          if (el) el.setAttribute('data-lucide', icon);
          if (nm) nm.textContent = icon;
          refreshIcons(overlay);
        }
      });
    },
  });

  if (!ok) return;
  const name = document.querySelector('#dlg-mod-name')?.value.trim();
  if (!name) { _showToast('Module name is required', 'error'); return; }

  const result = updateModule(customerId, mod.id, { name, icon: selectedIcon });
  if (result.valid) {
    _showToast(`"${name}" updated`, 'success');
    rerenderAdmin();
  } else {
    _showToast('Error: ' + result.errors[0]?.message, 'error');
  }
}

async function confirmDeleteModule(customerId, moduleId, name) {
  const ok = await _showDialog({
    title: `Delete module "${escapeHtml(name)}"?`,
    body: `<p>This deletes the module and all its submodules.</p>`,
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  adminSt.expandedModules.delete(moduleId);
  deleteModule(customerId, moduleId);
  _showToast(`"${name}" deleted`, 'success');
  rerenderAdmin();
}

async function openCreateSubmoduleDialog(customerId, moduleId) {
  let selectedIcon = 'box';

  const ok = await _showDialog({
    title: 'Add submodule',
    body: buildSubmoduleFormHtml({ icon: selectedIcon }),
    confirmText: 'Add',
    onReady: (overlay) => wireSubmoduleFormListeners(overlay, () => selectedIcon, (v) => { selectedIcon = v; }),
  });

  if (!ok) return;

  const name    = document.querySelector('#dlg-sub-name')?.value.trim();
  const desc    = document.querySelector('#dlg-sub-desc')?.value.trim() || '';
  const urlMode = document.querySelector('input[name="dlg-urlmode"]:checked')?.value || 'fixed';
  const url     = document.querySelector('#dlg-sub-url')?.value.trim();

  if (!name) { _showToast('Name is required', 'error'); return; }
  if (!url)  { _showToast('URL is required', 'error'); return; }

  const customer = state.config.customers.find(c => c.id === customerId);
  const mod      = customer?.modules?.find(m => m.id === moduleId);
  const existing = (mod?.submodules || []).map(s => s.id);
  const id       = ensureUniqueSlug(toSlug(name), existing);

  const result = addSubmodule(customerId, moduleId, {
    id, name, icon: selectedIcon, description: desc, urlMode, url, variables: {}
  });

  if (result.valid) {
    _showToast(`"${name}" added`, 'success');
    rerenderAdmin();
  } else {
    _showToast('Error: ' + result.errors[0]?.message, 'error');
  }
}

async function openEditSubmoduleDialog(customerId, moduleId, sub) {
  let selectedIcon  = sub.icon || 'box';
  let localSubVars  = { ...(sub.variables || {}) };
  const customer    = state.config.customers.find(c => c.id === customerId);

  const ok = await _showDialog({
    title: `Edit: ${escapeHtml(sub.name)}`,
    body: buildSubmoduleFormHtml(sub, localSubVars),
    confirmText: 'Save',
    onReady: (overlay) => {
      wireSubmoduleFormListeners(overlay, () => selectedIcon, (v) => { selectedIcon = v; });
      wireSubVarEditor(overlay, localSubVars, customer);
      wireTestUrl(overlay, localSubVars, customer);
    },
  });

  if (!ok) return;

  // Collect latest form values (overlay is still in DOM at this point)
  const name    = document.querySelector('#dlg-sub-name')?.value.trim();
  const desc    = document.querySelector('#dlg-sub-desc')?.value.trim() || '';
  const urlMode = document.querySelector('input[name="dlg-urlmode"]:checked')?.value || 'fixed';
  const url     = document.querySelector('#dlg-sub-url')?.value.trim();

  // Collect latest subVar values
  document.querySelectorAll('#dlg-subvars .var-row').forEach(row => {
    const k = row.querySelector('.var-key')?.value.trim();
    const v = row.querySelector('.var-value')?.value || '';
    if (k) localSubVars[k] = v;
  });

  if (!name) { _showToast('Name is required', 'error'); return; }
  if (!url)  { _showToast('URL is required', 'error'); return; }

  const result = updateSubmodule(customerId, moduleId, sub.id, {
    name, icon: selectedIcon, description: desc, urlMode, url, variables: localSubVars
  });

  if (result.valid) {
    _showToast(`"${name}" saved`, 'success');
    rerenderAdmin();
  } else {
    _showToast('Error: ' + result.errors[0]?.message, 'error');
  }
}

async function confirmDeleteSubmodule(customerId, moduleId, subId, name) {
  const ok = await _showDialog({
    title: `Delete "${escapeHtml(name)}"?`,
    body: `<p>This cannot be undone.</p>`,
    confirmText: 'Delete',
    danger: true,
  });
  if (!ok) return;
  deleteSubmodule(customerId, moduleId, subId);
  _showToast(`"${name}" deleted`, 'success');
  rerenderAdmin();
}

// ─── Submodule form helpers ───────────────────────────────────────────────

function buildSubmoduleFormHtml(sub = {}, subVars = {}) {
  const icon    = sub.icon    || 'box';
  const urlMode = sub.urlMode || 'fixed';
  const hasSubVars = Object.keys(subVars).length > 0;

  return `
    <div class="form-group">
      <label for="dlg-sub-name" class="form-label">Name <span class="req" aria-hidden="true">*</span></label>
      <input id="dlg-sub-name" type="text" class="form-input" value="${escapeHtml(sub.name || '')}" maxlength="60" placeholder="e.g. Issues" autocomplete="off">
    </div>
    <div class="form-group">
      <label class="form-label">Icon</label>
      <button type="button" class="btn btn-outline icon-pick-btn" id="dlg-sub-icon-btn">
        <i data-lucide="${escapeHtml(icon)}" id="dlg-sub-icon-el" class="icon" aria-hidden="true"></i>
        <span id="dlg-sub-icon-name">${escapeHtml(icon)}</span>
        <i data-lucide="chevron-down" class="icon icon-sm" aria-hidden="true"></i>
      </button>
    </div>
    <div class="form-group">
      <label for="dlg-sub-desc" class="form-label">Description</label>
      <input id="dlg-sub-desc" type="text" class="form-input" value="${escapeHtml(sub.description || '')}" maxlength="200" placeholder="Short description" autocomplete="off">
    </div>
    <div class="form-group">
      <fieldset class="radio-fieldset">
        <legend class="form-label">URL mode</legend>
        <label class="radio-label">
          <input type="radio" name="dlg-urlmode" value="fixed" ${urlMode === 'fixed' ? 'checked' : ''}>
          Fixed URL
        </label>
        <label class="radio-label">
          <input type="radio" name="dlg-urlmode" value="template" ${urlMode === 'template' ? 'checked' : ''}>
          Template URL (with <code>{variables}</code>)
        </label>
      </fieldset>
    </div>
    <div class="form-group">
      <label for="dlg-sub-url" class="form-label">URL <span class="req" aria-hidden="true">*</span></label>
      <input id="dlg-sub-url" type="text" class="form-input" value="${escapeHtml(sub.url || '')}" placeholder="https://example.com/...">
      <p class="form-hint">Use <code>{variableName}</code> tokens in template mode.</p>
    </div>
    ${sub.id !== undefined ? `
      <div class="form-group">
        <label class="form-label">Submodule variable overrides</label>
        <p class="form-hint">These override customer-level variables for this submodule only.</p>
        <div class="var-editor" id="dlg-subvars">
          ${Object.entries(subVars).map(([k, v]) => `
            <div class="var-row">
              <input type="text" class="form-input var-key" value="${escapeHtml(k)}" placeholder="variableName" data-orig="${escapeHtml(k)}" aria-label="Variable name">
              <input type="text" class="form-input var-value" value="${escapeHtml(v)}" placeholder="value" data-key="${escapeHtml(k)}" aria-label="Variable value">
              <button type="button" class="btn-ghost btn-icon btn-icon-danger var-delete" aria-label="Delete variable ${escapeHtml(k)}">
                <i data-lucide="trash-2" class="icon icon-sm" aria-hidden="true"></i>
              </button>
            </div>
          `).join('')}
        </div>
        <button type="button" class="btn btn-ghost btn-sm" id="dlg-add-subvar">
          <i data-lucide="plus" class="icon" aria-hidden="true"></i>
          Add override
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Test URL</label>
        <div class="test-url-row">
          <button type="button" class="btn btn-outline" id="dlg-test-btn">
            <i data-lucide="play-circle" class="icon" aria-hidden="true"></i>
            Test
          </button>
          <button type="button" class="btn btn-outline" id="dlg-open-btn" disabled>
            <i data-lucide="external-link" class="icon" aria-hidden="true"></i>
            Open
          </button>
        </div>
        <div id="dlg-test-result" class="test-result" hidden></div>
      </div>
    ` : ''}
  `;
}

function wireSubmoduleFormListeners(overlay, getIcon, setIcon) {
  overlay.querySelector('#dlg-sub-icon-btn')?.addEventListener('click', async () => {
    const icon = await openIconPicker(getIcon());
    if (icon) {
      setIcon(icon);
      const el = overlay.querySelector('#dlg-sub-icon-el');
      const nm = overlay.querySelector('#dlg-sub-icon-name');
      if (el) el.setAttribute('data-lucide', icon);
      if (nm) nm.textContent = icon;
      refreshIcons(overlay);
    }
  });
  overlay.querySelector('#dlg-mod-icon-btn')?.addEventListener('click', async () => {
    const icon = await openIconPicker(getIcon());
    if (icon) {
      setIcon(icon);
      const el = overlay.querySelector('#dlg-mod-icon-el');
      const nm = overlay.querySelector('#dlg-mod-icon-name');
      if (el) el.setAttribute('data-lucide', icon);
      if (nm) nm.textContent = icon;
      refreshIcons(overlay);
    }
  });
}

function wireSubVarEditor(overlay, localSubVars, customer) {
  const editor = overlay.querySelector('#dlg-subvars');
  if (!editor) return;

  function redraw() {
    editor.innerHTML = '';
    Object.entries(localSubVars).forEach(([k, v]) => {
      editor.appendChild(buildVarRow(k, v, localSubVars, redraw));
    });
    refreshIcons(editor);
  }

  // Replace HTML-rendered placeholder rows with properly event-wired DOM nodes
  redraw();

  overlay.querySelector('#dlg-add-subvar')?.addEventListener('click', () => {
    let key = 'newVar';
    let i   = 1;
    while (Object.prototype.hasOwnProperty.call(localSubVars, key)) key = `newVar${i++}`;
    localSubVars[key] = '';
    redraw();
    const inputs = editor.querySelectorAll('.var-key');
    inputs[inputs.length - 1]?.focus();
  });
}

function wireTestUrl(overlay, localSubVars, customer) {
  const testBtn   = overlay.querySelector('#dlg-test-btn');
  const openBtn   = overlay.querySelector('#dlg-open-btn');
  const resultDiv = overlay.querySelector('#dlg-test-result');
  if (!testBtn || !openBtn || !resultDiv) return;

  let lastResolved = '';

  testBtn.addEventListener('click', () => {
    const urlVal     = overlay.querySelector('#dlg-sub-url')?.value.trim() || '';
    const urlModeVal = overlay.querySelector('input[name="dlg-urlmode"]:checked')?.value || 'fixed';

    // Collect latest subvar values from DOM
    const currentSubVars = {};
    overlay.querySelectorAll('#dlg-subvars .var-row').forEach(row => {
      const k = row.querySelector('.var-key')?.value.trim();
      const v = row.querySelector('.var-value')?.value || '';
      if (k) currentSubVars[k] = v;
    });

    const { resolved, missing } = resolveUrl(urlVal, urlModeVal, currentSubVars, customer?.variables || {});
    lastResolved = resolved;

    resultDiv.hidden = false;

    if (missing.length > 0) {
      let display = escapeHtml(resolved);
      missing.forEach(m => {
        display = display.replace(
          new RegExp(`\\{${escapeHtml(m)}\\}`, 'g'),
          `<mark class="token-missing">{${escapeHtml(m)}}</mark>`
        );
      });
      resultDiv.innerHTML = `
        <p class="test-warn">
          <i data-lucide="alert-triangle" class="icon icon-sm" aria-hidden="true"></i>
          ${missing.length} unresolved token${missing.length > 1 ? 's' : ''}
        </p>
        <div class="test-url-display">${display}</div>
      `;
      openBtn.disabled = true;
    } else {
      resultDiv.innerHTML = `
        <p class="test-ok">
          <i data-lucide="check-circle" class="icon icon-sm" aria-hidden="true"></i>
          Looks good
        </p>
        <div class="test-url-display test-url-copyable">${escapeHtml(resolved)}</div>
        <button type="button" class="btn btn-ghost btn-sm" id="dlg-copy-url">
          <i data-lucide="copy" class="icon icon-sm" aria-hidden="true"></i>
          Copy
        </button>
      `;
      openBtn.disabled = false;
      resultDiv.querySelector('#dlg-copy-url')?.addEventListener('click', () => {
        navigator.clipboard.writeText(lastResolved)
          .then(() => _showToast('URL copied to clipboard', 'success'))
          .catch(() => _showToast('Could not copy URL', 'error'));
      });
    }
    refreshIcons(resultDiv);
  });

  openBtn.addEventListener('click', () => {
    if (lastResolved && !openBtn.disabled) {
      window.open(lastResolved, '_blank', 'noopener,noreferrer');
    }
  });
}

// ─── Drag and drop ────────────────────────────────────────────────────────

let dragSrc = null;

function attachDrag(el, type) {
  el.addEventListener('dragstart', (e) => {
    dragSrc = { el, type, id: el.dataset.id };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', el.dataset.id);
    requestAnimationFrame(() => el.classList.add('dragging'));
  });
  el.addEventListener('dragend', () => {
    el.classList.remove('dragging');
    _adminRoot?.querySelectorAll('.drag-over').forEach(d => d.classList.remove('drag-over'));
    dragSrc = null;
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dragSrc?.type === type && dragSrc.el !== el) {
      e.dataTransfer.dropEffect = 'move';
      el.classList.add('drag-over');
    }
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag-over');
    if (!dragSrc || dragSrc.type !== type || dragSrc.el === el) return;

    if (type === 'customer') {
      const list    = [...state.config.customers];
      const fromIdx = list.findIndex(c => c.id === dragSrc.id);
      const toIdx   = list.findIndex(c => c.id === el.dataset.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [item] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, item);
      reorderCustomers(list);
      rerenderAdmin();
    }
  });
}

function setupModuleDrag(accordion, customerId) {
  const blocks = accordion.querySelectorAll('.mod-block');
  blocks.forEach(block => {
    block.addEventListener('dragstart', (e) => {
      if (!e.target.closest('.mod-block') || e.target.closest('.sub-list')) return;
      dragSrc = { el: block, type: 'module', id: block.dataset.id, customerId };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', block.dataset.id);
      requestAnimationFrame(() => block.classList.add('dragging'));
    });
    block.addEventListener('dragend', () => {
      block.classList.remove('dragging');
      accordion.querySelectorAll('.drag-over').forEach(d => d.classList.remove('drag-over'));
      dragSrc = null;
    });
    block.addEventListener('dragover', (e) => {
      if (dragSrc?.type !== 'module' || dragSrc.el === block) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      block.classList.add('drag-over');
    });
    block.addEventListener('dragleave', () => block.classList.remove('drag-over'));
    block.addEventListener('drop', (e) => {
      e.preventDefault();
      block.classList.remove('drag-over');
      if (!dragSrc || dragSrc.type !== 'module' || dragSrc.el === block) return;
      const customer = state.config.customers.find(c => c.id === customerId);
      if (!customer) return;
      const list    = [...customer.modules];
      const fromIdx = list.findIndex(m => m.id === dragSrc.id);
      const toIdx   = list.findIndex(m => m.id === block.dataset.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [item] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, item);
      reorderModules(customerId, list);
      rerenderAdmin();
    });
  });
}

function setupSubmoduleDrag(listEl, customerId, moduleId) {
  let subDragSrc = null;

  listEl.querySelectorAll('.sub-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      subDragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.subId);
      requestAnimationFrame(() => row.classList.add('dragging'));
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      listEl.querySelectorAll('.drag-over').forEach(d => d.classList.remove('drag-over'));
      subDragSrc = null;
    });
    row.addEventListener('dragover', (e) => {
      if (!subDragSrc || subDragSrc === row) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!subDragSrc || subDragSrc === row) return;
      const customer = state.config.customers.find(c => c.id === customerId);
      const mod      = customer?.modules?.find(m => m.id === moduleId);
      if (!mod) return;
      const list    = [...mod.submodules];
      const fromIdx = list.findIndex(s => s.id === subDragSrc.dataset.subId);
      const toIdx   = list.findIndex(s => s.id === row.dataset.subId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [item] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, item);
      reorderSubmodules(customerId, moduleId, list);
      rerenderAdmin();
    });
  });
}

// ─── Re-render ────────────────────────────────────────────────────────────

function rerenderAdmin() {
  if (!_adminRoot) return;

  // Update rail list
  const railList = _adminRoot.querySelector('#rail-list');
  if (railList) {
    fillRailList(railList);
    refreshIcons(railList);
  }

  // Swap right panel
  const oldPanel = _adminRoot.querySelector('.admin-panel');
  if (oldPanel) {
    const newPanel = buildPanel();
    _adminRoot.replaceChild(newPanel, oldPanel);
    refreshIcons(newPanel);
  }
}
