import SyncClient from './sync-client'
import Store from './store'
import dbg from './debugger'

var SYNC_POLL_INTERVAL = 60000
var pollTimer = null
var realtimeChannel = null

function generateDeviceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback UUID v4 generator
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0
    var v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function ensureInitialized() {
  var meta = Store.getSyncMeta()
  if (!meta) {
    meta = {
      device_id: generateDeviceId(),
      device_name: '',
      sync_key: '',
      version: 0,
      last_synced_version: -1,
      sync_enabled: false
    }
    Store.saveSyncMeta(meta)
  }
  return meta
}

function ensureSyncEnabled(callback) {
  var meta = ensureInitialized()
  if (!meta.sync_enabled || !meta.sync_key) {
    if (callback) callback(new Error('Sync not enabled'))
    return false
  }
  return true
}

function pushSnapshot(folders, cards, callback) {
  if (!ensureSyncEnabled(callback)) return

  var meta = Store.getSyncMeta()
  dbg.log('[Sync] PushSnapshot:', 'folders=' + Object.keys(folders || {}).length, 'cards=' + Object.keys(cards || {}).length, 'version=' + meta.version)

  SyncClient.select(meta.sync_key).then(function (response) {
    if (response.error) {
      dbg.error('[Sync] PushSnapshot select error:', response.error)
      if (callback) callback(response.error)
      return
    }

    var serverVersion = response.data ? response.data.version : 0
    dbg.log('[Sync] PushSnapshot server version:', serverVersion, 'local last_synced:', meta.last_synced_version)

    if (serverVersion > meta.last_synced_version) {
      dbg.warn('[Sync] Conflict detected — pulling first then pushing')
      pullSnapshot(function (pullErr) {
        if (pullErr) {
          dbg.error('[Sync] Conflict pull error:', pullErr)
          if (callback) callback(pullErr)
          return
        }
        doPush(folders, cards, callback)
      })
      return
    }

    doPush(folders, cards, callback)
  }).catch(function (err) {
    dbg.error('[Sync] PushSnapshot network error:', err)
    if (callback) callback(err)
  })
}

function doPush(folders, cards, callback) {
  var meta = Store.getSyncMeta()
  var newVersion = meta.version + 1
  var snapshot = {
    folders: folders,
    cards: cards,
    format_version: 1
  }

  dbg.log('[Sync] doPush v' + newVersion, 'device:', meta.device_name || meta.device_id)

  SyncClient.upsert(meta.sync_key, snapshot, meta.device_id, meta.device_name, newVersion)
    .then(function (response) {
      if (response.error) {
        dbg.error('[Sync] doPush upsert error:', response.error)
        Lampa.Noty.show('Sync push failed', { style: 'error' })
        if (callback) callback(response.error)
        return
      }
      meta.version = newVersion
      meta.last_synced_version = newVersion
      Store.saveSyncMeta(meta)
      dbg.log('[Sync] doPush success, version:', newVersion)
      if (callback) callback(null, { version: newVersion })
    })
    .catch(function (err) {
      dbg.error('[Sync] doPush network error:', err)
      Lampa.Noty.show('Sync network error', { style: 'error' })
      if (callback) callback(err)
    })
}

function pullSnapshot(callback) {
  if (!ensureSyncEnabled(callback)) return

  var meta = Store.getSyncMeta()
  dbg.log('[Sync] PullSnapshot local version:', meta.last_synced_version)

  SyncClient.select(meta.sync_key).then(function (response) {
    if (response.error) {
      dbg.error('[Sync] PullSnapshot select error:', response.error)
      if (callback) callback(response.error)
      return
    }

    if (!response.data) {
      dbg.log('[Sync] PullSnapshot empty — no data on server')
      if (callback) callback(null, { empty: true })
      return
    }

    var serverData = response.data

    if (serverData.version <= meta.last_synced_version) {
      dbg.log('[Sync] PullSnapshot up to date, local:', meta.last_synced_version, 'server:', serverData.version)
      if (callback) callback(null, { upToDate: true })
      return
    }

    dbg.log('[Sync] PullSnapshot applying server data v' + serverData.version, 'from device:', serverData.device_name || serverData.device_id)

    // Apply server data locally
    var localData = Store.getData()
    var snapshotData = serverData.data

    if (snapshotData.folders) {
      localData.folders = snapshotData.folders
    }
    if (snapshotData.cards) {
      localData.cards = snapshotData.cards
    }

    Store.saveData(localData)

    meta.last_synced_version = serverData.version
    meta.version = serverData.version
    Store.saveSyncMeta(meta)

    dbg.log('[Sync] PullSnapshot applied:', 'folders=' + Object.keys(snapshotData.folders || {}).length, 'cards=' + Object.keys(snapshotData.cards || {}).length)

    if (callback) callback(null, {
      version: serverData.version,
      deviceId: serverData.device_id,
      deviceName: serverData.device_name
    })
  }).catch(function (err) {
    dbg.error('[Sync] PullSnapshot network error:', err)
    if (callback) callback(err)
  })
}

