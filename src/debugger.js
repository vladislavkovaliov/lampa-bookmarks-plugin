/**
 * Console logging adapter based on wi-console-logger API.
 * - Dev mode (NODE_ENV !== 'production'): colored console output
 * - Production (rollup build): all methods are no-ops — zero logging overhead
 *
 * API: dbg.log(), dbg.warn(), dbg.error()
 * Level: log (all), warn (warn+error), error (error only)
 */

var NOOP = function () {}

var _log, _warn, _error

if (process.env.NODE_ENV === 'production') {
  _log = NOOP
  _warn = NOOP
  _error = NOOP
} else {
  _log = function () {
    var args = Array.prototype.slice.call(arguments)
    args.unshift('%c DEBUG ')
    args.splice(1, 0, 'background: #333; color: #fff')
    console.log.apply(console, args)
  }

  _warn = function () {
    var args = Array.prototype.slice.call(arguments)
    args.unshift('%c WARN ')
    args.splice(1, 0, 'background: orange; color: #000')
    console.warn.apply(console, args)
  }

  _error = function () {
    var args = Array.prototype.slice.call(arguments)
    args.unshift('%c ERROR ')
    args.splice(1, 0, 'background: red; color: #fff')
    console.error.apply(console, args)
  }
}

var dbg = {
  log: _log,
  warn: _warn,
  error: _error
}

export default dbg
