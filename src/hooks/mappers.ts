/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Album,
  ApiAlbum,
  ApiPhoto,
  ApiSharedSpace,
  ApiSharedSpaceMember,
  ApiStorageSummary,
  ApiTrashItem,
  ApiUser,
  Contact,
  DeletedPhoto,
  Photo,
  SharedSpace,
  UserProfile,
} from '../types';
import { getAlbumDisplayType, sortPhotosByFavorite } from '../lib/album-display';
import { createPersonalId } from '../lib/personal-id';

const fallbackAlbumCover =
  'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80';

const fallbackAvatar =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&q=80&fit=crop';

const fallbackSpaceCover =
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80';

export const bytesToGb = (bytes: number) => Number((bytes / 1024 / 1024 / 1024).toFixed(2));

const initialsFromName = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export const mapPhoto = (photo: ApiPhoto): Photo => ({
  id: photo.id,
  url: photo.url,
  objectKey: photo.objectKey,
  mimeType: photo.mimeType,
  title: photo.title ?? photo.fileName,
  aiTitle: photo.aiTitle ?? null,
  dateAdded: photo.createdAt.slice(0, 10),
  createdAt: photo.createdAt,
  location: photo.location ?? undefined,
  uploadedById: photo.uploadedById,
  isFavorite: photo.isFavorite,
  aspectRatio:
    photo.width && photo.height
      ? photo.width === photo.height
        ? 'square'
        : photo.width > photo.height
          ? 'landscape'
          : 'portrait'
      : undefined,
});

export const mapAlbum = (album: ApiAlbum, photos: ApiPhoto[]): Album => {
  const uiPhotos = sortPhotosByFavorite(photos.map(mapPhoto));

  return {
    id: album.id,
    title: album.title,
    description: album.description ?? undefined,
    photos: uiPhotos,
    coverUrl: album.coverUrl ?? uiPhotos[0]?.url ?? fallbackAlbumCover,
    tags: album.description ? [album.description] : undefined,
    type: getAlbumDisplayType(album),
  };
};

export const mapTrashItem = (item: ApiTrashItem): DeletedPhoto => {
  const expiresAt = new Date(item.expiresAt).getTime();
  const now = Date.now();
  const daysLeft = Math.max(0, Math.ceil((expiresAt - now) / 86_400_000));

  return {
    id: item.photoId,
    url: item.photo.url,
    objectKey: item.photo.objectKey,
    mimeType: item.photo.mimeType,
    title: item.photo.title ?? item.photo.fileName,
    daysLeft,
    timeLeftUnit: 'days',
  };
};

export const mapContact = (user: ApiUser): Contact => ({
  id: user.id,
  username: user.username,
  email: user.email,
  name: user.displayName || user.username,
  avatarUrl: user.avatarUrl ?? '',
  initials: initialsFromName(user.displayName || user.username),
  sharingCount: 0,
  isSharing: false,
  status: user.bio ?? '好友',
});

export const mapSharedSpace = (
  space: ApiSharedSpace,
  members: ApiSharedSpaceMember[] = [],
  photosCount = 0,
): SharedSpace => ({
  id: space.id,
  title: space.title,
  description: space.description ?? undefined,
  photosCount,
  contributorsCount: Math.max(1, members.filter((member) => member.status !== 'REMOVED').length + 1),
  contributorUserIds: [
    space.ownerId,
    ...members
      .filter((member) => member.status !== 'REMOVED')
      .map((member) => member.userId),
  ],
  contributorsAvatars: [fallbackAvatar],
  coverUrl: space.coverUrl ?? fallbackSpaceCover,
});

export const mapUserProfile = (
  user: ApiUser,
  storageSummary: ApiStorageSummary | null,
  collectionsCount: number,
): UserProfile => ({
  id: user.id,
  personalId: user.personalId ?? createPersonalId(user.email || user.id),
  username: user.username,
  email: user.email,
  bio: user.bio ?? '',
  name: user.displayName || user.username,
  avatarUrl: user.avatarUrl ?? fallbackAvatar,
  curatorSince: user.createdAt.slice(0, 10),
  memoriesCount: String(storageSummary?.photoCount ?? 0),
  collectionsCount: String(collectionsCount),
  storageUsedGB: bytesToGb(storageSummary?.usedBytes ?? 0),
  storageTotalGB: 50,
  privateAlbumsOnly: user.privateAlbumsOnly ?? false,
  activityStatusActive: user.activityStatusActive ?? true,
  locationTaggingActive: user.locationTaggingActive ?? true,
});
