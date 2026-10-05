/* CV Paster: interface logic.

   The CV is parsed in the browser, kept in local storage and never uploaded. */

import { parseCv } from './parser.js';
import { extractText, describeFile } from './extract.js';
import { SAMPLE_CV } from './sample.js';
import { DATE_FORMATS, parseDate } from './dates.js';
import {
  blockRows, blockTitle, blockSubtitle, blockFullText, blockSearchText,
  duplicateBlock, renderList, structuredCloneSafe, LIST_STYLES, SKILL_STYLES,
} from './blocks.js';

const STORAGE_KEY = 'cv-paster.state.v1';
const THEME_KEY = 'cv-paster.theme';

const defaultSettings = {
  dateFormat: 'MM/YYYY',
  dayAssumption: 'smart',
  listStyle: 'bullets',
  skillStyle: 'comma',
};

const state = {
  source: null,
  sections: [],
  blocks: [],
  rowStyles: {},
  expanded: {},
  copied: [],
  settings: { ...defaultSettings },
  search: '',
};

const el = {
  landing: document.getElementById('landing'),
  workspace: document.getElementById('workspace'),
  content: document.getElementById('content'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  pasteInput: document.getElementById('paste-input'),
  pasteParse: document.getElementById('paste-parse'),
  loadSample: document.getElementById('load-sample'),
  landingStatus: document.getElementById('landing-status'),
  sourceName: document.getElementById('source-name'),
  sourceMeta: document.getElementById('source-meta'),
  sectionNav: document.getElementById('section-nav'),
  search: document.getElementById('search'),
  dateFormat: document.getElementById('date-format'),
  dayAssumption: document.getElementById('day-assumption'),
  listStyle: document.getElementById('list-style'),
  skillStyle: document.getElementById('skill-style'),
  newUpload: document.getElementById('new-upload'),
  clearMarks: document.getElementById('clear-marks'),
  clearAll: document.getElementById('clear-all'),
  themeToggle: document.getElementById('theme-toggle'),
  themeLabel: document.getElementById('theme-label'),
  toast: document.getElementById('toast'),
  navGroup: document.getElementById('nav-group'),
  settingsGroup: document.getElementById('settings-group'),
};

/* ---------- helpers ---------- */

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function icon(name, size = 16) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

let toastTimer = null;
function showToast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { el.toast.hidden = true; }, 2200);
}

function setStatus(message, kind = '') {
  el.landingStatus.textContent = message;
  el.landingStatus.className = `status${kind ? ` is-${kind}` : ''}`;
}

async function copyText(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    /* Falls through to the older method below. */
  }
  const helper = document.createElement('textarea');
  helper.value = text;
  helper.setAttribute('readonly', '');
  helper.style.position = 'fixed';
  helper.style.opacity = '0';
  document.body.appendChild(helper);
  helper.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    copied = false;
  }
  helper.remove();
  return copied;
}

/* ---------- storage ---------- */

function save() {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      source: state.source,
      sections: state.sections,
      blocks: state.blocks,
      rowStyles: state.rowStyles,
      expanded: state.expanded,
      copied: state.copied,
      settings: state.settings,
    }));
  } catch (error) {
    /* Private browsing or a full quota: the page still works for this visit. */
  }
}

function load() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.blocks) || !parsed.blocks.length) return false;
    Object.assign(state, {
      source: parsed.source || null,
      sections: parsed.sections || [],
      blocks: parsed.blocks,
      rowStyles: parsed.rowStyles || {},
      expanded: parsed.expanded || {},
      copied: parsed.copied || [],
      settings: { ...defaultSettings, ...(parsed.settings || {}) },
    });
    return true;
  } catch (error) {
    return false;
  }
}

/* ---------- building state from a parsed CV ---------- */

function loadCv(text, source) {
  const cv = parseCv(text);
  const blocks = [];
  const sections = [];
  for (const section of cv.sections) {
    sections.push({ id: section.id, title: section.title, type: section.type });
    for (const block of section.blocks) {
      blocks.push({ ...block, original: structuredCloneSafe(block.data) });
    }
  }
  if (!blocks.length) {
    throw new Error('No sections were recognised. Check that the text came through, or paste it manually.');
  }
  state.source = source;
  state.sections = sections;
  state.blocks = blocks;
  state.rowStyles = {};
  state.expanded = {};
  state.copied = [];
  state.search = '';
  save();
  showWorkspace();
}

