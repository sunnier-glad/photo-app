import { HttpError } from '../../common/http-error.js';
import type { PhotoRecord } from '../photos/photos.service.js';

export type TrashItemWithPhotoRecord = {
  id: string;
  photoId: string;
  originalAlbumId: string;
  deletedById: string;
  expiresAt: Date;
  createdAt: Date;
  photo: PhotoRecord;
};

export type TrashRepository = {
  listByOwner(ownerId: string): Promise<TrashItemWithPhotoRecord[]>;
  findByPhotoIdForOwner(photoId: string, ownerId: string): Promise<TrashItemWithPhotoRecord | null>;
  deleteByPhotoId(photoId: string): Promise<boolean>;
  hardDeletePhoto(photoId: string): Promise<boolean>;
};

export type ObjectStorage = {
  deleteObject(objectKey: string): Promise<void>;
};

export const createTrashService = ({
  trashRepository,
  objectStorage,
}: {
  trashRepository: TrashRepository;
  objectStorage: ObjectStorage;
}) => {
  const findTrashItemOrThrow = async (userId: string, photoId: string) => {
    const trashItem = await trashRepository.findByPhotoIdForOwner(photoId, userId);

    if (!trashItem) {
      throw new HttpError(404, 'TRASH_ITEM_NOT_FOUND', 'Trash item not found');
    }

    return trashItem;
  };

  return {
    async listTrash(userId: string) {
      return trashRepository.listByOwner(userId);
    },

    async restorePhoto(userId: string, photoId: string) {
      const trashItem = await findTrashItemOrThrow(userId, photoId);
      const wasDeleted = await trashRepository.deleteByPhotoId(photoId);

      if (!wasDeleted) {
        throw new HttpError(404, 'TRASH_ITEM_NOT_FOUND', 'Trash item not found');
      }

      return trashItem.photo;
    },

    async permanentlyDeletePhoto(userId: string, photoId: string) {
      const trashItem = await findTrashItemOrThrow(userId, photoId);

      // OSS and MySQL are separate systems; follow-up cleanup can reconcile object deletion retries.
      await objectStorage.deleteObject(trashItem.photo.objectKey);
      const wasDeleted = await trashRepository.hardDeletePhoto(photoId);

      if (!wasDeleted) {
        throw new HttpError(404, 'TRASH_ITEM_NOT_FOUND', 'Trash item not found');
      }

      return { photoId };
    },
  };
};

export type TrashService = ReturnType<typeof createTrashService>;
