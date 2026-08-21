/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ApiAuthPayload, ApiUser } from '../types';
import { createPersonalId } from './personal-id';

const PROTOTYPE_TOKEN_PREFIX = 'prototype-token-';
const PROTOTYPE_USER_STORAGE_KEY = 'memories.prototypeUser';
const PROTOTYPE_NOW = '2026-06-02T00:00:00.000Z';

type PrototypeAuthInput = {
  email: string;
  password: string;
  username?: string;
  displayName?: string;
};

const hasWindow = () => typeof window !== 'undefined';

const defaultPrototypeUser: ApiUser = {
  id: 'prototype-user',
  personalId: createPersonalId('prototype-user'),
  username: 'demo',
  email: 'demo@memories.local',
  displayName: '相册体验用户',
  avatarUrl: null,
  bio: '这是一个无需后端即可体验的手机原型账号。',
  createdAt: PROTOTYPE_NOW,
  updatedAt: PROTOTYPE_NOW,
};

export const isPrototypeToken = (token: string | null | undefined) =>
  Boolean(token?.startsWith(PROTOTYPE_TOKEN_PREFIX));

export const createPrototypeAuthPayload = ({
  email,
  username,
  displayName,
}: PrototypeAuthInput): ApiAuthPayload => {
  const normalizedEmail = email.trim().toLowerCase() || defaultPrototypeUser.email;
  const emailName = normalizedEmail.split('@')[0] || defaultPrototypeUser.username;
  const user: ApiUser = {
    ...defaultPrototypeUser,
    id: `prototype-user-${emailName}`,
    personalId: createPersonalId(normalizedEmail),
    username: username?.trim() || emailName,
    email: normalizedEmail,
    displayName: displayName?.trim() || '相册体验用户',
    updatedAt: new Date().toISOString(),
  };

  return {
    token: `${PROTOTYPE_TOKEN_PREFIX}${user.id}`,
    user,
  };
};

export const getStoredPrototypeUser = () => {
  if (!hasWindow()) {
    return null;
  }

  const stored = window.localStorage.getItem(PROTOTYPE_USER_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as ApiUser;
  } catch {
    window.localStorage.removeItem(PROTOTYPE_USER_STORAGE_KEY);
    return null;
  }
};

export const setStoredPrototypeUser = (user: ApiUser) => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.setItem(PROTOTYPE_USER_STORAGE_KEY, JSON.stringify(user));
};

export const clearStoredPrototypeUser = () => {
  if (!hasWindow()) {
    return;
  }

  window.localStorage.removeItem(PROTOTYPE_USER_STORAGE_KEY);
};

export const revivePrototypeUser = (token: string | null | undefined): ApiUser => {
  if (!isPrototypeToken(token)) {
    return defaultPrototypeUser;
  }

  const storedUser = getStoredPrototypeUser();
  if (!storedUser) {
    return defaultPrototypeUser;
  }

  return {
    ...storedUser,
    personalId: storedUser.personalId ?? createPersonalId(storedUser.email || storedUser.id),
  };
};
