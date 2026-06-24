import type * as ReactModule from 'react';
import type { TargetType } from './css.js';

export interface StyleEntry {
  pluginKey: string;
  target: Window;
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

/** CEF popup window identifiers for Steam's multi-process UI. */
export enum Window {
  BigPicture     = 'big-picture',
  QuickAccess    = 'quick-access',
  MainMenu       = 'main-menu',
  Keyboard       = 'keyboard',
  OverlayBrowser = 'overlay-browser',
  Store          = 'store',
}

/**
 * A resolved injection target — maps a semantic Steam UI feature to the CEF window(s)
 * and CSS scope selector needed to style it. Use `Target.*` constants rather than
 * constructing this directly.
 */
export interface TargetDef {
  /** CEF window(s) to inject into. */
  windows: Window[];
  /** CSS selector that scopes injected styles to this feature's root element. */
  scope: string;
}

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
    /** CEF popup window identifiers — use with `TargetDef` when constructing custom targets. */
    Window: typeof Window;
    /** Injection targets for the Steam UI. See `css.ts` `Target` for the full list. */
    Target: TargetType;
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
    inject(pluginKey: string, source: CSSSource, target?: TargetDef): () => void;
    /** Create an enable/disable toggle for a style injection. Same source types as `inject()`. */
    createStyleToggle(pluginKey: string, source: CSSSource, target?: TargetDef): {
      enable(): void;
      disable(): void;
      readonly enabled: boolean;
    };
    /**
     * Create a set of CSS custom properties (variables) that can be updated live.
     * Variables are injected as a `:root { --key: value; }` block (or scoped to the
     * target section's root when a section target with a real scope is used).
     */
    createStyleVars(pluginKey: string, vars: Record<string, string>, target?: TargetDef): {
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
