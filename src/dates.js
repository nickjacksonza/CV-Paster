/* Date parsing and re-formatting.

   Career portals each want a different shape for the same date, so every date
   found in a CV is stored as year / month / day (any of which may be missing)
   and rendered on demand in the formats below. */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_LOOKUP = (() => {
  const map = new Map();
  MONTH_NAMES.forEach((name, index) => {
    map.set(name.toLowerCase(), index + 1);
    map.set(name.slice(0, 3).toLowerCase(), index + 1);
  });
  map.set('sept', 9);
  return map;
})();

export const PRESENT_WORDS = ['present', 'current', 'currently', 'now', 'ongoing', 'to date', 'date', 'today'];
export const PRESENT_VARIANTS = ['Present', 'Current', 'Ongoing', 'Now', 'To date'];

const MONTH_PATTERN = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

/* One date, in any of the shapes a CV tends to use. */
const DATE_TOKEN = [
  `${MONTH_PATTERN}\\.?\\s+\\d{1,2},?\\s+\\d{4}`,
  `${MONTH_PATTERN}\\.?[\\s'/-]+\\d{2,4}`,
  '\\d{4}[/\\-.]\\d{1,2}[/\\-.]\\d{1,2}',
  '\\d{1,2}[/\\-.]\\d{1,2}[/\\-.]\\d{2,4}',
  '\\d{1,2}[/\\-.]\\d{4}',
  '\\d{4}',
].join('|');

const PRESENT_TOKEN = '(?:present|current(?:ly)?|now|ongoing|to\\s*date|today)';
const RANGE_SEPARATOR = '\\s*(?:-|\\u2013|\\u2014|to|until|through|\\u2192)\\s*';

