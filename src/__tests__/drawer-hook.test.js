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

      // First Select.show call is the action menu (rename/delete)
      var actionItems = Lampa.Select.show.mock.calls[0][0].items
      actionItems[1].onSelect() // Select "Delete"

      // Second Select.show call is the delete confirmation dialog
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
      actionItems[1].onSelect() // Select "Delete" -> calls confirmDeleteFolder

      // confirmDeleteFolder calls Lampa.Select.show with delete confirmation
      var deleteConfig = Lampa.Select.show.mock.calls[1][0]
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
