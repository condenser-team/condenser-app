
import { getCondenser } from './condenser.js';
import type { CSSSource, CSSTarget, CSSTargetInput, CSSTargetSpec, StyleEntry, StyleProperties, StyleSheet } from './types.js';

export type { CSSSource, CSSTarget, CSSTargetInput, CSSTargetSpec, StyleEntry, StyleProperties, StyleSheet };

// ---- Target constants ----

/**
 * Injection targets for the Steam Big Picture Mode UI.
 *
 * ## Window targets (strings)
 * Inject globally into a CEF popup window — no CSS scoping applied.
 * Use these for changes that span an entire window (fonts, colours, animations).
 *
 *   `BigPicture`     — Main BPM window ("Steam Big Picture Mode")
 *   `MainMenu`       — Steam button overlay (STEAM / home button)
 *   `QuickAccess`    — Quick Access Menu (controller right-side button)
 *   `Keyboard`       — On-screen keyboard popup
 *   `OverlayBrowser` — In-game overlay browser (only while a game is running)
 *   `Global`         — BigPicture + MainMenu + QuickAccess simultaneously
 *
 * ## Section targets (CSSTargetSpec objects)
 * Each carries `{ window, scope }`. The `scope` is a `[class*="…"]` selector that
 * matches the section's root container, automatically constraining injected styles
 * so they cannot bleed into other areas of the UI.
 *
 * Steam class names follow the pattern `module_ClassName_HASH`. The selector uses
 * only the hash-independent `module_ClassName_` prefix so it survives Steam updates.
 *
 * @example
 * const { inject, createStyleToggle, Target } = condenser.css;
 *
 * // Whole BPM UI — fonts, global colours, border-radius:
 * inject(key, { fontFamily: 'Inter, sans-serif' }, Target.Global);
 *
 * // Library section only — CSS is scoped automatically:
 * createStyleToggle(key, { '.Panel': { borderRadius: '10px' } }, Target.Library);
 *
 * // Section root element directly:
 * inject(key, { backgroundColor: 'rgba(0,0,0,0.5)' }, Target.Home);
 */
export const Target = {
  // ---- Window targets (raw CEF popup identifiers) ----

  /** Main Big Picture Mode window. */
  BigPicture:     'big-picture',
  /** Steam button overlay (opened with the STEAM / home button). */
  MainMenu:       'main-menu',
  /** Quick Access Menu (opened with the controller right-side button). */
  QuickAccess:    'quick-access',
  /** On-screen keyboard popup. */
  Keyboard:       'keyboard',
  /** In-game overlay browser. Only present while a game is running. */
  OverlayBrowser: 'overlay-browser',
  /** Injects into BigPicture + MainMenu + QuickAccess simultaneously. */
  Global:         'global',

  // ---- Section targets (scoped to each BPM section's root element) ----
  //
  // Scope pattern: [class*="module_ClassName_"]
  // Steam generates class names as `module_ClassName_HASH`. The [class*="…"] substring
  // selector ignores the hash suffix so scopes stay valid across Steam updates.

  /** Recent-games / lock-screen background area. Scope: `gamepadhomerecentgames_RecentGamesBackground_*` */
  Background: { window: 'big-picture', scope: '[class*="gamepadhomerecentgames_RecentGamesBackground_"]' },

  /** Downloads tab (queue, progress bars, uninstalled list). Scope: `downloads_DownloadsPage_*` */
  Downloads:  { window: 'big-picture', scope: '[class*="downloads_DownloadsPage_"]' },

  /** Friends & Chat panel. Scope: `friendslist_FriendsChatsContainer_*` */
  Friends:    { window: 'big-picture', scope: '[class*="friendslist_FriendsChatsContainer_"]' },

  /** Home tab (Recent Games carousel + What's New feed). Scope: `gamepadhome_TabbedContent_*` */
  Home:       { window: 'big-picture', scope: '[class*="gamepadhome_TabbedContent_"]' },

  /** Library tab (game grid / list + app details). Scope: `gamepadlibrary_GamepadLibrary_*` */
  Library:    { window: 'big-picture', scope: '[class*="gamepadlibrary_GamepadLibrary_"]' },

  /** Lock screen overlay (shown when the device is locked). Scope: `lockscreen_Container_*` */
  LockScreen: { window: 'big-picture', scope: '[class*="lockscreen_Container_"]' },

  /** Media tab (screenshots, videos). Scope: `mediapage_MediaPage_*` */
  Media:      { window: 'big-picture', scope: '[class*="mediapage_MediaPage_"]' },

  /** Settings dialog. Scope: `gamepadpagedsettings_PagedSettingsDialog_*` */
  Settings:   { window: 'big-picture', scope: '[class*="gamepadpagedsettings_PagedSettingsDialog_"]' },

  /**
   * Steam Store — a separate CEF popup identified by URL (store.steampowered.com /
   * steamcommunity.com), not by a Steam class. Injects globally into that window.
   */
  Store:      { window: 'store', scope: ':root' },
} as const satisfies Record<string, CSSTargetInput>;

