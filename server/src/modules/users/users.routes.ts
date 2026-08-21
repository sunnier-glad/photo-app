import { Router, type RequestHandler } from 'express';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import {
  createAvatarUploadTokenBodySchema,
  updateProfileBodySchema,
} from './users.schemas.js';
import type { UsersService } from './users.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

export const createUsersRouter = ({
  requireAuth,
  usersService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  usersService: UsersService;
}) => {
  const router = Router();

  router.get(
    '/me',
    requireAuth,
    withAsync(async (request, response) => {
      const user = await usersService.getCurrentUser(request.currentUser!.id);

      response.status(200).json(ok(user));
    }),
  );

  router.get(
    '/me/storage',
    requireAuth,
    withAsync(async (request, response) => {
      const summary = await usersService.getStorageSummary(request.currentUser!.id);

      response.status(200).json(ok(summary));
    }),
  );

  router.patch(
    '/me',
    requireAuth,
    withAsync(async (request, response) => {
      const input = updateProfileBodySchema.parse(request.body);
      const user = await usersService.updateCurrentUser(request.currentUser!.id, input);

      response.status(200).json(ok(user));
    }),
  );

  router.post(
    '/me/avatar-upload-token',
    requireAuth,
    withAsync(async (request, response) => {
      const input = createAvatarUploadTokenBodySchema.parse(request.body);
      const token = await usersService.createAvatarUploadToken(request.currentUser!.id, input);

      response.status(201).json(ok(token));
    }),
  );

  return router;
};
