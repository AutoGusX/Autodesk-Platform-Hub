// schema.js — JSON schema validator (no external dependencies)

export const SCHEMA_VERSION = 1;

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const VAR_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,40}$/;

function err(path, message) {
  return { path, message };
}

function validateVariables(vars, path, errors) {
  if (typeof vars !== 'object' || vars === null || Array.isArray(vars)) {
    errors.push(err(path, 'must be an object'));
    return;
  }
  for (const [k, v] of Object.entries(vars)) {
    if (!VAR_KEY_RE.test(k)) {
      errors.push(err(`${path}.${k}`, `key must match /^[A-Za-z_][A-Za-z0-9_]{0,40}$/`));
    }
    if (typeof v !== 'string') {
      errors.push(err(`${path}.${k}`, 'value must be a string'));
    }
  }
}

function validateSubmodule(sub, path, errors) {
  if (!sub.id || !SLUG_RE.test(sub.id)) {
    errors.push(err(`${path}.id`, 'must match /^[a-z0-9][a-z0-9-]{0,40}$/'));
  }
  if (!sub.name || typeof sub.name !== 'string' || sub.name.length > 60) {
    errors.push(err(`${path}.name`, 'must be a non-empty string (max 60 chars)'));
  }
  if (typeof sub.icon !== 'string') {
    errors.push(err(`${path}.icon`, 'must be a string'));
  }
  if (typeof sub.description !== 'string' || sub.description.length > 200) {
    errors.push(err(`${path}.description`, 'must be a string (max 200 chars)'));
  }
  if (sub.urlMode !== 'fixed' && sub.urlMode !== 'template') {
    errors.push(err(`${path}.urlMode`, 'must be "fixed" or "template"'));
  }
  if (!sub.url || typeof sub.url !== 'string') {
    errors.push(err(`${path}.url`, 'is required'));
  }
  if (sub.variables !== undefined) {
    validateVariables(sub.variables, `${path}.variables`, errors);
  }
}

function validateModule(mod, path, errors) {
  if (!mod.id || !SLUG_RE.test(mod.id)) {
    errors.push(err(`${path}.id`, 'must match /^[a-z0-9][a-z0-9-]{0,40}$/'));
  }
  if (!mod.name || typeof mod.name !== 'string' || mod.name.length > 60) {
    errors.push(err(`${path}.name`, 'must be a non-empty string (max 60 chars)'));
  }
  if (typeof mod.icon !== 'string') {
    errors.push(err(`${path}.icon`, 'must be a string'));
  }
  if (!Array.isArray(mod.submodules)) {
    errors.push(err(`${path}.submodules`, 'must be an array'));
    return;
  }
  const subIds = new Set();
  mod.submodules.forEach((sub, i) => {
    const sp = `${path}.submodules[${i}]`;
    validateSubmodule(sub, sp, errors);
    if (sub.id) {
      if (subIds.has(sub.id)) {
        errors.push(err(`${sp}.id`, 'must be unique within module'));
      }
      subIds.add(sub.id);
    }
  });
}

function validateCustomer(cust, path, errors) {
  if (!cust.id || !SLUG_RE.test(cust.id)) {
    errors.push(err(`${path}.id`, 'must match /^[a-z0-9][a-z0-9-]{0,40}$/'));
  }
  if (!cust.name || typeof cust.name !== 'string' || cust.name.length > 80) {
    errors.push(err(`${path}.name`, 'must be a non-empty string (max 80 chars)'));
  }
  if (typeof cust.logoUrl !== 'string') {
    errors.push(err(`${path}.logoUrl`, 'must be a string'));
  } else if (cust.logoUrl !== '' && !/^(https?:\/\/|assets\/)/.test(cust.logoUrl)) {
    errors.push(err(`${path}.logoUrl`, 'must be an http/https URL or an assets/ path, or empty'));
  }
  validateVariables(cust.variables || {}, `${path}.variables`, errors);
  if (!Array.isArray(cust.modules)) {
    errors.push(err(`${path}.modules`, 'must be an array'));
    return;
  }
  const modIds = new Set();
  cust.modules.forEach((mod, i) => {
    const mp = `${path}.modules[${i}]`;
    validateModule(mod, mp, errors);
    if (mod.id) {
      if (modIds.has(mod.id)) {
        errors.push(err(`${mp}.id`, 'must be unique within customer'));
      }
      modIds.add(mod.id);
    }
  });
}

export function validate(config) {
  const errors = [];

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { valid: false, errors: [err('', 'config must be an object')] };
  }
  if (config.schemaVersion !== SCHEMA_VERSION) {
    return {
      valid: false,
      errors: [err('schemaVersion', `must be ${SCHEMA_VERSION} (got ${config.schemaVersion})`)]
    };
  }
  if (!config.brand || typeof config.brand !== 'object') {
    errors.push(err('brand', 'must be an object'));
  } else {
    if (!config.brand.title || typeof config.brand.title !== 'string' || config.brand.title.length > 60) {
      errors.push(err('brand.title', 'must be a non-empty string (max 60 chars)'));
    }
    if (typeof config.brand.logoUrl !== 'string') {
      errors.push(err('brand.logoUrl', 'must be a string'));
    }
  }
  if (config.theme !== 'light' && config.theme !== 'dark') {
    errors.push(err('theme', 'must be "light" or "dark"'));
  }
  if (!Array.isArray(config.customers)) {
    errors.push(err('customers', 'must be an array'));
  } else {
    const custIds = new Set();
    config.customers.forEach((cust, i) => {
      const cp = `customers[${i}]`;
      validateCustomer(cust, cp, errors);
      if (cust.id) {
        if (custIds.has(cust.id)) {
          errors.push(err(`${cp}.id`, 'must be unique within customers'));
        }
        custIds.add(cust.id);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function emptyConfig() {
  return {
    schemaVersion: SCHEMA_VERSION,
    brand: { title: 'Autodesk Platform Hub', logoUrl: 'assets/autodesk-logo.svg' },
    theme: 'light',
    customers: []
  };
}
