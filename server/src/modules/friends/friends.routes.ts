import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { ok } from '../../common/api-response.js';
import type { createRequireAuthMiddleware } from '../../middlewares/auth.js';
import type { FriendsService } from './friends.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

const invitationParamsSchema = z.object({
  invitationId: z.string().trim().min(1),
});

const createInvitationBodySchema = z.object({
  receiverId: z.string().trim().min(1),
});

export const createFriendsRouter = ({
  requireAuth,
  friendsService,
}: {
  requireAuth: ReturnType<typeof createRequireAuthMiddleware>;
  friendsService: FriendsService;
}) => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    withAsync(async (request, response) => {
      const friends = await friendsService.listFriends(request.currentUser!.id);

      response.status(200).json(ok(friends));
    }),
  );

  router.get(
    '/invitations',
    requireAuth,
    withAsync(async (request, response) => {
      const invitations = await friendsService.listInvitations(request.currentUser!.id);

      response.status(200).json(ok(invitations));
    }),
  );

  router.post(
    '/invitations',
    requireAuth,
    withAsync(async (request, response) => {
      const input = createInvitationBodySchema.parse(request.body);
      const invitation = await friendsService.sendInvitation(request.currentUser!.id, input);

      response.status(201).json(ok(invitation));
    }),
  );

  router.post(
    '/invitations/:invitationId/accept',
    requireAuth,
    withAsync(async (request, response) => {
      const { invitationId } = invitationParamsSchema.parse(request.params);
      const result = await friendsService.acceptInvitation(request.currentUser!.id, invitationId);

      response.status(200).json(ok(result));
    }),
  );

  router.post(
    '/invitations/:invitationId/reject',
    requireAuth,
    withAsync(async (request, response) => {
      const { invitationId } = invitationParamsSchema.parse(request.params);
      const invitation = await friendsService.rejectInvitation(
        request.currentUser!.id,
        invitationId,
      );

      response.status(200).json(ok(invitation));
    }),
  );

  return router;
};
