/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { initialContacts } from '../data';
import { createApiClient } from '../lib/api';
import { isPrototypeToken } from '../lib/prototype-session';
import { ApiFriendInvitation, ApiUser, Contact } from '../types';
import { mapContact } from './mappers';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '好友加载失败';

const clonePrototypeContacts = () => initialContacts.map((contact) => ({ ...contact }));

export const useFriends = (token: string | null) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [invitations, setInvitations] = useState<ApiFriendInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);

  const refresh = useCallback(async () => {
    if (!token) {
      setContacts([]);
      setInvitations([]);
      return;
    }

    if (isPrototypeToken(token)) {
      setContacts((current) => (current.length > 0 ? current : clonePrototypeContacts()));
      setError('');
      return;
    }

    setIsLoading(true);
    try {
      const [friends, friendInvitations] = await Promise.all([
        api.get<ApiUser[]>('/friends'),
        api.get<ApiFriendInvitation[]>('/friends/invitations'),
      ]);
      setContacts(friends.map(mapContact));
      setInvitations(friendInvitations);
      setError('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sendInvitation = useCallback(
    async (receiverId: string) => {
      if (isPrototypeToken(token)) {
        setInvitations((current) => [
          {
            id: `prototype-invitation-${Date.now()}`,
            senderId: 'prototype-user',
            receiverId,
            pairUserAId: 'prototype-user',
            pairUserBId: receiverId,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          ...current,
        ]);
        setError('');
        return;
      }

      await api.post<ApiFriendInvitation>('/friends/invitations', { receiverId });
      await refresh();
    },
    [api, refresh, token],
  );

  const acceptInvitation = useCallback(
    async (invitationId: string) => {
      if (isPrototypeToken(token)) {
        setInvitations((current) =>
          current.map((invitation) =>
            invitation.id === invitationId ? { ...invitation, status: 'ACCEPTED' } : invitation,
          ),
        );
        setError('');
        return;
      }

      await api.post<{ invitation: ApiFriendInvitation }>(`/friends/invitations/${invitationId}/accept`);
      await refresh();
    },
    [api, refresh, token],
  );

  const rejectInvitation = useCallback(
    async (invitationId: string) => {
      if (isPrototypeToken(token)) {
        setInvitations((current) =>
          current.map((invitation) =>
            invitation.id === invitationId ? { ...invitation, status: 'REJECTED' } : invitation,
          ),
        );
        setError('');
        return;
      }

      await api.post<ApiFriendInvitation>(`/friends/invitations/${invitationId}/reject`);
      await refresh();
    },
    [api, refresh, token],
  );

  return {
    contacts,
    invitations,
    isLoading,
    error,
    refresh,
    sendInvitation,
    acceptInvitation,
    rejectInvitation,
  };
};
