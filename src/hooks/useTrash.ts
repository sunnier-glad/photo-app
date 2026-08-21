/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { initialDeletedPhotos } from '../data';
import { createApiClient } from '../lib/api';
import { isPrototypeToken } from '../lib/prototype-session';
import { ApiPhoto, ApiTrashItem, DeletedPhoto } from '../types';
import { mapTrashItem } from './mappers';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '回收站加载失败';

const clonePrototypeTrash = () => initialDeletedPhotos.map((photo) => ({ ...photo }));

export const useTrash = (token: string | null, onAlbumsChanged?: () => Promise<void>) => {
  const [deletedPhotos, setDeletedPhotos] = useState<DeletedPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);

  const refresh = useCallback(async () => {
    if (!token) {
      setDeletedPhotos([]);
      return;
    }

    if (isPrototypeToken(token)) {
      setDeletedPhotos((current) => (current.length > 0 ? current : clonePrototypeTrash()));
      setError('');
      return;
    }

    setIsLoading(true);
    try {
      const trashItems = await api.get<ApiTrashItem[]>('/trash');
      setDeletedPhotos(trashItems.map(mapTrashItem));
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

  const restore = useCallback(
    async (photoId: string) => {
      if (isPrototypeToken(token)) {
        setDeletedPhotos((current) => current.filter((photo) => photo.id !== photoId));
        setError('');
        await onAlbumsChanged?.();
        return;
      }

      await api.post<ApiPhoto>(`/trash/${photoId}/restore`);
      await refresh();
      await onAlbumsChanged?.();
    },
    [api, onAlbumsChanged, refresh, token],
  );

  const permanentlyDelete = useCallback(
    async (photoId: string) => {
      if (isPrototypeToken(token)) {
        setDeletedPhotos((current) => current.filter((photo) => photo.id !== photoId));
        setError('');
        await onAlbumsChanged?.();
        return;
      }

      await api.delete<{ photoId: string }>(`/trash/${photoId}`);
      await refresh();
      await onAlbumsChanged?.();
    },
    [api, onAlbumsChanged, refresh, token],
  );

  const emptyBin = useCallback(async () => {
    if (isPrototypeToken(token)) {
      setDeletedPhotos([]);
      setError('');
      await onAlbumsChanged?.();
      return;
    }

    await Promise.all(deletedPhotos.map((photo) => api.delete<{ photoId: string }>(`/trash/${photo.id}`)));
    await refresh();
    await onAlbumsChanged?.();
  }, [api, deletedPhotos, onAlbumsChanged, refresh, token]);

  return {
    deletedPhotos,
    isLoading,
    error,
    refresh,
    restore,
    permanentlyDelete,
    emptyBin,
  };
};
