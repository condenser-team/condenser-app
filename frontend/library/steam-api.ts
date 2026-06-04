
import { getCondenser } from './condenser.js';

// Scans all webpack modules for CSS module objects (every value is a string),
// then merges them into a single semantic-name → minified-class map.
// First occurrence wins when two modules share a key.
// Cached after first resolution — call resetClasses() if the registry reloads.
let _cache: Record<string, string> | null = null;

function buildClasses(): Record<string, string> {
  if (_cache) return _cache;
  const registry = getCondenser().core.webpackRegistry;
  if (!registry) return {};

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
  return merged;
}

export function resetClasses(): void { _cache = null; }

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
