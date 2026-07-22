(function () {
  'use strict';

  function registerTranslations() {
    Lampa.Lang.add({
      cf_my_folders: {
        ru: '--- Мои папки ---',
        en: '--- My folders ---',
        uk: '--- Мої папки ---'
      },
      cf_create_folder: {
        ru: 'Создать папку...',
        en: 'Create folder...',
        uk: 'Створити папку...'
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
        ru: 'Переименовать...',
        en: 'Rename folder...',
        uk: 'Перейменувати...'
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
    });
  }

  var Lang = {
    register: registerTranslations
  };

  var STORAGE_KEY = 'favorite_custom_folders';

  var BUILT_IN_CATEGORIES = ['book', 'like', 'wath', 'history', 'look', 'viewed', 'scheduled', 'continued', 'thrown'];

  function slugify(str) {
    var slug = str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-zа-яё0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return slug
  }

  function getData() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var data = raw ? JSON.parse(raw) : { folders: {}, cards: {} };

      if (!data._migrated) {
        var needsMigration = false;
        for (var key in data.folders) {
          if (data.folders.hasOwnProperty(key) && Array.isArray(data.folders[key])) {
            needsMigration = true;
            break
          }
        }

        if (needsMigration) {
          var migratedFolders = {};
          for (var key in data.folders) {
            if (data.folders.hasOwnProperty(key)) {
              if (Array.isArray(data.folders[key])) {
                var slug = slugify(key);
                if (slug === '') slug = 'folder';

                var finalSlug = slug;
                // Only check collision against already-migrated folders or new-format keys
                var collision = migratedFolders[finalSlug] !== undefined;
                if (!collision && data.folders[finalSlug] !== undefined && !Array.isArray(data.folders[finalSlug])) {
                  collision = true;
                }
                if (collision) {
                  var counter = 2;
                  while (migratedFolders[finalSlug] !== undefined || (data.folders[finalSlug] !== undefined && !Array.isArray(data.folders[finalSlug]))) {
                    finalSlug = slug + '-' + counter;
                    counter++;
                  }
                }

                migratedFolders[finalSlug] = { title: key, cards: data.folders[key] };
              } else {
                migratedFolders[key] = data.folders[key];
              }
            }
          }
          data.folders = migratedFolders;
          data._migrated = true;
          saveData(data);
        }
      }

      return data
    } catch (e) {
      return { folders: {}, cards: {} }
    }
  }

  function saveData(data) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function cleanupCard(card) {
    var clone = {};
    for (var key in card) {
      if (card.hasOwnProperty(key)) clone[key] = card[key];
    }
    return Lampa.Utils.clearCard ? Lampa.Utils.clearCard(clone) : clone
  }

  function createFolder(title) {
    title = (title || '').trim();

    if (!title) throw Lampa.Lang.translate('cf_name_empty')

    var lowerTitle = title.toLowerCase();

    if (BUILT_IN_CATEGORIES.indexOf(lowerTitle) >= 0) {
      throw Lampa.Lang.translate('cf_name_taken_system')
    }

    var data = getData();

    // Check title uniqueness:
    // - Exact same title string => allowed (handled by slug collision below)
    // - Case-insensitive different title => throw
    var caseInsensitiveMatchFound = false;
    for (var slug in data.folders) {
      if (data.folders.hasOwnProperty(slug)) {
        if (data.folders[slug].title !== title && data.folders[slug].title.toLowerCase() === lowerTitle) {
          caseInsensitiveMatchFound = true;
          break
        }
      }
    }

    if (caseInsensitiveMatchFound) {
      throw Lampa.Lang.translate('cf_name_exists')
    }

    var slug = slugify(title);
    if (slug === '') slug = 'folder';

    // Handle slug collision
    var finalSlug = slug;
    if (data.folders[finalSlug] !== undefined) {
      var counter = 2;
      while (data.folders[finalSlug] !== undefined) {
        finalSlug = slug + '-' + counter;
        counter++;
      }
    }

    data.folders[finalSlug] = { title: title, cards: [] };
    saveData(data);
  }

  function deleteFolder(slug) {
    var data = getData();

    delete data.folders[slug];

    var usedIds = {};
    for (var folderSlug in data.folders) {
      if (data.folders.hasOwnProperty(folderSlug)) {
        data.folders[folderSlug].cards.forEach(function (id) {
          usedIds[id] = true;
        });
      }
    }

    for (var cardId in data.cards) {
      if (data.cards.hasOwnProperty(cardId) && !usedIds[cardId]) {
        delete data.cards[cardId];
      }
    }

    saveData(data);
  }

  function addToFolder(slug, card) {
    var data = getData();

    if (!data.folders[slug]) return

    if (data.folders[slug].cards.indexOf(card.id) >= 0) return

    data.folders[slug].cards.push(card.id);
    data.cards[card.id] = cleanupCard(card);

    saveData(data);
  }

  function removeFromFolder(slug, cardId) {
    var data = getData();

    if (!data.folders[slug]) return

    var idx = data.folders[slug].cards.indexOf(cardId);
    if (idx < 0) return

    data.folders[slug].cards.splice(idx, 1);

    var usedElsewhere = false;
    for (var folderSlug in data.folders) {
      if (data.folders.hasOwnProperty(folderSlug) && folderSlug !== slug) {
        if (data.folders[folderSlug].cards.indexOf(cardId) >= 0) {
          usedElsewhere = true;
          break
        }
      }
    }

    if (!usedElsewhere) {
      delete data.cards[cardId];
    }

    saveData(data);
  }

  function isInFolder(slug, cardId) {
    var data = getData();
    if (!data.folders[slug]) return false
    return data.folders[slug].cards.indexOf(cardId) >= 0
  }

  function getFolderNames() {
    var data = getData();
    return Object.keys(data.folders)
  }

  function getFolderCards(slug, page, perPage) {
    page = page || 1;
    perPage = perPage || 20;

    var data = getData();
    var folder = data.folders[slug];
    var ids = folder ? folder.cards : [];
    var allCards = ids
      .map(function (id) { return data.cards[id] })
      .filter(Boolean);

    var totalPages = Math.ceil(allCards.length / perPage) || 1;
    var offset = (page - 1) * perPage;
    var results = allCards.slice(offset, offset + perPage);

    return {
      results: results,
      total_pages: totalPages,
      page: page
    }
  }

  function getCardCount(slug) {
    var data = getData();
    var folder = data.folders[slug];
    return folder ? folder.cards.length : 0
  }

  function getAllFoldersWithPreview() {
    var data = getData();
    var result = [];

    for (var slug in data.folders) {
      if (data.folders.hasOwnProperty(slug)) {
        var folder = data.folders[slug];
        var ids = folder.cards;
        var cards = ids
          .map(function (id) { return data.cards[id] })
          .filter(Boolean);

        result.push({
          name: slug,
          title: folder.title,
          cards: cards.slice(0, 20),
          count: cards.length
        });
      }
    }

    return result
  }

  function renameFolder(slug, newTitle) {
    newTitle = (newTitle || '').trim();

    if (!newTitle) throw Lampa.Lang.translate('cf_name_empty')

    var data = getData();

    if (!data.folders[slug]) throw 'Folder not found'

    // No-op if title unchanged
    if (data.folders[slug].title === newTitle) return

    var lowerNew = newTitle.toLowerCase();

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

    data.folders[slug].title = newTitle;
    saveData(data);
  }

  function getFolderTitle(slug) {
    var data = getData();
    var folder = data.folders[slug];
    return folder ? folder.title : undefined
  }

  function getSlugFromTitle(title) {
    var data = getData();
    var lower = title.toLowerCase();
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

  var Store = {
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
  };

  var lastCardData = null;

  var FAV_KEYS = ['book', 'like', 'wath', 'history'];

  function isFavoriteItem(item) {
    for (var i = 0; i < FAV_KEYS.length; i++) {
      var key = FAV_KEYS[i];
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
    var origCheck = Lampa.Favorite.check;
    if (!origCheck) return

    Lampa.Favorite.check = function (card) {
      lastCardData = card;
      return origCheck(card)
    };
  }

  function toggleCustomFolder(slug, card) {
    if (Store.isInFolder(slug, card.id)) {
      Store.removeFromFolder(slug, card.id);
    } else {
      Store.addToFolder(slug, card);
    }

    Lampa.Listener.send('state:changed', { target: 'favorite', card: card });
  }

  function confirmDeleteFolder(slug) {
    var folderTitle = Store.getFolderTitle(slug);

    Lampa.Select.close();

    Lampa.Select.show({
      title: Lampa.Lang.translate('cf_delete_folder_title').replace('{name}', folderTitle),
      items: [
        {
          title: Lampa.Lang.translate('cf_delete_folder_yes'),
          onSelect: function () {
            Store.deleteFolder(slug);
            Lampa.Noty.show(Lampa.Lang.translate('cf_folder_deleted'));
            Lampa.Controller.toggle('content');
          }
        },
        {
          title: Lampa.Lang.translate('cf_delete_folder_no'),
          onSelect: function () {
            Lampa.Controller.toggle('content');
          }
        }
      ]
    });
  }

  function showFolderActions(element) {
    if (element.where && element.where.indexOf('_cf_') === 0) {
      var slug = element.where.slice(4);
      var currentTitle = element.title;

      Lampa.Select.close();

      Lampa.Select.show({
        title: Lampa.Lang.translate('cf_rename_folder'),
        items: [
          {
            title: Lampa.Lang.translate('cf_rename'),
            onSelect: function () {
              Lampa.Select.close();

              Lampa.Input.edit({
                title: Lampa.Lang.translate('cf_folder_name'),
                value: currentTitle,
                free: true,
                nosave: true
              }, function (newTitle) {
                if (!newTitle || !newTitle.trim()) {
                  Lampa.Controller.toggle('content');
                  return
                }

                newTitle = newTitle.trim();

                try {
                  Store.renameFolder(slug, newTitle);
                  Lampa.Noty.show(
                    Lampa.Lang.translate('cf_folder_renamed').replace('{title}', newTitle)
                  );
                } catch (err) {
                  Lampa.Noty.show(err, { style: 'error' });
                }

                Lampa.Controller.toggle('content');
              });
            }
          },
          {
            title: Lampa.Lang.translate('cf_delete'),
            onSelect: function () {
              confirmDeleteFolder(slug);
            }
          }
        ]
      });

      return true
    }
    return false
  }

  function buildCustomFoldersSection(card) {
    var items = [];
    var slugs = Store.getFolderNames();

    if (slugs.length > 0) {
      items.push({ title: Lampa.Lang.translate('cf_my_folders'), separator: true });
    }

    slugs.forEach(function (slug) {
      var folderTitle = Store.getFolderTitle(slug);
      var checked = card ? Store.isInFolder(slug, card.id) : false;

      items.push({
        title: folderTitle,
        where: '_cf_' + slug,
        type: '_cf_' + slug,
        checkbox: true,
        checked: checked,
        onCheck: function () {
          if (!lastCardData) return
          toggleCustomFolder(slug, lastCardData);
        },
        onDraw: function (item) {
          if (!Lampa.Platform.tv()) {
            var deleteBtn = $('<span class="cf-delete-btn" style="cursor:pointer;opacity:0.5;font-size:14px;line-height:1;padding:2px 6px;margin-left:8px" title="' + Lampa.Lang.translate('cf_delete') + '">✕</span>');

            var titleEl = item.find('.selectbox-item__title');
            if (titleEl.length) {
              var wrapper = $('<div class="cf-folder-row" style="display:flex;align-items:center;justify-content:space-between;width:100%"></div>');
              titleEl.wrap(wrapper);
              titleEl.closest('.cf-folder-row').append(deleteBtn);
            } else {
              item.append(deleteBtn);
            }

            deleteBtn.on('click', function (e) {
              e.stopPropagation();
              confirmDeleteFolder(slug);
            });
          }
        }
      });
    });

    items.push({
      title: Lampa.Lang.translate('cf_create_folder'),
      onSelect: function () {
        Lampa.Select.close();

        Lampa.Input.edit({
          title: Lampa.Lang.translate('cf_folder_name'),
          value: '',
          free: true,
          nosave: true
        }, function (name) {
          if (!name || !name.trim()) {
            Lampa.Controller.toggle('content');
            return
          }

          name = name.trim();

          try {
            Store.createFolder(name);
            Lampa.Noty.show(Lampa.Lang.translate('cf_folder_created').replace('{name}', name));
          } catch (err) {
            Lampa.Noty.show(err, { style: 'error' });
          }

          Lampa.Controller.toggle('content');
        });
      }
    });

    return items
  }

  // ----- Click handler for card icon (.card__icon.icon--book etc) -----

  function findCardData(el) {
    var cardEl = el.closest('[card_data]') || el.closest('.card') || el.closest('.category__item');
    if (!cardEl) return null
    if (cardEl.card_data) return cardEl.card_data

    var dataEl = cardEl.querySelector('[card_data]');
    if (dataEl && dataEl.card_data) return dataEl.card_data

    return null
  }

  function openFavoritesDrawer(card) {
    lastCardData = card;
    var status = Lampa.Favorite.check(card);

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
    ];

    var customItems = buildCustomFoldersSection(card);
    items = items.concat(customItems);

    items._cf_alreadyAdded = true;

    Lampa.Select.show({
      title: Lampa.Lang.translate('title_action'),
      items: items,
      onCheck: function (a) {
        if (a.where && FAV_KEYS.indexOf(a.where) >= 0) {
          Lampa.Favorite.toggle(a.where, card);
        }
      },
      onSelect: function (a) {
        if (a.type && FAV_KEYS.indexOf(a.type) >= 0) {
          Lampa.Favorite.toggle(a.type, card);
        }
      },
      onLong: function (element) {
        showFolderActions(element);
      }
    });
  }

  function setupIconClick() {
    document.addEventListener('click', function (e) {
      var target = e.target;
      if (!target.matches) return

      var icon = target.matches('.card__icon') ? target : target.closest('.card__icon');
      if (!icon || !icon.classList) return

      var isFavIcon = false;
      for (var i = 0; i < FAV_KEYS.length; i++) {
        if (icon.classList.contains('icon--' + FAV_KEYS[i])) {
          isFavIcon = true;
          break
        }
      }
      if (!isFavIcon) return

      e.preventDefault();
      e.stopPropagation();

      var card = findCardData(icon);
      if (!card) return

      openFavoritesDrawer(card);
    });
  }

  // ----- Preshow hook for context menu & full/start bookmark button -----

  function onPreshow(e) {
    if (e.active.items._cf_alreadyAdded) return
    if (hasCustomItems(e.active.items)) return

    var hasFav = false;
    for (var i = 0; i < e.active.items.length; i++) {
      if (isFavoriteItem(e.active.items[i])) {
        hasFav = true;
        break
      }
    }
    if (!hasFav) return

    var customItems = buildCustomFoldersSection(lastCardData);
    for (var j = 0; j < customItems.length; j++) {
      e.active.items.push(customItems[j]);
    }

    var origOnLong = e.active.onLong;
    e.active.onLong = function (element) {
      if (showFolderActions(element)) return
      if (origOnLong) {
        origOnLong(element);
      }
    };
  }

  function init$1() {
    setupCardTracking();
    setupIconClick();
    Lampa.Select.listener.follow('preshow', onPreshow);
  }

  var DrawerHook = {
    init: init$1,
    getLastCardData: function () { return lastCardData }
  };

  function init() {
    Lampa.ContentRows.add({
      name: 'custom_folders',
      title: Lampa.Lang.translate('cf_section_title'),
      index: 2,
      screen: ['bookmarks'],
      call: function (params, screen) {
        var folders = Store.getAllFoldersWithPreview();

        if (folders.length === 0) return []

        return folders.map(function (folder) {
          folder.cards.forEach(function (card) {
            card.params = {
              emit: {
                onEnter: Lampa.Router.call.bind(Lampa.Router, 'full', card),
                onFocus: function () {
                  Lampa.Background.change(Lampa.Utils.cardImgBackground(card));
                }
              }
            };
          });

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
                  });
                }
              }
            }
          }
        })
      }
    });
  }

  var BookmarksInjector = {
    init: init
  };

  function loadFolder(folderName, page) {
    var result = Store.getFolderCards(folderName, page, 20);

    result.results.forEach(function (card) {
      card.params = {
        module: undefined,
        items: {
          view: 20
        }
      };
    });

    return result
  }

  function component(object) {
    var comp = new Lampa.InteractionCategory(object);

    comp.create = function () {
      var data = loadFolder(object.url, object.page || 1);

      if (data.results.length) {
        var self = this;
        setTimeout(function () { self.build(data); }, 10);
      } else {
        this.empty();
      }
    };

    comp.nextPageReuest = function (obj, resolve, reject) {
      var data = loadFolder(object.url, obj.page || 1);

      if (data.results.length) {
        resolve(data);
      } else {
        reject();
      }
    };

    comp.cardRender = function (obj, element, card) {
      card.onEnter = function () {
        Lampa.Router.call('full', element);
      };
      card.onFocus = function () {
        Lampa.Background.change(Lampa.Utils.cardImgBackground(element));
      };
    };

    return comp
  }

  function initPlugin() {
    window.favorite_custom_folders_ready = true;

    Lang.register();

    Lampa.Component.add('favorite_custom_folder_view', component);

    DrawerHook.init();

    BookmarksInjector.init();
  }


  var list = JSON.parse(localStorage.getItem('plugins') || '[]');
  list = list.map(function(p) {
    if (typeof p === 'string') p = {url: p, status: 1};

    if (p.url.indexOf('favorite-custom-folders') >= 0) {
      p.name = 'Кастомные папки';
      p.author = 'vladislavkovaliov';
    }

    return p;
  });

  localStorage.setItem('plugins', JSON.stringify(list));

  if (!window.favorite_custom_folders_ready) {
    if (window.appready) {
      initPlugin();
    } else {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') {
          initPlugin();
        }
      });
    }
  }

})();
