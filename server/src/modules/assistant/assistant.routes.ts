import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import type { AssistantService } from './assistant.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const chatBodySchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export const createAssistantRouter = ({
  requireAuth,
  assistantService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  assistantService: AssistantService;
}) => {
  const router = Router();

  router.post(
    '/chat',
    requireAuth,
    withAsync(async (request, response) => {
      const input = chatBodySchema.parse(request.body);
      const result = await assistantService.chat({
        userName: request.currentUser!.displayName || request.currentUser!.username,
        message: input.message,
      });

      response.status(200).json(ok(result));
    }),
  );

  return router;
};
