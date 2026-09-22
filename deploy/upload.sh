#!/usr/bin/env bash
# Uploads the tool to projects.slash301.com over SFTP.
#
#   SFTP_PASSWORD='...' ./deploy/upload.sh
#
# The password is never stored in this repository. Pass it in the environment,
# or leave it out and the script asks for it.

set -euo pipefail

HOST="${SFTP_HOST:-197.221.14.158}"
PORT="${SFTP_PORT:-22}"
USER="${SFTP_USER:-slashquxkz}"
REMOTE_DIR="${REMOTE_DIR:-/public_html/projects.slash301.com/cv-paster}"

cd "$(dirname "$0")/.."
FILES=(index.html assets src vendor)

for item in "${FILES[@]}"; do
  [ -e "$item" ] || { echo "Missing $item. Run this from a full checkout." >&2; exit 1; }
done

if [ -z "${SFTP_PASSWORD:-}" ]; then
  read -rsp "Password for $USER@$HOST: " SFTP_PASSWORD
  echo
fi
export SFTP_PASSWORD

echo "Uploading to $HOST:$REMOTE_DIR"

if command -v lftp >/dev/null 2>&1; then
  # lftp creates the folders it needs and copies only what changed.
  lftp -c "
    set sftp:auto-confirm yes;
    set net:max-retries 2;
    open -u '$USER',\"\$SFTP_PASSWORD\" sftp://$HOST:$PORT;
    mkdir -p '$REMOTE_DIR';
    mirror --reverse --delete --verbose \
      --include-glob index.html \
      --include assets/ --include src/ --include vendor/ \
      --exclude-glob .* \
      . '$REMOTE_DIR';
  "
elif command -v sshpass >/dev/null 2>&1 && command -v sftp >/dev/null 2>&1; then
  # OpenSSH cannot copy a tree in one step, so each folder goes up on its own.
  sshpass -e -P assword sftp -o StrictHostKeyChecking=accept-new -P "$PORT" "$USER@$HOST" <<SFTP
mkdir $REMOTE_DIR
put index.html $REMOTE_DIR/
put -r assets $REMOTE_DIR/
put -r src $REMOTE_DIR/
put -r vendor $REMOTE_DIR/
bye
SFTP
else
  cat >&2 <<'HELP'
Neither lftp nor sshpass is installed.

  macOS:          brew install lftp
  Debian/Ubuntu:  sudo apt install lftp

Or upload dist/cv-paster-site.zip through the hosting file manager and unzip it
there.
HELP
  exit 1
fi

echo "Done. The tool should be at https://projects.slash301.com/cv-paster/"
