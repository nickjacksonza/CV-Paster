# Third-party readers

These files are bundled so the tool can read PDF and Word files without a
network connection, and without sending the CV anywhere.

| Folder    | Library                     | Version | Licence      |
| --------- | --------------------------- | ------- | ------------ |
| `pdfjs`   | Mozilla pdf.js (`pdfjs-dist`) | 4.6.82  | Apache-2.0   |
| `mammoth` | mammoth.js                  | 1.8.0   | BSD-2-Clause |

Each folder keeps the library's own licence file. To update a library, replace
the files with a newer release and change the version numbers above and in
`src/extract.js`.
