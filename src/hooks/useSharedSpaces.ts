/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { activeSpacePhotos, initialSharedSpaces } from '../data';
import { createApiClient } from '../lib/api';
import { uploadFileToOss } from '../lib/oss-upload';
import { isPrototypeToken } from '../lib/prototype-session';
import { validatePhotoFile } from '../lib/upload-validation';
import {
  ApiImageUploadToken,
  ApiSharedSpace,
  ApiSharedSpaceMember,
  ApiSharedSpacePhoto,
  ApiSharedSpaceWithDetails,
  SharedSpace,
  UploadSharedSpacePhotosResult,
} from '../types';
import { mapSharedSpace } from './mappers';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '共享空间加载失败';

const getSharedUploadErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('Unexpected server error') || message.includes('INTERNAL_SERVER_ERROR')) {
    return '上传服务异常，请稍后重试';
  }

  if (message.includes('Invalid request payload') || message.includes('VALIDATION_ERROR')) {
    return '上传参数不正确，请重新选择照片/视频';
  }

  if (message.includes('Shared space not found') || message.includes('SHARED_SPACE_NOT_FOUND')) {
    return '共享相册不存在或你没有访问权限';
  }

  return message || '上传照片/视频失败';
};

const clonePrototypeSpaces = () =>
  initialSharedSpaces.map((space) => ({
    ...space,
    contributorsAvatars: [...space.contributorsAvatars],
  }));

const createPrototypeSpacePhotos = (): Record<string, ApiSharedSpacePhoto[]> => ({
  'space-1': activeSpacePhotos.map((photo) => ({
    id: `space-photo-${photo.id}`,
    sharedSpaceId: 'space-1',
    photoId: photo.title,
    sharedById: 'prototype-user',
    createdAt: '2026-06-02T00:00:00.000Z',
    photo: {
      id: `prototype-photo-${photo.id}`,
      albumId: 'prototype-shared-upload-album',
      uploadedById: 'prototype-user',
      title: photo.title,
      aiTitle: null,
      location: null,
      objectKey: `prototype/${photo.title}`,
      url: photo.url,
      fileName: photo.title,
      mimeType: 'image/jpeg',
      size: 0,
      width: null,
      height: null,
      isFavorite: false,
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z',
    },
  })),
});

const createPrototypeSharedPhoto = (
  spaceId: string,
  file: File,
  url: string,
  index: number,
): ApiSharedSpacePhoto => {
  const now = new Date().toISOString();
  const photoId = `prototype-photo-${spaceId}-${Date.now()}-${index}`;

  return {
    id: `prototype-shared-photo-${spaceId}-${Date.now()}-${index}`,
    sharedSpaceId: spaceId,
    photoId,
    sharedById: 'prototype-user',
    createdAt: now,
    photo: {
      id: photoId,
      albumId: 'prototype-shared-upload-album',
      uploadedById: 'prototype-user',
      title: file.name,
      aiTitle: null,
      location: null,
      objectKey: `prototype/${file.name}`,
      url,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      width: null,
      height: null,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    },
  };
};

