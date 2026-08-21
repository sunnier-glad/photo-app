/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const normalizeEmailInput = (email: string) => email.trim().toLowerCase();

export const validateEmailInput = (email: string) => {
  const normalizedEmail = normalizeEmailInput(email);

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return '请输入正确的邮箱地址';
  }

  return null;
};
