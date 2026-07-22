---
date: 2026-07-22
topic: "Folder Titles — slug-based keys with separate display title"
status: validated
---

## Problem Statement

The current folder data model uses the folder name as both the storage key and display label. This means:

- **No rename support** — changing the name requires creating a new folder and migrating cards, which risks data loss
- **No room for metadata** — the flat `{ [name]: cardId[] }` structure can't hold additional fields (icons, descriptions, timestamps, etc.)
- **Dual-role confusion** — the "name" serves as storage key, display title, and `_cf_` identifier suffix, making all three fragile

We need to decouple the internal identifier from the user-facing label so folders can be renamed without data loss.

---

## Constraints

- **Backward compatibility** — existing user data in localStorage must be migrated in-place on first load after upgrade
- **Minimal API surface change** — existing callers should require minimal updates
- **TV compatibility** — all new UI (rename) must work via remote control (Select dialog, Input.edit)
- **No external dependencies** — slug generation must be a simple utility, no npm package
- **Storage format stability** — the new format should leave room for future metadata fields without another breaking change

---

## Approach

**Slug-as-key, title-as-label.** On folder creation, an internal slug is generated from the user-provided title and never changes. The title is stored separately and is the only thing the user sees or edits.

**Why not...**

- **Direct rename (old format, change key):** Requires `delete data.folders[oldName]` + `data.folders[newName] = cards` which is a data corruption risk if interrupted. Also breaks `_cf_` references.
- **UUID keys:** Over-engineered for a single-user, single-device plugin. Adds complexity with zero benefit.
- **Keep name as key, add title field:** Rename still requires key migration. The slug approach avoids this entirely.

---

## Architecture

Only the **Store** module changes internally. Consumers get updated to use the new `title` field for display and slugs for operations.

### Data Model

**Before:**
```js
{
  folders: { "My Folder": ["card1", "card2"] },
  cards: { "card1": {...}, "card2": {...} }
}
```

**After:**
```js
{
  folders: {
    "my-folder": { title: "My Folder", cards: ["card1", "card2"] }
  },
  cards: { "card1": {...}, "card2": {...} },
  _migrated: true
}
```

### One-time Migration

In `getData()`, check if `data._migrated` is falsy and any folder value is an array (old format). For each:
1. Generate slug from key via `slugify(key)`
2. Handle collisions by appending `-2`, `-3` etc.
3. Set `data.folders[slug] = { title: key, cards: value }`
4. `delete data.folders[key]`
5. Set `data._migrated = true`, save

---

## Components

### Store (`src/store.js`)

**New/changed functions:**

| Function | Signature | Notes |
|---|---|---|
| `createFolder` | `(title) → void` | Generates slug, stores `{ title, cards: [] }`. Title uniqueness enforced case-insensitively. |
| `renameFolder` | `(slug, newTitle) → void` | **New.** Only updates `title` field. Validates empty, duplicate, system-name. No-op if title unchanged. |
| `getFolderTitle` | `(slug) → string` | **New.** Returns `data.folders[slug].title` |
| `getSlugFromTitle` | `(title) → string\|undefined` | **New.** Finds slug by case-insensitive title match |
| `getFolderNames` | `() → string[]` | **Behavior change.** Returns slugs (keys), not titles. |
| `getAllFoldersWithPreview` | `() → {name, title, cards, count}[]` | **Adds `title` field** to returned objects |
| `getData` | `() → data` | **Internal change.** One-time migration + reads new format |
| All other functions | Unchanged | `deleteFolder(slug)`, `addToFolder(slug, card)`, etc. all use slug |

**Slugify utility:**
```js
function slugify(str) {
  return str.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
```
If slug is empty after processing (e.g., all special chars), fall back to `'folder'`. Append `-2`, `-3` etc. on collision.

### Drawer Hook (`src/drawer-hook.js`)

- **`buildCustomFoldersSection`** — iterates slugs from `getFolderNames()`, looks up title via `getFolderTitle(slug)`. Uses slug in `_cf_` prefix. Displays title in item.
- **`confirmDeleteFolder(slug)`** — looks up title for confirmation dialog text. Passes slug to `Store.deleteFolder(slug)`.
- **`toggleCustomFolder(slug, card)`** — uses slug (parameter changed from `folderName`)
- **Long-press action menu** — instead of direct delete on TV, shows a Select dialog with "Rename" / "Delete"
- **Rename flow** — `Lampa.Input.edit()` with current title, validates via `Store.renameFolder(slug, newTitle)`
- **Non-TV ✕ button** — unchanged, still calls `confirmDeleteFolder(slug)`
- **`openFavoritesDrawer` `onLong`** — extracts slug from `element.where` (strip `_cf_` prefix), opens action menu
- **`onPreshow` `onLong`** — same extract-slug pattern

