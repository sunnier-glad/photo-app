import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import type { MessagesService } from './messages.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const messageParamsSchema = z.object({
  friendId: z.string().trim().min(1),
});

const sendMessageBodySchema = z.object({
  content: z.string().trim().min(1).max(1000),
});

export const createMessagesRouter = ({
  requireAuth,
  messagesService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  messagesService: MessagesService;
}) => {
  const router = Router();

  router.get(
    '/:friendId',
    requireAuth,
    withAsync(async (request, response) => {
      const { friendId } = messageParamsSchema.parse(request.params);
      const messages = await messagesService.listConversation(request.currentUser!.id, friendId);

      response.status(200).json(ok(messages));
    }),
  );

  router.post(
    '/:friendId',
    requireAuth,
    withAsync(async (request, response) => {
      const { friendId } = messageParamsSchema.parse(request.params);
      const input = sendMessageBodySchema.parse(request.body);
      const message = await messagesService.sendMessage(
        request.currentUser!.id,
        friendId,
        input,
      );

      response.status(201).json(ok(message));
    }),
  );

  return router;
};
