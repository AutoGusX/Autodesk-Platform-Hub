// icons.js — Lucide icon helpers and icon picker modal

import { escapeHtml } from './url.js';

/**
 * Curated icon list for the picker.
 * Covers common platform/enterprise use cases.
 */
export const ICON_NAMES = [
  'activity', 'alert-circle', 'alert-triangle', 'anchor', 'archive',
  'arrow-left', 'arrow-right', 'bar-chart', 'bar-chart-2', 'bell',
  'book', 'book-open', 'box', 'briefcase', 'building',
  'building-2', 'calendar', 'check', 'check-circle', 'check-square',
  'chevron-down', 'chevron-right', 'circle', 'clipboard', 'clipboard-list',
  'clock', 'cloud', 'code', 'cog', 'columns',
  'compass', 'copy', 'cpu', 'credit-card', 'database',
  'download', 'edit', 'external-link', 'eye', 'file',
  'file-text', 'files', 'filter', 'flag', 'folder',
  'folder-open', 'gauge', 'git-branch', 'globe', 'grid',
  'grip-vertical', 'hammer', 'hard-hat', 'hash', 'headphones',
  'heart', 'help-circle', 'home', 'image', 'inbox',
  'info', 'key', 'layers', 'layout', 'layout-dashboard',
  'link', 'list', 'lock', 'mail', 'map',
  'map-pin', 'maximize', 'message-square', 'minus-circle', 'monitor',
  'moon', 'network', 'package', 'paperclip', 'pencil',
  'pie-chart', 'pin', 'play-circle', 'plus', 'plus-circle',
  'printer', 'refresh-cw', 'repeat', 'search', 'send',
  'server', 'settings', 'share-2', 'shield', 'sliders',
  'smartphone', 'square', 'star', 'sun', 'table',
  'tag', 'target', 'terminal', 'tool', 'trash-2',
  'trending-up', 'truck', 'upload', 'user', 'user-check',
  'users', 'video', 'wrench', 'x', 'zap',
  'zoom-in'
];

/**
 * Creates an <i data-lucide="name"> element for Lucide to replace.
 * Call refreshIcons() after appending to DOM.
 */
export function renderIcon(name, { size = 18, className = '' } = {}) {
  const el = document.createElement('i');
  el.dataset.lucide = (ICON_NAMES.includes(name) ? name : 'square');
  if (!ICON_NAMES.includes(name) && name) {
    console.warn(`[icons] Unknown icon name: "${name}", falling back to "square"`);
  }
  el.className = ['icon', className].filter(Boolean).join(' ');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * Triggers Lucide to replace all <i data-lucide> elements within a container.
 * Defaults to the entire document.
 */
export function refreshIcons(container = document) {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons({
      attrs: { 'stroke-width': '1.75' },
      ...(container !== document ? { nameAttr: 'data-lucide' } : {})
    });
  }
}

// ─── Icon Picker ──────────────────────────────────────────────────────────

let pickerResolve = null;
let pickerOverlay = null;

/**
 * Opens the icon picker modal.
 * Returns a Promise<string|null> — the selected icon name, or null if dismissed.
 */
export function openIconPicker(currentIcon = '') {
  return new Promise((resolve) => {
    if (pickerOverlay) {
      closePicker(null);
    }

    pickerResolve = resolve;

    const overlay = document.createElement('div');
    overlay.className = 'icon-picker-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Choose an icon');

    overlay.innerHTML = `
      <div class="icon-picker-modal">
        <div class="icon-picker-header">
          <span class="icon-picker-title">Choose an icon</span>
          <button class="icon-picker-close btn-ghost" aria-label="Close picker">
            <i data-lucide="x" class="icon"></i>
          </button>
        </div>
        <div class="icon-picker-search-wrap">
          <i data-lucide="search" class="icon icon-picker-search-icon" aria-hidden="true"></i>
          <input
            type="text"
            class="icon-picker-search"
            placeholder="Search icons…"
            autocomplete="off"
            aria-label="Search icons"
          >
        </div>
        <div class="icon-picker-grid" role="listbox" aria-label="Icons"></div>
      </div>
    `;

    pickerOverlay = overlay;
    document.body.appendChild(overlay);

    const grid = overlay.querySelector('.icon-picker-grid');
    const searchInput = overlay.querySelector('.icon-picker-search');

    function renderGrid(filter) {
      const filtered = filter
        ? ICON_NAMES.filter(n => n.includes(filter.toLowerCase()))
        : ICON_NAMES;
      grid.innerHTML = filtered.map(name => `
        <button
          class="icon-picker-item${name === currentIcon ? ' selected' : ''}"
          data-icon="${escapeHtml(name)}"
          title="${escapeHtml(name)}"
          role="option"
          aria-selected="${name === currentIcon ? 'true' : 'false'}"
          aria-label="${escapeHtml(name)}"
        >
          <i data-lucide="${escapeHtml(name)}" class="icon" aria-hidden="true"></i>
        </button>
      `).join('');
      if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': '1.75' } });
    }

    renderGrid('');

    searchInput.addEventListener('input', () => renderGrid(searchInput.value));

    grid.addEventListener('click', (e) => {
      const btn = e.target.closest('.icon-picker-item');
      if (btn) {
        currentIcon = btn.dataset.icon;
        closePicker(btn.dataset.icon);
      }
    });

    overlay.querySelector('.icon-picker-close').addEventListener('click', () => closePicker(null));

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closePicker(null);
    });

    overlay._escHandler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closePicker(null);
      }
    };
    document.addEventListener('keydown', overlay._escHandler, true);

    requestAnimationFrame(() => {
      searchInput.focus();
      if (window.lucide) window.lucide.createIcons({ attrs: { 'stroke-width': '1.75' } });
    });
  });
}

function closePicker(icon) {
  if (pickerOverlay) {
    document.removeEventListener('keydown', pickerOverlay._escHandler, true);
    pickerOverlay.remove();
    pickerOverlay = null;
  }
  if (pickerResolve) {
    const fn = pickerResolve;
    pickerResolve = null;
    fn(icon);
  }
}
