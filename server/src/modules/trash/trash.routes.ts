import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import type { TrashService } from './trash.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const photoIdParamsSchema = z.object({
  photoId: z.string().trim().min(1),
});

export const createTrashRouter = ({
  requireAuth,
  trashService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  trashService: TrashService;
}) => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const trashItems = await trashService.listTrash(request.currentUser!.id);

      response.status(200).json(ok(trashItems));
    }),
  );

  router.post(
    '/:photoId/restore',
    requireAuth,
    withAsync(async (request, response) => {
      const { photoId } = photoIdParamsSchema.parse(request.params);
      const photo = await trashService.restorePhoto(request.currentUser!.id, photoId);

      response.status(200).json(ok(photo));
    }),
  );

  router.delete(
    '/:photoId',
    requireAuth,
    withAsync(async (request, response) => {
      const { photoId } = photoIdParamsSchema.parse(request.params);
      const result = await trashService.permanentlyDeletePhoto(request.currentUser!.id, photoId);

      response.status(200).json(ok(result));
    }),
  );

  return router;
};
