import Lang from './lang'
import DrawerHook from './drawer-hook'
import BookmarksInjector from './bookmarks-injector'
import FolderView from './folder-view'

function initPlugin() {
  window.favorite_custom_folders_ready = true

  Lang.register()

  Lampa.Component.add('favorite_custom_folder_view', FolderView)

  DrawerHook.init()

  BookmarksInjector.init()
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
    initPlugin()
  } else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') {
        initPlugin()
      }
    })
  }
}
