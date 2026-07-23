/**
 * Thin Supabase REST client using raw fetch().
 * No @supabase/supabase-js dependency — works on ES5 WebViews.
 */

import dbg from './debugger'

function getApiUrl() {
  return process.env.SUPABASE_URL + '/rest/v1'
}

function getApiKey() {
  return process.env.SUPABASE_PUBLISHABLE_KEY
}

function checkConfig() {
  var url = getApiUrl()
  var key = getApiKey()
  if (!url || url === '/rest/v1' || !key) {
    var msg = 'Supabase not configured — check .env.local'
    dbg.error('[Sync] ' + msg, 'url:', url ? 'OK' : 'MISSING', 'key:', key ? 'OK' : 'MISSING')
    if (typeof Lampa !== 'undefined' && Lampa.Noty) {
      Lampa.Noty.show('[Sync] ' + msg, { style: 'error' })
    }
    return false
  }
  return true
}

function mergeHeaders(extra) {
  var key = getApiKey()
  var h = {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json'
  }
  if (!extra) return h
  var keys = Object.keys(extra)
  for (var i = 0; i < keys.length; i++) {
    h[keys[i]] = extra[keys[i]]
  }
  return h
}

function parseResponse(response) {
  if (!response.ok) {
    return response.text().then(function (body) {
      var err = new Error('Supabase API error: ' + response.status + ' ' + body)
      err.status = response.status
      return { data: null, error: err }
    })
  }
  if (response.status === 204) {
    return { data: null, error: null }
  }
  return response.json().then(function (json) {
    return { data: json, error: null }
  }).catch(function () {
    return { data: null, error: null }
  })
}

function select(syncKey) {
  if (!checkConfig()) return Promise.resolve({ data: null, error: new Error('Missing Supabase config') })

  var url = getApiUrl() + '/sync_data?sync_key=eq.' + encodeURIComponent(syncKey)
  dbg.log('[Sync] GET', url)

  return fetch(url, {
    method: 'GET',
    headers: mergeHeaders()
  }).then(parseResponse).then(function (result) {
    // Accept: application/vnd.pgrst.object+json returns 406 when 0 rows.
    // Use default array response and normalize.
    if (result.error) return result
    if (Array.isArray(result.data)) {
      if (result.data.length === 0) return { data: null, error: null }
      return { data: result.data[0], error: null }
    }
    return result
  }).catch(function (err) {
    dbg.error('[Sync] Select network error:', err)
    return { data: null, error: err }
  })
}

function upsert(syncKey, data, deviceId, deviceName, version) {
  if (!checkConfig()) return Promise.resolve({ data: null, error: new Error('Missing Supabase config') })

  var payload = {
    sync_key: syncKey,
    data: data,
    device_id: deviceId,
    device_name: deviceName || '',
    version: version
  }

  var url = getApiUrl() + '/sync_data'
  dbg.log('[Sync] POST', url, 'sync_key:', syncKey, 'v' + version)

  return fetch(url, {
    method: 'POST',
    headers: mergeHeaders({ 'Prefer': 'resolution=merge-duplicates' }),
    body: JSON.stringify(payload)
  }).then(parseResponse).catch(function (err) {
    dbg.error('[Sync] Upsert network error:', err)
    return { data: null, error: err }
  })
}

function createRealtimeChannel(syncKey, onChange) {
  dbg.log('[Sync] Realtime disabled (fetch-based client), using polling fallback')
  return {
    unsubscribe: function () {}
  }
}

function resetClient() {}

export default {
  select: select,
  upsert: upsert,
  createRealtimeChannel: createRealtimeChannel,
  resetClient: resetClient
}
