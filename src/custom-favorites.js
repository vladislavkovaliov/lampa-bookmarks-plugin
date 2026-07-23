import Lang from './lang'
import DrawerHook from './drawer-hook'
import BookmarksInjector from './bookmarks-injector'
import FolderView from './folder-view'
import SyncEngine from './sync-engine'
import dbg from './debugger'

// Polyfills for old Smart TV WebViews (missing ES6 DOM APIs)
(function () {
  // Element.closest()
  if (!Element.prototype.closest) {
    Element.prototype.closest = function (selector) {
      var el = this
      while (el && el.nodeType === 1) {
        if (_matches(el, selector)) return el
        el = el.parentElement
      }
      return null
    }
  }

  // Element.matches() — vendor-prefixed on old browsers
  function _matches(el, selector) {
    var m = el.matches || el.matchesSelector || el.webkitMatchesSelector ||
      el.mozMatchesSelector || el.msMatchesSelector || el.oMatchesSelector
    if (m) return m.call(el, selector)
    return false
  }

  if (!Element.prototype.matches) {
    Element.prototype.matches = function (selector) {
      return _matches(this, selector)
    }
  }
})()

function initPlugin() {
  window.favorite_custom_folders_ready = true

  dbg.log('initPlugin()')
  Lang.register()

  Lampa.Component.add('favorite_custom_folder_view', FolderView)

  DrawerHook.init()

  BookmarksInjector.init()

  SyncEngine.initOnBoot()

  // Show sync status on UI after a delay (let UI settle)
  setTimeout(function () {
    var hasMeta = !!SyncEngine.getDeviceId()

    dbg.log('hasMeta:', hasMeta)
    if (SyncEngine.isSyncEnabled()) {
      Lampa.Noty.show('[Sync] Active — ' + (SyncEngine.getDeviceId() ? 'OK' : 'no device'))
    } else if (hasMeta) {
      Lampa.Noty.show('[Sync] Disabled — open settings')
    }
  }, 3000)
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
    try { initPlugin() } catch (e) { dbg.error('Plugin init error:', e) }
  } else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') {
        try { initPlugin() } catch (e) { dbg.error('Plugin init error:', e) }
      }
    })
  }
}
