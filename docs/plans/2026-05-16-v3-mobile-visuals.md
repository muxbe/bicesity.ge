# V3 Mobile Visuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile viewport mode to the standalone V3 docs preview.

**Architecture:** Extend the existing PC/Tablet preview state with a third `mobile` value. Keep the preview as one static HTML/CSS/JS route and layer mobile styling under `.viewport-mobile` so PC and Tablet behavior remains untouched.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Node.js verifier.

---

### Task 1: Document Mobile Preview Scope

**Files:**
- Create: `docs/specs/2026-05-16-v3-mobile-visuals.md`
- Create: `docs/plans/2026-05-16-v3-mobile-visuals.md`

- [ ] **Step 1: Write the spec**

Create `docs/specs/2026-05-16-v3-mobile-visuals.md` with the mobile preview problem, goal, scope, non-goals, acceptance criteria, and rollback instructions.

- [ ] **Step 2: Write this plan**

Create `docs/plans/2026-05-16-v3-mobile-visuals.md` with file responsibilities, implementation steps, and the verification command.

### Task 2: Add Mobile Viewport State

**Files:**
- Modify: `docs/v3/index.html`

- [ ] **Step 1: Add the Mobile button**

Add this button inside `.view-actions` after the Tablet button:

```html
<button class="mode-button" type="button" data-viewport="mobile">Mobile</button>
```

- [ ] **Step 2: Extend viewport labels**

Update `viewportLabel()` so it returns `Mobile` when `activeViewport === "mobile"`, `Tablet` for tablet, and `PC` otherwise.

### Task 3: Add Mobile Layout CSS

**Files:**
- Modify: `docs/v3/index.html`

- [ ] **Step 1: Add phone canvas rules**

Add `.preview-stage.viewport-mobile`, `.viewport-mobile .pc-board`, `.viewport-mobile .pc-page`, and `.viewport-mobile .pc-canvas` rules to make a phone-width preview.

- [ ] **Step 2: Add public page rules**

Add `.viewport-mobile` rules for `.shop-nav`, `.logo-image`, `.nav-links`, `.account-block`, `.hero`, `.catalog-tools`, `.tool-row`, `.detail-filter-row`, `.catalog-section`, and `.product-grid`.

- [ ] **Step 3: Add product detail and rent rules**

Add `.viewport-mobile` rules for `.detail-page`, `.gallery-main`, `.thumb`, `.detail-key-specs`, `.detail-spec-grid`, `.purchase-card`, `.rent-layout`, `.rent-image`, and `.rent-card-grid`.

- [ ] **Step 4: Add admin, seller, fields, reports, settings, and auth rules**

Add `.viewport-mobile` rules for `.admin-shell`, `.side-nav`, `.side-brand`, `.side-links`, `.admin-main`, `.metric-row`, `.admin-filter-grid`, `.inventory-item`, `.status-stack`, `.fields-grid`, `.settings-grid`, `.report-grid`, `.table-row`, and `.auth-grid`.

### Task 4: Update Verification

**Files:**
- Modify: `docs/v3/verify-v3.mjs`

- [ ] **Step 1: Add required snippets**

Require `data-viewport="mobile"`, `viewport-mobile`, `activeViewport === "mobile"`, and representative mobile selectors for admin shell, product grid, product detail, and auth grid.

- [ ] **Step 2: Run verification**

Run:

```bash
node docs/v3/verify-v3.mjs
```

Expected output:

```text
v3 route structure verified.
```

### Self-Review

- The plan covers the spec requirements for button, state, title label, CSS, verifier, and docs.
- There are no placeholders.
- The mobile state value is consistently `mobile`.
