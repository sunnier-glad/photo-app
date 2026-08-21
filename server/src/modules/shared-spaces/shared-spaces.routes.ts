import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import {
  createSharedSpaceUploadTokenBodySchema,
  registerSharedSpacePhotoBodySchema,
} from '../photos/photos.schemas.js';
import type { SharedSpacesService } from './shared-spaces.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const spaceParamsSchema = z.object({
  spaceId: z.string().trim().min(1),
});

const sharedPhotoParamsSchema = z.object({
  spaceId: z.string().trim().min(1),
  sharedPhotoId: z.string().trim().min(1),
});

const createSpaceBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});

const updateSpaceBodySchema = createSpaceBodySchema;

const inviteMemberBodySchema = z.object({
  userId: z.string().trim().min(1),
});

const addPhotoBodySchema = z.object({
  photoId: z.string().trim().min(1),
});

export const createSharedSpacesRouter = ({
  requireAuth,
  sharedSpacesService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  sharedSpacesService: SharedSpacesService;
}) => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const spaces = await sharedSpacesService.listSpaces(request.currentUser!.id);

      response.status(200).json(ok(spaces));
    }),
  );

  router.get(
    '/with-details',
    requireAuth,
    withAsync(async (request, response) => {
      const spaces = await sharedSpacesService.listSpacesWithDetails(request.currentUser!.id);

      response.status(200).json(ok(spaces));
    }),
  );

  router.post(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const input = createSpaceBodySchema.parse(request.body);
      const space = await sharedSpacesService.createSpace(request.currentUser!.id, input);

      response.status(201).json(ok(space));
    }),
  );

  router.patch(
    '/:spaceId',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const input = updateSpaceBodySchema.parse(request.body);
      const space = await sharedSpacesService.updateSpace(
        request.currentUser!.id,
        spaceId,
        input,
      );

      response.status(200).json(ok(space));
    }),
  );

  router.post(
    '/:spaceId/invitations',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const input = inviteMemberBodySchema.parse(request.body);
      const member = await sharedSpacesService.inviteMember(
        request.currentUser!.id,
        spaceId,
        input,
      );

      response.status(201).json(ok(member));
    }),
  );

  router.get(
    '/:spaceId/members',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const members = await sharedSpacesService.listMembers(request.currentUser!.id, spaceId);

      response.status(200).json(ok(members));
    }),
  );

  router.get(
    '/:spaceId/photos',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const photos = await sharedSpacesService.listPhotos(request.currentUser!.id, spaceId);

      response.status(200).json(ok(photos));
    }),
  );

  router.post(
    '/:spaceId/upload-token',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const input = createSharedSpaceUploadTokenBodySchema.parse(request.body);
      const token = await sharedSpacesService.createUploadToken(
        request.currentUser!.id,
        spaceId,
        input,
      );

      response.status(201).json(ok(token));
    }),
  );

  router.post(
    '/:spaceId/photos/register',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const input = registerSharedSpacePhotoBodySchema.parse(request.body);
      const photo = await sharedSpacesService.registerUploadedPhoto(
        request.currentUser!.id,
        spaceId,
        input,
      );

      response.status(201).json(ok(photo));
    }),
  );

  router.delete(
    '/:spaceId/photos/:sharedPhotoId',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId, sharedPhotoId } = sharedPhotoParamsSchema.parse(request.params);
      const trashItem = await sharedSpacesService.deleteOwnSharedPhoto(
        request.currentUser!.id,
        spaceId,
        sharedPhotoId,
      );

      response.status(200).json(ok(trashItem));
    }),
  );

  router.post(
    '/:spaceId/photos',
    requireAuth,
    withAsync(async (request, response) => {
      const { spaceId } = spaceParamsSchema.parse(request.params);
      const input = addPhotoBodySchema.parse(request.body);
      const photo = await sharedSpacesService.addPhoto(request.currentUser!.id, spaceId, input);

      response.status(201).json(ok(photo));
    }),
  );

  return router;
};
