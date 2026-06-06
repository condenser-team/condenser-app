
import { getCondenser } from './condenser.js';
import { findWebpackModule } from './steam.js';

let _internalHooks: any = null;

function getInternalHooks(): any {
  if (_internalHooks) return _internalHooks;
  const React = getCondenser().core.React as any;
  if (!React) return null;
  _internalHooks =
    React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?.ReactCurrentDispatcher?.current
    ?? (Object.values(React.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ?? {}) as any[])
         .find((p: any) => p?.useEffect)
    ?? null;
  if (!_internalHooks) console.warn('[condenser] fc: Could not locate React internal hook dispatcher');
  return _internalHooks;
}

let savedHooks: any = {};

export function applyHookStubs(customHooks: any = {}): any {
  const hooks = getInternalHooks();
  if (!hooks) return null;

  savedHooks = {
    useContext:      hooks.useContext,
    useCallback:     hooks.useCallback,
    useLayoutEffect: hooks.useLayoutEffect,
    useEffect:       hooks.useEffect,
    useMemo:         hooks.useMemo,
    useRef:          hooks.useRef,
    useState:        hooks.useState,
  };

  hooks.useCallback     = (cb: Function) => cb;
  hooks.useContext      = (ctx: any) => ctx?._currentValue;
  hooks.useLayoutEffect = (_: Function) => {};
  hooks.useMemo         = (cb: Function) => cb;
  hooks.useEffect       = (_: Function) => {};
  hooks.useRef          = (val: any) => ({ current: val ?? {} });
  hooks.useState        = (v: any) => { let val = v; return [val, (n: any) => (val = n)]; };

  Object.assign(hooks, customHooks);
  return hooks;
}

export function removeHookStubs(): void {
  const hooks = getInternalHooks();
  if (!hooks) return;
  Object.assign(hooks, savedHooks);
  savedHooks = {};
}

export interface FCTrampoline {
  component: Function;
}

/**
 * Converts a function component to a patchable class-component wrapper at runtime.
 * React is tricked into treating the FC as a class via prototype.isReactComponent.
 * Hook stubs are applied during the brief constructor window to prevent dispatcher errors.
 * The real render is delegated back to a normal function component (trampoline.component)
 * which supports full hooks.
 *
 * Only use this where patching a function component is unavoidable (e.g. ValveToastRenderer).
 */
export function injectFCTrampoline(component: any, customHooks?: any): FCTrampoline {
  const condenser = getCondenser();
  const React     = condenser.core.React as any;
  const ReactDOM  = condenser.core.ReactDOM as any;
  const reg       = condenser.core.webpackRegistry;

  // JSX runtime is a separate webpack module in React 17+ automatic transform.
  let jsxRuntime: any = null;
  if (reg) {
    jsxRuntime = findWebpackModule(reg, (m: any) =>
      typeof m.jsx === 'function' && typeof m.jsxs === 'function' && 'Fragment' in m,
    ) ?? null;
  }

  const newComponent = function (this: any, ...args: any[]) {
    return component.apply(this, args);
  };
  const trampoline: FCTrampoline = { component: newComponent as any };

  component.prototype.render = function () {
    return React.createElement(trampoline.component, this.props, this.props?.children);
  };
  component.prototype.isReactComponent = true;

  let stubsApplied = false;
  const isReact19    = (ReactDOM?.version ?? React?.version ?? '').startsWith('19.');
  const oldCE        = React.createElement;
  const oldJsx       = jsxRuntime?.jsx;
  const oldJsxs      = jsxRuntime?.jsxs;

  const applyStubs = () => {
    if (stubsApplied) return;
    stubsApplied = true;
    applyHookStubs(customHooks);
    // Redirect createElement so the FC's constructor body can't cause infinite recursion.
    React.createElement = () => Object.create(component.prototype);
    if (isReact19 && jsxRuntime) {
      jsxRuntime.jsx  = () => Object.create(component.prototype);
      jsxRuntime.jsxs = () => Object.create(component.prototype);
    }
  };

  const removeStubs = () => {
    if (!stubsApplied) return;
    stubsApplied = false;
    removeHookStubs();
    React.createElement = oldCE;
    if (isReact19 && jsxRuntime) {
      jsxRuntime.jsx  = oldJsx;
      jsxRuntime.jsxs = oldJsxs;
    }
  };

  // Step counter tracks where we are in React's class-component instantiation sequence.
  // Property access order differs between React 18 and 19.
  let step = 0;

  if (isReact19) {
    Object.defineProperty(component, 'contextType', {
      configurable: true,
      get() {
        if (step === 0) step = 1;
        if (!this._contextType) this._contextType = {};
        if (!this._contextType._cv_hooked) {
          this._contextType._cv_hooked = true;
          Object.defineProperty(this._contextType, '_currentValue', {
            configurable: true,
            get() { if (step === 1) { step = 2; applyStubs(); } return this.__cv; },
            set(v) { this.__cv = v; },
          });
        }
        return this._contextType;
      },
      set(v) { this._contextType = v; },
    });

    Object.defineProperty(component.prototype, 'updater', {
      configurable: true,
      get() { return this._updater; },
      set(v) { if (step === 1 || step === 2) { step = 0; removeStubs(); } this._updater = v; },
    });

    Object.defineProperty(component, 'getDerivedStateFromProps', {
      configurable: true,
      get() { if (step === 1 || step === 2) { step = 0; removeStubs(); } return this._gdsfp; },
      set(v) { this._gdsfp = v; },
    });
  } else {
    // React 18
    Object.defineProperty(component, 'contextType', {
      configurable: true,
      get() {
        if (step === 0) step = 1;
        else if (step === 3) step = 4;
        return this._contextType;
      },
      set(v) { this._contextType = v; },
    });

    Object.defineProperty(component, 'contextTypes', {
      configurable: true,
      get() { if (step === 1) { step = 2; applyStubs(); } return this._contextTypes; },
      set(v) { this._contextTypes = v; },
    });

    Object.defineProperty(component.prototype, 'updater', {
      configurable: true,
      get() { return this._updater; },
      set(v) { if (step === 2) { step = 0; removeStubs(); } this._updater = v; },
    });

    Object.defineProperty(component, 'getDerivedStateFromProps', {
      configurable: true,
      get() { if (step === 2) { step = 0; removeStubs(); } return this._gdsfp; },
      set(v) { this._gdsfp = v; },
    });
  }

  return trampoline;
}
