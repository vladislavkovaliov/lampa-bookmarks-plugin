import { describe, it, expect, vi, beforeEach } from 'vitest'

global.Lampa = {
  InteractionCategory: vi.fn(function(object) {
    this.object = object
    this.create = vi.fn()
    this.nextPageReuest = vi.fn()
    this.cardRender = vi.fn()
    this.build = vi.fn()
    this.empty = vi.fn()
  }),
  Router: {
    call: vi.fn()
  },
  Background: {
    change: vi.fn()
  },
  Utils: {
    cardImgBackground: vi.fn(() => 'bg-url')
  }
}

vi.mock('../store', () => ({
  default: {
    getFolderCards: vi.fn()
  }
}))

import Store from '../store'

describe('folder-view', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create component with InteractionCategory', async () => {
    const component = await import('../folder-view')
    const comp = component.default({ url: 'Сериалы', page: 1 })
    
    expect(Lampa.InteractionCategory).toHaveBeenCalledWith({ url: 'Сериалы', page: 1 })
    expect(comp.create).toBeDefined()
    expect(comp.nextPageReuest).toBeDefined()
    expect(comp.cardRender).toBeDefined()
  })

  it('should load folder data on create', async () => {
    Store.getFolderCards.mockReturnValue({
      results: [{ id: 1, title: 'Test' }],
      total_pages: 1,
      page: 1
    })

    const component = await import('../folder-view')
    const object = { url: 'Сериалы', page: 1 }
    const comp = component.default(object)
    
    comp.create()
    
    expect(Store.getFolderCards).toHaveBeenCalledWith('Сериалы', 1, 20)
  })

  it('should call build when results exist', async () => {
    const mockData = {
      results: [{ id: 1, title: 'Test' }],
      total_pages: 1,
      page: 1
    }
    Store.getFolderCards.mockReturnValue(mockData)

    const component = await import('../folder-view')
    const comp = component.default({ url: 'Сериалы', page: 1 })
    
    comp.create()
    
    // Wait for setTimeout
    await new Promise(resolve => setTimeout(resolve, 20))
    
    expect(comp.build).toHaveBeenCalledWith(mockData)
  })

  it('should call empty when no results', async () => {
    Store.getFolderCards.mockReturnValue({
      results: [],
      total_pages: 1,
      page: 1
    })

    const component = await import('../folder-view')
    const comp = component.default({ url: 'Сериалы', page: 1 })
    
    comp.create()
    
    expect(comp.empty).toHaveBeenCalled()
  })

  it('should load next page on nextPageReuest', async () => {
    Store.getFolderCards.mockReturnValue({
      results: [{ id: 2, title: 'Test 2' }],
      total_pages: 2,
      page: 2
    })

    const component = await import('../folder-view')
    const object = { url: 'Сериалы', page: 1 }
    const comp = component.default(object)
    
    const resolve = vi.fn()
    const reject = vi.fn()
    
    comp.nextPageReuest({ page: 2 }, resolve, reject)
    
    expect(Store.getFolderCards).toHaveBeenCalledWith('Сериалы', 2, 20)
    expect(resolve).toHaveBeenCalled()
  })

  it('should reject on nextPageReuest when no results', async () => {
    Store.getFolderCards.mockReturnValue({
      results: [],
      total_pages: 1,
      page: 2
    })

    const component = await import('../folder-view')
    const object = { url: 'Сериалы', page: 1 }
    const comp = component.default(object)
    
    const resolve = vi.fn()
    const reject = vi.fn()
    
    comp.nextPageReuest({ page: 2 }, resolve, reject)
    
    expect(reject).toHaveBeenCalled()
  })

  it('should set card handlers in cardRender', async () => {
    const component = await import('../folder-view')
    const comp = component.default({ url: 'Сериалы', page: 1 })
    
    const element = { id: 123, title: 'Test' }
    const card = {}
    
    comp.cardRender({}, element, card)
    
    expect(card.onEnter).toBeDefined()
    expect(card.onFocus).toBeDefined()
    
    card.onEnter()
    expect(Lampa.Router.call).toHaveBeenCalledWith('full', element)
    
    card.onFocus()
    expect(Lampa.Background.change).toHaveBeenCalled()
  })
})