function enableSync() {
  var meta = ensureInitialized()
  meta.sync_enabled = true
  Store.saveSyncMeta(meta)

  dbg.log('[Sync] Enabled, sync_key:', meta.sync_key ? 'set' : 'NOT SET', 'device:', meta.device_name || meta.device_id)

  // Start realtime if sync_key is set
  if (meta.sync_key) {
    startRealtime()
  }

  // Start polling as a fallback
  startPolling()
}

function disableSync() {
  var meta = Store.getSyncMeta()
  if (meta) {
    meta.sync_enabled = false
    Store.saveSyncMeta(meta)
  }
  stopRealtime()
  stopPolling()
  dbg.log('[Sync] Disabled')
}

function switchUser() {
  var meta = Store.getSyncMeta()
  if (!meta) return

  dbg.log('[Sync] Switching user, clearing meta for device:', meta.device_name || meta.device_id)

  disableSync()
  meta.sync_key = ''
  meta.version = 0
  meta.last_synced_version = -1
  meta.sync_enabled = false
  Store.saveSyncMeta(meta)
}

function startRealtime() {
  stopRealtime()
  var meta = Store.getSyncMeta()
  if (!meta || !meta.sync_key) return

  dbg.log('[Sync] Starting realtime subscription')

  realtimeChannel = SyncClient.createRealtimeChannel(meta.sync_key, function (payload) {
    var newDeviceId = payload.new && payload.new.device_id
    if (newDeviceId === meta.device_id) {
      dbg.log('[Sync] Realtime event is our own change, skipping')
      return
    }
    dbg.log('[Sync] Remote change detected, pulling...')
    pullSnapshot(function (err) {
      if (err) {
        dbg.error('[Sync] Realtime pull error:', err)
      }
    })
  })
}

function stopRealtime() {
  if (realtimeChannel) {
    dbg.log('[Sync] Stopping realtime subscription')
    if (realtimeChannel.unsubscribe) {
      realtimeChannel.unsubscribe()
    }
    realtimeChannel = null
  }
}

function startPolling() {
  stopPolling()
  dbg.log('[Sync] Starting polling every', SYNC_POLL_INTERVAL / 1000, 's')
  pollTimer = setInterval(function () {
    dbg.log('[Sync] Poll tick')
    pullSnapshot(function (err) {
      if (err) {
        dbg.error('[Sync] Poll error:', err)
      }
    })
  }, SYNC_POLL_INTERVAL)
}

function stopPolling() {
  if (pollTimer !== null) {
    dbg.log('[Sync] Stopping polling')
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function getDeviceId() {
  var meta = ensureInitialized()
  return meta ? meta.device_id : null
}

function isSyncEnabled() {
  var meta = Store.getSyncMeta()
  return meta ? meta.sync_enabled && !!meta.sync_key : false
}

function initOnBoot() {
  var meta = Store.getSyncMeta()
  if (meta && meta.sync_enabled && meta.sync_key) {
    dbg.log('[Sync] Boot init: sync enabled, starting connections')
    startRealtime()
    startPolling()
  } else {
    dbg.log('[Sync] Boot init: sync not configured, skipping')
  }
}

export default {
  pushSnapshot: pushSnapshot,
  pullSnapshot: pullSnapshot,
  enableSync: enableSync,
  disableSync: disableSync,
  switchUser: switchUser,
  startRealtime: startRealtime,
  stopRealtime: stopRealtime,
  startPolling: startPolling,
  stopPolling: stopPolling,
  generateDeviceId: generateDeviceId,
  getDeviceId: getDeviceId,
  isSyncEnabled: isSyncEnabled,
  initOnBoot: initOnBoot
}
