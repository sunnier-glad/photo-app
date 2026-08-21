/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Photo {
  id: string;
  url: string;
  objectKey?: string;
  mimeType?: string;
  title?: string;
  aiTitle?: string | null;
  dateAdded: string;
  createdAt?: string;
  location?: string;
  uploadedById?: string;
  uploadedByName?: string;
  isFavorite?: boolean;
  aspectRatio?: 'portrait' | 'landscape' | 'square';
}

export interface Album {
  id: string;
  title: string;
  description?: string;
  photos: Photo[];
  coverUrl: string;
  pinned?: boolean;
  contributorsCount?: number;
  tags?: string[];
  type: 'all' | 'recent' | 'shared';
}

export interface Contact {
  id: string;
  username?: string;
  email?: string;
  name: string;
  avatarUrl: string;
  initials?: string;
  sharingCount: number;
  isSharing: boolean;
  status: string; // e.g., "Sharing 3 albums" or "Not sharing yet"
  isFollowing?: boolean;
  isSuggested?: boolean;
}

export interface SharedAlbumPreview {
  id: string;
  title: string;
  photosCount: number;
  contributorsCount: number;
  coverUrls: string[]; // up to 3 for overlap avatars or images
}

export interface DeletedPhoto {
  id: string;
  url: string;
  objectKey?: string;
  mimeType?: string;
  title?: string;
  daysLeft: number;
  timeLeftUnit?: 'days' | 'hours';
}

export interface SharedSpace {
  id: string;
  title: string;
  description?: string;
  photosCount: number;
  contributorsCount: number;
  contributorsAvatars: string[];
  contributorUserIds?: string[];
  coverUrl: string;
  aspectRatio?: string;
}

export interface UserProfile {
  id?: string;
  personalId?: string;
  username?: string;
  email?: string;
  bio?: string;
  name: string;
  avatarUrl: string;
  curatorSince: string;
  memoriesCount: string;
  collectionsCount: string;
  storageUsedGB: number;
  storageTotalGB: number;
  privateAlbumsOnly: boolean;
  activityStatusActive: boolean;
  locationTaggingActive: boolean;
}

export interface ApiUser {
  id: string;
  personalId?: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  privateAlbumsOnly?: boolean;
  activityStatusActive?: boolean;
  locationTaggingActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAuthPayload {
  token: string;
  user: ApiUser;
}

export interface ApiEmailCodePayload {
  email: string;
  expiresInSeconds: number;
}

export interface ApiImageUploadToken {
  host: string;
  objectKey: string;
  policy: string;
  signature: string;
  accessKeyId: string;
  xOssDate: string;
  xOssCredential: string;
  signatureVersion: string;
  successActionStatus: string;
}

export interface ApiAvatarUploadToken extends ApiImageUploadToken {
  avatarUrl: string;
}

export type UploadPhotosResult = {
  uploadedCount: number;
  failedCount: number;
  firstError?: string;
};

export interface ApiStorageSummary {
  usedBytes: number;
  photoCount: number;
}

export interface ApiAlbum {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiPhoto {
  id: string;
  albumId: string;
  uploadedById: string;
  title: string | null;
  aiTitle?: string | null;
  location: string | null;
  objectKey: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiAlbumWithPhotos extends ApiAlbum {
  photos: ApiPhoto[];
}

export interface ApiTrashItem {
  id: string;
  photoId: string;
  originalAlbumId: string;
  deletedById: string;
  expiresAt: string;
  createdAt: string;
  photo: ApiPhoto;
}

export type ApiFriendInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface ApiFriendInvitation {
  id: string;
  senderId: string;
  receiverId: string;
  pairUserAId: string;
  pairUserBId: string;
  status: ApiFriendInvitationStatus;
  createdAt: string;
  updatedAt: string;
  sender?: ApiUser;
  receiver?: ApiUser;
}

export interface ApiSharedSpace {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ApiSharedSpaceMemberStatus = 'INVITED' | 'ACTIVE' | 'LEFT' | 'REMOVED';

export interface ApiSharedSpaceMember {
  id: string;
  sharedSpaceId: string;
  userId: string;
  status: ApiSharedSpaceMemberStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSharedSpacePhotoContributor {
  id: string;
  personalId: string | null;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiSharedSpacePhoto {
  id: string;
  sharedSpaceId: string;
  photoId: string;
  sharedById: string;
  createdAt: string;
  photo?: ApiPhoto;
  sharedBy?: ApiSharedSpacePhotoContributor;
}

export interface ApiSharedSpaceWithDetails extends ApiSharedSpace {
  members: ApiSharedSpaceMember[];
  photos: ApiSharedSpacePhoto[];
}

export type UploadSharedSpacePhotosResult = UploadPhotosResult;

export interface ApiMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}
