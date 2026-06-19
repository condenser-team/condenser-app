
import { getCondenser } from './condenser.js';
import type { CSSSource, CSSTarget, CSSTargetInput, CSSTargetSpec, StyleEntry, StyleProperties, StyleSheet } from './types.js';

export type { CSSSource, CSSTarget, CSSTargetInput, CSSTargetSpec, StyleEntry, StyleProperties, StyleSheet };

// ---- Target constants ----

/**
 * Injection targets for the Steam UI.
 *
 * ## Window targets (strings)
 * Inject globally into a CEF popup window — no CSS scoping applied.
 * Use these for changes that span an entire window (fonts, colours, animations).
 *
 *   `BigPicture`     — Main Steam window (BPM or Desktop)
 *   `MainMenu`       — Steam button overlay / STEAM button (BPM only)
 *   `QuickAccess`    — Quick Access Menu / controller right-side button (BPM only)
 *   `Keyboard`       — On-screen keyboard popup
 *   `OverlayBrowser` — In-game overlay browser (only while a game is running)
 *   `Global`         — BigPicture + MainMenu + QuickAccess simultaneously
 *
 * ## Section targets (CSSTargetSpec objects)
 * Each carries `{ window, scope }`. The `scope` selector constrains injected styles
 * to a specific section's root container.
 *
 * On SteamOS class names follow `module_ClassName_HASH`; on Desktop/macOS they are
 * pure hashes. Section targets resolve the correct class name at runtime from the
 * webpack bundle so they work on both platforms.
 *
 * @example
 * const { inject, createStyleToggle, Target } = condenser.css;
 *
 * // Whole main Steam window — fonts, global colours, border-radius:
 * inject(key, { fontFamily: 'Inter, sans-serif' }, Target.BigPicture);
 *
 * // Library section only — CSS is scoped automatically:
 * createStyleToggle(key, { '.Panel': { borderRadius: '10px' } }, Target.Library);
 *
 * // Section root element directly:
 * inject(key, { backgroundColor: 'rgba(0,0,0,0.5)' }, Target.Home);
 */

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

