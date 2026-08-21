import assert from 'node:assert/strict';
import test from 'node:test';
import { getSharedSpaceMemberAvatars } from './shared-space-avatars';
import type { Contact, SharedSpace } from '../types';

const space: SharedSpace = {
  id: 'space-1',
  title: '与测试用户的共享相册',
  photosCount: 4,
  contributorsCount: 2,
  contributorsAvatars: [],
  contributorUserIds: ['user-1', 'user-2'],
  coverUrl: 'cover.jpg',
};

const contacts: Contact[] = [
  {
    id: 'user-2',
    name: '测试用户',
    avatarUrl: 'friend-avatar.jpg',
    sharingCount: 0,
    isSharing: false,
    status: '好友',
  },
];

test('getSharedSpaceMemberAvatars returns current user and member contact avatars', () => {
  assert.deepEqual(
    getSharedSpaceMemberAvatars({
      space,
      currentUserId: 'user-1',
      currentUserAvatarUrl: 'me-avatar.jpg',
      contacts,
    }),
    ['me-avatar.jpg', 'friend-avatar.jpg'],
  );
});

test('getSharedSpaceMemberAvatars ignores stale stored avatars when member ids exist', () => {
  assert.deepEqual(
    getSharedSpaceMemberAvatars({
      space: {
        ...space,
        contributorsAvatars: ['old-owner-avatar.jpg', 'old-friend-avatar.jpg', 'stale-extra.jpg'],
      },
      currentUserId: 'user-1',
      currentUserAvatarUrl: 'me-avatar.jpg',
      contacts,
    }),
    ['me-avatar.jpg', 'friend-avatar.jpg'],
  );
});

test('getSharedSpaceMemberAvatars falls back to stored contributor avatars', () => {
  assert.deepEqual(
    getSharedSpaceMemberAvatars({
      space: {
        ...space,
        contributorUserIds: [],
        contributorsAvatars: ['stored-avatar.jpg'],
      },
      currentUserId: 'user-1',
      currentUserAvatarUrl: 'me-avatar.jpg',
      contacts: [],
    }),
    ['stored-avatar.jpg'],
  );
});