/* ---------- rendering ---------- */

function styleFor(block, row) {
  const key = `${block.id}:${row.key}`;
  if (state.rowStyles[key]) return state.rowStyles[key];
  return row.styleSetting === 'skillStyle' ? state.settings.skillStyle : state.settings.listStyle;
}

function rowValue(block, row) {
  if (row.type !== 'list') return row.value;
  return renderList(row.items, styleFor(block, row));
}

function isCopied(blockId, rowKey) {
  return state.copied.includes(`${blockId}:${rowKey}`);
}

function markCopied(blockId, rowKey) {
  const key = `${blockId}:${rowKey}`;
  if (!state.copied.includes(key)) {
    state.copied.push(key);
    save();
  }
}

function renderDateChips(block, row) {
  const preferred = state.settings.dateFormat;
  const key = `${block.id}:${row.key}`;
  const expanded = Boolean(state.expanded[key]);
  const ordered = row.chips
    .filter((chip) => chip.value)
    .sort((a, b) => (a.id === preferred ? -1 : b.id === preferred ? 1 : 0));
  const shown = expanded ? ordered : ordered.slice(0, 4);
  const hidden = ordered.length - shown.length;

  const chips = shown
    .map((chip) => {
      const classes = ['chip'];
      if (chip.id === preferred) classes.push('is-preferred');
      if (chip.note) classes.push('chip--assumed');
      const title = chip.note ? ` title="${escapeHtml(chip.note)}"` : '';
      return `<button type="button" class="${classes.join(' ')}" data-action="copy"
        data-block="${block.id}" data-row="${row.key}" data-chip="${escapeHtml(chip.id)}"${title}>
        <span class="chip__value">${escapeHtml(chip.value)}</span>
        ${chip.label ? `<span class="chip__format">${escapeHtml(chip.label)}</span>` : ''}
      </button>`;
    })
    .join('');

  const toggle = ordered.length > 4
    ? `<button type="button" class="chip chip--toggle" data-action="expand" data-key="${key}">
        ${expanded ? 'Fewer formats' : `${hidden} more format${hidden === 1 ? '' : 's'}`}
      </button>`
    : '';
  return `<div class="chips">${chips}${toggle}</div>`;
}

function renderStyleChips(block, row) {
  const active = styleFor(block, row);
  return `<div class="chips">${row.styles.map((style) => `
    <button type="button" class="chip${style.id === active ? ' is-active' : ''}"
      data-action="style" data-block="${block.id}" data-row="${row.key}" data-style="${style.id}"
      title="${escapeHtml(style.hint)}">${escapeHtml(style.label)}</button>`).join('')}</div>`;
}

function renderItemChips(block, row) {
  if (!row.chipsFromItems || (row.items || []).length < 2) return '';
  return `<div class="chips">${row.items.map((item, index) => `
    <button type="button" class="chip" data-action="copy" data-block="${block.id}"
      data-row="${row.key}" data-item="${index}" title="Copy just this one">
      ${icon('copy', 12)}<span>${escapeHtml(item)}</span>
    </button>`).join('')}</div>`;
}

function renderRow(block, row, hideLabel = false) {
  const value = rowValue(block, row);
  const copied = isCopied(block.id, row.key);
  const copyButton = `<button type="button" class="btn btn--icon${copied ? ' is-copied' : ''}"
    data-action="copy" data-block="${block.id}" data-row="${row.key}"
    aria-label="Copy ${escapeHtml(row.label)}">${icon(copied ? 'check' : 'copy')}</button>`;

  const count = (row.type === 'list' || row.type === 'multiline') && value
    ? `<span class="row__count">${value.length} characters</span>`
    : '';

  if (block.editing) {
    return `<div class="row">
      <div class="row__head"><span class="row__label">${escapeHtml(row.label)}</span><span class="row__tools">${count}</span></div>
      ${renderEditor(block, row)}
    </div>`;
  }

  const extras = [];
  if (row.type === 'date' && row.chips) extras.push(renderDateChips(block, row));
  const label = hideLabel ? '' : escapeHtml(row.label);
  if (row.styles) extras.push(renderStyleChips(block, row));
  if (row.variants && row.variants.length > 1) {
    extras.push(`<div class="chips">${row.variants.map((variant, index) => `
      <button type="button" class="chip" data-action="copy" data-block="${block.id}"
        data-row="${row.key}" data-variant="${index}" title="${escapeHtml(variant.hint || variant.label)}">
        <span class="chip__value">${escapeHtml(variant.value)}</span>
        <span class="chip__format">${escapeHtml(variant.label)}</span>
      </button>`).join('')}</div>`);
  }
  if (row.chipsFromItems) extras.push(renderItemChips(block, row));

  const showValue = row.type !== 'date';
  const head = hideLabel && !count ? '' : `<div class="row__head">
      <span class="row__label">${label}</span>
      <span class="row__tools">${count}${hideLabel ? '' : copyButton}</span>
    </div>`;
  return `<div class="row${copied ? ' is-copied' : ''}">
    ${head}
    ${showValue ? `<div class="row__value">${escapeHtml(value)}</div>` : ''}
    ${extras.join('')}
  </div>`;
}

