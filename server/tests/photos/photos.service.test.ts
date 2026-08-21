import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import {
  createPhotoUploadTokenBodySchema,
  createSharedSpaceUploadTokenBodySchema,
  registerPhotoBodySchema,
  registerSharedSpacePhotoBodySchema,
} from '../../src/modules/photos/photos.schemas.js';
import { createOssService } from '../../src/modules/uploads/oss.service.js';
import {
  createPhotosService,
  type CreatePhotoRecordInput,
  type PhotoRecord,
  type TrashItemRecord,
} from '../../src/modules/photos/photos.service.js';

const createFakePhotosDependencies = () => {
  const albumOwners = new Map<string, string>([
    ['album-1', 'user-1'],
    ['album-2', 'user-2'],
  ]);
  const photos: PhotoRecord[] = [
    {
      id: 'photo-existing',
      albumId: 'album-1',
      uploadedById: 'user-1',
      title: 'Existing',
      aiTitle: null,
      location: null,
      objectKey: 'users/user-1/albums/album-1/photo-existing.png',
      url: 'https://cdn.example.com/users/user-1/albums/album-1/photo-existing.png',
      fileName: 'photo-existing.png',
      mimeType: 'image/png',
      size: 2048,
      width: null,
      height: null,
      isFavorite: false,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    },
  ];
  const trashItems: TrashItemRecord[] = [];
  let simulateConcurrentTrashCreate = false;
  let lastSignedObjectKey: string | null = null;
  let lastUploadIntent:
    | {
        objectKey: string;
        mimeType: string;
        size: number;
      }
    | null = null;

  return {
    dependencies: {
      albumsRepository: {
        async findOwnedAlbum(albumId: string, ownerId: string) {
          return albumOwners.get(albumId) === ownerId ? { id: albumId, ownerId } : null;
        },
      },
      photosRepository: {
        async create(input: CreatePhotoRecordInput) {
          const photo = {
            id: `photo-${photos.length + 1}`,
            createdAt: new Date('2026-06-02T00:00:00.000Z'),
            updatedAt: new Date('2026-06-02T00:00:00.000Z'),
            ...input,
          };

          photos.push(photo);

          return photo;
        },
        async findOwnedPhoto(photoId: string, ownerId: string) {
          const foundPhoto = photos.find((photo) => photo.id === photoId);

          if (!foundPhoto || albumOwners.get(String(foundPhoto.albumId)) !== ownerId) {
            return null;
          }

          return foundPhoto;
        },
        async updateAiTitle(photoId: string, aiTitle: string) {
          const foundPhoto = photos.find((photo) => photo.id === photoId);

          if (!foundPhoto) {
            throw new Error('Photo not found');
          }

          foundPhoto.aiTitle = aiTitle;
          foundPhoto.updatedAt = new Date('2026-06-02T00:00:00.000Z');

          return foundPhoto;
        },
        async updateFavorite(photoId: string, isFavorite: boolean) {
          const foundPhoto = photos.find((photo) => photo.id === photoId);

          if (!foundPhoto) {
            throw new Error('Photo not found');
          }

          foundPhoto.isFavorite = isFavorite;
          foundPhoto.updatedAt = new Date('2026-06-02T00:00:00.000Z');

          return { ...foundPhoto };
        },
        async findTrashItemByPhotoId(photoId: string) {
          return trashItems.find((item) => item.photoId === photoId) ?? null;
        },
        async createTrashItemIfAbsent(input: {
          photoId: string;
          originalAlbumId: string;
          deletedById: string;
          expiresAt: Date;
        }) {
          if (simulateConcurrentTrashCreate) {
            const concurrentItem = {
              id: 'trash-concurrent',
              createdAt: new Date('2026-06-02T00:00:00.000Z'),
              ...input,
            };

            trashItems.push(concurrentItem);

            return concurrentItem;
          }

          const existingItem = trashItems.find((item) => item.photoId === input.photoId);

          if (existingItem) {
            return existingItem;
          }

          const item = {
            id: `trash-${trashItems.length + 1}`,
            createdAt: new Date('2026-06-02T00:00:00.000Z'),
            ...input,
          };

          trashItems.push(item);

          return item;
        },
      },
      uploadSigner: {
        async createImageUploadToken(input: {
          objectKey: string;
          mimeType: string;
          size: number;
        }) {
          lastSignedObjectKey = input.objectKey;
          lastUploadIntent = input;

          return {
            objectKey: input.objectKey,
            host: 'https://memories-test.oss-cn-hangzhou.aliyuncs.com',
            policy: 'policy-value',
            signature: 'signature-value',
            accessKeyId: 'access-key-id',
            xOssDate: '20260603T120000Z',
            xOssCredential: 'access-key-id/20260603/cn-hangzhou/oss/aliyun_v4_request',
            signatureVersion: 'OSS4-HMAC-SHA256',
            successActionStatus: '200',
          };
        },
        getObjectUrl(objectKey: string) {
          return `https://cdn.example.com/${objectKey}`;
        },
      },
    createObjectId: () => 'uuid-1234',
      photoTitleGenerator: {
        async generateTitle(input: {
          albumTitle?: string;
          currentTitle?: string | null;
          dateAdded?: string;
          location?: string | null;
          uploaderName?: string;
        }) {
          return [
            input.albumTitle,
            input.currentTitle,
            input.dateAdded,
            input.location,
            input.uploaderName,
          ]
            .filter(Boolean)
            .join(' · ');
        },
      },
    },
    getLastSignedObjectKey() {
      return lastSignedObjectKey;
    },
    getLastUploadIntent() {
      return lastUploadIntent;
    },
    trashItems,
    simulateConcurrentTrashCreate() {
      simulateConcurrentTrashCreate = true;
    },
  };
};

