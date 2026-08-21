/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AnimatePresence, motion } from 'motion/react';
import {
  Clock,
  FolderHeart,
  ImageIcon,
  Lock,
  Mail,
  Sparkles,
  User,
  UserPlus,
  Users,
  ShieldCheck,
} from 'lucide-react';

import AlbumsTab from './components/AlbumsTab';
import { AppDialogProvider } from './components/AppDialog';
import CleanupTab from './components/CleanupTab';
import ContactsTab from './components/ContactsTab';
import ProfileTab from './components/ProfileTab';
import SharedSpacesTab from './components/SharedSpacesTab';
import { useAlbums } from './hooks/useAlbums';
import { useFriends } from './hooks/useFriends';
import { useMessages } from './hooks/useMessages';
import { useProfile } from './hooks/useProfile';
import { useSession } from './hooks/useSession';
import { useSharedSpaces } from './hooks/useSharedSpaces';
import { useTrash } from './hooks/useTrash';
import {
  CURRENT_APP_VERSION,
  fetchUpdateManifest,
  getAvailableUpdate,
  UpdateManifest,
} from './lib/app-update';
import { createApiClient } from './lib/api';
import { normalizeEmailInput, validateEmailInput } from './lib/email-validation';
import { popNavigationHistory, pushNavigationHistory } from './lib/navigation-history';
import type { Contact } from './types';

type AppTab = 'albums' | 'cleanup' | 'spaces' | 'contacts' | 'profile';

