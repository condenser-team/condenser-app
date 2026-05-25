
import { getCondenser } from './condenser.js';
import { findWebpackExport, findWebpackModule } from './steam.js';
import { injectFCTrampoline } from './fc.js';
import { replacePatch, callOriginal } from './patch.js';

export interface ToastOptions {
  title: string;
  body?: string;
  duration?: number;
  sound?: number;
  playSound?: boolean;
  critical?: boolean;
}

const LOCATION_POPUP = 1;
const LOCATION_QAM   = 3;

function cx(...names: (string | undefined | null | false)[]): string {
  return names.filter(Boolean).join(' ');
}

// Lazy — discovered once from the webpack CSS module that owns ShortTemplate.
// Mirrors Decky's findClassModule((m) => m.ShortTemplate).
let tc: any = null;
function getTemplateClasses(): any {
  if (tc) return tc;
  const reg = getCondenser().core.webpackRegistry;
  tc = (reg ? findWebpackModule(reg, (m: any) => typeof m.ShortTemplate === 'string') : null) ?? {};
  return tc;
}

let toasterReady = false;

export function initToaster(): void {
  if (toasterReady) return;

  const reg = getCondenser().core.webpackRegistry;
  if (!reg) { console.warn('[condenser] toast: Webpack registry not ready'); return; }

  // Fingerprint from Decky: the renderer wraps each notification group and includes
  // a hardcoded controller/method string in its minified source.
  const ValveToastRenderer = findWebpackExport(reg, (e: any) =>
    typeof e === 'function' && e?.toString?.()?.includes('controller:"notification",method:'),
  );

  if (!ValveToastRenderer) {
    console.warn('[condenser] toast: ValveToastRenderer not found — showToast unavailable');
    return;
  }

  const trampoline = injectFCTrampoline(ValveToastRenderer);
  const React = getCondenser().core.React!;

  replacePatch(trampoline, 'component', (args: any[]) => {
    const group    = (args[0] as any)?.group;
    const location = (args[0] as any)?.location as number;
    if (!group?.notifications?.[0]?.condenser) return callOriginal;

    const classes = getTemplateClasses();

    return group.notifications.map((notif: any) => {
      const { title, body, duration = 5000 } = notif.data as ToastOptions;

      if (location === LOCATION_QAM) {
        // Entry rendered inside the QAM Notifications tab.
        return React.createElement(
          'div',
          { key: notif.nNotificationID, className: cx(classes.StandardTemplateContainer) },
          React.createElement(
            'div',
            { className: cx(classes.StandardTemplate) },
            React.createElement(
              'div',
              { className: cx(classes.Content) },
              React.createElement(
                'div',
                { className: cx(classes.Header) },
                React.createElement('div', { className: cx(classes.Title) }, title),
              ),
              body
                ? React.createElement('div', { className: cx(classes.StandardNotificationDescription) }, body)
                : null,
            ),
          ),
        );
      }

      // GAMEPADUI_POPUP (location 1) and fallback — floating toast.
      // --toast-duration drives Steam's own dismiss animation on ShortTemplate.
      return React.createElement(
        'div',
        {
          key: notif.nNotificationID,
          style: { '--toast-duration': `${duration}ms` },
          className: cx(classes.ShortTemplate),
        },
        React.createElement(
          'div',
          { className: cx(classes.Content) },
          React.createElement(
            'div',
            { className: cx(classes.Header) },
            React.createElement('div', { className: cx(classes.Title) }, title),
          ),
          body
            ? React.createElement('div', { className: cx(classes.Body) }, body)
            : null,
        ),
      );
    });
  });

  toasterReady = true;
  console.info('[condenser] toast: Initialized');
}

export function showToast(options: ToastOptions): void {
  if (!toasterReady) {
    console.warn('[condenser] toast: Toaster not initialized — was initToaster() called?');
    return;
  }

  const NotificationStore = (window as any).NotificationStore;
  if (!NotificationStore) {
    console.warn('[condenser] toast: NotificationStore not found on window');
    return;
  }

  const duration = options.duration ?? 5000;
  const toastData: any = {
    nNotificationID: NotificationStore.m_nNextTestNotificationID++,
    bNewIndicator:   true,
    rtCreated:       Date.now(),
    eType:           31,
    eSource:         1,
    nToastDurationMS: duration,
    data:            options,
    condenser:       true,
  };

  let group: any;
  const info = {
    showToast:      true,
    sound:          options.sound ?? 6,
    playSound:      options.playSound ?? true,
    eFeature:       0,
    toastDurationMS: duration,
    bCritical:      options.critical ?? false,
    fnTray(toast: any, tray: any) {
      group = { eType: toast.eType, notifications: [toast] };
      tray.unshift(group);
    },
  };

  try {
    NotificationStore.ProcessNotification(info, toastData, 0 /* ToastType.New */);
  } catch (e) {
    console.error('[condenser] toast: ProcessNotification failed:', e);
  }
}
