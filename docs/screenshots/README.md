# README screenshots

These images are captures of the running app, using the synthetic H.264/AAC fixtures produced by `scripts/prepare-fixtures.mjs`. The video is a dark, silent clip labelled “Sample recording” and “Generated demo footage / No personal recordings”. No personal journey footage is included.

| Public image         | Capture source                                |
| -------------------- | --------------------------------------------- |
| `desktop-player-dark.png` | `.impeccable/review/desktop-fixture.png`      |
| `seek-preview-dark.png`   | `.impeccable/review/seek-preview-desktop.png` |
| `mobile-player-dark.png`  | `.impeccable/review/mobile.png`               |
| `mobile-notes-dark.png`   | `.impeccable/review/mobile-bookmarks.png`     |

## Refreshing the images

With the browser-test requirements from the project guide installed, run:

```sh
npm run test:browser -- --grep "responsive screenshots|generic camera"
```

Copy the resulting captures into this directory using the names in the table. Inspect them before committing: text and images should be loaded, important controls should be visible, and the captures should still show synthetic footage. The root README uses repository-relative image links so the gallery works on GitHub without a local development server.
