
import { getCondenser } from './condenser.js';

// Module-level portal handles — one overlay covers all big-picture plugins.
let portalContainer: HTMLElement | null = null;
let portalRoot: { render: (node: any) => void } | null = null;

export function renderComponent(id: string): void {
  const condenser = getCondenser();
  const def = condenser.components[id]?.component;
  if (!def?.target) return;
  if (def.target === 'big-picture') scheduleActivation();
}

export function activateBigPictureRouter(): void {
  scheduleActivation();
}

function scheduleActivation(): void {
  const condenser = getCondenser();
  if (condenser.core.bigPicturePatched) return;
  condenser.core.bigPicturePatched = true;

  const React = condenser.core.React;
  const ReactDOM = condenser.core.ReactDOM;
  if (!React || !ReactDOM) {
    console.warn('[condenser] bigpicture: React/ReactDOM not ready');
    return;
  }

  // Fixed-position portal that covers the viewport when a big-picture route is active.
  portalContainer = document.createElement('div');
  portalContainer.id = 'condenser-bigpicture-portal';
  portalContainer.style.cssText =
    'position:fixed;inset:0;z-index:99999;background:#1b1f24;display:none;overflow:auto;';
  document.body.appendChild(portalContainer);
  portalRoot = ReactDOM.createRoot(portalContainer);

  // Intercept the History API to catch React Router navigation.
  // Steam's Navigate() ultimately calls history.pushState internally.
  const origPush    = history.pushState.bind(history);
  const origReplace = history.replaceState.bind(history);
  history.pushState    = (state: any, unused: string, url?: string | URL | null) => { origPush(state, unused, url);    updatePortal(); };
  history.replaceState = (state: any, unused: string, url?: string | URL | null) => { origReplace(state, unused, url); updatePortal(); };
  window.addEventListener('popstate', updatePortal);

  updatePortal();
}

export function showPage(path: string): void {
  if (!portalContainer || !portalRoot) return;
  const condenser = getCondenser();
  const React = condenser.core.React!;

  const pages: any[] = [];
  for (const [id, ns] of Object.entries(condenser.components as Record<string, any>)) {
    const def = ns?.component;
    if (!def || def.target !== 'big-picture' || !def.route || !def.page) continue;
    if (path !== def.route) continue;
    pages.push(React.createElement(def.page, { key: id, websocketUrl: condenser.core.url ?? '' }));
  }

  portalContainer.style.display = pages.length ? 'block' : 'none';
  portalRoot.render(pages.length ? React.createElement(React.Fragment, null, ...pages) : null);
}

export function closePage(): void {
  if (!portalContainer || !portalRoot) return;
  portalContainer.style.display = 'none';
  portalRoot.render(null);
}

function updatePortal(): void {
  showPage(window.location.pathname);
}
