import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import {
  createFriendsService,
  type FriendInvitationRecord,
  type FriendshipRecord,
  type UserPublicRecord,
} from '../../src/modules/friends/friends.service.js';

const now = new Date('2026-06-02T00:00:00.000Z');

const createFakeFriendsRepository = () => {
  const users: UserPublicRecord[] = [
    {
      id: 'user-1',
      personalId: 'u111111',
      username: 'alice',
      email: 'alice@example.com',
      displayName: 'Alice',
      avatarUrl: null,
      bio: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-2',
      personalId: 'u222222',
      username: 'bob',
      email: 'bob@example.com',
      displayName: 'Bob',
      avatarUrl: null,
      bio: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'user-3',
      personalId: 'u333333',
      username: 'carol',
      email: 'carol@example.com',
      displayName: 'Carol',
      avatarUrl: null,
      bio: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const invitations: FriendInvitationRecord[] = [];
  const friendships: FriendshipRecord[] = [];

  return {
    invitations,
    friendships,
    repository: {
      async findUserById(userId: string) {
        return users.find((user) => user.id === userId) ?? null;
      },
      async findUserByPersonalId(personalId: string) {
        return users.find((user) => user.personalId === personalId) ?? null;
      },
      async listFriends(userId: string) {
        return friendships
          .filter((friendship) => friendship.userAId === userId || friendship.userBId === userId)
          .map((friendship) => {
            const friendId = friendship.userAId === userId ? friendship.userBId : friendship.userAId;

            return users.find((user) => user.id === friendId);
          })
          .filter((user): user is UserPublicRecord => Boolean(user));
      },
      async listInvitations(userId: string) {
        return invitations.filter(
          (invitation) => invitation.senderId === userId || invitation.receiverId === userId,
        );
      },
      async findFriendshipByPair(userAId: string, userBId: string) {
        return (
          friendships.find(
            (friendship) => friendship.userAId === userAId && friendship.userBId === userBId,
          ) ?? null
        );
      },
      async findInvitationByPair(pairUserAId: string, pairUserBId: string) {
        return (
          invitations.find(
            (invitation) =>
              invitation.pairUserAId === pairUserAId && invitation.pairUserBId === pairUserBId,
          ) ?? null
        );
      },
      async createInvitation(input: {
        senderId: string;
        receiverId: string;
        pairUserAId: string;
        pairUserBId: string;
      }) {
        const invitation = {
          id: `invitation-${invitations.length + 1}`,
          status: 'PENDING' as const,
          createdAt: now,
          updatedAt: now,
          ...input,
        };

        invitations.push(invitation);

        return invitation;
      },
      async resetInvitation(
        invitationId: string,
        input: { senderId: string; receiverId: string; status: 'PENDING' },
      ) {
        const invitation = invitations.find((item) => item.id === invitationId);

        assert.ok(invitation);
        invitation.senderId = input.senderId;
        invitation.receiverId = input.receiverId;
        invitation.status = input.status;
        invitation.updatedAt = now;

        return invitation;
      },
      async findReceivedInvitation(invitationId: string, receiverId: string) {
        return (
          invitations.find(
            (invitation) => invitation.id === invitationId && invitation.receiverId === receiverId,
          ) ?? null
        );
      },
      async acceptPendingInvitation(invitationId: string, receiverId: string) {
        const invitation = invitations.find(
          (item) =>
            item.id === invitationId && item.receiverId === receiverId && item.status === 'PENDING',
        );

        if (!invitation) {
          return null;
        }

        const existing = friendships.find(
          (friendship) =>
            friendship.userAId === invitation.pairUserAId &&
            friendship.userBId === invitation.pairUserBId,
        );
        const friendship =
          existing ??
          {
            id: `friendship-${friendships.length + 1}`,
            userAId: invitation.pairUserAId,
            userBId: invitation.pairUserBId,
            createdAt: now,
          };

        if (!existing) {
          friendships.push(friendship);
        }

        invitation.status = 'ACCEPTED';
        invitation.updatedAt = now;

        return { invitation, friendship };
      },
      async rejectPendingInvitation(invitationId: string, receiverId: string) {
        const invitation = invitations.find(
          (item) =>
            item.id === invitationId && item.receiverId === receiverId && item.status === 'PENDING',
        );

        if (!invitation) {
          return null;
        }

        invitation.status = 'REJECTED';
        invitation.updatedAt = now;

        return invitation;
      },
    },
  };
};

test('sendInvitation creates a pending invitation using the canonical pair', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);

  const invitation = await friendsService.sendInvitation('user-2', { receiverId: 'user-1' });

  assert.equal(invitation.senderId, 'user-2');
  assert.equal(invitation.receiverId, 'user-1');
  assert.equal(invitation.pairUserAId, 'user-1');
  assert.equal(invitation.pairUserBId, 'user-2');
  assert.equal(invitation.status, 'PENDING');
});

