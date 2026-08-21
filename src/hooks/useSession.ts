/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApiClient } from '../lib/api';
import { clearStoredPrototypeUser, isPrototypeToken, revivePrototypeUser } from '../lib/prototype-session';
import { clearStoredToken, getStoredToken, setStoredToken } from '../lib/storage';
import { ApiAuthPayload, ApiEmailCodePayload, ApiUser } from '../types';

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = LoginInput & {
  username: string;
  displayName: string;
  verificationCode: string;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '会话发生异常';

const getInitialToken = () => {
  const storedToken = getStoredToken();

  if (isPrototypeToken(storedToken)) {
    clearStoredToken();
    clearStoredPrototypeUser();
    return null;
  }

  return storedToken;
};

export const useSession = () => {
  const [token, setToken] = useState<string | null>(() => getInitialToken());
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [error, setError] = useState('');

  const api = useMemo(() => createApiClient({ getToken: () => token }), [token]);

  const applyAuthPayload = useCallback((payload: ApiAuthPayload) => {
    setStoredToken(payload.token);
    setToken(payload.token);
    setCurrentUser(payload.user);
    setError('');
  }, []);

  const refreshCurrentUser = useCallback(async () => {
    if (!token) {
      setCurrentUser(null);
      return null;
    }

    if (isPrototypeToken(token)) {
      setCurrentUser(revivePrototypeUser(token));
      setError('');
      setIsLoading(false);
      return revivePrototypeUser(token);
    }

    setIsLoading(true);
    try {
      const user = await api.get<ApiUser>('/users/me');
      setCurrentUser(user);
      setError('');
      return user;
    } catch (err) {
      clearStoredToken();
      setToken(null);
      setCurrentUser(null);
      setError(getErrorMessage(err));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    void refreshCurrentUser();
  }, [refreshCurrentUser]);

  const login = useCallback(
    async (input: LoginInput) => {
      const payload = await api.post<ApiAuthPayload>('/auth/login', input);
      applyAuthPayload(payload);
    },
    [api, applyAuthPayload],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const payload = await api.post<ApiAuthPayload>('/auth/register', input);
      applyAuthPayload(payload);
    },
    [api, applyAuthPayload],
  );

  const sendEmailCode = useCallback(
    (input: { email: string }) => api.post<ApiEmailCodePayload>('/auth/email-code', input),
    [api],
  );

  const logout = useCallback(() => {
    clearStoredToken();
    clearStoredPrototypeUser();
    setToken(null);
    setCurrentUser(null);
    setError('');
  }, []);

  return {
    token,
    currentUser,
    isAuthenticated: Boolean(token),
    isLoading,
    error,
    login,
    register,
    sendEmailCode,
    logout,
    refreshCurrentUser,
    setCurrentUser,
  };
};
