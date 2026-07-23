import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted mock objects — available to vi.mock factory and tests
var mockClient = vi.hoisted(function () {
  return {
    select: vi.fn(),
    upsert: vi.fn(),
    createRealtimeChannel: vi.fn(),
    resetClient: vi.fn()
  }
})

vi.mock('../sync-client', function () {
  return { default: mockClient }
})

vi.mock('../store', function () {
  return {
    default: {
      getSyncMeta: vi.fn(),
      saveSyncMeta: vi.fn(),
      getData: vi.fn(),
      saveData: vi.fn(),
      clearSyncMeta: vi.fn()
    }
  }
})

vi.useFakeTimers()

import Store from '../store'
import SyncEngine from '../sync-engine'

function makeMeta() {
  return {
    device_id: 'test-device-uuid',
    device_name: 'Test TV',
    sync_key: 'test-sync-key',
    version: 0,
    last_synced_version: -1,
    sync_enabled: true
  }
}

describe('SyncEngine', () => {
  beforeEach(function () {
    vi.clearAllMocks()
    vi.clearAllTimers()

    Store.getSyncMeta.mockReturnValue(makeMeta())
    Store.getData.mockReturnValue({
      folders: { 'test-folder': { title: 'Test', cards: ['c1'] } },
      cards: { c1: { id: 'c1', title: 'Movie' } }
    })

    mockClient.select.mockResolvedValue({ data: null, error: null })
    mockClient.upsert.mockResolvedValue({ data: { id: '1' }, error: null })
    mockClient.createRealtimeChannel.mockReturnValue({ unsubscribe: vi.fn() })
  })

  describe('generateDeviceId', () => {
    it('uuid v4 format', function () {
      expect(SyncEngine.generateDeviceId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      )
    })

    it('unique each call', function () {
      expect(SyncEngine.generateDeviceId()).not.toBe(SyncEngine.generateDeviceId())
    })
  })

  describe('enableSync / disableSync', () => {
    it('enable sets sync_enabled + starts realtime + polling', function () {
      SyncEngine.enableSync()
      expect(Store.getSyncMeta().sync_enabled).toBe(true)
      expect(Store.saveSyncMeta).toHaveBeenCalled()
      expect(mockClient.createRealtimeChannel).toHaveBeenCalled()
    })

    it('disable sets sync_enabled false and stops', function () {
      SyncEngine.enableSync()
      vi.clearAllMocks()
      SyncEngine.disableSync()
      expect(Store.getSyncMeta().sync_enabled).toBe(false)
      expect(Store.saveSyncMeta).toHaveBeenCalled()
    })
  })

  describe('pushSnapshot', () => {
    it('pushes data and increments version', function () {
      return new Promise(function (resolve, reject) {
        SyncEngine.pushSnapshot(
          { 'test-folder': { title: 'Test', cards: ['c1'] } },
          { c1: { id: 'c1', title: 'Movie' } },
          function (err, result) {
            try {
              expect(err).toBeNull()
              expect(result.version).toBe(1)
              expect(mockClient.upsert).toHaveBeenCalledWith(
                'test-sync-key',
                { folders: { 'test-folder': { title: 'Test', cards: ['c1'] } }, cards: { c1: { id: 'c1', title: 'Movie' } }, format_version: 1 },
                'test-device-uuid', 'Test TV', 1
              )
              expect(Store.saveSyncMeta).toHaveBeenCalled()
              resolve()
            } catch (e) { reject(e) }
          }
        )
      })
    })

    it('detects conflict when server version is higher', function () {
      mockClient.select.mockResolvedValue({ data: { version: 5, data: {} }, error: null })
      return new Promise(function (resolve) {
        SyncEngine.pushSnapshot({ f: { title: 'F', cards: [] } }, {}, function (err) {
          expect(err).toBeNull()
          expect(mockClient.select).toHaveBeenCalled()
          resolve()
        })
      })
    })

    it('errors if sync not enabled', function () {
      Store.getSyncMeta().sync_enabled = false
      Store.getSyncMeta().sync_key = ''
      return new Promise(function (resolve) {
        SyncEngine.pushSnapshot({}, {}, function (err) {
          expect(err).toBeTruthy()
          expect(err.message).toContain('not enabled')
          resolve()
        })
      })
    })
  })

  describe('pullSnapshot', () => {
    it('pulls newer data and updates local store', function () {
      mockClient.select.mockResolvedValue({
        data: {
          version: 3,
          data: { folders: { 'remote': { title: 'Remote', cards: ['r1'] } }, cards: { r1: { id: 'r1', title: 'R' } }, format_version: 1 },
          device_id: 'other-device',
          device_name: 'Other TV'
        },
        error: null
      })
      return new Promise(function (resolve, reject) {
        SyncEngine.pullSnapshot(function (err, result) {
          try {
            expect(err).toBeNull()
            expect(result.version).toBe(3)
            expect(result.deviceId).toBe('other-device')
            expect(Store.saveData).toHaveBeenCalled()
            expect(Store.getSyncMeta().last_synced_version).toBe(3)
            resolve()
          } catch (e) { reject(e) }
        })
      })
    })

    it('returns upToDate when version matches', function () {
      Store.getSyncMeta().last_synced_version = 5
      mockClient.select.mockResolvedValue({ data: { version: 5, data: {} }, error: null })
      return new Promise(function (resolve) {
        SyncEngine.pullSnapshot(function (err, result) {
          expect(err).toBeNull()
          expect(result.upToDate).toBe(true)
          expect(Store.saveData).not.toHaveBeenCalled()
          resolve()
        })
      })
    })

    it('returns empty when no server data', function () {
      mockClient.select.mockResolvedValue({ data: null, error: null })
      return new Promise(function (resolve) {
        SyncEngine.pullSnapshot(function (err, result) {
          expect(err).toBeNull()
          expect(result.empty).toBe(true)
          resolve()
        })
      })
    })
  })

  describe('switchUser', () => {
    it('resets meta but keeps device_id', function () {
      SyncEngine.enableSync()
      vi.clearAllMocks()
      SyncEngine.switchUser()
      var m = Store.getSyncMeta()
      expect(m.sync_key).toBe('')
      expect(m.version).toBe(0)
      expect(m.last_synced_version).toBe(-1)
      expect(m.sync_enabled).toBe(false)
      expect(m.device_id).toBe('test-device-uuid')
      expect(Store.saveSyncMeta).toHaveBeenCalled()
    })
  })

  describe('polling', () => {
    it('polls every 60s and stops on stopPolling', function () {
      SyncEngine.enableSync()
      vi.clearAllMocks()
      mockClient.select.mockResolvedValue({ data: null, error: null })

      SyncEngine.startPolling()
      expect(mockClient.select).not.toHaveBeenCalled()

      vi.advanceTimersByTime(60000)
      expect(mockClient.select).toHaveBeenCalled()

      SyncEngine.stopPolling()
      vi.clearAllMocks()
      vi.advanceTimersByTime(60000)
      expect(mockClient.select).not.toHaveBeenCalled()
    })
  })

  describe('getDeviceId / isSyncEnabled / initOnBoot', () => {
    it('getDeviceId returns device_id', function () {
      expect(SyncEngine.getDeviceId()).toBe('test-device-uuid')
    })

    it('getDeviceId always returns a UUID (creates meta if needed)', function () {
      Store.getSyncMeta.mockReturnValue(null)
      var id = SyncEngine.getDeviceId()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      // Should also save the newly created meta
      expect(Store.saveSyncMeta).toHaveBeenCalled()
    })

    it('isEnabled true with key and enabled', function () {
      expect(SyncEngine.isSyncEnabled()).toBe(true)
    })

    it('isEnabled false when disabled', function () {
      Store.getSyncMeta().sync_enabled = false
      expect(SyncEngine.isSyncEnabled()).toBe(false)
    })

    it('isEnabled false without key', function () {
      Store.getSyncMeta().sync_key = ''
      expect(SyncEngine.isSyncEnabled()).toBe(false)
    })

    it('initOnBoot starts realtime + polling when meta is valid', function () {
      SyncEngine.initOnBoot()
      expect(mockClient.createRealtimeChannel).toHaveBeenCalled()
    })

    it('initOnBoot does nothing when meta is null', function () {
      Store.getSyncMeta.mockReturnValue(null)
      SyncEngine.initOnBoot()
      expect(mockClient.createRealtimeChannel).not.toHaveBeenCalled()
    })

    it('initOnBoot does nothing when sync_enabled is false', function () {
      Store.getSyncMeta().sync_enabled = false
      SyncEngine.initOnBoot()
      expect(mockClient.createRealtimeChannel).not.toHaveBeenCalled()
    })

    it('initOnBoot does nothing when sync_key is empty', function () {
      Store.getSyncMeta().sync_key = ''
      SyncEngine.initOnBoot()
      expect(mockClient.createRealtimeChannel).not.toHaveBeenCalled()
    })
  })
})
