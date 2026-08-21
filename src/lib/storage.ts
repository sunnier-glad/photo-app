/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const TOKEN_STORAGE_KEY = 'memories.authToken';

const hasWindow = () => typeof window !== 'undefined';

export const getStoredToken = () => {
  if (!hasWindow()) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
};

export const setStoredToken = (token: string) => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
};

export const clearStoredToken = () => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
};
