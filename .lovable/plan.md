# Add menu items to categories from the Category section

Today the **Categories** card on the Menu page only lets you create / rename / delete categories. You can only attach an item to a category by opening the "Add Item" / "Edit Item" dialog at the top of the page. We'll make categories first-class containers so you can add items directly from there.

## What the user will see

**1. Inline "Add items" while creating a category**

The "New category name…" row gets a small "Create & add items" affordance. Flow:
- Type a category name → press **Create**.
- A toast confirms creation, and the new category row auto-expands with a small **"+ Add item"** button right below it (same UI as #2).
- Optional follow-up: an "Add existing items to this category" multi-select that shows uncategorized items so you can bulk-assign them in one click.

**2. Each category row becomes expandable**

Each category in the list gets a chevron. Expanding it shows:
- The list of menu items currently in that category (name + price), with a small **×** to remove an item from the category (sets `category_id = null`, doesn't delete the item).
- A **"+ Add item"** button that opens a compact popover with two tabs:
  - **New item** — name + price (+ optional description), creates a `menu_items` row already linked to this category.
  - **Existing item** — searchable list of items not yet in this category; clicking one moves it in.
- An item count badge next to the category name (e.g. `Mains · 6`).

**3. Empty-state nudge**

When a category has zero items, the expanded panel shows "No items in this category yet" with the same "+ Add item" button, so the user always has a one-click path.

## Technical changes

Files touched:

- **`src/components/menu/CategoryManager.tsx`** — main work:
  - Pull `menu_items` via `useQuery(["menu_items"], listMenuItems)` and group by `category_id`.
  - Add expand/collapse state per category row.
  - Add `<AddItemToCategoryPopover />` (new sub-component in the same file or `src/components/menu/AddItemToCategoryPopover.tsx`) with the New / Existing tabs, using shadcn `Popover` + `Tabs` + `Command` for search.
  - Mutations:
    - Create new item in category → `createMenuItem({ ..., category_id, owner_id: user.id, available: true })`.
    - Move existing item → `updateMenuItem(id, { category_id })`.
    - Remove from category → `updateMenuItem(id, { category_id: null })`.
  - On the create-category mutation `onSuccess`, auto-expand the newly created row and (optionally) open the popover.
  - Invalidate `["menu_items"]` and `["categories"]` after every mutation.

- **`src/services/menu.ts`** — no schema changes needed; reuse `createMenuItem` / `updateMenuItem`. Optionally add a small helper `listItemsByCategory(categoryId)` for clarity, but client-side grouping is fine given current data sizes.

- **`src/routes/_authenticated/dashboard.menu.tsx`** — no behavioral changes; the existing "Add Item" dialog at the top stays as-is for users who prefer it. The CategoryManager card simply gains the new affordances. Both views share the same `["menu_items"]` query key so they stay in sync automatically.

No DB migration, no RLS changes, no new dependencies — all UI + existing service calls.

## Out of scope

- Drag-and-drop reordering of items between categories (can be a follow-up).
- Per-platform availability toggles inside the category panel (already handled in the main Menu table).
