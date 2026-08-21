/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from '../lib/api';
import { uploadFileToOss } from '../lib/oss-upload';
import { isPrototypeToken, setStoredPrototypeUser } from '../lib/prototype-session';
import { validateAvatarFile } from '../lib/upload-validation';
import { ApiAvatarUploadToken, ApiStorageSummary, ApiUser, UserProfile } from '../types';
import { mapUserProfile } from './mappers';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '个人资料加载失败';

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('头像读取失败'));
    };
    reader.onerror = () => reject(new Error('头像读取失败'));
    reader.readAsDataURL(file);
  });

type UpdateProfileInput = {
  displayName?: string;
  avatarUrl?: string | null;
  avatarFile?: File | null;
  bio?: string | null;
  privateAlbumsOnly?: boolean;
  activityStatusActive?: boolean;
  locationTaggingActive?: boolean;
};

export const useProfile = ({
  token,
  currentUser,
  collectionsCount,
  onUserUpdated,
}: {
  token: string | null;
  currentUser: ApiUser | null;
  collectionsCount: number;
  onUserUpdated: (user: ApiUser) => void;
}) => {
  const [storageSummary, setStorageSummary] = useState<ApiStorageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);

  const load = useCallback(async () => {
    if (!token) {
      setStorageSummary(null);
      return;
    }

    if (isPrototypeToken(token)) {
      setStorageSummary({
        usedBytes: 12.4 * 1024 * 1024 * 1024,
        photoCount: 2400,
      });
      setError('');
      return;
    }

    setIsLoading(true);
    try {
      const summary = await api.get<ApiStorageSummary>('/users/me/storage');
      setStorageSummary(summary);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      if (isPrototypeToken(token) && currentUser) {
        let avatarUrl = input.avatarUrl ?? currentUser.avatarUrl;

        if (input.avatarFile) {
          const validationError = validateAvatarFile(input.avatarFile);
          if (validationError) {
            throw new Error(validationError);
          }

          avatarUrl = await fileToDataUrl(input.avatarFile);
        }

        const user: ApiUser = {
          ...currentUser,
          displayName: input.displayName ?? currentUser.displayName,
          avatarUrl,
          bio: input.bio ?? currentUser.bio,
          privateAlbumsOnly: input.privateAlbumsOnly ?? currentUser.privateAlbumsOnly,
          activityStatusActive: input.activityStatusActive ?? currentUser.activityStatusActive,
          locationTaggingActive: input.locationTaggingActive ?? currentUser.locationTaggingActive,
          updatedAt: new Date().toISOString(),
        };
        setStoredPrototypeUser(user);
        onUserUpdated(user);
        setError('');
        return user;
      }

      let avatarObjectKey: string | undefined;

      if (input.avatarFile) {
        const validationError = validateAvatarFile(input.avatarFile);
        if (validationError) {
          throw new Error(validationError);
        }

        const tokenResponse = await api.post<ApiAvatarUploadToken>('/users/me/avatar-upload-token', {
          fileName: input.avatarFile.name,
          mimeType: input.avatarFile.type,
          size: input.avatarFile.size,
        });
        await uploadFileToOss(tokenResponse, input.avatarFile);
        avatarObjectKey = tokenResponse.objectKey;
      }

      const user = await api.patch<ApiUser>('/users/me', {
        displayName: input.displayName,
        ...(avatarObjectKey
          ? { avatarObjectKey }
          : input.avatarUrl !== undefined
            ? { avatarUrl: input.avatarUrl }
            : {}),
        bio: input.bio,
        privateAlbumsOnly: input.privateAlbumsOnly,
        activityStatusActive: input.activityStatusActive,
        locationTaggingActive: input.locationTaggingActive,
      });
      onUserUpdated(user);
      setError('');
      return user;
    },
    [api, currentUser, onUserUpdated, token],
  );

  const userProfile = currentUser
    ? mapUserProfile(currentUser, storageSummary, collectionsCount)
    : null;

  return {
    userProfile,
    storageSummary,
    isLoading,
    error,
    load,
    updateProfile,
  };
};