export const Target = {
  // ---- Window targets (raw CEF popup identifiers) ----

  /** Main Steam window — BPM ("Steam Big Picture Mode") or Desktop ("Steam"). */
  BigPicture:     'big-picture' as const,
  /** Steam button overlay (opened with the STEAM / home button). BPM only. */
  MainMenu:       'main-menu' as const,
  /** Quick Access Menu (opened with the controller right-side button). BPM only. */
  QuickAccess:    'quick-access' as const,
  /** On-screen keyboard popup. */
  Keyboard:       'keyboard' as const,
  /** In-game overlay browser. Only present while a game is running. */
  OverlayBrowser: 'overlay-browser' as const,
  /** Injects into BigPicture + MainMenu + QuickAccess simultaneously. */
  Global:         'global' as const,

  // ---- Section targets (scoped to each section's root element) ----
  //
  // Scope selectors are resolved at call time from the webpack CSS module registry.
  // This handles both SteamOS (module_ClassName_HASH) and macOS (pure hash) class formats.

  /** Recent-games / lock-screen background area. */
  Background: { window: 'big-picture' as const, scope: '[class*="gamepadhomerecentgames_RecentGamesBackground_"]' },

  /** Downloads tab (queue, progress bars, uninstalled list). Scope resolved at runtime from webpack. */
  get Downloads(): CSSTargetSpec {
    return { window: 'big-picture', scope: buildSectionScope(['DownloadsPage'], '[class*="downloads_DownloadsPage_"]') };
  },

  /** Friends & Chat panel. Scope resolved at runtime from webpack. */
  get Friends(): CSSTargetSpec {
    return { window: 'big-picture', scope: buildSectionScope(['FriendsChatsContainer'], '[class*="friendslist_FriendsChatsContainer_"]') };
  },

  /** Home tab (Recent Games carousel + What's New feed). Scope resolved at runtime from webpack. */
  get Home(): CSSTargetSpec {
    return { window: 'big-picture', scope: buildSectionScope(['BackstackRootTest'], '[class*="gamepadhome_BackstackRootTest_"]') };
  },

  /** Game detail page scrollable body (the content column when viewing a game). */
  GameDetail: { window: 'big-picture' as const, scope: '[class*="_3lDczhulqraStjCitLYJ1K"]' },

  /** Library tab (game grid / list + app details). Scope resolved at runtime from webpack. */
  get Library(): CSSTargetSpec {
    return { window: 'big-picture', scope: buildSectionScope(['GamepadLibrary', 'Library'], '[class*="gamepadlibrary_GamepadLibrary_"]') };
  },

  /** Lock screen overlay (shown when the device is locked). */
  LockScreen: { window: 'big-picture' as const, scope: '[class*="lockscreen_Container_"]' },

  /** Media tab (screenshots, videos). */
  Media:      { window: 'big-picture' as const, scope: '[class*="mediapage_MediaPage_"]' },

  /** Settings dialog — full page including the left nav menu. Uses :has(.PageListColumn) to
   *  distinguish the inner-width wrapper that contains both columns from the one that wraps
   *  just the content panel. :has() is supported in Steam's CEF (Chrome 105+). */
  get Settings(): CSSTargetSpec {
    return { window: 'big-picture', scope: '.DialogContent_InnerWidth:has(.PageListColumn)' };
  },

  /**
   * Steam Store — a separate CEF popup identified by URL (store.steampowered.com /
   * steamcommunity.com), not by a Steam class. Injects globally into that window.
   */
  Store:      { window: 'store' as const, scope: ':root' },
} satisfies Record<string, CSSTargetInput>;

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
        if (t.startsWith('::')) return `${scope}${t}`;
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
  let bpmWindow: any = null;

  pm.m_mapPopups.forEach((popup: any, key: string) => {
    if (found) return;
    const doc: Document | undefined = popup?.m_popup?.document;
    if (!doc) return;

    const url = popup?.m_popup?.location?.href ?? '';
    switch (target) {
      case 'big-picture':
        // BPM mode (SteamOS or macOS with -gamepadui): title is "Steam Big Picture Mode", key "SP BPM_*"
        if (doc.title === 'Steam Big Picture Mode') { found = doc; break; }
        // Desktop mode (macOS): main window has key "SP Desktop_*" and title "Steam"
        if (key.startsWith('SP Desktop_') && doc.title === 'Steam') found = doc;
        break;
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

    // Track the BPM window so we can use its BrowserID for the browser-view fallback below.
    if (doc.title === 'Steam Big Picture Mode' || (key.startsWith('SP Desktop_') && doc.title === 'Steam')) {
      bpmWindow = popup?.m_popup;
    }
  });

  // On macOS BPM mode, QAM and MainMenu are browser-view popups opened via window.open()
  // from the BPM window — they never appear in g_PopupManager.  Use the named-window
  // reference (name = "<Type>_uid<BPMBrowserID>") to reach their documents.
  if (!found && bpmWindow && (target === 'quick-access' || target === 'main-menu')) {
    const browserId: number | undefined = bpmWindow.SteamClient?.Browser?.GetBrowserID?.();
    if (browserId) {
      const name = target === 'quick-access' ? `QuickAccess_uid${browserId}` : `MainMenu_uid${browserId}`;
      const win = window.open('', name) as (Window & typeof globalThis) | null;
      if (win && win !== (window as any)) {
        if (win.document?.title === name) {
          // Window exists and has content — use it.
          found = win.document;
        } else {
          // window.open() created a blank phantom window that would block Steam from
          // opening the real popup under this name — close it immediately.
          try { win.close(); } catch (_) {}
        }
      }
    }
  }

  return found ?? document;
}

function makeId(pluginKey: string, index: number): string {
  return index === 0 ? `condenser-css-${pluginKey}` : `condenser-css-${pluginKey}-${index}`;
}

// ---- Reinject watcher ----
// Module-level — resets cleanly on HMR so each fresh load reinstalls observers.
const watchedTargets = new Set<SingleTarget>();

// Targets whose popup wasn't open at inject time — polled until the popup appears.
const pendingTargets = new Set<SingleTarget>();
let _pendingPoll: ReturnType<typeof setInterval> | null = null;

function startPendingPoll(): void {
  if (_pendingPoll) return;
  _pendingPoll = setInterval(() => {
    for (const target of pendingTargets) {
      const doc = getTargetDocument(target);
      if (doc === document) continue; // Still not open
      reinjectionAll(target);
      ensureReinjectWatcher(target);
      pendingTargets.delete(target);
    }
    if (pendingTargets.size === 0) {
      clearInterval(_pendingPoll!);
      _pendingPoll = null;
    }
  }, 500);
}

function reinjectionAll(target: SingleTarget): void {
  const registry = getRegistry();
  const doc = getTargetDocument(target);
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
  if (doc === document) {
    // Popup not open yet — poll until it appears.
    pendingTargets.add(target);
    startPendingPoll();
    return;
  }

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

  // Create the element and inject immediately only if the popup is open.
  // If not (doc falls back to current document), store in registry without injecting —
  // ensureReinjectWatcher will start a poll and inject via reinjectionAll when the popup appears.
  const el = doc.createElement('style');
  el.id = id;
  el.setAttribute('data-condenser-plugin', pluginKey);
  el.textContent = css;
  if (doc !== document) doc.head.appendChild(el);

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
