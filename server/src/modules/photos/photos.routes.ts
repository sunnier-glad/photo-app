import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import {
  createPhotoUploadTokenBodySchema,
  registerPhotoBodySchema,
} from './photos.schemas.js';
import type { PhotosService } from './photos.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const photoIdParamsSchema = z.object({
  photoId: z.string().trim().min(1),
});

const updateFavoriteBodySchema = z.object({
  isFavorite: z.boolean(),
});

export const createPhotosRouter = ({
  requireAuth,
  photosService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  photosService: PhotosService;
}) => {
  const router = Router();

  router.post(
    '/upload-token',
    requireAuth,
    withAsync(async (request, response) => {
      const input = createPhotoUploadTokenBodySchema.parse(request.body);
      const token = await photosService.createUploadToken(request.currentUser!.id, input);

      response.status(201).json(ok(token));
    }),
  );

  router.post(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const input = registerPhotoBodySchema.parse(request.body);
      const photo = await photosService.registerPhoto(request.currentUser!.id, input);

      response.status(201).json(ok(photo));
    }),
  );

  router.post(
    '/:photoId/ai-title',
    requireAuth,
    withAsync(async (request, response) => {
      const { photoId } = photoIdParamsSchema.parse(request.params);
      const photo = await photosService.generateAiTitle(request.currentUser!.id, photoId);

      response.status(200).json(ok(photo));
    }),
  );

  router.patch(
    '/:photoId/favorite',
    requireAuth,
    withAsync(async (request, response) => {
      const { photoId } = photoIdParamsSchema.parse(request.params);
      const input = updateFavoriteBodySchema.parse(request.body);
      const photo = await photosService.updateFavorite(
        request.currentUser!.id,
        photoId,
        input.isFavorite,
      );

      response.status(200).json(ok(photo));
    }),
  );

  router.delete(
    '/:photoId',
    requireAuth,
    withAsync(async (request, response) => {
      const { photoId } = photoIdParamsSchema.parse(request.params);
      const trashItem = await photosService.movePhotoToTrash(request.currentUser!.id, photoId);

      response.status(200).json(ok(trashItem));
    }),
  );

  return router;
};
