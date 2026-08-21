/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiImageUploadToken } from '../types';

export interface UploadFileToOssOptions {
  fetchImpl?: typeof fetch;
}

export const uploadFileToOss = async (
  token: ApiImageUploadToken,
  file: File,
  options: UploadFileToOssOptions = {},
): Promise<void> => {
  const formData = new FormData();
  formData.append('key', token.objectKey);
  formData.append('policy', token.policy);
  formData.append('x-oss-date', token.xOssDate);
  formData.append('x-oss-credential', token.xOssCredential);
  formData.append('x-oss-signature-version', token.signatureVersion);
  formData.append('x-oss-signature', token.signature);
  formData.append('success_action_status', token.successActionStatus);
  formData.append('Content-Type', file.type);
  formData.append('file', file);

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(token.host, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('上传到云端失败，请检查网络后重试');
  }
};
