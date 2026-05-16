# Mobile Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compact the mobile UI so customer-facing content is visible sooner and admin/seller controls are less tall.

**Architecture:** Keep desktop/tablet behavior intact and use responsive Tailwind classes for mobile-only layout differences. Use the existing V3 docs preview as the visual review surface.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, vanilla JS docs preview, Node.js structural verifiers.

---

### Task 1: Add Regression Coverage

**Files:**
- Create: `docs/tests/verify-mobile-visual-polish.mjs`

- [ ] **Step 1: Write mobile visual verifier**

Add checks for compact user catalog filters, language placement, V3 preview parity, and admin/seller compact language controls.

- [ ] **Step 2: Run it before implementation**

Run:

```bash
node docs/tests/verify-mobile-visual-polish.mjs
```

Expected before implementation: failure.

### Task 2: Compact User Catalog Header And Filters

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Move compact language into the top header row**

Render `LanguageSwitcher compact` beside logout for mobile and keep the regular language switcher hidden until `sm`.

- [ ] **Step 2: Make mobile closed filters one line**

Render search input plus filters button in a `grid-cols-[minmax(0,1fr)_auto]` mobile row. Hide category, stock, and search-submit controls on mobile.

- [ ] **Step 3: Move category and stock into the detailed panel**

Add category and stock fields at the top of the detailed filter panel so mobile users can still reach them after tapping Filters.

### Task 3: Product Detail Language Placement

**Files:**
- Modify: `src/app/shop/[id]/page.tsx`

- [ ] **Step 1: Add language switcher to nav actions**

Render `LanguageSwitcher compact` in the product detail nav row.

- [ ] **Step 2: Remove separate language row**

Delete the standalone language row below the product detail nav.

### Task 4: Admin And Seller Compact Language

**Files:**
- Modify: `src/app/admin/layout.tsx`
- Modify: `src/app/seller/layout.tsx`

- [ ] **Step 1: Use compact language switcher**

Change the page-content language switcher to `LanguageSwitcher compact`.

### Task 5: Admin Inventory Mobile Density

**Files:**
- Modify: `src/features/admin/admin-inventory-view.tsx`

- [ ] **Step 1: Compact metrics on mobile**

Use three columns on mobile for the active/reserved/sold metrics and smaller card padding/text.

- [ ] **Step 2: Put search and detailed filters on one mobile row**

Keep category tabs above, then use search input plus filters button in one row.

### Task 6: V3 Preview Parity

**Files:**
- Modify: `docs/v3/index.html`
- Modify: `docs/v3/verify-v3.mjs`

- [ ] **Step 1: Add compact mobile catalog preview rules**

Make the mobile V3 catalog tools show search plus filter button only.

- [ ] **Step 2: Add verifier snippet**

Require the compact mobile catalog CSS in `docs/v3/verify-v3.mjs`.

### Task 7: Verify

Run:

```bash
node docs/tests/verify-mobile-visual-polish.mjs
node docs/tests/verify-mobile-filter-panel.mjs
node docs/v3/verify-v3.mjs
npm run build
```

Expected: all commands pass.

### Self-Review

- Customer-facing mobile catalog receives the largest fix.
- Admin/seller polish stays scoped to density and language placement.
- No desktop layout is intentionally changed.
