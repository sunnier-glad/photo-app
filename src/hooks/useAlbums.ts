/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { initialAlbums } from '../data';
import { createApiClient } from '../lib/api';
import { sortPhotosByFavorite } from '../lib/album-display';
import { uploadFileToOss } from '../lib/oss-upload';
import { isPrototypeToken } from '../lib/prototype-session';
import { validatePhotoFile } from '../lib/upload-validation';
import { Album, ApiAlbum, ApiAlbumWithPhotos, ApiImageUploadToken, ApiPhoto, Photo, UploadPhotosResult } from '../types';
import { mapAlbum } from './mappers';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '相册加载失败';

const clonePrototypeAlbums = () =>
  initialAlbums.map((album) => ({
    ...album,
    tags: album.tags ? [...album.tags] : undefined,
    photos: album.photos.map((photo) => ({ ...photo })),
  }));

const createPrototypePhoto = (albumId: string, file: File, url: string, index: number): Photo => ({
  id: `prototype-photo-${albumId}-${Date.now()}-${index}`,
  url,
  mimeType: file.type,
  title: file.name,
  dateAdded: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
  isFavorite: false,
});

const updatePhotoInAlbums = (
  current: Album[],
  photoId: string,
  updater: (photo: Photo) => Photo,
) =>
  current.map((album) => ({
    ...album,
    photos: sortPhotosByFavorite(
      album.photos.map((photo) => (photo.id === photoId ? updater(photo) : photo)),
    ),
  }));

export const useAlbums = (token: string | null) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);

  const refresh = useCallback(async () => {
    if (!token) {
      setAlbums([]);
      return;
    }

    if (isPrototypeToken(token)) {
      setAlbums((current) => (current.length > 0 ? current : clonePrototypeAlbums()));
      setError('');
      return;
    }

    setIsLoading(true);
    try {
      const albumRecords = await api.get<ApiAlbumWithPhotos[]>('/albums/with-photos');
      setAlbums(albumRecords.map((album) => mapAlbum(album, album.photos)));
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

  const createAlbum = useCallback(
    async (input: { title: string; description?: string }) => {
      if (isPrototypeToken(token)) {
        setAlbums((current) => [
          {
            id: `prototype-album-${Date.now()}`,
            title: input.title,
            description: input.description,
            photos: [],
            coverUrl: 'https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80',
            tags: input.description ? [input.description] : undefined,
            type: 'all',
          },
          ...current,
        ]);
        setError('');
        return;
      }

      await api.post<ApiAlbum>('/albums', input);
      await refresh();
    },
    [api, refresh, token],
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      if (isPrototypeToken(token)) {
        setAlbums((current) =>
          current.map((album) => ({
            ...album,
            photos: album.photos.filter((photo) => photo.id !== photoId),
          })),
        );
        setError('');
        return;
      }

      await api.delete<{ photoId: string }>(`/photos/${photoId}`);
      await refresh();
    },
    [api, refresh, token],
  );

  const generatePhotoTitle = useCallback(
    async (photoId: string) => {
      if (isPrototypeToken(token)) {
        setAlbums((current) =>
          current.map((album) => ({
            ...album,
            photos: album.photos.map((photo) =>
              photo.id === photoId
                ? {
                    ...photo,
                    aiTitle: `${album.title}的回忆`,
                  }
                : photo,
            ),
          })),
        );
        setError('');
        return;
      }

      const updatedPhoto = await api.post<ApiPhoto>(`/photos/${photoId}/ai-title`, {});
      setAlbums((current) =>
        current.map((album) => ({
          ...album,
          photos: album.photos.map((photo) =>
            photo.id === photoId
              ? {
                  ...photo,
                  aiTitle: updatedPhoto.aiTitle ?? null,
                  title: updatedPhoto.title ?? updatedPhoto.fileName,
                }
              : photo,
          ),
        })),
      );
    },
    [api, token],
  );

  const updatePhotoFavorite = useCallback(
    async (photoId: string, isFavorite: boolean) => {
      if (isPrototypeToken(token)) {
        setAlbums((current) =>
          updatePhotoInAlbums(current, photoId, (photo) => ({
            ...photo,
            isFavorite,
          })),
        );
        setError('');
        return;
      }

      const updatedPhoto = await api.patch<ApiPhoto>(`/photos/${photoId}/favorite`, {
        isFavorite,
      });
      setAlbums((current) =>
        updatePhotoInAlbums(current, photoId, (photo) => ({
          ...photo,
          isFavorite: updatedPhoto.isFavorite,
        })),
      );
    },
    [api, token],
  );

  const uploadPhotos = useCallback(
    async (albumId: string, files: File[]): Promise<UploadPhotosResult> => {
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
        if (!albums.some((album) => album.id === albumId)) {
          return {
            uploadedCount: 0,
            failedCount: validFiles.length + errors.length,
            firstError: errors[0] ?? '相册不存在',
          };
        }

        const prototypePhotos = validFiles.map((file, index) =>
          createPrototypePhoto(albumId, file, URL.createObjectURL(file), index),
        );

        setAlbums((current) =>
          current.map((album) =>
            album.id === albumId
              ? {
                  ...album,
                  coverUrl: prototypePhotos[0]?.url ?? album.coverUrl,
                  photos: [...prototypePhotos, ...album.photos],
                }
              : album,
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
          const tokenResponse = await api.post<ApiImageUploadToken>('/photos/upload-token', {
            albumId,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
          });

          await uploadFileToOss(tokenResponse, file);

          await api.post<ApiPhoto>('/photos', {
            albumId,
            objectKey: tokenResponse.objectKey,
            fileName: file.name,
            mimeType: file.type,
            size: file.size,
            title: file.name,
          });

          uploadedCount += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : '上传照片失败';
          errors.push(`${file.name}: ${message}`);
        }
      }

      await refresh();

      return {
        uploadedCount,
        failedCount: errors.length,
        firstError: errors[0],
      };
    },
    [albums, api, refresh, token],
  );

  return {
    albums,
    isLoading,
    error,
    refresh,
    createAlbum,
    deletePhoto,
    generatePhotoTitle,
    updatePhotoFavorite,
    uploadPhotos,
  };
};
