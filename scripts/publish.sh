#!/usr/bin/env bash
# Publish new posts to junbowang.com.
#
# Put this script in the folder where you write your posts (one sub-folder per post,
# each with an index.md and its pictures), then run it:
#
#   ./publish.sh              publish every post folder that isn't on the site yet
#   ./publish.sh clay-2       re-publish clay-2 even if it already exists (to push edits)
#
# Folders already on GitHub are skipped. Folders starting with "_" or ".", and posts
# with "draft: true" in their front matter, are never published.
# Needs git, with push access to the repo (SSH key or a saved HTTPS login).
set -euo pipefail

REPO="${REPO:-git@github.com:junbo-wang-plus/mysite.git}"
BRANCH="main"
POSTS_DIR="content/posts"

here="$(cd "$(dirname "$0")" && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Fetching site from GitHub..."
# Shallow clone without downloading any files (photos can be large); we only need
# the list of existing folders and a place to add the new ones.
git clone -q --depth 1 --branch "$BRANCH" --filter=blob:none --no-checkout "$REPO" "$tmp/site"
cd "$tmp/site"
git reset -q

added=""
for dir in "$here"/*/; do
  name="$(basename "$dir")"
  case "$name" in _*|.*) continue ;; esac
  [ -f "$dir/index.md" ] || continue

  if grep -qiE '^draft:[[:space:]]*true' "$dir/index.md"; then
    echo "  draft      $name"
    continue
  fi

  force=false
  for arg in "$@"; do [ "${arg%/}" = "$name" ] && force=true; done

  if git cat-file -e "HEAD:$POSTS_DIR/$name" 2>/dev/null && [ "$force" = false ]; then
    echo "  exists     $name"
    continue
  fi

  rm -rf "${POSTS_DIR:?}/$name"
  mkdir -p "$POSTS_DIR/$name"
  # Copy the post, leaving out Dropbox/macOS junk.
  (cd "$dir" && find . -type f ! -name '.*' ! -name $'Icon\r' -print0 \
    | while IFS= read -r -d '' f; do
        mkdir -p "$tmp/site/$POSTS_DIR/$name/$(dirname "$f")"
        cp "$f" "$tmp/site/$POSTS_DIR/$name/$f"
      done)
  git add -f "$POSTS_DIR/$name"
  echo "  publish    $name"
  added="$added $name"
done

if [ -z "$added" ]; then
  echo "Nothing new to publish."
  exit 0
fi

git commit -q -m "Publish:$added"
git push -q origin "$BRANCH"
echo "Pushed:$added. The site updates in about a minute: https://junbowang.com"
