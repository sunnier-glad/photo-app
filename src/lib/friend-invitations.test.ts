/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  getInvitationPersonName,
  getReceivedInvitationTitle,
  getSentInvitationTitle,
} from './friend-invitations';
import type { ApiFriendInvitation } from '../types';

const baseInvitation: ApiFriendInvitation = {
  id: 'invitation-1',
  senderId: 'sender-id',
  receiverId: 'receiver-id',
  pairUserAId: 'receiver-id',
  pairUserBId: 'sender-id',
  status: 'PENDING',
  createdAt: '2026-06-04T00:00:00.000Z',
  updatedAt: '2026-06-04T00:00:00.000Z',
};

test('friend invitation titles use sender and receiver display names', () => {
  const invitation: ApiFriendInvitation = {
    ...baseInvitation,
    sender: {
      id: 'sender-id',
      username: 'sender-user',
      email: 'sender@example.com',
      displayName: '小曹',
      avatarUrl: null,
      bio: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    },
    receiver: {
      id: 'receiver-id',
      username: 'receiver-user',
      email: 'receiver@example.com',
      displayName: '测试用户',
      avatarUrl: null,
      bio: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    },
  };

  assert.equal(getReceivedInvitationTitle(invitation), '来自 小曹 的添加请求');
  assert.equal(getSentInvitationTitle(invitation), '发给 测试用户 的添加请求');
});

test('getInvitationPersonName falls back to username and then id', () => {
  assert.equal(
    getInvitationPersonName({
      id: 'user-id',
      username: 'username-only',
      email: 'user@example.com',
      displayName: '',
      avatarUrl: null,
      bio: null,
      createdAt: '2026-06-04T00:00:00.000Z',
      updatedAt: '2026-06-04T00:00:00.000Z',
    }),
    'username-only',
  );
  assert.equal(getInvitationPersonName(undefined, 'fallback-id'), 'fallback-id');
});
