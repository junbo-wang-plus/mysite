#!/usr/bin/env bash
# Mirror the Dropbox folder "Apps/<your app>/posts" into content/posts.
# Needs DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN in the environment.
# Files/folders starting with "_" or "." in Dropbox are ignored (use them for templates, notes, etc.).
set -euo pipefail

: "${DROPBOX_APP_KEY:?}" "${DROPBOX_APP_SECRET:?}" "${DROPBOX_REFRESH_TOKEN:?}"
DROPBOX_PATH="${DROPBOX_PATH:-/posts}"
DEST="${DEST:-content/posts}"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

token="$(curl -sSf https://api.dropboxapi.com/oauth2/token \
  -u "$DROPBOX_APP_KEY:$DROPBOX_APP_SECRET" \
  -d grant_type=refresh_token \
  -d refresh_token="$DROPBOX_REFRESH_TOKEN" | jq -r .access_token)"

curl -sSf -X POST https://content.dropboxapi.com/2/files/download_zip \
  -H "Authorization: Bearer $token" \
  -H "Dropbox-API-Arg: {\"path\": \"$DROPBOX_PATH\"}" \
  -o "$tmp/posts.zip"

unzip -q "$tmp/posts.zip" -d "$tmp/unzipped"
src="$tmp/unzipped/$(basename "$DROPBOX_PATH")"

# Safety net: never wipe the site because the Dropbox folder came back empty.
if ! find "$src" -name '*.md' -not -path '*/_*' | grep -q .; then
  echo "No markdown files found in Dropbox:$DROPBOX_PATH - refusing to sync." >&2
  exit 1
fi

find "$src" \( -name '_*' -o -name '.*' -o -name $'Icon\r' \) -prune -exec rm -rf {} +
rm -rf "$DEST"
mkdir -p "$(dirname "$DEST")"
cp -R "$src" "$DEST"
echo "Synced Dropbox:$DROPBOX_PATH -> $DEST"
