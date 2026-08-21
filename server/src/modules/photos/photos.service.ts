import { randomUUID } from 'node:crypto';
import { HttpError } from '../../common/http-error.js';
import type {
  CreateImageUploadTokenInput,
  ImageUploadToken,
} from '../uploads/oss.service.js';

export type OwnedAlbumRecord = {
  id: string;
  ownerId: string;
};

export type PhotosAlbumsRepository = {
  findOwnedAlbum(albumId: string, ownerId: string): Promise<OwnedAlbumRecord | null>;
};

export type PhotoRecord = {
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
  createdAt: Date;
  updatedAt: Date;
};

export type CreatePhotoRecordInput = Omit<PhotoRecord, 'id' | 'createdAt' | 'updatedAt'>;

export type TrashItemRecord = {
  id: string;
  photoId: string;
  originalAlbumId: string;
  deletedById: string;
  expiresAt: Date;
  createdAt: Date;
};

export type PhotosRepository = {
  create(input: CreatePhotoRecordInput): Promise<PhotoRecord>;
  findOwnedPhoto(photoId: string, ownerId: string): Promise<PhotoRecord | null>;
  updateAiTitle(photoId: string, aiTitle: string): Promise<PhotoRecord>;
  updateFavorite(photoId: string, isFavorite: boolean): Promise<PhotoRecord>;
  findTrashItemByPhotoId(photoId: string): Promise<TrashItemRecord | null>;
  createTrashItemIfAbsent(input: {
    photoId: string;
    originalAlbumId: string;
    deletedById: string;
    expiresAt: Date;
  }): Promise<TrashItemRecord>;
};

export type UploadSigner = {
  createImageUploadToken(input: CreateImageUploadTokenInput): Promise<ImageUploadToken>;
  getObjectUrl(objectKey: string): string;
};

export type CreateUploadTokenInput = {
  albumId: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type RegisterPhotoInput = {
  albumId: string;
  objectKey: string;
  fileName: string;
  mimeType: string;
  size: number;
  title?: string;
  location?: string;
  width?: number;
  height?: number;
};

export type MovePhotoToTrashOptions = {
  now?: Date;
};

export type PhotoTitleGenerator = {
  generateTitle(input: {
    albumTitle?: string;
    currentTitle?: string | null;
    dateAdded?: string;
    location?: string | null;
    uploaderName?: string;
  }): Promise<string>;
};

const TRASH_RETENTION_DAYS = 30;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const normalizeOptionalText = (value: string | undefined) => {
  const normalized = value?.trim();

  return normalized ? normalized : null;
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.split('.');

  if (parts.length < 2) {
    return 'jpg';
  }

  const extension = parts.at(-1)?.trim().toLowerCase();

  return extension || 'jpg';
};

const getAlbumObjectKeyPrefix = (userId: string, albumId: string) =>
  `users/${userId}/albums/${albumId}/`;

export const createPhotosService = ({
  albumsRepository,
  photosRepository,
  uploadSigner,
  createObjectId = randomUUID,
  photoTitleGenerator,
}: {
  albumsRepository: PhotosAlbumsRepository;
  photosRepository: PhotosRepository;
  uploadSigner: UploadSigner;
  createObjectId?: () => string;
  photoTitleGenerator?: PhotoTitleGenerator;
}) => {
  const assertAlbumOwned = async (userId: string, albumId: string) => {
    const album = await albumsRepository.findOwnedAlbum(albumId, userId);

    if (!album) {
      throw new HttpError(404, 'ALBUM_NOT_FOUND', 'Album not found');
    }
  };

  const assertObjectKeyBelongsToAlbum = (userId: string, albumId: string, objectKey: string) => {
    if (!objectKey.startsWith(getAlbumObjectKeyPrefix(userId, albumId))) {
      throw new HttpError(400, 'INVALID_OBJECT_KEY', 'Object key is outside the allowed album namespace');
    }
  };

  return {
    async createUploadToken(userId: string, input: CreateUploadTokenInput) {
      await assertAlbumOwned(userId, input.albumId);

      const objectKey = `users/${userId}/albums/${input.albumId}/${createObjectId()}.${getFileExtension(input.fileName)}`;

      return uploadSigner.createImageUploadToken({
        objectKey,
        mimeType: input.mimeType,
        size: input.size,
      });
    },

    async registerPhoto(userId: string, input: RegisterPhotoInput) {
      await assertAlbumOwned(userId, input.albumId);
      assertObjectKeyBelongsToAlbum(userId, input.albumId, input.objectKey);

      return photosRepository.create({
        albumId: input.albumId,
        uploadedById: userId,
        title: normalizeOptionalText(input.title),
        aiTitle: null,
        location: normalizeOptionalText(input.location),
        objectKey: input.objectKey,
        url: uploadSigner.getObjectUrl(input.objectKey),
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        width: input.width ?? null,
        height: input.height ?? null,
        isFavorite: false,
      });
    },

    async generateAiTitle(
      userId: string,
      photoId: string,
      input: {
        albumTitle?: string;
        uploaderName?: string;
      } = {},
    ) {
      const photo = await photosRepository.findOwnedPhoto(photoId, userId);

      if (!photo) {
        throw new HttpError(404, 'PHOTO_NOT_FOUND', 'Photo not found');
      }

      if (!photoTitleGenerator) {
        throw new HttpError(503, 'PHOTO_TITLE_GENERATOR_UNAVAILABLE', '照片标题生成暂时不可用');
      }

      const aiTitle = await photoTitleGenerator.generateTitle({
        albumTitle: input.albumTitle,
        currentTitle: photo.title,
        dateAdded: photo.createdAt.toISOString().slice(0, 10),
        location: photo.location,
        uploaderName: input.uploaderName,
      });

      return photosRepository.updateAiTitle(photo.id, aiTitle.trim());
    },

    async updateFavorite(userId: string, photoId: string, isFavorite: boolean) {
      const photo = await photosRepository.findOwnedPhoto(photoId, userId);

      if (!photo) {
        throw new HttpError(404, 'PHOTO_NOT_FOUND', 'Photo not found');
      }

      return photosRepository.updateFavorite(photo.id, isFavorite);
    },

    async movePhotoToTrash(
      userId: string,
      photoId: string,
      options: MovePhotoToTrashOptions = {},
    ) {
      const photo = await photosRepository.findOwnedPhoto(photoId, userId);

      if (!photo) {
        throw new HttpError(404, 'PHOTO_NOT_FOUND', 'Photo not found');
      }

      const existingTrashItem = await photosRepository.findTrashItemByPhotoId(photoId);

      if (existingTrashItem) {
        return existingTrashItem;
      }

      const now = options.now ?? new Date();

      return photosRepository.createTrashItemIfAbsent({
        photoId: photo.id,
        originalAlbumId: photo.albumId,
        deletedById: userId,
        expiresAt: new Date(now.getTime() + TRASH_RETENTION_DAYS * DAY_IN_MILLISECONDS),
      });
    },
  };
};

export type PhotosService = ReturnType<typeof createPhotosService>;