test('createUploadToken signs an object key inside the current user album namespace', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  const token = await photosService.createUploadToken('user-1', {
    albumId: 'album-1',
    fileName: 'cover.PNG',
    mimeType: 'image/png',
    size: 2048,
  });

  assert.equal(
    fakePhotos.getLastSignedObjectKey(),
    'users/user-1/albums/album-1/uuid-1234.png',
  );
  assert.deepEqual(fakePhotos.getLastUploadIntent(), {
    objectKey: 'users/user-1/albums/album-1/uuid-1234.png',
    mimeType: 'image/png',
    size: 2048,
  });
  assert.deepEqual(token, {
    objectKey: 'users/user-1/albums/album-1/uuid-1234.png',
    host: 'https://memories-test.oss-cn-hangzhou.aliyuncs.com',
    policy: 'policy-value',
    signature: 'signature-value',
    accessKeyId: 'access-key-id',
    xOssDate: '20260603T120000Z',
    xOssCredential: 'access-key-id/20260603/cn-hangzhou/oss/aliyun_v4_request',
    signatureVersion: 'OSS4-HMAC-SHA256',
    successActionStatus: '200',
  });
});

test('createUploadToken rejects when the album is not owned by the current user', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  await assert.rejects(
    () =>
      photosService.createUploadToken('user-1', {
        albumId: 'album-2',
        fileName: 'cover.png',
        mimeType: 'image/png',
        size: 2048,
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'ALBUM_NOT_FOUND',
  );
});

test('registerPhoto persists a photo under the current user after album ownership validation', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  const photo = await photosService.registerPhoto('user-1', {
    albumId: 'album-1',
    objectKey: 'users/user-1/albums/album-1/uuid-1234.png',
    fileName: 'cover.png',
    mimeType: 'image/png',
    size: 2048,
    title: '  Sunset  ',
    location: '  Sanya  ',
    width: 1440,
    height: 960,
  });

  assert.equal(photo.albumId, 'album-1');
  assert.equal(photo.uploadedById, 'user-1');
  assert.equal(photo.url, 'https://cdn.example.com/users/user-1/albums/album-1/uuid-1234.png');
  assert.equal(photo.title, 'Sunset');
  assert.equal(photo.location, 'Sanya');
});

test('registerPhoto rejects object keys outside the current user album namespace', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  await assert.rejects(
    () =>
      photosService.registerPhoto('user-1', {
        albumId: 'album-1',
        objectKey: 'users/user-2/albums/album-1/uuid-1234.png',
        fileName: 'cover.png',
        mimeType: 'image/png',
        size: 2048,
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.code === 'INVALID_OBJECT_KEY',
  );
});

test('movePhotoToTrash creates a 30-day trash item for a photo owned by the current user', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  const trashItem = await photosService.movePhotoToTrash('user-1', 'photo-existing', {
    now: new Date('2026-06-02T00:00:00.000Z'),
  });

  assert.equal(trashItem.photoId, 'photo-existing');
  assert.equal(trashItem.originalAlbumId, 'album-1');
  assert.equal(trashItem.deletedById, 'user-1');
  assert.equal(trashItem.expiresAt.toISOString(), '2026-07-02T00:00:00.000Z');
});

test('generateAiTitle saves a friendly title for an owned photo', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  const photo = await photosService.generateAiTitle('user-1', 'photo-existing', {
    albumTitle: '200天纪念日',
    uploaderName: '测试用户',
  });

  assert.equal(photo.aiTitle, '200天纪念日 · Existing · 2026-06-01 · 测试用户');
});