test('sendInvitation creates a pending invitation by personal ID', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);

  const invitation = await friendsService.sendInvitation('user-1', { receiverId: 'u222222' });

  assert.equal(invitation.senderId, 'user-1');
  assert.equal(invitation.receiverId, 'user-2');
  assert.equal(invitation.pairUserAId, 'user-1');
  assert.equal(invitation.pairUserBId, 'user-2');
  assert.equal(invitation.status, 'PENDING');
});

test('sendInvitation rejects self invitations', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);

  await assert.rejects(
    () => friendsService.sendInvitation('user-1', { receiverId: 'user-1' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.code === 'CANNOT_INVITE_SELF',
  );
});

test('sendInvitation rejects duplicate pending invitations', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);

  await friendsService.sendInvitation('user-1', { receiverId: 'user-2' });

  await assert.rejects(
    () => friendsService.sendInvitation('user-2', { receiverId: 'user-1' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 409 &&
      error.code === 'FRIEND_INVITATION_ALREADY_EXISTS',
  );
});

test('sendInvitation reuses a rejected invitation and updates sender and receiver', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);
  const invitation = await friendsService.sendInvitation('user-1', { receiverId: 'user-2' });

  await friendsService.rejectInvitation('user-2', invitation.id);
  const retriedInvitation = await friendsService.sendInvitation('user-2', { receiverId: 'user-1' });

  assert.equal(retriedInvitation.id, invitation.id);
  assert.equal(retriedInvitation.senderId, 'user-2');
  assert.equal(retriedInvitation.receiverId, 'user-1');
  assert.equal(retriedInvitation.status, 'PENDING');
});

test('acceptInvitation creates a friendship using the canonical pair', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);
  const invitation = await friendsService.sendInvitation('user-2', { receiverId: 'user-1' });

  const result = await friendsService.acceptInvitation('user-1', invitation.id);

  assert.equal(result.invitation.status, 'ACCEPTED');
  assert.equal(result.friendship.userAId, 'user-1');
  assert.equal(result.friendship.userBId, 'user-2');
});

test('rejectInvitation marks a pending invitation rejected', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);
  const invitation = await friendsService.sendInvitation('user-1', { receiverId: 'user-2' });

  const rejectedInvitation = await friendsService.rejectInvitation('user-2', invitation.id);

  assert.equal(rejectedInvitation.status, 'REJECTED');
});

test('acceptInvitation returns not found when current user is not the receiver', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);
  const invitation = await friendsService.sendInvitation('user-1', { receiverId: 'user-2' });

  await assert.rejects(
    () => friendsService.acceptInvitation('user-3', invitation.id),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 404 &&
      error.code === 'FRIEND_INVITATION_NOT_FOUND',
  );
});

test('acceptInvitation rejects non-pending invitations', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);
  const invitation = await friendsService.sendInvitation('user-1', { receiverId: 'user-2' });

  await friendsService.rejectInvitation('user-2', invitation.id);

  await assert.rejects(
    () => friendsService.acceptInvitation('user-2', invitation.id),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 409 &&
      error.code === 'FRIEND_INVITATION_NOT_PENDING',
  );
});

test('rejectInvitation rejects non-pending invitations', async () => {
  const fakeFriends = createFakeFriendsRepository();
  const friendsService = createFriendsService(fakeFriends.repository);
  const invitation = await friendsService.sendInvitation('user-1', { receiverId: 'user-2' });

  await friendsService.acceptInvitation('user-2', invitation.id);

  await assert.rejects(
    () => friendsService.rejectInvitation('user-2', invitation.id),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 409 &&
      error.code === 'FRIEND_INVITATION_NOT_PENDING',
  );
});
