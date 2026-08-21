import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { HttpError } from '../../src/common/http-error.js';
import {
  createAuthService,
  type AuthEmailVerificationRepository,
  type AuthUserRecord,
  type AuthUsersRepository,
} from '../../src/modules/auth/auth.service.js';

const createFakeUsersRepository = () => {
  const users = new Map<string, AuthUserRecord>();

  const repository: AuthUsersRepository = {
    async findByEmail(email) {
      return Array.from(users.values()).find((user) => user.email === email) ?? null;
    },
    async findByUsername(username) {
      return Array.from(users.values()).find((user) => user.username === username) ?? null;
    },
    async findByPersonalId(personalId) {
      return Array.from(users.values()).find((user) => user.personalId === personalId) ?? null;
    },
    async findById(id) {
      return users.get(id) ?? null;
    },
    async create(input) {
      const user: AuthUserRecord = {
        id: `user-${users.size + 1}`,
        personalId: null,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T00:00:00.000Z'),
        avatarUrl: null,
        bio: null,
        ...input,
      };

      users.set(user.id, user);

      return user;
    },
  };

  return {
    repository,
    seed(user: AuthUserRecord) {
      users.set(user.id, user);
    },
  };
};

const createFakeEmailVerificationRepository = () => {
  type VerificationRecord = {
    id: string;
    email: string;
    codeHash: string;
    expiresAt: Date;
    usedAt: Date | null;
    createdAt: Date;
  };

  const records: VerificationRecord[] = [];

  const repository: AuthEmailVerificationRepository = {
    async create(input) {
      const record = {
        id: `code-${records.length + 1}`,
        createdAt: new Date('2026-06-03T00:00:00.000Z'),
        usedAt: null,
        ...input,
      };

      records.push(record);

      return record;
    },
    async countRecent(email, since) {
      return records.filter((record) => record.email === email && record.createdAt >= since).length;
    },
    async findLatestUsable(email, now) {
      return (
        records
          .filter((record) => record.email === email && !record.usedAt && record.expiresAt > now)
          .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0] ?? null
      );
    },
    async markUsed(id, usedAt) {
      const record = records.find((candidate) => candidate.id === id);

      if (record) {
        record.usedAt = usedAt;
      }
    },
  };

  return {
    repository,
    records,
  };
};

test('register creates a user with a hashed password and returns an auth payload', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeCodes = createFakeEmailVerificationRepository();
  const authService = createAuthService({
    jwtSecret: 'super-secret-value',
    usersRepository: fakeUsers.repository,
    emailVerificationRepository: fakeCodes.repository,
    emailSender: {
      async sendVerificationCode() {},
    },
    createVerificationCode: () => '123456',
  });

  await authService.sendEmailCode({
    email: 'alice@example.com',
  });

  const result = await authService.register({
    username: 'alice',
    email: 'alice@example.com',
    password: 'password123',
    displayName: 'Alice',
    verificationCode: '123456',
  });

  const savedUser = await fakeUsers.repository.findByEmail('alice@example.com');

  assert.ok(savedUser);
  assert.notEqual(savedUser.passwordHash, 'password123');
  assert.equal(await bcrypt.compare('password123', savedUser.passwordHash), true);
  assert.equal(typeof result.token, 'string');
  assert.ok(fakeCodes.records[0].usedAt);
  assert.deepEqual(result.user, {
    id: savedUser.id,
    personalId: savedUser.personalId,
    username: 'alice',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: null,
    bio: null,
    privateAlbumsOnly: false,
    activityStatusActive: true,
    locationTaggingActive: true,
    createdAt: savedUser.createdAt.toISOString(),
    updatedAt: savedUser.updatedAt.toISOString(),
  });
});