function renderEditor(block, row) {
  const name = `data-block="${block.id}" data-field="${row.key}"`;
  if (row.type === 'list') {
    return `<div class="editor">
      <textarea rows="${Math.max(3, (row.items || []).length + 1)}" ${name} data-kind="list">${escapeHtml((row.items || []).join('\n'))}</textarea>
      <span class="editor__hint">One point per line.</span>
    </div>`;
  }
  if (row.type === 'multiline') {
    return `<div class="editor"><textarea rows="4" ${name} data-kind="multiline">${escapeHtml(row.value)}</textarea></div>`;
  }
  if (row.type === 'date') {
    const raw = row.date ? (row.date.present ? 'Present' : row.date.raw) : '';
    return `<div class="editor">
      <input type="text" value="${escapeHtml(raw)}" ${name} data-kind="date" placeholder="03/2024, March 2024, 2024-03 or Present">
      <span class="editor__hint">Type the date in any common format.</span>
    </div>`;
  }
  return `<div class="editor"><input type="text" value="${escapeHtml(row.value)}" ${name} data-kind="text"></div>`;
}

function renderCard(block) {
  const rows = blockRows(block, state.settings);
  /* A card holding one field repeats its own title, so the row label is dropped. */
  const singleRow = rows.length === 1 && rows[0].label === blockTitle(block);
  const edited = JSON.stringify(block.data) !== JSON.stringify(block.original || block.data);
  const classes = ['card'];
  if (block.isVariant) classes.push('is-variant');
  if (block.editing) classes.push('is-editing');

  const badges = [];
  if (block.isVariant) badges.push(`<span class="badge badge--variant">${escapeHtml(block.variantLabel || 'Edited copy')}</span>`);
  else if (edited) badges.push('<span class="badge">Edited</span>');

  return `<article class="${classes.join(' ')}" data-card="${block.id}">
    <div class="card__head">
      <div class="card__title">
        <h3>${escapeHtml(blockTitle(block))}</h3>
        ${blockSubtitle(block) ? `<p class="card__sub">${escapeHtml(blockSubtitle(block))}</p>` : ''}
        ${badges.length ? `<div class="card__badges">${badges.join('')}</div>` : ''}
      </div>
      <div class="card__actions">
        <button type="button" class="btn btn--icon" data-action="duplicate" data-block="${block.id}"
          title="Make an editable copy" aria-label="Make an editable copy">${icon('duplicate')}</button>
        <button type="button" class="btn btn--icon" data-action="edit" data-block="${block.id}"
          title="${block.editing ? 'Finish editing' : 'Edit this block'}"
          aria-label="${block.editing ? 'Finish editing' : 'Edit this block'}">${icon(block.editing ? 'check' : 'edit')}</button>
        ${edited && !block.isVariant ? `<button type="button" class="btn btn--icon" data-action="reset" data-block="${block.id}"
          title="Undo edits" aria-label="Undo edits">${icon('undo')}</button>` : ''}
        <button type="button" class="btn btn--icon" data-action="delete" data-block="${block.id}"
          title="Remove this block" aria-label="Remove this block">${icon('trash')}</button>
      </div>
    </div>
    <div class="rows">${rows.map((row) => renderRow(block, row, singleRow)).join('')}</div>
    <div class="card__footer">
      <button type="button" class="btn btn--primary${singleRow && isCopied(block.id, rows[0].key) ? ' is-copied' : ''}"
        data-action="${singleRow ? 'copy' : 'copy-all'}" data-block="${block.id}"
        ${singleRow ? `data-row="${rows[0].key}"` : ''}>
        ${icon('copy')} ${singleRow ? 'Copy' : 'Copy whole block'}
      </button>
      ${block.editing ? '<span class="card__note">Editing. Changes are saved as you type.</span>' : ''}
    </div>
  </article>`;
}

