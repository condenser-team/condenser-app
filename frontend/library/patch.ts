
export const callOriginal: unique symbol = Symbol('CONDENSER_CALL_ORIGINAL');

export interface Patch {
  original: Function;
  property: string;
  object: any;
  patchedFunction: Function;
  hasUnpatched: boolean;
  unpatch(): void;
}

function makePatch(object: any, property: string, original: Function, fn: Function): Patch {
  Object.assign(fn, original);
  (fn as any).toString = () => original.toString();
  const patch: Patch = {
    object, property, original,
    patchedFunction: fn,
    hasUnpatched: false,
    unpatch() { unpatch(this); },
  };
  (fn as any)._condenserPatch = patch;
  object[property] = fn;
  return patch;
}

function unpatch(patch: Patch): void {
  if (patch.hasUnpatched) return;
  let obj = patch.object;
  let prop: string = patch.property;
  while (obj[prop] && obj[prop] !== patch.patchedFunction) {
    obj = (obj[prop] as any)._condenserPatch;
    prop = 'original';
  }
  (obj as any)[prop] = (obj[prop] as any)._condenserPatch.original;
  patch.hasUnpatched = true;
}

export function beforePatch(
  object: any,
  property: string,
  handler: (args: any[]) => any,
): Patch {
  const original = object[property];
  let patch: Patch;
  const fn = function(this: any, ...args: any[]) {
    handler.call(this, args);
    return patch.original.call(this, ...args);
  };
  patch = makePatch(object, property, original, fn);
  return patch;
}

export function afterPatch(
  object: any,
  property: string,
  handler: (args: any[], ret: any) => any,
): Patch {
  const original = object[property];
  let patch: Patch;
  const fn = function(this: any, ...args: any[]) {
    let ret = patch.original.call(this, ...args);
    ret = handler.call(this, args, ret);
    return ret;
  };
  patch = makePatch(object, property, original, fn);
  return patch;
}

export function replacePatch(
  object: any,
  property: string,
  handler: (args: any[]) => any,
): Patch {
  const original = object[property];
  let patch: Patch;
  const fn = function(this: any, ...args: any[]) {
    const ret = handler.call(this, args);
    if ((ret as any) === callOriginal) return patch.original.call(this, ...args);
    return ret;
  };
  patch = makePatch(object, property, original, fn);
  return patch;
}

// Legacy alias — used internally; prefer afterPatch for new code.
export function wrapReturnValue(
  object: any,
  property: string,
  handler: (args: any[], returnValue: any) => any,
): void {
  const original = object[property];
  object[property] = function(this: any, ...args: any[]) {
    return handler.call(this, args, original.call(this, ...args));
  };
  object[property].toString = () => original.toString();
}
