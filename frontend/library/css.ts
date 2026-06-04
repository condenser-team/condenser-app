
import { getCondenser } from './condenser.js';
import type { StyleEntry } from './types.js';

export type { StyleEntry };
export type CSSTarget = 'bpm' | 'qam' | 'main';

function getRegistry(): Map<string, StyleEntry> {
  const c = getCondenser() as any;
  c.stylesheets ??= new Map<string, StyleEntry>();
  return c.stylesheets;
}

function getTargetDocument(target: CSSTarget): Document {
  const pm = (window as any).g_PopupManager;
  if (!pm?.m_mapPopups) return document;

  if (target === 'bpm') {
    let found: Document | null = null;
    pm.m_mapPopups.forEach((popup: any) => {
      if (popup?.m_popup?.document?.title === 'Steam Big Picture Mode') found = popup.m_popup.document;
    });
    if (found) return found;
  }

  if (target === 'qam') {
    let found: Document | null = null;
    pm.m_mapPopups.forEach((popup: any, key: string) => {
      if (key.startsWith('QuickAccess')) found = popup?.m_popup?.document ?? null;
    });
    if (found) return found;
  }

  return document;
}

function makeId(pluginKey: string, index: number): string {
  return index === 0 ? `condenser-css-${pluginKey}` : `condenser-css-${pluginKey}-${index}`;
}

export interface StyleToggle {
  enable(): void;
  disable(): void;
  readonly enabled: boolean;
}

export function createStyleToggle(pluginKey: string, css: string, target: CSSTarget = 'bpm'): StyleToggle {
  let _enabled = false;
  let _cleanup: (() => void) | null = null;
  return {
    enable()  { if (!_enabled) { _cleanup = inject(pluginKey, css, target); _enabled = true; } },
    disable() { if (_enabled)  { _cleanup?.(); _cleanup = null; _enabled = false; } },
    get enabled() { return _enabled; },
  };
}

export function inject(pluginKey: string, css: string, target: CSSTarget = 'bpm'): () => void {
  const registry = getRegistry();

  // Warn when multiple plugins target the same window — not an error, just visibility.
  const peers = [...registry.values()]
    .filter(e => e.target === target && e.pluginKey !== pluginKey)
    .map(e => e.pluginKey);
  if (peers.length > 0) {
    console.info(`[condenser:css] ${pluginKey} and ${peers.join(', ')} are both targeting "${target}"`);
  }

  let index = 0;
  while (registry.has(makeId(pluginKey, index))) index++;
  const id = makeId(pluginKey, index);

  const doc = getTargetDocument(target);
  const el = doc.createElement('style');
  el.id = id;
  el.setAttribute('data-condenser-plugin', pluginKey);
  el.textContent = css;
  doc.head.appendChild(el);

  registry.set(id, { pluginKey, target, css, el });

  return () => {
    el.remove();
    registry.delete(id);
  };
}
