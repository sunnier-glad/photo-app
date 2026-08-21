/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getAlbumCoverUrl,
  getAlbumDisplayType,
  getRecentAlbumsByUploadTime,
  getSelectionOrder,
  sortPhotosByFavorite,
} from './album-display';

test('getAlbumCoverUrl uses the first photo before the stored cover', () => {
  assert.equal(
    getAlbumCoverUrl({
      coverUrl: 'stored-cover.jpg',
      photos: [{ url: 'first-photo.jpg' }, { url: 'second-photo.jpg' }],
    }),
    'first-photo.jpg',
  );
});

test('getRecentAlbumsByUploadTime returns albums uploaded within three days newest first', () => {
  const albums = [
    {
      id: 'old',
      title: 'Old',
      coverUrl: '',
      type: 'all' as const,
      photos: [
        {
          id: 'old-photo',
          url: '',
          dateAdded: '2026-05-29',
          createdAt: '2026-05-29T00:00:00.000Z',
        },
      ],
    },
    {
      id: 'newer',
      title: 'Newer',
      coverUrl: '',
      type: 'all' as const,
      photos: [
        {
          id: 'newer-photo',
          url: '',
          dateAdded: '2026-06-04',
          createdAt: '2026-06-04T01:00:00.000Z',
        },
      ],
    },
    {
      id: 'recent',
      title: 'Recent',
      coverUrl: '',
      type: 'all' as const,
      photos: [
        {
          id: 'recent-photo',
          url: '',
          dateAdded: '2026-06-03',
          createdAt: '2026-06-03T12:00:00.000Z',
        },
      ],
    },
  ];

  const result = getRecentAlbumsByUploadTime(albums, new Date('2026-06-04T12:00:00.000Z'));

  assert.deepEqual(result.map((album) => album.id), ['newer', 'recent']);
});

test('getAlbumCoverUrl falls back to the stored cover when there are no photos', () => {
  assert.equal(
    getAlbumCoverUrl({
      coverUrl: 'stored-cover.jpg',
      photos: [],
    }),
    'stored-cover.jpg',
  );
});

test('getSelectionOrder returns one-based order from the current selection list', () => {
  assert.equal(getSelectionOrder(['photo-b', 'photo-a'], 'photo-b'), 1);
  assert.equal(getSelectionOrder(['photo-b', 'photo-a'], 'photo-a'), 2);
  assert.equal(getSelectionOrder(['photo-a'], 'photo-b'), null);
});

test('getAlbumDisplayType marks the default shared upload album as shared', () => {
  assert.equal(
    getAlbumDisplayType({
      title: '共享上传',
      description: '共享空间上传的照片和视频',
    }),
    'shared',
  );
});

test('getAlbumDisplayType keeps normal albums in all albums', () => {
  assert.equal(
    getAlbumDisplayType({
      title: '家人时光',
      description: '人像',
    }),
    'all',
  );
});

test('sortPhotosByFavorite keeps favorite photos before newer normal photos', () => {
  const result = sortPhotosByFavorite([
    {
      id: 'normal-new',
      isFavorite: false,
      createdAt: '2026-06-04T12:00:00.000Z',
      dateAdded: '2026-06-04',
    },
    {
      id: 'favorite-old',
      isFavorite: true,
      createdAt: '2026-06-02T12:00:00.000Z',
      dateAdded: '2026-06-02',
    },
    {
      id: 'normal-old',
      isFavorite: false,
      createdAt: '2026-06-01T12:00:00.000Z',
      dateAdded: '2026-06-01',
    },
  ]);

  assert.deepEqual(
    result.map((photo) => photo.id),
    ['favorite-old', 'normal-new', 'normal-old'],
  );
});
