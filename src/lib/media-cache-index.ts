export type MediaCacheEntry = {
  objectKey: string;
  localPath: string;
  fileUri?: string;
  mimeType: string;
  size: number;
  createdAt: string;
  lastAccessedAt: string;
};

export type MediaCacheIndex = {
  entries: Record<string, MediaCacheEntry>;
};

export type MediaCacheStats = {
  entryCount: number;
  totalBytes: number;
};

export type MediaCacheEvictionResult = {
  index: MediaCacheIndex;
  removedObjectKeys: string[];
  stats: MediaCacheStats;
};

export const createEmptyMediaCacheIndex = (): MediaCacheIndex => ({
  entries: {},
});

export const getMediaCacheEntry = (index: MediaCacheIndex, objectKey: string) =>
  index.entries[objectKey];

export const upsertMediaCacheEntry = (
  index: MediaCacheIndex,
  entry: MediaCacheEntry,
): MediaCacheIndex => ({
  entries: {
    ...index.entries,
    [entry.objectKey]: entry,
  },
});

export const touchMediaCacheEntry = (
  index: MediaCacheIndex,
  objectKey: string,
  lastAccessedAt: string,
): MediaCacheIndex => {
  const entry = index.entries[objectKey];

  if (!entry) {
    return index;
  }

  return {
    entries: {
      ...index.entries,
      [objectKey]: {
        ...entry,
        lastAccessedAt,
      },
    },
  };
};

export const getMediaCacheStats = (index: MediaCacheIndex): MediaCacheStats => {
  const values = Object.values(index.entries);

  return {
    entryCount: values.length,
    totalBytes: values.reduce((sum, entry) => sum + entry.size, 0),
  };
};

export const getMediaCacheSize = (index: MediaCacheIndex) => getMediaCacheStats(index).totalBytes;

export const evictMediaCacheEntries = (
  index: MediaCacheIndex,
  maxBytes: number,
): MediaCacheEvictionResult => {
  const sortedEntries = Object.values(index.entries).sort((left, right) =>
    left.lastAccessedAt.localeCompare(right.lastAccessedAt),
  );
  const nextEntries = { ...index.entries };
  const removedObjectKeys: string[] = [];
  let totalBytes = getMediaCacheSize(index);

  for (const entry of sortedEntries) {
    if (totalBytes <= maxBytes) {
      break;
    }

    delete nextEntries[entry.objectKey];
    removedObjectKeys.push(entry.objectKey);
    totalBytes -= entry.size;
  }

  const nextIndex = {
    entries: nextEntries,
  };

  return {
    index: nextIndex,
    removedObjectKeys,
    stats: getMediaCacheStats(nextIndex),
  };
};
