/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CURRENT_APP_VERSION,
  getAvailableUpdate,
  normalizeUpdateManifest,
} from './app-update';

test('getAvailableUpdate returns only newer versions', () => {
  const sameVersion = getAvailableUpdate({
    versionCode: CURRENT_APP_VERSION.versionCode,
    versionName: CURRENT_APP_VERSION.versionName,
    apkUrl: 'https://example.com/memories/app-debug.apk',
    releaseNotes: ['当前版本'],
  });

  const newerVersion = getAvailableUpdate({
    versionCode: CURRENT_APP_VERSION.versionCode + 1,
    versionName: '1.3.0',
    apkUrl: 'https://example.com/memories/app-debug.apk',
    releaseNotes: ['新增版本更新提示'],
  });

  assert.equal(sameVersion, null);
  assert.equal(newerVersion?.versionName, '1.3.0');
});

test('normalizeUpdateManifest rejects incomplete manifests', () => {
  assert.throws(
    () =>
      normalizeUpdateManifest({
        versionCode: 21,
        versionName: '1.3.8',
        apkUrl: '',
        releaseNotes: ['新增版本更新提示'],
      }),
    /安装包地址无效/,
  );
});

test('normalizeUpdateManifest accepts the public apk manifest shape', () => {
  const manifest = normalizeUpdateManifest({
    versionCode: 21,
    versionName: '1.3.8',
    apkUrl: 'https://example.com/memories/app-debug.apk',
    releaseNotes: ['新增手机端版本更新提示', '支持从公网服务器下载新版安装包'],
  });

  assert.equal(manifest.versionCode, 21);
  assert.equal(manifest.releaseNotes.length, 2);
});
