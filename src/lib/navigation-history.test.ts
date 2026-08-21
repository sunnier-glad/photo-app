/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { popNavigationHistory, pushNavigationHistory } from './navigation-history';

test('pushNavigationHistory records one previous tab per real tab change', () => {
  const emptyHistory: string[] = [];

  assert.deepEqual(pushNavigationHistory(emptyHistory, 'albums', 'cleanup'), ['albums']);
  assert.deepEqual(pushNavigationHistory(['albums'], 'cleanup', 'cleanup'), ['albums']);
  assert.deepEqual(pushNavigationHistory(['albums'], 'cleanup', 'profile'), [
    'albums',
    'cleanup',
  ]);
});

test('popNavigationHistory returns the latest previous tab and remaining history', () => {
  assert.deepEqual(popNavigationHistory(['albums', 'cleanup', 'contacts']), {
    previous: 'contacts',
    history: ['albums', 'cleanup'],
  });

  assert.deepEqual(popNavigationHistory([]), {
    previous: null,
    history: [],
  });
});
