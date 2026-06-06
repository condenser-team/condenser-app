
import { afterPatch } from './patch.js';
import { wrapReactClass, wrapReactType } from './tree.js';

export type NodeStep = (node: any) => any;
export type PatchHandler = (args: any[], returnValue: any) => any;

// creates a chained afterPatch handler that traverses
// a React element tree step-by-step and patches the component found at each stage.
// Each step is a finder function (node) => targetNode; the final step applies handler.
// Per-step caches prevent re-patching the same component type on repeated renders.

function patchComponent(
  node: any,
  handler: PatchHandler,
  steps: NodeStep[],
  step: number,
  caches: Map<any, any>[],
  prop: string = 'type',
): void {
  const next = steps[step + 1] ? makeStepHandler(handler, steps, step + 1, caches) : handler;
  switch (typeof node?.[prop]) {
    case 'function':
      afterPatch(node, prop, next);
      break;
    case 'object':
      if (node[prop]?.prototype?.render) {
        wrapReactClass(node, prop);
        afterPatch(node[prop].prototype, 'render', next);
      } else {
        wrapReactType(node, prop);
        patchComponent(node[prop], handler, steps, step, caches, node[prop]?.render ? 'render' : 'type');
      }
      break;
    default:
      console.warn('[condenser] treepatcher: unhandled component type at step', step, node);
  }
}

function runStep(
  tree: any,
  handler: PatchHandler,
  steps: NodeStep[],
  step: number,
  caches: Map<any, any>[],
): any {
  const cache = (caches[step] ??= new Map());
  const node  = steps[step](tree);

  if (!node) return tree;
  if (!node.type) {
    console.warn('[condenser] treepatcher: step', step, 'found node without type');
    return tree;
  }

  const cached = cache.get(node.type);
  if (cached) {
    node.type = cached;
    return tree;
  }

  const original = node.type;
  patchComponent(node, handler, steps, step, caches);
  cache.set(original, node.type);
  return tree;
}

function makeStepHandler(
  handler: PatchHandler,
  steps: NodeStep[],
  step: number,
  caches: Map<any, any>[],
): PatchHandler {
  return (_args: any[], tree: any) => runStep(tree, handler, steps, step, caches);
}

export function createReactTreePatcher(steps: NodeStep[], handler: PatchHandler): PatchHandler {
  return makeStepHandler(handler, steps, 0, []);
}
