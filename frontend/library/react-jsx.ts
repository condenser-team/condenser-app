import { getCondenser } from './condenser.js';

const R = getCondenser().core.React!;
export const Fragment = R.Fragment;

// jsx/jsxs receive (type, props, key) where props already contains children.
// Pass children via props.children — createElement picks them up from the config object.
function jsxFactory(type: any, props: any, key?: any) {
  return R.createElement(type, key !== undefined ? { ...props, key } : props);
}

export const jsx = jsxFactory;
export const jsxs = jsxFactory;

// jsxDEV receives (type, props, key, isStaticChildren, source, self).
// Ignore isStaticChildren/source/self — they are dev-only metadata, not children.
export const jsxDEV = (type: any, props: any, key?: any) => jsxFactory(type, props, key);
