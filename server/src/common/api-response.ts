export const ok = <T>(data: T) => ({
  success: true as const,
  data,
});
