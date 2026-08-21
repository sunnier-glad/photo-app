import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import { createAlbumBodySchema } from './albums.schemas.js';
import type { AlbumsService } from './albums.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const albumParamsSchema = z.object({
  albumId: z.string().trim().min(1),
});

export const createAlbumsRouter = ({
  requireAuth,
  albumsService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  albumsService: AlbumsService;
}) => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const albums = await albumsService.listAlbums(request.currentUser!.id);

      response.status(200).json(ok(albums));
    }),
  );

  router.get(
    '/with-photos',
    requireAuth,
    withAsync(async (request, response) => {
      const albums = await albumsService.listAlbumsWithPhotos(request.currentUser!.id);

      response.status(200).json(ok(albums));
    }),
  );

  router.get(
    '/:albumId/photos',
    requireAuth,
    withAsync(async (request, response) => {
      const { albumId } = albumParamsSchema.parse(request.params);
      const photos = await albumsService.listAlbumPhotos(request.currentUser!.id, albumId);

      response.status(200).json(ok(photos));
    }),
  );

  router.post(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const input = createAlbumBodySchema.parse(request.body);
      const album = await albumsService.createAlbum(request.currentUser!.id, input);

      response.status(201).json(ok(album));
    }),
  );

  return router;
};