function matchesSearch(block) {
  if (!state.search) return true;
  return blockSearchText(block).includes(state.search.toLowerCase());
}

function render() {
  const parts = [];
  let visible = 0;

  for (const section of state.sections) {
    const blocks = state.blocks.filter((block) => block.sectionId === section.id && matchesSearch(block));
    if (!blocks.length) continue;
    visible += blocks.length;
    parts.push(`<section class="section" id="section-${section.id}">
      <div class="section__head">
        <h2 class="section__title">${escapeHtml(section.title)}</h2>
        <span class="section__meta">${blocks.length} block${blocks.length === 1 ? '' : 's'}</span>
        <button type="button" class="btn btn--ghost" data-action="copy-section" data-section="${section.id}">
          ${icon('copy')} Copy the whole section
        </button>
      </div>
      <div class="cards">${blocks.map(renderCard).join('')}</div>
    </section>`);
  }

  el.content.innerHTML = visible
    ? parts.join('')
    : `<p class="empty">Nothing matches &ldquo;${escapeHtml(state.search)}&rdquo;.</p>`;

  renderNav();
}

function renderNav() {
  el.sectionNav.innerHTML = state.sections.map((section) => {
    const count = state.blocks.filter((block) => block.sectionId === section.id).length;
    if (!count) return '';
    return `<li><a href="#section-${section.id}">
      <span>${escapeHtml(section.title)}</span><span class="count">${count}</span>
    </a></li>`;
  }).join('');
}

function renderSettings() {
  el.dateFormat.innerHTML = DATE_FORMATS
    .map((format) => `<option value="${format.id}">${format.label} (${format.hint})</option>`).join('');
  el.listStyle.innerHTML = LIST_STYLES
    .map((style) => `<option value="${style.id}">${style.label}</option>`).join('');
  el.skillStyle.innerHTML = SKILL_STYLES
    .map((style) => `<option value="${style.id}">${style.label}</option>`).join('');
  el.dateFormat.value = state.settings.dateFormat;
  el.dayAssumption.value = state.settings.dayAssumption;
  el.listStyle.value = state.settings.listStyle;
  el.skillStyle.value = state.settings.skillStyle;
}

/* The sidebar is open beside the cards on a wide screen and folded away above
   them on a narrow one. */
function setSidebarGroups() {
  const wide = window.matchMedia('(min-width: 961px)').matches;
  el.navGroup.open = wide;
  el.settingsGroup.open = wide;
}

function showWorkspace() {
  setSidebarGroups();
  el.landing.hidden = true;
  el.workspace.hidden = false;
  el.sourceName.textContent = state.source ? state.source.name : 'Your CV';
  const detail = state.source && state.source.detail ? state.source.detail : '';
  el.sourceMeta.textContent = detail.startsWith(el.sourceName.textContent)
    ? detail.slice(el.sourceName.textContent.length).replace(/^[\s(]+|\)$/g, '')
    : detail;
  renderSettings();
  render();
  window.scrollTo({ top: 0 });
}

function showLanding() {
  el.workspace.hidden = true;
  el.landing.hidden = false;
  setStatus('');
}

/* Wipes the parsed CV, in memory, on screen and in local storage, so both the
   "start over" and "delete" actions leave nothing stale behind. */
function resetState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) { /* ignore */ }
  Object.assign(state, {
    source: null, sections: [], blocks: [], rowStyles: {}, expanded: {}, copied: [], search: '',
    settings: { ...defaultSettings },
  });
  el.content.innerHTML = '';
  el.sectionNav.innerHTML = '';
  el.pasteInput.value = '';
  el.fileInput.value = '';
  el.search.value = '';
}

/* ---------- actions ---------- */

function findBlock(id) {
  return state.blocks.find((block) => block.id === id);
}

