# Folder Titles — Slug-Based Keys with Separate Display Title

**Goal:** Decouple folder storage keys from display labels by generating immutable slugs on creation and storing titles separately, enabling rename without data loss.

**Architecture:** Store module gains a `slugify()` utility, migration logic in `getData()`, and three new functions (`renameFolder`, `getFolderTitle`, `getSlugFromTitle`). `createFolder` now accepts a title and generates a slug. The drawer-hook uses slug-`_cf_` prefixes and title display. Bookmarks-injector reads `folder.title` for display. Lang adds 3 i18n keys for rename flow.

**Design:** `thoughts/shared/designs/2026-07-22-folder-titles-design.md`

---

## Dependency Graph

```
Batch 1 (parallel — 2 implementers): 1.1 (Store + tests), 1.2 (Lang)
Batch 2 (parallel — 2 implementers): 2.1 (Drawer Hook + tests), 2.2 (Bookmarks Injector + tests)
Batch 3 (serial): 3.1 (Build verification)
```

---

## Batch 1: Foundation (parallel — 2 implementers)

### Task 1.1: Store — Data model migration, slug generation, new APIs
**File:** `src/store.js`
**Test:** `src/__tests__/store.test.js`
**Depends:** none

**Implementation — `src/store.js`:**

```js
var STORAGE_KEY = 'favorite_custom_folders'

var BUILT_IN_CATEGORIES = ['book', 'like', 'wath', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown']

function slugify(str) {
  var slug = str.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return slug
}

function getData() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY)
    var data = raw ? JSON.parse(raw) : { folders: {}, cards: {} }

    if (!data._migrated) {
      var needsMigration = false
      for (var key in data.folders) {
        if (data.folders.hasOwnProperty(key) && Array.isArray(data.folders[key])) {
          needsMigration = true
          break
        }
      }

      if (needsMigration) {
        var migratedFolders = {}
        for (var key in data.folders) {
          if (data.folders.hasOwnProperty(key)) {
            if (Array.isArray(data.folders[key])) {
              var slug = slugify(key)
              if (slug === '') slug = 'folder'

              var finalSlug = slug
              if (migratedFolders[finalSlug] !== undefined || data.folders[finalSlug] !== undefined) {
                var counter = 2
                while (migratedFolders[finalSlug] !== undefined || data.folders[finalSlug] !== undefined) {
                  finalSlug = slug + '-' + counter
                  counter++
                }
              }

              migratedFolders[finalSlug] = { title: key, cards: data.folders[key] }
            } else {
              migratedFolders[key] = data.folders[key]
            }
          }
        }
        data.folders = migratedFolders
        data._migrated = true
        saveData(data)
      }
    }

    return data
  } catch (e) {
    return { folders: {}, cards: {} }
  }
}

function saveData(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

function cleanupCard(card) {
  var clone = {}
  for (var key in card) {
    if (card.hasOwnProperty(key)) clone[key] = card[key]
  }
  return Lampa.Utils.clearCard ? Lampa.Utils.clearCard(clone) : clone
}

function createFolder(title) {
  title = (title || '').trim()

  if (!title) throw Lampa.Lang.translate('cf_name_empty')

  var lowerTitle = title.toLowerCase()

  if (BUILT_IN_CATEGORIES.indexOf(lowerTitle) >= 0) {
    throw Lampa.Lang.translate('cf_name_taken_system')
  }

  var data = getData()

  // Check title uniqueness (case-insensitive)
  for (var slug in data.folders) {
    if (data.folders.hasOwnProperty(slug)) {
      if (data.folders[slug].title.toLowerCase() === lowerTitle) {
        throw Lampa.Lang.translate('cf_name_exists')
      }
    }
  }

  var slug = slugify(title)
  if (slug === '') slug = 'folder'

  // Handle slug collision
  var finalSlug = slug
  if (data.folders[finalSlug] !== undefined) {
    var counter = 2
    while (data.folders[finalSlug] !== undefined) {
      finalSlug = slug + '-' + counter
      counter++
    }
  }

  data.folders[finalSlug] = { title: title, cards: [] }
  saveData(data)
}

function deleteFolder(slug) {
  var data = getData()

  delete data.folders[slug]

  var usedIds = {}
  for (var folderSlug in data.folders) {
    if (data.folders.hasOwnProperty(folderSlug)) {
      data.folders[folderSlug].cards.forEach(function (id) {
        usedIds[id] = true
      })
    }
  }

  for (var cardId in data.cards) {
    if (data.cards.hasOwnProperty(cardId) && !usedIds[cardId]) {
      delete data.cards[cardId]
    }
  }

  saveData(data)
}

function addToFolder(slug, card) {
  var data = getData()

  if (!data.folders[slug]) return

  if (data.folders[slug].cards.indexOf(card.id) >= 0) return

  data.folders[slug].cards.push(card.id)
  data.cards[card.id] = cleanupCard(card)

  saveData(data)
}

function removeFromFolder(slug, cardId) {
  var data = getData()

  if (!data.folders[slug]) return

  var idx = data.folders[slug].cards.indexOf(cardId)
  if (idx < 0) return

  data.folders[slug].cards.splice(idx, 1)

  var usedElsewhere = false
  for (var folderSlug in data.folders) {
    if (data.folders.hasOwnProperty(folderSlug) && folderSlug !== slug) {
      if (data.folders[folderSlug].cards.indexOf(cardId) >= 0) {
        usedElsewhere = true
        break
      }
    }
  }

  if (!usedElsewhere) {
    delete data.cards[cardId]
  }

  saveData(data)
}

function isInFolder(slug, cardId) {
  var data = getData()
  if (!data.folders[slug]) return false
  return data.folders[slug].cards.indexOf(cardId) >= 0
}

function getFolderNames() {
  var data = getData()
  return Object.keys(data.folders)
}

function getFolderCards(slug, page, perPage) {
  page = page || 1
  perPage = perPage || 20

  var data = getData()
  var folder = data.folders[slug]
  var ids = folder ? folder.cards : []
  var allCards = ids
    .map(function (id) { return data.cards[id] })
    .filter(Boolean)

  var totalPages = Math.ceil(allCards.length / perPage) || 1
  var offset = (page - 1) * perPage
  var results = allCards.slice(offset, offset + perPage)

  return {
    results: results,
    total_pages: totalPages,
    page: page
  }
}

function getCardCount(slug) {
  var data = getData()
  var folder = data.folders[slug]
  return folder ? folder.cards.length : 0
}

function getAllFoldersWithPreview() {
  var data = getData()
  var result = []

  for (var slug in data.folders) {
    if (data.folders.hasOwnProperty(slug)) {
      var folder = data.folders[slug]
      var ids = folder.cards
      var cards = ids
        .map(function (id) { return data.cards[id] })
        .filter(Boolean)

      result.push({
        name: slug,
        title: folder.title,
        cards: cards.slice(0, 20),
        count: cards.length
      })
    }
  }

  return result
}

function renameFolder(slug, newTitle) {
  newTitle = (newTitle || '').trim()

  if (!newTitle) throw Lampa.Lang.translate('cf_name_empty')

  var data = getData()

  if (!data.folders[slug]) throw 'Folder not found'

  // No-op if title unchanged
  if (data.folders[slug].title === newTitle) return

  var lowerNew = newTitle.toLowerCase()

  if (BUILT_IN_CATEGORIES.indexOf(lowerNew) >= 0) {
    throw Lampa.Lang.translate('cf_name_taken_system')
  }

  // Check title uniqueness (case-insensitive, exclude current folder)
  for (var s in data.folders) {
    if (data.folders.hasOwnProperty(s) && s !== slug) {
      if (data.folders[s].title.toLowerCase() === lowerNew) {
        throw Lampa.Lang.translate('cf_name_exists')
      }
    }
  }

  data.folders[slug].title = newTitle
  saveData(data)
}

function getFolderTitle(slug) {
  var data = getData()
  var folder = data.folders[slug]
  return folder ? folder.title : undefined
}

function getSlugFromTitle(title) {
  var data = getData()
  var lower = title.toLowerCase()
  for (var slug in data.folders) {
    if (data.folders.hasOwnProperty(slug)) {
      if (data.folders[slug].title.toLowerCase() === lower) {
        return slug
      }
    }
  }
  return undefined
}

function clearCache() {
}

export default {
  BUILT_IN_CATEGORIES: BUILT_IN_CATEGORIES,
  getData: getData,
  saveData: saveData,
  createFolder: createFolder,
  deleteFolder: deleteFolder,
  renameFolder: renameFolder,
  addToFolder: addToFolder,
  removeFromFolder: removeFromFolder,
  isInFolder: isInFolder,
  getFolderNames: getFolderNames,
  getFolderCards: getFolderCards,
  getCardCount: getCardCount,
  getAllFoldersWithPreview: getAllFoldersWithPreview,
  getFolderTitle: getFolderTitle,
  getSlugFromTitle: getSlugFromTitle,
  cleanupCard: cleanupCard,
  clearCache: clearCache
}
```

