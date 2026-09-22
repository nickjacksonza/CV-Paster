# CV Paster: notes for future sessions

A static, browser-only tool that splits a CV into blocks you can copy into
career portals. No build step and no framework: `index.html` loads the ES
modules in `src/` directly.

## Layout

| Path                  | What it holds                                            |
| --------------------- | -------------------------------------------------------- |
| `src/extract.js`      | Text out of PDF, `.docx` and plain files                  |
| `src/parser.js`       | Text into sections and blocks                             |
| `src/dates.js`        | Reading and re-formatting dates                           |
| `src/blocks.js`       | Card rows and the text that goes on the clipboard         |
| `src/app.js`          | The interface                                             |
| `vendor/`             | pdf.js and mammoth.js, bundled so PDFs read offline       |
| `tests/`              | Node test runner, no dependencies                         |

`npm test` before any change to the parser or the dates. `npm run build` makes
the single-file version, `npm run zip` makes the upload bundle.

## Deployment target: slash301.com

| Setting  | Value |
| -------- | ----- |
| Host     | `197.221.14.158` |
| Protocol | SFTP over SSH, port `22` |
| User     | `slashquxkz` |
| Folder   | `/public_html/projects.slash301.com/cv-paster` |
| Address  | `https://projects.slash301.com/cv-paster/` |

The password is not kept in this repository. It belongs in a password manager,
and reaches the tooling through the `SFTP_PASSWORD` environment variable or the
GitHub secret of the same name. `deploy/upload.sh` uploads from a local machine
and `.github/workflows/deploy.yml` does the same from GitHub. See
`deploy/README.md`.

Note for sessions running in Claude Code on the web: that sandbox cannot reach
the host, because SSH and the site itself are blocked by the egress policy. The
upload has to run from a local machine or from GitHub Actions.
