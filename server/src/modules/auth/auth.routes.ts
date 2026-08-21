import { Router, type RequestHandler } from 'express';
import { ok } from '../../common/api-response.js';
import {
  loginBodySchema,
  registerBodySchema,
  sendEmailCodeBodySchema,
} from './auth.schemas.js';
import type { AuthService } from './auth.service.js';

const withAsync =
  (handler: RequestHandler): RequestHandler =>
  (request, response, next) =>
    Promise.resolve(handler(request, response, next)).catch(next);

export const createAuthRouter = (authService: AuthService) => {
  const router = Router();

  router.post(
    '/email-code',
    withAsync(async (request, response) => {
      const input = sendEmailCodeBodySchema.parse(request.body);
      const result = await authService.sendEmailCode(input);

      response.status(201).json(ok(result));
    }),
  );

  router.post(
    '/register',
    withAsync(async (request, response) => {
      const input = registerBodySchema.parse(request.body);
      const result = await authService.register(input);

      response.status(201).json(ok(result));
    }),
  );

  router.post(
    '/login',
    withAsync(async (request, response) => {
      const input = loginBodySchema.parse(request.body);
      const result = await authService.login(input);

      response.status(200).json(ok(result));
    }),
  );

  return router;
};
