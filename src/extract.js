/* Gets plain text out of an uploaded file, in the browser.

   Nothing is uploaded anywhere: PDF and Word files are read in the page itself. */

const PDFJS_VERSION = '4.6.82';
const MAMMOTH_VERSION = '1.8.0';

/* The readers are bundled in vendor/ so the page works offline. The public
   copies are only a fallback, for when the single-file build is opened on its
   own without the vendor folder beside it. */
const SOURCES = {
  pdf: {
    local: new URL('../vendor/pdfjs/pdf.min.mjs', import.meta.url).href,
    remote: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`,
  },
  pdfWorker: {
    local: new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href,
    remote: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`,
  },
  mammoth: {
    local: new URL('../vendor/mammoth/mammoth.browser.min.js', import.meta.url).href,
    remote: `https://cdnjs.cloudflare.com/ajax/libs/mammoth/${MAMMOTH_VERSION}/mammoth.browser.min.js`,
  },
};

let pdfLibrary = null;
let mammothLibrary = null;

async function loadPdfLibrary() {
  if (pdfLibrary) return pdfLibrary;
  let module;
  try {
    module = await import(/* @vite-ignore */ SOURCES.pdf.local);
    module.GlobalWorkerOptions.workerSrc = SOURCES.pdfWorker.local;
  } catch (error) {
    module = await import(/* @vite-ignore */ SOURCES.pdf.remote);
    module.GlobalWorkerOptions.workerSrc = SOURCES.pdfWorker.remote;
  }
  pdfLibrary = module;
  return module;
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Could not load ${url}`));
    document.head.appendChild(script);
  });
}

async function loadMammoth() {
  if (mammothLibrary) return mammothLibrary;
  try {
    await loadScript(SOURCES.mammoth.local);
  } catch (error) {
    await loadScript(SOURCES.mammoth.remote);
  }
  mammothLibrary = window.mammoth;
  if (!mammothLibrary) throw new Error('The Word reader did not load.');
  return mammothLibrary;
}

/* Rebuilds lines from the positioned pieces of text that pdf.js returns.

   Pieces sharing a baseline become one line. A wide horizontal gap becomes a
   tab, which is how the parser tells a job title from the place beside it. */
function itemsToLines(items) {
  const rows = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    const size = Math.abs(item.transform[3]) || 10;
    const row = rows.find((candidate) => Math.abs(candidate.y - y) <= Math.max(2, size * 0.3));
    if (row) {
      row.items.push({ x, width: item.width || 0, text: item.str, size });
      row.y = (row.y + y) / 2;
    } else {
      rows.push({ y, items: [{ x, width: item.width || 0, text: item.str, size }] });
    }
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const pieces = row.items.sort((a, b) => a.x - b.x);
      let line = '';
      let cursor = null;
      for (const piece of pieces) {
        if (cursor !== null) {
          const gap = piece.x - cursor;
          const size = piece.size || 10;
          if (gap > size * 2.2) line += '\t';
          else if (gap > size * 0.18 && !/\s$/.test(line) && !/^\s/.test(piece.text)) line += ' ';
        }
        line += piece.text;
        cursor = piece.x + (piece.width || 0);
      }
      return line.trim();
    })
    .filter(Boolean);
}

async function extractPdf(file) {
  const pdfjs = await loadPdfLibrary();
  const buffer = await file.arrayBuffer();
  const document = await pdfjs.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(itemsToLines(content.items).join('\n'));
  }
  return pages.join('\n');
}

async function extractDocx(file) {
  const mammoth = await loadMammoth();
  const buffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const holder = document.createElement('div');
  holder.innerHTML = result.value;
  holder.querySelectorAll('li').forEach((item) => {
    item.textContent = `• ${item.textContent.trim()}`;
  });
  const lines = [];
  holder.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, td').forEach((node) => {
    const text = node.textContent.replace(/\s+/g, ' ').trim();
    if (text) lines.push(text);
  });
  return lines.join('\n');
}

export function describeFile(file) {
  const kilobytes = Math.max(1, Math.round(file.size / 1024));
  return `${file.name} (${kilobytes} KB)`;
}

/* Reads a CV file and returns its text. */
export async function extractText(file) {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    return extractPdf(file);
  }
  if (name.endsWith('.docx')) {
    return extractDocx(file);
  }
  if (name.endsWith('.doc')) {
    throw new Error('Old .doc files are not supported. Save the CV as .docx or PDF, or paste the text instead.');
  }
  if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.rtf') || file.type.startsWith('text/')) {
    const text = await file.text();
    return name.endsWith('.rtf') ? text.replace(/\\[a-z]+\d*\s?|[{}]/g, '') : text;
  }
  throw new Error('Unsupported file type. Use a PDF, .docx, or plain text file, or paste the CV text.');
}
