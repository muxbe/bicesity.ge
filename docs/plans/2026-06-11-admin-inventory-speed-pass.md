# Admin Inventory Speed Pass

## Problem

Admin inventory actions feel slow even when the page shell loads quickly. Live route timing showed admin HTML is fast, while catalog/field API calls can take hundreds of milliseconds to multiple seconds on cold requests.

## Scope

Start with the lowest-risk interaction fix: Add/Edit modals should open immediately and should not wait for a full catalog reload before showing the form.

## Implementation Plan

1. Add a static verifier that prevents `openCreate` and `openEdit` from awaiting `reload()` before opening their modals.
2. Remove the pre-modal reload from the product action hook.
3. Run the targeted verifier and build.
4. Gate reservation-comment loading so only the reserved inventory page fetches active reservations.
5. Fetch only the current inventory status while using a lightweight counts endpoint for the header cards.

## Out Of Scope

- Product-list pagination.
- Supabase schema/index changes.
