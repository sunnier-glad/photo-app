import assert from 'node:assert/strict';
import test from 'node:test';

const loadEnvModule = async (tag: string) => import(`../../src/config/env.js?${tag}`);

const withProcessEnv = async (
  overrides: Partial<NodeJS.ProcessEnv>,
  run: () => Promise<void> | void,
) => {
  const previousValues = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previousValues.set(key, process.env[key]);

    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }

  try {
    await run();
  } finally {
    for (const [key, value] of previousValues) {
      if (value === undefined) {
        delete process.env[key];
        continue;
      }

      process.env[key] = value;
    }
  }
};

const validEnv = {
  SERVER_PORT: '4000',
  DATABASE_URL: 'mysql://root:password@127.0.0.1:3306/memories',
  JWT_SECRET: 'super-secret-value',
  OSS_REGION: 'oss-cn-hangzhou',
  OSS_BUCKET: 'memories-dev',
  OSS_ACCESS_KEY_ID: 'key-id',
  OSS_ACCESS_KEY_SECRET: 'key-secret',
  OSS_CDN_URL: 'https://cdn.example.com',
  SMTP_HOST: 'smtp.qq.com',
  SMTP_PORT: '465',
  SMTP_SECURE: 'true',
  SMTP_USER: 'sender@example.com',
  SMTP_PASS: 'smtp-secret',
  SMTP_FROM: 'sender@example.com',
  MIMO_API_KEY: 'mimo-secret',
  MIMO_BASE_URL: 'https://token-plan-cn.xiaomimimo.com/anthropic',
  MIMO_MODEL: 'mimo-v2.5-pro',
} satisfies Partial<NodeJS.ProcessEnv>;

test('parseEnv rejects missing required values', async () => {
  await withProcessEnv(validEnv, async () => {
    const { parseEnv } = await loadEnvModule('missing-required-values');

    assert.throws(
      () =>
        parseEnv({
          SERVER_PORT: '4000',
        } as NodeJS.ProcessEnv),
      /DATABASE_URL/,
    );
  });
});

test('parseEnv returns normalized backend config', async () => {
  await withProcessEnv(validEnv, async () => {
    const { parseEnv } = await loadEnvModule('normalized-config');

    const config = parseEnv(validEnv as NodeJS.ProcessEnv);

    assert.equal(config.serverPort, 4000);
    assert.equal(config.databaseUrl, 'mysql://root:password@127.0.0.1:3306/memories');
    assert.equal(config.oss.bucket, 'memories-dev');
    assert.equal(config.oss.cdnUrl, 'https://cdn.example.com');
    assert.equal(config.smtp.host, 'smtp.qq.com');
    assert.equal(config.smtp.port, 465);
    assert.equal(config.smtp.secure, true);
    assert.equal(config.smtp.user, 'sender@example.com');
    assert.equal(config.mimo.apiKey, 'mimo-secret');
    assert.equal(config.mimo.baseUrl, 'https://token-plan-cn.xiaomimimo.com/anthropic');
    assert.equal(config.mimo.model, 'mimo-v2.5-pro');
  });
});

test('env is validated eagerly at module load', async () => {
  await withProcessEnv(validEnv, async () => {
    const { env } = await loadEnvModule('eager-env');

    process.env.DATABASE_URL = 'mysql://root:password@127.0.0.1:3306/changed';

    assert.equal(env.databaseUrl, validEnv.DATABASE_URL);
  });
});

test('env module import fails fast when required values are missing', async () => {
  await withProcessEnv(
    {
      SERVER_PORT: '4000',
      DATABASE_URL: undefined,
      JWT_SECRET: undefined,
      OSS_REGION: undefined,
      OSS_BUCKET: undefined,
      OSS_ACCESS_KEY_ID: undefined,
      OSS_ACCESS_KEY_SECRET: undefined,
      OSS_CDN_URL: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      SMTP_FROM: undefined,
    },
    async () => {
      await assert.rejects(() => loadEnvModule('missing-module-env'), /DATABASE_URL/);
    },
  );
});
