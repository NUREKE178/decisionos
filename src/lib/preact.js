// Single point of import for Preact + htm so every module resolves the
// exact same CDN module (avoids duplicate-instance hook errors) and the
// version can be bumped in one place.
import { h, render, Fragment, cloneElement } from "preact";
import {
  useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer,
} from "preact/hooks";
import htm from "htm";

export const html = htm.bind(h);
export {
  h, render, Fragment, cloneElement,
  useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect, useReducer,
};
