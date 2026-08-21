/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { validateAvatarFile, validatePhotoFile } from './upload-validation';

const createFileWithSize = (name: string, type: string, size: number) => {
  const file = new File([], name, { type });
  Object.defineProperty(file, 'size', { value: size });

  return file;
};

test('validatePhotoFile accepts image files up to 10 MB', () => {
  const file = createFileWithSize('photo.jpg', 'image/jpeg', 10 * 1024 * 1024);

  assert.equal(validatePhotoFile(file), null);
});

test('validatePhotoFile accepts video files up to 200 MB', () => {
  const file = createFileWithSize('clip.mp4', 'video/mp4', 200 * 1024 * 1024);

  assert.equal(validatePhotoFile(file), null);
});

test('validatePhotoFile rejects non-media files', () => {
  const file = new File(['hello'], 'notes.txt', {
    type: 'text/plain',
  });

  assert.equal(validatePhotoFile(file), '只能上传图片或视频文件');
});

test('validatePhotoFile rejects videos larger than 200 MB', () => {
  const file = createFileWithSize('clip.mp4', 'video/mp4', 200 * 1024 * 1024 + 1);

  assert.equal(validatePhotoFile(file), '单个视频不能超过 200 MB');
});

test('validateAvatarFile rejects images larger than 3 MB', () => {
  const file = createFileWithSize('avatar.png', 'image/png', 3 * 1024 * 1024 + 1);

  assert.equal(validateAvatarFile(file), '头像不能超过 3 MB');
});
