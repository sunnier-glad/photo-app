import { useEffect, useState } from 'react';
import {
  getCachedMediaDisplayUrl,
  getCachedMediaDisplayUrlSync,
  hydrateMediaCacheIndex,
  prefetchMediaAsset,
  type CacheableMediaInput,
} from '../lib/media-cache';

export type CachedMediaSourceInput = CacheableMediaInput | null | undefined;

export type CachedMediaSourceMode = 'list' | 'viewer';

export const useCachedMediaSource = (
  media: CachedMediaSourceInput,
  mode: CachedMediaSourceMode = 'viewer',
) => {
  const fallbackUrl = media?.url ?? '';
  const [src, setSrc] = useState(() => (media ? getCachedMediaDisplayUrlSync(media) ?? fallbackUrl : fallbackUrl));

  useEffect(() => {
    let cancelled = false;

    setSrc(media ? getCachedMediaDisplayUrlSync(media) ?? fallbackUrl : fallbackUrl);

    if (!media?.url) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      await hydrateMediaCacheIndex();

      const cachedUrl = getCachedMediaDisplayUrlSync(media) ?? (await getCachedMediaDisplayUrl(media));

      if (cancelled) {
        return;
      }

      if (cachedUrl) {
        setSrc(cachedUrl);
        return;
      }

      if (mode === 'list') {
        void prefetchMediaAsset(media);
        return;
      }

      await prefetchMediaAsset(media);

      if (cancelled) {
        return;
      }

      const downloadedUrl = await getCachedMediaDisplayUrl(media);
      if (downloadedUrl && !cancelled) {
        setSrc(downloadedUrl);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fallbackUrl, media?.mimeType, media?.objectKey, media?.url, mode]);

  return src;
};
