import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import {
  createEmptyMediaCacheIndex,
  evictMediaCacheEntries,
  getMediaCacheEntry,
  touchMediaCacheEntry,
  upsertMediaCacheEntry,
  type MediaCacheIndex,
} from './media-cache-index';

export type CacheableMediaInput = {
  objectKey?: string | null;
  url: string;
  mimeType?: string | null;
};

type MediaCacheFileStat = {
  size: number;
  uri: string;
};

type MediaCacheAdapter = {
  convertFileSrc: (uri: string) => string;
  deleteFile: (path: string) => Promise<void>;
  downloadFile: (url: string, path: string) => Promise<void>;
  isAndroidNativeApp: () => boolean;
  mkdir: (path: string) => Promise<void>;
  now: () => string;
  readTextFile: (path: string) => Promise<string>;
  stat: (path: string) => Promise<MediaCacheFileStat>;
  writeTextFile: (path: string, data: string) => Promise<void>;
};

export const MEDIA_CACHE_ROOT_DIRECTORY = 'MemoriesCache';
export const MEDIA_CACHE_DIRECTORY = `${MEDIA_CACHE_ROOT_DIRECTORY}/media`;
export const MEDIA_CACHE_INDEX_PATH = `${MEDIA_CACHE_ROOT_DIRECTORY}/index.json`;
export const DEFAULT_MEDIA_CACHE_MAX_BYTES = 500 * 1024 * 1024;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

