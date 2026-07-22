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
