import { z } from 'zod';

const MAX_IMAGE_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_SIZE = 200 * 1024 * 1024;

const mediaMimeTypeSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => {
    const mimeType = value.toLowerCase();

    return mimeType.startsWith('image/') || mimeType.startsWith('video/');
  }, {
    message: 'Only image or video uploads are supported',
  });

const mediaSizeSchema = z
  .number()
  .int()
  .nonnegative();

const validateMediaSize = (
  input: { mimeType: string; size: number },
  context: z.RefinementCtx,
) => {
  const mimeType = input.mimeType.toLowerCase();
  const maxSize = mimeType.startsWith('video/') ? MAX_VIDEO_UPLOAD_SIZE : MAX_IMAGE_UPLOAD_SIZE;
  const message = mimeType.startsWith('video/')
    ? 'Video upload must be 200 MB or smaller'
    : 'Image upload must be 10 MB or smaller';

  if (input.size > maxSize) {
    context.addIssue({
      code: 'custom',
      path: ['size'],
      message,
    });
  }
};

const photoUploadTokenBaseSchema = z.object({
  albumId: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: mediaMimeTypeSchema,
  size: mediaSizeSchema,
});

const registerPhotoBaseSchema = z.object({
  albumId: z.string().trim().min(1),
  objectKey: z.string().trim().min(1),
  fileName: z.string().trim().min(1).max(255),
  mimeType: mediaMimeTypeSchema,
  size: mediaSizeSchema,
  title: z.string().trim().max(120).optional(),
  location: z.string().trim().max(255).optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

export const createPhotoUploadTokenBodySchema = photoUploadTokenBaseSchema.superRefine(validateMediaSize);

export const createSharedSpaceUploadTokenBodySchema = photoUploadTokenBaseSchema
  .omit({ albumId: true })
  .superRefine(validateMediaSize);

export const registerPhotoBodySchema = registerPhotoBaseSchema.superRefine(validateMediaSize);

export const registerSharedSpacePhotoBodySchema = registerPhotoBaseSchema
  .omit({ albumId: true })
  .superRefine(validateMediaSize);
