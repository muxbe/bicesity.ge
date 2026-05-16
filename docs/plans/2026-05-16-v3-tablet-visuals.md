# V3 Tablet Visuals Implementation Plan

## Goal

Add a tablet viewport mode to the standalone V3 docs preview while preserving the PC-first mode.

## Files

- Create `docs/specs/2026-05-16-v3-tablet-visuals.md`.
- Create `docs/plans/2026-05-16-v3-tablet-visuals.md`.
- Modify `docs/v3/index.html`.
- Modify `docs/v3/verify-v3.mjs`.

## Steps

1. Add the tablet spec and implementation plan docs.
2. Add a `Tablet` mode button with `data-viewport="tablet"` to `docs/v3/index.html`.
3. Add `activeViewport` state and mode-button event handling.
4. Update `renderShell()` to render `PC / ...` or `Tablet / ...` titles from the current viewport.
5. Add `viewport-${activeViewport}` to the preview stage.
6. Add a `.viewport-tablet` CSS layer that changes the preview canvas width and restructures public catalog, product detail, admin/seller shell, inventory rows, reports, fields, rent, and auth pages.
7. Update `docs/v3/verify-v3.mjs` to require the tablet mode, stage class, tablet labels, and key tablet CSS snippets.
8. Run `node docs/v3/verify-v3.mjs`.

## Testing

Run:

```bash
node docs/v3/verify-v3.mjs
```

Expected:

```text
v3 route structure verified.
```

## Notes

This is a docs visual preview only. Production tablet implementation should happen after the tablet preview is reviewed and approved.
