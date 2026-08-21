/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createPrototypeAuthPayload,
  isPrototypeToken,
  revivePrototypeUser,
} from './prototype-session';

test('createPrototypeAuthPayload creates a local auth payload for prototype login', () => {
  const payload = createPrototypeAuthPayload({
    email: 'demo@example.com',
    password: 'password123',
    username: 'demo',
    displayName: '原型用户',
  });

  assert.equal(isPrototypeToken(payload.token), true);
  assert.equal(payload.user.email, 'demo@example.com');
  assert.equal(payload.user.username, 'demo');
  assert.equal(payload.user.displayName, '原型用户');
});

test('revivePrototypeUser restores a Chinese demo user from a stored prototype token', () => {
  const user = revivePrototypeUser('prototype-token-demo');

  assert.equal(user.email, 'demo@memories.local');
  assert.equal(user.displayName, '相册体验用户');
});
