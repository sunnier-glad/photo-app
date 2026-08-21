export const DEFAULT_API_BASE_URL = 'http://localhost:4000/api';
export const DEFAULT_UPDATE_MANIFEST_URL = 'https://example.com/memories/version.json';

export const resolveRuntimeUrl = (value: string | undefined, fallback: string) => {
  const configuredUrl = value?.trim();
  return configuredUrl || fallback;
};
