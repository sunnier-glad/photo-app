import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import {
  createAlbumsService,
  type AlbumPhotoRecord,
} from '../../src/modules/albums/albums.service.js';

const createFakeAlbumsRepository = () => {
  const createdAt = new Date('2026-06-01T00:00:00.000Z');
  const albums = [
    {
      id: 'album-1',
      ownerId: 'user-1',
      title: 'Trips',
      description: 'Travel memories',
      coverUrl: null,
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'album-2',
      ownerId: 'user-2',
      title: 'Private',
      description: null,
      coverUrl: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];
  const photos: AlbumPhotoRecord[] = [
    {
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
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: 'photo-2',
      albumId: 'album-2',
      uploadedById: 'user-2',
      title: 'Private',
      location: null,
      objectKey: 'users/user-2/albums/album-2/photo-2.png',
      url: 'https://cdn.example.com/users/user-2/albums/album-2/photo-2.png',
      fileName: 'photo-2.png',
      mimeType: 'image/png',
      size: 4096,
      width: null,
      height: null,
      createdAt,
      updatedAt: createdAt,
    },
  ];

  return {
    repository: {
      async listByOwner(ownerId: string) {
        return albums.filter((album) => album.ownerId === ownerId);
      },
      async listWithPhotosByOwner(ownerId: string) {
        return albums
          .filter((album) => album.ownerId === ownerId)
          .map((album) => ({
            ...album,
            photos: photos.filter((photo) => photo.albumId === album.id),
          }));
      },
      async findByIdForOwner(albumId: string, ownerId: string) {
        return albums.find((album) => album.id === albumId && album.ownerId === ownerId) ?? null;
      },
      async listPhotos(albumId: string) {
        return photos.filter((photo) => photo.albumId === albumId);
      },
      async create(input: { ownerId: string; title: string; description: string | null }) {
        const album = {
          id: `album-${albums.length + 1}`,
          coverUrl: null,
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
          updatedAt: new Date('2026-06-02T00:00:00.000Z'),
          ...input,
        };

        albums.push(album);

        return album;
      },
    },
  };
};

test('listAlbums returns only albums owned by the current user', async () => {
  const fakeAlbums = createFakeAlbumsRepository();
  const albumsService = createAlbumsService(fakeAlbums.repository);

  const result = await albumsService.listAlbums('user-1');

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'album-1');
  assert.equal(result[0]?.ownerId, 'user-1');
});

test('listAlbumsWithPhotos returns owned albums with nested photos', async () => {
  const fakeAlbums = createFakeAlbumsRepository();
  const albumsService = createAlbumsService(fakeAlbums.repository);

  const result = await albumsService.listAlbumsWithPhotos('user-1');

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'album-1');
  assert.equal(result[0]?.photos.length, 1);
  assert.equal(result[0]?.photos[0]?.id, 'photo-1');
});

test('listAlbumPhotos returns photos for an album owned by the current user', async () => {
  const fakeAlbums = createFakeAlbumsRepository();
  const albumsService = createAlbumsService(fakeAlbums.repository);

  const result = await albumsService.listAlbumPhotos('user-1', 'album-1');

  assert.equal(result.length, 1);
  assert.equal(result[0]?.id, 'photo-1');
  assert.equal(result[0]?.albumId, 'album-1');
});

test('listAlbumPhotos rejects albums outside the current user ownership', async () => {
  const fakeAlbums = createFakeAlbumsRepository();
  const albumsService = createAlbumsService(fakeAlbums.repository);

  await assert.rejects(
    () => albumsService.listAlbumPhotos('user-1', 'album-2'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'ALBUM_NOT_FOUND',
  );
});

test('createAlbum stores a trimmed album for the current owner', async () => {
  const fakeAlbums = createFakeAlbumsRepository();
  const albumsService = createAlbumsService(fakeAlbums.repository);

  const album = await albumsService.createAlbum('user-1', {
    title: '  Summer 2026  ',
    description: '  Beach days  ',
  });

  assert.equal(album.ownerId, 'user-1');
  assert.equal(album.title, 'Summer 2026');
  assert.equal(album.description, 'Beach days');
});

test('createAlbum rejects blank album titles', async () => {
  const fakeAlbums = createFakeAlbumsRepository();
  const albumsService = createAlbumsService(fakeAlbums.repository);

  await assert.rejects(
    () =>
      albumsService.createAlbum('user-1', {
        title: '   ',
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.code === 'INVALID_ALBUM_TITLE',
  );
});
