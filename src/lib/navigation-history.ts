/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const MAX_NAVIGATION_HISTORY = 20;

export function pushNavigationHistory<T>(
  history: T[],
  current: T,
  next: T,
): T[] {
  if (current === next) {
    return history;
  }

  return [...history, current].slice(-MAX_NAVIGATION_HISTORY);
}

export function popNavigationHistory<T>(history: T[]): {
  previous: T | null;
  history: T[];
} {
  if (history.length === 0) {
    return {
      previous: null,
      history: [],
    };
  }

  return {
    previous: history[history.length - 1],
    history: history.slice(0, -1),
  };
}