export const useSharedSpaces = (
  token: string | null,
  options: {
    onAlbumsChanged?: () => Promise<void> | void;
    onTrashChanged?: () => Promise<void> | void;
  } = {},
) => {
  const [sharedSpaces, setSharedSpaces] = useState<SharedSpace[]>([]);
  const [spacePhotos, setSpacePhotos] = useState<Record<string, ApiSharedSpacePhoto[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);
  const onAlbumsChanged = options.onAlbumsChanged;
  const onTrashChanged = options.onTrashChanged;

  const refresh = useCallback(async () => {
    if (!token) {
      setSharedSpaces([]);
      setSpacePhotos({});
      return;
    }

    if (isPrototypeToken(token)) {
      setSharedSpaces((current) => (current.length > 0 ? current : clonePrototypeSpaces()));
      setSpacePhotos((current) =>
        Object.keys(current).length > 0 ? current : createPrototypeSpacePhotos(),
      );
      setError('');
      return;
    }

    setIsLoading(true);
    try {
      const details = await api.get<ApiSharedSpaceWithDetails[]>('/shared-spaces/with-details');

      setSharedSpaces(
        details.map((space) => mapSharedSpace(space, space.members, space.photos.length)),
      );
      setSpacePhotos(
        details.reduce<Record<string, ApiSharedSpacePhoto[]>>((acc, detail) => {
          acc[detail.id] = detail.photos;
          return acc;
        }, {}),
      );
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createSpace = useCallback(
    async (input: { title: string; description?: string }) => {
      if (isPrototypeToken(token)) {
        const id = `prototype-space-${Date.now()}`;
        const space: SharedSpace = {
          id,
          title: input.title,
          description: input.description,
          photosCount: 0,
          contributorsCount: 1,
          contributorsAvatars: [
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&q=80',
          ],
          coverUrl: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80',
        };
        setSharedSpaces((current) => [
          space,
          ...current,
        ]);
        setSpacePhotos((current) => ({ ...current, [id]: [] }));
        setError('');
        return space;
      }

      const createdSpace = await api.post<ApiSharedSpace>('/shared-spaces', input);
      await refresh();

      return mapSharedSpace(createdSpace, [], 0);
    },
    [api, refresh, token],
  );

  const inviteToSpace = useCallback(
    async (spaceId: string, userId: string) => {
      if (isPrototypeToken(token)) {
        if (!userId.trim()) {
          setError('请输入用户 ID');
          return;
        }

        setSharedSpaces((current) =>
          current.map((space) =>
            space.id === spaceId
              ? { ...space, contributorsCount: space.contributorsCount + 1 }
              : space,
          ),
        );
        setError('');
        return;
      }

      await api.post<ApiSharedSpaceMember>(`/shared-spaces/${spaceId}/invitations`, { userId });
      await refresh();
    },
    [api, refresh, token],
  );

  const renameSpace = useCallback(
    async (spaceId: string, input: { title: string; description?: string }) => {
      if (isPrototypeToken(token)) {
        setSharedSpaces((current) =>
          current.map((space) =>
            space.id === spaceId
              ? { ...space, title: input.title, description: input.description }
              : space,
          ),
        );
        setError('');
        return;
      }

      await api.patch<ApiSharedSpace>(`/shared-spaces/${spaceId}`, input);
      await refresh();
    },
    [api, refresh, token],
  );

  const uploadPhotosToSpace = useCallback(
    async (spaceId: string, files: File[]): Promise<UploadSharedSpacePhotosResult> => {
      const errors: string[] = [];
      const validFiles = files.filter((file) => {
        const validationError = validatePhotoFile(file);
        if (validationError) {
          errors.push(`${file.name}: ${validationError}`);
          return false;
        }
        return true;
      });

      if (validFiles.length === 0) {
        return {
          uploadedCount: 0,
          failedCount: errors.length,
          firstError: errors[0],
        };
      }

      if (isPrototypeToken(token)) {
        const prototypePhotos = validFiles.map((file, index) =>
          createPrototypeSharedPhoto(spaceId, file, URL.createObjectURL(file), index),
        );

        setSpacePhotos((current) => ({
          ...current,
          [spaceId]: [...prototypePhotos, ...(current[spaceId] ?? [])],
        }));
        setSharedSpaces((current) =>
          current.map((space) =>
            space.id === spaceId
              ? {
                  ...space,
                  photosCount: space.photosCount + prototypePhotos.length,
                  coverUrl: prototypePhotos[0]?.photo?.url ?? space.coverUrl,
                }
              : space,
          ),
        );
        setError('');

        return {
          uploadedCount: validFiles.length,
          failedCount: errors.length,
          firstError: errors[0],
        };
      }

      let uploadedCount = 0;

      for (const file of validFiles) {
        try {
          const tokenResponse = await api.post<ApiImageUploadToken>(
            `/shared-spaces/${spaceId}/upload-token`,
            {
              fileName: file.name,
              mimeType: file.type,
              size: file.size,
            },
          );

          await uploadFileToOss(tokenResponse, file);

          await api.post<ApiSharedSpacePhoto>(`/shared-spaces/${spaceId}/photos/register`, {
            objectKey: tokenResponse.objectKey,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            title: file.name,
          });

          uploadedCount += 1;
        } catch (error) {
          const message = getSharedUploadErrorMessage(error);
          errors.push(`${file.name}: ${message}`);
        }
      }

      await refresh();
      await onAlbumsChanged?.();

      return {
        uploadedCount,
        failedCount: errors.length,
        firstError: errors[0],
      };
    },
    [api, onAlbumsChanged, refresh, token],
  );

  const deletePhotoFromSpace = useCallback(
    async (spaceId: string, sharedPhotoId: string) => {
      if (isPrototypeToken(token)) {
        setSpacePhotos((current) => {
          const currentPhotos = current[spaceId] ?? [];
          const nextPhotos = currentPhotos.filter((photo) => photo.id !== sharedPhotoId);

          return {
            ...current,
            [spaceId]: nextPhotos,
          };
        });
        setSharedSpaces((current) =>
          current.map((space) =>
            space.id === spaceId
              ? { ...space, photosCount: Math.max(0, space.photosCount - 1) }
              : space,
          ),
        );
        setError('');
        return;
      }

      await api.delete(`/shared-spaces/${spaceId}/photos/${sharedPhotoId}`);
      await refresh();
      await onAlbumsChanged?.();
      await onTrashChanged?.();
    },
    [api, onAlbumsChanged, onTrashChanged, refresh, token],
  );

  return {
    sharedSpaces,
    spacePhotos,
    isLoading,
    error,
    refresh,
    createSpace,
    inviteToSpace,
    renameSpace,
    uploadPhotosToSpace,
    deletePhotoFromSpace,
  };
};
