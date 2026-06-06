import type * as ReactModule from 'react';

export interface StyleEntry {
  pluginKey: string;
  target: string;
  css: string;
  el: HTMLStyleElement;
}

/**
 * CSS properties as a camelCase JavaScript object — the same notation as inline
 * `element.style` or React's `style` prop.
 *
 * Keys are camelCase CSS property names (`borderRadius`, `backgroundColor`) or
 * CSS custom properties starting with `--`.  Values are strings or numbers
 * (numbers are passed through as-is, e.g. `10` → `"10"` in the output CSS).
 *
 * @example
 * const style: StyleProperties = {
 *   borderRadius: '10px',
 *   color: 'white',
 *   '--my-accent': '#4fc3f7',
 * };
 */
export type StyleProperties = Record<string, string | number>;

/**
 * A map of CSS selectors to property bags — analogous to a CSS stylesheet.
 * Each key is a CSS selector; the value is a `StyleProperties` object.
 *
 * When passed to `inject()` / `createStyleToggle()` with a section target,
 * every selector is automatically prefixed with the section's scope selector.
 *
 * @example
 * const sheet: StyleSheet = {
 *   '.Panel':  { borderRadius: '10px', overflow: 'hidden' },
 *   '.Header': { color: 'white', fontSize: '16px' },
 * };
 */
export type StyleSheet = Record<string, StyleProperties>;

/**
 * CSS source accepted by `inject`, `createStyleToggle`, etc.
 *
 * - `StyleProperties` — flat property bag applied to the target section's root element,
 *   e.g. `{ borderRadius: '10px', color: 'white' }`
 * - `StyleSheet`      — map of CSS selector → property bag; each selector is automatically
 *   scoped to the target section when a section target is used,
 *   e.g. `{ '.Panel': { borderRadius: '10px' }, '.Header': { color: 'white' } }`
 */
export type CSSSource = StyleProperties | StyleSheet;

/**
 * CSS injection target. Use the Target constants from condenser.css for discoverability.
 *
 * Real injectable windows (each is a separate CEF popup):
 *   'big-picture'     — Main BPM window (matched by title "Steam Big Picture Mode")
 *   'main-menu'       — Steam button overlay (STEAM button; popup key starts with "MainMenu")
 *   'quick-access'    — Quick Access Menu (controller button; popup key starts with "QuickAccess")
 *   'keyboard'        — On-screen keyboard popup
 *   'overlay-browser' — In-game overlay browser (only while a game runs)
 *   'store'           — Steam Store popup (URL-matched: store.steampowered.com or steamcommunity.com)
 *
 * Compound (expands to multiple windows on inject):
 *   'global' — big-picture + main-menu + quick-access
 */
export type CSSTarget =
  | 'big-picture' | 'quick-access' | 'main-menu' | 'keyboard' | 'overlay-browser' | 'store'
  | 'global';

/**
 * Scoped injection target — injects into a window AND auto-prefixes every CSS rule
 * with a selector so styles only affect the specified parent element.
 *
 * @example
 * const { inject, Target } = condenser.css;
 * const libraryClass = condenser.steam.classes['libraryRoot'];
 *
 * // Only affects elements inside the Library container:
 * const cleanup = inject(key,
 *   { '.Panel': { borderRadius: '10px' } },
 *   { window: Target.BigPicture, scope: '.libraryRoot' },
 * );
 */
export interface CSSTargetSpec {
  /** Which CEF window(s) to inject into. Accepts any CSSTarget value or array. */
  window: CSSTarget | readonly CSSTarget[];
  /** CSS selector prepended to every rule in the stylesheet. ':root' maps to this selector. */
  scope: string;
}

/** All accepted forms for the target parameter on inject / createStyleToggle / createStyleVars. */
export type CSSTargetInput = CSSTarget | readonly CSSTarget[] | CSSTargetSpec;