test('updateFavorite saves favorite state for an owned photo', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  const favoritePhoto = await photosService.updateFavorite('user-1', 'photo-existing', true);
  const normalPhoto = await photosService.updateFavorite('user-1', 'photo-existing', false);

  assert.equal(favoritePhoto.isFavorite, true);
  assert.equal(normalPhoto.isFavorite, false);
});

test('updateFavorite rejects photos outside the current user albums', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  await assert.rejects(
    () => photosService.updateFavorite('user-2', 'photo-existing', true),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'PHOTO_NOT_FOUND',
  );
});

test('movePhotoToTrash is idempotent when the photo is already in trash', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  const firstTrashItem = await photosService.movePhotoToTrash('user-1', 'photo-existing', {
    now: new Date('2026-06-02T00:00:00.000Z'),
  });
  const secondTrashItem = await photosService.movePhotoToTrash('user-1', 'photo-existing', {
    now: new Date('2026-06-03T00:00:00.000Z'),
  });

  assert.equal(secondTrashItem.id, firstTrashItem.id);
  assert.equal(fakePhotos.trashItems.length, 1);
});

test('movePhotoToTrash returns the existing trash item when repository handles a unique conflict', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);
  fakePhotos.simulateConcurrentTrashCreate();

  const trashItem = await photosService.movePhotoToTrash('user-1', 'photo-existing', {
    now: new Date('2026-06-02T00:00:00.000Z'),
  });

  assert.equal(trashItem.photoId, 'photo-existing');
  assert.equal(trashItem.id, 'trash-concurrent');
  assert.equal(fakePhotos.trashItems.length, 1);
});

test('movePhotoToTrash rejects photos outside the current user albums', async () => {
  const fakePhotos = createFakePhotosDependencies();
  const photosService = createPhotosService(fakePhotos.dependencies);

  await assert.rejects(
    () => photosService.movePhotoToTrash('user-2', 'photo-existing'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'PHOTO_NOT_FOUND',
  );
});

test('createPhotoUploadTokenBodySchema rejects non-media uploads', () => {
  const result = createPhotoUploadTokenBodySchema.safeParse({
    albumId: 'album-1',
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    size: 1024,
  });

  assert.equal(result.success, false);
});

test('createPhotoUploadTokenBodySchema accepts image uploads up to 10 MB', () => {
  const result = createPhotoUploadTokenBodySchema.parse({
    albumId: 'album-1',
    fileName: 'cover.png',
    mimeType: 'image/png',
    size: 10 * 1024 * 1024,
  });

  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.size, 10 * 1024 * 1024);
});

test('createPhotoUploadTokenBodySchema accepts video uploads up to 200 MB', () => {
  const result = createPhotoUploadTokenBodySchema.parse({
    albumId: 'album-1',
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    size: 200 * 1024 * 1024,
  });

  assert.equal(result.mimeType, 'video/mp4');
  assert.equal(result.size, 200 * 1024 * 1024);
});

test('registerPhotoBodySchema rejects videos larger than 200 MB', () => {
  const result = registerPhotoBodySchema.safeParse({
    albumId: 'album-1',
    objectKey: 'users/user-1/albums/album-1/uuid-1234.mp4',
    fileName: 'clip.mp4',
    mimeType: 'video/mp4',
    size: 200 * 1024 * 1024 + 1,
  });

  assert.equal(result.success, false);
});

test('registerPhotoBodySchema accepts photo registration without a client-supplied url', () => {
  const result = registerPhotoBodySchema.parse({
    albumId: 'album-1',
    objectKey: 'users/user-1/albums/album-1/uuid-1234.png',
    fileName: 'cover.png',
    mimeType: 'image/png',
    size: 2048,
  });

  assert.equal(result.objectKey, 'users/user-1/albums/album-1/uuid-1234.png');
});

