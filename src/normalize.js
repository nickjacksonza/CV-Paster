/* Text clean-up helpers shared by the extractor and the parser. */

const LIGATURES = {
  'ﬀ': 'ff',
  'ﬁ': 'fi',
  'ﬂ': 'fl',
  'ﬃ': 'ffi',
  'ﬄ': 'ffl',
  'ﬅ': 'st',
  'ﬆ': 'st',
};

const BULLET_CHARS = /^[•‣▪●◦⁃·∙*–—\-▸➢➜]\s+/;

/* Turns raw extracted text into tidy lines. Tabs are kept: the PDF extractor
   uses them to mark a wide gap between columns (job title | location). */
export function normalizeText(input) {
  let text = String(input || '').replace(/\r\n?/g, '\n');
  for (const [lig, plain] of Object.entries(LIGATURES)) {
    text = text.split(lig).join(plain);
  }
  text = text
    .replace(/ /g, ' ')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑]/g, '-');
  return text;
}

/* Collapses the stray spacing that PDF extraction leaves behind. */
export function normalizeLine(line) {
  return String(line || '')
    .replace(/[  -   ]+/g, ' ')
    .replace(/\t+/g, '\t')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+([,;:.!?])/g, '$1')
    .replace(/([A-Za-z])-\s+([A-Za-z])/g, '$1-$2')
    .replace(/([A-Za-z])\/\s+([A-Za-z])/g, '$1/$2')
    .replace(/([A-Za-z])\.\s+(com|net|org|io|co|ai|za|ie|uk)\b/g, '$1.$2')
    .replace(/ *\t */g, '\t')
    .trim();
}

export function isBulletLine(line) {
  return BULLET_CHARS.test(String(line || '').trim());
}

export function stripBullet(line) {
  return String(line || '').trim().replace(BULLET_CHARS, '').trim();
}

/* Splits a line on the separators CVs use between contact details. */
export function splitOnSeparators(line) {
  return String(line || '')
    .split(/\s*[•|·∙]\s*|\t| {3,}/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function titleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase());
}
