import assert from 'node:assert/strict';
import test from 'node:test';
import { HttpError } from '../../src/common/http-error.js';
import {
  createMessagesService,
  type MessageRecord,
} from '../../src/modules/messages/messages.service.js';

const now = new Date('2026-06-04T00:00:00.000Z');

const createFakeMessagesRepository = () => {
  const users = new Set(['user-1', 'user-2', 'stranger-1']);
  const friendships = new Set(['user-1|user-2']);
  const messages: MessageRecord[] = [
    {
      id: 'message-1',
      senderId: 'user-2',
      receiverId: 'user-1',
      content: '你好',
      readAt: null,
      createdAt: now,
    },
  ];

  return {
    messages,
    repository: {
      async findUserById(userId: string) {
        return users.has(userId) ? { id: userId } : null;
      },
      async areFriends(userId: string, otherUserId: string) {
        const [userAId, userBId] = [userId, otherUserId].sort();

        return friendships.has(`${userAId}|${userBId}`);
      },
      async listConversation(userId: string, friendId: string) {
        return messages.filter(
          (message) =>
            (message.senderId === userId && message.receiverId === friendId) ||
            (message.senderId === friendId && message.receiverId === userId),
        );
      },
      async createMessage(input: {
        senderId: string;
        receiverId: string;
        content: string;
      }) {
        const message = {
          id: `message-${messages.length + 1}`,
          readAt: null,
          createdAt: now,
          ...input,
        };

        messages.push(message);

        return message;
      },
    },
  };
};

test('sendMessage trims and stores messages between friends', async () => {
  const fakeMessages = createFakeMessagesRepository();
  const messagesService = createMessagesService(fakeMessages.repository);

  const message = await messagesService.sendMessage('user-1', 'user-2', {
    content: '  晚上好  ',
  });

  assert.equal(message.senderId, 'user-1');
  assert.equal(message.receiverId, 'user-2');
  assert.equal(message.content, '晚上好');
  assert.equal(fakeMessages.messages.length, 2);
});

test('listConversation requires friendship', async () => {
  const fakeMessages = createFakeMessagesRepository();
  const messagesService = createMessagesService(fakeMessages.repository);

  await assert.rejects(
    () => messagesService.listConversation('user-1', 'stranger-1'),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 403 &&
      error.code === 'FRIENDSHIP_REQUIRED',
  );
});

test('sendMessage rejects blank content', async () => {
  const fakeMessages = createFakeMessagesRepository();
  const messagesService = createMessagesService(fakeMessages.repository);

  await assert.rejects(
    () => messagesService.sendMessage('user-1', 'user-2', { content: '   ' }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.code === 'INVALID_MESSAGE_CONTENT',
  );
});