test('shared-space upload token schema parses without an album id', () => {
  const result = createSharedSpaceUploadTokenBodySchema.parse({
    fileName: 'shared.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  });

  assert.deepEqual(result, {
    fileName: 'shared.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  });
});

test('shared-space photo registration schema parses without an album id', () => {
  const result = registerSharedSpacePhotoBodySchema.parse({
    objectKey: 'users/user-1/albums/album-1/shared.jpg',
    fileName: 'shared.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    title: 'shared.jpg',
  });

  assert.equal(result.objectKey, 'users/user-1/albums/album-1/shared.jpg');
  assert.equal(result.fileName, 'shared.jpg');
});

test('createOssService binds object key, content type, and size into the upload token policy', async () => {
  let capturedPolicy: Record<string, unknown> | null = null;
  let signedPolicy: string | Record<string, unknown> | null = null;
  const ossService = createOssService(
    {
      region: 'oss-cn-hangzhou',
      bucket: 'memories-test',
      endpoint: '',
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      cdnUrl: 'https://cdn.example.com',
    },
    () => ({
      signPostObjectPolicyV4(policy) {
        capturedPolicy = policy;
        signedPolicy = policy;

        return 'signature-v4-value';
      },
      async delete() {
        return null;
      },
    }),
    () => new Date('2026-06-03T12:00:00.000Z'),
  );

  const token = await ossService.createImageUploadToken({
    objectKey: 'users/user-1/albums/album-1/uuid-1234.png',
    mimeType: 'image/png',
    size: 2048,
  });

  assert.deepEqual(capturedPolicy, {
    expiration: capturedPolicy?.expiration,
    conditions: [
      { bucket: 'memories-test' },
      { 'x-oss-credential': 'access-key-id/20260603/cn-hangzhou/oss/aliyun_v4_request' },
      { 'x-oss-date': '20260603T120000Z' },
      { 'x-oss-signature-version': 'OSS4-HMAC-SHA256' },
      ['eq', '$key', 'users/user-1/albums/album-1/uuid-1234.png'],
      ['eq', '$Content-Type', 'image/png'],
      ['content-length-range', 2048, 2048],
      ['eq', '$success_action_status', '200'],
    ],
  });
  assert.equal(signedPolicy, capturedPolicy);
  assert.equal(token.objectKey, 'users/user-1/albums/album-1/uuid-1234.png');
  const tokenRecord = token as unknown as Record<string, string>;
  assert.equal(tokenRecord.signature, 'signature-v4-value');
  assert.equal(tokenRecord.xOssDate, '20260603T120000Z');
  assert.equal(
    tokenRecord.xOssCredential,
    'access-key-id/20260603/cn-hangzhou/oss/aliyun_v4_request',
  );
  assert.equal(tokenRecord.signatureVersion, 'OSS4-HMAC-SHA256');
  assert.equal(tokenRecord.successActionStatus, '200');
  assert.equal(
    ossService.getObjectUrl('users/user-1/albums/album-1/uuid-1234.png'),
    'https://cdn.example.com/users/user-1/albums/album-1/uuid-1234.png',
  );
});

test('createOssService deletes objects through the OSS client', async () => {
  const deletedObjects: string[] = [];
  const ossService = createOssService(
    {
      region: 'oss-cn-hangzhou',
      bucket: 'memories-test',
      endpoint: '',
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      cdnUrl: '',
    },
    () => ({
      signPostObjectPolicyV4() {
        return 'signature-v4-value';
      },
      async delete(objectKey: string) {
        deletedObjects.push(objectKey);

        return null;
      },
    }),
  );

  await ossService.deleteObject('users/user-1/albums/album-1/photo-1.png');

  assert.deepEqual(deletedObjects, ['users/user-1/albums/album-1/photo-1.png']);
});

test('createOssService signs read URLs when no public CDN is configured', () => {
  const ossService = createOssService(
    {
      region: 'oss-cn-huhehaote',
      bucket: 'memories-test',
      endpoint: 'oss-cn-huhehaote.aliyuncs.com',
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      cdnUrl: '',
    },
    () => ({
      signPostObjectPolicyV4() {
        return 'signature-v4-value';
      },
      signatureUrl(objectKey: string, options?: { expires?: number }) {
        return `https://signed.example.com/${objectKey}?expires=${options?.expires}`;
      },
      async delete() {
        return null;
      },
    }),
  );

  assert.equal(
    ossService.getObjectUrl('users/user-1/albums/album-1/photo-1.png'),
    'https://signed.example.com/users/user-1/albums/album-1/photo-1.png?expires=3600',
  );
});

test('createOssService normalizes signed read URLs to HTTPS', () => {
  const ossService = createOssService(
    {
      region: 'oss-cn-huhehaote',
      bucket: 'memories-test',
      endpoint: 'oss-cn-huhehaote.aliyuncs.com',
      accessKeyId: 'access-key-id',
      accessKeySecret: 'access-key-secret',
      cdnUrl: '',
    },
    () => ({
      signPostObjectPolicyV4() {
        return 'signature-v4-value';
      },
      signatureUrl(objectKey: string, options?: { expires?: number }) {
        return `http://memories-test.oss-cn-huhehaote.aliyuncs.com/${objectKey}?expires=${options?.expires}`;
      },
      async delete() {
        return null;
      },
    }),
  );

  assert.equal(
    ossService.getObjectUrl('users/user-1/albums/album-1/photo-1.png'),
    'https://memories-test.oss-cn-huhehaote.aliyuncs.com/users/user-1/albums/album-1/photo-1.png?expires=3600',
  );
});
