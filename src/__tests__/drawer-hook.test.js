import { describe, it, expect, beforeEach, vi } from 'vitest'

global.Lampa = {
  Favorite: {
    check: vi.fn(() => true)
  },
  Select: {
    close: vi.fn(),
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
    translate: vi.fn((key) => {
      var map = {
        cf_my_folders: '--- Мои папки ---',
        cf_create_folder: '➕ Создать папку...',
        cf_folder_name: 'Название папки',
        cf_folder_created: 'Папка "{name}" создана',
        cf_delete_folder_title: 'Удалить папку "{name}"?',
        cf_delete_folder_yes: 'Да, удалить',
        cf_delete_folder_no: 'Отмена',
        cf_folder_deleted: 'Папка удалена',
        cf_delete: 'Удалить'
      }
      return map[key] || key
    })
  }
}

vi.mock('../store', () => ({
  default: {
    getFolderNames: vi.fn(),
    createFolder: vi.fn(),
    addToFolder: vi.fn(),
    removeFromFolder: vi.fn(),
    isInFolder: vi.fn(() => false)
  }
}))

import Store from '../store'

describe('drawer-hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('init', () => {
    it('should wrap Favorite.check and follow preshow', async () => {
      const mod = await import('../drawer-hook')
      mod.default.init()
      expect(Lampa.Select.listener.follow).toHaveBeenCalledWith('preshow', expect.any(Function))
    })
  })

  describe('preshow handler', () => {
    it('should return early when items have no favorite-drawer where values', async () => {
      const mod = await import('../drawer-hook')
      mod.default.init()
      const handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['Сериалы', 'Фильмы'])
      const e = { active: { items: [{ where: 'other' }] } }
      handler(e)

      expect(e.active.items.length).toBe(1)
    })

    it('should add separator and create-folder item when folders exist', async () => {
      const mod = await import('../drawer-hook')
      mod.default.init()
      const handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['Сериалы'])
      const e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      expect(e.active.items.length).toBeGreaterThanOrEqual(4)
      expect(e.active.items[1].separator).toBe(true)
      expect(e.active.items[3].title).toContain('Создать папку')
    })

    it('should also detect favorite drawer by type property (full/start bookmarks)', async () => {
      const mod = await import('../drawer-hook')
      mod.default.init()
      const handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['Избранное'])
      const e = { active: { items: [{ title: 'В избранное', type: 'book', checkbox: true }] } }
      handler(e)

      expect(e.active.items.length).toBeGreaterThanOrEqual(2)
      const checkboxItems = e.active.items.filter(i => i.checkbox)
      expect(checkboxItems.length).toBeGreaterThanOrEqual(1)
      expect(checkboxItems[checkboxItems.length - 1].title).toBe('Избранное')
    })

    it('should add folder checkbox items', async () => {
      const mod = await import('../drawer-hook')
      mod.default.init()
      const handler = Lampa.Select.listener.follow.mock.calls[0][1]

      Store.getFolderNames.mockReturnValue(['Сериалы', 'Фильмы'])
      const e = { active: { items: [{ where: 'book' }] } }
      handler(e)

      const checkboxItems = e.active.items.filter(i => i.checkbox)
      expect(checkboxItems).toHaveLength(2)
      expect(checkboxItems[0].title).toBe('Сериалы')
      expect(checkboxItems[1].title).toBe('Фильмы')
    })
  })
})
