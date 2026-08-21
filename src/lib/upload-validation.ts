/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const PHOTO_MAX_SIZE_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_SIZE_BYTES = 200 * 1024 * 1024;
const AVATAR_MAX_SIZE_BYTES = 3 * 1024 * 1024;

const validateImageFile = (
  file: File,
  maxSizeBytes: number,
  maxSizeMessage: string,
): string | null => {
  if (!file.type.startsWith('image/')) {
    return '只能上传图片文件';
  }

  if (file.size > maxSizeBytes) {
    return maxSizeMessage;
  }

  return null;
};

export const validatePhotoFile = (file: File): string | null =>
  file.type.startsWith('image/')
    ? validateImageFile(file, PHOTO_MAX_SIZE_BYTES, '单张照片不能超过 10 MB')
    : file.type.startsWith('video/')
      ? file.size > VIDEO_MAX_SIZE_BYTES
        ? '单个视频不能超过 200 MB'
        : null
      : '只能上传图片或视频文件';

export const validateAvatarFile = (file: File): string | null =>
  validateImageFile(file, AVATAR_MAX_SIZE_BYTES, '头像不能超过 3 MB');
