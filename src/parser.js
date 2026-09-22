/* Turns the plain text of a CV into sections and blocks.

   The parser is deliberately forgiving: CV layouts vary, so anything it gets
   wrong stays editable in the interface. */

import { normalizeText, normalizeLine, isBulletLine, stripBullet, splitOnSeparators } from './normalize.js';
import { findDateRange, findSingleDate } from './dates.js';

const SECTION_ALIASES = [
  { type: 'summary', keys: ['summary', 'profile', 'professional summary', 'personal profile', 'about', 'about me', 'objective', 'career objective', 'personal statement', 'career summary', 'executive summary'] },
  { type: 'experience', keys: ['work experience', 'professional experience', 'experience', 'employment history', 'employment', 'career history', 'work history', 'relevant experience', 'professional background'] },
  { type: 'education', keys: ['education', 'academic background', 'education and training', 'education & training', 'academic qualifications', 'qualifications', 'academic history'] },
  { type: 'certifications', keys: ['certifications', 'certificates', 'certification', 'licenses', 'licences', 'licenses & certifications', 'licences and certifications', 'courses', 'training', 'professional development', 'accreditations'] },
  { type: 'skills', keys: ['skills', 'core skills', 'key skills', 'technical skills', 'core competencies', 'competencies', 'areas of expertise', 'expertise', 'skills & tools', 'tools'] },
  { type: 'languages', keys: ['languages', 'language skills', 'language proficiency'] },
  { type: 'volunteering', keys: ['volunteering', 'volunteering & leadership', 'volunteering and leadership', 'volunteer experience', 'volunteer work', 'community involvement', 'leadership', 'board positions'] },
  { type: 'projects', keys: ['projects', 'selected projects', 'key projects', 'portfolio'] },
  { type: 'awards', keys: ['awards', 'honours', 'honors', 'achievements', 'awards & recognition', 'awards and recognition', 'recognition'] },
  { type: 'publications', keys: ['publications', 'talks', 'speaking', 'media', 'press'] },
  { type: 'interests', keys: ['interests', 'hobbies', 'activities', 'personal interests'] },
  { type: 'references', keys: ['references', 'referees'] },
];

/* Places that turn up at the end of a job line. Anything not listed stays in the
   job title, where it can be edited. */
const LOCATION_WORDS = [
  'remote', 'hybrid', 'on-site', 'onsite',
  'johannesburg', 'cape town', 'durban', 'pretoria', 'sandton', 'centurion', 'midrand', 'gauteng', 'stellenbosch', 'port elizabeth', 'gqeberha', 'bloemfontein', 'soweto', 'east london', 'polokwane', 'nelspruit', 'kimberley',
  'dublin', 'cork', 'galway', 'limerick', 'belfast',
  'london', 'manchester', 'birmingham', 'edinburgh', 'glasgow', 'bristol', 'leeds', 'cambridge', 'oxford', 'brighton',
  'new york', 'san francisco', 'los angeles', 'chicago', 'boston', 'seattle', 'austin', 'denver', 'miami', 'atlanta', 'washington', 'houston', 'dallas', 'philadelphia', 'san diego', 'portland', 'phoenix', 'toronto', 'vancouver', 'montreal', 'ottawa',
  'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'auckland', 'wellington',
  'berlin', 'munich', 'hamburg', 'frankfurt', 'paris', 'lyon', 'madrid', 'barcelona', 'lisbon', 'porto', 'amsterdam', 'rotterdam', 'brussels', 'copenhagen', 'stockholm', 'oslo', 'helsinki', 'zurich', 'geneva', 'vienna', 'prague', 'warsaw', 'budapest', 'milan', 'rome', 'athens', 'istanbul', 'dubai', 'abu dhabi', 'doha', 'riyadh',
  'nairobi', 'lagos', 'accra', 'cairo', 'casablanca', 'gaborone', 'windhoek', 'harare', 'lusaka', 'maputo', 'kampala', 'dar es salaam',
  'singapore', 'hong kong', 'tokyo', 'seoul', 'shanghai', 'beijing', 'bangkok', 'mumbai', 'delhi', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'pune', 'manila', 'jakarta', 'kuala lumpur',
  'sao paulo', 'rio de janeiro', 'buenos aires', 'santiago', 'mexico city', 'bogota', 'lima',
  'south africa', 'ireland', 'united kingdom', 'england', 'scotland', 'wales', 'usa', 'u.s.a.', 'united states', 'canada', 'australia', 'new zealand', 'germany', 'france', 'spain', 'portugal', 'netherlands', 'belgium', 'denmark', 'sweden', 'norway', 'finland', 'switzerland', 'austria', 'poland', 'italy', 'greece', 'turkey', 'uae', 'kenya', 'nigeria', 'ghana', 'egypt', 'morocco', 'botswana', 'namibia', 'zimbabwe', 'zambia', 'mozambique', 'india', 'china', 'japan', 'singapore', 'brazil', 'argentina', 'chile', 'mexico', 'colombia',
];

