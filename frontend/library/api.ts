import { getCondenser } from './condenser.js';
import { findWebpackExport, findModuleDetailsByExport } from './steam.js';
export { showToast } from './toast.js';
export type { ToastOptions } from './toast.js';
export { createReactTreePatcher } from './treepatcher.js';
export type { NodeStep, PatchHandler } from './treepatcher.js';
export { onUIModeChanged, getUIMode, UIMode } from './events.js';
export type { UIMode as UIModeValue } from './events.js';
export { useQAMVisible } from './tab.js';

// ---- Internal helpers ----

function getWin(): any {
  const router = getCondenser().core.router as any;
  return (window as any).SteamUIStore?.GetFocusedWindowInstance?.()
    ?? router?.WindowStore?.GamepadUIMainWindowInstance
    ?? router?.WindowStore?.SteamUIWindows?.[0];
}

function getRegistry(): Map<string, any> | undefined {
  return getCondenser().core.webpackRegistry;
}

// ---- Navigation ----

export function navigate(path: string): void {
  const condenser = getCondenser();
  getWin()?.Navigate?.(path);
  condenser.page.showPage(path);
}

export function back(): void {
  const condenser = getCondenser();
  getWin()?.NavigateBack?.();
  condenser.page.closePage();
}

export function openQAM(): void {
  getWin()?.MenuStore?.OpenQuickAccessMenu?.();
}

export function openSideMenu(): void {
  getWin()?.MenuStore?.OpenSideMenu?.(1); // SideMenu.Main = 1
}

export function closeSideMenus(): void {
  getWin()?.MenuStore?.CloseSideMenus?.();
}

// ---- Hooks ----

export function useSend(pluginId: string): (action: string, data?: unknown) => Promise<unknown> {
  const condenser = getCondenser();
  return condenser.core.React!.useCallback(
    (action: string, data?: unknown) => condenser.plugins.callPlugin(pluginId, { action, data }),
    [pluginId],
  );
}

export function useMessage(pluginId: string, event: string, handler: (data: unknown) => void): void {
  const condenser = getCondenser();
  condenser.core.React!.useEffect(
    () => condenser.plugins.onMessage(pluginId, event, handler),
    [pluginId, event, handler],
  );
}

// ---- Steam UI components (lazy-discovered from webpack) ----

// Gamepad-navigable wrapper — wraps content so controller d-pad navigation works.
let _focusable: any = null;
function lazyFocusable(): any {
  if (_focusable) return _focusable;
  const reg = getRegistry();
  if (!reg) return null;
  _focusable = findWebpackExport(reg, (e: any) => {
    const s = e?.toString?.() ?? e?.render?.toString?.() ?? '';
    return /flow-children/.test(s) && /onActivate/.test(s) && /focusClassName/.test(s);
  });
  return _focusable;
}

export function Focusable(props: any): any {
  const C = lazyFocusable();
  return getCondenser().core.React!.createElement(C ?? 'div', props);
}

// Collapsible left-hand sidebar nav for use inside BPM pages.
let _sidebarNavigation: any = null;
function lazySidebarNavigation(): any {
  if (_sidebarNavigation) return _sidebarNavigation;
  const reg = getRegistry();
  if (!reg) return null;
  _sidebarNavigation = findWebpackExport(reg, (e: any) =>
    typeof e === 'function' && /fnSetNavigateToPage/.test(e.toString?.() ?? ''),
  );
  return _sidebarNavigation;
}

export function SidebarNavigation(props: any): any {
  const C = lazySidebarNavigation();
  if (!C) return null;
  return getCondenser().core.React!.createElement(C, props);
}

// ---- Imperative APIs ----

// Renders a React node as an overlay inside BPM's React fiber tree.
// The Persistent component (or any component) registers core.showModal to handle the call.
// Steam's own showModal relies on React context and cannot be called imperatively.
export function showModal(
  content: any,
  _parent?: EventTarget,
  options?: { strTitle?: string },
): void {
  const handler = getCondenser().core.showModal;
  if (!handler) {
    console.warn('[condenser] showModal: no handler registered — is a Persistent component loaded?');
    return;
  }
  handler(content, options?.strTitle);
}

// Opens a Steam-native context menu anchored to a parent element.
let _showContextMenuRaw: any = null;
export function showContextMenu(
  children: any,
  parent?: EventTarget,
): void {
  if (!_showContextMenuRaw) {
    const reg = getRegistry();
    if (!reg) return;
    _showContextMenuRaw = findWebpackExport(reg, (e: any) =>
      typeof e === 'function' &&
      e.toString().includes('GetContextMenuManagerFromWindow') &&
      e.toString().includes('CreateContextMenuInstance'),
    );
  }
  if (!_showContextMenuRaw) return;
  try {
    _showContextMenuRaw(children, parent ?? window);
  } catch (e) {
    console.warn('[condenser] showContextMenu failed:', e);
  }
}

// ---- Menu components (for use with showContextMenu) ----

let _Menu: any = null;
export function Menu(props: any): any {
  if (!_Menu) {
    const reg = getRegistry();
    if (reg) {
      // Legacy menu (pre-2025): has HideIfSubmenu + HideMenu on prototype
      const legacy = findWebpackExport(reg, (e: any) => e?.prototype?.HideIfSubmenu && e?.prototype?.HideMenu);
      if (legacy) {
        _Menu = legacy;
      } else {
        // New menu (Steam 6/2025+): lives in same module as MenuItem, identified by useId + labelId
        const menuItemMod = findModuleDetailsByExport(reg, (e: any) =>
          (e?.render?.toString?.().includes('bPlayAudio:')) ||
          (e?.prototype?.OnOKButton && e?.prototype?.OnMouseEnter),
        )?.[0];
        if (menuItemMod) {
          _Menu = findWebpackExport(reg, (e: any) =>
            typeof e === 'function' && e.toString?.().includes('useId') && e.toString?.().includes('labelId'),
          );
        }
      }
    }
  }
  if (!_Menu) return null;
  return getCondenser().core.React!.createElement(_Menu, props);
}

let _MenuItem: any = null;
export function MenuItem(props: any): any {
  if (!_MenuItem) {
    const reg = getRegistry();
    if (reg) {
      const details = findModuleDetailsByExport(reg, (e: any) =>
        e?.render?.toString?.().includes('bPlayAudio:') ||
        (e?.prototype?.OnOKButton && e?.prototype?.OnMouseEnter),
      );
      _MenuItem = details?.[1] ?? null;
    }
  }
  if (!_MenuItem) return null;
  return getCondenser().core.React!.createElement(_MenuItem, props);
}
