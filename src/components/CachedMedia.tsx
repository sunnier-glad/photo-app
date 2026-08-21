import type { ImgHTMLAttributes, VideoHTMLAttributes } from 'react';
import {
  useCachedMediaSource,
  type CachedMediaSourceMode,
  type CachedMediaSourceInput,
} from '../hooks/useCachedMediaSource';

type CachedImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  cacheMode?: CachedMediaSourceMode;
  media: CachedMediaSourceInput;
};

type CachedVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, 'src'> & {
  cacheMode?: CachedMediaSourceMode;
  media: CachedMediaSourceInput;
};

export function CachedImage({ media, cacheMode = 'viewer', ...props }: CachedImageProps) {
  const src = useCachedMediaSource(media, cacheMode);
  return <img {...props} src={src} />;
}

export function CachedVideo({ media, cacheMode = 'viewer', ...props }: CachedVideoProps) {
  const src = useCachedMediaSource(media, cacheMode);
  return <video {...props} src={src} />;
}