const INSTITUTION_WORDS = ['university', 'college', 'school', 'institute', 'academy', 'polytechnic', 'campus', 'faculty', 'unisa', 'tafe'];

/* "Performance Marketing: Conversion Optimisation, ..." starts a new block. */
const LABELLED_LINE_RE = /^[A-Z][A-Za-z0-9&/'.+-]*(?:[ &/-]+[A-Za-z0-9][A-Za-z0-9&/'.+-]*){0,4}:\s+\S/;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /(?:https?:\/\/|www\.)[^\s|•]+|(?:linkedin\.com|github\.com|behance\.net|dribbble\.com|medium\.com)\/[^\s|•]+/i;

let blockCounter = 0;
function nextId(prefix) {
  blockCounter += 1;
  return `${prefix}-${blockCounter}`;
}

function headingType(line) {
  const cleaned = line.replace(/\t/g, ' ').replace(/[:•|]+$/, '').trim();
  if (!cleaned || cleaned.length > 46) return null;
  if (findDateRange(cleaned) || EMAIL_RE.test(cleaned)) return null;
  const key = cleaned.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z& ]/g, '').trim();
  for (const alias of SECTION_ALIASES) {
    if (alias.keys.includes(key)) return { type: alias.type, title: cleaned };
  }
  if (LABELLED_LINE_RE.test(cleaned)) return null;
  const letters = cleaned.replace(/[^A-Za-z]/g, '');
  const isUpper = letters.length >= 5 && letters === letters.toUpperCase();
  if (isUpper && cleaned.split(/\s+/).length <= 5) {
    return { type: 'generic', title: cleaned };
  }
  return null;
}

