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
