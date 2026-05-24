import type * as ReactModule from 'react';

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
}

export interface CondenserNamespace {
  core: Partial<CondenserCore>;
  components: Record<string, PluginNamespace>;
  plugins: {
    callPlugin: (route: string, params?: unknown) => Promise<unknown>;
    loadPlugin: (id: string, url: string) => Promise<void>;
    initPluginLoader: () => void;
    onMessage: (pluginId: string, event: string, handler: (data: unknown) => void) => () => void;
  };
  steam: {
    discoverSteamContext: () => string | null;
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
    findInFiberTree: (node: unknown, filter: (n: unknown) => boolean) => unknown;
    findInElementTree: (node: unknown, filter: (n: unknown) => boolean) => unknown;
    getReactFiberRoot: (element: Element) => unknown;
  };
}
