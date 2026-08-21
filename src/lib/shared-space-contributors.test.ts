import assert from 'node:assert/strict';
import test from 'node:test';
import { createContributorFilters, filterSharedPhotosByContributor } from './shared-space-contributors';
import type { ApiSharedSpacePhoto } from '../types';

const photos: ApiSharedSpacePhoto[] = [
  {
    id: 'shared-1',
    sharedSpaceId: 'space-1',
    photoId: 'photo-1',
    sharedById: 'user-1',
    createdAt: '2026-06-04T00:00:00.000Z',
    sharedBy: {
      id: 'user-1',
      personalId: 'u111111',
      username: 'me',
      email: 'me@example.com',
      displayName: '测试用户',
      avatarUrl: null,
      bio: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    },
  },
  {
    id: 'shared-2',
    sharedSpaceId: 'space-1',
    photoId: 'photo-2',
    sharedById: 'user-2',
    createdAt: '2026-06-04T00:00:00.000Z',
    sharedBy: {
      id: 'user-2',
      personalId: 'u222222',
      username: 'friend',
      email: 'friend@example.com',
      displayName: '好友',
      avatarUrl: null,
      bio: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    },
  },
];

test('createContributorFilters returns all, me, and friend labels', () => {
  const filters = createContributorFilters(photos, 'user-1');

  assert.deepEqual(filters.map((filter) => filter.label), ['全部', '我上传的', '好友']);
});

test('filterSharedPhotosByContributor filters by sharedById', () => {
  const filtered = filterSharedPhotosByContributor(photos, 'user-2');

  assert.deepEqual(filtered.map((photo) => photo.id), ['shared-2']);
});