test('register rejects duplicate email addresses', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeCodes = createFakeEmailVerificationRepository();
  fakeUsers.seed({
    id: 'existing-user',
    personalId: 'u123456',
    username: 'alice',
    email: 'alice@example.com',
    passwordHash: await bcrypt.hash('password123', 10),
    displayName: 'Alice',
    avatarUrl: null,
    bio: null,
    createdAt: new Date('2026-06-02T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
  });

  const authService = createAuthService({
    jwtSecret: 'super-secret-value',
    usersRepository: fakeUsers.repository,
    emailVerificationRepository: fakeCodes.repository,
    emailSender: {
      async sendVerificationCode() {},
    },
    createVerificationCode: () => '123456',
  });

  await authService.sendEmailCode({
    email: 'alice@example.com',
  });

  await assert.rejects(
    () =>
      authService.register({
        username: 'alice-2',
        email: 'alice@example.com',
        password: 'password123',
        displayName: 'Alice 2',
        verificationCode: '123456',
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 409 &&
      error.code === 'EMAIL_ALREADY_IN_USE',
  );
});

test('sendEmailCode stores a hashed 6-digit code and sends it to the email address', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeCodes = createFakeEmailVerificationRepository();
  const sentCodes: Array<{ email: string; code: string }> = [];
  const authService = createAuthService({
    jwtSecret: 'super-secret-value',
    usersRepository: fakeUsers.repository,
    emailVerificationRepository: fakeCodes.repository,
    emailSender: {
      async sendVerificationCode(email, code) {
        sentCodes.push({ email, code });
      },
    },
    createVerificationCode: () => '654321',
  });

  const result = await authService.sendEmailCode({
    email: 'alice@example.com',
  });

  assert.deepEqual(result, {
    email: 'alice@example.com',
    expiresInSeconds: 600,
  });
  assert.deepEqual(sentCodes, [{ email: 'alice@example.com', code: '654321' }]);
  assert.notEqual(fakeCodes.records[0].codeHash, '654321');
  assert.equal(await bcrypt.compare('654321', fakeCodes.records[0].codeHash), true);
});

test('register rejects missing or incorrect email verification codes', async () => {
  const fakeUsers = createFakeUsersRepository();
  const fakeCodes = createFakeEmailVerificationRepository();
  const authService = createAuthService({
    jwtSecret: 'super-secret-value',
    usersRepository: fakeUsers.repository,
    emailVerificationRepository: fakeCodes.repository,
    emailSender: {
      async sendVerificationCode() {},
    },
    createVerificationCode: () => '123456',
  });

  await authService.sendEmailCode({
    email: 'alice@example.com',
  });

  await assert.rejects(
    () =>
      authService.register({
        username: 'alice',
        email: 'alice@example.com',
        password: 'password123',
        displayName: 'Alice',
        verificationCode: '000000',
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 400 &&
      error.code === 'INVALID_EMAIL_CODE',
  );
});

test('login returns a token and current user when credentials are valid', async () => {
  const fakeUsers = createFakeUsersRepository();
  fakeUsers.seed({
    id: 'existing-user',
    personalId: 'u123456',
    username: 'alice',
    email: 'alice@example.com',
    passwordHash: await bcrypt.hash('password123', 10),
    displayName: 'Alice',
    avatarUrl: null,
    bio: null,
    createdAt: new Date('2026-06-02T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
  });

  const authService = createAuthService({
    jwtSecret: 'super-secret-value',
    usersRepository: fakeUsers.repository,
  });

  const result = await authService.login({
    email: 'alice@example.com',
    password: 'password123',
  });

  assert.equal(typeof result.token, 'string');
  assert.deepEqual(result.user, {
    id: 'existing-user',
    personalId: 'u123456',
    username: 'alice',
    email: 'alice@example.com',
    displayName: 'Alice',
    avatarUrl: null,
    bio: null,
    privateAlbumsOnly: false,
    activityStatusActive: true,
    locationTaggingActive: true,
    createdAt: '2026-06-02T00:00:00.000Z',
    updatedAt: '2026-06-02T00:00:00.000Z',
  });
});

test('login rejects invalid credentials', async () => {
  const fakeUsers = createFakeUsersRepository();
  fakeUsers.seed({
    id: 'existing-user',
    personalId: 'u123456',
    username: 'alice',
    email: 'alice@example.com',
    passwordHash: await bcrypt.hash('password123', 10),
    displayName: 'Alice',
    avatarUrl: null,
    bio: null,
    createdAt: new Date('2026-06-02T00:00:00.000Z'),
    updatedAt: new Date('2026-06-02T00:00:00.000Z'),
  });

  const authService = createAuthService({
    jwtSecret: 'super-secret-value',
    usersRepository: fakeUsers.repository,
  });

  await assert.rejects(
    () =>
      authService.login({
        email: 'alice@example.com',
        password: 'wrong-password',
      }),
    (error: unknown) =>
      error instanceof HttpError &&
      error.statusCode === 401 &&
      error.code === 'INVALID_CREDENTIALS',
  );
});
