import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../common/http-error.js';
import type { AuthService, PublicUser } from '../modules/auth/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      currentUser?: PublicUser;
    }
  }
}

const getBearerToken = (authorizationHeader: string | undefined) => {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.trim().split(/\s+/);

  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;

  if (scheme.toLowerCase() !== 'bearer' || !token) {
    return null;
  }

  return token;
};

export const createRequireAuthMiddleware =
  (authService: AuthService) => async (request: Request, _response: Response, next: NextFunction) => {
    const token = getBearerToken(request.header('authorization'));

    if (!token) {
      next(new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required'));
      return;
    }

    try {
      request.currentUser = await authService.authenticate(token);
      next();
    } catch (error) {
      next(error);
    }
  };
