
import { getCondenser } from './condenser.js';
import { findWebpackExport } from './steam.js';
import { replacePatch, callOriginal } from './patch.js';

// Matches plugin URLs served by condenser (always under /plugins/ on the local server).
function isCondenserError(errorStr: string): boolean {
  return errorStr.includes('/plugins/') &&
    (errorStr.includes('localhost') || errorStr.includes('127.0.0.1'));
}

export function initErrorBoundary(): void {
  const reg = getCondenser().core.webpackRegistry;
  if (!reg) return;

  // Find the ErrorReportingStore factory — Decky fingerprint.
  const exp = /^\(\)=>\(.\|\|.\(new .\),.\)$/;
  const initStore = findWebpackExport(reg, (e: any) =>
    typeof e === 'function' && exp.test(e.toString?.() ?? ''),
  );

  if (!initStore) {
    console.warn('[condenser] errorboundary: initErrorReportingStore not found');
  } else {
    const store = initStore();
    replacePatch(Object.getPrototypeOf(store), 'BIsBlacklisted', (args: any[]) => {
      const msg = JSON.stringify(args[0]?.message ?? '');
      // Suppress condenser plugin errors from reaching Valve telemetry.
      if (isCondenserError(msg)) return true;
      return callOriginal;
    });
  }

  // Find Steam's ErrorBoundary class.
  const ErrorBoundary = findWebpackExport(reg, (e: any) =>
    e?.prototype?.Reset &&
    e?.prototype?.componentDidCatch &&
    e?.InstallErrorReportingStore,
  );

  if (!ErrorBoundary) {
    console.warn('[condenser] errorboundary: ErrorBoundary not found');
    return;
  }

  // Patch render to support programmatic force-rerenders via _condenserForceRerender.
  replacePatch(ErrorBoundary.prototype, 'render', function (this: any) {
    if (this.state?._condenserForceRerender) {
      this.setState({ ...this.state, _condenserForceRerender: null });
      return null;
    }
    return callOriginal;
  });

  ErrorBoundary.prototype._condenserForceRerender = function (this: any) {
    this.setState({ ...this.state, _condenserForceRerender: true });
  };

  console.info('[condenser] errorboundary: Initialized');
}
