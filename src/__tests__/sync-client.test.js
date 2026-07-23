import { describe, it, expect, vi, beforeEach } from 'vitest'

// Must be set BEFORE module import since API_URL/API_KEY are top-level vars
vi.stubEnv('SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'test-key')

// Mock global fetch
global.fetch = vi.fn()

import SyncClient from '../sync-client'

function mockResponse(status, body, ok) {
  if (ok === undefined) ok = status >= 200 && status < 300
  return {
    ok: ok,
    status: status,
    json: function () { return Promise.resolve(body) },
    text: function () { return Promise.resolve(JSON.stringify(body)) }
  }
}

describe('SyncClient', () => {
  beforeEach(function () {
    global.fetch.mockClear()
  })

  it('selects data by sync_key', function () {
    global.fetch.mockResolvedValue(mockResponse(200, [{ sync_key: 'my-key', version: 3 }]))

    return SyncClient.select('my-key').then(function (result) {
      expect(result.error).toBeNull()
      expect(result.data.sync_key).toBe('my-key')
      expect(result.data.version).toBe(3)

      var call = global.fetch.mock.calls[0]
      expect(call[0]).toContain('/rest/v1/sync_data?sync_key=eq.my-key')
      expect(call[1].method).toBe('GET')
      expect(call[1].headers.apikey).toBe('test-key')
      expect(call[1].headers.Authorization).toBe('Bearer test-key')
    })
  })

  it('returns null data when no rows found', function () {
    global.fetch.mockResolvedValue(mockResponse(200, []))

    return SyncClient.select('unknown-key').then(function (result) {
      expect(result.data).toBeNull()
      expect(result.error).toBeNull()
    })
  })

  it('upserts data', function () {
    global.fetch.mockResolvedValue(mockResponse(204, null))

    return SyncClient.upsert('my-key', { folders: {}, cards: {} }, 'device-1', 'TV', 1).then(function (result) {
      expect(result.error).toBeNull()

      var call = global.fetch.mock.calls[0]
      expect(call[0]).toContain('/rest/v1/sync_data')
      expect(call[1].method).toBe('POST')
      expect(call[1].headers['Prefer']).toBe('resolution=merge-duplicates')

      var body = JSON.parse(call[1].body)
      expect(body.sync_key).toBe('my-key')
      expect(body.version).toBe(1)
      expect(body.device_id).toBe('device-1')
    })
  })

  it('returns error on network failure', function () {
    global.fetch.mockRejectedValue(new Error('Network error'))

    return SyncClient.select('my-key').then(function (result) {
      expect(result.data).toBeNull()
      expect(result.error).toBeDefined()
      expect(result.error.message).toContain('Network error')
    })
  })

  it('createRealtimeChannel returns dummy unsubscribe', function () {
    var ch = SyncClient.createRealtimeChannel('key', function () {})
    expect(ch.unsubscribe).toBeDefined()
    ch.unsubscribe()
  })

  it('resetClient is a no-op', function () {
    SyncClient.resetClient()
  })
})
