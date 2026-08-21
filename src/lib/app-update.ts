/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';

import { DEFAULT_UPDATE_MANIFEST_URL, resolveRuntimeUrl } from './public-runtime-config';

export type AppVersion = {
  versionCode: number;
  versionName: string;
};

export type UpdateManifest = AppVersion & {
  apkUrl: string;
  releaseNotes: string[];
};

export const CURRENT_APP_VERSION: AppVersion = {
  versionCode: 52,
  versionName: '1.6.9',
};

const importMeta = import.meta as ImportMeta & {
  env?: {
    VITE_UPDATE_MANIFEST_URL?: string;
  };
};

export const UPDATE_MANIFEST_URL = resolveRuntimeUrl(
  importMeta.env?.VITE_UPDATE_MANIFEST_URL,
  DEFAULT_UPDATE_MANIFEST_URL,
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeUpdateManifest = (value: unknown): UpdateManifest => {
  if (!isRecord(value)) {
    throw new Error('版本清单格式无效');
  }

  const { versionCode, versionName, apkUrl, releaseNotes } = value;

  if (typeof versionCode !== 'number' || !Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error('版本号无效');
  }

  if (typeof versionName !== 'string' || !versionName.trim()) {
    throw new Error('版本名称无效');
  }

  if (typeof apkUrl !== 'string' || !/^https?:\/\//.test(apkUrl)) {
    throw new Error('安装包地址无效');
  }

  if (
    !Array.isArray(releaseNotes) ||
    releaseNotes.some((note) => typeof note !== 'string' || !note.trim())
  ) {
    throw new Error('更新说明无效');
  }

  return {
    versionCode,
    versionName: versionName.trim(),
    apkUrl,
    releaseNotes: releaseNotes.map((note) => note.trim()),
  };
};

export const getAvailableUpdate = (manifest: UpdateManifest) =>
  manifest.versionCode > CURRENT_APP_VERSION.versionCode ? manifest : null;

export const fetchUpdateManifest = async (
  manifestUrl = UPDATE_MANIFEST_URL,
): Promise<UpdateManifest> => {
  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.get({
      url: manifestUrl,
      responseType: 'json',
      connectTimeout: 10000,
      readTimeout: 10000,
      headers: {
        'Cache-Control': 'no-store',
      },
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`版本检查失败，状态码 ${response.status}`);
    }

    return normalizeUpdateManifest(response.data);
  }

  const response = await fetch(manifestUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`版本检查失败，状态码 ${response.status}`);
  }

  return normalizeUpdateManifest(await response.json());
};

export const fetchAvailableUpdate = async (
  manifestUrl = UPDATE_MANIFEST_URL,
): Promise<UpdateManifest | null> => {
  return getAvailableUpdate(await fetchUpdateManifest(manifestUrl));
};
