import Store from './store'

function init() {
  Lampa.ContentRows.add({
    name: 'custom_folders',
    title: Lampa.Lang.translate('cf_section_title'),
    index: 2,
    screen: ['bookmarks'],
    call: function (params, screen) {
      var folders = Store.getAllFoldersWithPreview()

      if (folders.length === 0) return []

      return folders.map(function (folder) {
        folder.cards.forEach(function (card) {
          card.params = {
            emit: {
              onEnter: Lampa.Router.call.bind(Lampa.Router, 'full', card),
              onFocus: function () {
                Lampa.Background.change(Lampa.Utils.cardImgBackground(card))
              }
            }
          }
        })

        return {
          title: folder.name,
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
                  title: folder.name,
                  component: 'favorite_custom_folder_view',
                  page: 1
                })
              }
            }
          }
        }
      })
    }
  })
}

export default {
  init: init
}