/* PDF text arrives wrapped at the page width. Joins the runover lines back up. */
function unwrapLines(lines) {
  const lengths = lines.map((line) => line.length).sort((a, b) => a - b);
  const percentile = lengths.length ? lengths[Math.floor(lengths.length * 0.95)] : 0;
  const fullWidth = Math.max(48, Math.round(percentile * 0.82));
  const out = [];

  for (const line of lines) {
    const previous = out[out.length - 1];
    const startsBlock = isBulletLine(line)
      || headingType(line)
      || findDateRange(line)
      || LABELLED_LINE_RE.test(line)
      /* A tab means the PDF had two columns on that line, so it is a heading
         line of its own, such as a job title beside a place. */
      || line.includes('\t');
    /* A short capitalised line with no full stop is usually a new heading or job
       title rather than the tail of the line above. A single word, a line that
       finishes a sentence, or the rest of a "Label: a, b, c" list still reads as
       a tail, and so does anything after a line that breaks mid-clause. */
    const looksLikeNewEntry = /^[A-Z0-9]/.test(line)
      && !/[.!?]$/.test(line)
      && line.trim().split(/\s+/).length > 1
      && line.length < fullWidth * 0.75;
    const clearlyContinues = previous
      && (/^[a-z(]/.test(line) || /[,&/-]$/.test(previous) || LABELLED_LINE_RE.test(previous));
    const canJoin = previous
      && !startsBlock
      && (clearlyContinues || !looksLikeNewEntry)
      && !headingType(previous)
      && !/[.!?]$/.test(previous)
      && !previous.includes('\t')
      && !EMAIL_RE.test(previous)
      && !URL_RE.test(previous);
    if (canJoin) {
      const previousLooksFull = previous.length >= fullWidth && !/[;:]$/.test(previous);
      if (previousLooksFull || clearlyContinues) {
        out[out.length - 1] = previous.endsWith('-')
          ? previous + line
          : `${previous} ${line}`;
        continue;
      }
    }
    out.push(line);
  }
  return out;
}

function toLines(rawText) {
  const text = normalizeText(rawText);
  const counts = new Map();
  const lines = text
    .split('\n')
    .map((line) => normalizeLine(line))
    .filter((line) => line.length > 0)
    .filter((line) => !/^page\s+\d+(\s+of\s+\d+)?$/i.test(line))
    .filter((line) => !/^[-_=.•\s]+$/.test(line));

  for (const line of lines) counts.set(line, (counts.get(line) || 0) + 1);
  const deduped = lines.filter((line) => !(line.length < 60 && counts.get(line) >= 3));
  return unwrapLines(deduped);
}

/* Pulls a place name off the end of a line, e.g. "Digital Lead\tDublin, Ireland".
   PDF columns arrive tab separated, which is reliable. Otherwise the place has to
   be recognised from the list above, and "City, Country" pairs are kept together.
   With requireDelimiter set, only a tab or comma counts, which keeps place names
   that are part of an employer name (e.g. "... (YES) South Africa") intact. */
export function splitTitleLocation(line, options = {}) {
  const { requireDelimiter = false } = options;
  const value = String(line || '');
  if (value.includes('\t')) {
    const parts = value.split('\t').map((part) => part.trim()).filter(Boolean);
    if (parts.length > 1) {
      return { title: parts.slice(0, -1).join(', '), location: parts[parts.length - 1] };
    }
    return { title: parts[0] || '', location: '' };
  }

  const plain = value.replace(/\t/g, ' ').trim();
  const lower = plain.toLowerCase();
  let start = -1;
  for (const place of LOCATION_WORDS) {
    const index = lower.lastIndexOf(place);
    if (index === -1) continue;
    if (index + place.length < lower.length - 1) continue;
    const boundary = index === 0 || /[\s,(]/.test(plain[index - 1]);
    if (boundary && (start === -1 || index < start)) start = index;
  }
  if (start <= 0) return { title: plain, location: '' };

  /* Walk backwards over "City, Country" so both parts travel together. */
  let cursor = start;
  for (;;) {
    const before = plain.slice(0, cursor).replace(/[\s,]+$/, '');
    const beforeLower = before.toLowerCase();
    const previous = LOCATION_WORDS.find((place) => beforeLower.endsWith(place) && /[,]\s*$/.test(plain.slice(0, cursor)));
    if (!previous) break;
    cursor = before.length - previous.length;
    if (cursor <= 0) return { title: plain, location: '' };
  }

  const separator = plain.slice(0, cursor).match(/([,\u2022|-])\s*$/);
  if (requireDelimiter && !separator) return { title: plain, location: '' };

  const title = plain.slice(0, cursor).replace(/[\s,\u2022|-]+$/, '').trim();
  const location = plain.slice(cursor).replace(/^[\s,]+/, '').trim();
  if (!title) return { title: plain, location: '' };
  return { title, location };
}

function newExperience(sectionId, defaults = {}) {
  return {
    id: nextId('exp'),
    sectionId,
    kind: 'experience',
    data: {
      company: '',
      title: '',
      location: '',
      startDate: null,
      endDate: null,
      bullets: [],
      notes: [],
      ...defaults,
    },
  };
}

function parseExperience(lines, sectionId) {
  const blocks = [];
  let current = null;
  let sawBullet = false;

  for (const line of lines) {
    if (isBulletLine(line)) {
      if (!current) {
        current = newExperience(sectionId);
        blocks.push(current);
      }
      current.data.bullets.push(stripBullet(line));
      sawBullet = true;
      continue;
    }

    const range = findDateRange(line);
    if (range && range.rest) {
      const { title, location } = splitTitleLocation(range.rest, { requireDelimiter: true });
      current = newExperience(sectionId, {
        company: title,
        location,
        startDate: range.start,
        endDate: range.end,
      });
      blocks.push(current);
      sawBullet = false;
      continue;
    }

    if (!current) {
      current = newExperience(sectionId);
      blocks.push(current);
    }

    if (!current.data.title) {
      const { title, location } = splitTitleLocation(line);
      current.data.title = title;
      if (location) current.data.location = location;
      continue;
    }

    if (!sawBullet) {
      current.data.notes.push(line.replace(/\t/g, ' '));
      continue;
    }

    /* A second job title under the same employer. */
    const parent = current.data;
    current = newExperience(sectionId, {
      company: parent.company,
      startDate: parent.startDate,
      endDate: parent.endDate,
      datesInherited: true,
    });
    const { title, location } = splitTitleLocation(line);
    current.data.title = title;
    current.data.location = location || parent.location;
    blocks.push(current);
    sawBullet = false;
  }

  /* A single job title with no employer line reads better the other way round. */
  for (const block of blocks) {
    if (!block.data.title && block.data.company) {
      block.data.title = '';
    }
  }
  return blocks;
}

function parseEducation(lines, sectionId) {
  const blocks = [];
  let current = null;

  const start = () => {
    current = {
      id: nextId('edu'),
      sectionId,
      kind: 'education',
      data: { qualification: '', institution: '', location: '', date: null, bullets: [] },
    };
    blocks.push(current);
    return current;
  };

  for (const line of lines) {
    if (isBulletLine(line)) {
      if (!current) start();
      current.data.bullets.push(stripBullet(line));
      continue;
    }
    if (!current || (current.data.qualification && current.data.institution)) start();

    const parts = splitOnSeparators(line);
    let remainder = line;
    let date = null;
    for (const part of parts) {
      const found = findSingleDate(part) || (findDateRange(part) ? { date: findDateRange(part).start, rest: '' } : null);
      if (found && !date) {
        date = found.date;
        remainder = parts.filter((item) => item !== part).join(', ');
      }
    }
    const looksInstitution = INSTITUTION_WORDS.some((word) => remainder.toLowerCase().includes(word));

    if (!current.data.qualification && !(looksInstitution && !date)) {
      if (looksInstitution && !current.data.institution) {
        const { title, location } = splitTitleLocation(remainder);
        current.data.institution = title;
        current.data.location = location;
        current.data.date = date || current.data.date;
        continue;
      }
      current.data.qualification = remainder.replace(/\t/g, ' ').trim();
      current.data.date = date || current.data.date;
      continue;
    }

    const { title, location } = splitTitleLocation(remainder);
    current.data.institution = title;
    current.data.location = location;
    current.data.date = date || current.data.date;
  }

  return blocks;
}

function parseCertifications(lines, sectionId) {
  const blocks = [];
  let current = null;

  for (const line of lines) {
    const clean = stripBullet(line);
    const found = findSingleDate(clean);
    const hasName = current && current.data.name;

    if (found && found.rest) {
      current = {
        id: nextId('cert'),
        sectionId,
        kind: 'certification',
        data: { name: found.rest.replace(/\t/g, ' ').trim(), issuer: '', date: found.date },
      };
      blocks.push(current);
      continue;
    }
    if (hasName && !current.data.issuer) {
      current.data.issuer = clean.replace(/\t/g, ' ').trim();
      continue;
    }
    current = {
      id: nextId('cert'),
      sectionId,
      kind: 'certification',
      data: { name: clean.replace(/\t/g, ' ').trim(), issuer: '', date: found ? found.date : null },
    };
    blocks.push(current);
  }
  return blocks;
}

function parseSkills(lines, sectionId, sectionTitle) {
  const blocks = [];
  for (const line of lines) {
    const clean = stripBullet(line).replace(/\t/g, ' ');
    const match = clean.match(/^([^:]{2,40}):\s*(.+)$/);
    if (match) {
      blocks.push({
        id: nextId('skill'),
        sectionId,
        kind: 'skillgroup',
        data: { label: match[1].trim(), items: splitItems(match[2]) },
      });
      continue;
    }
    const items = splitItems(clean);
    if (items.length > 1) {
      blocks.push({
        id: nextId('skill'),
        sectionId,
        kind: 'skillgroup',
        data: { label: sectionTitle, items },
      });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === 'skillgroup' && last.data.label === sectionTitle) {
      last.data.items.push(clean);
      continue;
    }
    blocks.push({
      id: nextId('skill'),
      sectionId,
      kind: 'skillgroup',
      data: { label: sectionTitle, items: [clean] },
    });
  }
  return blocks;
}

/* Splits a skills line, leaving bracketed lists such as "Paid Social (Meta, LinkedIn)" whole. */
function splitItems(value) {
  const items = [];
  let buffer = '';
  let depth = 0;
  for (const char of String(value)) {
    if ('([{'.includes(char)) depth += 1;
    if (')]}'.includes(char)) depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;•|]/.test(char)) {
      items.push(buffer.trim());
      buffer = '';
      continue;
    }
    buffer += char;
  }
  items.push(buffer.trim());
  return items.filter(Boolean);
}

