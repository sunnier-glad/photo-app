import { HttpError } from '../../common/http-error.js';

export type FriendInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export type UserPublicRecord = {
  id: string;
  personalId: string | null;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FriendInvitationRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  pairUserAId: string;
  pairUserBId: string;
  status: FriendInvitationStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type FriendshipRecord = {
  id: string;
  userAId: string;
  userBId: string;
  createdAt: Date;
};

export type FriendsRepository = {
  findUserById(userId: string): Promise<UserPublicRecord | null>;
  findUserByPersonalId(personalId: string): Promise<UserPublicRecord | null>;
  listFriends(userId: string): Promise<UserPublicRecord[]>;
  listInvitations(userId: string): Promise<FriendInvitationRecord[]>;
  findFriendshipByPair(userAId: string, userBId: string): Promise<FriendshipRecord | null>;
  findInvitationByPair(
    pairUserAId: string,
    pairUserBId: string,
  ): Promise<FriendInvitationRecord | null>;
  createInvitation(input: {
    senderId: string;
    receiverId: string;
    pairUserAId: string;
    pairUserBId: string;
  }): Promise<FriendInvitationRecord>;
  resetInvitation(
    invitationId: string,
    input: {
      senderId: string;
      receiverId: string;
      status: 'PENDING';
    },
  ): Promise<FriendInvitationRecord>;
  findReceivedInvitation(
    invitationId: string,
    receiverId: string,
  ): Promise<FriendInvitationRecord | null>;
  acceptPendingInvitation(
    invitationId: string,
    receiverId: string,
  ): Promise<{ invitation: FriendInvitationRecord; friendship: FriendshipRecord } | null>;
  rejectPendingInvitation(
    invitationId: string,
    receiverId: string,
  ): Promise<FriendInvitationRecord | null>;
};

export type SendFriendInvitationInput = {
  receiverId: string;
};

const getCanonicalUserPair = (userId: string, otherUserId: string) => {
  const [userAId, userBId] = [userId, otherUserId].sort();

  return { userAId, userBId };
};

export const createFriendsService = (friendsRepository: FriendsRepository) => ({
  listFriends(userId: string) {
    return friendsRepository.listFriends(userId);
  },

  listInvitations(userId: string) {
    return friendsRepository.listInvitations(userId);
  },

  async sendInvitation(userId: string, input: SendFriendInvitationInput) {
    const receiver =
      (await friendsRepository.findUserById(input.receiverId)) ??
      (await friendsRepository.findUserByPersonalId(input.receiverId.trim().toLowerCase()));

    if (!receiver) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    if (userId === receiver.id) {
      throw new HttpError(400, 'CANNOT_INVITE_SELF', 'Cannot invite yourself');
    }

    const { userAId, userBId } = getCanonicalUserPair(userId, receiver.id);
    const existingFriendship = await friendsRepository.findFriendshipByPair(userAId, userBId);

    if (existingFriendship) {
      throw new HttpError(409, 'FRIENDSHIP_ALREADY_EXISTS', 'Friendship already exists');
    }

    const existingInvitation = await friendsRepository.findInvitationByPair(userAId, userBId);

    if (existingInvitation?.status === 'PENDING') {
      throw new HttpError(
        409,
        'FRIEND_INVITATION_ALREADY_EXISTS',
        'Friend invitation already exists',
      );
    }

    if (existingInvitation?.status === 'ACCEPTED') {
      throw new HttpError(
        409,
        'FRIEND_INVITATION_ALREADY_ACCEPTED',
        'Friend invitation has already been accepted',
      );
    }

    if (existingInvitation) {
      return friendsRepository.resetInvitation(existingInvitation.id, {
        senderId: userId,
        receiverId: receiver.id,
        status: 'PENDING',
      });
    }

    return friendsRepository.createInvitation({
      senderId: userId,
      receiverId: receiver.id,
      pairUserAId: userAId,
      pairUserBId: userBId,
    });
  },

  async acceptInvitation(userId: string, invitationId: string) {
    const result = await friendsRepository.acceptPendingInvitation(invitationId, userId);

    if (result) {
      return result;
    }

    const invitation = await friendsRepository.findReceivedInvitation(invitationId, userId);

    if (!invitation) {
      throw new HttpError(404, 'FRIEND_INVITATION_NOT_FOUND', 'Friend invitation not found');
    }

    throw new HttpError(
      409,
      'FRIEND_INVITATION_NOT_PENDING',
      'Friend invitation is not pending',
    );
  },

  async rejectInvitation(userId: string, invitationId: string) {
    const rejectedInvitation = await friendsRepository.rejectPendingInvitation(invitationId, userId);

    if (rejectedInvitation) {
      return rejectedInvitation;
    }

    const invitation = await friendsRepository.findReceivedInvitation(invitationId, userId);

    if (!invitation) {
      throw new HttpError(404, 'FRIEND_INVITATION_NOT_FOUND', 'Friend invitation not found');
    }

    throw new HttpError(
      409,
      'FRIEND_INVITATION_NOT_PENDING',
      'Friend invitation is not pending',
    );
  },
});

export type FriendsService = ReturnType<typeof createFriendsService>;
