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
