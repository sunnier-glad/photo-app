import { HttpError } from '../../common/http-error.js';

export type MessageRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  readAt: Date | null;
  createdAt: Date;
};

export type MessageUserRecord = {
  id: string;
};

export type MessagesRepository = {
  findUserById(userId: string): Promise<MessageUserRecord | null>;
  areFriends(userId: string, otherUserId: string): Promise<boolean>;
  listConversation(userId: string, friendId: string): Promise<MessageRecord[]>;
  createMessage(input: {
    senderId: string;
    receiverId: string;
    content: string;
  }): Promise<MessageRecord>;
};

export type SendMessageInput = {
  content: string;
};

const ensureCanChat = async (
  messagesRepository: MessagesRepository,
  userId: string,
  friendId: string,
) => {
  if (userId === friendId) {
    throw new HttpError(400, 'CANNOT_MESSAGE_SELF', 'Cannot message yourself');
  }

  const friend = await messagesRepository.findUserById(friendId);

  if (!friend) {
    throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const areFriends = await messagesRepository.areFriends(userId, friendId);

  if (!areFriends) {
    throw new HttpError(403, 'FRIENDSHIP_REQUIRED', 'Friendship is required');
  }
};

export const createMessagesService = (messagesRepository: MessagesRepository) => ({
  async listConversation(userId: string, friendId: string) {
    await ensureCanChat(messagesRepository, userId, friendId);

    return messagesRepository.listConversation(userId, friendId);
  },

  async sendMessage(userId: string, friendId: string, input: SendMessageInput) {
    await ensureCanChat(messagesRepository, userId, friendId);

    const content = input.content.trim();

    if (!content) {
      throw new HttpError(400, 'INVALID_MESSAGE_CONTENT', 'Message content is required');
    }

    return messagesRepository.createMessage({
      senderId: userId,
      receiverId: friendId,
      content,
    });
  },
});

export type MessagesService = ReturnType<typeof createMessagesService>;
