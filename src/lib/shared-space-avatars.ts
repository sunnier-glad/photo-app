import type { Contact, SharedSpace } from '../types';

export function getSharedSpaceMemberAvatars({
  space,
  currentUserId,
  currentUserAvatarUrl,
  contacts,
  limit = 3,
}: {
  space: Pick<SharedSpace, 'contributorUserIds' | 'contributorsAvatars'>;
  currentUserId: string;
  currentUserAvatarUrl: string;
  contacts: Contact[];
  limit?: number;
}) {
  const contactById = new Map(contacts.map((contact) => [contact.id, contact]));
  const avatars: string[] = [];
  const memberIds = space.contributorUserIds ?? [];

  for (const userId of memberIds) {
    const avatarUrl =
      userId === currentUserId ? currentUserAvatarUrl : contactById.get(userId)?.avatarUrl;

    if (avatarUrl && !avatars.includes(avatarUrl)) {
      avatars.push(avatarUrl);
    }
  }

  if (memberIds.length === 0) {
    for (const avatarUrl of space.contributorsAvatars) {
      if (avatarUrl && !avatars.includes(avatarUrl)) {
        avatars.push(avatarUrl);
      }
    }
  }

  return avatars.slice(0, limit);
}
