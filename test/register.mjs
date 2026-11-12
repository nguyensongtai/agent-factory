// Lets `node --test` run the app's TypeScript sources without a bundler or extra dependency:
// - extensionless relative imports and the `@/` alias resolve to .ts files, as Next's bundler does;
// - `server-only` resolves to a no-op, since the real package throws outside a React Server bundle;
// - .ts files load as ES modules and Node strips their types (needs Node >= 22.18).
import { existsSync, statSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = new URL('../src/', import.meta.url)
const EXTENSIONS = ['.ts', '.tsx', '/index.ts']

function withExtension(url) {
  const file = fileURLToPath(url)
  if (existsSync(file) && statSync(file).isFile()) return url
  for (const ext of EXTENSIONS) if (existsSync(file + ext)) return pathToFileURL(file + ext).href

  return null
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true }
    let target = null
    if (specifier.startsWith('@/')) target = new URL(specifier.slice(2), SRC).href
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      target = new URL(specifier, context.parentURL).href
    }
    const url = target && withExtension(target)
    if (!url) return nextResolve(specifier, context)

    return { url, shortCircuit: true }
  },
  // The package has no "type" field; say up front that our .ts files are ES modules.
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) return nextLoad(url, { ...context, format: 'module-typescript' })

    return nextLoad(url, context)
  },
})