export interface PluginComponent {
  key: string;
  title?: string;
  // QAM surface: plugin exports Tab + Panel
  tab?: (R: typeof ReactModule) => ReactModule.ReactNode;
  panel?: ReactModule.ComponentType<{ websocketUrl: string }>;
  // BPM surface: plugin exports Page + route
  route?: string;
  page?: ReactModule.ComponentType<{ websocketUrl: string }>;
  // Persistent surface: plugin exports Persistent (rendered on every page)
  persistent?: ReactModule.ComponentType<{ websocketUrl: string }>;
  // Lifecycle hooks — called by Condenser, not by plugin code directly
  onMount?:   () => void;
  onUnmount?: () => void;
}

export interface PluginNamespace {
  component?: PluginComponent;
  forceUpdaters?: Set<() => void>;
}

export interface CondenserCore {
  ws: WebSocket | null;
  url: string;
  callSeq: number;
  pendingCalls: Map<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>;
  csrfToken: string;
  React: typeof ReactModule;
  ReactDOM: { createRoot: (el: Element) => { render: (node: ReactModule.ReactNode) => void } };
  webpackRegistry: Map<string, unknown>;
  quickAccessMenuRenderer: { type: unknown } | null;
  tabPatched: boolean;
  patchedTypeCache: Map<unknown, unknown>;
  router: { Navigate: (path: string) => void } | null;
  pagePatched: boolean;
  booted: boolean;
  showModal?: (content: unknown, title?: string) => void;
}