/** A resolved, single injectable window (no compound targets). */
type SingleTarget = 'big-picture' | 'quick-access' | 'main-menu' | 'keyboard' | 'overlay-browser' | 'store';

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
      // CSS custom properties (--foo) are left as-is; camelCase props are converted.
      const prop = k.startsWith('--') ? k : camelToKebab(k);
      return `  ${prop}: ${v};`;
    })
    .join('\n');
}

function isStyleSheet(source: StyleProperties | StyleSheet): source is StyleSheet {
  // StyleSheet has object values ({ selector: { prop: value } }).
  // StyleProperties has string/number values ({ prop: value }).
  const first = Object.values(source)[0];
  return first !== undefined && typeof first === 'object' && first !== null;
}

/**
 * Serialises a CSSSource (property bag or stylesheet) to a plain CSS string,
 * applying `scope` scoping where appropriate.
 *
 * - `StyleProperties` → generates `scope { prop: value; }` applied to the scope root
 * - `StyleSheet`      → serialises each rule then prefixes all selectors with `scope`
 *
 * When `scope` is absent or `':root'`, no selector prefixing is done.
 */
function serializeSource(source: CSSSource, scope: string | undefined): string {
  const scopeIsReal = !!scope && scope !== ':root';

  if (!isStyleSheet(source)) {
    // Flat property bag — apply directly to the scope root element.
    const host = scopeIsReal ? scope! : ':root';
    const body = serializeProps(source);
    return body ? `${host} {\n${body}\n}` : '';
  }

  // Stylesheet (selector → properties) — serialise then scope each rule.
  const rawCss = Object.entries(source)
    .map(([sel, props]) => {
      const body = serializeProps(props);
      return body ? `${sel} {\n${body}\n}` : '';
    })
    .filter(Boolean)
    .join('\n');
  return scopeIsReal ? scopeCss(rawCss, scope!) : rawCss;
}

// ---- CSS scoping ----

/**
 * Prefixes every CSS rule in `css` with `scope` so styles only affect descendants
 * of that selector. Handles @media/@supports (recurses), passes @keyframes and
 * @font-face through unchanged, and maps `:root` to the scope element itself.
 */
function scopeCss(css: string, scope: string): string {
  // Strip comments first to avoid brace counting errors.
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
        return `${scope} ${t}`;
      }).filter(Boolean).join(', ');
      result += `${prefixed} {${block}}\n`;
    }
  }

  return result;
}

// ---- Target resolution ----

function isCSSTargetSpec(t: CSSTargetInput): t is CSSTargetSpec {
  return typeof t === 'object' && !Array.isArray(t) && 'window' in t;
}

function resolveTargets(target: CSSTarget | readonly CSSTarget[]): SingleTarget[] {
  const raw = (Array.isArray(target) ? target : [target]) as CSSTarget[];
  const expanded = raw.flatMap((t): SingleTarget[] => {
    if (t === 'global') return ['big-picture', 'main-menu', 'quick-access'];
    return [t as SingleTarget];
  });
  return [...new Set(expanded)];
}

function normalizeInput(input: CSSTargetInput): { targets: SingleTarget[]; scope?: string } {
  if (isCSSTargetSpec(input)) {
    return { targets: resolveTargets(input.window), scope: input.scope };
  }
  return { targets: resolveTargets(input) };
}

