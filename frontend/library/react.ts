import { getCondenser } from './condenser.js';

const R = getCondenser().core.React;
export default R;
export const {
  useState, useEffect, useRef, useCallback, useMemo,
  createContext, useContext, useReducer, Fragment,
  createElement, forwardRef, memo,
} = R;
