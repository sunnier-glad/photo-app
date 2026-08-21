import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyMediaCacheIndex,
  evictMediaCacheEntries,
  getMediaCacheEntry,
  getMediaCacheStats,
  touchMediaCacheEntry,
  upsertMediaCacheEntry,
  type MediaCacheEntry,
} from './media-cache-index';

test('upsertMediaCacheEntry stores a new cache record by objectKey', () => {
  const index = createEmptyMediaCacheIndex();

  const next = upsertMediaCacheEntry(index, {
    objectKey: 'albums/a/p1.jpg',
    localPath: 'MemoriesCache/media/p1.jpg',
    mimeType: 'image/jpeg',
    size: 120,
    createdAt: '2026-06-04T10:00:00.000Z',
    lastAccessedAt: '2026-06-04T10:00:00.000Z',
  });

  assert.equal(
    getMediaCacheEntry(next, 'albums/a/p1.jpg')?.localPath,
    'MemoriesCache/media/p1.jpg',
  );
  assert.equal(getMediaCacheEntry(index, 'albums/a/p1.jpg'), undefined);
});

test('touchMediaCacheEntry updates lastAccessedAt without changing objectKey', () => {
  const index = {
    entries: {
      'albums/a/p1.jpg': {
        objectKey: 'albums/a/p1.jpg',
        localPath: 'MemoriesCache/media/p1.jpg',
        mimeType: 'image/jpeg',
        size: 120,
        createdAt: '2026-06-04T10:00:00.000Z',
        lastAccessedAt: '2026-06-04T10:00:00.000Z',
      },
    },
  };

  const next = touchMediaCacheEntry(index, 'albums/a/p1.jpg', '2026-06-04T11:00:00.000Z');

  assert.equal(next.entries['albums/a/p1.jpg']?.objectKey, 'albums/a/p1.jpg');
  assert.equal(next.entries['albums/a/p1.jpg']?.lastAccessedAt, '2026-06-04T11:00:00.000Z');
  assert.equal(index.entries['albums/a/p1.jpg']?.lastAccessedAt, '2026-06-04T10:00:00.000Z');
});

test('getMediaCacheStats returns entry count and total bytes', () => {
  const index = {
    entries: {
      a: {
        objectKey: 'a',
        localPath: 'a.jpg',
        mimeType: 'image/jpeg',
        size: 120,
        createdAt: '2026-06-04T08:00:00.000Z',
        lastAccessedAt: '2026-06-04T08:00:00.000Z',
      },
      b: {
        objectKey: 'b',
        localPath: 'b.jpg',
        mimeType: 'image/jpeg',
        size: 260,
        createdAt: '2026-06-04T09:00:00.000Z',
        lastAccessedAt: '2026-06-04T09:00:00.000Z',
      },
    } satisfies Record<string, MediaCacheEntry>,
  };

  assert.deepEqual(getMediaCacheStats(index), {
    entryCount: 2,
    totalBytes: 380,
  });
});

test('evictMediaCacheEntries removes least recently used entries until size fits', () => {
  const base = {
    entries: {
      old: {
        objectKey: 'old',
        localPath: 'old.jpg',
        mimeType: 'image/jpeg',
        size: 300,
        createdAt: '2026-06-04T08:00:00.000Z',
        lastAccessedAt: '2026-06-04T08:00:00.000Z',
      },
      recent: {
        objectKey: 'recent',
        localPath: 'recent.jpg',
        mimeType: 'image/jpeg',
        size: 260,
        createdAt: '2026-06-04T09:00:00.000Z',
        lastAccessedAt: '2026-06-04T09:00:00.000Z',
      },
      newest: {
        objectKey: 'newest',
        localPath: 'newest.jpg',
        mimeType: 'image/jpeg',
        size: 100,
        createdAt: '2026-06-04T10:00:00.000Z',
        lastAccessedAt: '2026-06-04T10:00:00.000Z',
      },
    } satisfies Record<string, MediaCacheEntry>,
  };

  const result = evictMediaCacheEntries(base, 360);

  assert.deepEqual(result.removedObjectKeys, ['old']);
  assert.equal(result.index.entries.old, undefined);
  assert.equal(result.index.entries.recent?.localPath, 'recent.jpg');
  assert.equal(result.index.entries.newest?.localPath, 'newest.jpg');
  assert.deepEqual(result.stats, {
    entryCount: 2,
    totalBytes: 360,
  });
});
