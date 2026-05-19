import { getCondenser } from './condenser.js';

export function useSend(pluginId: string): (action: string, data?: unknown) => Promise<any> {
  const condenser = getCondenser();
  return condenser.core.React!.useCallback(
    (action: string, data?: unknown) => condenser.plugins.callPlugin(pluginId, { action, data }),
    [pluginId],
  );
}
