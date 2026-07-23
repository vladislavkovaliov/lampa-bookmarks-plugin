import replace from '@rollup/plugin-replace'
import { readFileSync } from 'fs'

function loadEnv() {
  try {
    var content = readFileSync('.env.local', 'utf8')
    var vars = {}
    var lines = content.split('\n')

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim()
      if (!line || line.indexOf('#') === 0) continue
      var eqIdx = line.indexOf('=')
      if (eqIdx > 0) {
        var key = line.slice(0, eqIdx).trim()
        var val = line.slice(eqIdx + 1).trim()
        vars[key] = val
      }
    }

    return vars
  } catch (e) {
    return {}
  }
}

var env = loadEnv()

export default {
  input: 'src/custom-favorites.js',
  output: {
    dir: 'dist',
    format: 'iife',
    name: 'FavoriteCustomFolders',
  },
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.SUPABASE_URL': JSON.stringify(env.SUPABASE_URL || ''),
      'process.env.SUPABASE_PUBLISHABLE_KEY': JSON.stringify(env.SUPABASE_PUBLISHABLE_KEY || ''),
      'process.env.NODE_ENV': JSON.stringify('production')
    })
  ]
}