function parseTextBlocks(lines, sectionId, kind = 'text') {
  const bullets = lines.filter((line) => isBulletLine(line));
  if (bullets.length && bullets.length === lines.length) {
    return [{
      id: nextId('list'),
      sectionId,
      kind: 'list',
      data: { label: 'Items', items: lines.map(stripBullet) },
    }];
  }
  return lines.map((line) => ({
    id: nextId(kind),
    sectionId,
    kind: isBulletLine(line) ? 'text' : kind,
    data: { text: stripBullet(line).replace(/\t/g, ' ') },
  }));
}

/* Name, contact details and profile summary from the top of the CV. */
function parseHeader(lines) {
  const details = [];
  const leftovers = [];
  let name = '';
  let headline = '';

  lines.forEach((line, index) => {
    const parts = splitOnSeparators(line);
    const matched = [];
    for (const part of parts) {
      const email = part.match(EMAIL_RE);
      const url = part.match(URL_RE);
      const phone = part.match(PHONE_RE);
      if (email) {
        details.push({ label: 'Email address', value: email[0], key: 'email' });
        matched.push(part);
      } else if (url) {
        details.push({ label: 'Website or profile', value: url[0], key: 'url' });
        matched.push(part);
      } else if (phone && part.replace(/\D/g, '').length >= 9) {
        details.push({ label: 'Phone number', value: phone[0].trim(), key: 'phone' });
        matched.push(part);
      }
    }
    const rest = parts.filter((part) => !matched.includes(part));
    if (matched.length) {
      for (const part of rest) {
        if (part.length < 48) details.push({ label: 'Location', value: part, key: 'location' });
      }
      return;
    }
    if (index === 0 && !name && line.length <= 60) {
      name = line.replace(/\t/g, ' ').trim();
      return;
    }
    if (!headline && line.length <= 80 && !/[.!?]$/.test(line)) {
      headline = line.replace(/\t/g, ' ').trim();
      return;
    }
    leftovers.push(line.replace(/\t/g, ' ').trim());
  });

  return { name, headline, details, summary: leftovers.join('\n\n') };
}

