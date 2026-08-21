/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, User, Shield, HelpCircle, ChevronRight, Edit2, DownloadCloud, LogOut, CheckCircle, Database, EyeOff, MapPin, Sliders, MessageSquare, Send, UploadCloud, Copy } from 'lucide-react';
import type { UpdateManifest } from '../lib/app-update';
import { validateAvatarFile } from '../lib/upload-validation';
import { UserProfile } from '../types';
import { useAppDialog } from './AppDialog';

interface ProfileTabProps {
  userProfile: UserProfile;
  currentAppVersionCode: number;
  currentAppVersionName: string;
  latestUpdateManifest: UpdateManifest | null;
  isCheckingUpdate: boolean;
  updateCheckMessage: string;
  onCheckForUpdate: () => Promise<void>;
  onUpdateUserProfile: (input: {
    displayName?: string;
    avatarUrl?: string | null;
    avatarFile?: File | null;
    bio?: string | null;
    privateAlbumsOnly?: boolean;
    activityStatusActive?: boolean;
    locationTaggingActive?: boolean;
  }) => Promise<void>;
  onSendAssistantMessage: (message: string) => Promise<string>;
  onSignOut: () => void;
}

export default function ProfileTab({
  userProfile,
  currentAppVersionCode,
  currentAppVersionName,
  latestUpdateManifest,
  isCheckingUpdate,
  updateCheckMessage,
  onCheckForUpdate,
  onUpdateUserProfile,
  onSendAssistantMessage,
  onSignOut,
}: ProfileTabProps) {
  const dialog = useAppDialog();
  const [activeAccordion, setActiveAccordion] = useState<string | null>(null);
  
  const [localPreferences, setLocalPreferences] = useState({
    privateAlbumsOnly: userProfile.privateAlbumsOnly,
    activityStatusActive: userProfile.activityStatusActive,
    locationTaggingActive: userProfile.locationTaggingActive,
  });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  
  // Custom dialogs
  const [exportProgress, setExportProgress] = useState(-1); // -1 = not running, 100 = completed
  const [exportStepText, setExportStepText] = useState('');
  const [idCopyText, setIdCopyText] = useState('复制');
  
  // Edit Profile Mode state
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState(userProfile.name);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreviewUrl, setEditAvatarPreviewUrl] = useState(userProfile.avatarUrl);
  const [editBio, setEditBio] = useState(userProfile.bio ?? '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrorMessage, setProfileErrorMessage] = useState('');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const avatarObjectUrlRef = useRef<string | null>(null);

  // Chat simulator
  const [chatMessage, setChatMessage] = useState('');
  const [isAssistantReplying, setIsAssistantReplying] = useState(false);
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: '你好，我是拾忆相册助手。你可以问我相册、清理、共享、好友、账号和版本更新问题。' }
  ]);

  const handleAccordionToggle = (key: string) => {
    setActiveAccordion(activeAccordion === key ? null : key);
  };

  const resetEditProfileForm = useCallback(() => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
      avatarObjectUrlRef.current = null;
    }

    setEditName(userProfile.name);
    setEditBio(userProfile.bio ?? '');
    setEditAvatarPreviewUrl(userProfile.avatarUrl);
    setEditAvatarFile(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  }, [userProfile.avatarUrl, userProfile.bio, userProfile.name]);

  useEffect(() => {
    resetEditProfileForm();
  }, [resetEditProfileForm]);

  useEffect(() => {
    setLocalPreferences({
      privateAlbumsOnly: userProfile.privateAlbumsOnly,
      activityStatusActive: userProfile.activityStatusActive,
      locationTaggingActive: userProfile.locationTaggingActive,
    });
  }, [
    userProfile.activityStatusActive,
    userProfile.locationTaggingActive,
    userProfile.privateAlbumsOnly,
  ]);

  useEffect(() => () => {
    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }
  }, []);

  const handleCloseEditProfile = useCallback(() => {
    setProfileErrorMessage('');
    resetEditProfileForm();
    setIsEditProfileOpen(false);
  }, [resetEditProfileForm]);

  const closeExportOverlay = useCallback(() => {
    setExportProgress(-1);
  }, []);

  const handleLocalBack = useCallback(() => {
    if (exportProgress >= 0) {
      closeExportOverlay();
      return true;
    }

    if (isEditProfileOpen) {
      handleCloseEditProfile();
      return true;
    }

    if (activeAccordion) {
      setActiveAccordion(null);
      return true;
    }

    return false;
  }, [
    activeAccordion,
    closeExportOverlay,
    exportProgress,
    handleCloseEditProfile,
    isEditProfileOpen,
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

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateAvatarFile(file);
    if (validationError) {
      setProfileErrorMessage(validationError);
      e.target.value = '';
      return;
    }

    if (avatarObjectUrlRef.current) {
      URL.revokeObjectURL(avatarObjectUrlRef.current);
    }

    const previewUrl = URL.createObjectURL(file);
    avatarObjectUrlRef.current = previewUrl;
    setEditAvatarFile(file);
    setEditAvatarPreviewUrl(previewUrl);
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await onUpdateUserProfile({
        displayName: editName.trim(),
        avatarFile: editAvatarFile,
        bio: editBio.trim() || null,
      });
      setIsEditProfileOpen(false);
    } catch (error) {
      setProfileErrorMessage(error instanceof Error ? error.message : '保存个人资料失败');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleStartExport = () => {
    setExportProgress(5);
    setExportStepText('正在压缩高清照片...');
    
    const steps = [
      { progress: 20, text: '正在整理照片元数据...' },
      { progress: 50, text: '正在汇总相册记录...' },
      { progress: 85, text: '正在打包离线相册文件...' },
      { progress: 100, text: '导出完成，可以保存到本地。' }
    ];

    let currentStepIdx = 0;
    const proc = setInterval(() => {
      if (currentStepIdx < steps.length) {
        setExportProgress(steps[currentStepIdx].progress);
        setExportStepText(steps[currentStepIdx].text);
        currentStepIdx++;
      } else {
        clearInterval(proc);
      }
    }, 1200);
  };

  const personalId = userProfile.personalId || userProfile.id || userProfile.username || '未生成';

  const handleCopyPersonalId = async () => {
    if (!personalId || personalId === '未生成') return;

    try {
      await navigator.clipboard.writeText(personalId);
      setIdCopyText('已复制');
    } catch {
      setIdCopyText('复制失败');
    }

    window.setTimeout(() => setIdCopyText('复制'), 1600);
  };

  const handlePreferenceChange = async (
    key: 'privateAlbumsOnly' | 'activityStatusActive' | 'locationTaggingActive',
    value: boolean,
  ) => {
    const previousPreferences = localPreferences;
    const nextPreferences = {
      ...localPreferences,
      [key]: value,
    };

    setLocalPreferences(nextPreferences);
    setIsSavingPreferences(true);
    try {
      await onUpdateUserProfile({ [key]: value });
    } catch (error) {
      setLocalPreferences(previousPreferences);
      await dialog.alert(error instanceof Error ? error.message : '保存隐私设置失败');
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = chatMessage.trim();
    if (!message || isAssistantReplying) return;

    const newLog = [...chatLog, { sender: 'user', text: message } as const];
    setChatLog(newLog);
    setChatMessage('');
    setIsAssistantReplying(true);

    try {
      const reply = await onSendAssistantMessage(message);
      setChatLog([...newLog, { sender: 'bot', text: reply }]);
    } catch (error) {
      setChatLog([
        ...newLog,
        {
          sender: 'bot',
          text: error instanceof Error ? error.message : '助手暂时不可用，请稍后再试',
        },
      ]);
    } finally {
      setIsAssistantReplying(false);
    }
  };

  return (
    <div className="w-full pb-36">
      {/* Scrollable container setup matching mock page */}
      <div className="flex flex-col items-center px-6 pb-0 pt-[calc(3rem+env(safe-area-inset-top))] text-center">
        {/* Rounded Profile Avatar with Edit Symbol as seen in Image 1 */}
        <div className="relative mb-6">
          <div className="w-32 h-32 rounded-full overflow-hidden p-1.5 bg-[#ffb599]/30 ring-4 ring-[#ffeae2] shadow-sm">
            <img 
              src={userProfile.avatarUrl} 
              alt={userProfile.name} 
              className="w-full h-full rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <button 
            onClick={() => setIsEditProfileOpen(true)}
            className="absolute bottom-1 right-2 p-2 bg-[#88503a] hover:bg-[#7a442f] text-white rounded-full transition-transform active:scale-95 shadow-md cursor-pointer"
            title="编辑个人资料"
            id="edit-profile-btn"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Credentials and Bio */}
        <h2 className="text-3xl font-extrabold tracking-tight text-on-surface">{userProfile.name}</h2>
        <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-full bg-white/80 px-3.5 py-2 text-xs font-bold text-on-surface-variant shadow-xs border border-surface-container">
          <span className="truncate">个人ID：{personalId}</span>
          <button
            type="button"
            onClick={handleCopyPersonalId}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ffb599]/30 px-2 py-1 text-[10px] font-bold text-[#88503a]"
            disabled={personalId === '未生成'}
          >
            <Copy className="w-3 h-3" />
            {idCopyText}
          </button>
        </div>

        {/* Stats Column cards side by side */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8">
          <div className="bg-white border border-surface-container rounded-2xl p-5 shadow-xs">
            <span className="block text-3xl font-extrabold text-on-surface">{userProfile.memoriesCount}</span>
            <span className="text-xs text-on-surface-variant font-semibold uppercase mt-1 block tracking-wider">回忆</span>
          </div>

          <div className="bg-white border border-surface-container rounded-2xl p-5 shadow-xs">
            <span className="block text-3xl font-extrabold text-on-surface">{userProfile.collectionsCount}</span>
            <span className="text-xs text-on-surface-variant font-semibold uppercase mt-1 block tracking-wider">相册</span>
          </div>
        </div>
      </div>

      {/* Settings list structure as depicted in Image 1 */}
      <div className="px-5 mt-10 max-w-md mx-auto" id="settings-group">
        <span className="text-[10px] font-mono tracking-widest text-outline uppercase block mb-3.5 px-1.5">
          设置
        </span>

        <div className="space-y-3">
          {/* Storage Row Accordion */}
          <div className="bg-white rounded-xl border border-surface-container shadow-xs overflow-hidden">
            <button
              onClick={() => handleAccordionToggle('storage')}
              className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-surface-low/30 cursor-pointer text-left"
              type="button"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-[#88503a]">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">存储空间</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    已使用 {userProfile.storageUsedGB} 吉字节 / {userProfile.storageTotalGB} 吉字节
                  </p>
                </div>
              </div>
              <ChevronRight className={`w-4.5 h-4.5 text-outline/60 transition-transform ${activeAccordion === 'storage' ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {activeAccordion === 'storage' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-surface-container/60 bg-surface-low/20"
                >
                  <div className="p-4 space-y-4">
                    {/* Progress Bar styled in orange theme */}
                    <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-[#88503a] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${(userProfile.storageUsedGB / userProfile.storageTotalGB) * 100}%` }}
                      />
                    </div>

                    <div className="text-xs text-on-surface-variant space-y-2">
                      <div className="flex justify-between font-mono">
                        <span>照片与视频：</span>
                        <span className="font-bold text-on-surface">{userProfile.storageUsedGB} 吉字节</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>照片数量：</span>
                        <span className="font-bold text-on-surface">{userProfile.memoriesCount}</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span>相册数量：</span>
                        <span className="font-bold text-on-surface">{userProfile.collectionsCount}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        void dialog.alert('云存储升级暂未开放，当前统计已接入真实云端数据。');
                      }}
                      className="w-full py-2.5 bg-secondary text-white hover:bg-secondary/95 text-xs font-bold rounded-lg transition-transform active:scale-[0.98] cursor-pointer"
                    >
                      升级云存储（暂未开放）
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Account Row Accordion */}
          <div className="bg-white rounded-xl border border-surface-container shadow-xs overflow-hidden">
            <button
              onClick={() => handleAccordionToggle('account')}
              className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-surface-low/30 cursor-pointer text-left"
              type="button"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">账号</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">管理资料和登录信息</p>
                </div>
              </div>
              <ChevronRight className={`w-4.5 h-4.5 text-outline/60 transition-transform ${activeAccordion === 'account' ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {activeAccordion === 'account' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-surface-container/60 bg-surface-low/20"
                >
                  <div className="p-4 space-y-3.5">
                    <div className="text-xs font-medium space-y-1.5">
                      <span className="block text-outline font-mono">登录邮箱</span>
                      <p className="text-on-surface text-sm font-bold truncate">{userProfile.email ?? '未加载邮箱'}</p>
                    </div>
                    <div className="text-xs font-medium space-y-1.5">
                      <span className="block text-outline font-mono">用户编号</span>
                      <p className="text-on-surface font-mono">{userProfile.id ?? userProfile.username ?? '原型用户'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditProfileOpen(true)}
                      className="w-full py-2 bg-surface-container hover:bg-surface-container-high transition-colors text-on-surface-variant text-xs font-semibold rounded-lg"
                    >
                      编辑个人简介
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Privacy Toggle Accordion */}
          <div className="bg-white rounded-xl border border-surface-container shadow-xs overflow-hidden">
            <button
              onClick={() => handleAccordionToggle('privacy')}
              className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-surface-low/30 cursor-pointer text-left"
              type="button"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">隐私</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">控制共享和位置权限</p>
                </div>
              </div>
              <ChevronRight className={`w-4.5 h-4.5 text-outline/60 transition-transform ${activeAccordion === 'privacy' ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {activeAccordion === 'privacy' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-surface-container/60 bg-surface-low/20"
                >
                  <div className="p-4 space-y-4">
                    {/* Privacy toggle row 1 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-4 h-4 text-outline" />
                        <div>
                          <span className="text-xs font-bold text-on-surface block">仅私人相册</span>
                          <span className="text-[10px] text-on-surface-variant block">新建相册默认保持私密</span>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={localPreferences.privateAlbumsOnly} 
                        onChange={(e) => void handlePreferenceChange('privateAlbumsOnly', e.target.checked)}
                        disabled={isSavingPreferences}
                        className="w-4.5 h-4.5 accent-secondary cursor-pointer disabled:opacity-60"
                      />
                    </div>

                    {/* Privacy toggle row 2 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-outline" />
                        <div>
                          <span className="text-xs font-bold text-on-surface block">活跃状态</span>
                          <span className="text-[10px] text-on-surface-variant block">在共享空间中显示在线状态</span>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={localPreferences.activityStatusActive} 
                        onChange={(e) => void handlePreferenceChange('activityStatusActive', e.target.checked)}
                        disabled={isSavingPreferences}
                        className="w-4.5 h-4.5 accent-secondary cursor-pointer disabled:opacity-60"
                      />
                    </div>

                    {/* Privacy toggle row 3 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-outline" />
                        <div>
                          <span className="text-xs font-bold text-on-surface block">位置标签</span>
                          <span className="text-[10px] text-on-surface-variant block">保存照片中的地点信息</span>
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={localPreferences.locationTaggingActive} 
                        onChange={(e) => void handlePreferenceChange('locationTaggingActive', e.target.checked)}
                        disabled={isSavingPreferences}
                        className="w-4.5 h-4.5 accent-secondary cursor-pointer disabled:opacity-60"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="bg-white rounded-xl border border-surface-container shadow-xs overflow-hidden">
            <button
              onClick={() => {
                void onCheckForUpdate();
              }}
              className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-surface-low/30 disabled:opacity-70 cursor-pointer text-left"
              type="button"
              disabled={isCheckingUpdate}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-[#ffb599]/25 flex items-center justify-center text-[#88503a]">
                  <DownloadCloud className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">版本更新</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    当前 {currentAppVersionName}（{currentAppVersionCode}）·{' '}
                    公网{' '}
                    {latestUpdateManifest
                      ? `${latestUpdateManifest.versionName}（${latestUpdateManifest.versionCode}）`
                      : '未获取'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4.5 h-4.5 text-outline/60" />
            </button>

            {(isCheckingUpdate || updateCheckMessage) && (
              <div className="border-t border-surface-container/60 bg-surface-low/20 px-4 py-3 text-xs font-semibold text-on-surface-variant">
                {isCheckingUpdate ? '正在检查公网新版本...' : updateCheckMessage}
              </div>
            )}
          </div>

          {/* Help & Support Accordion with Quick Chat interface */}
          <div className="bg-white rounded-xl border border-surface-container shadow-xs overflow-hidden">
            <button
              onClick={() => handleAccordionToggle('help')}
              className="w-full flex items-center justify-between p-4 bg-transparent hover:bg-surface-low/30 cursor-pointer text-left"
              type="button"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-on-surface text-sm">帮助与支持</h4>
                  <p className="text-xs text-on-surface-variant mt-0.5">常见问题与互动助手</p>
                </div>
              </div>
              <ChevronRight className={`w-4.5 h-4.5 text-outline/60 transition-transform ${activeAccordion === 'help' ? 'rotate-90' : ''}`} />
            </button>

            <AnimatePresence>
              {activeAccordion === 'help' && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden border-t border-surface-container/60 bg-surface-low/20"
                >
                  <div className="p-4 space-y-4">
                    <div className="h-44 overflow-y-auto bg-surface-container rounded-lg p-3 space-y-2.5 text-xs text-left" id="chatbot-window">
                      {chatLog.map((chat, idx) => (
                        <div key={idx} className={`flex ${chat.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`p-2.5 rounded-lg max-w-[85%] ${
                            chat.sender === 'user' 
                              ? 'bg-[#88503a] text-white rounded-tr-none' 
                              : 'bg-white text-on-surface border border-surface-container-high rounded-tl-none'
                          }`}>
                            {chat.text}
                          </div>
                        </div>
                      ))}
                      {isAssistantReplying && (
                        <div className="flex justify-start">
                          <div className="max-w-[85%] rounded-lg rounded-tl-none border border-surface-container-high bg-white p-2.5 text-on-surface">
                            助手正在思考...
                          </div>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleSendChatMessage} className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="例如：怎么导出照片？"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        disabled={isAssistantReplying}
                        className="flex-1 px-3 py-2 text-xs bg-white text-on-surface rounded-lg border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50"
                      />
                      <button 
                        type="submit" 
                        disabled={isAssistantReplying || !chatMessage.trim()}
                        className="p-2 bg-secondary text-white hover:bg-secondary/90 rounded-lg cursor-pointer disabled:opacity-50"
                        title="发送消息"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Dynamic primary Action buttons as styled in Image 1 */}
        <div className="mt-12 space-y-3">
          <button
            onClick={handleStartExport}
            className="w-full flex items-center justify-center p-4 bg-[#ffb599] hover:bg-[#ffaa8a] text-[#56220f] font-extrabold text-sm rounded-full transition-transform active:scale-[0.98] cursor-pointer ambient-shadow"
            type="button"
          >
            导出相册库
          </button>
          
          <button
            onClick={onSignOut}
            className="w-full flex items-center justify-center p-4 border border-surface-container-highest hover:bg-surface-container text-on-surface font-semibold text-sm rounded-full transition-transform active:scale-[0.98] cursor-pointer"
            type="button"
          >
            退出登录
          </button>
        </div>
      </div>

      {/* Edit Profile Details Modal form pop */}
      <AnimatePresence>
        {isEditProfileOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-container"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-bold text-lg text-on-surface">编辑个人资料</h3>
                <button 
                  type="button"
                  onClick={handleCloseEditProfile}
                  className="p-1 hover:bg-surface-container rounded-full"
                >
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </button>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">昵称</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-container-lowest text-on-surface rounded-xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-2">头像</label>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-surface-container ring-2 ring-[#ffeae2]">
                      <img
                        src={editAvatarPreviewUrl}
                        alt="当前头像预览"
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1">
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface-container-lowest hover:bg-surface-container text-on-surface rounded-xl border border-surface-container text-sm font-semibold transition-colors cursor-pointer"
                      >
                        <UploadCloud className="w-4 h-4" />
                        选择本地头像
                      </button>
                      <p className="mt-1.5 text-[11px] text-on-surface-variant">支持图片文件，最大 3 MB。</p>
                    </div>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">简介</label>
                  <input
                    type="text"
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    className="w-full px-4 py-2 bg-surface-container-lowest text-on-surface rounded-xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>

                <div className="pt-4 border-t border-surface-container-high flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCloseEditProfile}
                    className="px-4 py-2 hover:bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="px-5 py-2 bg-[#88503a] text-white hover:bg-[#7a442f] rounded-full text-xs font-bold cursor-pointer"
                  >
                    {isSavingProfile ? '保存中...' : '保存资料'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profileErrorMessage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 10 }}
              className="w-full max-w-xs rounded-[1.75rem] bg-white p-5 text-left shadow-2xl"
            >
              <h4 className="text-base font-black text-[#1b1715]">提示</h4>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-[#4f4640]">
                {profileErrorMessage}
              </p>
              <button
                type="button"
                onClick={() => setProfileErrorMessage('')}
                className="mt-5 w-full rounded-full bg-[#88503a] px-4 py-3 text-sm font-bold text-white shadow-lg active:scale-[0.98]"
              >
                知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Export progression screen overlay */}
      <AnimatePresence>
        {exportProgress >= 0 && (
          <div className="fixed inset-0 z-50 bg-[#fff8f5] flex flex-col items-center justify-center p-6 text-center">
            {exportProgress < 100 ? (
              <div className="max-w-md w-full space-y-6">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ffb599] border-t-transparent mx-auto" />
                <div className="space-y-1.5">
                  <h3 className="text-xl font-bold text-on-surface">正在生成离线相册包</h3>
                  <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                    请保持此页面打开，系统正在模拟打包照片、元数据和共享记录。
                  </p>
                </div>

                {/* Status percentage */}
                <div className="space-y-2">
                  <div className="w-full bg-surface-container h-2 rounded-full overflow-hidden">
                    <div className="bg-[#88503a] h-full transition-all duration-300" style={{ width: `${exportProgress}%` }} />
                  </div>
                  <div className="flex justify-between text-[11px] text-on-surface-variant font-medium font-mono">
                    <span>{exportStepText}</span>
                    <span className="font-bold">{exportProgress}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <motion.div 
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="max-w-sm w-full space-y-6"
              >
                <div className="w-16 h-16 bg-[#e4fcf1] border border-green-200 text-green-700 rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle className="w-9 h-9" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-on-surface">离线相册包已就绪！</h3>
                  <p className="text-sm text-on-surface-variant px-4">
                    已模拟打包 42 个相册和 2.4k 张高清照片，可用于原型演示。
                  </p>
                </div>

                <div className="pt-6 space-y-2">
                  <button
                    onClick={() => {
                      void dialog.alert('已模拟开始下载离线相册压缩包（6.4 吉字节）。');
                      closeExportOverlay();
                    }}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-[#88503a] text-white hover:bg-[#7a442f] text-sm font-bold rounded-full transition-transform active:scale-95 shadow-sm cursor-pointer"
                  >
                    <DownloadCloud className="w-4 h-4" />
                    下载离线包（6.4 吉字节）
                  </button>
                  <button
                    onClick={closeExportOverlay}
                    className="w-full py-3.5 hover:bg-surface-container text-[#88503a] text-xs font-semibold rounded-full transition-colors"
                  >
                    返回设置
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
