/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const createPersonalId = (source: string) => {
  const normalizedSource = source.trim().toLowerCase() || 'memories-user';
  let hash = 0;

  for (let index = 0; index < normalizedSource.length; index += 1) {
    hash = (hash * 31 + normalizedSource.charCodeAt(index)) >>> 0;
  }

  return `u${String(hash % 1_000_000).padStart(6, '0')}`;
};
