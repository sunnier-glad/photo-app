export type AvatarSource = {
  avatarUrl?: string | null;
  avatarObjectKey?: string | null;
};

export type AvatarUrlSigner = {
  getObjectUrl(objectKey: string): string;
};

const managedAvatarKeyPattern = /^users\/[^/]+\/avatars\/[^/?#]+$/;

export const extractManagedAvatarObjectKey = (value: string | null | undefined) => {
  const trimmedValue = value?.trim();

  if (!trimmedValue) {
    return null;
  }

  if (managedAvatarKeyPattern.test(trimmedValue)) {
    return trimmedValue;
  }

  try {
    const url = new URL(trimmedValue);
    const objectKey = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

    return managedAvatarKeyPattern.test(objectKey) ? objectKey : null;
  } catch {
    return null;
  }
};

export const resolveAvatarUrl = (source: AvatarSource, signer: AvatarUrlSigner) => {
  const objectKey = source.avatarObjectKey ?? extractManagedAvatarObjectKey(source.avatarUrl);

  if (objectKey) {
    return signer.getObjectUrl(objectKey);
  }

  return source.avatarUrl ?? null;
};
