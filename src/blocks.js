/* Turns parsed blocks into the rows the interface shows, and into the text that
   ends up on the clipboard. */

import { DATE_FORMATS, formatDate, formatRange, describeAssumptions, PRESENT_VARIANTS } from './dates.js';

const COUNTRY_CODES = ['1', '7', '20', '27', '31', '32', '33', '34', '39', '40', '41', '43', '44', '45', '46', '47', '48', '49', '51', '52', '54', '55', '56', '57', '60', '61', '62', '63', '64', '65', '66', '81', '82', '84', '86', '90', '91', '92', '212', '213', '216', '218', '220', '221', '233', '234', '250', '254', '255', '256', '260', '263', '264', '265', '267', '268', '351', '352', '353', '354', '355', '358', '359', '370', '371', '372', '380', '381', '385', '386', '420', '421', '852', '886', '961', '962', '965', '966', '968', '971', '972', '974', '977', '994', '998'];

export const LIST_STYLES = [
  { id: 'bullets', label: 'Bullets', hint: '• One line per point' },
  { id: 'dashes', label: 'Dashes', hint: '- One line per point' },
  { id: 'lines', label: 'Plain lines', hint: 'No leading character' },
  { id: 'paragraph', label: 'Paragraph', hint: 'Joined into one block of text' },
];

export const SKILL_STYLES = [
  { id: 'comma', label: 'Comma list', hint: 'SEO, Copywriting, Paid Search' },
  { id: 'semicolon', label: 'Semicolons', hint: 'SEO; Copywriting; Paid Search' },
  { id: 'lines', label: 'One per line', hint: 'For tag-style inputs' },
  { id: 'bullets', label: 'Bullets', hint: '• SEO' },
];

export function renderList(items, style = 'bullets') {
  const clean = (items || []).map((item) => String(item).trim()).filter(Boolean);
  switch (style) {
    case 'dashes': return clean.map((item) => `- ${item}`).join('\n');
    case 'lines': return clean.join('\n');
    case 'paragraph': return clean.join(' ');
    case 'comma': return clean.join(', ');
    case 'semicolon': return clean.join('; ');
    default: return clean.map((item) => `• ${item}`).join('\n');
  }
}

/* Phone numbers are rejected by portals for the smallest formatting reasons, so
   every sensible shape of the same number is offered. */
export function phoneVariants(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');
  const variants = [{ label: 'As written', value: raw }];
  if (raw.replace(/\s/g, '') !== raw) variants.push({ label: 'No spaces', value: raw.replace(/\s/g, '') });

  if (raw.startsWith('+')) {
    const code = COUNTRY_CODES
      .filter((candidate) => digits.startsWith(candidate))
      .sort((a, b) => b.length - a.length)[0];
    variants.push({ label: 'International', value: `+${digits}` });
    if (code) {
      const national = digits.slice(code.length);
      variants.push({ label: 'Country code', value: `+${code}`, hint: 'Some forms ask for this separately' });
      variants.push({ label: 'National', value: `0${national}`, hint: 'Leading zero added' });
      variants.push({ label: 'Without country code', value: national });
    }
  } else if (digits.length > 8) {
    variants.push({ label: 'Digits only', value: digits });
  }
  const seen = new Set();
  return variants.filter((variant) => {
    if (!variant.value || seen.has(variant.value)) return false;
    seen.add(variant.value);
    return true;
  });
}

function dateRow(key, label, date, role, settings) {
  return {
    key,
    label,
    type: 'date',
    date,
    role,
    value: date ? formatDate(date, settings.dateFormat, { role, dayAssumption: settings.dayAssumption }) : '',
    chips: date && date.present
      ? PRESENT_VARIANTS.map((word) => ({ id: word, label: '', value: word }))
      : DATE_FORMATS.map((format) => ({
        id: format.id,
        label: format.label,
        value: date ? formatDate(date, format.id, { role, dayAssumption: settings.dayAssumption }) : '',
        note: date ? describeAssumptions(date, format.id, role, settings.dayAssumption) : '',
      })),
  };
}

export function blockTitle(block) {
  const data = block.data;
  switch (block.kind) {
    case 'experience': return data.title || data.company || 'Role';
    case 'education': return data.qualification || data.institution || 'Qualification';
    case 'certification': return data.name || 'Certification';
    case 'skillgroup': return data.label || 'Skills';
    case 'field': return data.label || 'Detail';
    case 'list': return data.label || 'List';
    default: return data.label || 'Text';
  }
}

export function blockSubtitle(block) {
  const data = block.data;
  if (block.kind === 'experience') return [data.company, data.location].filter(Boolean).join(' · ');
  if (block.kind === 'education') return [data.institution, data.location].filter(Boolean).join(' · ');
  if (block.kind === 'certification') return data.issuer || '';
  if (block.kind === 'skillgroup') return `${(data.items || []).length} items`;
  return '';
}

