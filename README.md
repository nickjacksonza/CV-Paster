# CV Paster

Upload your CV once, then copy it into career portals one piece at a time.

## The problem it solves

An ATS-ready CV still does not save you from the application form. Most career
portals ask you to retype your personal details, every past role, every date,
your skills and your qualifications, and each portal wants them in a slightly
different shape. CV Paster reads your CV and lays it out as blocks with a copy
button on each one, so filling in a form is a series of clicks rather than a
retyping exercise.

## What it does

- **Splits your CV into blocks.** Personal details, professional summary, each
  role, each qualification, each certification and each group of skills.
- **Offers every common date format.** A start date of `08/2023` can be copied
  as `20230801`, `01082023`, `01/08/2023`, `082023`, `Aug 2023` and more, so it
  matches whatever the portal expects. Pick the format you use most and it is
  always shown first.
- **Duplicates any block for a quick edit.** Shorten a job description to fit a
  character limit, or reword it for one application, without losing the
  original. The copy sits next to the original and is marked as an edited copy.
- **Reshapes lists.** Job descriptions copy as bullets, dashes, plain lines or a
  single paragraph. Skills copy as a comma list, a semicolon list, one per line
  or as bullets.
- **Keeps track.** Each field you have copied gets a tick, so you can see what
  you have already pasted into a long form.
- **Counts characters,** because portals often cap a description at 200 or 2000.
- **Stays in your browser.** The file is read in the page itself. Nothing is
  uploaded, and the parsed CV is kept in the browser's local storage until you
  delete it.

## Using it

Open `index.html` through a web server and upload a CV:

```bash
git clone https://github.com/nickjacksonza/CV-Paster.git
cd CV-Paster
npm start           # serves the folder at http://localhost:8000
```

A web server is needed because browsers refuse to load JavaScript modules from
a `file://` address. If you would rather have one file you can double-click,
build it:

```bash
npm run build       # writes dist/cv-paster.html
```

The tool is a set of static files, so it can also be published as-is to GitHub
Pages or any static host.

### Supported files

| Format            | Notes                                                        |
| ----------------- | ------------------------------------------------------------ |
| PDF               | Text-based PDFs. A scanned page holds a picture, not text.    |
| Word (`.docx`)    | Saved by Word, Google Docs or LibreOffice.                    |
| Plain text        | `.txt`, `.md`, and a rough read of `.rtf`.                    |
| Pasted text       | Paste the CV straight into the box on the upload screen.      |

Old `.doc` files are not supported. Save them as `.docx` or PDF first.

### Date formats on offer

Every date found in the CV is offered as: `YYYYMMDD`, `YYYY-MM-DD`, `DDMMYYYY`,
`DD/MM/YYYY`, `MM/DD/YYYY`, `MMYYYY`, `MM/YYYY`, `YYYY-MM`, `MMM YYYY`,
`Month YYYY` and `YYYY`. A role with no end date offers `Present`, `Current`,
`Ongoing`, `Now` and `To date` instead.

Most CVs give a month and a year but no day. When a format needs a day, CV
Paster fills one in: start dates open the month on the 1st and end dates close
it on the last day. A chip marked `~` means part of that date was filled in
rather than read from the CV, and hovering over it says which part. You can
switch to always using the 1st in the copy settings.

Ambiguous numeric dates such as `01/02/2026` are read as day first, unless the
numbers rule that out (`03/25/2026` can only be month first).

### When the reader gets it wrong

CV layouts vary, and the reader works on the shape of the text, so it will
occasionally put a place name in a job title or merge two lines. Every block can
be edited in place, and the pencil icon turns the whole block into a form. An
edited block shows an undo button that restores what the CV said.

## How it works

The CV goes through four steps, none of which leave the browser:

1. `src/extract.js` gets the text out of the file. For PDFs it rebuilds lines
   from the positioned pieces of text that pdf.js returns, and turns a wide gap
   between columns into a tab, which is how a job title is told apart from the
   place beside it.
2. `src/parser.js` joins up lines that were wrapped at the page width, finds the
   section headings, and reads each section into blocks.
3. `src/dates.js` reads every date into a year, a month and a day, so any of
   them can be left out and filled in later when a format needs it.
4. `src/blocks.js` turns those blocks into the rows you see, and into the text
   that lands on the clipboard. `src/app.js` draws the page.

### Development

```bash
npm test            # unit tests for the parser, the dates and the copy text
npm start           # serve the folder
npm run build       # bundle everything into dist/cv-paster.html
```

The tests run on Node's own test runner and need no dependencies. There is no
build step for normal use: the browser loads the source files as modules.

### Third-party code

`vendor/` holds Mozilla's pdf.js (Apache-2.0) and mammoth.js (BSD-2-Clause) so
that PDF and Word files can be read offline. See `vendor/README.md` for versions
and licences.

## Licence

MIT. See `LICENSE`.