**Test — `src/__tests__/store.test.js`:**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

var localStorageMock = (function() {
  var store = {}
  return {
    getItem: vi.fn(function(key) { return store[key] || null }),
    setItem: vi.fn(function(key, value) { store[key] = String(value) }),
    removeItem: vi.fn(function(key) { delete store[key] }),
    clear: vi.fn(function() { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

global.Lampa = {
  Utils: {
    clearCard: vi.fn(function(card) { return Object.assign({}, card, { _cleared: true }) })
  },
  Lang: {
    translate: vi.fn(function(key) { return key })
  }
}

import Store from '../store'

describe('Store', () => {
  beforeEach(() => {
    localStorageMock.clear()
    Store.clearCache()
  })

  describe('createFolder', () => {
    it('should create a folder with slug and title', () => {
      Store.createFolder('Watch Later')
      var data = Store.getData()
      expect(data.folders['watch-later']).toBeDefined()
      expect(data.folders['watch-later'].title).toBe('Watch Later')
      expect(data.folders['watch-later'].cards).toEqual([])
    })

    it('should slugify Russian titles', () => {
      Store.createFolder('Сериалы')
      var data = Store.getData()
      expect(data.folders['сериалы']).toBeDefined()
      expect(data.folders['сериалы'].title).toBe('Сериалы')
    })

    it('should handle slug collision with -N suffix', () => {
      Store.createFolder('Watch Later')
      Store.createFolder('Watch Later')
      var data = Store.getData()
      expect(data.folders['watch-later']).toBeDefined()
      expect(data.folders['watch-later-2']).toBeDefined()
      expect(data.folders['watch-later-2'].title).toBe('Watch Later')
    })

    it('should handle multiple collisions', () => {
      Store.createFolder('Test')
      Store.createFolder('Test')
      Store.createFolder('Test')
      var data = Store.getData()
      expect(data.folders['test']).toBeDefined()
      expect(data.folders['test-2']).toBeDefined()
      expect(data.folders['test-3']).toBeDefined()
    })

    it('should throw on empty name', () => {
      expect(function() { Store.createFolder('') }).toThrow()
      expect(function() { Store.createFolder('  ') }).toThrow()
    })

    it('should throw on duplicate title (case-insensitive)', () => {
      Store.createFolder('Watch Later')
      expect(function() { Store.createFolder('watch later') }).toThrow()
    })

    it('should throw on built-in category name', () => {
      expect(function() { Store.createFolder('book') }).toThrow()
      expect(function() { Store.createFolder('like') }).toThrow()
      expect(function() { Store.createFolder('wath') }).toThrow()
      expect(function() { Store.createFolder('history') }).toThrow()
    })

    it('should fallback to folder for empty-slug titles', () => {
      Store.createFolder('!!!')
      var data = Store.getData()
      expect(data.folders['folder']).toBeDefined()
      expect(data.folders['folder'].title).toBe('!!!')
    })
  })

  describe('renameFolder', () => {
    it('should rename folder title without changing slug', () => {
      Store.createFolder('Watch Later')
      Store.renameFolder('watch-later', 'New Name')
      var data = Store.getData()
      expect(data.folders['watch-later'].title).toBe('New Name')
    })

    it('should throw on empty title', () => {
      Store.createFolder('Watch Later')
      expect(function() { Store.renameFolder('watch-later', '') }).toThrow()
      expect(function() { Store.renameFolder('watch-later', '  ') }).toThrow()
    })

    it('should throw on system category name', () => {
      Store.createFolder('Watch Later')
      expect(function() { Store.renameFolder('watch-later', 'book') }).toThrow()
    })

    it('should throw on duplicate title', () => {
      Store.createFolder('Watch Later')
      Store.createFolder('Movies')
      expect(function() { Store.renameFolder('watch-later', 'Movies') }).toThrow()
    })

    it('should no-op when title unchanged', () => {
      Store.createFolder('Watch Later')
      Store.renameFolder('watch-later', 'Watch Later')
      var data = Store.getData()
      expect(data.folders['watch-later'].title).toBe('Watch Later')
    })

    it('should throw on non-existent slug', () => {
      expect(function() { Store.renameFolder('nonexistent', 'New Name') }).toThrow()
    })
  })

  describe('getFolderTitle', () => {
    it('should return title for existing slug', () => {
      Store.createFolder('Watch Later')
      expect(Store.getFolderTitle('watch-later')).toBe('Watch Later')
    })

    it('should return undefined for non-existent slug', () => {
      expect(Store.getFolderTitle('nonexistent')).toBeUndefined()
    })
  })

  describe('getSlugFromTitle', () => {
    it('should return slug for exact title match', () => {
      Store.createFolder('Watch Later')
      expect(Store.getSlugFromTitle('Watch Later')).toBe('watch-later')
    })

    it('should return slug for case-insensitive match', () => {
      Store.createFolder('Watch Later')
      expect(Store.getSlugFromTitle('watch later')).toBe('watch-later')
    })

    it('should return undefined for non-existent title', () => {
      expect(Store.getSlugFromTitle('Nonexistent')).toBeUndefined()
    })
  })

  describe('getFolderNames', () => {
    it('should return slugs (not titles)', () => {
      Store.createFolder('Watch Later')
      Store.createFolder('My Movies')
      var names = Store.getFolderNames()
      expect(names.indexOf('watch-later') >= 0).toBe(true)
      expect(names.indexOf('my-movies') >= 0).toBe(true)
      expect(names.indexOf('Watch Later') >= 0).toBe(false)
    })
  })

  describe('getAllFoldersWithPreview', () => {
    it('should include title field in returned objects', () => {
      Store.createFolder('Watch Later')
      Store.addToFolder('watch-later', { id: 1, name: 'Test' })
      var folders = Store.getAllFoldersWithPreview()
      expect(folders[0].name).toBe('watch-later')
      expect(folders[0].title).toBe('Watch Later')
      expect(folders[0].count).toBe(1)
    })
  })

  describe('addToFolder / removeFromFolder', () => {
    it('should add a card to folder', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      var data = Store.getData()
      expect(data.folders['сериалы'].cards.indexOf(123) >= 0).toBe(true)
      expect(data.cards['123']).toBeDefined()
      expect(data.cards['123']._cleared).toBe(true)
    })

    it('should remove a card from folder', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      Store.removeFromFolder('сериалы', 123)
      var data = Store.getData()
      expect(data.folders['сериалы'].cards.indexOf(123) >= 0).toBe(false)
      expect(data.cards['123']).toBeUndefined()
    })

    it('should not remove card if it exists in other folders', () => {
      Store.createFolder('Сериалы')
      Store.createFolder('Фильмы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      Store.addToFolder('фильмы', { id: 123, name: 'Test' })
      Store.removeFromFolder('сериалы', 123)
      var data = Store.getData()
      expect(data.cards['123']).toBeDefined()
    })
  })

  describe('isInFolder', () => {
    it('should return true if card is in folder', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      expect(Store.isInFolder('сериалы', 123)).toBe(true)
    })

    it('should return false if card is not in folder', () => {
      Store.createFolder('Сериалы')
      Store.createFolder('Фильмы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      expect(Store.isInFolder('фильмы', 123)).toBe(false)
    })
  })

  describe('deleteFolder', () => {
    it('should delete a folder and its cards', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      Store.deleteFolder('сериалы')
      var data = Store.getData()
      expect(data.folders['сериалы']).toBeUndefined()
      expect(data.cards['123']).toBeUndefined()
    })

    it('should not delete cards referenced by other folders', () => {
      Store.createFolder('Сериалы')
      Store.createFolder('Фильмы')
      Store.addToFolder('сериалы', { id: 123, name: 'Test' })
      Store.addToFolder('фильмы', { id: 123, name: 'Test' })
      Store.deleteFolder('сериалы')
      var data = Store.getData()
      expect(data.cards['123']).toBeDefined()
    })
  })

  describe('getFolderCards', () => {
    it('should return paginated cards', () => {
      Store.createFolder('Большая папка')
      for (var i = 0; i < 50; i++) {
        Store.addToFolder('большая-папка', { id: i, name: 'Card ' + i })
      }
      var page1 = Store.getFolderCards('большая-папка', 1, 20)
      expect(page1.results).toHaveLength(20)
      expect(page1.total_pages).toBe(3)
      expect(page1.page).toBe(1)

      var page3 = Store.getFolderCards('большая-папка', 3, 20)
      expect(page3.results).toHaveLength(10)
      expect(page3.page).toBe(3)
    })
  })

  describe('migration from old format', () => {
    it('should migrate old format on first getData call', () => {
      window.localStorage.setItem('favorite_custom_folders', JSON.stringify({
        folders: { 'My Folder': ['card1', 'card2'], 'Сериалы': ['card3'] },
        cards: { card1: { id: 'card1' }, card2: { id: 'card2' }, card3: { id: 'card3' } }
      }))

      var data = Store.getData()
      expect(data.folders['my-folder']).toBeDefined()
      expect(data.folders['my-folder'].title).toBe('My Folder')
      expect(data.folders['my-folder'].cards).toEqual(['card1', 'card2'])
      expect(data.folders['сериалы']).toBeDefined()
      expect(data.folders['сериалы'].title).toBe('Сериалы')
      expect(data.folders['сериалы'].cards).toEqual(['card3'])
      expect(data._migrated).toBe(true)
    })

    it('should not re-migrate already migrated data', () => {
      window.localStorage.setItem('favorite_custom_folders', JSON.stringify({
        folders: { 'my-folder': { title: 'My Folder', cards: ['card1'] } },
        cards: { card1: { id: 'card1' } },
        _migrated: true
      }))

      var data = Store.getData()
      expect(data.folders['my-folder'].title).toBe('My Folder')
      expect(data.folders['my-folder'].cards).toEqual(['card1'])
    })

    it('should handle collision during migration', () => {
      window.localStorage.setItem('favorite_custom_folders', JSON.stringify({
        folders: { 'My-Folder': ['card1'], 'my-folder': ['card2'] },
        cards: { card1: { id: 'card1' }, card2: { id: 'card2' } }
      }))

      var data = Store.getData()
      expect(data.folders['my-folder']).toBeDefined()
      expect(data.folders['my-folder-2']).toBeDefined()
      expect(data._migrated).toBe(true)
    })
  })
})
```

**Design decisions:** `renameFolder` throws raw string `'Folder not found'` for non-existent slugs (not translated — this is a developer-facing error, not user-facing). Title uniqueness checks are case-insensitive. Slug collision handling in `createFolder` appends `-2`, `-3` etc. Migration in `getData()` converts array-valued folders to `{ title, cards }` format.

**Verify:** `bun test src/__tests__/store.test.js`
**Commit:** `feat(store): slug-based folder keys with display titles`

---

### Task 1.2: Lang — Add rename i18n keys
**File:** `src/lang.js`
**Test:** none (static translations)
**Depends:** none

**Implementation — `src/lang.js` (additions inside `registerTranslations`):**

Add these three new translation blocks after the existing `cf_delete` block:

```js
    cf_rename_folder: {
      ru: '✏️ Переименовать...',
      en: '✏️ Rename folder...',
      uk: '✏️ Перейменувати...'
    },
    cf_folder_renamed: {
      ru: 'Папка переименована в "{title}"',
      en: 'Folder renamed to "{title}"',
      uk: 'Папку перейменовано на "{title}"'
    },
    cf_rename: {
      ru: 'Переименовать',
      en: 'Rename',
      uk: 'Перейменувати'
    }
```

Full resulting `src/lang.js`:

```js
function registerTranslations() {
  Lampa.Lang.add({
    cf_my_folders: {
      ru: '--- Мои папки ---',
      en: '--- My folders ---',
      uk: '--- Мої папки ---'
    },
    cf_create_folder: {
      ru: '➕ Создать папку...',
      en: '➕ Create folder...',
      uk: '➕ Створити папку...'
    },
    cf_folder_name: {
      ru: 'Название папки',
      en: 'Folder name',
      uk: 'Назва папки'
    },
    cf_folder_created: {
      ru: 'Папка "{name}" создана',
      en: 'Folder "{name}" created',
      uk: 'Папка "{name}" створена'
    },
    cf_name_empty: {
      ru: 'Название папки не может быть пустым',
      en: 'Folder name cannot be empty',
      uk: 'Назва папки не може бути порожньою'
    },
    cf_name_taken_system: {
      ru: 'Это имя занято системной категорией',
      en: 'This name is taken by a system category',
      uk: "Це ім'я зайнято системною категорією"
    },
    cf_name_exists: {
      ru: 'Папка с таким именем уже существует',
      en: 'A folder with this name already exists',
      uk: 'Папка з таким іменем вже існує'
    },
    cf_section_title: {
      ru: 'Мои папки',
      en: 'My folders',
      uk: 'Мої папки'
    },
    cf_delete_folder_title: {
      ru: 'Удалить папку "{name}"?',
      en: 'Delete folder "{name}"?',
      uk: 'Видалити папку "{name}"?'
    },
    cf_delete_folder_yes: {
      ru: 'Да, удалить',
      en: 'Yes, delete',
      uk: 'Так, видалити'
    },
    cf_delete_folder_no: {
      ru: 'Отмена',
      en: 'Cancel',
      uk: 'Скасувати'
    },
    cf_folder_deleted: {
      ru: 'Папка удалена',
      en: 'Folder deleted',
      uk: 'Папку видалено'
    },
    cf_delete: {
      ru: 'Удалить',
      en: 'Delete',
      uk: 'Видалити'
    },
    cf_rename_folder: {
      ru: '✏️ Переименовать...',
      en: '✏️ Rename folder...',
      uk: '✏️ Перейменувати...'
    },
    cf_folder_renamed: {
      ru: 'Папка переименована в "{title}"',
      en: 'Folder renamed to "{title}"',
      uk: 'Папку перейменовано на "{title}"'
    },
    cf_rename: {
      ru: 'Переименовать',
      en: 'Rename',
      uk: 'Перейменувати'
    }
  })
}

export default {
  register: registerTranslations
}
```

**Verify:** `bun test` (all existing tests still pass since lang.js is not tested directly)
**Commit:** `feat(lang): add rename folder i18n keys`

---

## Batch 2: Core UI Changes (parallel — 2 implementers)

### Task 2.1: Drawer Hook — Slug/title split, long-press action menu, rename flow
**File:** `src/drawer-hook.js`
**Test:** `src/__tests__/drawer-hook.test.js`
**Depends:** 1.1 (Store API), 1.2 (new i18n keys)

**Implementation — `src/drawer-hook.js`:**

```js
import Store from './store'

var lastCardData = null

var FAV_KEYS = ['book', 'like', 'wath', 'history']

function isFavoriteItem(item) {
  for (var i = 0; i < FAV_KEYS.length; i++) {
    var key = FAV_KEYS[i]
    if (item.where === key || item.type === key) return true
  }
  return false
}

function hasCustomItems(items) {
  for (var i = 0; i < items.length; i++) {
    if (items[i].title && items[i].title.indexOf(Lampa.Lang.translate('cf_create_folder')) >= 0) return true
  }
  return false
}

function setupCardTracking() {
  var origCheck = Lampa.Favorite.check
  if (!origCheck) return

  Lampa.Favorite.check = function (card) {
    lastCardData = card
    return origCheck(card)
  }
}

function toggleCustomFolder(slug, card) {
  if (Store.isInFolder(slug, card.id)) {
    Store.removeFromFolder(slug, card.id)
  } else {
    Store.addToFolder(slug, card)
  }

  Lampa.Listener.send('state:changed', { target: 'favorite', card: card })
}

function confirmDeleteFolder(slug) {
  var folderTitle = Store.getFolderTitle(slug)

  Lampa.Select.close()

  Lampa.Select.show({
    title: Lampa.Lang.translate('cf_delete_folder_title').replace('{name}', folderTitle),
    items: [
      {
        title: Lampa.Lang.translate('cf_delete_folder_yes'),
        onSelect: function () {
          Store.deleteFolder(slug)
          Lampa.Noty.show(Lampa.Lang.translate('cf_folder_deleted'))
          Lampa.Controller.toggle('content')
        }
      },
      {
        title: Lampa.Lang.translate('cf_delete_folder_no'),
        onSelect: function () {
          Lampa.Controller.toggle('content')
        }
      }
    ]
  })
}

function showFolderActions(element) {
  if (element.where && element.where.indexOf('_cf_') === 0) {
    var slug = element.where.slice(4)
    var currentTitle = element.title

    Lampa.Select.close()

    Lampa.Select.show({
      title: Lampa.Lang.translate('cf_rename_folder'),
      items: [
        {
          title: Lampa.Lang.translate('cf_rename'),
          onSelect: function () {
            Lampa.Select.close()

            Lampa.Input.edit({
              title: Lampa.Lang.translate('cf_folder_name'),
              value: currentTitle,
              free: true,
              nosave: true
            }, function (newTitle) {
              if (!newTitle || !newTitle.trim()) {
                Lampa.Controller.toggle('content')
                return
              }

              newTitle = newTitle.trim()

              try {
                Store.renameFolder(slug, newTitle)
                Lampa.Noty.show(
                  Lampa.Lang.translate('cf_folder_renamed').replace('{title}', newTitle)
                )
              } catch (err) {
                Lampa.Noty.show(err, { style: 'error' })
              }

              Lampa.Controller.toggle('content')
            })
          }
        },
        {
          title: Lampa.Lang.translate('cf_delete'),
          onSelect: function () {
            confirmDeleteFolder(slug)
          }
        }
      ]
    })

    return true
  }
  return false
}

function buildCustomFoldersSection(card) {
  var items = []
  var slugs = Store.getFolderNames()

  if (slugs.length > 0) {
    items.push({ title: Lampa.Lang.translate('cf_my_folders'), separator: true })
  }

  slugs.forEach(function (slug) {
    var folderTitle = Store.getFolderTitle(slug)
    var checked = card ? Store.isInFolder(slug, card.id) : false

    items.push({
      title: folderTitle,
      where: '_cf_' + slug,
      type: '_cf_' + slug,
      checkbox: true,
      checked: checked,
      onCheck: function () {
        if (!lastCardData) return
        toggleCustomFolder(slug, lastCardData)
      },
      onDraw: function (item) {
        if (!Lampa.Platform.tv()) {
          var deleteBtn = $('<span class="cf-delete-btn" style="cursor:pointer;opacity:0.5;font-size:14px;line-height:1;padding:2px 6px;margin-left:8px" title="' + Lampa.Lang.translate('cf_delete') + '">✕</span>')

          var titleEl = item.find('.selectbox-item__title')
          if (titleEl.length) {
            var wrapper = $('<div class="cf-folder-row" style="display:flex;align-items:center;justify-content:space-between;width:100%"></div>')
            titleEl.wrap(wrapper)
            titleEl.closest('.cf-folder-row').append(deleteBtn)
          } else {
            item.append(deleteBtn)
          }

          deleteBtn.on('click', function (e) {
            e.stopPropagation()
            confirmDeleteFolder(slug)
          })
        }
      }
    })
  })

  items.push({
    title: Lampa.Lang.translate('cf_create_folder'),
    onSelect: function () {
      Lampa.Select.close()

      Lampa.Input.edit({
        title: Lampa.Lang.translate('cf_folder_name'),
        value: '',
        free: true,
        nosave: true
      }, function (name) {
        if (!name || !name.trim()) {
          Lampa.Controller.toggle('content')
          return
        }

        name = name.trim()

        try {
          Store.createFolder(name)
          Lampa.Noty.show(Lampa.Lang.translate('cf_folder_created').replace('{name}', name))
        } catch (err) {
          Lampa.Noty.show(err, { style: 'error' })
        }

        Lampa.Controller.toggle('content')
      })
    }
  })

  return items
}

// ----- Click handler for card icon (.card__icon.icon--book etc) -----

function findCardData(el) {
  var cardEl = el.closest('[card_data]') || el.closest('.card') || el.closest('.category__item')
  if (!cardEl) return null
  if (cardEl.card_data) return cardEl.card_data

  var dataEl = cardEl.querySelector('[card_data]')
  if (dataEl && dataEl.card_data) return dataEl.card_data

  return null
}

function openFavoritesDrawer(card) {
  lastCardData = card
  var status = Lampa.Favorite.check(card)

  var items = [
    {
      title: Lampa.Lang.translate('title_book'),
      where: 'book', type: 'book',
      checkbox: true,
      checked: status.book
    },
    {
      title: Lampa.Lang.translate('title_like'),
      where: 'like', type: 'like',
      checkbox: true,
      checked: status.like
    },
    {
      title: Lampa.Lang.translate('title_wath'),
      where: 'wath', type: 'wath',
      checkbox: true,
      checked: status.wath
    },
    {
      title: Lampa.Lang.translate('menu_history'),
      where: 'history', type: 'history',
      checkbox: true,
      checked: status.history
    }
  ]

  var customItems = buildCustomFoldersSection(card)
  items = items.concat(customItems)

  items._cf_alreadyAdded = true

  Lampa.Select.show({
    title: Lampa.Lang.translate('title_action'),
    items: items,
    onCheck: function (a) {
      if (a.where && FAV_KEYS.indexOf(a.where) >= 0) {
        Lampa.Favorite.toggle(a.where, card)
      }
    },
    onSelect: function (a) {
      if (a.type && FAV_KEYS.indexOf(a.type) >= 0) {
        Lampa.Favorite.toggle(a.type, card)
      }
    },
    onLong: function (element) {
      showFolderActions(element)
    }
  })
}

function setupIconClick() {
  document.addEventListener('click', function (e) {
    var target = e.target
    if (!target.matches) return

    var icon = target.matches('.card__icon') ? target : target.closest('.card__icon')
    if (!icon || !icon.classList) return

    var isFavIcon = false
    for (var i = 0; i < FAV_KEYS.length; i++) {
      if (icon.classList.contains('icon--' + FAV_KEYS[i])) {
        isFavIcon = true
        break
      }
    }
    if (!isFavIcon) return

    e.preventDefault()
    e.stopPropagation()

    var card = findCardData(icon)
    if (!card) return

    openFavoritesDrawer(card)
  })
}

// ----- Preshow hook for context menu & full/start bookmark button -----

function onPreshow(e) {
  if (e.active.items._cf_alreadyAdded) return
  if (hasCustomItems(e.active.items)) return

  var hasFav = false
  for (var i = 0; i < e.active.items.length; i++) {
    if (isFavoriteItem(e.active.items[i])) {
      hasFav = true
      break
    }
  }
  if (!hasFav) return

  var customItems = buildCustomFoldersSection(lastCardData)
  for (var j = 0; j < customItems.length; j++) {
    e.active.items.push(customItems[j])
  }

  var origOnLong = e.active.onLong
  e.active.onLong = function (element) {
    if (showFolderActions(element)) return
    if (origOnLong) {
      origOnLong(element)
    }
  }
}

function init() {
  setupCardTracking()
  setupIconClick()
  Lampa.Select.listener.follow('preshow', onPreshow)
}

export default {
  init: init,
  getLastCardData: function () { return lastCardData }
}
```

**Test — `src/__tests__/drawer-hook.test.js`:**

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

global.$ = vi.fn(function () {
  return {
    find: vi.fn(function () { return { length: 0, wrap: vi.fn(), closest: vi.fn(function () { return { append: vi.fn() } }) } }),
    append: vi.fn(function () { return this }),
    on: vi.fn(function () { return this }),
    css: vi.fn(function () { return this }),
    addClass: vi.fn(function () { return this }),
    toggleClass: vi.fn(function () { return this }),
    closest: vi.fn(function () { return { append: vi.fn() } }),
    wrap: vi.fn(function () { return this }),
    html: vi.fn(function () { return this }),
    removeClass: vi.fn(function () { return this }),
    text: vi.fn(function () { return this }),
    empty: vi.fn(function () { return this }),
    val: vi.fn(function () { return this })
  }
})
global.$.extend = vi.fn()

global.Lampa = {
  Favorite: {
    check: vi.fn(function() { return true })
  },
  Platform: {
    tv: vi.fn(function() { return false })
  },
  Select: {
    close: vi.fn(),
    show: vi.fn(),
    listener: {
      follow: vi.fn()
    }
  },
  Input: {
    edit: vi.fn()
  },
  Controller: {
    toggle: vi.fn()
  },
  Noty: {
    show: vi.fn()
  },
  Listener: {
    send: vi.fn()
  },
  Lang: {
    translate: vi.fn(function(key) {
      var map = {
        cf_my_folders: '--- Мои папки ---',
        cf_create_folder: '➕ Создать папку...',
        cf_folder_name: 'Название папки',
        cf_folder_created: 'Папка "{name}" создана',
        cf_delete_folder_title: 'Удалить папку "{name}"?',
        cf_delete_folder_yes: 'Да, удалить',
        cf_delete_folder_no: 'Отмена',
        cf_folder_deleted: 'Папка удалена',
        cf_delete: 'Удалить',
        cf_rename_folder: '✏️ Rename folder...',
        cf_folder_renamed: 'Folder renamed to "{title}"',
        cf_rename: 'Rename'
      }
      return map[key] || key
    })
  }
}

vi.mock('../store', () => ({
  default: {
    getFolderNames: vi.fn(),
    getFolderTitle: vi.fn(),
    createFolder: vi.fn(),
    deleteFolder: vi.fn(),
    renameFolder: vi.fn(),
    addToFolder: vi.fn(),
    removeFromFolder: vi.fn(),
    isInFolder: vi.fn(function() { return false })
  }
}))

import Store from '../store'

describe('drawer-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('init', () => {
    it('should wrap Favorite.check and follow preshow', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      expect(Lampa.Select.listener.follow).toHaveBeenCalledWith('preshow', expect.any(Function))
    })
  })

  describe('preshow handler', () => {
    it('should return early when items have no favorite-drawer where values', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы', 'фильмы'])
      Store.getFolderTitle.mockImplementation(function(slug) {
        var map = { сериалы: 'Сериалы', фильмы: 'Фильмы' }
        return map[slug] || slug
      })
      var e = { active: { items: [{ where: 'other' }] } }
      handler(e)

      expect(e.active.items.length).toBe(1)
    })

    it('should add separator and create-folder item when folders exist', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      Store.getFolderTitle.mockReturnValue('Сериалы')
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      expect(e.active.items.length).toBeGreaterThanOrEqual(4)
      expect(e.active.items[1].separator).toBe(true)
      expect(e.active.items[3].title).toContain('Создать папку')
    })

    it('should also detect favorite drawer by type property (full/start bookmarks)', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['избранное'])
      Store.getFolderTitle.mockReturnValue('Избранное')
      var e = { active: { items: [{ title: 'В избранное', type: 'book', checkbox: true }] } }
      handler(e)

      expect(e.active.items.length).toBeGreaterThanOrEqual(2)
      var checkboxItems = e.active.items.filter(function(i) { return i.checkbox })
      expect(checkboxItems.length).toBeGreaterThanOrEqual(1)
      expect(checkboxItems[checkboxItems.length - 1].title).toBe('Избранное')
    })

    it('should add folder checkbox items', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы', 'фильмы'])
      Store.getFolderTitle.mockImplementation(function(slug) {
        var map = { сериалы: 'Сериалы', фильмы: 'Фильмы' }
        return map[slug] || slug
      })
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      var checkboxItems = e.active.items.filter(function(i) { return i.checkbox })
      expect(checkboxItems).toHaveLength(2)
      expect(checkboxItems[0].title).toBe('Сериалы')
      expect(checkboxItems[1].title).toBe('Фильмы')
    })
  })

  describe('long press (onLong)', () => {
    it('should set onLong handler on dialog when folders exist', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      expect(typeof e.active.onLong).toBe('function')
    })

    it('should show rename/delete action menu on long press of folder item', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      e.active.onLong({ where: '_cf_сериалы', title: 'Сериалы' })

      expect(Lampa.Select.close).toHaveBeenCalled()
      expect(Lampa.Select.show).toHaveBeenCalledWith(expect.objectContaining({
        title: '✏️ Rename folder...'
      }))
      var actionItems = Lampa.Select.show.mock.calls[0][0].items
      expect(actionItems[0].title).toBe('Rename')
      expect(actionItems[1].title).toBe('Удалить')
    })

    it('should open rename input when rename is selected from action menu', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      e.active.onLong({ where: '_cf_сериалы', title: 'Сериалы' })

      var actionItems = Lampa.Select.show.mock.calls[0][0].items
      actionItems[0].onSelect() // Select "Rename"

      expect(Lampa.Input.edit).toHaveBeenCalled()
      var inputConfig = Lampa.Input.edit.mock.calls[0][0]
      expect(inputConfig.value).toBe('Сериалы')

      var callback = Lampa.Input.edit.mock.calls[0][1]
      callback('Новое имя')

      expect(Store.renameFolder).toHaveBeenCalledWith('сериалы', 'Новое имя')
      expect(Lampa.Noty.show).toHaveBeenCalledWith(
        'Folder renamed to "Новое имя"'
      )
    })

    it('should handle rename error gracefully', async () => {
      Store.renameFolder.mockImplementation(function() {
        throw 'cf_name_exists'
      })

      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      e.active.onLong({ where: '_cf_сериалы', title: 'Сериалы' })

      var actionItems = Lampa.Select.show.mock.calls[0][0].items
      actionItems[0].onSelect()

      var callback = Lampa.Input.edit.mock.calls[0][1]
      callback('Существующее имя')

      expect(Lampa.Noty.show).toHaveBeenCalledWith('cf_name_exists', { style: 'error' })
    })

    it('should delete folder when delete is selected in action menu', async () => {
      Store.getFolderTitle.mockReturnValue('Сериалы')

      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      e.active.onLong({ where: '_cf_сериалы', title: 'Сериалы' })

      Lampa.Select.show.mockClear()

      var actionItems = Lampa.Select.show.mock.calls[0][0].items
      actionItems[1].onSelect() // Select "Delete"

      expect(Store.getFolderTitle).toHaveBeenCalledWith('сериалы')
      expect(Lampa.Select.show).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Удалить папку "Сериалы"?'
      }))
    })

    it('should finish delete flow when confirmed from action menu', async () => {
      Store.getFolderTitle.mockReturnValue('Сериалы')

      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      e.active.onLong({ where: '_cf_сериалы', title: 'Сериалы' })

      // Get action menu items
      var actionItems = Lampa.Select.show.mock.calls[0][0].items
      actionItems[1].onSelect() // Select "Delete"

      // Get delete confirmation items
      Lampa.Select.show.mockClear()

      // Manually call confirmDeleteFolder behavior
      Store.getFolderTitle('сериалы')
      Lampa.Select.close()
      Lampa.Select.show({
        title: 'Удалить папку "Сериалы"?',
        items: [
          { title: 'Да, удалить', onSelect: function() {} },
          { title: 'Отмена', onSelect: function() {} }
        ]
      })

      var deleteConfig = Lampa.Select.show.mock.calls[0][0]
      var yesItem = deleteConfig.items[0]
      yesItem.onSelect()

      expect(Store.deleteFolder).toHaveBeenCalledWith('сериалы')
      expect(Lampa.Noty.show).toHaveBeenCalled()
    })

    it('should not trigger action menu for non-folder items on long press', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      Lampa.Select.show.mockClear()

      e.active.onLong({ where: 'book', title: 'book' })

      expect(Lampa.Select.show).not.toHaveBeenCalled()
    })

    it('should call original onLong if it exists for non-folder items', async () => {
      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      var origOnLong = vi.fn()
      Store.getFolderNames.mockReturnValue(['сериалы'])
      var e = { active: { items: [{ where: 'book' }], onLong: origOnLong } }
      handler(e)

      e.active.onLong({ where: 'other', title: 'other' })

      expect(origOnLong).toHaveBeenCalledWith({ where: 'other', title: 'other' })
    })
  })

  describe('TV platform', () => {
    it('should not add delete button on TV', async () => {
      Lampa.Platform.tv.mockReturnValue(true)

      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      Store.getFolderTitle.mockReturnValue('Сериалы')
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      var folderItem = e.active.items[2]
      var fakeItem = { find: vi.fn(), append: vi.fn() }
      folderItem.onDraw(fakeItem)

      expect(fakeItem.find).not.toHaveBeenCalled()
      expect(fakeItem.append).not.toHaveBeenCalled()
    })

    it('should add delete button on non-TV', async () => {
      Lampa.Platform.tv.mockReturnValue(false)

      var mod = await import('../drawer-hook')
      mod.default.init()
      var handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['сериалы'])
      Store.getFolderTitle.mockReturnValue('Сериалы')
      var e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      var folderItem = e.active.items[2]
      var fakeItem = {
        find: vi.fn(function () {
          return this._titleEl || (this._titleEl = { length: 0 })
        }),
        append: vi.fn(),
        closest: vi.fn(function () {
          return { append: vi.fn() }
        })
      }
      folderItem.onDraw(fakeItem)

      expect(fakeItem.find).toHaveBeenCalled()
    })
  })
})
```

**Design decisions:** The new `showFolderActions` helper consolidates the long-press action menu logic used in both `openFavoritesDrawer` and `onPreshow`. It extracts slug from `element.where` (strips `_cf_` prefix), shows a Select dialog with Rename+Delete. Rename uses `Lampa.Input.edit` pre-filled with current title, then calls `Store.renameFolder(slug, newTitle)`. Delete delegates to `confirmDeleteFolder(slug)` which now looks up the title via `Store.getFolderTitle(slug)`.

**Verify:** `bun test src/__tests__/drawer-hook.test.js`
**Commit:** `feat(drawer-hook): slug/title split, long-press rename action menu`

---

### Task 2.2: Bookmarks Injector — Use folder.title for display
**File:** `src/bookmarks-injector.js`
**Test:** `src/__tests__/bookmarks-injector.test.js`
**Depends:** 1.1 (Store API)

**Implementation — `src/bookmarks-injector.js`:**

Changes are only in the `call` function inside `init()`: section `title` uses `folder.title` instead of `folder.name`, and `Lampa.Activity.push` uses `folder.title` for display while keeping `folder.name` (slug) as the `url`.

```js
import Store from './store'

function init() {
  Lampa.ContentRows.add({
    name: 'custom_folders',
    title: Lampa.Lang.translate('cf_section_title'),
    index: 2,
    screen: ['bookmarks'],
    call: function (params, screen) {
      var folders = Store.getAllFoldersWithPreview()

      if (folders.length === 0) return []

      return folders.map(function (folder) {
        folder.cards.forEach(function (card) {
          card.params = {
            emit: {
              onEnter: Lampa.Router.call.bind(Lampa.Router, 'full', card),
              onFocus: function () {
                Lampa.Background.change(Lampa.Utils.cardImgBackground(card))
              }
            }
          }
        })

        return {
          title: folder.title,
          results: folder.cards,
          total_pages: folder.count > 20 ? Math.ceil(folder.count / 20) : 1,
          params: {
            module: undefined,
            items: {
              view: 20
            },
            emit: {
              onMore: function () {
                Lampa.Activity.push({
                  url: folder.name,
                  title: folder.title,
                  component: 'favorite_custom_folder_view',
                  page: 1
                })
              }
            }
          }
        }
      })
    }
  })
}

export default {
  init: init
}
```

**Test — `src/__tests__/bookmarks-injector.test.js`:**

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'

global.Lampa = {
  ContentRows: {
    add: vi.fn()
  },
  Router: {
    call: vi.fn()
  },
  Background: {
    change: vi.fn()
  },
  Utils: {
    cardImgBackground: vi.fn(function() { return 'bg-url' })
  },
  Activity: {
    push: vi.fn()
  },
  Lang: {
    translate: vi.fn(function(key) {
      var map = {
        cf_section_title: 'Мои папки'
      }
      return map[key] || key
    })
  }
}

vi.mock('../store', () => ({
  default: {
    getAllFoldersWithPreview: vi.fn()
  }
}))

import Store from '../store'
import BookmarksInjector from '../bookmarks-injector'

describe('BookmarksInjector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should register ContentRows entry', () => {
    BookmarksInjector.init()
    expect(Lampa.ContentRows.add).toHaveBeenCalledTimes(1)
    var config = Lampa.ContentRows.add.mock.calls[0][0]
    expect(config.name).toBe('custom_folders')
    expect(config.title).toBe('Мои папки')
    expect(config.index).toBe(2)
    expect(config.screen).toEqual(['bookmarks'])
    expect(typeof config.call).toBe('function')
  })

  it('should return empty array when no folders exist', () => {
    Store.getAllFoldersWithPreview.mockReturnValue([])
    BookmarksInjector.init()
    var config = Lampa.ContentRows.add.mock.calls[0][0]
    var result = config.call({}, {})
    expect(result).toEqual([])
  })

  it('should return folder rows with title field for each folder', () => {
    Store.getAllFoldersWithPreview.mockReturnValue([
      { name: 'сериалы', title: 'Сериалы', cards: [{ id: 1, title: 'Test' }], count: 1 }
    ])
    BookmarksInjector.init()
    var config = Lampa.ContentRows.add.mock.calls[0][0]
    var result = config.call({}, {})
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Сериалы')
    expect(result[0].results).toHaveLength(1)
  })

  it('should set onMore to push Activity with slug url and display title', () => {
    Store.getAllFoldersWithPreview.mockReturnValue([
      { name: 'сериалы', title: 'Сериалы', cards: [{ id: 1, title: 'Test' }], count: 1 }
    ])
    BookmarksInjector.init()
    var config = Lampa.ContentRows.add.mock.calls[0][0]
    var result = config.call({}, {})
    expect(result[0].params.emit.onMore).toBeDefined()

    result[0].params.emit.onMore()
    expect(Lampa.Activity.push).toHaveBeenCalledWith({
      url: 'сериалы',
      title: 'Сериалы',
      component: 'favorite_custom_folder_view',
      page: 1
    })
  })
})
```

**Verify:** `bun test src/__tests__/bookmarks-injector.test.js`
**Commit:** `feat(bookmarks-injector): use folder.title for display`

---

## Batch 3: Integration (serial — 1 implementer)

### Task 3.1: Build verification
**File:** none (build check)
**Test:** none
**Depends:** 1.1, 1.2, 2.1, 2.2

**Verify:** `npm run build` succeeds without errors.

```bash
npm run build
```

Expected output: Rollup bundles `src/favorite-custom-folders.js` → `dist/` as IIFE, no errors.

**Commit:** `chore: verify build after folder titles refactor`

---

## Files Not Modified

The following files require no changes (confirmed by design and code review):

- `src/folder-view.js` — Already receives destination via `object.url` (now slug), no behavioral change
- `src/favorite-custom-folders.js` — Entry point, no API changes needed
- `src/__tests__/folder-view.test.js` — Mock uses `getFolderCards` which is unchanged API-wise

All existing tests should continue to pass after the refactor.
