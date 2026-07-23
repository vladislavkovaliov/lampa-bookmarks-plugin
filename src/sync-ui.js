import Store from './store'
import SyncEngine from './sync-engine'
import dbg from './debugger'

function showSyncSettings() {
  var meta = Store.getSyncMeta()
  if (!meta) {
    // First time — create meta with a new device ID
    meta = {
      device_id: SyncEngine.generateDeviceId(),
      device_name: '',
      sync_key: '',
      version: 0,
      last_synced_version: -1,
      sync_enabled: false
    }
    Store.saveSyncMeta(meta)
  }

  dbg.log('[Sync] Opening settings: enabled=' + meta.sync_enabled, 'key=' + (meta.sync_key ? 'set' : 'empty'), 'device=' + (meta.device_name || 'unnamed'), 'version=' + meta.version)

  var items = []

  // Sync enable/disable toggle
  items.push({
    title: meta.sync_enabled
      ? Lampa.Lang.translate('cf_sync_disable')
      : Lampa.Lang.translate('cf_sync_enable'),
    checkbox: true,
    checked: meta.sync_enabled,
    onCheck: function () {
      if (meta.sync_enabled) {
        dbg.log('[Sync] User disabled sync')
        SyncEngine.disableSync()
        Lampa.Noty.show(Lampa.Lang.translate('cf_sync_disabled'))
      } else {
        if (!meta.sync_key) {
          dbg.log('[Sync] Sync enabled but no key, prompting for input')
          Lampa.Select.close()
          Lampa.Input.edit({
            title: Lampa.Lang.translate('cf_sync_key_input'),
            value: '',
            free: true,
            nosave: true
          }, function (value) {
            if (!value || !value.trim()) return
            meta.sync_key = value.trim()
            Store.saveSyncMeta(meta)
            dbg.log('[Sync] Sync key set, enabling')
            SyncEngine.enableSync()
            Lampa.Noty.show(Lampa.Lang.translate('cf_sync_enabled'))
          })
          return
        }
        SyncEngine.enableSync()
        Lampa.Noty.show(Lampa.Lang.translate('cf_sync_enabled'))
      }
    }
  })

  // Status indicator — always visible, tap for details
  var isConnected = meta.sync_enabled && !!meta.sync_key
  items.push({
    title: Lampa.Lang.translate('cf_sync_status'),
    desc: isConnected
      ? Lampa.Lang.translate('cf_status_connected')
      : Lampa.Lang.translate('cf_status_offline'),
    onSelect: function () {
      var lastSync = meta.last_synced_version >= 0 ? 'v' + meta.last_synced_version : Lampa.Lang.translate('cf_not_set')
      var devId = (meta.device_id || '').slice(0, 8)
      setTimeout(function () {
        Lampa.Select.show({
          title: Lampa.Lang.translate('cf_sync_status'),
          items: [
            { title: 'Version: ' + meta.version },
            { title: 'Last synced: ' + lastSync },
            { title: 'Device ID: ' + devId + '...' }
          ]
        })
      }, 0)
    }
  })

  // Only show detail items when sync is enabled
  if (meta.sync_enabled) {
    // Sync key
    items.push({
      title: Lampa.Lang.translate('cf_sync_key'),
      desc: meta.sync_key ? '••••••••' : Lampa.Lang.translate('cf_not_set'),
      onSelect: function () {
        Lampa.Select.close()
        Lampa.Input.edit({
          title: Lampa.Lang.translate('cf_sync_key_input'),
          value: meta.sync_key || '',
          free: true,
          nosave: true
        }, function (value) {
          if (!value || !value.trim()) return
          meta.sync_key = value.trim()
          Store.saveSyncMeta(meta)
          dbg.log('[Sync] Sync key changed')
        })
      }
    })

    // Device name
    items.push({
      title: Lampa.Lang.translate('cf_device_name'),
      desc: meta.device_name || Lampa.Lang.translate('cf_not_set'),
      onSelect: function () {
        Lampa.Select.close()
        Lampa.Input.edit({
          title: Lampa.Lang.translate('cf_device_name_input'),
          value: meta.device_name || '',
          free: true,
          nosave: true
        }, function (value) {
          if (!value || !value.trim()) return
          meta.device_name = value.trim()
          Store.saveSyncMeta(meta)
          dbg.log('[Sync] Device name set:', meta.device_name)
          Lampa.Noty.show(Lampa.Lang.translate('cf_device_name_set'))
        })
      }
    })

    // Sync now
    items.push({
      title: Lampa.Lang.translate('cf_sync_now'),
      onSelect: function () {
        dbg.log('[Sync] Manual sync now triggered')
        Lampa.Noty.show(Lampa.Lang.translate('cf_sync_in_progress'))
        SyncEngine.pullSnapshot(function (err, result) {
          if (err) {
            Lampa.Noty.show(Lampa.Lang.translate('cf_sync_error'), { style: 'error' })
            return
          }
          if (result && result.upToDate) {
            Lampa.Noty.show(Lampa.Lang.translate('cf_sync_up_to_date'))
          } else {
            Lampa.Noty.show(Lampa.Lang.translate('cf_sync_complete'))
          }
        })
      }
    })

    // Switch user
    items.push({
      title: Lampa.Lang.translate('cf_switch_user'),
      onSelect: function () {
        setTimeout(function () {
          Lampa.Select.show({
            title: Lampa.Lang.translate('cf_switch_user'),
            items: [
              {
                title: Lampa.Lang.translate('cf_switch_user_confirm'),
                onSelect: function () {
                  dbg.log('[Sync] Switch user confirmed')
                  SyncEngine.switchUser()
                  Lampa.Select.close()
                  Lampa.Input.edit({
                    title: Lampa.Lang.translate('cf_sync_key_input'),
                    value: '',
                    free: true,
                    nosave: true
                  }, function (value) {
                    if (!value || !value.trim()) return
                    var m = Store.getSyncMeta()
                    m.sync_key = value.trim()
                    Store.saveSyncMeta(m)
                    SyncEngine.enableSync()
                    Lampa.Noty.show(Lampa.Lang.translate('cf_sync_enabled'))
                  })
                }
              },
              {
                title: Lampa.Lang.translate('cf_cancel'),
                onSelect: function () {
                  Lampa.Controller.toggle('content')
                }
              }
            ]
          })
        }, 0)
      }
    })

    // Status indicator
    items.push({
      title: Lampa.Lang.translate('cf_sync_status'),
      desc: Lampa.Lang.translate('cf_status_connected')
    })
  }

  Lampa.Select.show({
    title: Lampa.Lang.translate('cf_sync_settings'),
    items: items
  })
}

export default {
  showSyncSettings: showSyncSettings
}
