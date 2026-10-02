# Publishing posts

Copy `scripts/publish.sh` into the folder where you write posts (e.g. a Dropbox folder).
Each post is a sub-folder with an `index.md` and its pictures:

```
blog/
  publish.sh
  _template/          <- folders starting with "_" are never published
  clay-1/
    index.md
    IMG_1288.jpeg
```

`index.md`:

```markdown
---
title: "Clay log 2"        # delete this line for a photo-only tile (no text overlay)
date: 2026-10-02
draft: false               # draft: true = the script skips this folder
cover:
  image: "IMG_1288.jpeg"   # optional; otherwise the first image is the thumbnail
---
![caption](IMG_1289.jpeg)
```

Run `./publish.sh`. Every post folder that doesn't exist on GitHub yet is pushed to `main`
and the site rebuilds in about a minute. Existing folders are skipped; to push edits to one,
run `./publish.sh clay-2`.

Needs `git` with push access to the repo (SSH key by default; for HTTPS run
`REPO=https://github.com/junbo-wang-plus/mysite.git ./publish.sh`).
Use JPEG/PNG images, not HEIC. Wrap filenames with spaces in `<>`: `![](<IMG 1.jpg>)`.
