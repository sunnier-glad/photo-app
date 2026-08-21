import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEDIA_CACHE_INDEX_PATH,
  createMediaCache,
  type CacheableMediaInput,
} from './media-cache';

const createAdapterHarness = ({
  isAndroidNativeApp = true,
  sizeByUrl = {},
}: {
  isAndroidNativeApp?: boolean;
  sizeByUrl?: Record<string, number>;
} = {}) => {
  const textFiles = new Map<string, string>();
  const mediaFiles = new Map<string, { size: number; uri: string }>();
  const deletedPaths: string[] = [];
  const downloadedPaths: string[] = [];
  let statCallCount = 0;
  const timestamps = [
    '2026-06-04T08:00:00.000Z',
    '2026-06-04T09:00:00.000Z',
    '2026-06-04T10:00:00.000Z',
    '2026-06-04T11:00:00.000Z',
    '2026-06-04T12:00:00.000Z',
  ];

  return {
    deletedPaths,
    downloadedPaths,
    mediaFiles,
    getStatCallCount: () => statCallCount,
    textFiles,
    adapter: {
      convertFileSrc: (uri: string) => `converted:${uri}`,
      deleteFile: async (path: string) => {
        deletedPaths.push(path);
        mediaFiles.delete(path);
      },
      downloadFile: async (url: string, path: string) => {
        downloadedPaths.push(path);
        mediaFiles.set(path, {
          size: sizeByUrl[url] ?? 128,
          uri: `file:///data/user/0/app/${path}`,
        });
      },
      isAndroidNativeApp: () => isAndroidNativeApp,
      mkdir: async () => undefined,
      now: () => timestamps.shift() ?? '2026-06-04T13:00:00.000Z',
      readTextFile: async (path: string) => {
        const value = textFiles.get(path);
        if (!value) {
          throw new Error(`ENOENT: ${path}`);
        }
        return value;
      },
      stat: async (path: string) => {
        statCallCount += 1;
        const value = mediaFiles.get(path);
        if (!value) {
          throw new Error(`ENOENT: ${path}`);
        }
        return value;
      },
      writeTextFile: async (path: string, data: string) => {
        textFiles.set(path, data);
      },
    },
  };
};

const sampleMedia: CacheableMediaInput = {
  objectKey: 'albums/a/photo-1.jpg',
  url: 'https://oss.example.com/albums/a/photo-1.jpg',
  mimeType: 'image/jpeg',
};

test('resolveMediaDisplayUrl returns remote first and local on later hit', async () => {
  const harness = createAdapterHarness();
  const cache = createMediaCache({ adapter: harness.adapter, maxBytes: 1024 });

  assert.equal(await cache.resolveMediaDisplayUrl(sampleMedia), sampleMedia.url);
  await cache.prefetchMediaAsset(sampleMedia);

  const localUrl = await cache.resolveMediaDisplayUrl(sampleMedia);

  assert.match(localUrl, /^converted:file:\/\//);
  assert.equal(harness.downloadedPaths.length, 1);
});

test('getCachedMediaDisplayUrl clears stale entries when file is missing', async () => {
  const harness = createAdapterHarness();
  harness.textFiles.set(
    MEDIA_CACHE_INDEX_PATH,
    JSON.stringify({
      entries: {
        [sampleMedia.objectKey!]: {
          objectKey: sampleMedia.objectKey,
          localPath: 'MemoriesCache/media/stale.jpg',
          mimeType: 'image/jpeg',
          size: 128,
          createdAt: '2026-06-04T08:00:00.000Z',
          lastAccessedAt: '2026-06-04T08:00:00.000Z',
        },
      },
    }),
  );

  const cache = createMediaCache({ adapter: harness.adapter, maxBytes: 1024 });
  const result = await cache.getCachedMediaDisplayUrl(sampleMedia);

  assert.equal(result, null);
  assert.deepEqual(JSON.parse(harness.textFiles.get(MEDIA_CACHE_INDEX_PATH) ?? '{}'), {
    entries: {},
  });
});

test('prefetchMediaAsset evicts least recently used files over the size cap', async () => {
  const harness = createAdapterHarness({
    sizeByUrl: {
      'https://oss.example.com/old.jpg': 320,
      'https://oss.example.com/new.jpg': 260,
    },
  });
  const cache = createMediaCache({ adapter: harness.adapter, maxBytes: 400 });

  await cache.prefetchMediaAsset({
    objectKey: 'albums/a/old.jpg',
    url: 'https://oss.example.com/old.jpg',
    mimeType: 'image/jpeg',
  });
  await cache.prefetchMediaAsset({
    objectKey: 'albums/a/new.jpg',
    url: 'https://oss.example.com/new.jpg',
    mimeType: 'image/jpeg',
  });

  const persistedIndex = JSON.parse(harness.textFiles.get(MEDIA_CACHE_INDEX_PATH) ?? '{}');

  assert.equal(Object.keys(persistedIndex.entries).length, 1);
  assert.ok(persistedIndex.entries['albums/a/new.jpg']);
  assert.equal(harness.deletedPaths.length, 1);
});

test('resolveMediaDisplayUrl stays remote outside Android native app', async () => {
  const harness = createAdapterHarness({ isAndroidNativeApp: false });
  const cache = createMediaCache({ adapter: harness.adapter, maxBytes: 1024 });

  assert.equal(await cache.resolveMediaDisplayUrl(sampleMedia), sampleMedia.url);
  assert.equal(harness.downloadedPaths.length, 0);
});

test('getCachedMediaDisplayUrlSync returns local url immediately for hydrated list cache entries', async () => {
  const harness = createAdapterHarness();
  harness.textFiles.set(
    MEDIA_CACHE_INDEX_PATH,
    JSON.stringify({
      entries: {
        [sampleMedia.objectKey!]: {
          objectKey: sampleMedia.objectKey,
          localPath: 'MemoriesCache/media/photo-1.jpg',
          fileUri: 'file:///data/user/0/app/MemoriesCache/media/photo-1.jpg',
          mimeType: 'image/jpeg',
          size: 128,
          createdAt: '2026-06-04T08:00:00.000Z',
          lastAccessedAt: '2026-06-04T08:00:00.000Z',
        },
      },
    }),
  );

  const cache = createMediaCache({ adapter: harness.adapter, maxBytes: 1024 });
  await cache.hydrateIndex();

  assert.equal(
    cache.getCachedMediaDisplayUrlSync(sampleMedia),
    'converted:file:///data/user/0/app/MemoriesCache/media/photo-1.jpg',
  );
  assert.equal(harness.getStatCallCount(), 0);
});
