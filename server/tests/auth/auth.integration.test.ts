import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { ok } from '../../src/common/api-response.js';
import { errorHandler } from '../../src/middlewares/error-handler.js';
import { createRequireAuthMiddleware } from '../../src/middlewares/auth.js';
import type { AuthService } from '../../src/modules/auth/auth.service.js';

const ensureBackendEnv = () => {
  process.env.DATABASE_URL ??= 'mysql://root:password@127.0.0.1:3306/memories_test';
  process.env.JWT_SECRET ??= 'test-jwt-secret-123';
  process.env.OSS_REGION ??= 'oss-cn-hangzhou';
  process.env.OSS_BUCKET ??= 'memories-test';
  process.env.OSS_ACCESS_KEY_ID ??= 'test-key-id';
  process.env.OSS_ACCESS_KEY_SECRET ??= 'test-key-secret';
};

const loadBuildApp = async () => {
  ensureBackendEnv();

  const { buildApp } = await import('../../src/app.js');

  return buildApp;
};

test('GET /api/users/me returns 401 when auth routes are mounted without credentials', async () => {
  const buildApp = await loadBuildApp();
  const app = buildApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test server port');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/users/me`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.deepEqual(body, {
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Authentication is required',
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});

test('requireAuth accepts lowercase bearer tokens with surrounding whitespace', async () => {
  const authService: AuthService = {
    async sendEmailCode() {
      throw new Error('not implemented');
    },
    async register() {
      throw new Error('not implemented');
    },
    async login() {
      throw new Error('not implemented');
    },
    async authenticate(token) {
      assert.equal(token, 'token-value');

      return {
        id: 'user-1',
        personalId: 'u111111',
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: null,
        bio: null,
        createdAt: '2026-06-02T00:00:00.000Z',
        updatedAt: '2026-06-02T00:00:00.000Z',
      };
    },
  };
  const app = express();

  app.get(
    '/protected',
    createRequireAuthMiddleware(authService),
    (request, response) => {
      response.status(200).json(ok(request.currentUser));
    },
  );
  app.use(errorHandler);

  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  try {
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve test server port');
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/protected`, {
      headers: {
        authorization: '  bearer   token-value  ',
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      data: {
        id: 'user-1',
        personalId: 'u111111',
        username: 'alice',
        email: 'alice@example.com',
        displayName: 'Alice',
        avatarUrl: null,
        bio: null,
        createdAt: '2026-06-02T00:00:00.000Z',
        updatedAt: '2026-06-02T00:00:00.000Z',
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
