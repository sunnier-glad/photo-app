import { randomUUID } from 'node:crypto';
import { HttpError } from '../../common/http-error.js';
import type {
  CreateImageUploadTokenInput,
  ImageUploadToken,
} from '../uploads/oss.service.js';

export type SharedSpaceMemberStatus = 'INVITED' | 'ACTIVE' | 'LEFT' | 'REMOVED';

export type SharedSpaceRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SharedSpaceMemberRecord = {
  id: string;
  sharedSpaceId: string;
  userId: string;
  status: SharedSpaceMemberStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type SharedSpacePhotoRecord = {
  id: string;
  sharedSpaceId: string;
  photoId: string;
  sharedById: string;
  createdAt: Date;
};

export type SharedUploadAlbumRecord = {
  id: string;
  ownerId: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SharedUploadPhotoRecord = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type SharedPhotoUserRecord = {
  id: string;
  personalId: string | null;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SharedSpacePhotoWithDetailsRecord = SharedSpacePhotoRecord & {
  photo: SharedUploadPhotoRecord;
  sharedBy: SharedPhotoUserRecord;
};

export type SharedPhotoTrashItemRecord = {
  id: string;
  photoId: string;
  originalAlbumId: string;
  deletedById: string;
  expiresAt: Date;
  createdAt: Date;
};

export type SharedSpaceWithDetailsRecord = SharedSpaceRecord & {
  members: SharedSpaceMemberRecord[];
  photos: SharedSpacePhotoWithDetailsRecord[];
};

export type OwnedPhotoRecord = {
  id: string;
  albumId: string;
  uploadedById: string;
};

export type SharedSpacesRepository = {
  createSpace(input: {
    ownerId: string;
    title: string;
    description: string | null;
  }): Promise<SharedSpaceRecord>;
  updateSpace(
    spaceId: string,
    input: {
      title: string;
      description: string | null;
    },
  ): Promise<SharedSpaceRecord>;
  listAccessibleSpaces(userId: string): Promise<SharedSpaceRecord[]>;
  listAccessibleSpacesWithDetails(userId: string): Promise<SharedSpaceWithDetailsRecord[]>;
  findSpaceById(spaceId: string): Promise<SharedSpaceRecord | null>;
  findMembership(spaceId: string, userId: string): Promise<SharedSpaceMemberRecord | null>;
  listMembers(spaceId: string): Promise<SharedSpaceMemberRecord[]>;
  createMemberIfAbsent(input: {
    sharedSpaceId: string;
    userId: string;
    status: 'ACTIVE';
  }): Promise<SharedSpaceMemberRecord>;
  areFriends(userId: string, otherUserId: string): Promise<boolean>;
  listPhotos(spaceId: string): Promise<SharedSpacePhotoWithDetailsRecord[]>;
  findSharedPhoto(
    spaceId: string,
    sharedPhotoId: string,
  ): Promise<SharedSpacePhotoWithDetailsRecord | null>;
  createTrashItemIfAbsent(input: {
    photoId: string;
    originalAlbumId: string;
    deletedById: string;
    expiresAt: Date;
  }): Promise<SharedPhotoTrashItemRecord>;
  findOwnedPhoto(photoId: string, ownerId: string): Promise<OwnedPhotoRecord | null>;
  createSharedPhotoIfAbsent(input: {
    sharedSpaceId: string;
    photoId: string;
    sharedById: string;
  }): Promise<SharedSpacePhotoWithDetailsRecord>;
  findDefaultUploadAlbum(ownerId: string): Promise<SharedUploadAlbumRecord | null>;
  createDefaultUploadAlbum(ownerId: string): Promise<SharedUploadAlbumRecord>;
  createPhoto(
    input: Omit<SharedUploadPhotoRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<SharedUploadPhotoRecord>;
  createUploadToken(input: CreateImageUploadTokenInput): Promise<ImageUploadToken>;
  getObjectUrl(objectKey: string): string;
};

export type CreateSharedSpaceInput = {
  title: string;
  description?: string;
};

export type UpdateSharedSpaceInput = {
  title: string;
  description?: string;
};

export type InviteSharedSpaceMemberInput = {
  userId: string;
};

export type AddSharedSpacePhotoInput = {
  photoId: string;
};

export type CreateSharedSpaceUploadTokenInput = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type RegisterSharedSpaceUploadInput = {
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  title?: string;
  location?: string;
  width?: number;
  height?: number;
};

export type DeleteSharedPhotoOptions = {
  now?: Date;
};

const DEFAULT_SHARED_UPLOAD_ALBUM_TITLE = '共享上传';
const DEFAULT_SHARED_UPLOAD_ALBUM_DESCRIPTION = '共享空间上传的照片和视频';

const TRASH_RETENTION_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const normalizeOptionalText = (value: string | undefined) => {
  const normalized = value?.trim();

  return normalized ? normalized : null;
};

const getFileExtension = (fileName: string) => {
  const extensionSeparatorIndex = fileName.lastIndexOf('.');
  const extension =
    extensionSeparatorIndex > 0 ? fileName.slice(extensionSeparatorIndex + 1).trim().toLowerCase() : '';

  return extension || 'jpg';
};

const getSharedUploadObjectKeyPrefix = (userId: string, albumId: string) =>
  `users/${userId}/albums/${albumId}/`;

export const createSharedSpacesService = (sharedSpacesRepository: SharedSpacesRepository) => {
  const getSpaceForOwner = async (userId: string, spaceId: string) => {
    const space = await sharedSpacesRepository.findSpaceById(spaceId);

    if (!space || space.ownerId !== userId) {
      throw new HttpError(404, 'SHARED_SPACE_NOT_FOUND', 'Shared space not found');
    }

    return space;
  };

  const getSpaceForMemberRead = async (userId: string, spaceId: string) => {
    const space = await sharedSpacesRepository.findSpaceById(spaceId);

    if (!space) {
      throw new HttpError(404, 'SHARED_SPACE_NOT_FOUND', 'Shared space not found');
    }

    if (space.ownerId === userId) {
      return space;
    }

    const membership = await sharedSpacesRepository.findMembership(spaceId, userId);

    if (!membership || membership.status !== 'ACTIVE') {
      throw new HttpError(404, 'SHARED_SPACE_NOT_FOUND', 'Shared space not found');
    }

    return space;
  };

  const getSpaceForActiveAccess = async (userId: string, spaceId: string) => {
    const space = await sharedSpacesRepository.findSpaceById(spaceId);

    if (!space) {
      throw new HttpError(404, 'SHARED_SPACE_NOT_FOUND', 'Shared space not found');
    }

    if (space.ownerId === userId) {
      return space;
    }

    const membership = await sharedSpacesRepository.findMembership(spaceId, userId);

    if (!membership || membership.status !== 'ACTIVE') {
      throw new HttpError(404, 'SHARED_SPACE_NOT_FOUND', 'Shared space not found');
    }

    return space;
  };

  const getOrCreateDefaultUploadAlbum = async (userId: string) => {
    const existingAlbum = await sharedSpacesRepository.findDefaultUploadAlbum(userId);

    return existingAlbum ?? sharedSpacesRepository.createDefaultUploadAlbum(userId);
  };

  return {
    listSpaces(userId: string) {
      return sharedSpacesRepository.listAccessibleSpaces(userId);
    },

    listSpacesWithDetails(userId: string) {
      return sharedSpacesRepository.listAccessibleSpacesWithDetails(userId);
    },

    createSpace(userId: string, input: CreateSharedSpaceInput) {
      const title = input.title.trim();

      if (!title) {
        throw new HttpError(400, 'INVALID_SHARED_SPACE_TITLE', 'Shared space title is required');
      }

      return sharedSpacesRepository.createSpace({
        ownerId: userId,
        title,
        description: normalizeOptionalText(input.description),
      });
    },

    async updateSpace(userId: string, spaceId: string, input: UpdateSharedSpaceInput) {
      const space = await getSpaceForActiveAccess(userId, spaceId);
      const title = input.title.trim();

      if (!title) {
        throw new HttpError(400, 'INVALID_SHARED_SPACE_TITLE', 'Shared space title is required');
      }

      return sharedSpacesRepository.updateSpace(space.id, {
        title,
        description: normalizeOptionalText(input.description),
      });
    },

    async inviteMember(userId: string, spaceId: string, input: InviteSharedSpaceMemberInput) {
      const space = await getSpaceForOwner(userId, spaceId);

      if (input.userId === space.ownerId) {
        throw new HttpError(400, 'CANNOT_INVITE_SPACE_OWNER', 'Cannot invite the space owner');
      }

      const areFriends = await sharedSpacesRepository.areFriends(space.ownerId, input.userId);

      if (!areFriends) {
        throw new HttpError(403, 'FRIENDSHIP_REQUIRED', 'Friendship is required');
      }

      return sharedSpacesRepository.createMemberIfAbsent({
        sharedSpaceId: space.id,
        userId: input.userId,
        status: 'ACTIVE',
      });
    },

    async listMembers(userId: string, spaceId: string) {
      const space = await getSpaceForMemberRead(userId, spaceId);

      return sharedSpacesRepository.listMembers(space.id);
    },

    async listPhotos(userId: string, spaceId: string) {
      const space = await getSpaceForActiveAccess(userId, spaceId);

      return sharedSpacesRepository.listPhotos(space.id);
    },

    async addPhoto(userId: string, spaceId: string, input: AddSharedSpacePhotoInput) {
      const space = await getSpaceForActiveAccess(userId, spaceId);
      const photo = await sharedSpacesRepository.findOwnedPhoto(input.photoId, userId);

      if (!photo) {
        throw new HttpError(404, 'PHOTO_NOT_FOUND', 'Photo not found');
      }

      return sharedSpacesRepository.createSharedPhotoIfAbsent({
        sharedSpaceId: space.id,
        photoId: photo.id,
        sharedById: userId,
      });
    },

    async deleteOwnSharedPhoto(
      userId: string,
      spaceId: string,
      sharedPhotoId: string,
      options: DeleteSharedPhotoOptions = {},
    ) {
      const space = await getSpaceForActiveAccess(userId, spaceId);
      const sharedPhoto = await sharedSpacesRepository.findSharedPhoto(space.id, sharedPhotoId);

      if (!sharedPhoto) {
        throw new HttpError(404, 'SHARED_PHOTO_NOT_FOUND', 'Shared photo not found');
      }

      if (sharedPhoto.sharedById !== userId) {
        throw new HttpError(
          403,
          'SHARED_PHOTO_DELETE_FORBIDDEN',
          'Only the uploader can delete this shared photo',
        );
      }

      const now = options.now ?? new Date();

      return sharedSpacesRepository.createTrashItemIfAbsent({
        photoId: sharedPhoto.photo.id,
        originalAlbumId: sharedPhoto.photo.albumId,
        deletedById: userId,
        expiresAt: new Date(now.getTime() + TRASH_RETENTION_DAYS * DAY_IN_MILLISECONDS),
      });
    },

    async createUploadToken(
      userId: string,
      spaceId: string,
      input: CreateSharedSpaceUploadTokenInput,
    ) {
      await getSpaceForActiveAccess(userId, spaceId);

      const album = await getOrCreateDefaultUploadAlbum(userId);
      const objectKey = `${getSharedUploadObjectKeyPrefix(userId, album.id)}${randomUUID()}.${getFileExtension(
        input.fileName,
      )}`;

      return sharedSpacesRepository.createUploadToken({
        objectKey,
        mimeType: input.mimeType,
        size: input.size,
      });
    },

    async registerUploadedPhoto(
      userId: string,
      spaceId: string,
      input: RegisterSharedSpaceUploadInput,
    ) {
      const space = await getSpaceForActiveAccess(userId, spaceId);
      const album = await getOrCreateDefaultUploadAlbum(userId);
      const objectKeyPrefix = getSharedUploadObjectKeyPrefix(userId, album.id);

      if (!input.objectKey.startsWith(objectKeyPrefix)) {
        throw new HttpError(
          400,
          'INVALID_OBJECT_KEY',
          'Object key is outside the allowed shared upload namespace',
        );
      }

      const photo = await sharedSpacesRepository.createPhoto({
        albumId: album.id,
        uploadedById: userId,
        title: normalizeOptionalText(input.title),
        aiTitle: null,
        location: normalizeOptionalText(input.location),
        objectKey: input.objectKey,
        url: sharedSpacesRepository.getObjectUrl(input.objectKey),
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width ?? null,
        height: input.height ?? null,
      });

      return sharedSpacesRepository.createSharedPhotoIfAbsent({
        sharedSpaceId: space.id,
        photoId: photo.id,
        sharedById: userId,
      });
    },
  };
};

export type SharedSpacesService = ReturnType<typeof createSharedSpacesService>;
