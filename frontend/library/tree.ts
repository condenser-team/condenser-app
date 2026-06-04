
// Returns the React fiber instance (__reactFiber$*) attached to a DOM element.
export function getReactInstance(element: Element): any {
  const key = Object.keys(element).find(
    k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance'),
  );
  return key ? (element as any)[key] : null;
}

// Wraps node[prop] in a plain object copy so patches don't mutate the original type.
// Marks the wrapper with _condenserWrapped to avoid double-wrapping.
export function wrapReactType(node: any, prop: string = 'type'): any {
  if (node[prop]?._condenserWrapped) return node[prop];
  return (node[prop] = { ...node[prop], _condenserWrapped: true });
}

// Wraps node[prop] (a class component) in an anonymous subclass so patches target the
// subclass without affecting any other render paths that share the original class.
export function wrapReactClass(node: any, prop: string = 'type'): any {
  if (node[prop]?._condenserWrapped) return node[prop];
  const cls = node[prop];
  const wrapped = class extends cls { static _condenserWrapped = true; };
  return (node[prop] = wrapped);
}

function findInTree(node: any, filter: (n: any) => boolean, walkKeys: string[]): any {
  if (!node || typeof node !== 'object') return null;
  if (filter(node)) return node;
  if (Array.isArray(node)) return node.map((x: any) => findInTree(x, filter, walkKeys)).find(Boolean) ?? null;
  return walkKeys.map(k => findInTree(node[k], filter, walkKeys)).find(Boolean) ?? null;
}

export function findInFiberTree(node: any, filter: (n: any) => boolean): any {
  return findInTree(node, filter, ['child', 'sibling']);
}

export function findInElementTree(node: any, filter: (n: any) => boolean): any {
  return findInTree(node, filter, ['props', 'children', 'child', 'sibling']);
}

export function getReactFiberRoot(element: any): any {
  const key = Object.keys(element).find((k: string) => k.startsWith('__reactContainer$'));
  return key ? element[key] : element['_reactRootContainer']?._internalRoot?.current;
}
