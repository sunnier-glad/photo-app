import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mapPhoto, mapTrashItem } from './mappers';
import type { ApiPhoto, ApiTrashItem } from '../types';

const readObjectKey = (photo: { objectKey?: string }) => photo.objectKey;

const apiPhoto: ApiPhoto = {
  id: 'photo-1',
  albumId: 'album-1',
  uploadedById: 'user-1',
  title: 'Sunset',
  aiTitle: null,
  location: null,
  objectKey: 'photos/sunset.jpg',
  url: 'https://cdn.example.com/photos/sunset.jpg',
  fileName: 'sunset.jpg',
  mimeType: 'image/jpeg',
  size: 1024,
  width: 1200,
  height: 800,
  isFavorite: false,
  createdAt: '2026-06-04T08:00:00.000Z',
  updatedAt: '2026-06-04T08:00:00.000Z',
};

test('mapPhoto keeps objectKey on ui photo objects', () => {
  const result = mapPhoto(apiPhoto);

  assert.equal(readObjectKey(result), 'photos/sunset.jpg');
});

test('mapTrashItem keeps objectKey on deleted photo objects', () => {
  const trashItem: ApiTrashItem = {
    id: 'trash-1',
    photoId: apiPhoto.id,
    originalAlbumId: apiPhoto.albumId,
    deletedById: 'user-2',
    expiresAt: '2026-06-10T08:00:00.000Z',
    createdAt: '2026-06-04T09:00:00.000Z',
    photo: apiPhoto,
  };

  const result = mapTrashItem(trashItem);

  assert.equal(readObjectKey(result), 'photos/sunset.jpg');
});
