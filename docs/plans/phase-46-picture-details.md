# Phase 46: Picture details in the editor

**Branch:** `feature/answers-and-editor`

## Goal

The editor shows what the phones and the projector will get for a question's picture: its size in pixels, file size and format. From the first family game (27 October 2026).

## Assumptions (say if wrong)

- Only what is stored is shown (uploads are resized to at most 1280 px and stored as WebP). The original upload's size is not kept: it would be extra data for no use in the game.
- A small line under the picture in the image field: "1280 × 720 px · 84 KB · WebP".
- The details come from a new owner-only route `GET /api/images/:id/info` (`{ width, height, bytes, mime }`); the upload response returns the same fields so a fresh upload shows them at once.

## Scope

1. Server: `GET /api/images/:id/info` (session; the image's owner, 404 otherwise), the upload response with the details. Tests with `app.inject`.
2. Web: the details line in `image-field.tsx` (TanStack Query, key `['imageInfo', id]`), `Intl.NumberFormat` for the sizes, i18n.

Out of scope: keeping the original, re-encoding, cropping.

## Steps and checks

1. Route and upload response, with tests. Check: server image tests.
2. Image field line. Check: screenshot of the editor at 1440, light and dark.
3. Docs. Check: `pnpm verify`.

## Done when

- Every question picture in the editor shows its pixel size, file size and format; another host's image id gives 404.
- `pnpm verify` passes.

## Verification command

`pnpm verify`