function buildPersonalBlocks(header) {
  const sectionId = 'personal';
  const blocks = [];
  const add = (label, value, key, extra = {}) => {
    if (!value) return;
    blocks.push({ id: nextId('field'), sectionId, kind: 'field', data: { label, value, key, ...extra } });
  };

  if (header.name) {
    const parts = header.name.split(/\s+/);
    add('Full name', header.name, 'fullName');
    if (parts.length > 1) {
      add('First name', parts[0], 'firstName');
      add('Last name', parts[parts.length - 1], 'lastName');
      if (parts.length > 2) add('Middle name(s)', parts.slice(1, -1).join(' '), 'middleName');
    }
  }
  if (header.headline) add('Professional headline', header.headline, 'headline');

  const seen = new Set();
  for (const detail of header.details) {
    const dedupeKey = `${detail.key}:${detail.value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    add(detail.label, detail.value, detail.key);
    if (detail.key === 'location' && detail.value.includes(',')) {
      const [city, ...rest] = detail.value.split(',');
      add('City', city.trim(), 'city');
      add('Country', rest.join(',').trim(), 'country');
    }
  }
  return blocks;
}

/* Main entry point: raw CV text in, sections and blocks out. */
export function parseCv(rawText) {
  blockCounter = 0;
  const lines = toLines(rawText);
  const headerLines = [];
  const found = [];
  let current = null;

  for (const line of lines) {
    const heading = headingType(line);
    if (heading) {
      current = { type: heading.type, title: heading.title, lines: [] };
      found.push(current);
      continue;
    }
    if (current) current.lines.push(line);
    else headerLines.push(line);
  }

  const header = parseHeader(headerLines);
  const sections = [];

  const personalBlocks = buildPersonalBlocks(header);
  if (personalBlocks.length) {
    sections.push({ id: 'personal', type: 'personal', title: 'Personal details', blocks: personalBlocks });
  }
  if (header.summary) {
    sections.push({
      id: 'summary-top',
      type: 'summary',
      title: 'Professional summary',
      blocks: [{ id: nextId('text'), sectionId: 'summary-top', kind: 'text', data: { label: 'Summary', text: header.summary } }],
    });
  }

  found.forEach((section, index) => {
    const id = `${section.type}-${index + 1}`;
    let blocks = [];
    switch (section.type) {
      case 'experience':
      case 'volunteering':
        blocks = parseExperience(section.lines, id);
        break;
      case 'education':
        blocks = parseEducation(section.lines, id);
        break;
      case 'certifications':
        blocks = parseCertifications(section.lines, id);
        break;
      case 'skills':
      case 'languages':
        blocks = parseSkills(section.lines, id, section.title);
        break;
      case 'summary':
        blocks = [{ id: nextId('text'), sectionId: id, kind: 'text', data: { label: section.title, text: section.lines.join('\n\n') } }];
        break;
      default:
        blocks = parseTextBlocks(section.lines, id);
    }
    if (blocks.length) {
      sections.push({ id, type: section.type, title: section.title, blocks });
    }
  });

  return {
    parsedAt: new Date().toISOString(),
    header,
    sections,
  };
}
