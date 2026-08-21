/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ApiFriendInvitation, ApiUser } from '../types';

export const getInvitationPersonName = (
  user: Partial<ApiUser> | null | undefined,
  fallbackId = '',
) => user?.displayName?.trim() || user?.username?.trim() || fallbackId;

export const getReceivedInvitationTitle = (invitation: ApiFriendInvitation) =>
  `来自 ${getInvitationPersonName(invitation.sender, invitation.senderId)} 的添加请求`;

export const getSentInvitationTitle = (invitation: ApiFriendInvitation) =>
  `发给 ${getInvitationPersonName(invitation.receiver, invitation.receiverId)} 的添加请求`;
