
import { findInElementTree, findInFiberTree, getReactFiberRoot } from './tree.js';
import { getCondenser } from './condenser.js';
import { wrapReturnValue } from './patch.js';

// ---- QAM visibility context ----

let _qamVisibleContext: any = null;

function getQAMVisibleContext(): any {
  if (_qamVisibleContext) return _qamVisibleContext;
  const React = getCondenser().core.React!;
  _qamVisibleContext = React.createContext(false);
  return _qamVisibleContext;
}

// Wrap each plugin panel so it can expose QAM open/close state to descendant components.
// Mirrors Decky's QuickAccessVisibleStateProvider — sets tab.qAMVisibilitySetter so the
// appendTab render loop can signal visibility changes without needing a second context.
function QAMVisibilityProvider(props: { tab: any; children: any }): any {
  const React = getCondenser().core.React!;
  const [visible, setVisible] = React.useState(props.tab.initialVisibility ?? false);
  // Assign stable setter so the render loop can update visibility without re-mounting.
  props.tab.qAMVisibilitySetter = setVisible;
  return React.createElement(getQAMVisibleContext().Provider, { value: visible }, props.children);
}

/**
 * Returns true when the QAM is open (the containing panel is visible to the user).
 * Must be called inside a plugin Panel component — the context is provided by condenser's
 * QAMVisibilityProvider wrapper that surrounds every registered panel.
 */
export function useQAMVisible(): boolean {
  const React = getCondenser().core.React!;
  return React.useContext(getQAMVisibleContext());
}

// ---- Tab injection ----

export function renderComponent(id: string): void {
  const condenser = getCondenser();
  const def = condenser.components[id]?.component;
  if (def?.tab) activateTab();
}

export function activateTab(): void {
  const condenser = getCondenser();
  if (condenser.core.tabPatched) return;
  condenser.core.tabPatched = true;

  const renderer = condenser.core.quickAccessMenuRenderer;
  if (!renderer) return;

  const patchedTypeCache: Map<any, any> =
    condenser.core.patchedTypeCache ?? (condenser.core.patchedTypeCache = new Map());

  wrapReturnValue(renderer, 'type', (_outerArgs: any[], outerReturnValue: any) => {
    const innerElement = findInElementTree(outerReturnValue, (x: any) => x?.props?.onFocusNavDeactivated !== undefined);
    if (innerElement) {
      const cached = patchedTypeCache.get(innerElement.type);
      if (cached) {
        innerElement.type = cached;
      } else {
        const originalType = innerElement.type;
        if (typeof originalType === 'function') {
          wrapReturnValue(innerElement, 'type', appendTab());
        }
        patchedTypeCache.set(originalType, innerElement.type);
      }
    }
    return outerReturnValue;
  });

  const rootElement = document.getElementById('root');
  const fiberRoot = rootElement ? getReactFiberRoot(rootElement) : null;
  const qamFiberNode = fiberRoot
    ? findInFiberTree(fiberRoot, (n: any) => n.elementType === renderer)
    : null;
  if (qamFiberNode) {
    qamFiberNode.type = qamFiberNode.elementType.type;
    if (qamFiberNode.alternate) qamFiberNode.alternate.type = qamFiberNode.type;
  }
}

export function appendTab(): (args: any[], returnValue: any) => any {
  const condenser = getCondenser();
  const React = condenser.core.React!;
  let titleClassName = '';

  function InjectedTabPanel(props: { id: string }) {
    const [, setTick] = React.useState(0);
    const ns = (condenser.components[props.id] ||= {});
    React.useLayoutEffect(() => {
      ns.forceUpdaters ??= new Set();
      const update = () => setTick((t: number) => t + 1);
      ns.forceUpdaters.add(update);
      return () => { ns.forceUpdaters?.delete(update); };
    }, []);
    const Panel = ns.component?.panel;
    return Panel ? React.createElement(Panel, { websocketUrl: condenser.core.url ?? '' }) : null;
  }

  return function(_args: any[], returnValue: any): any {
    const tabsNode = findInElementTree(returnValue, (x: any) => Array.isArray(x?.props?.tabs));
    if (!tabsNode) return returnValue;

    for (const [id, ns] of Object.entries(condenser.components as Record<string, any>)) {
      const def = ns?.component;
      if (!def?.tab) continue;

      // Notify existing condenser tabs that the QAM is open.
      const existing = tabsNode.props.tabs.find((t: any) => t.key === def.key);
      if (existing) {
        existing.qAMVisibilitySetter?.(true);
        continue;
      }

      if (!titleClassName) {
        const nativeTitleType = tabsNode.props.tabs[0]?.title?.type;
        const sample = typeof nativeTitleType === 'function' ? nativeTitleType({ locId: '' }) : null;
        titleClassName = sample?.props?.className ?? '';
      }

      // Build the tab object first so QAMVisibilityProvider can hold a reference to it.
      const tab: any = {
        key: def.key,
        tab: def.tab(React),
        initialVisibility: true,
        title: titleClassName
          ? React.createElement('div', { className: titleClassName }, def.title ?? def.key)
          : def.tab(React),
      };
      tab.panel = React.createElement(
        QAMVisibilityProvider,
        { tab },
        React.createElement(InjectedTabPanel, { id }),
      );
      tabsNode.props.tabs.push(tab);
    }

    return returnValue;
  };
}
