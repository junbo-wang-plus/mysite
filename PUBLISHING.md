# Writing and publishing posts from Dropbox

The home page is a photo grid. Each post is one square tile:

- **No `title`** → the tile is just the picture (photo post).
- **With a `title`** → the title is overlaid at the bottom of the picture.

The thumbnail is `cover.image` if set, otherwise the first image in the post, cropped to a square.

## Writing a post

Posts live in Dropbox at `Dropbox/Apps/<your app name>/posts/`, one folder per post:

```
posts/
  _template/            <- anything starting with "_" is ignored, keep templates/notes here
    index.md
  clay-1/
    index.md
    IMG_1288.jpeg
    IMG_1289.jpeg
  2026-10-02-fjord/
    index.md
    fjord.jpg
```

The folder name becomes the URL (`junbowang.com/posts/clay-1/`). `index.md`:

```markdown
---
title: "Clay log 2"          # delete this line for a photo-only post
date: 2026-10-02
draft: false                 # true = stays off the site
cover:
  image: "IMG_1288.jpeg"     # optional; otherwise the first image is used
---
Some text.

![caption shown under the photo](IMG_1289.jpeg)
![](IMG_1290.jpeg)
```

Tips:

- Images go in the same folder as `index.md`. Use JPEG/PNG/WebP (not HEIC — set iPhone
  *Settings → Camera → Formats → Most Compatible*, or export as JPEG).
- If a filename has spaces, wrap it in angle brackets: `![](<IMG 1290.jpeg>)`.
- Posts with a `date` in the future don't appear until that date.
- Delete a post folder in Dropbox → it disappears from the site on the next sync.
- Any markdown editor that syncs with Dropbox works (e.g. iA Writer, 1Writer on iPhone,
  Obsidian, or just a text editor on the laptop).

## Publishing

- **Automatic:** GitHub checks Dropbox every hour and publishes anything that changed.
- **Right now:** GitHub (web or mobile app) → this repo → *Actions* → *Publish from Dropbox* →
  *Run workflow*. The site updates about a minute later.

## One-time setup

1. **Create a Dropbox app** at <https://www.dropbox.com/developers/apps> →
   *Create app* → *Scoped access* → *App folder* → name it (e.g. `junbowang-site`).
   This creates `Dropbox/Apps/junbowang-site/`, and the app can only see that folder.
2. In the app's **Permissions** tab, tick `files.content.read` and click *Submit*.
3. From the **Settings** tab, note the *App key* and *App secret*.
4. **Get a refresh token** (once). Open this URL in a browser (replace `APP_KEY`), click *Allow*,
   and copy the code it shows:

   ```
   https://www.dropbox.com/oauth2/authorize?client_id=APP_KEY&response_type=code&token_access_type=offline
   ```

   Then in a terminal:

   ```sh
   curl https://api.dropboxapi.com/oauth2/token \
     -u APP_KEY:APP_SECRET -d grant_type=authorization_code -d code=THE_CODE
   ```

   Copy the `refresh_token` value from the response.
5. In GitHub: repo → *Settings* → *Secrets and variables* → *Actions* → *New repository secret*,
   add `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, `DROPBOX_REFRESH_TOKEN`.
6. **Move the existing posts to Dropbox:** copy everything in `content/posts/` of this repo into
   `Dropbox/Apps/junbowang-site/posts/`. From now on Dropbox is the source of truth — the sync
   replaces `content/posts/` with whatever is in Dropbox (it refuses to run if the Dropbox folder
   has no posts, so an empty folder can't wipe the site).
7. Run *Actions → Publish from Dropbox → Run workflow* once to check it works.

Note: GitHub pauses scheduled workflows after 60 days without repository activity; if the hourly
sync stops, run it manually once (or re-enable it in the Actions tab).
