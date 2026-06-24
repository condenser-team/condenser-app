
import { getCondenser } from './condenser.js';
import { Window } from './types.js';
import type { CSSSource, StyleEntry, StyleProperties, StyleSheet, TargetDef } from './types.js';

export { Window };
export type { CSSSource, StyleEntry, StyleProperties, StyleSheet, TargetDef };

// ---- Target constants ----

/**
 * Builds a CSS scope selector by looking up class name(s) from the webpack CSS module
 * registry at call time. Falls back to a SteamOS-style prefix selector when the
 * registry is not yet available or returns no results.
 *
 * On macOS, Steam CSS class names are pure hashes (no module prefix). On SteamOS they
 * follow `module_ClassName_HASH`. This helper handles both cases.
 */
function buildSectionScope(semanticKeys: readonly string[], steamOsFallback: string): string {
  try {
    const classes = getCondenser().steam.classes;
    const parts = semanticKeys
      .map(k => classes[k])
      .filter((c): c is string => typeof c === 'string' && c.length > 0)
      .map(c => `[class*="${c}"]`);
    if (parts.length > 0) return parts.join(', ');
  } catch (_) {}
  return steamOsFallback;
}

/** Convenience constructor so each Target entry stays on one line. */
function t(windows: Window[], scope: string): TargetDef {
  return { windows, scope };
}

/**
 * Injection targets for the Steam UI.
 *
 * Each entry maps a semantic Steam UI feature to the CEF window(s) and CSS scope
 * selector needed to style it. Pass a `Target.*` value to `inject()` or
 * `createStyleToggle()` — the routing details are handled internally.
 *
 * @example
 * const { createStyleToggle, Target } = condenser.css;
 *
 * // Monospace font across all main windows:
 * createStyleToggle(key, { fontFamily: 'monospace' }, Target.Global);
 *
 * // Coloured outline on the Library tab:
 * createStyleToggle(key, { boxShadow: 'inset 0 0 0 3px #ce93d8' }, Target.Library);
 */
export const Target = {
  /** Injects into body of BigPicture + MainMenu + QuickAccess simultaneously. */
  Global:         t([Window.BigPicture, Window.MainMenu, Window.QuickAccess], 'body'),
  /** BPM header bar (clock and system tray strip). */
  Header:         t([Window.BigPicture], '#header'),
  /** Quick Access Menu panel. */
  QuickAccess:    t([Window.QuickAccess], '#QuickAccess-Menu'),
  /** Steam button overlay (Main Menu). */
  MainMenu:       t([Window.MainMenu], 'body'),
  /** On-screen keyboard popup. */
  Keyboard:       t([Window.Keyboard], 'body'),
  /** In-game overlay browser (only present while a game is running). */
  OverlayBrowser: t([Window.OverlayBrowser], 'body'),

  /** Recent-games / lock-screen background area. */
  Background: t([Window.BigPicture], '[class*="gamepadhomerecentgames_RecentGamesBackground_"]'),
  /** Game detail page scrollable body. */
  GameDetail:  t([Window.BigPicture], '[class*="_3lDczhulqraStjCitLYJ1K"]'),
  /** Lock screen overlay. */
  LockScreen:  t([Window.BigPicture], '[class*="lockscreen_Container_"]'),
  /** Media tab (screenshots, videos). */
  Media:       t([Window.BigPicture], '[class*="mediapage_MediaPage_"]'),
  /** Settings dialog — targets the Panel children to avoid the flex root hiding inset shadows. */
  Settings:    t([Window.BigPicture], '[class*="_33vqr13-jdnjTkKKTh414f"] > .Panel'),

  /** Downloads tab. Scope resolved at runtime from webpack. */
  get Downloads(): TargetDef {
    return t([Window.BigPicture], buildSectionScope(['DownloadsPage'], '[class*="downloads_DownloadsPage_"]'));
  },
  /** Friends & Chat panel. Scope resolved at runtime from webpack. */
  get Friends(): TargetDef {
    return t([Window.BigPicture], buildSectionScope(['FriendsChatsContainer'], '[class*="friendslist_FriendsChatsContainer_"]'));
  },
  /** Home tab (Recent Games carousel + What's New feed). Scope resolved at runtime from webpack. */
  get Home(): TargetDef {
    return t([Window.BigPicture], buildSectionScope(['BackstackRootTest'], '[class*="gamepadhome_BackstackRootTest_"]'));
  },
  /** Library tab (game grid / list). Scope resolved at runtime from webpack. */
  get Library(): TargetDef {
    return t([Window.BigPicture], buildSectionScope(['GamepadLibrary', 'Library'], '[class*="gamepadlibrary_GamepadLibrary_"]'));
  },
} satisfies Record<string, TargetDef>;

export type TargetType = typeof Target;

// ---- Registry ----

function getRegistry(): Map<string, StyleEntry> {
  const c = getCondenser() as any;
  c.stylesheets ??= new Map<string, StyleEntry>();
  return c.stylesheets;
}

// ---- CSS serialization ----

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
}