const DEFAULT_PROFILE_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&q=80';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '应用发生异常';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('albums');
  const [tabHistory, setTabHistory] = useState<AppTab[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [availableUpdate, setAvailableUpdate] = useState<UpdateManifest | null>(null);
  const [latestUpdateManifest, setLatestUpdateManifest] = useState<UpdateManifest | null>(null);
  const [isVersionCardVisible, setIsVersionCardVisible] = useState(false);
  const [isUpdateDismissed, setIsUpdateDismissed] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckMessage, setUpdateCheckMessage] = useState('');
  const [updateCheckError, setUpdateCheckError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);
  const [isSendingEmailCode, setIsSendingEmailCode] = useState(false);
  const [emailCodeCountdown, setEmailCodeCountdown] = useState(0);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    username: '',
    displayName: '',
    email: '',
    password: '',
    verificationCode: '',
  });

  const session = useSession();
  const albums = useAlbums(session.token);
  const trash = useTrash(session.token, albums.refresh);
  const friends = useFriends(session.token);
  const messages = useMessages(session.token);
  const sharedSpaces = useSharedSpaces(session.token, {
    onAlbumsChanged: albums.refresh,
    onTrashChanged: trash.refresh,
  });
  const profile = useProfile({
    token: session.token,
    currentUser: session.currentUser,
    collectionsCount: albums.albums.length,
    onUserUpdated: session.setCurrentUser,
  });
  const currentUserAvatarUrl = session.currentUser?.avatarUrl || DEFAULT_PROFILE_AVATAR;

  const handleSendAssistantMessage = useCallback(
    async (message: string) => {
      const api = createApiClient({ getToken: () => session.token });
      const result = await api.post<{ reply: string }>('/assistant/chat', { message });
      return result.reply;
    },
    [session.token],
  );

  const dismissUpdateCard = useCallback(() => {
    setIsUpdateDismissed(true);
    setIsVersionCardVisible(false);
  }, []);

  const navigateToTab = useCallback((nextTab: AppTab) => {
    setActiveTab((currentTab) => {
      setTabHistory((currentHistory) =>
        pushNavigationHistory(currentHistory, currentTab, nextTab),
      );
      return nextTab;
    });
  }, []);

  const resetToAlbums = useCallback(() => {
    setTabHistory([]);
    setActiveTab('albums');
  }, []);

  const dispatchPageBack = useCallback(() => {
    const event = new Event('memories:go-back', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }, []);

  const handleAppBack = useCallback(() => {
    if (isVersionCardVisible && latestUpdateManifest && !isUpdateDismissed) {
      dismissUpdateCard();
      return true;
    }

    if (dispatchPageBack()) {
      return true;
    }

    if (!session.isAuthenticated) {
      if (authMode === 'register') {
        setAuthError('');
        setAuthMode('login');
        return true;
      }
      return false;
    }

    if (tabHistory.length > 0) {
      const result = popNavigationHistory(tabHistory);
      if (result.previous) {
        setTabHistory(result.history);
        setActiveTab(result.previous);
        return true;
      }
    }

    if (activeTab !== 'albums') {
      resetToAlbums();
      return true;
    }

    return false;
  }, [
    activeTab,
    authMode,
    dismissUpdateCard,
    dispatchPageBack,
    isUpdateDismissed,
    isVersionCardVisible,
    latestUpdateManifest,
    resetToAlbums,
    session.isAuthenticated,
    tabHistory,
  ]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }

    let listener: { remove: () => Promise<void> } | undefined;

    void CapacitorApp.addListener('backButton', async () => {
      const handled = handleAppBack();
      if (!handled) {
        await CapacitorApp.exitApp();
      }
    }).then((handle) => {
      listener = handle;
    });

    return () => {
      void listener?.remove();
    };
  }, [handleAppBack]);

  const handleCheckForUpdate = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;

      if (!silent) {
        setIsCheckingUpdate(true);
        setUpdateCheckMessage('正在检查版本更新...');
      }

      try {
        const manifest = await fetchUpdateManifest();
        const update = getAvailableUpdate(manifest);
        setLatestUpdateManifest(manifest);
        setAvailableUpdate(update);
        setUpdateCheckError('');

        if (update) {
          setIsUpdateDismissed(false);
          setIsVersionCardVisible(true);
          if (!silent) {
            setUpdateCheckMessage(`发现新版本 ${update.versionName}，请在弹窗中下载。`);
          }
          return;
        }

        if (!silent) {
          setUpdateCheckMessage(`当前已是最新版本 ${CURRENT_APP_VERSION.versionName}`);
        }
        setIsVersionCardVisible(false);
      } catch (error) {
        const message = `版本检查失败：${getErrorMessage(error)}`;
        setUpdateCheckError(message);
        if (!silent) {
          setUpdateCheckMessage(message);
        }
      } finally {
        if (!silent) {
          setIsCheckingUpdate(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void handleCheckForUpdate({ silent: true });
  }, [handleCheckForUpdate]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void handleCheckForUpdate({ silent: true });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleCheckForUpdate]);

  useEffect(() => {
    if (activeTab === 'profile') {
      void handleCheckForUpdate({ silent: true });
    }
  }, [activeTab, handleCheckForUpdate]);

  useEffect(() => {
    if (emailCodeCountdown <= 0) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setEmailCodeCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [emailCodeCountdown]);

  const appError =
    authError ||
    session.error ||
    albums.error ||
    trash.error ||
    friends.error ||
    messages.error ||
    sharedSpaces.error ||
    profile.error ||
    updateCheckError;

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmittingAuth(true);
    setAuthError('');
    setAuthNotice('');

    try {
      if (authMode === 'login') {
        await session.login(loginForm);
      } else {
        const emailName = registerForm.email.split('@')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'user';
        const username = `${emailName.slice(0, 18)}${Date.now().toString(36).slice(-6)}`;
        await session.register({
          ...registerForm,
          username,
        });
      }
      resetToAlbums();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSendRegisterCode = async () => {
    const email = normalizeEmailInput(registerForm.email);

    const validationError = validateEmailInput(email);

    if (validationError) {
      setAuthError(validationError);
      return;
    }

    setRegisterForm((current) => ({
      ...current,
      email,
    }));

    setIsSendingEmailCode(true);
    setAuthError('');
    setAuthNotice('');

    try {
      await session.sendEmailCode({ email });
      setEmailCodeCountdown(60);
      setAuthNotice('验证码已发送，请查看邮箱。');
    } catch (error) {
      setAuthError(getErrorMessage(error));
    } finally {
      setIsSendingEmailCode(false);
    }
  };

  const handleSignOut = () => {
    session.logout();
    resetToAlbums();
  };

  const handleStartSharedAlbumWithContact = useCallback(
    async (contact: Contact) => {
      const createdSpace = await sharedSpaces.createSpace({
        title: `与 ${contact.name} 的共享相册`,
        description: `和 ${contact.name} 一起整理共同回忆`,
      });

      if (!createdSpace?.id) {
        throw new Error('创建共享相册失败，请稍后重试');
      }

      await sharedSpaces.inviteToSpace(createdSpace.id, contact.id);
      await sharedSpaces.refresh();
      navigateToTab('spaces');
    },
    [navigateToTab, sharedSpaces],
  );

  const isLoadingInitialSession = session.isAuthenticated && session.isLoading && !session.currentUser;

  return (
    <AppDialogProvider>
    <div className="min-h-screen bg-background text-on-background selection:bg-secondary-container selection:text-on-secondary-container relative">
      {appError && (
        <div className="fixed top-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full bg-red-50 px-4 py-2 text-center text-xs font-semibold text-red-700 shadow-lg border border-red-100">
          {appError}
        </div>
      )}

      <AnimatePresence mode="wait">
        {!session.isAuthenticated ? (
          <motion.div
            key="authscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-y-auto bg-[#1d2835] px-4 py-4 text-[#060816] sm:py-6"
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-60"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#496f88]/55 via-[#263547]/70 to-[#101322]/90" />

            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 170, damping: 20 }}
              className="relative z-10 w-full max-w-[25rem] rounded-[2rem] border border-white/70 bg-white/95 px-6 py-6 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#88503a] text-white shadow-lg">
                  <FolderHeart className="h-5 w-5 fill-current" />
                </div>
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.35em] text-[#8b93a3]">SHIYI</p>
                  <p className="text-sm font-bold text-[#88503a]">拾忆相册</p>
                </div>
              </div>

              <div className="mt-5">
                <h2 className="text-3xl font-black tracking-tight">
                  {authMode === 'login' ? '欢迎回来' : '创建账号'}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-relaxed text-[#7e8796]">
                  {authMode === 'login'
                    ? '登录后可以同步你的相册、好友和共享空间。'
                    : '注册后即可上传照片视频、保存回忆并同步到云端。'}
                </p>
              </div>

              <div className="mt-5 grid h-16 grid-cols-2 rounded-[1.4rem] bg-[#eef2f7] p-1.5">
                {(['login', 'register'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setAuthError('');
                      setAuthNotice('');
                      setAuthMode(mode);
                    }}
                    className={`flex h-full items-center justify-center rounded-[1.1rem] text-sm font-bold transition-all ${
                      authMode === mode
                        ? 'bg-white text-[#060816] shadow-md'
                        : 'text-[#788292]'
                    }`}
                  >
                    {mode === 'login' ? '登录' : '注册'}
                  </button>
                ))}
              </div>

              <form onSubmit={handleAuthSubmit} className="mt-5 space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#8a93a3]">邮箱</span>
                  <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#e2e6ee] bg-[#f8fafc] px-4 py-3">
                    <Mail className="h-5 w-5 text-[#9aa3b2]" />
                    <input
                      type="email"
                      required
                      placeholder="请输入邮箱"
                      value={authMode === 'login' ? loginForm.email : registerForm.email}
                      onChange={(event) => {
                        if (authMode === 'login') {
                          setLoginForm({ ...loginForm, email: event.target.value });
                        } else {
                          setRegisterForm({ ...registerForm, email: event.target.value });
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] placeholder:text-[#a8afbb] focus:outline-none"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#8a93a3]">密码</span>
                  <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#e2e6ee] bg-[#f8fafc] px-4 py-3">
                    <Lock className="h-5 w-5 text-[#9aa3b2]" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="请输入密码"
                      value={authMode === 'login' ? loginForm.password : registerForm.password}
                      onChange={(event) => {
                        if (authMode === 'login') {
                          setLoginForm({ ...loginForm, password: event.target.value });
                        } else {
                          setRegisterForm({ ...registerForm, password: event.target.value });
                        }
                      }}
                      className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] placeholder:text-[#a8afbb] focus:outline-none"
                    />
                  </div>
                </label>

                {authMode === 'register' && (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-[#8a93a3]">昵称</span>
                      <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#e2e6ee] bg-[#f8fafc] px-4 py-3">
                        <User className="h-5 w-5 text-[#9aa3b2]" />
                        <input
                          type="text"
                          required
                          placeholder="请输入昵称"
                          value={registerForm.displayName}
                          onChange={(event) => {
                            const displayName = event.target.value;
                            setRegisterForm({
                              ...registerForm,
                              displayName,
                              username:
                                registerForm.username || displayName.replace(/\s+/g, '').slice(0, 24),
                            });
                          }}
                          className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] placeholder:text-[#a8afbb] focus:outline-none"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-1.5 block text-xs font-bold text-[#8a93a3]">邮箱验证码</span>
                      <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
                        <div className="flex items-center gap-3 rounded-[1.35rem] border border-[#e2e6ee] bg-[#f8fafc] px-4 py-3">
                          <ShieldCheck className="h-5 w-5 text-[#9aa3b2]" />
                          <input
                            type="text"
                            required
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="6位验证码"
                            value={registerForm.verificationCode}
                            onChange={(event) =>
                              setRegisterForm({
                                ...registerForm,
                                verificationCode: event.target.value.replace(/\D/g, '').slice(0, 6),
                              })
                            }
                            className="min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] placeholder:text-[#a8afbb] focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSendRegisterCode}
                          disabled={isSendingEmailCode || emailCodeCountdown > 0}
                          className="rounded-[1.35rem] bg-[#060816] px-3 text-sm font-bold text-white shadow-lg disabled:opacity-55 whitespace-nowrap"
                        >
                          {emailCodeCountdown > 0
                            ? `${emailCodeCountdown}s`
                            : isSendingEmailCode
                              ? '发送中'
                              : '发送验证码'}
                        </button>
                      </div>
                    </label>
                  </>
                )}

                {authNotice && (
                  <p className="rounded-2xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                    {authNotice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-[1.45rem] bg-[#060816] py-3.5 text-base font-black text-white shadow-xl transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {authMode === 'login' ? (
                    '登录'
                  ) : (
                    <>
                      <UserPlus className="h-5 w-5" />
                      注册
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="appframe"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full min-h-screen relative"
          >
            {isLoadingInitialSession ? (
              <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-on-surface-variant">
                正在加载你的相册...
              </div>
            ) : (
              <main className="w-full">
                {activeTab === 'albums' && (
                  <AlbumsTab
                    albums={albums.albums}
                    currentUserAvatarUrl={currentUserAvatarUrl}
                    onCreateAlbum={albums.createAlbum}
                    onDeletePhoto={async (photoId) => {
                      await albums.deletePhoto(photoId);
                      await trash.refresh();
                      await profile.load();
                    }}
                    onUpdatePhotoFavorite={albums.updatePhotoFavorite}
                    onUploadPhotos={albums.uploadPhotos}
                    onOpenProfile={() => navigateToTab('profile')}
                  />
                )}
                {activeTab === 'cleanup' && (
                  <CleanupTab
                    deletedPhotos={trash.deletedPhotos}
                    currentUserAvatarUrl={currentUserAvatarUrl}
                    onRestorePhoto={trash.restore}
                    onDeletePhoto={trash.permanentlyDelete}
                    onEmptyBin={trash.emptyBin}
                    onBackToAlbums={() => navigateToTab('albums')}
                  />
                )}
                {activeTab === 'spaces' && (
                  <SharedSpacesTab
                    sharedSpaces={sharedSpaces.sharedSpaces}
                    contacts={friends.contacts}
                    spacePhotos={sharedSpaces.spacePhotos}
                    currentUserId={session.currentUser?.id ?? ''}
                    currentUserAvatarUrl={currentUserAvatarUrl}
                    onCreateSpace={sharedSpaces.createSpace}
                    onInviteToSpace={sharedSpaces.inviteToSpace}
                    onRenameSpace={sharedSpaces.renameSpace}
                    onUploadPhotosToSpace={sharedSpaces.uploadPhotosToSpace}
                    onDeletePhotoFromSpace={sharedSpaces.deletePhotoFromSpace}
                    onOpenProfile={() => navigateToTab('profile')}
                  />
                )}
                {activeTab === 'contacts' && (
                  <ContactsTab
                    contacts={friends.contacts}
                    invitations={friends.invitations}
                    currentUserId={session.currentUser?.id ?? ''}
                    currentUserAvatarUrl={currentUserAvatarUrl}
                    onSendInvitation={friends.sendInvitation}
                    onAcceptInvitation={friends.acceptInvitation}
                    onRejectInvitation={friends.rejectInvitation}
                    onStartSharedAlbum={handleStartSharedAlbumWithContact}
                    messagesByContactId={messages.conversations}
                    isLoadingMessages={messages.isLoading}
                    onLoadMessages={messages.loadConversation}
                    onSendMessage={messages.sendMessage}
                    onOpenProfile={() => navigateToTab('profile')}
                  />
                )}
                {activeTab === 'profile' && profile.userProfile && (
                  <ProfileTab
                    userProfile={profile.userProfile}
                    currentAppVersionCode={CURRENT_APP_VERSION.versionCode}
                    currentAppVersionName={CURRENT_APP_VERSION.versionName}
                    latestUpdateManifest={latestUpdateManifest}
                    isCheckingUpdate={isCheckingUpdate}
                    updateCheckMessage={updateCheckMessage}
                    onCheckForUpdate={() => handleCheckForUpdate()}
                    onUpdateUserProfile={profile.updateProfile}
                    onSendAssistantMessage={handleSendAssistantMessage}
                    onSignOut={handleSignOut}
                  />
                )}
              </main>
            )}

            <div className="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-t from-background via-background/90 to-transparent pt-10 pb-6 px-6 pointer-events-none">
              <div className="max-w-md mx-auto pointer-events-auto">
                <nav className="glass-nav rounded-full h-15.5 flex items-center justify-around px-3 py-1 bg-[#fff8f5]/85 shadow-lg max-w-full">
                  {[
                    { id: 'albums', title: '相册', icon: ImageIcon },
                    { id: 'cleanup', title: '清理', icon: Sparkles },
                    { id: 'spaces', title: '共享', icon: Clock },
                    { id: 'contacts', title: '好友', icon: Users },
                    { id: 'profile', title: '个人', icon: User },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateToTab(item.id as AppTab)}
                        className={`relative p-3 rounded-full flex flex-col items-center justify-center transition-all cursor-pointer ${
                          isActive
                            ? 'text-[#88503a]'
                            : 'text-on-surface-variant/75 hover:text-on-surface'
                        }`}
                        type="button"
                        title={item.title}
                        id={`tab-${item.id}`}
                      >
                        <AnimatePresence>
                          {isActive && (
                            <motion.div
                              layoutId="navGlowCircle"
                              className="absolute inset-0 bg-[#ffb599]/25 rounded-full"
                              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                            />
                          )}
                        </AnimatePresence>
                        <Icon className="w-5.5 h-5.5 relative z-10" />
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVersionCardVisible && latestUpdateManifest && !isUpdateDismissed && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/55 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-sm rounded-3xl border border-white/60 bg-[#fff8f5] p-6 text-[#1e1b18] shadow-2xl"
            >
              <div className="mb-4 inline-flex rounded-full bg-[#ffb599]/30 px-3 py-1 text-[11px] font-bold text-[#7a442f]">
                当前版本 {CURRENT_APP_VERSION.versionName}
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight">
                {availableUpdate ? '发现新版本' : '已是最新版本'}
              </h2>
              <p className="mt-2 text-sm font-medium text-on-surface-variant">
                {availableUpdate
                  ? `新版 ${availableUpdate.versionName} 已发布，可以从公网服务器下载安装包。`
                  : `当前已安装 ${CURRENT_APP_VERSION.versionName}，公网版本也是 ${latestUpdateManifest.versionName}。`}
              </p>

              <div className="mt-5 rounded-2xl bg-white/75 p-4">
                <h3 className="text-sm font-bold text-on-surface">
                  {availableUpdate ? '更新内容' : '版本状态'}
                </h3>
                <ul className="mt-2 space-y-1.5 text-xs text-on-surface-variant">
                  {availableUpdate ? (
                    availableUpdate.releaseNotes.map((note) => <li key={note}>• {note}</li>)
                  ) : (
                    <>
                      <li>• 当前版本：{CURRENT_APP_VERSION.versionName}</li>
                      <li>• 公网版本：{latestUpdateManifest.versionName}</li>
                      <li>• 状态：已经是最新安装包</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    dismissUpdateCard();
                  }}
                  className="flex-1 rounded-full border border-surface-container-highest px-4 py-3 text-xs font-bold text-on-surface-variant"
                >
                  {availableUpdate ? '暂不更新' : '我知道了'}
                </button>
                {availableUpdate && (
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = availableUpdate.apkUrl;
                    }}
                    className="flex-1 rounded-full bg-[#88503a] px-4 py-3 text-xs font-bold text-white shadow-sm"
                  >
                    立即下载
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </AppDialogProvider>
  );
}
