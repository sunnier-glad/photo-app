import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';

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

  const { buildApp } = await import('../src/app.js');

  return buildApp;
};

test('GET /api/health returns ok payload', async () => {
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

    const response = await fetch(`http://127.0.0.1:${address.port}/api/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      success: true,
      data: { status: 'ok' },
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
