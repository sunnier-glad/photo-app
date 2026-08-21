import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AvatarSource } from '../../common/avatar-url.js';
import { HttpError } from '../../common/http-error.js';
import { createPersonalId } from '../../common/personal-id.js';

export type AuthUserRecord = {
  id: string;
  personalId: string | null;
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
  avatarUrl: string | null;
  avatarObjectKey?: string | null;
  bio: string | null;
  privateAlbumsOnly?: boolean;
  activityStatusActive?: boolean;
  locationTaggingActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicUser = {
  id: string;
  personalId: string | null;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  privateAlbumsOnly?: boolean;
  activityStatusActive?: boolean;
  locationTaggingActive?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ResolveAuthAvatarUrl = (user: AvatarSource) => string | null;

export type RegisterInput = {
  username: string;
  email: string;
  password: string;
  displayName: string;
  verificationCode: string;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type AuthUsersRepository = {
  findByEmail(email: string): Promise<AuthUserRecord | null>;
  findByUsername(username: string): Promise<AuthUserRecord | null>;
  findByPersonalId(personalId: string): Promise<AuthUserRecord | null>;
  findById(id: string): Promise<AuthUserRecord | null>;
  create(input: Omit<AuthUserRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuthUserRecord>;
};

export type EmailVerificationCodeRecord = {
  id: string;
  email: string;
  codeHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

export type AuthEmailVerificationRepository = {
  create(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<EmailVerificationCodeRecord>;
  countRecent(email: string, since: Date): Promise<number>;
  findLatestUsable(email: string, now: Date): Promise<EmailVerificationCodeRecord | null>;
  markUsed(id: string, usedAt: Date): Promise<void>;
};

export type AuthEmailSender = {
  sendVerificationCode(email: string, code: string): Promise<void>;
};

export const toPublicUser = (
  user: AuthUserRecord,
  resolveAvatarUrl: ResolveAuthAvatarUrl = (source) => source.avatarUrl ?? null,
): PublicUser => ({
  id: user.id,
  personalId: user.personalId,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  avatarUrl: resolveAvatarUrl(user),
  bio: user.bio,
  privateAlbumsOnly: user.privateAlbumsOnly ?? false,
  activityStatusActive: user.activityStatusActive ?? true,
  locationTaggingActive: user.locationTaggingActive ?? true,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

const createAuthPayload = (
  jwtSecret: string,
  user: AuthUserRecord,
  resolveAvatarUrl?: ResolveAuthAvatarUrl,
) => ({
  token: jwt.sign({ sub: user.id }, jwtSecret, { expiresIn: '7d' }),
  user: toPublicUser(user, resolveAvatarUrl),
});

export const createAuthService = ({
  jwtSecret,
  usersRepository,
  emailVerificationRepository,
  emailSender,
  resolveAvatarUrl,
  createVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000)),
  getNow = () => new Date(),
}: {
  jwtSecret: string;
  usersRepository: AuthUsersRepository;
  emailVerificationRepository?: AuthEmailVerificationRepository;
  emailSender?: AuthEmailSender;
  resolveAvatarUrl?: ResolveAuthAvatarUrl;
  createVerificationCode?: () => string;
  getNow?: () => Date;
}) => ({
  async sendEmailCode(input: { email: string }) {
    if (!emailVerificationRepository || !emailSender) {
      throw new HttpError(503, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification is unavailable');
    }

    const email = input.email.trim().toLowerCase();
    const now = getNow();
    const recentCount = await emailVerificationRepository.countRecent(
      email,
      new Date(now.getTime() - 60_000),
    );

    if (recentCount > 0) {
      throw new HttpError(429, 'EMAIL_CODE_TOO_FREQUENT', 'Please request a new code later');
    }

    const code = createVerificationCode().padStart(6, '0').slice(0, 6);
    const codeHash = await bcrypt.hash(code, 10);
    await emailVerificationRepository.create({
      email,
      codeHash,
      expiresAt: new Date(now.getTime() + 10 * 60_000),
    });
    await emailSender.sendVerificationCode(email, code);

    return {
      email,
      expiresInSeconds: 600,
    };
  },

  async register(input: RegisterInput) {
    if (!emailVerificationRepository) {
      throw new HttpError(503, 'EMAIL_VERIFICATION_UNAVAILABLE', 'Email verification is unavailable');
    }

    const existingUserByEmail = await usersRepository.findByEmail(input.email);

    if (existingUserByEmail) {
      throw new HttpError(409, 'EMAIL_ALREADY_IN_USE', 'Email is already in use');
    }

    const existingUserByUsername = await usersRepository.findByUsername(input.username);

    if (existingUserByUsername) {
      throw new HttpError(409, 'USERNAME_ALREADY_IN_USE', 'Username is already in use');
    }

    const now = getNow();
    const verification = await emailVerificationRepository.findLatestUsable(input.email, now);

    if (!verification || !(await bcrypt.compare(input.verificationCode, verification.codeHash))) {
      throw new HttpError(400, 'INVALID_EMAIL_CODE', 'Invalid or expired email verification code');
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    let personalId: string | null = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = createPersonalId(input.email, attempt);
      const existingUserByPersonalId = await usersRepository.findByPersonalId(candidate);

      if (!existingUserByPersonalId) {
        personalId = candidate;
        break;
      }
    }

    if (!personalId) {
      throw new HttpError(500, 'PERSONAL_ID_GENERATION_FAILED', 'Personal ID generation failed');
    }

    const user = await usersRepository.create({
      personalId,
      username: input.username,
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      avatarUrl: null,
      bio: null,
    });
    await emailVerificationRepository.markUsed(verification.id, now);

    return createAuthPayload(jwtSecret, user, resolveAvatarUrl);
  },

  async login(input: LoginInput) {
    const user = await usersRepository.findByEmail(input.email);

    if (!user) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    return createAuthPayload(jwtSecret, user, resolveAvatarUrl);
  },

  async authenticate(token: string) {
    let decoded: string | jwt.JwtPayload;

    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch {
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }

    const userId =
      typeof decoded === 'string'
        ? null
        : typeof decoded.sub === 'string'
          ? decoded.sub
          : null;

    if (!userId) {
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }

    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new HttpError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    }

    return toPublicUser(user, resolveAvatarUrl);
  },
});

export type AuthService = ReturnType<typeof createAuthService>;
