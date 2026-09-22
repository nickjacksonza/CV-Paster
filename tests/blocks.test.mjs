import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCv } from '../src/parser.js';
import { SAMPLE_CV } from '../src/sample.js';
import { blockRows, blockFullText, blockTitle, duplicateBlock, phoneVariants, renderList } from '../src/blocks.js';

const settings = { dateFormat: 'MM/YYYY', dayAssumption: 'smart', listStyle: 'bullets', skillStyle: 'comma' };
const cv = parseCv(SAMPLE_CV);
const role = cv.sections.find((item) => item.type === 'experience').blocks[0];

test('a role offers every date format as a copy option', () => {
  const rows = blockRows(role, settings);
  const start = rows.find((row) => row.key === 'startDate');
  assert.equal(start.type, 'date');
  assert.ok(start.chips.some((chip) => chip.id === 'YYYYMMDD' && chip.value === '20240301'));
  assert.ok(start.chips.some((chip) => chip.id === 'DDMMYYYY' && chip.value === '01032024'));
  assert.ok(start.chips.some((chip) => chip.id === 'MMYYYY' && chip.value === '032024'));
});

test('an open-ended end date offers wording rather than numbers', () => {
  const end = blockRows(role, settings).find((row) => row.key === 'endDate');
  assert.deepEqual(end.chips.map((chip) => chip.value), ['Present', 'Current', 'Ongoing', 'Now', 'To date']);
});

test('job descriptions can be copied in several shapes', () => {
  const description = blockRows(role, settings).find((row) => row.key === 'bullets');
  assert.match(renderList(description.items, 'bullets'), /^• Own positioning/);
  assert.match(renderList(description.items, 'dashes'), /^- Own positioning/);
  assert.match(renderList(description.items, 'lines'), /^Own positioning/);
  assert.equal(renderList(description.items, 'paragraph').includes('\n'), false);
});

test('a duplicated block edits without touching the original', () => {
  const copy = duplicateBlock(role);
  copy.data.bullets = ['Shortened for a portal with a character limit.'];
  assert.notEqual(copy.id, role.id);
  assert.equal(copy.isVariant, true);
  assert.equal(copy.sourceId, role.id);
  assert.equal(role.data.bullets.length, 3);
  assert.match(blockFullText(copy, settings), /Shortened for a portal/);
});

test('the whole block copies as readable text', () => {
  const text = blockFullText(role, settings);
  assert.match(text, /Senior Product Marketing Manager — Northwind Software/);
  assert.match(text, /Cape Town \| 03\/2024 - Present/);
  assert.match(text, /• Own positioning/);
});

test('phone numbers are offered in the shapes portals accept', () => {
  const variants = phoneVariants('+27 71 555 0123');
  const values = variants.map((variant) => variant.value);
  assert.ok(values.includes('+27 71 555 0123'));
  assert.ok(values.includes('+27715550123'));
  assert.ok(values.includes('0715550123'));
  assert.ok(values.includes('715550123'));
});

test('skills copy as a comma list or one per line', () => {
  const skills = cv.sections.find((item) => item.type === 'skills').blocks[0];
  const row = blockRows(skills, settings).find((item) => item.key === 'items');
  assert.equal(row.value, 'Positioning, Messaging, Launch Planning, Competitive Research, Pricing Support');
  assert.equal(renderList(row.items, 'lines').split('\n').length, 5);
  assert.equal(blockTitle(skills), 'Go-to-Market');
});