export interface CondenserNamespace {
  core: Partial<CondenserCore>;
  components: Record<string, PluginNamespace>;
  stylesheets: Map<string, StyleEntry>;
  // Public API modules — exposed on the window so plugins can call them without bundling logic.
  nav: {
    navigate(path: string): void;
    back(): void;
    openQAM(): void;
    openSideMenu(): void;
    closeSideMenus(): void;
  };
  css: {
    /**
     * Injection targets for the Steam Big Picture Mode UI.
     *
     * **Window targets** (strings) — inject globally into a CEF popup window:
     *   `BigPicture`, `MainMenu`, `QuickAccess`, `Keyboard`, `OverlayBrowser`, `Global`
     *
     * **Section targets** (`CSSTargetSpec`) — carry `{ window, scope }` automatically.
     * The `scope` is a `[class*="..."]` selector that constrains injected CSS to only
     * that section's root container (Library styles cannot bleed into Settings, etc.):
     *   `Background`, `Downloads`, `Friends`, `Home`, `Library`, `LockScreen`,
     *   `Media`, `Settings`, `Store`
     */
    Target: {
      // ---- Window targets (raw CEF popup identifiers) ----
      readonly BigPicture:     'big-picture';
      readonly MainMenu:       'main-menu';
      readonly QuickAccess:    'quick-access';
      readonly Keyboard:       'keyboard';
      readonly OverlayBrowser: 'overlay-browser';
      readonly Global:         'global';
      // ---- Section targets (scoped to BPM section root via [class*="..."] selector) ----
      readonly Background: CSSTargetSpec;
      readonly Downloads:  CSSTargetSpec;
      readonly Friends:    CSSTargetSpec;
      readonly Home:       CSSTargetSpec;
      readonly Library:    CSSTargetSpec;
      readonly LockScreen: CSSTargetSpec;
      readonly Media:      CSSTargetSpec;
      readonly Settings:   CSSTargetSpec;
      readonly Store:      CSSTargetSpec;
    };
    /**
     * Inject styles into a target window/section and return a cleanup function.
     *
     * `source` accepts:
     * - `StyleProperties` — `{ borderRadius: '10px' }` — applied to the section root element
     * - `StyleSheet`      — `{ '.Panel': { borderRadius: '10px' } }` — each rule scoped to section
     *
     * When a section target (e.g. `Target.Library`) is used, styles are automatically
     * constrained to that section and cannot affect other parts of the UI.
     */
    inject(pluginKey: string, source: CSSSource, target?: CSSTargetInput): () => void;
    /** Create an enable/disable toggle for a style injection. Same source types as `inject()`. */
    createStyleToggle(pluginKey: string, source: CSSSource, target?: CSSTargetInput): {
      enable(): void;
      disable(): void;
      readonly enabled: boolean;
    };
    /**
     * Create a set of CSS custom properties (variables) that can be updated live.
     * Variables are injected as a `:root { --key: value; }` block (or scoped to the
     * target section's root when a section target with a real scope is used).
     */
    createStyleVars(pluginKey: string, vars: Record<string, string>, target?: CSSTargetInput): {
      update(vars: Record<string, string>): void;
      remove(): void;
    };
  };
  ui: {
    showToast(options: { title: string; body?: string; duration?: number; sound?: number; playSound?: boolean; critical?: boolean }): void;
    showModal(content: any, parent?: EventTarget, options?: { strTitle?: string }): void;
    showContextMenu(children: any, parent?: EventTarget): void;
    Focusable(props: Record<string, unknown>): any;
    SidebarNavigation(props: Record<string, unknown>): any;
    Tabs(props: Record<string, unknown>): any;
    Menu(props: { label: string; children?: any }): any;
    MenuItem(props: { onClick?: () => void; children?: any }): any;
    cls: {
      readonly btnSecondary: string;
      readonly btnPrimary:   string;
      readonly textInput:    string;
      readonly inputWrapper: string;
      readonly focusable:    string;
    };
  };
  events: {
    UIMode: { readonly Unknown: -1; readonly GamePad: 4; readonly Desktop: 7 };
    getUIMode(): Promise<-1 | 4 | 7 | null>;
    onUIModeChanged(handler: (mode: -1 | 4 | 7) => void): () => void;
    useQAMVisible(): boolean;
  };
  plugin: {
    useSend(pluginId: string): (action: string, data?: unknown) => Promise<unknown>;
    useMessage(pluginId: string, event: string, handler: (data: unknown) => void): void;
  };
  plugins: {
    callPlugin: (route: string, params?: unknown) => Promise<unknown>;
    loadPlugin: (id: string, url: string) => Promise<void>;
    initPluginLoader: () => void;
    onMessage: (pluginId: string, event: string, handler: (data: unknown) => void) => () => void;
  };
  steam: {
    discoverSteamContext: () => string | null;
    findWebpackModule: (registry: Map<string, unknown>, filter: (m: unknown) => boolean) => unknown;
    findWebpackModuleByExport: (registry: Map<string, unknown>, filter: (e: unknown) => boolean) => unknown;
    findWebpackExport: (registry: Map<string, unknown>, filter: (e: unknown) => boolean) => unknown;
    findModuleDetailsByExport: (registry: Map<string, unknown>, filter: (e: unknown) => boolean) => [unknown, unknown] | null;
    // Public API (condenser:steam) merged in so plugins can delegate without bundling the scanner.
    classes: Record<string, string>;
    resetClasses: () => void;
  };
  tab: {
    renderComponent: (id: string) => void;
    activateTab: () => void;
  };
  page: {
    renderComponent: (id: string) => void;
    activatePage: () => void;
    showPage: (path: string) => void;
    closePage: () => void;
  };
  persistent: {
    renderComponent: (id: string) => void;
  };
  tree: {
    getReactInstance: (element: Element) => unknown;
    getReactFiberRoot: (element: Element) => unknown;
    findInFiberTree: (node: unknown, filter: (n: unknown) => boolean) => unknown;
    findInElementTree: (node: unknown, filter: (n: unknown) => boolean) => unknown;
    wrapReactType: (node: unknown, prop?: string) => unknown;
    wrapReactClass: (node: unknown, prop?: string) => unknown;
    createReactTreePatcher: (steps: any[], handler: (node: any) => any) => (tree: any) => any;
  };
}
