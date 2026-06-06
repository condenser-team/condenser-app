
import { getCondenser } from './condenser.js';
import { findWebpackExport, findModuleDetailsByExport, findWebpackModuleByExport } from './steam.js';

export { showToast } from './toast.js';
export type { ToastOptions } from './toast.js';

/**
 * Typed Steam design-system class name constants.
 * Use these in JSX `className` props instead of bare strings.
 *
 * @example
 * <button className={cls.btnSecondary}>Click me</button>
 * <button className={`${cls.btnPrimary} ${cls.focusable}`}>Click me</button>
 */
export const cls = {
  btnSecondary: 'DialogButton _DialogLayout Secondary',
  btnPrimary:   'DialogButton _DialogLayout Primary',
  textInput:    'DialogInput DialogInputPlaceholder DialogTextInputBase Focusable',
  inputWrapper: 'DialogInput_Wrapper _DialogLayout Panel',
  focusable:    'Focusable',
} as const;

export type SteamClassName = (typeof cls)[keyof typeof cls];

function getRegistry(): Map<string, any> | undefined {
  return getCondenser().core.webpackRegistry;
}

// ---- Overlays ----

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

let _showContextMenuRaw: any = null;
export function showContextMenu(children: any, parent?: EventTarget): void {
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

// ---- Steam UI Components ----

let _Focusable: any = null;
export function Focusable(props: any): any {
  if (!_Focusable) {
    const reg = getRegistry();
    if (reg) {
      _Focusable = findWebpackExport(reg, (e: any) => {
        const s = e?.toString?.() ?? e?.render?.toString?.() ?? '';
        return /flow-children/.test(s) && /onActivate/.test(s) && /focusClassName/.test(s);
      });
    }
  }
  return getCondenser().core.React!.createElement(_Focusable ?? 'div', props);
}

let _SidebarNavigation: any = null;
export function SidebarNavigation(props: any): any {
  if (!_SidebarNavigation) {
    const reg = getRegistry();
    if (reg) {
      _SidebarNavigation = findWebpackExport(reg, (e: any) =>
        typeof e === 'function' && /fnSetNavigateToPage/.test(e.toString?.() ?? ''),
      );
    }
  }
  if (!_SidebarNavigation) return null;
  return getCondenser().core.React!.createElement(_SidebarNavigation, props);
}

let _Tabs: any = null;
export function Tabs(props: any): any {
  if (!_Tabs) {
    const reg = getRegistry();
    if (reg) {
      const mod = findWebpackModuleByExport(reg, (e: any) =>
        e?.toString?.().includes('.TabRowTabs') && e?.toString?.().includes('activeTab:'),
      );
      if (mod) {
        _Tabs = Object.values(mod as object).find(
          (e: any) => e?.type?.toString?.().includes('(function()'),
        ) ?? null;
      }
    }
  }
  if (!_Tabs) return null;
  return getCondenser().core.React!.createElement(_Tabs, props);
}

let _Menu: any = null;
export function Menu(props: any): any {
  if (!_Menu) {
    const reg = getRegistry();
    if (reg) {
      const legacy = findWebpackExport(reg, (e: any) => e?.prototype?.HideIfSubmenu && e?.prototype?.HideMenu);
      if (legacy) {
        _Menu = legacy;
      } else {
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
