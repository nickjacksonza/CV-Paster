import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDate, formatDate, findDateRange, findSingleDate, DATE_FORMATS, describeAssumptions } from '../src/dates.js';

test('dates are read in the formats CVs use', () => {
  assert.deepEqual(parseDate('03/2024'), { year: 2024, month: 3, raw: '03/2024' });
  assert.deepEqual(parseDate('2024-03'), { year: 2024, month: 3, day: undefined, raw: '2024-03' });
  assert.deepEqual(parseDate('March 2024'), { year: 2024, month: 3, day: undefined, raw: 'March 2024' });
  assert.deepEqual(parseDate('Mar 2024'), { year: 2024, month: 3, day: undefined, raw: 'Mar 2024' });
  assert.deepEqual(parseDate('2024'), { year: 2024, raw: '2024' });
  assert.equal(parseDate('Present').present, true);
  assert.equal(parseDate('Marketing Manager'), null);
});

test('a day-first date stays day-first, and an impossible one is swapped', () => {
  assert.deepEqual(parseDate('01/02/2026'), { year: 2026, month: 2, day: 1, raw: '01/02/2026' });
  assert.deepEqual(parseDate('03/25/2026'), { year: 2026, month: 3, day: 25, raw: '03/25/2026' });
});

test('one date is rendered in every format on offer', () => {
  const date = parseDate('02/2026');
  const rendered = Object.fromEntries(DATE_FORMATS.map((format) => [format.id, formatDate(date, format.id)]));
  assert.equal(rendered.YYYYMMDD, '20260201');
  assert.equal(rendered['YYYY-MM-DD'], '2026-02-01');
  assert.equal(rendered.DDMMYYYY, '01022026');
  assert.equal(rendered['DD/MM/YYYY'], '01/02/2026');
  assert.equal(rendered['MM/DD/YYYY'], '02/01/2026');
  assert.equal(rendered.MMYYYY, '022026');
  assert.equal(rendered['MM/YYYY'], '02/2026');
  assert.equal(rendered['YYYY-MM'], '2026-02');
  assert.equal(rendered['MMM YYYY'], 'Feb 2026');
  assert.equal(rendered['MMMM YYYY'], 'February 2026');
  assert.equal(rendered.YYYY, '2026');
});

test('an end date closes the month, a start date opens it', () => {
  const date = parseDate('02/2026');
  assert.equal(formatDate(date, 'YYYYMMDD', { role: 'start' }), '20260201');
  assert.equal(formatDate(date, 'YYYYMMDD', { role: 'end' }), '20260228');
  assert.equal(formatDate(parseDate('02/2024'), 'YYYYMMDD', { role: 'end' }), '20240229');
  assert.equal(formatDate(date, 'YYYYMMDD', { role: 'end', dayAssumption: 'first' }), '20260201');
});

test('guessed parts of a date are flagged', () => {
  assert.match(describeAssumptions(parseDate('02/2026'), 'YYYYMMDD', 'start'), /day not in the CV/);
  assert.equal(describeAssumptions(parseDate('01/02/2026'), 'YYYYMMDD', 'start'), '');
  assert.match(describeAssumptions(parseDate('2019'), 'MM/YYYY', 'start'), /month not in the CV/);
});

test('date ranges are found at the end of a heading line', () => {
  const range = findDateRange('Northwind Software 03/2024 - Present');
  assert.equal(range.rest, 'Northwind Software');
  assert.equal(range.start.year, 2024);
  assert.equal(range.end.present, true);

  const dashed = findDateRange('Bright Harbour Agency June 2017 – December 2020');
  assert.equal(dashed.rest, 'Bright Harbour Agency');
  assert.equal(dashed.start.month, 6);
  assert.equal(dashed.end.month, 12);
});

test('a lone date is separated from the text around it', () => {
  const found = findSingleDate('University of Cape Town • 12/2013');
  assert.equal(found.date.year, 2013);
  assert.match(found.rest, /University of Cape Town/);
});