function serializeProps(props: StyleProperties): string {
  return Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => {
      const prop = k.startsWith('--') ? k : camelToKebab(k);
      return `  ${prop}: ${v};`;
    })
    .join('\n');
}

function isStyleSheet(source: StyleProperties | StyleSheet): source is StyleSheet {
  const first = Object.values(source)[0];
  return first !== undefined && typeof first === 'object' && first !== null;
}

/**
 * Serialises a CSSSource to a plain CSS string scoped to `scope`.
 * - `StyleProperties` → `scope { prop: value; }`
 * - `StyleSheet`      → each rule prefixed with `scope`
 */
function serializeSource(source: CSSSource, scope: string): string {
  if (!isStyleSheet(source)) {
    const body = serializeProps(source);
    return body ? `${scope} {\n${body}\n}` : '';
  }
  const rawCss = Object.entries(source)
    .map(([sel, props]) => {
      const body = serializeProps(props);
      return body ? `${sel} {\n${body}\n}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return scopeCss(rawCss, scope);
}

// ---- CSS scoping ----

/**
 * Prefixes every CSS rule in `css` with `scope`. Handles @media/@supports (recurses),
 * passes @keyframes and @font-face through unchanged, maps `:root` to the scope element.
 */
function scopeCss(css: string, scope: string): string {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let result = '';
  let i = 0;

  while (i < src.length) {
    let selectorEnd = i;
    while (selectorEnd < src.length && src[selectorEnd] !== '{') selectorEnd++;
    if (selectorEnd >= src.length) { result += src.slice(i); break; }

    const rawSelector = src.slice(i, selectorEnd);
    const selector = rawSelector.trim();
    i = selectorEnd + 1;

    let depth = 1;
    const blockStart = i;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const block = src.slice(blockStart, i - 1);

    if (!selector) continue;

    if (/^@(keyframes|font-face|charset|import|namespace)\b/i.test(selector)) {
      result += `${rawSelector}{\n${block}}\n`;
    } else if (/^@/.test(selector)) {
      result += `${rawSelector}{\n${scopeCss(block, scope)}}\n`;
    } else {
      const prefixed = selector.split(',').map(s => {
        const t = s.trim();
        if (!t) return '';
        if (t === ':root') return scope;
        if (t.startsWith('::')) return `${scope}${t}`;
        return `${scope} ${t}`;
      }).filter(Boolean).join(', ');
      result += `${prefixed} {${block}}\n`;
    }
  }

  return result;
}

// ---- Window routing ----

function getTargetDocument(window: Window): Document {
  const pm = (globalThis as any).g_PopupManager;
  if (!pm?.m_mapPopups) return document;

  let found: Document | null = null;
  let bpmWindow: any = null;

  pm.m_mapPopups.forEach((popup: any, key: string) => {
    if (found) return;
    const doc: Document | undefined = popup?.m_popup?.document;
    if (!doc) return;

    const url = popup?.m_popup?.location?.href ?? '';
    switch (window) {
      case Window.BigPicture:
        if (doc.title === 'Steam Big Picture Mode') { found = doc; break; }
        if (key.startsWith('SP Desktop_') && doc.title === 'Steam') found = doc;
        break;
      case Window.QuickAccess:    if (key.startsWith('QuickAccess'))    found = doc; break;
      case Window.MainMenu:       if (key.startsWith('MainMenu'))       found = doc; break;
      case Window.Keyboard:        if (key.startsWith('Keyboard'))       found = doc; break;
      case Window.OverlayBrowser: if (key.startsWith('OverlayBrowser')) found = doc; break;
      case Window.Store:
        if (url.includes('store.steampowered.com') || url.includes('steamcommunity.com')) found = doc;
        break;
    }

    if (doc.title === 'Steam Big Picture Mode' || (key.startsWith('SP Desktop_') && doc.title === 'Steam')) {
      bpmWindow = popup?.m_popup;
    }
  });

  // On macOS BPM, QAM and MainMenu are browser-view popups reached via named window references.
  if (!found && bpmWindow && (window === Window.QuickAccess || window === Window.MainMenu)) {
    const browserId: number | undefined = bpmWindow.SteamClient?.Browser?.GetBrowserID?.();
    if (browserId) {
      const name = window === Window.QuickAccess ? `QuickAccess_uid${browserId}` : `MainMenu_uid${browserId}`;
      const win = globalThis.open('', name) as (typeof globalThis) | null;
      if (win && win !== (globalThis as any)) {
        if (win.document?.title === name) {
          found = win.document;
        } else {
          try { win.close(); } catch (_) {}
        }
      }
    }
  }

  return found ?? document;
}

// ---- ID helpers ----

function makeId(pluginKey: string, index: number): string {
  return index === 0 ? `condenser-css-${pluginKey}` : `condenser-css-${pluginKey}-${index}`;
}

// ---- Reinject watcher ----

const watchedWindows = new Set<Window>();
const pendingWindows = new Set<Window>();
let _pendingPoll: ReturnType<typeof setInterval> | null = null;

function startPendingPoll(): void {
  if (_pendingPoll) return;
  _pendingPoll = setInterval(() => {
    for (const win of pendingWindows) {
      const doc = getTargetDocument(win);
      if (doc === document) continue;
      reinjectionAll(win);
      ensureReinjectWatcher(win);
      pendingWindows.delete(win);
    }
    if (pendingWindows.size === 0) {
      clearInterval(_pendingPoll!);
      _pendingPoll = null;
    }
  }, 500);
}

function reinjectionAll(win: Window): void {
  const registry = getRegistry();
  const doc = getTargetDocument(win);
  if (doc === document) return;
  for (const [id, entry] of registry.entries()) {
    if (entry.target !== win) continue;
    if (doc.getElementById(id)) continue;
    const el = doc.createElement('style');
    el.id = id;
    el.setAttribute('data-condenser-plugin', entry.pluginKey);
    el.textContent = entry.css;
    doc.head.appendChild(el);
    entry.el = el;
  }
}

function ensureReinjectWatcher(win: Window): void {
  if (watchedWindows.has(win)) return;

  const doc = getTargetDocument(win);
  if (doc === document) {
    pendingWindows.add(win);
    startPendingPoll();
    return;
  }

  watchedWindows.add(win);
  const registry = getRegistry();

  const observer = new MutationObserver((records) => {
    const ours = new Set([...registry.keys()]);
    const anyRemoved = records.some((r) =>
      [...r.removedNodes].some((n) => n.nodeType === 1 && ours.has((n as Element).id)),
    );
    if (!anyRemoved) return;
    reinjectionAll(win);
  });
  observer.observe(doc.head, { childList: true });

  const view = doc.defaultView;
  if (view) {
    view.addEventListener('load', () => {
      observer.disconnect();
      watchedWindows.delete(win);
      ensureReinjectWatcher(win);
      reinjectionAll(win);
    });
  }
}

// ---- Internal single-window inject ----

function injectOne(
  pluginKey: string,
  css: string,
  win: Window,
): { entry: StyleEntry; id: string; cleanup: () => void } {
  const registry = getRegistry();
  let index = 0;
  while (registry.has(makeId(pluginKey, index))) index++;
  const id = makeId(pluginKey, index);

  const doc = getTargetDocument(win);
  const el = doc.createElement('style');
  el.id = id;
  el.setAttribute('data-condenser-plugin', pluginKey);
  el.textContent = css;
  if (doc !== document) doc.head.appendChild(el);

  const entry: StyleEntry = { pluginKey, target: win, css, el };
  registry.set(id, entry);
  ensureReinjectWatcher(win);

  return { entry, id, cleanup: () => { entry.el.remove(); registry.delete(id); } };
}

// ---- StyleToggle ----

export interface StyleToggle {
  enable(): void;
  disable(): void;
  readonly enabled: boolean;
}

export function createStyleToggle(
  pluginKey: string,
  source: CSSSource,
  target: TargetDef,
): StyleToggle {
  let _enabled = false;
  let _cleanup: (() => void) | null = null;
  return {
    enable()  { if (!_enabled) { _cleanup = inject(pluginKey, source, target); _enabled = true; } },
    disable() { if (_enabled)  { _cleanup?.(); _cleanup = null; _enabled = false; } },
    get enabled() { return _enabled; },
  };
}

// ---- inject ----

export function inject(
  pluginKey: string,
  source: CSSSource,
  target: TargetDef,
): () => void {
  const { windows, scope } = target;
  const effectiveCss = serializeSource(source, scope);

  const registry = getRegistry();
  const peers = [...registry.values()]
    .filter(e => windows.includes(e.target as Window) && e.pluginKey !== pluginKey)
    .map(e => e.pluginKey);
  if (peers.length > 0) {
    console.info(`[condenser:css] ${pluginKey} and ${[...new Set(peers)].join(', ')} both targeting "${windows.join('+')}"`);
  }

  const cleanups = windows.map(w => injectOne(pluginKey, effectiveCss, w).cleanup);
  return () => cleanups.forEach(c => c());
}

// ---- createStyleVars ----

export interface StyleVars {
  update(vars: Record<string, string>): void;
  remove(): void;
}

export function createStyleVars(
  pluginKey: string,
  vars: Record<string, string>,
  target: TargetDef,
): StyleVars {
  const { windows, scope } = target;

  function toCss(v: Record<string, string>): string {
    const lines = Object.entries(v)
      .map(([k, val]) => `  ${k.startsWith('--') ? k : `--${k}`}: ${val};`)
      .join('\n');
    return `${scope} {\n${lines}\n}`;
  }

  const css = toCss(vars);
  const handles = windows.map(w => injectOne(pluginKey, css, w));

  return {
    update(newVars: Record<string, string>): void {
      const newCss = toCss(newVars);
      for (const { entry } of handles) {
        entry.css = newCss;
        entry.el.textContent = newCss;
      }
    },
    remove(): void {
      for (const { entry, id } of handles) {
        entry.el.remove();
        getRegistry().delete(id);
      }
    },
  };
}
