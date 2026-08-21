/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AlbumCoverInput = {
  coverUrl: string;
  photos: Array<{ url?: string | null }>;
};

export function getAlbumCoverUrl(album: AlbumCoverInput) {
  return album.photos[0]?.url || album.coverUrl;
}

export function getSelectionOrder(selectedIds: string[], itemId: string) {
  const index = selectedIds.indexOf(itemId);
  return index === -1 ? null : index + 1;
}

const RECENT_ALBUM_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

const getPhotoUploadTime = (photo: { createdAt?: string; dateAdded?: string }) => {
  const rawTime = photo.createdAt ?? photo.dateAdded;
  const timestamp = rawTime ? new Date(rawTime).getTime() : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : 0;
};

export function sortPhotosByFavorite<
  TPhoto extends { isFavorite?: boolean; createdAt?: string; dateAdded?: string },
>(photos: TPhoto[]) {
  return [...photos].sort((left, right) => {
    if (left.isFavorite !== right.isFavorite) {
      return left.isFavorite ? -1 : 1;
    }

    return getPhotoUploadTime(right) - getPhotoUploadTime(left);
  });
}

export function getRecentAlbumsByUploadTime<
  TAlbum extends { photos: Array<{ createdAt?: string; dateAdded?: string }> },
>(albums: TAlbum[], now = new Date()) {
  const nowTime = now.getTime();
  const cutoffTime = nowTime - RECENT_ALBUM_WINDOW_MS;

  return albums
    .map((album) => ({
      album,
      latestUploadTime: Math.max(...album.photos.map(getPhotoUploadTime), 0),
    }))
    .filter(({ latestUploadTime }) => latestUploadTime >= cutoffTime && latestUploadTime <= nowTime)
    .sort((left, right) => right.latestUploadTime - left.latestUploadTime)
    .map(({ album }) => album);
}

export function getAlbumDisplayType(album: {
  title?: string | null;
  description?: string | null;
}): 'all' | 'recent' | 'shared' {
  const title = album.title?.trim() ?? '';
  const description = album.description?.trim() ?? '';

  if (title === '共享上传' || description.includes('共享空间上传')) {
    return 'shared';
  }

  return 'all';
}
