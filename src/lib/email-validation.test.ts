/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeEmailInput, validateEmailInput } from './email-validation';

test('normalizeEmailInput trims surrounding whitespace', () => {
  assert.equal(normalizeEmailInput(' 1146427078@qq.com '), '1146427078@qq.com');
});

test('validateEmailInput accepts a normalized email address', () => {
  assert.equal(validateEmailInput(' 1146427078@qq.com '), null);
});

test('validateEmailInput rejects a QQ number without email domain', () => {
  assert.equal(validateEmailInput('1146427078'), '请输入正确的邮箱地址');
});
