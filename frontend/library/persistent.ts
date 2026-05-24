
import { getCondenser } from './condenser.js';

// Triggers GlobalContainer to re-render when a new global plugin registers after initial load.
let globalContainerUpdate: (() => void) | undefined;

// Called from bigpicture.ts's wrapReturnValue callback to append global components alongside
// the router output. Returns a Fragment containing the original ret plus GlobalContainer.
export function injectGlobalComponents(ret: any): any {
  const condenser = getCondenser();
  const React = condenser.core.React!;
  return React.createElement(React.Fragment, null, ret, React.createElement(getGlobalContainer()));
}

// Called from loadPlugin whenever a plugin with a Global export is loaded.
export function renderComponent(id: string): void {
  const condenser = getCondenser();
  const def = condenser.components[id]?.component;
  if (def?.persistent) globalContainerUpdate?.();
}

// Stable GlobalContainer — created once, lives for the session.
// Re-renders when globalContainerUpdate() is called (new plugin registers).
let globalContainerCache: any = null;

function getGlobalContainer(): any {
  if (globalContainerCache) return globalContainerCache;
  const condenser = getCondenser();
  const React = condenser.core.React!;

  function GlobalContainer() {
    const [, setTick] = React.useState(0);
    React.useLayoutEffect(() => {
      globalContainerUpdate = () => setTick((t: number) => t + 1);
      return () => { globalContainerUpdate = undefined; };
    }, []);

    return React.createElement(
      React.Fragment,
      null,
      ...Object.keys(condenser.components as Record<string, any>)
        .filter(id => (condenser.components as Record<string, any>)[id]?.component?.persistent)
        .map(id => React.createElement(
          getInjectedGlobal(id),
          { key: id, websocketUrl: condenser.core.url ?? '' },
        )),
    );
  }

  globalContainerCache = GlobalContainer;
  return globalContainerCache;
}

// Stable per-plugin wrapper — same pattern as InjectedPage in bigpicture.ts.
const injectedGlobalCache = new Map<string, any>();

function getInjectedGlobal(id: string): any {
  if (injectedGlobalCache.has(id)) return injectedGlobalCache.get(id);
  const condenser = getCondenser();
  const React = condenser.core.React!;

  function InjectedGlobal(props: { websocketUrl: string }) {
    const [, setTick] = React.useState(0);
    const ns = (condenser.components[id] ||= {});
    React.useLayoutEffect(() => {
      ns.forceUpdaters ??= new Set();
      const update = () => setTick((t: number) => t + 1);
      ns.forceUpdaters.add(update);
      return () => { ns.forceUpdaters?.delete(update); };
    }, []);
    const Global = ns.component?.persistent;
    return Global ? React.createElement(Global, { websocketUrl: props.websocketUrl }) : null;
  }

  injectedGlobalCache.set(id, InjectedGlobal);
  return InjectedGlobal;
}