function valueToCopy(target) {
  const block = findBlock(target.dataset.block);
  if (!block) return '';
  const rows = blockRows(block, state.settings);
  const row = rows.find((candidate) => candidate.key === target.dataset.row);
  if (!row) return '';
  if (target.dataset.chip) {
    const chip = (row.chips || []).find((candidate) => candidate.id === target.dataset.chip);
    return chip ? chip.value : '';
  }
  if (target.dataset.variant !== undefined) {
    const variant = (row.variants || [])[Number(target.dataset.variant)];
    return variant ? variant.value : '';
  }
  if (target.dataset.item !== undefined) {
    return (row.items || [])[Number(target.dataset.item)] || '';
  }
  return rowValue(block, row);
}

async function handleCopy(target) {
  const text = valueToCopy(target);
  if (!text) {
    showToast('Nothing to copy in that field');
    return;
  }
  const copied = await copyText(text);
  if (!copied) {
    showToast('The browser blocked the copy. Select the text and copy it by hand.');
    return;
  }
  markCopied(target.dataset.block, target.dataset.row);
  flashCopied(target);
  const preview = text.length > 42 ? `${text.slice(0, 42)}…` : text;
  showToast(`Copied: ${preview}`);
}

function flashCopied(target) {
  target.classList.add('is-copied');
  const row = target.closest('.row');
  if (row) row.classList.add('is-copied');
  const original = target.innerHTML;
  if (target.classList.contains('btn--icon')) target.innerHTML = icon('check');
  window.setTimeout(() => {
    if (target.classList.contains('btn--icon')) target.innerHTML = original;
    if (!isCopied(target.dataset.block, target.dataset.row)) target.classList.remove('is-copied');
  }, 1400);
}

async function handleCopyAll(blockId) {
  const block = findBlock(blockId);
  if (!block) return;
  const text = blockFullText(block, state.settings);
  if (await copyText(text)) {
    markCopied(blockId, 'all');
    showToast('Copied the whole block');
    render();
  }
}

async function handleCopySection(sectionId) {
  const blocks = state.blocks.filter((block) => block.sectionId === sectionId && matchesSearch(block));
  const text = blocks.map((block) => blockFullText(block, state.settings)).filter(Boolean).join('\n\n');
  if (await copyText(text)) showToast(`Copied ${blocks.length} blocks`);
}

function handleDuplicate(blockId) {
  const index = state.blocks.findIndex((block) => block.id === blockId);
  if (index === -1) return;
  const source = state.blocks[index];
  const copy = duplicateBlock(source, 'Edited copy');
  copy.original = structuredCloneSafe(source.data);
  state.blocks.splice(index + 1, 0, copy);
  save();
  render();
  const card = el.content.querySelector(`[data-card="${copy.id}"]`);
  if (card) {
    card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    const firstField = card.querySelector('textarea, input');
    if (firstField) firstField.focus();
  }
  showToast('Copy made. Edit it, then copy the text.');
}

function handleEdit(blockId) {
  const block = findBlock(blockId);
  if (!block) return;
  block.editing = !block.editing;
  save();
  render();
  if (block.editing) {
    const field = el.content.querySelector(`[data-card="${blockId}"] textarea, [data-card="${blockId}"] input`);
    if (field) field.focus();
  }
}

function handleReset(blockId) {
  const block = findBlock(blockId);
  if (!block || !block.original) return;
  block.data = structuredCloneSafe(block.original);
  save();
  render();
  showToast('Block restored to what the CV said');
}

function handleDelete(blockId) {
  const block = findBlock(blockId);
  if (!block) return;
  if (!block.isVariant && !window.confirm('Remove this block? You can get it back by uploading the CV again.')) return;
  state.blocks = state.blocks.filter((candidate) => candidate.id !== blockId);
  save();
  render();
  showToast('Block removed');
}

function handleFieldInput(field) {
  const block = findBlock(field.dataset.block);
  if (!block) return;
  const key = field.dataset.field;
  const kind = field.dataset.kind;
  const value = field.value;

  if (kind === 'list') {
    block.data[key] = value.split('\n').map((line) => line.trim()).filter(Boolean);
  } else if (kind === 'multiline') {
    block.data[key] = key === 'notes' ? value.split('\n').filter(Boolean) : value;
  } else if (kind === 'date') {
    if (!value.trim()) {
      block.data[key] = null;
      field.removeAttribute('aria-invalid');
    } else {
      const parsed = parseDate(value.trim());
      if (parsed) {
        block.data[key] = parsed;
        field.removeAttribute('aria-invalid');
      } else {
        field.setAttribute('aria-invalid', 'true');
      }
    }
  } else {
    block.data[key] = value;
  }
  save();
}

/* ---------- reading a CV ---------- */

