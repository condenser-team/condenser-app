import type { CondenserNamespace } from './types.js';

export function getCondenser(): CondenserNamespace {
  return (window as any).__condenser;
}
