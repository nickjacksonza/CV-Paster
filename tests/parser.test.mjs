import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseCv, splitTitleLocation } from '../src/parser.js';
import { SAMPLE_CV } from '../src/sample.js';
import { parseDate, formatDate, findDateRange } from '../src/dates.js';
import { blockFullText, blockRows, phoneVariants, renderList } from '../src/blocks.js';

const settings = { dateFormat: 'MM/YYYY', dayAssumption: 'smart', listStyle: 'bullets', skillStyle: 'comma' };
const cv = parseCv(SAMPLE_CV);
const section = (type) => cv.sections.find((item) => item.type === type);

test('personal details are pulled out of the header', () => {
  const values = Object.fromEntries(section('personal').blocks.map((block) => [block.data.key, block.data.value]));
  assert.equal(values.fullName, 'Alex Morgan');
  assert.equal(values.firstName, 'Alex');
  assert.equal(values.lastName, 'Morgan');
  assert.equal(values.email, 'alex.morgan@example.com');
  assert.equal(values.phone, '+27 71 555 0123');
  assert.equal(values.location, 'Cape Town');
  assert.equal(values.headline, 'Senior Product Marketing Manager');
});

test('the summary is joined back into one paragraph', () => {
  const summary = cv.sections.find((item) => item.id === 'summary-top').blocks[0].data.text;
  assert.match(summary, /^Product marketer with 12 years/);
  assert.match(summary, /readout to the executive team\.$/);
  assert.equal(summary.includes('\n'), false);
});

test('each role becomes its own block, including second roles at one employer', () => {
  const roles = section('experience').blocks;
  assert.equal(roles.length, 4);
  assert.deepEqual(roles.map((role) => role.data.title), [
    'Senior Product Marketing Manager',
    'Lifecycle Marketing Lead',
    'Campaign Manager',
    'Account Director',
  ]);
  const halcyon = roles.filter((role) => role.data.company === 'Halcyon Retail Group');
  assert.equal(halcyon.length, 2);
  assert.equal(halcyon[1].data.startDate.month, 1);
  assert.equal(halcyon[1].data.startDate.year, 2021);
});

test('locations are split off the job title', () => {
  const roles = section('experience').blocks;
  assert.equal(roles[0].data.location, 'Cape Town');
  assert.equal(roles[3].data.location, 'Dublin, Ireland');
  assert.equal(roles[3].data.title, 'Account Director');
});

test('wrapped bullet points stay in one piece', () => {
  const role = section('experience').blocks[0];
  assert.equal(role.data.bullets.length, 3);
  assert.match(role.data.bullets[1], /lifting qualified trial sign-ups by 38% quarter on quarter\.$/);
});

test('a note under a job title is kept separately from the bullets', () => {
  const role = section('experience').blocks[3];
  assert.deepEqual(role.data.notes, ['Promoted from Account Manager in 2018.']);
  assert.equal(role.data.bullets.length, 2);
});

test('an open-ended role keeps its end date as present', () => {
  const role = section('experience').blocks[0];
  assert.equal(role.data.endDate.present, true);
});

test('education and certifications are split into their parts', () => {
  const education = section('education').blocks;
  assert.equal(education[0].data.qualification, 'BCom Marketing Management');
  assert.equal(education[0].data.institution, 'University of Cape Town');
  assert.equal(education[0].data.date.year, 2013);

  const certification = section('certifications').blocks[1];
  assert.equal(certification.data.name, 'Google Analytics 4 Certification');
  assert.equal(certification.data.issuer, 'Google Skillshop');
  assert.equal(certification.data.date.month, 2);
});

test('skills keep their categories and their bracketed lists', () => {
  const groups = section('skills').blocks;
  assert.deepEqual(groups.map((group) => group.data.label), [
    'Go-to-Market', 'Demand Generation', 'Analytics & Tools', 'Leadership',
  ]);
  assert.ok(groups[1].data.items.includes('Paid Social (Meta, LinkedIn)'));
});

test('languages are listed as separate items', () => {
  const languages = section('languages').blocks[0].data.items;
  assert.deepEqual(languages, ['English (Native)', 'Afrikaans (Professional)', 'Portuguese (Conversational)']);
});

test('a place name inside an employer name is left alone', () => {
  assert.deepEqual(splitTitleLocation('Youth Employment Service (YES) South Africa', { requireDelimiter: true }), {
    title: 'Youth Employment Service (YES) South Africa',
    location: '',
  });
  assert.deepEqual(splitTitleLocation('Account Director\tDublin, Ireland'), {
    title: 'Account Director',
    location: 'Dublin, Ireland',
  });
});
