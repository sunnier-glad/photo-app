/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserPlus, MessageCircle, Share2, X, ChevronRight, Check, Send } from 'lucide-react';
import { getReceivedInvitationTitle, getSentInvitationTitle } from '../lib/friend-invitations';
import { ApiFriendInvitation, ApiMessage, Contact } from '../types';
import { useAppDialog } from './AppDialog';

interface ContactsTabProps {
  contacts: Contact[];
  invitations: ApiFriendInvitation[];
  currentUserId: string;
  currentUserAvatarUrl: string;
  onSendInvitation: (receiverId: string) => Promise<void>;
  onAcceptInvitation: (invitationId: string) => Promise<void>;
  onRejectInvitation: (invitationId: string) => Promise<void>;
  onStartSharedAlbum: (contact: Contact) => Promise<void>;
  messagesByContactId: Record<string, ApiMessage[]>;
  isLoadingMessages: boolean;
  onLoadMessages: (contactId: string) => Promise<ApiMessage[]>;
  onSendMessage: (contactId: string, content: string) => Promise<ApiMessage>;
  onOpenProfile: () => void;
}

export default function ContactsTab({
  contacts,
  invitations,
  currentUserId,
  currentUserAvatarUrl,
  onSendInvitation,
  onAcceptInvitation,
  onRejectInvitation,
  onStartSharedAlbum,
  messagesByContactId,
  isLoadingMessages,
  onLoadMessages,
  onSendMessage,
  onOpenProfile,
}: ContactsTabProps) {
  const dialog = useAppDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);
  const [selectedContactDetail, setSelectedContactDetail] = useState<Contact | null>(null);
  const [chatContact, setChatContact] = useState<Contact | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Add friend state form
  const [receiverId, setReceiverId] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const [isStartingSharedAlbum, setIsStartingSharedAlbum] = useState(false);
  const [friendInviteErrorMessage, setFriendInviteErrorMessage] = useState('');
  const [sharedAlbumMessage, setSharedAlbumMessage] = useState('');

  const getFriendInviteErrorMessage = (error: unknown) => {
    const message = error instanceof Error ? error.message : '';

    if (message === 'User not found' || message.includes('USER_NOT_FOUND')) {
      return '未找到该个人ID，请检查后重试';
    }

    if (message === 'Cannot invite yourself' || message.includes('CANNOT_INVITE_SELF')) {
      return '不能添加自己为好友';
    }

    if (message.includes('already exists') || message.includes('ALREADY_EXISTS')) {
      return '你们已经是好友，或已有待处理的好友邀请';
    }

    return message || '发送好友邀请失败，请稍后重试';
  };

  const closeAddFriendDialog = useCallback(() => {
    setReceiverId('');
    setFriendInviteErrorMessage('');
    setIsAddFriendOpen(false);
  }, []);

  const closeContactDetail = useCallback(() => {
    setSelectedContactDetail(null);
  }, []);

  const closeChatDialog = useCallback(() => {
    setChatContact(null);
    setChatInput('');
  }, []);

  const handleLocalBack = useCallback(() => {
    if (friendInviteErrorMessage) {
      setFriendInviteErrorMessage('');
      return true;
    }

    if (sharedAlbumMessage) {
      setSharedAlbumMessage('');
      return true;
    }

    if (chatContact) {
      closeChatDialog();
      return true;
    }

    if (selectedContactDetail) {
      closeContactDetail();
      return true;
    }

    if (isAddFriendOpen) {
      closeAddFriendDialog();
      return true;
    }

    if (searchQuery) {
      setSearchQuery('');
      return true;
    }

    return false;
  }, [
    closeAddFriendDialog,
    closeChatDialog,
    closeContactDetail,
    chatContact,
    friendInviteErrorMessage,
    isAddFriendOpen,
    searchQuery,
    selectedContactDetail,
    sharedAlbumMessage,
  ]);

  useEffect(() => {
    const handleBackEvent = (event: Event) => {
      if (handleLocalBack()) {
        event.preventDefault();
      }
    };

    window.addEventListener('memories:go-back', handleBackEvent);

    return () => {
      window.removeEventListener('memories:go-back', handleBackEvent);
    };
  }, [handleLocalBack]);

  const handleCreateFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverId.trim()) return;

    setIsSendingInvite(true);
    try {
      await onSendInvitation(receiverId.trim());
      setReceiverId('');
      setIsAddFriendOpen(false);
    } catch (error) {
      setFriendInviteErrorMessage(getFriendInviteErrorMessage(error));
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleStartSharedAlbum = async (contact: Contact) => {
    setIsStartingSharedAlbum(true);
    setSharedAlbumMessage('');

    try {
      await onStartSharedAlbum(contact);
      setSelectedContactDetail(null);
      setSharedAlbumMessage(`已向 ${contact.name} 发起真实相册共享，请到共享页查看。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setSharedAlbumMessage(message || '发起共享相册失败，请稍后重试');
    } finally {
      setIsStartingSharedAlbum(false);
    }
  };

  const openChatDialog = (contact: Contact) => {
    setChatContact(contact);
    setSelectedContactDetail(null);
    setChatInput('');
    void onLoadMessages(contact.id).catch((error) => {
      setFriendInviteErrorMessage(error instanceof Error ? error.message : '聊天记录加载失败');
    });
  };

  const handleSendChatMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chatContact || !chatInput.trim()) return;

    setIsSendingMessage(true);
    try {
      await onSendMessage(chatContact.id, chatInput.trim());
      setChatInput('');
    } catch (error) {
      setFriendInviteErrorMessage(error instanceof Error ? error.message : '发送消息失败');
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Filter contacts by search query
  const searchFilteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const mainContactsList = searchFilteredContacts.filter(c => !c.isSuggested);
  const suggestedPeople = searchFilteredContacts.filter(c => c.isSuggested);
  const pendingReceivedInvitations = invitations.filter(
    (invitation) => invitation.status === 'PENDING' && invitation.receiverId === currentUserId,
  );
  const pendingSentInvitations = invitations.filter(
    (invitation) => invitation.status === 'PENDING' && invitation.senderId === currentUserId,
  );
  const pendingInvitationCount = pendingReceivedInvitations.length + pendingSentInvitations.length;
  const chatMessages = chatContact ? messagesByContactId[chatContact.id] ?? [] : [];

  return (
    <div className="w-full pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 pb-4 pt-[calc(2.5rem+env(safe-area-inset-top))] glass-nav border-b border-surface-container-high">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full overflow-hidden hover:scale-105 transition-transform border border-secondary/10 cursor-pointer"
          >
            <img 
              src={currentUserAvatarUrl} 
              alt="个人头像" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">好友</h1>
        </div>
        <button
          onClick={() => setIsAddFriendOpen(true)}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-[#88503a] text-white hover:bg-[#7a442f] text-xs font-bold rounded-full transition-all cursor-pointer ambient-shadow"
          type="button"
        >
          <UserPlus className="w-4 h-4" />
          添加好友
        </button>
      </header>

      <div className="px-5 mt-6">
        {/* Search input with search icon adornments */}
        <div className="relative mb-8" id="contacts-search-box">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-outline" />
          <input
            type="text"
            placeholder="搜索好友"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-5 py-3 bg-surface-container-low text-on-surface placeholder-outline rounded-full text-sm border border-transparent focus:outline-none focus:border-outline/30 focus:bg-white"
          />
        </div>

        {/* Contacts list layout */}
        {pendingInvitationCount > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-on-surface tracking-tight">待处理邀请</h2>
              <span className="text-xs text-on-surface-variant font-mono">{pendingInvitationCount} 个</span>
            </div>
            <div className="bg-white rounded-xl border border-surface-container/50 divide-y divide-surface-container-high overflow-hidden shadow-xs">
              {pendingReceivedInvitations.map((invitation) => (
                <div key={invitation.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">{getReceivedInvitationTitle(invitation)}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      发送于 {invitation.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void onAcceptInvitation(invitation.id).catch((error) => {
                          void dialog.alert(error instanceof Error ? error.message : '接受邀请失败');
                        });
                      }}
                      className="px-3 py-1.5 rounded-full bg-green-700 text-white text-xs font-semibold"
                    >
                      接受
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void onRejectInvitation(invitation.id).catch((error) => {
                          void dialog.alert(error instanceof Error ? error.message : '拒绝邀请失败');
                        });
                      }}
                      className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold"
                    >
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
              {pendingSentInvitations.map((invitation) => (
                <div key={invitation.id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-on-surface">{getSentInvitationTitle(invitation)}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      自 {invitation.createdAt.slice(0, 10)} 起等待处理
                    </p>
                  </div>
                  <span className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold">
                    等待中
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-on-surface tracking-tight">好友列表</h2>
            <span className="text-xs text-on-surface-variant font-mono">{mainContactsList.length} 位好友</span>
          </div>

          <div className="bg-white rounded-xl border border-surface-container/50 divide-y divide-surface-container-high overflow-hidden shadow-xs">
            {mainContactsList.map((contact) => (
              <div
                key={contact.id}
                onClick={() => setSelectedContactDetail(contact)}
                className="flex items-center justify-between p-4 hover:bg-surface-lowest/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm overflow-hidden border border-surface-container-highest">
                    {contact.avatarUrl ? (
                      <img src={contact.avatarUrl} className="w-full h-full object-cover" alt={contact.name} referrerPolicy="no-referrer" />
                    ) : (
                      contact.initials || '友'
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-on-surface text-sm group-hover:text-secondary transition-colors leading-tight">
                      {contact.name}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-0.5">{contact.status}</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-outline/60 group-hover:translate-x-0.5 transition-transform" />
              </div>
            ))}

            {mainContactsList.length === 0 && (
              <div className="p-8 text-center text-on-surface-variant text-xs font-medium">
                没有找到匹配的好友。
              </div>
            )}
          </div>
        </div>

        {/* Suggested follows column grid as shown in Image 2 */}
        {suggestedPeople.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-on-surface tracking-tight mb-4">推荐好友</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {suggestedPeople.map((person) => (
                <div 
                  key={person.id}
                  className="bg-white border border-surface-container-high rounded-xl p-5 text-center flex flex-col items-center justify-between shadow-xs relative"
                >
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-secondary-container mb-3 border-2 border-surface-container-highest">
                    <img src={person.avatarUrl} alt={person.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>

                  <div className="mb-4">
                    <h4 className="font-bold text-on-surface text-sm leading-tight truncate max-w-full">{person.name}</h4>
                    <p className="text-[10px] text-on-surface-variant mt-1.5 leading-snug">
                      {person.status.replace('推荐：', '')}
                    </p>
                  </div>

                  {/* Toggle button follow/following */}
                  <button
                    onClick={() => {
                      void onSendInvitation(person.id).catch((error) => {
                        setFriendInviteErrorMessage(getFriendInviteErrorMessage(error));
                      });
                    }}
                    className={`w-full py-2.5 rounded-full text-xs font-bold cursor-pointer transition-all flex items-center justify-center gap-1 ${
                      person.isFollowing 
                        ? 'bg-surface-container text-on-surface hover:bg-surface-container-high' 
                        : 'bg-secondary-container hover:bg-[#ffe1d4] text-on-secondary-container'
                    }`}
                    type="button"
                  >
                    {person.isFollowing ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-on-surface stroke-[3]" />
                        已关注
                      </>
                    ) : (
                      '关注'
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add New Friend Dialog popup */}
      <AnimatePresence>
        {isAddFriendOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-surface-container"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-bold text-lg text-on-surface">发送好友邀请</h3>
                <button 
                  type="button"
                  onClick={closeAddFriendDialog}
                  className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateFriend} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">对方个人 ID</label>
                  <input
                    type="text"
                    required
                    placeholder="输入对方个人ID，例如 u123456"
                    value={receiverId}
                    onChange={(e) => setReceiverId(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-surface-container-lowest text-on-surface rounded-xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-[#88503a] text-sm"
                  />
                  <p className="text-[11px] text-on-surface-variant mt-2 leading-relaxed">
                    让好友在个人页复制自己的个人ID，你在这里粘贴后即可发送邀请。
                  </p>
                </div>

                <div className="pt-4 border-t border-surface-container-high flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAddFriendDialog}
                    className="px-4 py-2 hover:bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingInvite}
                    className="px-5 py-2.5 bg-[#88503a] text-white hover:bg-[#7a442f] rounded-full text-xs font-bold cursor-pointer"
                  >
                    {isSendingInvite ? '发送中...' : '发送邀请'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(friendInviteErrorMessage || sharedAlbumMessage) && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-sm rounded-3xl border border-white/70 bg-[#fffaf7] p-6 text-[#1e1b18] shadow-2xl"
            >
              <h3 className="text-xl font-extrabold tracking-tight">提示</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-on-surface-variant">
                {friendInviteErrorMessage || sharedAlbumMessage}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFriendInviteErrorMessage('');
                  setSharedAlbumMessage('');
                }}
                className="mt-6 w-full rounded-full bg-[#88503a] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#7a442f]"
              >
                知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {chatContact && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-background rounded-t-3xl max-w-md w-full p-5 shadow-2xl border-t border-surface-container"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-secondary-container">
                    {chatContact.avatarUrl ? (
                      <img
                        src={chatContact.avatarUrl}
                        alt={chatContact.name}
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-on-secondary-container">
                        {chatContact.initials}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-on-surface">{chatContact.name}</h3>
                    <p className="text-xs text-on-surface-variant">好友聊天</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeChatDialog}
                  className="p-1.5 hover:bg-surface-container rounded-full text-on-surface-variant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 max-h-[45vh] min-h-[16rem] overflow-y-auto space-y-3 rounded-3xl bg-[#fffaf7] p-4 border border-surface-container-low">
                {isLoadingMessages && (
                  <p className="text-center text-xs font-semibold text-on-surface-variant">正在加载聊天记录...</p>
                )}
                {!isLoadingMessages && chatMessages.length === 0 && (
                  <div className="flex h-48 items-center justify-center text-center">
                    <p className="text-xs font-semibold text-on-surface-variant">
                      还没有聊天消息，发送第一句问候吧。
                    </p>
                  </div>
                )}
                {chatMessages.map((message) => {
                  const isMine = message.senderId === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-3xl px-4 py-2.5 text-sm font-semibold shadow-sm ${
                          isMine
                            ? 'rounded-br-md bg-[#88503a] text-white'
                            : 'rounded-bl-md bg-white text-on-surface border border-surface-container'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <p className={`mt-1 text-[10px] ${isMine ? 'text-white/70' : 'text-on-surface-variant'}`}>
                          {new Date(message.createdAt).toLocaleTimeString('zh-CN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleSendChatMessage} className="mt-4 flex items-center gap-2 rounded-full bg-white p-2 shadow-sm border border-surface-container">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="输入消息"
                  className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm font-semibold text-on-surface placeholder:text-outline focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !chatInput.trim()}
                  className="flex h-11 w-11 items-center justify-center rounded-full bg-[#88503a] text-white shadow-sm disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Contact Profile Detail Drawer Panel */}
      <AnimatePresence>
        {selectedContactDetail && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-background rounded-t-3xl max-w-md w-full p-6 shadow-2xl border-t border-surface-container"
            >
              <div className="flex justify-end">
                <button 
                  type="button"
                  onClick={closeContactDetail}
                  className="p-1.5 hover:bg-surface-container rounded-full text-on-surface-variant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center py-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-secondary-container mx-auto mb-3 border-2 border-[#ffb599]/40">
                  {selectedContactDetail.avatarUrl ? (
                    <img src={selectedContactDetail.avatarUrl} alt={selectedContactDetail.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-xl font-extrabold text-on-secondary-container flex items-center justify-center w-full h-full">
                      {selectedContactDetail.initials}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-on-surface">{selectedContactDetail.name}</h3>
                <p className="text-xs text-on-surface-variant mt-1">{selectedContactDetail.status}</p>

                {/* Profile Stats blocks */}
                <div className="grid grid-cols-2 gap-4 mt-6 max-w-xs mx-auto">
                  <div className="bg-surface-container p-3 rounded-lg text-center">
                    <span className="block text-lg font-bold text-on-surface">
                      {selectedContactDetail.sharingCount}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-medium uppercase uppercase">共享相册</span>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg text-center">
                    <span className="block text-lg font-bold text-on-surface">
                      {selectedContactDetail.sharingCount > 0 ? '活跃' : '离线'}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-medium uppercase">访问状态</span>
                  </div>
                </div>

                {/* Action row shortcuts */}
                <div className="flex gap-2 justify-center mt-6">
                  <button
                    onClick={() => openChatDialog(selectedContactDetail)}
                    className="flex items-center gap-1 px-4.5 py-2.5 bg-secondary text-white rounded-full text-xs font-semibold hover:bg-secondary/90 transition-colors cursor-pointer"
                    type="button"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    发消息
                  </button>
                  <button
                    onClick={() => void handleStartSharedAlbum(selectedContactDetail)}
                    disabled={isStartingSharedAlbum}
                    className="flex items-center gap-1 px-4.5 py-2.5 border border-surface-container-highest flex-1 justify-center hover:bg-surface-container text-on-surface rounded-full text-xs font-semibold transition-colors cursor-pointer"
                    type="button"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {isStartingSharedAlbum ? '发起中...' : '共享相册'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
