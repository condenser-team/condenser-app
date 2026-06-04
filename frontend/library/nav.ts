
import { getCondenser } from './condenser.js';

function getWin(): any {
  const router = getCondenser().core.router as any;
  return (window as any).SteamUIStore?.GetFocusedWindowInstance?.()
    ?? router?.WindowStore?.GamepadUIMainWindowInstance
    ?? router?.WindowStore?.SteamUIWindows?.[0];
}

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

export function openQAM(): void        { getWin()?.MenuStore?.OpenQuickAccessMenu?.(); }
export function openSideMenu(): void   { getWin()?.MenuStore?.OpenSideMenu?.(1); }
export function closeSideMenus(): void { getWin()?.MenuStore?.CloseSideMenus?.(); }
