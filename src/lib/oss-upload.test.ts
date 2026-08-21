/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ApiImageUploadToken } from '../types';
import { uploadFileToOss } from './oss-upload';

const token: ApiImageUploadToken = {
  host: 'https://oss.example.com',
  objectKey: 'photos/image.jpg',
  policy: 'encoded-policy',
  signature: 'signed-value',
  accessKeyId: 'access-key-id',
  xOssDate: '20260603T120000Z',
  xOssCredential: 'access-key-id/20260603/cn-huhehaote/oss/aliyun_v4_request',
  signatureVersion: 'OSS4-HMAC-SHA256',
  successActionStatus: '200',
};

test('uploadFileToOss posts the expected OSS form fields', async () => {
  const file = new File(['image'], 'image.jpg', {
    type: 'image/jpeg',
  });
  let requestUrl = '';
  let requestForm: FormData | null = null;
  const fetchImpl: typeof fetch = async (url, init) => {
    requestUrl = String(url);
    requestForm = init?.body as FormData;
    return new Response(null, { status: 204 });
  };

  await uploadFileToOss(token, file, { fetchImpl });

  assert.equal(requestUrl, token.host);
  assert.ok(requestForm);
  assert.equal(requestForm.get('key'), token.objectKey);
  assert.equal(requestForm.get('policy'), token.policy);
  assert.equal(requestForm.get('x-oss-date'), token.xOssDate);
  assert.equal(requestForm.get('x-oss-credential'), token.xOssCredential);
  assert.equal(requestForm.get('x-oss-signature-version'), token.signatureVersion);
  assert.equal(requestForm.get('x-oss-signature'), token.signature);
  assert.equal(requestForm.get('success_action_status'), token.successActionStatus);
  assert.equal(requestForm.get('Content-Type'), file.type);
  assert.equal(requestForm.get('file'), file);
});

test('uploadFileToOss throws a Chinese error when OSS returns non-2xx', async () => {
  const file = new File(['image'], 'image.jpg', {
    type: 'image/jpeg',
  });
  const fetchImpl: typeof fetch = async () => new Response(null, { status: 500 });

  await assert.rejects(
    () => uploadFileToOss(token, file, { fetchImpl }),
    /上传到云端失败，请检查网络后重试/,
  );
});
