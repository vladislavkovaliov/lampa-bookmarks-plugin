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

function toggleCustomFolder(folderName, card) {
  if (Store.isInFolder(folderName, card.id)) {
    Store.removeFromFolder(folderName, card.id)
  } else {
    Store.addToFolder(folderName, card)
  }

  Lampa.Listener.send('state:changed', { target: 'favorite', card: card })
}

function buildCustomFoldersSection(card) {
  var items = []
  var folders = Store.getFolderNames()

  if (folders.length > 0) {
    items.push({ title: Lampa.Lang.translate('cf_my_folders'), separator: true })
  }

  folders.forEach(function (folderName) {
    var checked = card ? Store.isInFolder(folderName, card.id) : false

    items.push({
      title: folderName,
      where: '_cf_' + folderName,
      type: '_cf_' + folderName,
      checkbox: true,
      checked: checked,
      onCheck: function () {
        if (!lastCardData) return
        toggleCustomFolder(folderName, lastCardData)
      },
      onDraw: function (item) {
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

          Lampa.Select.close()

          Lampa.Select.show({
            title: Lampa.Lang.translate('cf_delete_folder_title').replace('{name}', folderName),
            items: [
              {
                title: Lampa.Lang.translate('cf_delete_folder_yes'),
                onSelect: function () {
                  Store.deleteFolder(folderName)
                  Lampa.Noty.show(Lampa.Lang.translate('cf_folder_deleted').replace('{name}', folderName))
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
        })
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