const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})${RANGE_SEPARATOR}(${PRESENT_TOKEN}|${DATE_TOKEN})`, 'i');
const SINGLE_DATE_RE = new RegExp(`(?:^|[\\s(\\u2022|\\t,])(${DATE_TOKEN})(?=$|[\\s)\\u2022|\\t,.])`, 'i');

export const DATE_FORMATS = [
  { id: 'YYYYMMDD', label: 'YYYYMMDD', hint: '20260201' },
  { id: 'YYYY-MM-DD', label: 'YYYY-MM-DD', hint: '2026-02-01' },
  { id: 'DDMMYYYY', label: 'DDMMYYYY', hint: '01022026' },
  { id: 'DD/MM/YYYY', label: 'DD/MM/YYYY', hint: '01/02/2026' },
  { id: 'MM/DD/YYYY', label: 'MM/DD/YYYY', hint: '02/01/2026' },
  { id: 'MMYYYY', label: 'MMYYYY', hint: '022026' },
  { id: 'MM/YYYY', label: 'MM/YYYY', hint: '02/2026' },
  { id: 'YYYY-MM', label: 'YYYY-MM', hint: '2026-02' },
  { id: 'MMM YYYY', label: 'MMM YYYY', hint: 'Feb 2026' },
  { id: 'MMMM YYYY', label: 'Month YYYY', hint: 'February 2026' },
  { id: 'YYYY', label: 'YYYY', hint: '2026' },
];

export const DEFAULT_FORMAT = 'MM/YYYY';

function pad(value, length = 2) {
  return String(value).padStart(length, '0');
}

export function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function normaliseYear(value) {
  const year = Number(value);
  if (year >= 1900) return year;
  if (year >= 100) return year;
  const century = year > 40 ? 1900 : 2000;
  return century + year;
}

/* Reads a single date token. Returns null when the text holds no date. */
export function parseDate(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;

  if (PRESENT_WORDS.includes(raw.toLowerCase().replace(/\s+/g, ' '))) {
    return { present: true, raw };
  }

  /* "March 2024", "Mar '24", "Feb 1, 2026". The day only counts when a separator
     follows it, so the year is never mistaken for a day. */
  const words = raw.toLowerCase().match(new RegExp(`^(${MONTH_PATTERN})\\.?[\\s'/-]+(?:(\\d{1,2})(?:st|nd|rd|th)?,?\\s+)?'?(\\d{2,4})$`));
  if (words) {
    const month = MONTH_LOOKUP.get(words[1].replace('.', ''));
    return { year: normaliseYear(words[3]), month, day: words[2] ? Number(words[2]) : undefined, raw };
  }

  const iso = raw.match(/^(\d{4})[/\-.](\d{1,2})(?:[/\-.](\d{1,2}))?$/);
  if (iso) {
    return { year: Number(iso[1]), month: Number(iso[2]), day: iso[3] ? Number(iso[3]) : undefined, raw };
  }

  const three = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (three) {
    let first = Number(three[1]);
    let second = Number(three[2]);
    /* Day-first unless the numbers say otherwise (01/02/2026 reads as 1 February). */
    let day = first;
    let month = second;
    if (first <= 12 && second > 12) {
      month = first;
      day = second;
    }
    return { year: normaliseYear(three[3]), month, day, raw };
  }

  const two = raw.match(/^(\d{1,2})[/\-.](\d{2,4})$/);
  if (two) {
    return { year: normaliseYear(two[2]), month: Number(two[1]), raw };
  }

  const yearOnly = raw.match(/^(\d{4})$/);
  if (yearOnly) {
    return { year: Number(yearOnly[1]), raw };
  }

  return null;
}

/* Finds a start-to-end range anywhere in a line, e.g. "02/2026 - 04/2026". */
export function findDateRange(line) {
  const text = String(line || '');
  const match = text.match(DATE_RANGE_RE);
  if (!match) return null;
  const start = parseDate(match[1]);
  const end = parseDate(match[2]) || (PRESENT_WORDS.includes(match[2].toLowerCase().replace(/\s+/g, ' ')) ? { present: true, raw: match[2] } : null);
  if (!start) return null;
  return {
    start,
    end: end || { present: true, raw: match[2] },
    raw: match[0],
    index: match.index,
    rest: (text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length)).replace(/\s*\t\s*/g, '\t').trim(),
  };
}

/* Finds a lone date in a line, e.g. an education or certification date. */
export function findSingleDate(line) {
  const text = String(line || '');
  const match = text.match(SINGLE_DATE_RE);
  if (!match) return null;
  const date = parseDate(match[1]);
  if (!date) return null;
  const index = match.index + match[0].indexOf(match[1]);
  return {
    date,
    raw: match[1],
    index,
    rest: (text.slice(0, index) + ' ' + text.slice(index + match[1].length)).replace(/\s*\t\s*/g, '\t').trim(),
  };
}

/* Fills in the parts a CV left out. Start dates open a month, end dates close it. */
export function resolveParts(date, role = 'start', dayAssumption = 'smart') {
  if (!date || date.present || !date.year) return null;
  const monthKnown = Boolean(date.month);
  const dayKnown = Boolean(date.day);
  const closing = dayAssumption === 'smart' && role === 'end';
  const month = monthKnown ? date.month : (closing ? 12 : 1);
  const day = dayKnown ? date.day : (closing ? daysInMonth(date.year, month) : 1);
  return { year: date.year, month, day, monthAssumed: !monthKnown, dayAssumed: !dayKnown };
}

/* Renders a stored date in one of the DATE_FORMATS. */
export function formatDate(date, formatId, options = {}) {
  const { role = 'start', dayAssumption = 'smart', presentText = 'Present' } = options;
  if (!date) return '';
  if (date.present) return presentText;
  const parts = resolveParts(date, role, dayAssumption);
  if (!parts) return '';
  const { year, month, day } = parts;
  switch (formatId) {
    case 'YYYYMMDD': return `${year}${pad(month)}${pad(day)}`;
    case 'YYYY-MM-DD': return `${year}-${pad(month)}-${pad(day)}`;
    case 'DDMMYYYY': return `${pad(day)}${pad(month)}${year}`;
    case 'DD/MM/YYYY': return `${pad(day)}/${pad(month)}/${year}`;
    case 'MM/DD/YYYY': return `${pad(month)}/${pad(day)}/${year}`;
    case 'MMYYYY': return `${pad(month)}${year}`;
    case 'MM/YYYY': return `${pad(month)}/${year}`;
    case 'YYYY-MM': return `${year}-${pad(month)}`;
    case 'MMM YYYY': return `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
    case 'MMMM YYYY': return `${MONTH_NAMES[month - 1]} ${year}`;
    case 'YYYY': return String(year);
    default: return `${pad(month)}/${year}`;
  }
}

/* Says which parts of a rendered date were guessed rather than read from the CV. */
export function describeAssumptions(date, formatId, role = 'start', dayAssumption = 'smart') {
  if (!date || date.present) return '';
  const parts = resolveParts(date, role, dayAssumption);
  if (!parts) return '';
  const usesDay = /DD|MMDD|DDMM/.test(formatId) || formatId === 'YYYYMMDD' || formatId === 'YYYY-MM-DD';
  const usesMonth = formatId !== 'YYYY';
  const guessed = [];
  if (usesMonth && parts.monthAssumed) guessed.push('month');
  if (usesDay && parts.dayAssumed) guessed.push('day');
  if (!guessed.length) return '';
  return `${guessed.join(' and ')} not in the CV, assumed from "${date.raw}"`;
}

/* Plain text for a whole range, used in the "full entry" copy. */
export function formatRange(start, end, formatId, dayAssumption = 'smart') {
  const left = formatDate(start, formatId, { role: 'start', dayAssumption });
  const right = formatDate(end, formatId, { role: 'end', dayAssumption });
  if (left && right) return `${left} - ${right}`;
  return left || right || '';
}
