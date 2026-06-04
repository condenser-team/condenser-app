
import { getCondenser } from './condenser.js';

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
