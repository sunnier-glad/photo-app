/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextPhotoAfterDelete, getSwipeDirection, getWrappedPhotoIndex } from './photo-navigation';

test('getWrappedPhotoIndex loops through album photo indexes', () => {
  assert.equal(getWrappedPhotoIndex(1, 3), 1);
  assert.equal(getWrappedPhotoIndex(3, 3), 0);
  assert.equal(getWrappedPhotoIndex(-1, 3), 2);
  assert.equal(getWrappedPhotoIndex(4, 3), 1);
  assert.equal(getWrappedPhotoIndex(0, 0), 0);
});

test('getSwipeDirection follows the album gesture mapping', () => {
  assert.equal(getSwipeDirection(80), 1);
  assert.equal(getSwipeDirection(-80), -1);
  assert.equal(getSwipeDirection(50), 1);
  assert.equal(getSwipeDirection(-50), -1);
  assert.equal(getSwipeDirection(20), 0);
  assert.equal(getSwipeDirection(-20), 0);
});

test('getNextPhotoAfterDelete selects the next available photo', () => {
  assert.equal(getNextPhotoAfterDelete(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(getNextPhotoAfterDelete(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(getNextPhotoAfterDelete(['a'], 'a'), null);
  assert.equal(getNextPhotoAfterDelete(['a', 'b'], 'x'), null);
});
