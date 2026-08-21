import { z } from 'zod';

export const MAX_AVATAR_UPLOAD_SIZE = 3 * 1024 * 1024;

const avatarMimeTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => value.toLowerCase().startsWith('image/'), {
    message: 'Only image uploads are supported',
  });

export const updateProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).max(64).optional(),
    avatarUrl: z.url().optional().nullable(),
    avatarObjectKey: z.string().trim().min(1).max(500).optional().nullable(),
    bio: z.string().trim().max(280).optional().nullable(),
    privateAlbumsOnly: z.boolean().optional(),
    activityStatusActive: z.boolean().optional(),
    locationTaggingActive: z.boolean().optional(),
  })
  .refine(
    (input) =>
      input.displayName !== undefined ||
      input.avatarUrl !== undefined ||
      input.avatarObjectKey !== undefined ||
      input.bio !== undefined ||
      input.privateAlbumsOnly !== undefined ||
      input.activityStatusActive !== undefined ||
      input.locationTaggingActive !== undefined,
    {
      message: 'At least one profile field must be provided',
    },
  );

export const createAvatarUploadTokenBodySchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: avatarMimeTypeSchema,
  size: z
    .number()
    .int()
    .nonnegative()
    .max(MAX_AVATAR_UPLOAD_SIZE, 'Avatar upload must be 3 MB or smaller'),
});