const createDefaultAdapter = (): MediaCacheAdapter => ({
  convertFileSrc: (uri) => Capacitor.convertFileSrc(uri),
  deleteFile: (path) =>
    Filesystem.deleteFile({
      path,
      directory: Directory.Data,
    }),
  downloadFile: async (url, path) => {
    await Filesystem.downloadFile({
      url,
      path,
      directory: Directory.Data,
      recursive: true,
    });
  },
  isAndroidNativeApp: () =>
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
  mkdir: (path) =>
    Filesystem.mkdir({
      path,
      directory: Directory.Data,
      recursive: true,
    }),
  now: () => new Date().toISOString(),
  readTextFile: async (path) => {
    const result = await Filesystem.readFile({
      path,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });

    return typeof result.data === 'string' ? result.data : String(result.data ?? '');
  },
  stat: async (path) => {
    const result = await Filesystem.stat({
      path,
      directory: Directory.Data,
    });

    return {
      size: Number(result.size ?? 0),
      uri: result.uri,
    };
  },
  writeTextFile: async (path, data) => {
    await Filesystem.writeFile({
      path,
      directory: Directory.Data,
      data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },
});

const getMimeExtension = (mimeType?: string | null) =>
  mimeType ? MIME_EXTENSIONS[mimeType.toLowerCase()] : undefined;

const getObjectKeyExtension = (objectKey: string) => {
  const match = objectKey.match(/\.([a-z0-9]{2,5})$/i);
  return match?.[1]?.toLowerCase();
};

const sanitizeFileBaseName = (objectKey: string) => {
  const candidate = objectKey.split('/').pop() ?? objectKey;
  const withoutExtension = candidate.replace(/\.[^.]+$/, '');
  const sanitized = withoutExtension
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return sanitized || 'media';
};

const createStableHash = (value: string) => {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
};

const createRelativeMediaPath = (objectKey: string, mimeType?: string | null) => {
  const extension = getObjectKeyExtension(objectKey) ?? getMimeExtension(mimeType) ?? 'bin';
  return `${MEDIA_CACHE_DIRECTORY}/${createStableHash(objectKey)}-${sanitizeFileBaseName(objectKey)}.${extension}`;
};

const isFileMissingError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /ENOENT|No such file or directory|does not exist|not found/i.test(message);
};

const removeIndexEntry = (index: MediaCacheIndex, objectKey: string): MediaCacheIndex => {
  if (!index.entries[objectKey]) {
    return index;
  }

  const nextEntries = { ...index.entries };
  delete nextEntries[objectKey];

  return {
    entries: nextEntries,
  };
};

export const createMediaCache = ({
  adapter = createDefaultAdapter(),
  maxBytes = DEFAULT_MEDIA_CACHE_MAX_BYTES,
}: {
  adapter?: MediaCacheAdapter;
  maxBytes?: number;
} = {}) => {
  let inMemoryIndex: MediaCacheIndex | null = null;
  let indexLoadPromise: Promise<MediaCacheIndex> | null = null;
  let mutationQueue = Promise.resolve();
  const pendingDownloads = new Map<string, Promise<void>>();

  const runExclusive = <T>(work: () => Promise<T>) => {
    const next = mutationQueue.then(work, work);
    mutationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };

  const toDisplayUrl = (fileUri?: string | null) =>
    fileUri ? adapter.convertFileSrc(fileUri) : null;

  const loadIndex = async () => {
    if (inMemoryIndex) {
      return inMemoryIndex;
    }

    if (!indexLoadPromise) {
      indexLoadPromise = (async () => {
        try {
          const raw = await adapter.readTextFile(MEDIA_CACHE_INDEX_PATH);
          const parsed = JSON.parse(raw) as MediaCacheIndex;
          inMemoryIndex =
            parsed && typeof parsed === 'object' && parsed.entries
              ? parsed
              : createEmptyMediaCacheIndex();
        } catch (error) {
          if (!isFileMissingError(error)) {
            console.warn('Failed to read media cache index, recreating it.', error);
          }

          inMemoryIndex = createEmptyMediaCacheIndex();
        }

        return inMemoryIndex;
      })();
    }

    return indexLoadPromise;
  };

  const saveIndex = async (index: MediaCacheIndex) => {
    inMemoryIndex = index;
    indexLoadPromise = Promise.resolve(index);
    await adapter.writeTextFile(MEDIA_CACHE_INDEX_PATH, JSON.stringify(index));
  };

  const ensureCacheDirectory = async () => {
    try {
      await adapter.mkdir(MEDIA_CACHE_DIRECTORY);
    } catch (error) {
      if (!/already|exist|EEXIST/i.test(String(error ?? ''))) {
        throw error;
      }
    }
  };

  const getCachedMediaDisplayUrlSync = (input: CacheableMediaInput) => {
    if (!adapter.isAndroidNativeApp() || !input.objectKey || !inMemoryIndex) {
      return null;
    }

    return toDisplayUrl(getMediaCacheEntry(inMemoryIndex, input.objectKey)?.fileUri);
  };

  const getCachedMediaDisplayUrl = async (input: CacheableMediaInput) => {
    if (!adapter.isAndroidNativeApp() || !input.objectKey) {
      return null;
    }

    const syncUrl = getCachedMediaDisplayUrlSync(input);
    if (syncUrl) {
      return syncUrl;
    }

    const index = await loadIndex();
    const entry = getMediaCacheEntry(index, input.objectKey ?? '');

    if (!entry) {
      return null;
    }

    try {
      const stat = await adapter.stat(entry.localPath);
      const nextIndex = upsertMediaCacheEntry(index, {
        ...entry,
        fileUri: stat.uri,
        lastAccessedAt: adapter.now(),
      });
      inMemoryIndex = nextIndex;
      void runExclusive(async () => {
        await saveIndex(nextIndex);
      });
      return adapter.convertFileSrc(stat.uri);
    } catch (error) {
      if (!isFileMissingError(error)) {
        console.warn('Failed to stat cached media file.', error);
      }

      await runExclusive(async () => {
        await saveIndex(removeIndexEntry(index, input.objectKey ?? ''));
      });
      return null;
    }
  };

  const prefetchMediaAsset = async (input: CacheableMediaInput) => {
    if (!adapter.isAndroidNativeApp() || !input.objectKey || !input.url) {
      return;
    }

    const existingTask = pendingDownloads.get(input.objectKey);
    if (existingTask) {
      return existingTask;
    }

    const task = runExclusive(async () => {
      let index = await loadIndex();
      const existingEntry = getMediaCacheEntry(index, input.objectKey ?? '');

      if (existingEntry) {
        if (existingEntry.fileUri) {
          const touchedIndex = touchMediaCacheEntry(index, input.objectKey ?? '', adapter.now());
          inMemoryIndex = touchedIndex;
          await saveIndex(touchedIndex);
          return;
        }

        try {
          const stat = await adapter.stat(existingEntry.localPath);
          const touchedIndex = upsertMediaCacheEntry(index, {
            ...existingEntry,
            fileUri: stat.uri,
            lastAccessedAt: adapter.now(),
          });
          inMemoryIndex = touchedIndex;
          await saveIndex(touchedIndex);
          return;
        } catch (error) {
          if (!isFileMissingError(error)) {
            console.warn('Failed to reuse cached media file.', error);
          }

          index = removeIndexEntry(index, input.objectKey ?? '');
          await saveIndex(index);
        }
      }

      await ensureCacheDirectory();

      const localPath = createRelativeMediaPath(input.objectKey ?? '', input.mimeType);
      await adapter.downloadFile(input.url, localPath);
      const stat = await adapter.stat(localPath);
      const timestamp = adapter.now();
      const nextIndex = upsertMediaCacheEntry(index, {
        objectKey: input.objectKey ?? '',
        localPath,
        fileUri: stat.uri,
        mimeType: input.mimeType ?? 'application/octet-stream',
        size: stat.size,
        createdAt: existingEntry?.createdAt ?? timestamp,
        lastAccessedAt: timestamp,
      });
      const evictionResult = evictMediaCacheEntries(nextIndex, maxBytes);

      for (const removedObjectKey of evictionResult.removedObjectKeys) {
        const removedEntry = nextIndex.entries[removedObjectKey];

        if (!removedEntry) {
          continue;
        }

        try {
          await adapter.deleteFile(removedEntry.localPath);
        } catch (error) {
          if (!isFileMissingError(error)) {
            console.warn('Failed to evict cached media file.', error);
          }
        }
      }

      await saveIndex(evictionResult.index);
    });

    pendingDownloads.set(
      input.objectKey,
      task.finally(() => {
        pendingDownloads.delete(input.objectKey ?? '');
      }),
    );

    return pendingDownloads.get(input.objectKey);
  };

  const resolveMediaDisplayUrl = async (input: CacheableMediaInput) => {
    const localUrl = await getCachedMediaDisplayUrl(input);

    if (localUrl) {
      return localUrl;
    }

    void prefetchMediaAsset(input).catch(() => undefined);
    return input.url;
  };

  return {
    getCachedMediaDisplayUrlSync,
    getCachedMediaDisplayUrl,
    hydrateIndex: loadIndex,
    prefetchMediaAsset,
    resolveMediaDisplayUrl,
    resetForTests: () => {
      inMemoryIndex = null;
      indexLoadPromise = null;
      mutationQueue = Promise.resolve();
      pendingDownloads.clear();
    },
  };
};

const mediaCache = createMediaCache();

export const getCachedMediaDisplayUrlSync = mediaCache.getCachedMediaDisplayUrlSync;
export const getCachedMediaDisplayUrl = mediaCache.getCachedMediaDisplayUrl;
export const hydrateMediaCacheIndex = mediaCache.hydrateIndex;
export const prefetchMediaAsset = mediaCache.prefetchMediaAsset;
export const resolveMediaDisplayUrl = mediaCache.resolveMediaDisplayUrl;
