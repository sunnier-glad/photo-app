/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const getWrappedPhotoIndex = (index: number, total: number) => {
  if (total <= 0) return 0;

  return ((index % total) + total) % total;
};

export const getSwipeDirection = (offsetX: number, threshold = 45) => {
  if (Math.abs(offsetX) < threshold) return 0;

  return offsetX > 0 ? 1 : -1;
};

export const getNextPhotoAfterDelete = (photoIds: string[], deletedPhotoId: string) => {
  const deletedIndex = photoIds.indexOf(deletedPhotoId);
  if (deletedIndex < 0 || photoIds.length <= 1) return null;

  const remainingPhotoIds = photoIds.filter((photoId) => photoId !== deletedPhotoId);
  return remainingPhotoIds[Math.min(deletedIndex, remainingPhotoIds.length - 1)] ?? null;
};
