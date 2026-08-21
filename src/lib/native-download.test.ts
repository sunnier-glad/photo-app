import assert from 'node:assert/strict';
import test from 'node:test';
import { createDownloadFileName, getNativeDownloadErrorMessage } from './native-download';

test('createDownloadFileName keeps an existing safe extension', () => {
  assert.equal(createDownloadFileName('rose.jpg', 'image/png'), 'rose.jpg');
});

test('createDownloadFileName removes path separators and illegal characters', () => {
  assert.equal(createDownloadFileName('folder\\bad:name?.jpg', 'image/jpeg'), 'folder-bad-name-.jpg');
});

test('createDownloadFileName adds an extension from the mime type', () => {
  assert.equal(createDownloadFileName('shared-memory', 'image/webp'), 'shared-memory.webp');
});

test('createDownloadFileName falls back to a default photo name', () => {
  assert.equal(createDownloadFileName('', 'image/jpeg'), 'shared-photo.jpg');
});

test('getNativeDownloadErrorMessage maps missing directory errors to Chinese', () => {
  assert.equal(
    getNativeDownloadErrorMessage(
      new Error('open failed: ENOENT (No such file or directory)'),
    ),
    '保存目录创建失败，请重新打开应用后再试',
  );
});

test('getNativeDownloadErrorMessage maps permission errors to Chinese', () => {
  assert.equal(
    getNativeDownloadErrorMessage(new Error('Permission denied')),
    '没有本地存储权限，请允许权限后重试',
  );
});