async function handleFile(file) {
  if (!file) return;
  setStatus(`Reading ${file.name}…`, 'busy');
  try {
    const text = await extractText(file);
    if (!text || text.trim().length < 40) {
      throw new Error('Very little text came out of that file. If it is a scan, paste the text instead.');
    }
    loadCv(text, { name: file.name, detail: describeFile(file) });
    showToast('CV split into blocks');
  } catch (error) {
    setStatus(error.message || 'That file could not be read.', 'error');
  }
}

/* ---------- theme ---------- */

function systemPrefersDark() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  el.themeLabel.textContent = theme === 'dark' ? 'Dark' : 'Light';
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch (error) { /* ignore */ }
}

/* ---------- events ---------- */

function bindEvents() {
  el.dropzone.addEventListener('click', () => el.fileInput.click());
  el.dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      el.fileInput.click();
    }
  });
  el.fileInput.addEventListener('change', (event) => handleFile(event.target.files[0]));

  ['dragenter', 'dragover'].forEach((name) => {
    el.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      el.dropzone.classList.add('is-dragging');
    });
  });
  ['dragleave', 'drop'].forEach((name) => {
    el.dropzone.addEventListener(name, (event) => {
      event.preventDefault();
      el.dropzone.classList.remove('is-dragging');
    });
  });
  el.dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer && event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  el.pasteParse.addEventListener('click', () => {
    const text = el.pasteInput.value;
    if (text.trim().length < 40) {
      setStatus('Paste a bit more of the CV first.', 'error');
      return;
    }
    try {
      loadCv(text, { name: 'Pasted CV text', detail: `${text.length} characters` });
    } catch (error) {
      setStatus(error.message, 'error');
    }
  });

  el.loadSample.addEventListener('click', () => {
    loadCv(SAMPLE_CV, { name: 'Sample CV', detail: 'Made-up details, for a look around' });
  });

  el.newUpload.addEventListener('click', () => {
    if (!window.confirm('Clear the current CV and start over with a new one?')) return;
    resetState();
    showLanding();
    showToast('Ready for a new CV');
  });

  el.clearMarks.addEventListener('click', () => {
    state.copied = [];
    save();
    render();
    showToast('Ticks cleared');
  });

  el.clearAll.addEventListener('click', () => {
    if (!window.confirm('Delete the parsed CV from this browser?')) return;
    resetState();
    showLanding();
    showToast('Deleted from this browser');
  });

  el.search.addEventListener('input', () => {
    state.search = el.search.value.trim();
    render();
  });

  const settingsMap = [
    [el.dateFormat, 'dateFormat'],
    [el.dayAssumption, 'dayAssumption'],
    [el.listStyle, 'listStyle'],
    [el.skillStyle, 'skillStyle'],
  ];
  for (const [field, key] of settingsMap) {
    field.addEventListener('change', () => {
      state.settings[key] = field.value;
      save();
      render();
    });
  }

  el.content.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'copy') handleCopy(target);
    else if (action === 'copy-all') handleCopyAll(target.dataset.block);
    else if (action === 'copy-section') handleCopySection(target.dataset.section);
    else if (action === 'duplicate') handleDuplicate(target.dataset.block);
    else if (action === 'edit') handleEdit(target.dataset.block);
    else if (action === 'reset') handleReset(target.dataset.block);
    else if (action === 'delete') handleDelete(target.dataset.block);
    else if (action === 'expand') {
      const key = target.dataset.key;
      state.expanded[key] = !state.expanded[key];
      save();
      render();
    }
    else if (action === 'style') {
      state.rowStyles[`${target.dataset.block}:${target.dataset.row}`] = target.dataset.style;
      save();
      render();
    }
  });

  el.content.addEventListener('input', (event) => {
    const field = event.target.closest('[data-field]');
    if (field) handleFieldInput(field);
  });

  el.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) && !el.workspace.hidden) {
      event.preventDefault();
      el.search.focus();
    }
  });
}

/* ---------- start ---------- */

function start() {
  let theme = null;
  try {
    theme = window.localStorage.getItem(THEME_KEY);
  } catch (error) { /* ignore */ }
  applyTheme(theme === 'dark' || theme === 'light' ? theme : (systemPrefersDark() ? 'dark' : 'light'));
  bindEvents();
  window.addEventListener('resize', setSidebarGroups);
  if (load()) showWorkspace();
}

start();
