import { z } from 'zod';

export const createAlbumBodySchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
});
