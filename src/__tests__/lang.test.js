import { describe, it, expect, vi } from 'vitest'

var translations = {}
global.Lampa = {
  Lang: {
    add: vi.fn(function (keys) {
      for (var key in keys) {
        if (keys.hasOwnProperty(key)) {
          translations[key] = keys[key]
        }
      }
    })
  }
}

import Lang from '../lang'

describe('Lang', () => {
  it('should register translations via Lampa.Lang.add', () => {
    Lang.register()
    expect(global.Lampa.Lang.add).toHaveBeenCalled()
  })

  it('should have all required translation keys', () => {
    Lang.register()

    var requiredKeys = [
      'cf_sync_settings',
      'cf_sync_enable',
      'cf_sync_disable',
      'cf_sync_key',
      'cf_sync_key_input',
      'cf_sync_now',
      'cf_sync_status',
      'cf_status_connected',
      'cf_status_offline',
      'cf_sync_in_progress',
      'cf_sync_complete',
      'cf_sync_up_to_date',
      'cf_sync_error',
      'cf_sync_enabled',
      'cf_sync_disabled',
      'cf_device_name',
      'cf_device_name_input',
      'cf_device_name_set',
      'cf_switch_user',
      'cf_switch_user_confirm',
      'cf_cancel',
      'cf_not_set'
    ]

    for (var i = 0; i < requiredKeys.length; i++) {
      expect(translations[requiredKeys[i]]).toBeDefined(
        'Missing translation key: ' + requiredKeys[i]
      )
    }
  })

  it('should have ru, en, uk for all sync keys', () => {
    Lang.register()

    for (var key in translations) {
      if (translations.hasOwnProperty(key)) {
        var entry = translations[key]
        expect(entry.ru).toBeDefined(key + '.ru')
        expect(typeof entry.ru).toBe('string')
        expect(entry.en).toBeDefined(key + '.en')
        expect(typeof entry.en).toBe('string')
        expect(entry.uk).toBeDefined(key + '.uk')
        expect(typeof entry.uk).toBe('string')
      }
    }
  })
})
