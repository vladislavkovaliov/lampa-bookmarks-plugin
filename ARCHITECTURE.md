# Architecture: Lampa Bookmarks Plugins

## Overview

A client-side plugin for the **Lampa TV** app that extends the built-in bookmarks/favorites system with user-created custom folders. Users can organize their favorite media cards into named folders, with full CRUD support, pagination, and UI integration into Lampa's existing context menus and bookmarks page.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | JavaScript (ES6 modules) |
| Runtime | Lampa TV app (browser-based Smart TV app shell) |
| Storage | `window.localStorage` (JSON-based) |
| UI Framework | Lampa's internal components (`Lampa.Select`, `Lampa.InteractionCategory`, etc.) |
| Testing | [Vitest](https://vitest.dev/) with inline global mocks |
| Build | None (plain ES modules, no bundler) |

## Directory Structure

```
lampda-bookmarks-plugins/
├── src/
│   ├── __tests__/
│   │   ├── bookmarks-injector.test.js
│   │   ├── drawer-hook.test.js
│   │   ├── folder-view.test.js
│   │   └── store.test.js
│   ├── bookmarks-injector.js      # Injects folder rows into bookmarks page
│   ├── drawer-hook.js             # Hooks into context menus and card icons
│   ├── favorite-custom-folders.js # Entry point — plugin bootstrap
│   ├── folder-view.js             # UI component for browsing folder contents
│   ├── lang.js                    # i18n translations (ru, en, uk)
│   └── store.js                   # localStorage persistence layer
├── ARCHITECTURE.md
└── CODE_STYLE.md
```

## Core Components

### 1. Entry Point — `src/favorite-custom-folders.js`

Orchestrates the full plugin lifecycle. Guards against double-initialization via `window.favorite_custom_folders_ready`.

```
init order:
  1. Lang.register()               — load translations
  2. Lampa.Component.add(...)      — register folder-browse component
  3. DrawerHook.init()              — hook UI menus
  4. BookmarksInjector.init()       — inject content rows into bookmarks screen
```

**Key decision**: Waits for `window.appready` or `Lampa.Listener` `'app'` / `'ready'` event before initializing.

### 2. Store — `src/store.js`

Plain module (not a class) with a functional API. Manages all persistent state.

**Storage key**: `favorite_custom_folders`

**Data shape**:
```json
{
  "folders": {
    "Sitcoms": [123, 456],
    "Movies": [789]
  },
  "cards": {
    "123": { "id": 123, "title": "...", ... },
    "456": { "id": 456, "title": "...", ... }
  }
}
```

**Key functions**:
| Function | Purpose |
|----------|---------|
| `createFolder(name)` | Creates empty folder; throws on empty name / duplicates / built-in names |
| `deleteFolder(name)` | Deletes folder + orphans unreferenced cards |
| `addToFolder(name, card)` | Links card to folder (stores cleaned copy) |
| `removeFromFolder(name, cardId)` | Unlinks card; deletes card data if not in any other folder |
| `getFolderCards(name, page, perPage)` | Paginated card retrieval |
| `getAllFoldersWithPreview()` | All folders with first 20 cards (for content rows) |
| `isInFolder(name, cardId)` | Membership check |
| `getFolderNames()` | List of folder names |

**Built-in categories that can't be used as folder names**: `book`, `like`, `wath`, `history`, `look`, `viewed`, `scheduled`, `continued`, `thrown`.

### 3. Drawer Hook — `src/drawer-hook.js`

The most complex module. Integrates custom folders into Lampa's UI via three mechanisms:

- **`setupCardTracking()`** — Monkey-patches `Lampa.Favorite.check` to capture the last-clicked card reference.
- **`setupIconClick()`** — Delegated click handler on document for `.card__icon` elements (bookmark heart icons). Opens a custom drawer (`Lampa.Select`) showing standard favorites toggle + custom folder checkboxes.
- **`onPreshow()`** — Listens to `Lampa.Select` `'preshow'` event to inject custom folder items into any context menu that contains standard favorite items.

**Drawer items**: Built-in (book/like/watch/history) checkboxes + custom folder checkboxes + "Create folder..." action with inline input.

### 4. Bookmarks Injector — `src/bookmarks-injector.js`

Registers a `Lampa.ContentRows` entry named `custom_folders` that appears on the `bookmarks` screen at index 2. Each folder becomes a horizontal row showing up to 20 card previews with "View all" pagination.

### 5. Folder View — `src/folder-view.js`

A `Lampa.InteractionCategory` component factory. Renders paginated grid of cards within a folder. Implements:
- `create()` — initial load with `setTimeout` for async DOM readiness
- `nextPageReuest()` — pagination handler (note: intentional typo in name)
- `cardRender()` — sets `onEnter` / `onFocus` handlers

### 6. Language — `src/lang.js`

Static translation table. Registers strings via `Lampa.Lang.add()`. Supports Russian, English, Ukrainian.

## Data Flow

```
User clicks bookmark icon on a card
        │
        ▼
drawer-hook.js: setupIconClick()
  └─ findCardData(el)         — locate card data in DOM
  └─ openFavoritesDrawer(card) — open Select dialog
       ├─ Built-in: book/like/watch/history checkboxes
       └─ Custom folders: checkboxes + "Create folder..."
              │
              ▼
       User checks/unchecks a folder
       └─ toggleCustomFolder(name, card)
            ├─ Store.addToFolder() / removeFromFolder()
            └─ Lampa.Listener.send('state:changed')

User opens Bookmarks screen
        │
        ▼
bookmarks-injector.js: ContentRows.call()
  └─ Store.getAllFoldersWithPreview()
  └─ Returns folder rows with cards
       └─ User clicks "View all" → Lampa.Activity.push()
            └─ folder-view.js component renders paginated grid
```

## External Dependencies

| Dependency | Nature |
|-----------|--------|
| **Lampa TV app** (`window.Lampa`) | Runtime host. Provides UI primitives (`Lampa.Select`, `Lampa.ContentRows`, `Lampa.InteractionCategory`, etc.) |
| **jQuery** (`window.$`) | Used sparingly in `drawer-hook.js` for DOM manipulation (wrapping elements, event binding) |
| **`window.localStorage`** | Persistence backend |

### Global Lampa API surface used:
- `Lampa.ContentRows.add()`
- `Lampa.Select.show()` / `Lampa.Select.close()` / `Lampa.Select.listener.follow()`
- `Lampa.Favorite.check()` / `Lampa.Favorite.toggle()`
- `Lampa.Router.call()`
- `Lampa.Background.change()`
- `Lampa.Utils.cardImgBackground()` / `Lampa.Utils.clearCard()`
- `Lampa.Activity.push()`
- `Lampa.Listener.follow()` / `Lampa.Listener.send()`
- `Lampa.Lang.translate()` / `Lampa.Lang.add()`
- `Lampa.Component.add()`
- `Lampa.InteractionCategory`
- `Lampa.Input.edit()`
- `Lampa.Controller.toggle()`
- `Lampa.Noty.show()`

## Configuration

No config files or environment variables. All behavior is hardcoded:
- **Page size**: 20 items per page (constant in `store.js` and `folder-view.js`)
- **Content row index**: 2 (hardcoded in `bookmarks-injector.js`)
- **Storage key**: `favorite_custom_folders`
- **Built-in category blocklist**: 9 system category names

## Build & Deploy

- **No build step** — source files are consumed directly as ES modules by Lampa.
- **No package.json** — adding one with `vitest` dev dependency for local testing is expected.
- **Testing**: `npx vitest run` (from `src/` or root if `vitest.config` is set up)
- **Deployment**: Place the `src/` files into Lampa's plugin directory as a `favorite-custom-folders` plugin.

## Testing Strategy

Tests use Vitest with manual global mocks:
- `global.Lampa` is mocked inline in each test file
- The `store` dependency is mocked via `vi.mock('../store', ...)`
- Tests focus on: state mutations, conditional branches, UI handler registration
- Async handling: `setTimeout` in component creation requires `await new Promise(resolve => setTimeout(resolve, 20))`