### Bookmarks Injector (`src/bookmarks-injector.js`)

- Section `title` uses `folder.title` instead of `folder.name`
- `Lampa.Activity.push` uses `folder.name` (slug) for `url`, `folder.title` for display `title`

### Folder View (`src/folder-view.js`)

- No changes needed. Already receives destination via `object.url` (which will be the slug).

### Lang (`src/lang.js`)

New translations:

| Key | English | Russian | Ukrainian |
|---|---|---|---|
| `cf_rename_folder` | ✏️ Rename folder... | ✏️ Переименовать... | ✏️ Перейменувати... |
| `cf_folder_renamed` | Folder renamed to "{title}" | Папка переименована в "{title}" | Папку перейменовано на "{title}" |
| `cf_rename` | Rename | Переименовать | Перейменувати |

---

## Data Flow

### Folder Creation

```
User types title → drawer-hook → Store.createFolder(title)
  → slugify(title) → [collision? → slug-N]
  → data.folders[slug] = { title, cards: [] } → save → return
```

### Folder Rename

```
User selects "Rename" in long-press menu → Input.edit with current title
  → Store.renameFolder(slug, newTitle)
  → validate empty/duplicate/system → update data.folders[slug].title → save
  → Noty.show('cf_folder_renamed')
```

### Folder Display in Bookmarks

```
BookmarksInjector.init() → Store.getAllFoldersWithPreview()
  → [{ name: slug, title: "My Folder", cards: [...], count: N }]
  → each becomes a content row with section.title = folder.title
  → "Show all" → Lampa.Activity.push({ url: slug, title: folder.title, ... })
```

---

## Error Handling

| Situation | Handling |
|---|---|
| `renameFolder` with empty title | Throws `'cf_name_empty'` |
| `renameFolder` with existing title (different folder) | Throws `'cf_name_exists'` |
| `renameFolder` with system category name | Throws `'cf_name_taken_system'` |
| `renameFolder` with same title as current | No-op (success, no save) |
| `renameFolder` with non-existent slug | Throws `'Folder not found'` (fallback string) |
| Migration on corrupt data | `getData()` already has try/catch, returns `{ folders: {}, cards: {} }` |
| Slug collision after migration | Automatic `-N` suffix |
| Empty slug (all special chars) | Fallback to `'folder'` |
| `renameFolder` failure in UI | `catch (err) → Lampa.Noty.show(err, { style: 'error' })` |

---

## Testing Strategy

### New Store Tests (`src/__tests__/store.test.js`)

1. **Slug generation** — `createFolder('Watch Later')` → `data.folders['watch-later'].title === 'Watch Later'`
2. **Slug collision** — `createFolder('Watch Later')` twice → second becomes `'watch-later-2'`
3. **`renameFolder(slug, newTitle)`** — title updated, slug unchanged
4. **`renameFolder` validation** — empty, duplicate, system-name, same-title no-op
5. **`getFolderTitle(slug)`** — returns correct title
6. **`getSlugFromTitle(title)`** — returns correct slug (case-insensitive)
7. **`getAllFoldersWithPreview`** — returned objects have `title` field
8. **Old format migration** — seed localStorage with old format, `getData()` returns new format
9. **`getFolderNames`** — returns slugs (not titles)

### Updated Existing Store Tests

- All `data.folders['Name']` assertions → `data.folders['name'].cards` / `data.folders['name'].title`
- `createFolder('Сериалы')` → slug `'сериалы'` (Russian chars preserved)

### Drawer-hook Tests (`src/__tests__/drawer-hook.test.js`)

- `_cf_` prefix assertions → `'_cf_' + slug` format
- `confirmDeleteFolder` → passes slug to `Store.deleteFolder`
- Rename flow → Input.edit + Store.renameFolder called
- Long-press → extracts slug from `_cf_` prefixed element.where

### Bookmarks-injector Tests

- Section title → uses `folder.title` field
- Activity push title → uses `folder.title`

---

## Open Questions

- **TV remote rename UX:** `Lampa.Input.edit()` requires virtual keyboard on TV. Is this acceptable? I'm assuming yes since it's the same input used for folder creation, which already works on TV.
- **Empty slug edge case:** If user enters a title that slugifies to empty string (e.g., "!!!") — slug falls back to `'folder'`. If `'folder'` exists, becomes `'folder-2'`. The title is still `"!!!"`  but the stored slug might surprise users on data inspection. Acceptable since this is an edge case and the UI displays the title.
