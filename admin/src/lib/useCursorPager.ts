import { useCallback, useState } from 'react';

type Cursor = number | undefined;

/**
 * Page-by-page navigation over the API's `before` / `nextBefore` cursor lists.
 * Keeps a stack of cursors so "previous" works without a server-side offset.
 * The stack starts over whenever `resetKey` (e.g. the serialised filters) changes.
 */
export function useCursorPager(resetKey = '') {
  const [state, setState] = useState<{ key: string; stack: Cursor[] }>({ key: resetKey, stack: [undefined] });
  const stack = state.key === resetKey ? state.stack : [undefined];
  const page = stack.length - 1;

  const next = useCallback(
    (nextBefore: number | null | undefined) => {
      if (nextBefore === null || nextBefore === undefined) return;
      setState((s) => ({ key: resetKey, stack: [...(s.key === resetKey ? s.stack : [undefined]), nextBefore] }));
    },
    [resetKey],
  );
  const prev = useCallback(
    () =>
      setState((s) => {
        const cur = s.key === resetKey ? s.stack : [undefined];
        return { key: resetKey, stack: cur.length > 1 ? cur.slice(0, -1) : cur };
      }),
    [resetKey],
  );
  const reset = useCallback(() => setState({ key: resetKey, stack: [undefined] }), [resetKey]);

  return { page, before: stack[page], hasPrev: page > 0, next, prev, reset };
}
