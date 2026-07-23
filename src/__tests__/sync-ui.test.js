import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

var mockEngine = vi.hoisted(function () {
  return {
    pushSnapshot: vi.fn(),
    pullSnapshot: vi.fn(),
    enableSync: vi.fn(),
    disableSync: vi.fn(),
    switchUser: vi.fn()
  }
})

vi.mock('../sync-engine', function () {
  return { default: mockEngine }
})

vi.mock('../store', function () {
  return {
    default: {
      getSyncMeta: vi.fn(),
      saveSyncMeta: vi.fn(),
      getData: vi.fn()
    }
  }
})

global.Lampa = {
  Select: { close: vi.fn(), show: vi.fn() },
  Input: { edit: vi.fn() },
  Controller: { toggle: vi.fn() },
  Noty: { show: vi.fn() },
  Lang: {
    translate: vi.fn(function (key) {
      var m = {
        cf_sync_settings: 'Sync',
        cf_sync_enable: 'Enable sync',
        cf_sync_disable: 'Disable sync',
        cf_sync_key: 'Sync key',
        cf_sync_key_input: 'Enter sync key',
        cf_not_set: 'Not set',
        cf_device_name: 'Device name',
        cf_device_name_input: 'Enter device name',
        cf_device_name_set: 'Device name saved',
        cf_sync_now: 'Sync now',
        cf_sync_status: 'Status',
        cf_status_connected: 'Connected',
        cf_status_offline: 'Offline',
        cf_sync_in_progress: 'Syncing...',
        cf_sync_error: 'Sync error',
        cf_sync_up_to_date: 'Up to date',
        cf_sync_complete: 'Complete',
        cf_sync_enabled: 'Sync enabled',
        cf_sync_disabled: 'Sync disabled',
        cf_switch_user: 'Switch user',
        cf_switch_user_confirm: 'OK',
        cf_cancel: 'Cancel'
      }
      return m[key] || key
    })
  }
}

import Store from '../store'
import SyncUI from '../sync-ui'

function makeMeta() {
  return {
    device_id: 'test-device',
    device_name: 'Test TV',
    sync_key: 'my-key',
    version: 5,
    last_synced_version: 5,
    sync_enabled: true
  }
}

describe('SyncUI', () => {
  beforeEach(function () {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Store.getSyncMeta.mockReturnValue(makeMeta())
    Store.getData.mockReturnValue({ folders: {}, cards: {} })
  })

  afterEach(function () {
    vi.useRealTimers()
  })

  it('shows settings dialog', function () {
    SyncUI.showSyncSettings()
    expect(Lampa.Select.show).toHaveBeenCalled()
  })

  it('shows disable toggle when enabled', function () {
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    expect(items[0].title).toBe('Disable sync')
    expect(items[0].checkbox).toBe(true)
    expect(items[0].checked).toBe(true)
  })

  it('shows enable toggle when disabled', function () {
    var m = makeMeta()
    m.sync_enabled = false
    Store.getSyncMeta.mockReturnValue(m)
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    expect(items[0].title).toBe('Enable sync')
    expect(items[0].checked).toBe(false)
  })

  it('shows all detail items when enabled', function () {
    SyncUI.showSyncSettings()
    var call = Lampa.Select.show.mock.calls[0][0]
    var titles = call.items.map(function (i) { return i.title })
    expect(titles).toContain('Status')
    expect(titles).toContain('Sync key')
    expect(titles).toContain('Device name')
    expect(titles).toContain('Sync now')
    expect(titles).toContain('Switch user')
    // Status desc should show 'Connected' when enabled with key
    var statusItem = call.items.find(function (i) { return i.title === 'Status' })
    expect(statusItem.desc).toBe('Connected')
  })

  it('hides detail items when disabled', function () {
    var m = makeMeta()
    m.sync_enabled = false
    Store.getSyncMeta.mockReturnValue(m)
    SyncUI.showSyncSettings()
    // toggle + status (connected/offline)
    expect(Lampa.Select.show.mock.calls[0][0].items.length).toBe(2)
    var statusItem = Lampa.Select.show.mock.calls[0][0].items[1]
    expect(statusItem.title).toBe('Status')
    expect(statusItem.desc).toBe('Offline')
  })

  it('shows Connected when sync is enabled with key', function () {
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    var statusItem = items[1]
    expect(statusItem.title).toBe('Status')
    expect(statusItem.desc).toBe('Connected')
  })

  it('disables sync when toggle unchecked', function () {
    SyncUI.showSyncSettings()
    Lampa.Select.show.mock.calls[0][0].items[0].onCheck()
    expect(mockEngine.disableSync).toHaveBeenCalled()
    expect(Lampa.Noty.show).toHaveBeenCalled()
  })

  it('opens key input when sync key tapped', function () {
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    var keyItem = items.find(function (i) { return i.title === 'Sync key' })
    expect(keyItem).toBeDefined()
    keyItem.onSelect()
    expect(Lampa.Input.edit).toHaveBeenCalled()
  })

  it('triggers pull on sync now', function () {
    mockEngine.pullSnapshot.mockImplementation(function (cb) { if (cb) cb(null, { upToDate: true }) })
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    var nowItem = items.find(function (i) { return i.title === 'Sync now' })
    expect(nowItem).toBeDefined()
    nowItem.onSelect()
    expect(Lampa.Noty.show).toHaveBeenCalledWith('Syncing...')
    expect(mockEngine.pullSnapshot).toHaveBeenCalled()
  })

  it('shows details when status is tapped', function () {
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    var statusItem = items[1]
    // Tap status — deferred via setTimeout
    statusItem.onSelect()
    vi.runAllTimers()
    var detailConfig = Lampa.Select.show.mock.calls[1][0]
    expect(detailConfig.items[0].title).toBe('Version: 5')
    expect(detailConfig.items[1].title).toBe('Last synced: v5')
    expect(detailConfig.items[2].title).toBe('Device ID: test-dev...')
    // onBack should re-open settings
    expect(detailConfig.onBack).toBeDefined()
    Lampa.Select.show.mockClear()
    detailConfig.onBack()
    vi.runAllTimers()
    expect(Lampa.Select.show).toHaveBeenCalled()
  })

  it('shows confirmation on switch user', function () {
    SyncUI.showSyncSettings()
    var items = Lampa.Select.show.mock.calls[0][0].items
    var swItem = items.find(function (i) { return i.title === 'Switch user' })
    expect(swItem).toBeDefined()
    // Deferred via setTimeout
    swItem.onSelect()
    vi.runAllTimers()
    expect(Lampa.Select.show).toHaveBeenCalledTimes(2)
    // onBack should re-open settings
    var swConfig = Lampa.Select.show.mock.calls[1][0]
    expect(swConfig.onBack).toBeDefined()
    Lampa.Select.show.mockClear()
    swConfig.onBack()
    vi.runAllTimers()
    expect(Lampa.Select.show).toHaveBeenCalled()
  })
})
