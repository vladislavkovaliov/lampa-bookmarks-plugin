import { describe, it, expect, beforeEach, vi } from 'vitest'

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = String(value) }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

global.Lampa = {
  Utils: {
    clearCard: vi.fn((card) => ({ ...card, _cleared: true }))
  },
  Lang: {
    translate: vi.fn((key) => key)
  }
}

import Store from '../store'

describe('Store', () => {
  beforeEach(() => {
    localStorageMock.clear()
    Store.clearCache()
  })

  describe('createFolder', () => {
    it('should create a folder', () => {
      Store.createFolder('Сериалы')
      const data = Store.getData()
      expect(data.folders['Сериалы']).toEqual([])
    })

    it('should throw on empty name', () => {
      expect(() => Store.createFolder('')).toThrow()
      expect(() => Store.createFolder('  ')).toThrow()
    })

    it('should throw on duplicate name', () => {
      Store.createFolder('Сериалы')
      expect(() => Store.createFolder('Сериалы')).toThrow()
    })

    it('should throw on built-in category name', () => {
      expect(() => Store.createFolder('book')).toThrow()
      expect(() => Store.createFolder('like')).toThrow()
      expect(() => Store.createFolder('wath')).toThrow()
      expect(() => Store.createFolder('history')).toThrow()
    })
  })

  describe('addToFolder / removeFromFolder', () => {
    it('should add a card to folder', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      const data = Store.getData()
      expect(data.folders['Сериалы']).toContain(123)
      expect(data.cards['123']).toBeDefined()
      expect(data.cards['123']._cleared).toBe(true)
    })

    it('should remove a card from folder', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      Store.removeFromFolder('Сериалы', 123)
      const data = Store.getData()
      expect(data.folders['Сериалы']).not.toContain(123)
      expect(data.cards['123']).toBeUndefined()
    })

    it('should not remove card if it exists in other folders', () => {
      Store.createFolder('Сериалы')
      Store.createFolder('Фильмы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      Store.addToFolder('Фильмы', { id: 123, name: 'Test' })
      Store.removeFromFolder('Сериалы', 123)
      const data = Store.getData()
      expect(data.cards['123']).toBeDefined()
    })
  })

  describe('isInFolder', () => {
    it('should return true if card is in folder', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      expect(Store.isInFolder('Сериалы', 123)).toBe(true)
    })

    it('should return false if card is not in folder', () => {
      Store.createFolder('Сериалы')
      Store.createFolder('Фильмы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      expect(Store.isInFolder('Фильмы', 123)).toBe(false)
    })
  })

  describe('deleteFolder', () => {
    it('should delete a folder and its cards', () => {
      Store.createFolder('Сериалы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      Store.deleteFolder('Сериалы')
      const data = Store.getData()
      expect(data.folders['Сериалы']).toBeUndefined()
      expect(data.cards['123']).toBeUndefined()
    })

    it('should not delete cards referenced by other folders', () => {
      Store.createFolder('Сериалы')
      Store.createFolder('Фильмы')
      Store.addToFolder('Сериалы', { id: 123, name: 'Test' })
      Store.addToFolder('Фильмы', { id: 123, name: 'Test' })
      Store.deleteFolder('Сериалы')
      const data = Store.getData()
      expect(data.cards['123']).toBeDefined()
    })
  })

  describe('getFolderCards', () => {
    it('should return paginated cards', () => {
      Store.createFolder('Большая папка')
      for (let i = 0; i < 50; i++) {
        Store.addToFolder('Большая папка', { id: i, name: `Card ${i}` })
      }
      const page1 = Store.getFolderCards('Большая папка', 1, 20)
      expect(page1.results).toHaveLength(20)
      expect(page1.total_pages).toBe(3)
      expect(page1.page).toBe(1)

      const page3 = Store.getFolderCards('Большая папка', 3, 20)
      expect(page3.results).toHaveLength(10)
      expect(page3.page).toBe(3)
    })
  })
})
