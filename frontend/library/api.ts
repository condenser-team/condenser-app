import { getCondenser } from './condenser.js';

export function navigate(path: string): void {
  const condenser = getCondenser();
  const router = condenser.core.router as any;
  const win = (window as any).SteamUIStore?.GetFocusedWindowInstance?.()
    ?? router?.WindowStore?.GamepadUIMainWindowInstance
    ?? router?.WindowStore?.SteamUIWindows?.[0];
  win?.Navigate?.(path);
  // Steam's router doesn't trigger history.pushState, so drive the portal directly.
  condenser.bigpicture.showPage(path);
}

export function back(): void {
  const condenser = getCondenser();
  const router = condenser.core.router as any;
  const win = (window as any).SteamUIStore?.GetFocusedWindowInstance?.()
    ?? router?.WindowStore?.GamepadUIMainWindowInstance
    ?? router?.WindowStore?.SteamUIWindows?.[0];
  win?.NavigateBack?.();
  condenser.bigpicture.closePage();
}

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
