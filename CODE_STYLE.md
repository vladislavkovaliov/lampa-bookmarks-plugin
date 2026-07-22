# Code Style: Lampa Bookmarks Plugins

## Naming Conventions

| Category | Convention | Examples |
|----------|-----------|----------|
| **Files/Directories** | `kebab-case.js` | `bookmarks-injector.js`, `drawer-hook.js`, `folder-view.js` |
| **Test files** | `{module}.test.js` under `__tests__/` | `store.test.js`, `drawer-hook.test.js` |
| **Functions** | `camelCase` | `createFolder()`, `openFavoritesDrawer()`, `toggleCustomFolder()` |
| **Exported default** | `camelCase` object or function | `export default { init }`, `export default component` |
| **Constants** | `UPPER_SNAKE_CASE` (module-level) | `STORAGE_KEY`, `FAV_KEYS`, `BUILT_IN_CATEGORIES` |
| **Variables** | `camelCase` | `lastCardData`, `lowerName`, `folderName` |
| **Private/internal** | Regular `camelCase` (no `_` prefix) | `getData()`, `cleanupCard()`, `findCardData()` |

## File Organization

Each file follows this general structure:

```
1. Imports (ES module `import` statements)
2. Module-level constants
3. Helper/private functions
4. Main exported function(s)
5. Export default
```

**Exceptions**:
- `favorite-custom-folders.js` (entry point) places self-executing initialization at the bottom after exports
- `drawer-hook.js` uses section comments (`// ----- Click handler ... -----`) to separate logical blocks

## Import Style

```javascript
// Default import (preferred for local modules)
import Store from './store'
import Lang from './lang'

// Named imports for test utilities
import { describe, it, expect, vi } from 'vitest'

// No named imports from local modules — always default export
```

- Use **relative paths** with `./` prefix for local imports
- No file extensions in import paths (e.g., `./store` not `./store.js`)
- Single quotes for all imports
- No semicolons at end of import statements

## Code Patterns

### Module Pattern (Revealing Module)

Every module uses a default export of either:
- An object `{ init, ... }` — for modules with lifecycle
- A single function — for factory/component modules

```javascript
// Lifecycle module
export default {
  init: init
}

// Factory module
export default component
```

### Lampa Plugin Pattern

```javascript
// Guard against double-initialization
if (!window.favorite_custom_folders_ready) {
  if (window.appready) {
    initPlugin()
  } else {
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') {
        initPlugin()
      }
    })
  }
}
```

### UI Hooks (Monkey-patching)

```javascript
var origCheck = Lampa.Favorite.check
if (!origCheck) return

Lampa.Favorite.check = function (card) {
  lastCardData = card
  return origCheck(card)   // call original
}
```

### Store Access

Always read fresh from localStorage (no caching):

```javascript
function getData() {
  try {
    var raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : { folders: {}, cards: {} }
  } catch (e) {
    return { folders: {}, cards: {} }
  }
}

function saveData(data) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}
```

**Pattern**: Read → mutate → write (transaction-like).

### Error Handling

```javascript
// Functions throw error messages (already translated)
if (!name) throw Lampa.Lang.translate('cf_name_empty')

// Callers catch and display
try {
  Store.createFolder(name)
  Lampa.Noty.show(Lampa.Lang.translate('cf_folder_created').replace('{name}', name))
} catch (err) {
  Lampa.Noty.show(err, { style: 'error' })
}
```

## Error Handling

| Approach | When |
|----------|------|
| **Throw string** | For validation errors in store functions (caught by caller) |
| **Early return** | For guard conditions where no action is needed |
| **Graceful fallback** | `JSON.parse` wrapped in try/catch to return default structure |
| **Silent fail** | `if (!origCheck) return` — skip hook if Lampa API not available |

### Error patterns to follow:

```javascript
// Guard clause — early return
if (!data.folders[name]) return

// Validate and throw
if (BUILT_IN_CATEGORIES.indexOf(lowerName) >= 0) {
  throw Lampa.Lang.translate('cf_name_taken_system')
}

// Try/catch with fallback
try {
  var raw = window.localStorage.getItem(STORAGE_KEY)
  return raw ? JSON.parse(raw) : { folders: {}, cards: {} }
} catch (e) {
  return { folders: {}, cards: {} }
}
```

## Logging

- **No console.log/debug statements** in source code
- User-facing messages go through `Lampa.Noty.show()` for toast notifications
- All user-facing strings use `Lampa.Lang.translate('key')` for i18n
- String interpolation uses `.replace('{name}', value)` pattern

## Testing

### Test file conventions
- Location: `src/__tests__/{module}.test.js`
- Framework: **Vitest** with `vi` for mocking
- Pattern: Mock `global.Lampa` inline, mock store with `vi.mock()`

### Test structure template

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// 1. Set up global mocks
global.Lampa = {
  SomeAPI: {
    method: vi.fn()
  },
  Lang: {
    translate: vi.fn((key) => key)  // or a map
  }
}

// 2. Mock local dependencies
vi.mock('../store', () => ({
  default: {
    someMethod: vi.fn()
  }
}))

// 3. Import module under test
import Module from '../module'

describe('Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should do something', () => {
    // arrange, act, assert
  })
})
```

### Key testing patterns

```javascript
// Mock return values
Store.getFolderCards.mockReturnValue({ results: [...], total_pages: 1 })

// Verify function was called with specific args
expect(Lampa.ContentRows.add).toHaveBeenCalledTimes(1)

// Test function references
expect(typeof config.call).toBe('function')

// Async setTimeout handling
comp.create()
await new Promise(resolve => setTimeout(resolve, 20))
expect(comp.build).toHaveBeenCalled()

// Dynamic imports for deferred module loading
const mod = await import('../drawer-hook')
```

## Language / i18n

Translation keys are prefixed with `cf_` (custom folders):

```javascript
Lampa.Lang.add({
  cf_key_name: {
    ru: 'Russian text',
    en: 'English text',
    uk: 'Ukrainian text'
  }
})
```

| Language | Code |
|----------|------|
| Russian | `ru` |
| English | `en` |
| Ukrainian | `uk` |

## Do's and Don'ts

### Do

- Use `var` (not `let`/`const`) for all local variables (codebase convention)
  - Exception: module-level constants use `const`
- Use plain functions (not arrow functions) for module exports
- Guard against missing Lampa APIs with `if (!...) return`
- Use `forEach` for array iteration
- Access localStorage fresh each time (no caching layer)
- Use `indexOf` for array membership checks (not `includes`)

### Don't

- Don't use classes — pure functions and objects only
- Don't use TypeScript — no type annotations
- Don't use Promises or async/await — use callbacks
- Don't use `let` or `const` for local function variables (use `var`)
- Don't use template literals — use string concatenation with `+`
- Don't use arrow functions in source code (tests may use them)
- Don't import with file extensions (no `./store.js`)
- Don't add semicolons after function declarations
