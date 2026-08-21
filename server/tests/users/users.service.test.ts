import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import type { AuthUserRecord } from '../../src/modules/auth/auth.service.js';
import {
  createUsersService,
  type UsersUploadSigner,
  type UsersRepository,
} from '../../src/modules/users/users.service.js';
import {
  createAvatarUploadTokenBodySchema,
  MAX_AVATAR_UPLOAD_SIZE,
} from '../../src/modules/users/users.schemas.js';

const createFakeUsersRepository = () => {
  const users = new Map<string, AuthUserRecord>();
  const storageSummaries = new Map<
    string,
    {
      usedBytes: number;
      photoCount: number;
    }
  >();

  const repository: UsersRepository = {
    async findById(id) {
      return users.get(id) ?? null;
    },
    async updateProfile() {
      throw new Error('Not implemented for this test');
    },
    async getStorageSummary(userId) {
      return storageSummaries.get(userId) ?? null;
    },
  };

  return {
    repository,
    seedUser(user: AuthUserRecord) {
      users.set(user.id, user);
    },
    seedStorageSummary(userId: string, summary: { usedBytes: number; photoCount: number }) {
      storageSummaries.set(userId, summary);
    },
  };
};

const createFakeUser = (overrides: Partial<AuthUserRecord> = {}): AuthUserRecord => ({
  id: 'user-1',
  personalId: 'u111111',
  username: 'alice',
  email: 'alice@example.com',
  passwordHash: 'hash',
  displayName: 'Alice',
  avatarUrl: null,
  bio: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

const createFakeUploadSigner = () => {
  const createImageUploadTokenInputs: Parameters<UsersUploadSigner['createImageUploadToken']>[0][] =
    [];

  const uploadSigner: UsersUploadSigner = {
    async createImageUploadToken(input) {
      createImageUploadTokenInputs.push(input);

      return {
        host: 'https://oss.example.com',
        objectKey: input.objectKey,
        policy: 'policy',
        signature: 'signature',
        accessKeyId: 'access-key-id',
        xOssDate: '20260603T120000Z',
        xOssCredential: 'access-key-id/20260603/cn-huhehaote/oss/aliyun_v4_request',
        signatureVersion: 'OSS4-HMAC-SHA256',
        successActionStatus: '200',
      };
    },
    getObjectUrl(objectKey) {
      return `https://cdn.example.com/${objectKey}`;
    },
  };

  return {
    uploadSigner,
    createImageUploadTokenInputs,
  };
};

test('getStorageSummary returns the current user storage summary', async () => {
  const fakeUsers = createFakeUsersRepository();
  fakeUsers.seedStorageSummary('user-1', {
    usedBytes: 2048,
    photoCount: 3,
  });
  const fakeUploadSigner = createFakeUploadSigner();

  const usersService = createUsersService({
    usersRepository: fakeUsers.repository,
    uploadSigner: fakeUploadSigner.uploadSigner,
  });

  const result = await usersService.getStorageSummary('user-1');

  assert.deepEqual(result, {
    usedBytes: 2048,
    photoCount: 3,
  });
});

test('getStorageSummary rejects when the user summary cannot be found', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeUploadSigner = createFakeUploadSigner();
  const usersService = createUsersService({
    usersRepository: fakeUsers.repository,
    uploadSigner: fakeUploadSigner.uploadSigner,
  });

  await assert.rejects(
    () => usersService.getStorageSummary('missing-user'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'USER_STORAGE_NOT_FOUND',
  );
});

test('createAvatarUploadToken signs an avatar object key inside the current user namespace', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeUploadSigner = createFakeUploadSigner();
  fakeUsers.seedUser(createFakeUser({ id: 'user-1' }));

  const usersService = createUsersService({
    usersRepository: fakeUsers.repository,
    uploadSigner: fakeUploadSigner.uploadSigner,
    createObjectId: () => 'avatar-uuid',
  });

  const result = await usersService.createAvatarUploadToken('user-1', {
    fileName: 'profile.PNG',
    mimeType: 'image/png',
    size: 1024,
  });

  assert.deepEqual(fakeUploadSigner.createImageUploadTokenInputs, [
    {
      objectKey: 'users/user-1/avatars/avatar-uuid.png',
      mimeType: 'image/png',
      size: 1024,
    },
  ]);
  assert.deepEqual(result, {
    host: 'https://oss.example.com',
    objectKey: 'users/user-1/avatars/avatar-uuid.png',
    policy: 'policy',
    signature: 'signature',
    accessKeyId: 'access-key-id',
    xOssDate: '20260603T120000Z',
    xOssCredential: 'access-key-id/20260603/cn-huhehaote/oss/aliyun_v4_request',
    signatureVersion: 'OSS4-HMAC-SHA256',
    successActionStatus: '200',
    avatarUrl: 'https://cdn.example.com/users/user-1/avatars/avatar-uuid.png',
  });
});

test('createAvatarUploadToken rejects missing users', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeUploadSigner = createFakeUploadSigner();
  const usersService = createUsersService({
    usersRepository: fakeUsers.repository,
    uploadSigner: fakeUploadSigner.uploadSigner,
  });

  await assert.rejects(
    () =>
      usersService.createAvatarUploadToken('missing-user', {
        fileName: 'profile.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }),
    (error: unknown) =>
      error instanceof HttpError && error.statusCode === 404 && error.code === 'USER_NOT_FOUND',
  );
  assert.deepEqual(fakeUploadSigner.createImageUploadTokenInputs, []);
});

test('updateCurrentUser accepts long external avatar URLs', async () => {
  const longAvatarUrl = `https://images.example.com/avatars/user-1/avatar.png?${'x'.repeat(
    1200,
  )}`;
  const fakeUser = createFakeUser({ id: 'user-1' });
  const fakeUploadSigner = createFakeUploadSigner();
  const usersRepository: UsersRepository = {
    async findById() {
      return fakeUser;
    },
    async updateProfile(_id, input) {
      return {
        ...fakeUser,
        avatarUrl: input.avatarUrl ?? null,
        displayName: input.displayName ?? fakeUser.displayName,
        bio: input.bio ?? fakeUser.bio,
      };
    },
    async getStorageSummary() {
      return { usedBytes: 0, photoCount: 0 };
    },
  };
  const usersService = createUsersService({
    usersRepository,
    uploadSigner: fakeUploadSigner.uploadSigner,
  });

  const result = await usersService.updateCurrentUser('user-1', {
    avatarUrl: longAvatarUrl,
  });

  assert.equal(result.avatarUrl, longAvatarUrl);
});

test('getCurrentUser signs the stable avatar object key instead of returning an expired saved URL', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeUploadSigner = createFakeUploadSigner();
  fakeUsers.seedUser({
    ...createFakeUser({
      id: 'user-1',
      avatarUrl: 'https://memories-test.oss-cn-huhehaote.aliyuncs.com/users/user-1/avatars/old.png?Expires=1',
    }),
    avatarObjectKey: 'users/user-1/avatars/avatar-uuid.png',
  } as AuthUserRecord);

  const usersService = createUsersService({
    usersRepository: fakeUsers.repository,
    uploadSigner: fakeUploadSigner.uploadSigner,
  });

  const result = await usersService.getCurrentUser('user-1');

  assert.equal(result.avatarUrl, 'https://cdn.example.com/users/user-1/avatars/avatar-uuid.png');
});

test('updateCurrentUser converts managed OSS avatar URLs to stable object keys', async () => {
  const signedAvatarUrl =
    'https://memories-test.oss-cn-huhehaote.aliyuncs.com/users/user-1/avatars/avatar-uuid.png?Expires=1&Signature=expired';
  const fakeUser = createFakeUser({ id: 'user-1' });
  const fakeUploadSigner = createFakeUploadSigner();
  let persistedInput: unknown = null;
  const usersRepository: UsersRepository = {
    async findById() {
      return fakeUser;
    },
    async updateProfile(_id, input) {
      persistedInput = input;

      return {
        ...fakeUser,
        avatarUrl: null,
        avatarObjectKey: 'users/user-1/avatars/avatar-uuid.png',
      } as AuthUserRecord;
    },
    async getStorageSummary() {
      return { usedBytes: 0, photoCount: 0 };
    },
  };
  const usersService = createUsersService({
    usersRepository,
    uploadSigner: fakeUploadSigner.uploadSigner,
  });

  const result = await usersService.updateCurrentUser('user-1', {
    avatarUrl: signedAvatarUrl,
  });

  assert.deepEqual(persistedInput, {
    avatarUrl: null,
    avatarObjectKey: 'users/user-1/avatars/avatar-uuid.png',
  });
  assert.equal(result.avatarUrl, 'https://cdn.example.com/users/user-1/avatars/avatar-uuid.png');
});

test('createAvatarUploadTokenBodySchema rejects non-image uploads', () => {
  assert.throws(() =>
    createAvatarUploadTokenBodySchema.parse({
      fileName: 'avatar.txt',
      mimeType: 'text/plain',
      size: 1024,
    }),
  );
});

test('createAvatarUploadTokenBodySchema rejects avatar uploads larger than 3 MB', () => {
  assert.throws(() =>
    createAvatarUploadTokenBodySchema.parse({
      fileName: 'avatar.jpg',
      mimeType: 'image/jpeg',
      size: MAX_AVATAR_UPLOAD_SIZE + 1,
    }),
  );
});
