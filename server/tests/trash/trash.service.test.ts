import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import {
  createTrashService,
  type TrashItemWithPhotoRecord,
} from '../../src/modules/trash/trash.service.js';
import type { PhotoRecord } from '../../src/modules/photos/photos.service.js';

const photo: PhotoRecord = {
  id: 'photo-1',
  albumId: 'album-1',
  uploadedById: 'user-1',
  title: 'Beach',
  location: null,
  objectKey: 'users/user-1/albums/album-1/photo-1.png',
  url: 'https://cdn.example.com/users/user-1/albums/album-1/photo-1.png',
  fileName: 'photo-1.png',
  mimeType: 'image/png',
  size: 2048,
  width: 1440,
  height: 960,
  isFavorite: false,
  createdAt: new Date('2026-06-01T00:00:00.000Z'),
  updatedAt: new Date('2026-06-01T00:00:00.000Z'),
};

const trashItem: TrashItemWithPhotoRecord = {
  id: 'trash-1',
  photoId: 'photo-1',
  originalAlbumId: 'album-1',
  deletedById: 'user-1',
  expiresAt: new Date('2026-07-02T00:00:00.000Z'),
  createdAt: new Date('2026-06-02T00:00:00.000Z'),
  photo,
};

const createFakeTrashDependencies = () => {
  const trashItems = [trashItem];
  const deletedObjects: string[] = [];
  const hardDeletedPhotos: string[] = [];
  let simulateRestoreDeleteRace = false;
  let simulatePermanentDeleteRace = false;

  return {
    dependencies: {
      trashRepository: {
        async listByOwner(ownerId: string) {
          return trashItems
            .filter((item) => item.deletedById === ownerId)
            .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
        },
        async findByPhotoIdForOwner(photoId: string, ownerId: string) {
          return trashItems.find((item) => item.photoId === photoId && item.deletedById === ownerId) ?? null;
        },
        async deleteByPhotoId(photoId: string) {
          if (simulateRestoreDeleteRace) {
            return false;
          }

          const index = trashItems.findIndex((item) => item.photoId === photoId);

          if (index >= 0) {
            trashItems.splice(index, 1);
            return true;
          }

          return false;
        },
        async hardDeletePhoto(photoId: string) {
          if (simulatePermanentDeleteRace) {
            return false;
          }

          hardDeletedPhotos.push(photoId);
          return true;
        },
      },
      objectStorage: {
        async deleteObject(objectKey: string) {
          deletedObjects.push(objectKey);
        },
      },
    },
    trashItems,
    deletedObjects,
    hardDeletedPhotos,
    simulateRestoreDeleteRace() {
      simulateRestoreDeleteRace = true;
    },
    simulatePermanentDeleteRace() {
      simulatePermanentDeleteRace = true;
    },
  };
};

test('listTrash returns current user trash items with photo data', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);

  const result = await trashService.listTrash('user-1');

  assert.equal(result.length, 1);
  assert.equal(result[0]?.photo.id, 'photo-1');
  assert.equal(result[0]?.deletedById, 'user-1');
});

test('restorePhoto removes the trash item and returns the restored photo', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);

  const restoredPhoto = await trashService.restorePhoto('user-1', 'photo-1');

  assert.equal(restoredPhoto.id, 'photo-1');
  assert.equal(fakeTrash.trashItems.length, 0);
});

test('restorePhoto rejects photos outside the current user trash', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);

  await assert.rejects(
    () => trashService.restorePhoto('user-2', 'photo-1'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'TRASH_ITEM_NOT_FOUND',
  );
});

test('restorePhoto maps a concurrent trash delete race to TRASH_ITEM_NOT_FOUND', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);
  fakeTrash.simulateRestoreDeleteRace();

  await assert.rejects(
    () => trashService.restorePhoto('user-1', 'photo-1'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'TRASH_ITEM_NOT_FOUND',
  );
});

test('permanentlyDeletePhoto deletes the OSS object before hard deleting the photo', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);

  const result = await trashService.permanentlyDeletePhoto('user-1', 'photo-1');

  assert.deepEqual(result, { photoId: 'photo-1' });
  assert.deepEqual(fakeTrash.deletedObjects, ['users/user-1/albums/album-1/photo-1.png']);
  assert.deepEqual(fakeTrash.hardDeletedPhotos, ['photo-1']);
});

test('permanentlyDeletePhoto maps a concurrent photo delete race to TRASH_ITEM_NOT_FOUND', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);
  fakeTrash.simulatePermanentDeleteRace();

  await assert.rejects(
    () => trashService.permanentlyDeletePhoto('user-1', 'photo-1'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'TRASH_ITEM_NOT_FOUND',
  );
  assert.deepEqual(fakeTrash.deletedObjects, ['users/user-1/albums/album-1/photo-1.png']);
});

test('permanentlyDeletePhoto rejects photos outside the current user trash', async () => {
  const fakeTrash = createFakeTrashDependencies();
  const trashService = createTrashService(fakeTrash.dependencies);

  await assert.rejects(
    () => trashService.permanentlyDeletePhoto('user-2', 'photo-1'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'TRASH_ITEM_NOT_FOUND',
  );
});
