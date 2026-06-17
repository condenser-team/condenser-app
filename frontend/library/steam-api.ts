
import { getCondenser } from './condenser.js';

// Scans all webpack modules for CSS module objects (every value is a string),
// then merges them into a single semantic-name → minified-class map.
// First occurrence wins when two modules share a key.
// Cache is invalidated when the registry grows (handles early-access before all chunks load).
let _cache: Record<string, string> | null = null;
let _cacheRegistrySize = 0;

function buildClasses(): Record<string, string> {
  const registry = getCondenser().core.webpackRegistry;
  if (!registry) return {};

  // Return cached result only if the registry hasn't grown since the cache was built.
  if (_cache && registry.size === _cacheRegistrySize) return _cache;

  const merged: Record<string, string> = {};
  for (const mod of registry.values()) {
    if (!mod || typeof mod !== 'object' || (mod as any).__esModule) continue;
    const entries = Object.entries(mod as Record<string, unknown>);
    if (entries.length === 0) continue;
    if (!entries.every(([, v]) => typeof v === 'string')) continue;
    for (const [key, val] of entries) {
      if (!(key in merged)) merged[key] = val as string;
    }
  }

  _cache = merged;
  _cacheRegistrySize = registry.size;
  return merged;
}

export function resetClasses(): void { _cache = null; _cacheRegistrySize = 0; }

// Proxy so access is lazy — the webpack registry may not exist at import time.
export const classes: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_t, prop: string)  { return buildClasses()[prop]; },
  has(_t, prop: string)  { return prop in buildClasses(); },
  ownKeys()              { return Object.keys(buildClasses()); },
  getOwnPropertyDescriptor(_t, prop: string) {
    const val = buildClasses()[prop];
    return val === undefined ? undefined : { value: val, writable: false, enumerable: true, configurable: true };
  },
});
