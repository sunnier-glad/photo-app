export const createPersonalId = (source: string, attempt = 0) => {
  const normalizedSource = source.trim().toLowerCase() || 'memories-user';
  const sourceWithAttempt = attempt === 0 ? normalizedSource : `${normalizedSource}:${attempt}`;
  let hash = 0;

  for (let index = 0; index < sourceWithAttempt.length; index += 1) {
    hash = (hash * 31 + sourceWithAttempt.charCodeAt(index)) >>> 0;
  }

  return `u${String(hash % 1_000_000).padStart(6, '0')}`;
};
