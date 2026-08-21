/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useMemo, useState } from 'react';
import { createApiClient } from '../lib/api';
import { isPrototypeToken } from '../lib/prototype-session';
import { ApiMessage } from '../types';

export const useMessages = (token: string | null) => {
  const [conversations, setConversations] = useState<Record<string, ApiMessage[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);

  const loadConversation = useCallback(
    async (friendId: string) => {
      if (!token) {
        setConversations((current) => ({ ...current, [friendId]: [] }));
        return [];
      }

      if (isPrototypeToken(token)) {
        const prototypeMessages = conversations[friendId] ?? [];
        return prototypeMessages;
      }

      setIsLoading(true);
      try {
        const messages = await api.get<ApiMessage[]>(`/messages/${friendId}`);
        setConversations((current) => ({ ...current, [friendId]: messages }));
        setError('');
        return messages;
      } catch (err) {
        const message = err instanceof Error ? err.message : '聊天记录加载失败';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [api, conversations, token],
  );

  const sendMessage = useCallback(
    async (friendId: string, content: string) => {
      if (isPrototypeToken(token)) {
        const message: ApiMessage = {
          id: `prototype-message-${Date.now()}`,
          senderId: 'prototype-user',
          receiverId: friendId,
          content: content.trim(),
          readAt: null,
          createdAt: new Date().toISOString(),
        };
        setConversations((current) => ({
          ...current,
          [friendId]: [...(current[friendId] ?? []), message],
        }));
        return message;
      }

      const message = await api.post<ApiMessage>(`/messages/${friendId}`, { content });
      setConversations((current) => ({
        ...current,
        [friendId]: [...(current[friendId] ?? []), message],
      }));
      setError('');
      return message;
    },
    [api, token],
  );

  return {
    conversations,
    isLoading,
    error,
    loadConversation,
    sendMessage,
  };
};
