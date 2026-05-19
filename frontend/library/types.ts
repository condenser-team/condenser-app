import type * as ReactModule from 'react';

export interface PluginComponent {
  target: string;
  key: string;
  title?: string;
  tab: (R: typeof ReactModule) => ReactModule.ReactNode;
  panel: ReactModule.ComponentType<{ websocketUrl: string }>;
}

export interface PluginNamespace {
  component?: PluginComponent;
  forceUpdate?: () => void;
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
  patched: boolean;
  patchedTypeCache: Map<unknown, unknown>;
  booted: boolean;
}

export interface CondenserNamespace {
  core: Partial<CondenserCore>;
  components: Record<string, PluginNamespace>;
  plugins: {
    callPlugin: (route: string, params?: unknown) => Promise<unknown>;
    loadPlugin: (id: string, url: string) => Promise<void>;
    initPluginLoader: () => void;
  };
  steam: {
    discoverSteamContext: () => string | null;
  };
  qam: {
    renderComponent: (id: string) => void;
    activateQuickAccessMenu: () => void;
  };
  tree: {
    findInFiberTree: (node: unknown, filter: (n: unknown) => boolean) => unknown;
    findInElementTree: (node: unknown, filter: (n: unknown) => boolean) => unknown;
    getReactFiberRoot: (element: Element) => unknown;
  };
}
