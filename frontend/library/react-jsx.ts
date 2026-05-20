import { getCondenser } from './condenser.js';

const R = getCondenser().core.React!;
export const jsx = R.createElement;
export const jsxs = R.createElement;
export const jsxDEV = R.createElement;
export const Fragment = R.Fragment;
