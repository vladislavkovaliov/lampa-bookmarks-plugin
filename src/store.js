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
              // Only check collision against already-migrated folders or new-format keys
              var collision = migratedFolders[finalSlug] !== undefined
              if (!collision && data.folders[finalSlug] !== undefined && !Array.isArray(data.folders[finalSlug])) {
                collision = true
              }
              if (collision) {
                var counter = 2
                while (migratedFolders[finalSlug] !== undefined || (data.folders[finalSlug] !== undefined && !Array.isArray(data.folders[finalSlug]))) {
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

  // Check title uniqueness:
  // - Exact same title string => allowed (handled by slug collision below)
  // - Case-insensitive different title => throw
  var caseInsensitiveMatchFound = false
  for (var slug in data.folders) {
    if (data.folders.hasOwnProperty(slug)) {
      if (data.folders[slug].title !== title && data.folders[slug].title.toLowerCase() === lowerTitle) {
        caseInsensitiveMatchFound = true
        break
      }
    }
  }

  if (caseInsensitiveMatchFound) {
    throw Lampa.Lang.translate('cf_name_exists')
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
