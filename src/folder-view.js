import Store from './store'

function loadFolder(folderName, page) {
  var result = Store.getFolderCards(folderName, page, 20)

  result.results.forEach(function (card) {
    card.params = {
      module: undefined,
      items: {
        view: 20
      }
    }
  })

  return result
}

function component(object) {
  var comp = new Lampa.InteractionCategory(object)

  comp.create = function () {
    var data = loadFolder(object.url, object.page || 1)

    if (data.results.length) {
      var self = this
      setTimeout(function () { self.build(data) }, 10)
    } else {
      this.empty()
    }
  }

  comp.nextPageReuest = function (obj, resolve, reject) {
    var data = loadFolder(object.url, obj.page || 1)

    if (data.results.length) {
      resolve(data)
    } else {
      reject()
    }
  }

  comp.cardRender = function (obj, element, card) {
    card.onEnter = function () {
      Lampa.Router.call('full', element)
    }
    card.onFocus = function () {
      Lampa.Background.change(Lampa.Utils.cardImgBackground(element))
    }
  }

  return comp
}

export default component
