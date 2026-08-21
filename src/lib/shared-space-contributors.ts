/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiSharedSpacePhoto } from '../types';

export type SharedSpaceContributorFilter = {
  id: 'all' | string;
  label: string;
  avatarUrl?: string;
};

export const createContributorFilters = (
  photos: ApiSharedSpacePhoto[],
  currentUserId: string,
): SharedSpaceContributorFilter[] => {
  const contributors = new Map<string, SharedSpaceContributorFilter>();

  for (const photo of photos) {
    const contributorId = photo.sharedById;

    if (contributors.has(contributorId)) {
      continue;
    }

    contributors.set(contributorId, {
      id: contributorId,
      label:
        contributorId === currentUserId
          ? '我上传的'
          : photo.sharedBy?.displayName || photo.sharedBy?.username || '好友',
      avatarUrl: photo.sharedBy?.avatarUrl ?? undefined,
    });
  }

  return [{ id: 'all', label: '全部' }, ...contributors.values()];
};

export const filterSharedPhotosByContributor = (
  photos: ApiSharedSpacePhoto[],
  contributorId: 'all' | string,
) => (contributorId === 'all' ? photos : photos.filter((photo) => photo.sharedById === contributorId));
