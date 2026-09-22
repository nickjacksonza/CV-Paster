# Publishing to projects.slash301.com

The site is plain static files, so publishing means copying four things to the
web folder: `index.html`, `assets/`, `src/` and `vendor/`.

## Where it goes

| Setting | Value |
| ------- | ----- |
| Host    | `197.221.14.158` |
| Protocol | SFTP (SSH), port `22` |
| User    | `slashquxkz` |
| Folder  | `/public_html/projects.slash301.com/cv-paster` |
| Address | `https://projects.slash301.com/cv-paster/` |

The password is deliberately not in this repository. Keep it in a password
manager, and give it to the tools below through the `SFTP_PASSWORD` environment
variable or a GitHub secret.

## From your own machine

```bash
SFTP_PASSWORD='the password' ./deploy/upload.sh
```

The script uses `lftp` when it is installed and falls back to `sshpass` with
OpenSSH's `sftp`. On macOS: `brew install lftp`. On Debian or Ubuntu:
`sudo apt install lftp`. Set `REMOTE_DIR` to publish to a different folder.

## From GitHub

`.github/workflows/deploy.yml` does the same upload on a push to `main`, or on
demand from the Actions tab. Add three repository secrets first, under
Settings > Secrets and variables > Actions:

- `SFTP_HOST` = `197.221.14.158`
- `SFTP_USER` = `slashquxkz`
- `SFTP_PASSWORD` = the password

Two optional repository variables change where it lands: `SFTP_PORT` and
`REMOTE_DIR`.

## By hand, through the hosting file manager

Run `npm run zip` to produce `dist/cv-paster-site.zip`. Upload that into
`/public_html/projects.slash301.com/cv-paster` and extract it there. The folder
should then hold `index.html` beside `assets/`, `src/` and `vendor/`.

## Checking it worked

Open `https://projects.slash301.com/cv-paster/`, then upload a CV. If the page
loads but a PDF will not read, `vendor/` did not make it across.