/* The rows shown on a card: a label, a value and a copy button each. */
export function blockRows(block, settings) {
  const data = block.data;
  switch (block.kind) {
    case 'experience': {
      const rows = [
        { key: 'title', label: 'Job title', type: 'text', value: data.title || '' },
        { key: 'company', label: 'Company', type: 'text', value: data.company || '' },
        { key: 'location', label: 'Location', type: 'text', value: data.location || '' },
        dateRow('startDate', 'Start date', data.startDate, 'start', settings),
        dateRow('endDate', 'End date', data.endDate, 'end', settings),
      ];
      if ((data.notes || []).length) {
        rows.push({ key: 'notes', label: 'Note', type: 'multiline', value: (data.notes || []).join('\n') });
      }
      rows.push({
        key: 'bullets',
        label: 'Description',
        type: 'list',
        items: data.bullets || [],
        value: renderList(data.bullets, settings.listStyle),
        styles: LIST_STYLES,
      });
      return rows.filter((row) => row.type !== 'text' || row.value || block.isVariant);
    }
    case 'education': {
      const rows = [
        { key: 'qualification', label: 'Qualification', type: 'text', value: data.qualification || '' },
        { key: 'institution', label: 'Institution', type: 'text', value: data.institution || '' },
        { key: 'location', label: 'Location', type: 'text', value: data.location || '' },
        dateRow('date', 'Date awarded', data.date, 'end', settings),
      ];
      if ((data.bullets || []).length) {
        rows.push({
          key: 'bullets',
          label: 'Details',
          type: 'list',
          items: data.bullets,
          value: renderList(data.bullets, settings.listStyle),
          styles: LIST_STYLES,
        });
      }
      return rows.filter((row) => row.type !== 'text' || row.value || block.isVariant);
    }
    case 'certification':
      return [
        { key: 'name', label: 'Certification', type: 'text', value: data.name || '' },
        { key: 'issuer', label: 'Issued by', type: 'text', value: data.issuer || '' },
        dateRow('date', 'Date', data.date, 'end', settings),
      ].filter((row) => row.type !== 'text' || row.value || block.isVariant);
    case 'skillgroup':
      return [
        { key: 'label', label: 'Category', type: 'text', value: data.label || '' },
        {
          key: 'items',
          label: 'Skills',
          type: 'list',
          items: data.items || [],
          value: renderList(data.items, settings.skillStyle),
          styles: SKILL_STYLES,
          styleSetting: 'skillStyle',
          chipsFromItems: true,
        },
      ];
    case 'field': {
      const row = { key: 'value', label: data.label || 'Detail', type: 'text', value: data.value || '' };
      if (data.key === 'phone') row.variants = phoneVariants(data.value);
      if (data.key === 'email') {
        row.variants = [
          { label: 'As written', value: data.value },
          { label: 'Lower case', value: String(data.value).toLowerCase() },
        ];
      }
      return [row];
    }
    case 'list':
      return [{
        key: 'items',
        label: data.label || 'Items',
        type: 'list',
        items: data.items || [],
        value: renderList(data.items, settings.listStyle),
        styles: LIST_STYLES,
        chipsFromItems: true,
      }];
    default:
      return [{ key: 'text', label: data.label || 'Text', type: 'multiline', value: data.text || '' }];
  }
}

/* Everything on the card as one piece of text, for the "Copy all" button. */
export function blockFullText(block, settings) {
  const data = block.data;
  const dates = () => formatRange(data.startDate, data.endDate, settings.dateFormat, settings.dayAssumption);
  switch (block.kind) {
    case 'experience': {
      const heading = [data.title, data.company].filter(Boolean).join(' — ');
      const meta = [data.location, dates()].filter(Boolean).join(' | ');
      const notes = (data.notes || []).join('\n');
      return [heading, meta, notes, renderList(data.bullets, settings.listStyle)].filter(Boolean).join('\n');
    }
    case 'education': {
      const meta = [data.institution, data.location, formatDate(data.date, settings.dateFormat, { role: 'end', dayAssumption: settings.dayAssumption })]
        .filter(Boolean).join(' | ');
      return [data.qualification, meta, renderList(data.bullets, settings.listStyle)].filter(Boolean).join('\n');
    }
    case 'certification':
      return [data.name, [data.issuer, formatDate(data.date, settings.dateFormat, { role: 'end', dayAssumption: settings.dayAssumption })].filter(Boolean).join(' | ')]
        .filter(Boolean).join('\n');
    case 'skillgroup':
      return `${data.label ? `${data.label}: ` : ''}${renderList(data.items, settings.skillStyle)}`;
    case 'field':
      return data.value || '';
    case 'list':
      return renderList(data.items, settings.listStyle);
    default:
      return data.text || '';
  }
}

/* Plain-text search over everything a card shows. */
export function blockSearchText(block) {
  const data = block.data;
  return [
    blockTitle(block),
    blockSubtitle(block),
    data.text,
    data.value,
    (data.bullets || []).join(' '),
    (data.items || []).join(' '),
    (data.notes || []).join(' '),
  ].filter(Boolean).join(' ').toLowerCase();
}

let variantCounter = 0;

/* A working copy of a block, for editing before pasting without losing the original. */
export function duplicateBlock(block, label) {
  variantCounter += 1;
  return {
    ...structuredCloneSafe(block),
    id: `${block.id}-v${variantCounter}`,
    sourceId: block.sourceId || block.id,
    isVariant: true,
    variantLabel: label || 'Edited copy',
    editing: true,
  };
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export { structuredCloneSafe };
