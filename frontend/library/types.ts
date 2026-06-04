import type * as ReactModule from 'react';

export interface StyleEntry {
  pluginKey: string;
  target: string;
  css: string;
  el: HTMLStyleElement;
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
    inject(pluginKey: string, css: string, target?: 'bpm' | 'qam' | 'main'): () => void;
    createStyleToggle(pluginKey: string, css: string, target?: 'bpm' | 'qam' | 'main'): {
      enable(): void;
      disable(): void;
      readonly enabled: boolean;
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
