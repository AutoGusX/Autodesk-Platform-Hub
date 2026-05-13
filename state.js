// state.js — in-memory config state with localStorage sync

import { validate, emptyConfig } from './schema.js';

const LS_CONFIG_KEY = 'aph.config.v1';
const LS_THEME_KEY  = 'aph.theme';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// ─── State object ─────────────────────────────────────────────────────────

export const state = {
  config: emptyConfig(),
  dirty: false,          // true when config has unsaved (un-exported) changes
  _subscribers: [],
};

// ─── Init ─────────────────────────────────────────────────────────────────

export function loadState() {
  const savedTheme = localStorage.getItem(LS_THEME_KEY);
  const theme = savedTheme || getSystemTheme();

  const raw = localStorage.getItem(LS_CONFIG_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const result = validate(parsed);
      if (result.valid) {
        state.config = parsed;
        state.config.theme = theme;
        return;
      }
    } catch {
      // Fall through to empty config on parse error
    }
  }

  state.config = emptyConfig();
  state.config.theme = theme;
}

export function saveState() {
  localStorage.setItem(LS_CONFIG_KEY, JSON.stringify(state.config));
  localStorage.setItem(LS_THEME_KEY, state.config.theme);
}

// ─── Core mutator ─────────────────────────────────────────────────────────

export function updateConfig(newConfig) {
  const result = validate(newConfig);
  if (!result.valid) return result;
  state.config = newConfig;
  state.dirty = true;
  saveState();
  emit();
  return result;
}

export function markExported() {
  state.dirty = false;
}

export function setTheme(theme) {
  state.config = { ...state.config, theme };
  document.documentElement.setAttribute('data-theme', theme);
  saveState();
}

// ─── Pub / sub ────────────────────────────────────────────────────────────

export function subscribe(fn) {
  state._subscribers.push(fn);
}

export function unsubscribe(fn) {
  state._subscribers = state._subscribers.filter(s => s !== fn);
}

function emit() {
  state._subscribers.forEach(fn => fn());
}

// ─── Customer mutators ────────────────────────────────────────────────────

export function addCustomer(customer) {
  return updateConfig({
    ...state.config,
    customers: [...state.config.customers, customer]
  });
}

export function updateCustomer(customerId, updates) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId ? { ...c, ...updates } : c
    )
  });
}

export function deleteCustomer(customerId) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.filter(c => c.id !== customerId)
  });
}

export function reorderCustomers(newOrder) {
  return updateConfig({ ...state.config, customers: newOrder });
}

// ─── Module mutators ──────────────────────────────────────────────────────

export function addModule(customerId, module) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? { ...c, modules: [...(c.modules || []), module] }
        : c
    )
  });
}

export function updateModule(customerId, moduleId, updates) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? {
            ...c,
            modules: (c.modules || []).map(m =>
              m.id === moduleId ? { ...m, ...updates } : m
            )
          }
        : c
    )
  });
}

export function deleteModule(customerId, moduleId) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? { ...c, modules: (c.modules || []).filter(m => m.id !== moduleId) }
        : c
    )
  });
}

export function reorderModules(customerId, newOrder) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId ? { ...c, modules: newOrder } : c
    )
  });
}

// ─── Submodule mutators ───────────────────────────────────────────────────

export function addSubmodule(customerId, moduleId, submodule) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? {
            ...c,
            modules: (c.modules || []).map(m =>
              m.id === moduleId
                ? { ...m, submodules: [...(m.submodules || []), submodule] }
                : m
            )
          }
        : c
    )
  });
}

export function updateSubmodule(customerId, moduleId, submoduleId, updates) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? {
            ...c,
            modules: (c.modules || []).map(m =>
              m.id === moduleId
                ? {
                    ...m,
                    submodules: (m.submodules || []).map(s =>
                      s.id === submoduleId ? { ...s, ...updates } : s
                    )
                  }
                : m
            )
          }
        : c
    )
  });
}

export function deleteSubmodule(customerId, moduleId, submoduleId) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? {
            ...c,
            modules: (c.modules || []).map(m =>
              m.id === moduleId
                ? { ...m, submodules: (m.submodules || []).filter(s => s.id !== submoduleId) }
                : m
            )
          }
        : c
    )
  });
}

export function reorderSubmodules(customerId, moduleId, newOrder) {
  return updateConfig({
    ...state.config,
    customers: state.config.customers.map(c =>
      c.id === customerId
        ? {
            ...c,
            modules: (c.modules || []).map(m =>
              m.id === moduleId ? { ...m, submodules: newOrder } : m
            )
          }
        : c
    )
  });
}
