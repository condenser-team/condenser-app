
import { getCondenser } from './condenser.js';
import { findInFiberTree, getReactFiberRoot } from './tree.js';
import { wrapReturnValue } from './patch.js';

export function renderComponent(id: string): void {
  const condenser = getCondenser();
  const def = condenser.components[id]?.component;
  if (def?.page && def?.route) scheduleActivation();
}

export function activateBigPictureRouter(): void {
  scheduleActivation();
}

function scheduleActivation(): void {
  const condenser = getCondenser();
  if (condenser.core.bigPicturePatched) return;
  condenser.core.bigPicturePatched = true;
  patchRouter();
}

function patchRouter(): void {
  const condenser = getCondenser();

  const rootEl = document.getElementById('root');
  if (!rootEl) {
    console.warn('[condenser] bigpicture: No #root element');
    return;
  }

  const fiberRoot = getReactFiberRoot(rootEl);

  // The gamepad router is a React.memo-wrapped anonymous component that renders all BPM routes.
  // It contains 'Settings.Root()' in its source and takes no props (loggedIn is undefined).
  const routerNode = findInFiberTree(fiberRoot, (node: any) =>
    typeof node?.type === 'function' &&
    typeof node?.pendingProps?.loggedIn === 'undefined' &&
    (node.type.toString() as string).includes('Settings.Root()'),
  );

  if (!routerNode) {
    console.warn('[condenser] bigpicture: Router node not found, retrying in 3s');
    condenser.core.bigPicturePatched = false;
    setTimeout(patchRouter, 3000);
    return;
  }

  // The Route component is in a lazily-loaded webpack chunk not available at boot.
  // Discover it at render time from the first existing route element.
  let RouteComponent: any = null;

  // Patch elementType.type so every future render injects our routes.
  wrapReturnValue(routerNode.elementType, 'type', (_args: any[], ret: any) => {
    if (!ret) return ret;
    // The router renders Fragment > yc (TopLevelTransition) > [Route, ...].
    const children = ret.props?.children;
    const ycElement = Array.isArray(children) ? children[0] : children;
    const routeList = ycElement?.props?.children;
    if (!Array.isArray(routeList)) return ret;

    // Lazily discover the Route component from the first existing route.
    if (!RouteComponent && routeList.length > 0) {
      RouteComponent = routeList[0]?.type;
    }
    if (RouteComponent) {
      injectRoutes(routeList, RouteComponent);
    }
    return ret;
  });

  // Swap the current fiber instance to use the patched function.
  routerNode.type = routerNode.elementType.type;
  if (routerNode.alternate) routerNode.alternate.type = routerNode.type;

  // React.memo caches the initial render (no props = no change detected).
  // Override memoizedProps so the next reconcile sees a prop diff and re-renders once.
  routerNode.memoizedProps = { _condenserRouterUpdate: true };
  if (routerNode.alternate) routerNode.alternate.memoizedProps = { _condenserRouterUpdate: true };

  // Trigger a re-render by calling forceUpdate on the nearest class-component ancestor.
  let ancestor: any = routerNode.return;
  while (ancestor) {
    if (ancestor.stateNode && typeof (ancestor.stateNode as any).forceUpdate === 'function') {
      (ancestor.stateNode as any).forceUpdate();
      break;
    }
    ancestor = ancestor.return;
  }

  console.info('[condenser] bigpicture: Router patched');
}

// Cache stable wrapper components per plugin ID so React doesn't remount on every router render.
const injectedPageCache = new Map<string, any>();

function getInjectedPage(id: string): any {
  if (injectedPageCache.has(id)) return injectedPageCache.get(id);
  const condenser = getCondenser();
  const React = condenser.core.React!;

  function InjectedPage(props: { websocketUrl: string }) {
    const [, setTick] = React.useState(0);
    const ns = (condenser.components[id] ||= {});
    React.useLayoutEffect(() => {
      ns.forceUpdaters ??= new Set();
      const update = () => setTick((t: number) => t + 1);
      ns.forceUpdaters.add(update);
      return () => { ns.forceUpdaters?.delete(update); };
    }, []);
    const Page = ns.component?.page;
    return Page ? React.createElement(Page, { websocketUrl: props.websocketUrl }) : null;
  }

  injectedPageCache.set(id, InjectedPage);
  return InjectedPage;
}

function injectRoutes(routeList: any[], RouteComponent: any): void {
  const condenser = getCondenser();
  const React = condenser.core.React!;

  for (const [id, ns] of Object.entries(condenser.components as Record<string, any>)) {
    const def = ns?.component;
    if (!def?.page || !def?.route) continue;
    if (routeList.some((r: any) => r?.props?.path === def.route)) continue;
    routeList.push(
      React.createElement(
        RouteComponent,
        { path: def.route, key: `condenser-${id}` },
        React.createElement(getInjectedPage(id), { websocketUrl: condenser.core.url ?? '' }),
      ),
    );
  }
}

// No-ops kept for API compatibility — superseded by router patching.
export function showPage(_path: string): void {}
export function closePage(): void {}