function getTargetDocument(target: SingleTarget): Document {
  const pm = (window as any).g_PopupManager;
  if (!pm?.m_mapPopups) return document;

  let found: Document | null = null;

  pm.m_mapPopups.forEach((popup: any, key: string) => {
    if (found) return;
    const doc: Document | undefined = popup?.m_popup?.document;
    if (!doc) return;

    const url = popup?.m_popup?.location?.href ?? '';
    switch (target) {
      case 'big-picture':     if (doc.title === 'Steam Big Picture Mode') found = doc; break;
      case 'quick-access':    if (key.startsWith('QuickAccess'))    found = doc; break;
      case 'main-menu':       if (key.startsWith('MainMenu'))       found = doc; break;
      case 'keyboard':        if (key.startsWith('Keyboard'))       found = doc; break;
      case 'overlay-browser': if (key.startsWith('OverlayBrowser')) found = doc; break;
      // Store is a URL-matched popup (store.steampowered.com or steamcommunity.com).
      // This matches CSS Loader's "store" tab definition.
      case 'store':
        if (url.includes('store.steampowered.com') || url.includes('steamcommunity.com')) found = doc;
        break;
    }
  });

  return found ?? document;
}

function makeId(pluginKey: string, index: number): string {
  return index === 0 ? `condenser-css-${pluginKey}` : `condenser-css-${pluginKey}-${index}`;
}

// ---- Reinject watcher ----
// Module-level — resets cleanly on HMR so each fresh load reinstalls observers.
const watchedTargets = new Set<SingleTarget>();

function reinjectionAll(target: SingleTarget): void {
  const registry = getRegistry();
  const doc = getTargetDocument(target);
  // If the popup wasn't found, getTargetDocument falls back to the current document — skip.
  if (doc === document) return;
  for (const [id, entry] of registry.entries()) {
    if (entry.target !== target) continue;
    if (doc.getElementById(id)) continue;
    const el = doc.createElement('style');
    el.id = id;
    el.setAttribute('data-condenser-plugin', entry.pluginKey);
    el.textContent = entry.css;
    doc.head.appendChild(el);
    entry.el = el;
  }
}

function ensureReinjectWatcher(target: SingleTarget): void {
  if (watchedTargets.has(target)) return;

  const doc = getTargetDocument(target);
  if (doc === document) return;

  watchedTargets.add(target);

  const registry = getRegistry();

  const observer = new MutationObserver((records) => {
    const ours = new Set([...registry.keys()]);
    const anyRemoved = records.some((r) =>
      [...r.removedNodes].some((n) => n.nodeType === 1 && ours.has((n as Element).id)),
    );
    if (!anyRemoved) return;
    reinjectionAll(target);
  });
  observer.observe(doc.head, { childList: true });

  const win = doc.defaultView;
  if (win) {
    const onLoad = () => {
      observer.disconnect();
      watchedTargets.delete(target);
      ensureReinjectWatcher(target);
      reinjectionAll(target);
    };
    win.addEventListener('load', onLoad);
  }
}

// ---- Internal single-target inject ----

function injectOne(
  pluginKey: string,
  css: string,
  target: SingleTarget,
): { entry: StyleEntry; id: string; cleanup: () => void } {
  const registry = getRegistry();
  let index = 0;
  while (registry.has(makeId(pluginKey, index))) index++;
  const id = makeId(pluginKey, index);

  const doc = getTargetDocument(target);
  const el = doc.createElement('style');
  el.id = id;
  el.setAttribute('data-condenser-plugin', pluginKey);
  el.textContent = css;
  doc.head.appendChild(el);

  const entry: StyleEntry = { pluginKey, target, css, el };
  registry.set(id, entry);
  ensureReinjectWatcher(target);

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
  target: CSSTargetInput = Target.BigPicture,
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
  target: CSSTargetInput = Target.BigPicture,
): () => void {
  const { targets, scope } = normalizeInput(target);
  const effectiveCss = serializeSource(source, scope);

  const registry = getRegistry();
  const peers = [...registry.values()]
    .filter(e => (targets as string[]).includes(e.target) && e.pluginKey !== pluginKey)
    .map(e => e.pluginKey);
  if (peers.length > 0) {
    console.info(`[condenser:css] ${pluginKey} and ${[...new Set(peers)].join(', ')} both targeting "${targets.join('+')}"`);
  }

  const cleanups = targets.map(t => injectOne(pluginKey, effectiveCss, t).cleanup);
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
  target: CSSTargetInput = Target.BigPicture,
): StyleVars {
  const { targets, scope } = normalizeInput(target);

  function toCss(v: Record<string, string>): string {
    // CSS variables are declared on the scope root (or ':root' when global).
    const host = (scope && scope !== ':root') ? scope : ':root';
    const lines = Object.entries(v)
      .map(([k, val]) => `  ${k.startsWith('--') ? k : `--${k}`}: ${val};`)
      .join('\n');
    return `${host} {\n${lines}\n}`;
  }

  const css = toCss(vars);
  const handles = targets.map(t => injectOne(pluginKey, css, t));

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
