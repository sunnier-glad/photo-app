import assert from 'node:assert/strict';
import test from 'node:test';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { errorHandler } from '../../src/middlewares/error-handler.js';

test('errorHandler maps ZodError to a 400 validation error response', () => {
  let statusCode: number | undefined;
  let body: unknown;
  const request = {} as Request;
  const next: NextFunction = () => undefined;
  const response = {
    status(code: number) {
      statusCode = code;

      return this;
    },
    json(payload: unknown) {
      body = payload;

      return this;
    },
  } as unknown as Response;
  const error = z.object({ title: z.string().trim().min(1) }).safeParse({ title: '   ' });

  assert.equal(error.success, false);
  errorHandler(error.error, request, response, next);

  assert.equal(statusCode, 400);
  assert.deepEqual(body, {
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Invalid request payload',
    },
  });
});
