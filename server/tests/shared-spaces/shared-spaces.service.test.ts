import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import {
  createSharedSpacesService,
  type SharedSpaceMemberRecord,
  type SharedSpacePhotoRecord,
  type SharedSpaceRecord,
  type SharedUploadAlbumRecord,
  type SharedUploadPhotoRecord,
} from '../../src/modules/shared-spaces/shared-spaces.service.js';

const now = new Date('2026-06-02T00:00:00.000Z');

const createFakeSharedSpacesRepository = () => {
  const spaces: SharedSpaceRecord[] = [
    {
      id: 'space-1',
      ownerId: 'owner-1',
      title: 'Family',
      description: null,
      coverUrl: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const members: SharedSpaceMemberRecord[] = [];
  const sharedPhotos: SharedSpacePhotoRecord[] = [];
  const trashItems: Array<{
    id: string;
    photoId: string;
    originalAlbumId: string;
    deletedById: string;
    expiresAt: Date;
    createdAt: Date;
  }> = [];
  const friendships = new Set(['friend-1|owner-1']);
  const albums = new Map<string, SharedUploadAlbumRecord>([
    [
      'album-1',
      {
        id: 'album-1',
        ownerId: 'owner-1',
        title: 'Existing',
        description: null,
        coverUrl: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const users = new Map([
    [
      'owner-1',
      {
        id: 'owner-1',
        personalId: 'u111111',
        username: 'owner',
        email: 'owner@example.com',
        displayName: 'Owner',
        avatarUrl: null,
        bio: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    [
      'friend-1',
      {
        id: 'friend-1',
        personalId: 'u222222',
        username: 'friend',
        email: 'friend@example.com',
        displayName: 'Friend',
        avatarUrl: 'https://example.com/friend.jpg',
        bio: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const basePhotos = new Map<string, SharedUploadPhotoRecord>([
    [
      'photo-1',
      {
        id: 'photo-1',
        albumId: 'album-1',
        uploadedById: 'owner-1',
        title: null,
        location: null,
        objectKey: 'users/owner-1/albums/album-1/photo-1.jpg',
        url: 'https://oss.example.com/users/owner-1/albums/album-1/photo-1.jpg',
        fileName: 'photo-1.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        width: null,
        height: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    [
      'photo-2',
      {
        id: 'photo-2',
        albumId: 'album-2',
        uploadedById: 'friend-1',
        title: null,
        location: null,
        objectKey: 'users/friend-1/albums/album-2/photo-2.jpg',
        url: 'https://oss.example.com/users/friend-1/albums/album-2/photo-2.jpg',
        fileName: 'photo-2.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        width: null,
        height: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
  ]);
  const createdPhotos: SharedUploadPhotoRecord[] = [];
  const ownedPhotos = new Map([
    [
      'photo-1',
      {
        id: 'photo-1',
        albumId: 'album-1',
        uploadedById: 'owner-1',
      },
    ],
    [
      'photo-2',
      {
        id: 'photo-2',
        albumId: 'album-2',
        uploadedById: 'friend-1',
      },
    ],
  ]);
  const toSharedPhotoWithDetails = (sharedPhoto: SharedSpacePhotoRecord) => {
    const photo = basePhotos.get(sharedPhoto.photoId) ?? createdPhotos.find((item) => item.id === sharedPhoto.photoId);
    const sharedBy = users.get(sharedPhoto.sharedById);

    if (!photo || !sharedBy) {
      throw new Error('Missing fake shared photo details');
    }

    return {
      ...sharedPhoto,
      photo,
      sharedBy,
    };
  };

  return {
    members,
    sharedPhotos,
    trashItems,
    createdPhotos,
    repository: {
      async createSpace(input: { ownerId: string; title: string; description: string | null }) {
        const space = {
          id: `space-${spaces.length + 1}`,
          coverUrl: null,
          createdAt: now,
          updatedAt: now,
          ...input,
        };

        spaces.push(space);

        return space;
      },
      async updateSpace(
        spaceId: string,
        input: { title: string; description: string | null },
      ) {
        const space = spaces.find((item) => item.id === spaceId);

        if (!space) {
          throw new Error('Missing fake shared space');
        }

        space.title = input.title;
        space.description = input.description;
        space.updatedAt = now;

        return space;
      },
      async listAccessibleSpaces(userId: string) {
        return spaces.filter(
          (space) =>
            space.ownerId === userId ||
            members.some(
              (member) =>
                member.sharedSpaceId === space.id &&
                member.userId === userId &&
                member.status === 'ACTIVE',
            ),
        );
      },
      async listAccessibleSpacesWithDetails(userId: string) {
        return spaces
          .filter(
            (space) =>
              space.ownerId === userId ||
              members.some(
                (member) =>
                  member.sharedSpaceId === space.id &&
                  member.userId === userId &&
                  member.status === 'ACTIVE',
              ),
          )
          .map((space) => ({
            ...space,
            members: members.filter((member) => member.sharedSpaceId === space.id),
            photos: sharedPhotos
              .filter(
                (photo) =>
                  photo.sharedSpaceId === space.id &&
                  !trashItems.some((trashItem) => trashItem.photoId === photo.photoId),
              )
              .map(toSharedPhotoWithDetails),
          }));
      },
      async findSpaceById(spaceId: string) {
        return spaces.find((space) => space.id === spaceId) ?? null;
      },
      async findMembership(spaceId: string, userId: string) {
        return (
          members.find((member) => member.sharedSpaceId === spaceId && member.userId === userId) ??
          null
        );
      },
      async listMembers(spaceId: string) {
        return members.filter((member) => member.sharedSpaceId === spaceId);
      },
      async createMemberIfAbsent(input: { sharedSpaceId: string; userId: string; status: 'ACTIVE' }) {
        const existing = members.find(
          (member) => member.sharedSpaceId === input.sharedSpaceId && member.userId === input.userId,
        );

        if (existing) {
          if (['LEFT', 'REMOVED'].includes(existing.status)) {
            existing.status = input.status;
            existing.updatedAt = now;
          }

          return existing;
        }

        const member = {
          id: `member-${members.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...input,
        };

        members.push(member);

        return member;
      },
      async areFriends(userId: string, otherUserId: string) {
        const [userAId, userBId] = [userId, otherUserId].sort();

        return friendships.has(`${userAId}|${userBId}`);
      },
      async listPhotos(spaceId: string) {
        return sharedPhotos
          .filter(
            (photo) =>
              photo.sharedSpaceId === spaceId &&
              !trashItems.some((trashItem) => trashItem.photoId === photo.photoId),
          )
          .map(toSharedPhotoWithDetails);
      },
      async findSharedPhoto(spaceId: string, sharedPhotoId: string) {
        const sharedPhoto = sharedPhotos.find(
          (photo) => photo.sharedSpaceId === spaceId && photo.id === sharedPhotoId,
        );

        return sharedPhoto ? toSharedPhotoWithDetails(sharedPhoto) : null;
      },
      async createTrashItemIfAbsent(input: {
        photoId: string;
        originalAlbumId: string;
        deletedById: string;
        expiresAt: Date;
      }) {
        const existing = trashItems.find((trashItem) => trashItem.photoId === input.photoId);

        if (existing) {
          return existing;
        }

        const trashItem = {
          id: `trash-${trashItems.length + 1}`,
          createdAt: now,
          ...input,
        };

        trashItems.push(trashItem);

        return trashItem;
      },
      async findOwnedPhoto(photoId: string, ownerId: string) {
        const photo = ownedPhotos.get(photoId);

        return photo && photo.uploadedById === ownerId ? photo : null;
      },
      async createSharedPhotoIfAbsent(input: {
        sharedSpaceId: string;
        photoId: string;
        sharedById: string;
      }) {
        const existing = sharedPhotos.find(
          (photo) => photo.sharedSpaceId === input.sharedSpaceId && photo.photoId === input.photoId,
        );

        if (existing) {
          return toSharedPhotoWithDetails(existing);
        }

        const sharedPhoto = {
          id: `shared-photo-${sharedPhotos.length + 1}`,
          createdAt: now,
          ...input,
        };

        sharedPhotos.push(sharedPhoto);

        return toSharedPhotoWithDetails(sharedPhoto);
      },
      async findDefaultUploadAlbum(ownerId: string) {
        return (
          Array.from(albums.values()).find(
            (album) => album.ownerId === ownerId && album.title === '共享上传',
          ) ?? null
        );
      },
      async createDefaultUploadAlbum(ownerId: string) {
        const album = {
          id: `album-${albums.size + 1}`,
          ownerId,
          title: '共享上传',
          description: '共享空间上传的照片和视频',
          coverUrl: null,
          createdAt: now,
          updatedAt: now,
        };

        albums.set(album.id, album);

        return album;
      },
      async createPhoto(input: Omit<SharedUploadPhotoRecord, 'id' | 'createdAt' | 'updatedAt'>) {
        const photo = {
          id: `photo-${ownedPhotos.size + createdPhotos.length + 1}`,
          createdAt: now,
          updatedAt: now,
          ...input,
        };

        createdPhotos.push(photo);
        ownedPhotos.set(photo.id, {
          id: photo.id,
          albumId: photo.albumId,
          uploadedById: photo.uploadedById,
        });

        return photo;
      },
      async createUploadToken(input: { objectKey: string; mimeType: string; size: number }) {
        return {
          host: 'https://oss.example.com',
          objectKey: input.objectKey,
          policy: 'policy',
          signature: 'signature',
          accessKeyId: 'access-key',
          xOssDate: '20260604T000000Z',
          xOssCredential: 'credential',
          signatureVersion: 'OSS4-HMAC-SHA256',
          successActionStatus: '200',
        };
      },
      getObjectUrl(objectKey: string) {
        return `https://oss.example.com/${objectKey}`;
      },
    },
  };
};

test('createSpace trims title and stores blank description as null', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const space = await sharedSpacesService.createSpace('owner-1', {
    title: '  Vacation Planning  ',
    description: '   ',
  });

  assert.equal(space.ownerId, 'owner-1');
  assert.equal(space.title, 'Vacation Planning');
  assert.equal(space.description, null);
});

test('updateSpace lets the owner rename a shared space', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const space = await sharedSpacesService.updateSpace('owner-1', 'space-1', {
    title: '  新名字  ',
    description: '  家庭旅行  ',
  });

  assert.equal(space.title, '新名字');
  assert.equal(space.description, '家庭旅行');
});

test('updateSpace rejects users without active access', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await assert.rejects(
    () => sharedSpacesService.updateSpace('friend-1', 'space-1', { title: '朋友改名' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'SHARED_SPACE_NOT_FOUND',
  );
});

test('updateSpace lets active members rename a shared space', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });

  const space = await sharedSpacesService.updateSpace('friend-1', 'space-1', {
    title: 'Member Rename',
  });

  assert.equal(space.title, 'Member Rename');
});

test('inviteMember requires the current user to own the shared space', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await assert.rejects(
    () => sharedSpacesService.inviteMember('friend-1', 'space-1', { userId: 'owner-1' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'SHARED_SPACE_NOT_FOUND',
  );
});

test('inviteMember requires friendship with the invited user', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await assert.rejects(
    () => sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'stranger-1' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 403 &&
      error.code === 'FRIENDSHIP_REQUIRED',
  );
});

test('inviteMember is idempotent for an existing membership', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const firstInvite = await sharedSpacesService.inviteMember('owner-1', 'space-1', {
    userId: 'friend-1',
  });
  const secondInvite = await sharedSpacesService.inviteMember('owner-1', 'space-1', {
    userId: 'friend-1',
  });

  assert.equal(firstInvite.id, secondInvite.id);
  assert.equal(fakeSpaces.members.length, 1);
});

test('inviteMember re-activates left or removed members', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);
  const member = await sharedSpacesService.inviteMember('owner-1', 'space-1', {
    userId: 'friend-1',
  });

  member.status = 'LEFT';
  const reinvitedMember = await sharedSpacesService.inviteMember('owner-1', 'space-1', {
    userId: 'friend-1',
  });

  assert.equal(reinvitedMember.id, member.id);
  assert.equal(reinvitedMember.status, 'ACTIVE');
});

test('listMembers hides spaces from unauthorized users', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await assert.rejects(
    () => sharedSpacesService.listMembers('stranger-1', 'space-1'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'SHARED_SPACE_NOT_FOUND',
  );
});

test('invited friends can list members and photos immediately', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });

  const members = await sharedSpacesService.listMembers('friend-1', 'space-1');
  const photos = await sharedSpacesService.listPhotos('friend-1', 'space-1');

  assert.equal(members.length, 1);
  assert.equal(members[0]!.status, 'ACTIVE');
  assert.equal(photos.length, 0);
});

test('listSpacesWithDetails returns accessible spaces with members and photos', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });
  await sharedSpacesService.addPhoto('friend-1', 'space-1', { photoId: 'photo-2' });

  const spaces = await sharedSpacesService.listSpacesWithDetails('owner-1');

  assert.equal(spaces.length, 1);
  assert.equal(spaces[0]!.members.length, 1);
  assert.equal(spaces[0]!.photos.length, 1);
  assert.equal(spaces[0]!.photos[0]!.sharedBy.displayName, 'Friend');
});

test('deleteOwnSharedPhoto moves the current user shared photo to trash', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const sharedPhoto = await sharedSpacesService.addPhoto('owner-1', 'space-1', {
    photoId: 'photo-1',
  });
  const result = await sharedSpacesService.deleteOwnSharedPhoto(
    'owner-1',
    'space-1',
    sharedPhoto.id,
    { now },
  );

  assert.equal(result.photoId, 'photo-1');
  assert.equal(fakeSpaces.trashItems.length, 1);
  assert.equal(fakeSpaces.trashItems[0]!.deletedById, 'owner-1');
  assert.equal(fakeSpaces.trashItems[0]!.originalAlbumId, 'album-1');
});

test('deleteOwnSharedPhoto rejects photos uploaded by another member', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });
  const sharedPhoto = await sharedSpacesService.addPhoto('friend-1', 'space-1', {
    photoId: 'photo-2',
  });

  await assert.rejects(
    () => sharedSpacesService.deleteOwnSharedPhoto('owner-1', 'space-1', sharedPhoto.id, { now }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 403 &&
      error.code === 'SHARED_PHOTO_DELETE_FORBIDDEN',
  );
});

test('addPhoto requires active access and handles duplicates idempotently', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await assert.rejects(
    () => sharedSpacesService.addPhoto('friend-1', 'space-1', { photoId: 'photo-2' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'SHARED_SPACE_NOT_FOUND',
  );

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });
  const firstPhoto = await sharedSpacesService.addPhoto('friend-1', 'space-1', {
    photoId: 'photo-2',
  });
  const secondPhoto = await sharedSpacesService.addPhoto('friend-1', 'space-1', {
    photoId: 'photo-2',
  });

  assert.equal(firstPhoto.id, secondPhoto.id);
  assert.equal(fakeSpaces.sharedPhotos.length, 1);
});

