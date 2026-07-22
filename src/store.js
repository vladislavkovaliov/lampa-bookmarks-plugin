const STORAGE_KEY = 'favorite_custom_folders'

const BUILT_IN_CATEGORIES = ['book', 'like', 'wath', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown']

function getData() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { folders: {}, cards: {} }
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

function createFolder(name) {
  name = (name || '').trim()

  if (!name) throw Lampa.Lang.translate('cf_name_empty')

  var lowerName = name.toLowerCase()

  if (BUILT_IN_CATEGORIES.indexOf(lowerName) >= 0) {
    throw Lampa.Lang.translate('cf_name_taken_system')
  }

  var data = getData()

  if (data.folders[name] !== undefined) {
    throw Lampa.Lang.translate('cf_name_exists')
  }

  data.folders[name] = []
  saveData(data)
}

function deleteFolder(name) {
  var data = getData()

  delete data.folders[name]

  var usedIds = {}
  for (var folderName in data.folders) {
    if (data.folders.hasOwnProperty(folderName)) {
      data.folders[folderName].forEach(function (id) {
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

function addToFolder(name, card) {
  var data = getData()

  if (!data.folders[name]) return

  if (data.folders[name].indexOf(card.id) >= 0) return

  data.folders[name].push(card.id)

  data.cards[card.id] = cleanupCard(card)

  saveData(data)
}

function removeFromFolder(name, cardId) {
  var data = getData()

  if (!data.folders[name]) return

  var idx = data.folders[name].indexOf(cardId)
  if (idx < 0) return

  data.folders[name].splice(idx, 1)

  var usedElsewhere = false
  for (var folderName in data.folders) {
    if (data.folders.hasOwnProperty(folderName) && folderName !== name) {
      if (data.folders[folderName].indexOf(cardId) >= 0) {
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

function isInFolder(name, cardId) {
  var data = getData()
  if (!data.folders[name]) return false
  return data.folders[name].indexOf(cardId) >= 0
}

function getFolderNames() {
  var data = getData()
  return Object.keys(data.folders)
}

function getFolderCards(name, page, perPage) {
  page = page || 1
  perPage = perPage || 20

  var data = getData()
  var ids = data.folders[name] || []
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

function getCardCount(name) {
  var data = getData()
  return (data.folders[name] || []).length
}

function getAllFoldersWithPreview() {
  var data = getData()
  var result = []

  for (var name in data.folders) {
    if (data.folders.hasOwnProperty(name)) {
      var ids = data.folders[name]
      var cards = ids
        .map(function (id) { return data.cards[id] })
        .filter(Boolean)

      result.push({
        name: name,
        cards: cards.slice(0, 20),
        count: cards.length
      })
    }
  }

  return result
}

function clearCache() {
}

export default {
  BUILT_IN_CATEGORIES: BUILT_IN_CATEGORIES,
  getData: getData,
  saveData: saveData,
  createFolder: createFolder,
  deleteFolder: deleteFolder,
  addToFolder: addToFolder,
  removeFromFolder: removeFromFolder,
  isInFolder: isInFolder,
  getFolderNames: getFolderNames,
  getFolderCards: getFolderCards,
  getCardCount: getCardCount,
  getAllFoldersWithPreview: getAllFoldersWithPreview,
  cleanupCard: cleanupCard,
  clearCache: clearCache
}
