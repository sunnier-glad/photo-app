import assert from 'node:assert/strict';
import test from 'node:test';
import { sendEmailCodeBodySchema } from '../../src/modules/auth/auth.schemas.js';

test('sendEmailCodeBodySchema trims email before validation', () => {
  const result = sendEmailCodeBodySchema.parse({
    email: ' 1146427078@qq.com ',
  });

  assert.deepEqual(result, {
    email: '1146427078@qq.com',
  });
});

test('sendEmailCodeBodySchema rejects non-email values', () => {
  const result = sendEmailCodeBodySchema.safeParse({
    email: '1146427078',
  });

  assert.equal(result.success, false);
});