test('createUploadToken creates a token inside the default shared upload album for the owner', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const token = await sharedSpacesService.createUploadToken('owner-1', 'space-1', {
    fileName: 'trip.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  });

  assert.match(token.objectKey, /^users\/owner-1\/albums\/album-2\//);
  assert.equal(token.successActionStatus, '200');
});

test('active members can create shared upload tokens', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });

  const token = await sharedSpacesService.createUploadToken('friend-1', 'space-1', {
    fileName: 'friend.png',
    mimeType: 'image/png',
    size: 2048,
  });

  assert.match(token.objectKey, /^users\/friend-1\/albums\/album-2\//);
});

test('non-members cannot create shared upload tokens', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await assert.rejects(
    () =>
      sharedSpacesService.createUploadToken('stranger-1', 'space-1', {
        fileName: 'stranger.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'SHARED_SPACE_NOT_FOUND',
  );
});

test('inactive members cannot create shared upload tokens', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const member = await sharedSpacesService.inviteMember('owner-1', 'space-1', {
    userId: 'friend-1',
  });
  member.status = 'LEFT';

  await assert.rejects(
    () =>
      sharedSpacesService.createUploadToken('friend-1', 'space-1', {
        fileName: 'left-member.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'SHARED_SPACE_NOT_FOUND',
  );
});

test('registerUploadedPhoto creates a normal photo and links it to the shared space', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  const token = await sharedSpacesService.createUploadToken('owner-1', 'space-1', {
    fileName: 'trip.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
  });
  const sharedPhoto = await sharedSpacesService.registerUploadedPhoto('owner-1', 'space-1', {
    objectKey: token.objectKey,
    fileName: 'trip.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    title: 'trip.jpg',
  });

  assert.equal(sharedPhoto.sharedById, 'owner-1');
  assert.equal(sharedPhoto.photo.fileName, 'trip.jpg');
  assert.equal(sharedPhoto.sharedBy.displayName, 'Owner');
  assert.equal(fakeSpaces.createdPhotos.length, 1);
  assert.equal(fakeSpaces.createdPhotos[0]!.albumId, 'album-2');
  assert.equal(fakeSpaces.sharedPhotos.length, 1);
});

test('listPhotos returns nested photo and contributor data', async () => {
  const fakeSpaces = createFakeSharedSpacesRepository();
  const sharedSpacesService = createSharedSpacesService(fakeSpaces.repository);

  await sharedSpacesService.inviteMember('owner-1', 'space-1', { userId: 'friend-1' });
  const token = await sharedSpacesService.createUploadToken('friend-1', 'space-1', {
    fileName: 'friend.png',
    mimeType: 'image/png',
    size: 2048,
  });
  await sharedSpacesService.registerUploadedPhoto('friend-1', 'space-1', {
    objectKey: token.objectKey,
    fileName: 'friend.png',
    mimeType: 'image/png',
    size: 2048,
  });

  const photos = await sharedSpacesService.listPhotos('owner-1', 'space-1');

  assert.equal(photos.length, 1);
  assert.equal(photos[0]!.photo.fileName, 'friend.png');
  assert.equal(photos[0]!.sharedBy.displayName, 'Friend');
  assert.equal(photos[0]!.sharedBy.avatarUrl, 'https://example.com/friend.jpg');
});
