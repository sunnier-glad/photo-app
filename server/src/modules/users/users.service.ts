import { randomUUID } from 'node:crypto';
import { extractManagedAvatarObjectKey, resolveAvatarUrl } from '../../common/avatar-url.js';
import { HttpError } from '../../common/http-error.js';
import { toPublicUser, type AuthUserRecord, type PublicUser } from '../auth/auth.service.js';
import type {
  CreateImageUploadTokenInput,
  ImageUploadToken,
} from '../uploads/oss.service.js';

export type UpdateCurrentUserInput = {
  displayName?: string;
  avatarUrl?: string | null;
  avatarObjectKey?: string | null;
  bio?: string | null;
  privateAlbumsOnly?: boolean;
  activityStatusActive?: boolean;
  locationTaggingActive?: boolean;
};

export type UserStorageSummary = {
  usedBytes: number;
  photoCount: number;
};

export type UsersUploadSigner = {
  createImageUploadToken(input: CreateImageUploadTokenInput): Promise<ImageUploadToken>;
  getObjectUrl(objectKey: string): string;
};

export type AvatarUploadToken = ImageUploadToken & { avatarUrl: string };

export type CreateAvatarUploadTokenInput = {
  fileName: string;
  mimeType: string;
  size: number;
};

export type UsersRepository = {
  findById(id: string): Promise<AuthUserRecord | null>;
  updateProfile(id: string, input: UpdateCurrentUserInput): Promise<AuthUserRecord>;
  getStorageSummary(userId: string): Promise<UserStorageSummary | null>;
};

const toSignedPublicUser = (user: AuthUserRecord, uploadSigner: UsersUploadSigner) =>
  toPublicUser(user, (source) => resolveAvatarUrl(source, uploadSigner));

const normalizeProfileInput = (input: UpdateCurrentUserInput): UpdateCurrentUserInput => {
  if (input.avatarObjectKey !== undefined) {
    return {
      ...input,
      avatarUrl: input.avatarObjectKey ? null : input.avatarUrl,
    };
  }

  if (input.avatarUrl === undefined) {
    return input;
  }

  const avatarObjectKey = extractManagedAvatarObjectKey(input.avatarUrl);

  if (!avatarObjectKey) {
    return input;
  }

  return {
    ...input,
    avatarUrl: null,
    avatarObjectKey,
  };
};

const getFileExtension = (fileName: string) => {
  const parts = fileName.split('.');

  if (parts.length < 2) {
    return 'jpg';
  }

  const extension = parts.at(-1)?.trim().toLowerCase();

  return extension || 'jpg';
};

export const createUsersService = ({
  usersRepository,
  uploadSigner,
  createObjectId = randomUUID,
}: {
  usersRepository: UsersRepository;
  uploadSigner: UsersUploadSigner;
  createObjectId?: () => string;
}) => {
  const findUserOrThrow = async (userId: string) => {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, 'USER_NOT_FOUND', 'User not found');
    }

    return user;
  };

  return {
    async getCurrentUser(userId: string): Promise<PublicUser> {
      const user = await findUserOrThrow(userId);

      return toSignedPublicUser(user, uploadSigner);
    },

    async updateCurrentUser(userId: string, input: UpdateCurrentUserInput): Promise<PublicUser> {
      await findUserOrThrow(userId);

      const user = await usersRepository.updateProfile(userId, normalizeProfileInput(input));

      return toSignedPublicUser(user, uploadSigner);
    },

    async createAvatarUploadToken(
      userId: string,
      input: CreateAvatarUploadTokenInput,
    ): Promise<AvatarUploadToken> {
      await findUserOrThrow(userId);

      const objectKey = `users/${userId}/avatars/${createObjectId()}.${getFileExtension(input.fileName)}`;
      const uploadToken = await uploadSigner.createImageUploadToken({
        objectKey,
        mimeType: input.mimeType,
        size: input.size,
      });

      return {
        ...uploadToken,
        avatarUrl: uploadSigner.getObjectUrl(objectKey),
      };
    },

    async getStorageSummary(userId: string): Promise<UserStorageSummary> {
      const summary = await usersRepository.getStorageSummary(userId);

      if (!summary) {
        throw new HttpError(404, 'USER_STORAGE_NOT_FOUND', 'User storage summary not found');
      }

      return summary;
    },
  };
};

export type UsersService = ReturnType<typeof createUsersService>;
