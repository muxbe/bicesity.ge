# Mobile Filter Panel Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop user-side mobile filters from covering the product list.

**Architecture:** Keep the sticky header responsible for navigation and compact search controls only. Render the expanded detailed filter panel as a sibling below the nav, so normal document flow pushes products down.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, static Node.js verifier.

---

### Task 1: Add a Regression Verifier

**Files:**
- Create: `docs/tests/verify-mobile-filter-panel.mjs`

- [ ] **Step 1: Write the verifier**

Create a Node.js script that reads `src/app/page.tsx` and fails unless the detailed filter panel appears after the sticky nav closes, the panel has a close button, and basic search collapses the panel.

- [ ] **Step 2: Run the verifier before the fix**

Run:

```bash
node docs/tests/verify-mobile-filter-panel.mjs
```

Expected before implementation: failure because the detailed panel is still inside the sticky nav.

### Task 2: Move the Expanded Filter Panel

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Keep compact controls in the nav**

Leave the basic search form and product count inside the existing sticky nav.

- [ ] **Step 2: Move detailed panel below nav**

Move the detailed panel block so it renders after `</nav>` and before the products/rent content branch.

### Task 3: Add Close Behavior

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Collapse on basic search**

Change `handleBasicSearch` to call `applyFilters(true)`.

- [ ] **Step 2: Add panel close button**

Add a close button inside the detailed panel header with `onClick={() => setIsDetailedOpen(false)}` and `aria-label={t('common.close')}`.

### Task 4: Align the V3 Preview

**Files:**
- Modify: `docs/v3/index.html`
- Modify: `docs/v3/verify-v3.mjs`

- [ ] **Step 1: Adjust mobile catalog preview**

Render a compact closed mobile filter action in mobile mode instead of the always-visible detailed filter grid.

- [ ] **Step 2: Update verifier snippets**

Require the mobile closed filter preview snippet in `docs/v3/verify-v3.mjs`.

### Task 5: Verify

**Files:**
- Test: `docs/tests/verify-mobile-filter-panel.mjs`
- Test: `docs/v3/verify-v3.mjs`

- [ ] **Step 1: Run source verifier**

```bash
node docs/tests/verify-mobile-filter-panel.mjs
```

Expected: `mobile filter panel structure verified.`

- [ ] **Step 2: Run V3 verifier**

```bash
node docs/v3/verify-v3.mjs
```

Expected: `v3 route structure verified.`

- [ ] **Step 3: Run app build**

```bash
npm run build
```

Expected: successful Next.js production build.

### Self-Review

- The plan covers the sticky-nav root cause.
- The detailed filter panel remains available and fully functional.
- The filter panel no longer overlays products from inside the sticky nav.
