import assert from 'node:assert/strict';
import test from 'node:test';
import { getNextDeletedPhotoAfterAction } from './cleanup-viewer';

test('getNextDeletedPhotoAfterAction picks the next available deleted photo', () => {
  assert.equal(getNextDeletedPhotoAfterAction(['a', 'b', 'c'], 'b'), 'c');
  assert.equal(getNextDeletedPhotoAfterAction(['a', 'b', 'c'], 'c'), 'b');
  assert.equal(getNextDeletedPhotoAfterAction(['only'], 'only'), null);
  assert.equal(getNextDeletedPhotoAfterAction(['a', 'b'], 'missing'), null);
});
