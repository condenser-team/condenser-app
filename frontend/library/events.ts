
// EUIMode values from Steam's internal enum (source: Decky decky-frontend-lib/src/globals/steam-client/shared.ts)
export const UIMode = {
  Unknown: -1,
  GamePad:  4,
  Desktop:  7,
} as const;
export type UIMode = (typeof UIMode)[keyof typeof UIMode];

/**
 * Register a callback for Steam UI mode changes (desktop ↔ gamepad/BPM).
 * Returns an unregister function.
 *
 * @example
 * const off = onUIModeChanged((mode) => {
 *   if (mode === UIMode.GamePad) startPolling();
 *   else stopPolling();
 * });
 * // later: off();
 */
export function onUIModeChanged(handler: (mode: UIMode) => void): () => void {
  const reg = (window as any).SteamClient?.UI?.RegisterForUIModeChanged?.(handler);
  return () => reg?.unregister?.();
}

/** Returns the current Steam UI mode, or null if SteamClient is unavailable. */
export async function getUIMode(): Promise<UIMode | null> {
  return (window as any).SteamClient?.UI?.GetUIMode?.() ?? null;
}
