/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, UploadCloud, CheckCircle2, UserPlus, Image as ImageIcon, X, Pencil, Download, Trash2 } from 'lucide-react';
import { CachedImage, CachedVideo } from './CachedMedia';
import { getSelectionOrder } from '../lib/album-display';
import { prefetchMediaAsset } from '../lib/media-cache';
import { getNextPhotoAfterDelete, getSwipeDirection, getWrappedPhotoIndex } from '../lib/photo-navigation';
import { getPhotoDetailMeta, getPhotoDetailTitle } from '../lib/photo-detail-display';
import {
  canDeleteSharedSpacePhoto,
  SHARED_SPACE_DELETE_OWN_MESSAGE,
} from '../lib/shared-space-permissions';
import { getSharedSpaceMemberAvatars } from '../lib/shared-space-avatars';
import { createContributorFilters, filterSharedPhotosByContributor } from '../lib/shared-space-contributors';
import { saveRemoteFileToDevice } from '../lib/native-download';
import { ApiSharedSpacePhoto, SharedSpace, Contact, UploadSharedSpacePhotosResult } from '../types';
import { useAppDialog } from './AppDialog';

interface SharedSpacesTabProps {
  sharedSpaces: SharedSpace[];
  contacts: Contact[];
  spacePhotos: Record<string, ApiSharedSpacePhoto[]>;
  currentUserId: string;
  currentUserAvatarUrl: string;
  onCreateSpace: (input: { title: string; description?: string }) => Promise<void>;
  onInviteToSpace: (spaceId: string, userId: string) => Promise<void>;
  onRenameSpace: (spaceId: string, input: { title: string; description?: string }) => Promise<void>;
  onUploadPhotosToSpace: (
    spaceId: string,
    files: File[],
  ) => Promise<UploadSharedSpacePhotosResult>;
  onDeletePhotoFromSpace: (spaceId: string, sharedPhotoId: string) => Promise<void>;
  onOpenProfile: () => void;
}

const toCacheableMedia = (
  photo?: {
    objectKey?: string | null;
    url?: string | null;
    mimeType?: string | null;
  } | null,
) =>
  photo?.url
    ? {
        objectKey: photo.objectKey,
        url: photo.url,
        mimeType: photo.mimeType,
      }
    : null;

export default function SharedSpacesTab({
  sharedSpaces,
  contacts,
  spacePhotos,
  currentUserId,
  currentUserAvatarUrl,
  onCreateSpace,
  onInviteToSpace,
  onRenameSpace,
  onUploadPhotosToSpace,
  onDeletePhotoFromSpace,
  onOpenProfile,
}: SharedSpacesTabProps) {
  const dialog = useAppDialog();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isNewSpaceOpen, setIsNewSpaceOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [invitedContactIds, setInvitedContactIds] = useState<string[]>([]);
  const [manualInviteUserId, setManualInviteUserId] = useState('');
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(sharedSpaces[0]?.id ?? null);
  const [isCreatingSpace, setIsCreatingSpace] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [isRenamingSpace, setIsRenamingSpace] = useState(false);
  
  // New Space Form State
  const [newSpaceTitle, setNewSpaceTitle] = useState('');
  const [newSpaceDescription, setNewSpaceDescription] = useState('');
  const [newSpaceCover, setNewSpaceCover] = useState('https://images.unsplash.com/photo-1472214222541-d510753a4907?w=800&q=80');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [renameTitle, setRenameTitle] = useState('');

  // Shared upload state
  const [selectedContributorId, setSelectedContributorId] = useState<'all' | string>('all');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeSharedPhotoId, setActiveSharedPhotoId] = useState<string | null>(null);
  const [sharedPhotoTransitionDirection, setSharedPhotoTransitionDirection] = useState(0);
  const [isDownloadingSharedPhoto, setIsDownloadingSharedPhoto] = useState(false);
  const [isSharedPhotoSelectMode, setIsSharedPhotoSelectMode] = useState(false);
  const [selectedSharedPhotoIds, setSelectedSharedPhotoIds] = useState<string[]>([]);
  const [isSharedPhotoDeleteConfirmOpen, setIsSharedPhotoDeleteConfirmOpen] = useState(false);
  const [isDeletingSharedPhotos, setIsDeletingSharedPhotos] = useState(false);
  const sharedPhotoLongPressTimerRef = useRef<number | null>(null);
  const didSharedPhotoLongPressRef = useRef(false);

  const activeSpace = sharedSpaces.find((space) => space.id === activeSpaceId) ?? sharedSpaces[0] ?? null;
  const activeApiPhotos = activeSpace ? spacePhotos[activeSpace.id] ?? [] : [];
  const contributorFilters = createContributorFilters(activeApiPhotos, currentUserId);
  const visibleSharedPhotos = filterSharedPhotosByContributor(activeApiPhotos, selectedContributorId);
  const activeSharedPhotoIndex = activeSharedPhotoId
    ? visibleSharedPhotos.findIndex((photo) => photo.id === activeSharedPhotoId)
    : -1;
  const activeSharedPhoto =
    activeSharedPhotoIndex >= 0 ? visibleSharedPhotos[activeSharedPhotoIndex] : null;

  useEffect(() => {
    if (activeSharedPhotoIndex < 0 || visibleSharedPhotos.length < 2) return;

    [0, -1, 1]
      .map((offset) => visibleSharedPhotos[getWrappedPhotoIndex(activeSharedPhotoIndex + offset, visibleSharedPhotos.length)])
      .filter(
        (sharedPhoto): sharedPhoto is ApiSharedSpacePhoto =>
          Boolean(sharedPhoto?.photo?.url),
      )
      .forEach((sharedPhoto) => {
        void prefetchMediaAsset({
          objectKey: sharedPhoto.photo?.objectKey,
          url: sharedPhoto.photo?.url ?? '',
          mimeType: sharedPhoto.photo?.mimeType,
        });
      });
  }, [activeSharedPhoto?.id, activeSharedPhotoIndex, visibleSharedPhotos]);

  const closeInviteDialog = useCallback(() => {
    setIsInviteOpen(false);
    setInvitedContactIds([]);
    setManualInviteUserId('');
  }, []);

  const closeNewSpaceDialog = useCallback(() => {
    setIsNewSpaceOpen(false);
  }, []);

  const closeRenameDialog = useCallback(() => {
    setIsRenameOpen(false);
    setRenameTitle('');
  }, []);

  const clearSharedPhotoLongPressTimer = useCallback(() => {
    if (sharedPhotoLongPressTimerRef.current) {
      window.clearTimeout(sharedPhotoLongPressTimerRef.current);
      sharedPhotoLongPressTimerRef.current = null;
    }
  }, []);

  const clearSharedPhotoSelection = useCallback(() => {
    clearSharedPhotoLongPressTimer();
    setIsSharedPhotoSelectMode(false);
    setSelectedSharedPhotoIds([]);
    setIsSharedPhotoDeleteConfirmOpen(false);
  }, [clearSharedPhotoLongPressTimer]);

  const handleLocalBack = useCallback(() => {
    if (errorMessage) {
      setErrorMessage('');
      return true;
    }

    if (isSharedPhotoDeleteConfirmOpen) {
      setIsSharedPhotoDeleteConfirmOpen(false);
      return true;
    }

    if (isSharedPhotoSelectMode) {
      clearSharedPhotoSelection();
      return true;
    }

    if (activeSharedPhotoId) {
      setActiveSharedPhotoId(null);
      return true;
    }

    if (isInviteOpen) {
      closeInviteDialog();
      return true;
    }

    if (isNewSpaceOpen) {
      closeNewSpaceDialog();
      return true;
    }

    if (isRenameOpen) {
      closeRenameDialog();
      return true;
    }

    if (isDetailOpen) {
      setIsDetailOpen(false);
      return true;
    }

    return false;
  }, [
    activeSharedPhotoId,
    clearSharedPhotoSelection,
    closeInviteDialog,
    closeNewSpaceDialog,
    closeRenameDialog,
    errorMessage,
    isDetailOpen,
    isInviteOpen,
    isNewSpaceOpen,
    isRenameOpen,
    isSharedPhotoDeleteConfirmOpen,
    isSharedPhotoSelectMode,
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

  useEffect(() => {
    if (!activeSpaceId && sharedSpaces[0]) {
      setActiveSpaceId(sharedSpaces[0].id);
    }
  }, [activeSpaceId, sharedSpaces]);

  useEffect(() => {
    setSelectedContributorId('all');
    setUploadStatusText('');
    setActiveSharedPhotoId(null);
    clearSharedPhotoSelection();
  }, [activeSpaceId, clearSharedPhotoSelection]);

  useEffect(() => {
    if (!uploadStatusText || isUploading) {
      return undefined;
    }

    const timer = window.setTimeout(() => setUploadStatusText(''), 5000);

    return () => window.clearTimeout(timer);
  }, [isUploading, uploadStatusText]);

  useEffect(() => {
    if (activeSharedPhotoId && activeSharedPhotoIndex < 0) {
      setActiveSharedPhotoId(null);
    }
  }, [activeSharedPhotoId, activeSharedPhotoIndex]);

  const showSharedPhotoAtIndex = useCallback(
    (index: number, direction: number) => {
      if (visibleSharedPhotos.length === 0) return;

      const nextIndex = getWrappedPhotoIndex(index, visibleSharedPhotos.length);
      setSharedPhotoTransitionDirection(direction);
      setActiveSharedPhotoId(visibleSharedPhotos[nextIndex].id);
    },
    [visibleSharedPhotos],
  );

  const shiftSharedPhoto = useCallback(
    (direction: number) => {
      if (activeSharedPhotoIndex < 0) return;

      showSharedPhotoAtIndex(activeSharedPhotoIndex + direction, direction);
    },
    [activeSharedPhotoIndex, showSharedPhotoAtIndex],
  );

  const handleSharedPhotoDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
      const direction = getSwipeDirection(info.offset.x);
      if (direction !== 0) {
        shiftSharedPhoto(direction);
      }
    },
    [shiftSharedPhoto],
  );

  const toggleSelectedSharedPhoto = useCallback(
    (photo: ApiSharedSpacePhoto) => {
      if (!canDeleteSharedSpacePhoto(photo, currentUserId)) {
        setErrorMessage(SHARED_SPACE_DELETE_OWN_MESSAGE);
        return;
      }

      setSelectedSharedPhotoIds((current) =>
        current.includes(photo.id)
          ? current.filter((selectedId) => selectedId !== photo.id)
          : [...current, photo.id],
      );
    },
    [currentUserId],
  );

  const handleSharedPhotoLongPressStart = useCallback(
    (photo: ApiSharedSpacePhoto) => {
      clearSharedPhotoLongPressTimer();
      didSharedPhotoLongPressRef.current = false;
      sharedPhotoLongPressTimerRef.current = window.setTimeout(() => {
        didSharedPhotoLongPressRef.current = true;

        if (!canDeleteSharedSpacePhoto(photo, currentUserId)) {
          setErrorMessage(SHARED_SPACE_DELETE_OWN_MESSAGE);
          return;
        }

        setIsSharedPhotoSelectMode(true);
        setSelectedSharedPhotoIds((current) =>
          current.includes(photo.id) ? current : [...current, photo.id],
        );
      }, 500);
    },
    [clearSharedPhotoLongPressTimer, currentUserId],
  );

  const handleSharedPhotoLongPressEnd = useCallback(() => {
    clearSharedPhotoLongPressTimer();
  }, [clearSharedPhotoLongPressTimer]);

  const handleSharedPhotoCardClick = useCallback(
    (photo: ApiSharedSpacePhoto) => {
      if (didSharedPhotoLongPressRef.current) {
        didSharedPhotoLongPressRef.current = false;
        return;
      }

      if (isSharedPhotoSelectMode) {
        toggleSelectedSharedPhoto(photo);
        return;
      }

      setSharedPhotoTransitionDirection(0);
      setActiveSharedPhotoId(photo.id);
    },
    [isSharedPhotoSelectMode, toggleSelectedSharedPhoto],
  );

  const handleSharedPhotoDeleteConfirmed = useCallback(async () => {
    if (!activeSpace || selectedSharedPhotoIds.length === 0) {
      return;
    }

    setIsDeletingSharedPhotos(true);
    try {
      for (const sharedPhotoId of selectedSharedPhotoIds) {
        await onDeletePhotoFromSpace(activeSpace.id, sharedPhotoId);
      }
      const deletedCount = selectedSharedPhotoIds.length;
      clearSharedPhotoSelection();
      setUploadStatusText(`已删除 ${deletedCount} 个照片/视频`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除共享照片/视频失败');
    } finally {
      setIsDeletingSharedPhotos(false);
    }
  }, [activeSpace, clearSharedPhotoSelection, onDeletePhotoFromSpace, selectedSharedPhotoIds]);

  const handleActiveSharedPhotoDelete = useCallback(async () => {
    if (!activeSpace || !activeSharedPhoto) return;

    if (!canDeleteSharedSpacePhoto(activeSharedPhoto, currentUserId)) {
      setErrorMessage(SHARED_SPACE_DELETE_OWN_MESSAGE);
      return;
    }

    const confirmed = await dialog.confirm({
      message: '确定把这张共享照片/视频移入清理吗？',
      confirmText: '移入清理',
    });

    if (!confirmed) {
      return;
    }

    const nextSharedPhotoId = getNextPhotoAfterDelete(
      visibleSharedPhotos.map((photo) => photo.id),
      activeSharedPhoto.id,
    );

    setIsDeletingSharedPhotos(true);
    try {
      await onDeletePhotoFromSpace(activeSpace.id, activeSharedPhoto.id);
      setActiveSharedPhotoId(nextSharedPhotoId);
      setUploadStatusText('已删除 1 个照片/视频');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '删除共享照片/视频失败');
    } finally {
      setIsDeletingSharedPhotos(false);
    }
  }, [
    activeSharedPhoto,
    activeSpace,
    currentUserId,
    dialog,
    onDeletePhotoFromSpace,
    visibleSharedPhotos,
  ]);

  const handleDownloadSharedPhoto = useCallback(async () => {
    const photo = activeSharedPhoto?.photo;

    if (!photo?.url) {
      setErrorMessage('当前照片暂时无法下载');
      return;
    }

    setIsDownloadingSharedPhoto(true);
    try {
      const result = await saveRemoteFileToDevice({
        url: photo.url,
        fileName: photo.fileName || photo.title,
        mimeType: photo.mimeType,
      });

      setErrorMessage(
        result.mode === 'native'
          ? `已保存到手机本地：${result.fileName}`
          : `已开始下载：${result.fileName}`,
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '下载照片失败，请检查网络后重试');
    } finally {
      setIsDownloadingSharedPhoto(false);
    }
  }, [activeSharedPhoto]);

  const handleCreateSpaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSpaceTitle.trim()) return;

    setIsCreatingSpace(true);
    try {
      await onCreateSpace({
        title: newSpaceTitle.trim(),
        description: newSpaceDescription.trim() || undefined,
      });
      setNewSpaceTitle('');
      setNewSpaceDescription('');
      setSelectedFriendIds([]);
      setIsNewSpaceOpen(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '创建共享空间失败');
    } finally {
      setIsCreatingSpace(false);
    }
  };

  const openRenameDialog = () => {
    if (!activeSpace) return;
    setRenameTitle(activeSpace.title);
    setIsRenameOpen(true);
  };

  const handleRenameSpaceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeSpace || !renameTitle.trim()) return;

    setIsRenamingSpace(true);
    try {
      await onRenameSpace(activeSpace.id, {
        title: renameTitle.trim(),
      });
      setUploadStatusText('共享相册名称已更新');
      closeRenameDialog();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '修改共享相册名称失败');
    } finally {
      setIsRenamingSpace(false);
    }
  };

  const handleUploadFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = event.currentTarget.files;
    const files: File[] = fileList
      ? Array.from({ length: fileList.length }, (_, index) => fileList.item(index)).filter(
          (file): file is File => Boolean(file),
        )
      : [];
    event.target.value = '';

    if (!activeSpace || files.length === 0) {
      return;
    }

    setIsUploading(true);
    setUploadStatusText('上传中...');
    try {
      const result = await onUploadPhotosToSpace(activeSpace.id, files);

      if (result.failedCount > 0) {
        setErrorMessage(result.firstError ?? '部分照片/视频上传失败');
        setUploadStatusText(`上传失败：已上传 ${result.uploadedCount} 个，失败 ${result.failedCount} 个`);
        return;
      }

      setUploadStatusText(`已上传 ${result.uploadedCount} 个照片/视频`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '上传照片/视频失败');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleInviteContact = (id: string) => {
    if (invitedContactIds.includes(id)) {
      setInvitedContactIds(invitedContactIds.filter(cid => cid !== id));
    } else {
      setInvitedContactIds([...invitedContactIds, id]);
    }
  };

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
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">共享</h1>
        </div>
        <button
          onClick={() => setIsNewSpaceOpen(true)}
          className="flex items-center gap-1.5 px-4.5 py-2.5 bg-secondary text-white hover:bg-secondary/90 text-xs font-bold rounded-full transition-transform active:scale-[0.98] cursor-pointer ambient-shadow"
          type="button"
        >
          <Plus className="w-4 h-4" />
          新空间
        </button>
      </header>

      <div className="px-5 mt-6">
        <div className="mb-2">
          <p className="text-sm text-on-surface-variant">和好友一起整理共同的相册回忆。</p>
        </div>

        {/* Shared Spaces Rows */}
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4 mt-6">
          {sharedSpaces.map((space) => {
            const coverPhoto = spacePhotos[space.id]?.[0]?.photo;
            const coverMedia = coverPhoto?.url ? toCacheableMedia(coverPhoto) : { url: space.coverUrl };
            const memberAvatars = getSharedSpaceMemberAvatars({
              space,
              currentUserId,
              currentUserAvatarUrl,
              contacts,
            });

            return (
            <motion.div
              layout
              key={space.id}
              onClick={() => {
                setActiveSpaceId(space.id);
                setIsDetailOpen(true);
              }}
              whileHover={{ y: -3 }}
              className={`relative overflow-hidden bg-white border rounded-lg shadow-sm group p-4 flex flex-col justify-between cursor-pointer ${
                activeSpace?.id === space.id ? 'border-[#88503a]' : 'border-surface-container/40'
              }`}
            >
              <div className="aspect-square w-full rounded-md overflow-hidden bg-surface-container mb-3 relative">
                <CachedImage
                  cacheMode="list"
                  media={coverMedia}
                  alt={space.title} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/5" />
              </div>

              <div>
                <h3 className="font-bold text-on-surface leading-tight text-sm md:text-base mb-1">{space.title}</h3>
                <p className="text-xs text-on-surface-variant font-medium">
                  {space.photosCount} 张照片 &bull; {space.contributorsCount} 位成员
                </p>
              </div>

              {/* Contributor Avatars Overlaps Row */}
              <div className="flex items-center gap-1 mt-3">
                <div className="flex -space-x-2">
                  {memberAvatars.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      className="w-5.5 h-5.5 rounded-full object-cover ring-2 ring-white"
                      alt="成员头像"
                      referrerPolicy="no-referrer"
                    />
                  ))}
                  {space.contributorsCount > 3 && (
                    <div className="w-5.5 h-5.5 rounded-full bg-surface-highest text-on-surface text-[10px] font-bold flex items-center justify-center ring-2 ring-white select-none">
                      +{space.contributorsCount - 3}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
            );
          })}

          {/* Dotted Create New Space button frame */}
          <motion.div
            onClick={() => setIsNewSpaceOpen(true)}
            whileHover={{ y: -3 }}
            className="border-2 border-dashed border-surface-container-highest bg-surface-container-low/30 hover:border-secondary/40 rounded-lg p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
          >
            <div className="p-3.5 bg-white rounded-full text-secondary mb-3 shadow-xs">
              <Plus className="w-5 h-5" />
            </div>
            <span className="font-bold text-on-surface text-sm">创建共享空间</span>
            <p className="text-[11px] text-on-surface-variant max-w-[150px] mt-1.5 leading-relaxed">
              和朋友开启一段新的共同回忆
            </p>
          </motion.div>
        </div>

        <AnimatePresence>
          {isDetailOpen && activeSpace && (
            <motion.div
              initial={{ opacity: 0, x: 32 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 32 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed inset-0 z-50 overflow-y-auto bg-background pb-32"
            >
              <header className="sticky top-0 z-40 flex items-center justify-between px-6 pb-4 pt-[calc(1.5rem+env(safe-area-inset-top))] glass-nav border-b border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="flex items-center gap-2 rounded-full border border-surface-container-highest bg-white/80 px-4 py-2 text-xs font-bold text-on-surface shadow-sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  返回共享列表
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="rounded-full p-2 text-on-surface-variant hover:bg-surface-container"
                  aria-label="关闭共享相册"
                >
                  <X className="h-5 w-5" />
                </button>
              </header>

              <div className="px-5 mt-6">
                <span className="text-[11px] font-bold tracking-widest text-[#7a442f] uppercase block mb-1">
                  &bull; 共享相册
                </span>
                <div className="mb-2 flex items-center gap-2">
                  <h2 className="text-3xl font-bold tracking-tight text-on-surface">
                    {activeSpace.title}
                  </h2>
                  <button
                    type="button"
                    onClick={openRenameDialog}
                    className="rounded-full bg-white px-3 py-2 text-[#88503a] shadow-sm border border-surface-container-high hover:bg-[#fff3ee]"
                    aria-label="修改共享相册名称"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                <p className="mb-6 text-sm font-medium text-on-surface-variant">
                  {activeSpace.photosCount} 张照片/视频 &bull; {activeSpace.contributorsCount} 位成员
                </p>

          {/* Activity invitation + photo buttons row as shown in Image 4 */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setIsInviteOpen(true)}
              disabled={!activeSpace}
              className="flex items-center gap-1.5 px-4.5 py-2.5 border border-surface-container-highest hover:bg-surface-container text-on-surface rounded-full text-xs font-semibold select-none cursor-pointer transition-colors"
              type="button"
            >
              <UserPlus className="w-3.5 h-3.5 text-on-surface-variant" />
              邀请好友
            </button>
            <label className={`flex items-center gap-1.5 px-4.5 py-2.5 bg-secondary text-white hover:bg-secondary/90 rounded-full text-xs font-semibold select-none transition-colors ${
              isUploading || !activeSpace ? 'opacity-60 pointer-events-none' : 'cursor-pointer'
            }`}>
              <UploadCloud className="w-3.5 h-3.5" />
              {isUploading ? '上传中...' : '上传照片/视频'}
              <input 
                type="file" 
                multiple 
                accept="image/*,video/*" 
                onChange={handleUploadFiles} 
                disabled={isUploading || !activeSpace}
                className="hidden" 
              />
            </label>
          </div>

          {uploadStatusText && (
            <div className="bg-surface-container p-4 rounded-lg mb-6 flex items-center gap-4">
              {isUploading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-secondary border-t-transparent" />
              ) : (
                <CheckCircle2 className="h-5 w-5 text-secondary" />
              )}
              <div className="flex-1">
                <span className="text-xs font-semibold text-on-surface">{uploadStatusText}</span>
              </div>
            </div>
          )}

          {isSharedPhotoSelectMode && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 flex items-center gap-2 rounded-[1.35rem] bg-surface-container p-3"
            >
              <div className="flex-1">
                <span className="block text-xs font-bold text-on-surface">
                  已选择 {selectedSharedPhotoIds.length} 个照片/视频
                </span>
                <span className="mt-1 block text-[11px] font-medium text-on-surface-variant">
                  仅可删除自己上传的内容
                </span>
              </div>
              <button
                type="button"
                onClick={clearSharedPhotoSelection}
                className="rounded-full bg-white px-4 py-2 text-xs font-bold text-on-surface-variant"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => setIsSharedPhotoDeleteConfirmOpen(true)}
                disabled={selectedSharedPhotoIds.length === 0 || isDeletingSharedPhotos}
                className="inline-flex items-center gap-1 rounded-full bg-[#b42318] px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                删除
              </button>
            </motion.div>
          )}

          <p className="text-xs text-on-surface-variant mb-4">
            共享空间成员可以上传自己的照片和视频，下方可按上传者查看来源。
          </p>

          {contributorFilters.length > 1 && (
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {contributorFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSelectedContributorId(filter.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition ${
                    selectedContributorId === filter.id
                      ? 'bg-[#88503a] text-white shadow-sm'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="active-space-grid">
            {visibleSharedPhotos.map((photo, index) => {
              const isOwnSharedPhoto = canDeleteSharedSpacePhoto(photo, currentUserId);
              const isSelected = selectedSharedPhotoIds.includes(photo.id);

              return (
              <motion.div
                layout
                key={photo.id}
                whileHover={{ scale: 1.02 }}
                onPointerDown={() => handleSharedPhotoLongPressStart(photo)}
                onPointerUp={handleSharedPhotoLongPressEnd}
                onPointerCancel={handleSharedPhotoLongPressEnd}
                onPointerLeave={handleSharedPhotoLongPressEnd}
                onClick={() => handleSharedPhotoCardClick(photo)}
                className={`relative overflow-hidden rounded-[1.35rem] bg-white shadow-sm border cursor-pointer transition ${
                  isSelected
                    ? 'border-[#f0a78a] ring-4 ring-[#f0a78a]/45'
                    : isSharedPhotoSelectMode && !isOwnSharedPhoto
                      ? 'border-surface-container-high bg-surface-container-low/70 opacity-80'
                      : 'border-surface-container-low'
                }`}
              >
                <div className="aspect-square bg-surface-container overflow-hidden">
                  {photo.photo?.url ? (
                    photo.photo.mimeType.startsWith('video/') ? (
                      <CachedVideo
                        cacheMode="list"
                        media={toCacheableMedia(photo.photo)}
                        className="h-full w-full object-cover"
                        muted
                        playsInline
                        preload="none"
                      />
                    ) : (
                      <CachedImage
                        cacheMode="list"
                        media={toCacheableMedia(photo.photo)}
                        alt={photo.photo.title ?? photo.photo.fileName}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        referrerPolicy="no-referrer"
                      />
                    )
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 text-center">
                      <div>
                        <ImageIcon className="w-8 h-8 mx-auto text-outline mb-3" />
                        <span className="block text-xs font-bold text-on-surface">照片引用</span>
                        <span className="block text-[10px] text-on-surface-variant mt-1 break-all">{photo.photoId}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="absolute left-3 top-3 rounded-full bg-black/50 px-2 py-1 text-[10px] font-bold text-white backdrop-blur">
                  {index + 1}/{visibleSharedPhotos.length}
                </div>
                {isSharedPhotoSelectMode && (
                  <div
                    className={`absolute right-3 top-3 flex items-center justify-center shadow-sm backdrop-blur ${
                      isOwnSharedPhoto
                        ? 'h-8 w-8 rounded-full bg-white/85 text-xs font-black text-[#88503a]'
                        : 'rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white'
                    }`}
                  >
                    {isOwnSharedPhoto
                      ? getSelectionOrder(selectedSharedPhotoIds, photo.id) ?? ''
                      : '好友上传'}
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-2">
                  <img
                    src={photo.sharedBy?.avatarUrl ?? currentUserAvatarUrl}
                    alt="上传者头像"
                    className="h-6 w-6 rounded-full object-cover bg-secondary-container"
                    referrerPolicy="no-referrer"
                  />
                  <span className="truncate text-xs font-bold text-on-surface">
                    {photo.sharedById === currentUserId ? '我上传的' : photo.sharedBy?.displayName ?? '好友'}
                  </span>
                </div>
              </motion.div>
              );
            })}

            {visibleSharedPhotos.length === 0 && (
              <div className="col-span-2 rounded-[1.5rem] border border-dashed border-surface-container-highest bg-surface-container-low/40 p-8 text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-outline" />
                <p className="mt-3 text-sm font-bold text-on-surface">还没有共享照片</p>
                <p className="mt-1 text-xs text-on-surface-variant">上传第一张照片，和好友一起整理回忆。</p>
              </div>
            )}
          </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeSharedPhoto && (
          <div className="fixed inset-0 z-[75] flex flex-col items-center justify-center bg-black/95 px-4 pb-[calc(10rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))] text-white">
            <div className="absolute left-6 top-[calc(1.5rem+env(safe-area-inset-top))] rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/80">
              {activeSharedPhotoIndex + 1} / {visibleSharedPhotos.length}
            </div>
            <div className="absolute right-5 top-[calc(1rem+env(safe-area-inset-top))] flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadSharedPhoto}
                disabled={isDownloadingSharedPhoto}
                className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs font-bold text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isDownloadingSharedPhoto ? '保存中' : '下载'}
              </button>
              <button
                type="button"
                onClick={() => setActiveSharedPhotoId(null)}
                className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                aria-label="关闭照片查看"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <motion.div
              drag={visibleSharedPhotos.length > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragEnd={handleSharedPhotoDragEnd}
              className="flex w-full flex-1 touch-pan-y flex-col items-center justify-center"
            >
            <div className="flex max-h-[58vh] w-full max-w-4xl items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait" custom={sharedPhotoTransitionDirection}>
                <motion.div
                  key={activeSharedPhoto.id}
                  initial={{
                    opacity: 0,
                    x:
                      sharedPhotoTransitionDirection === 0
                        ? 0
                        : sharedPhotoTransitionDirection > 0
                          ? 90
                          : -90,
                    scale: 0.98,
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x:
                      sharedPhotoTransitionDirection === 0
                        ? 0
                        : sharedPhotoTransitionDirection > 0
                          ? -90
                          : 90,
                    scale: 0.98,
                  }}
                  transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
                  className="flex max-h-[58vh] max-w-full touch-pan-y items-center justify-center"
                >
                  {activeSharedPhoto.photo?.url ? (
                    activeSharedPhoto.photo.mimeType.startsWith('video/') ? (
                      <CachedVideo
                        media={toCacheableMedia(activeSharedPhoto.photo)}
                        className="max-h-[58vh] max-w-full rounded-xl"
                        controls
                        playsInline
                      />
                    ) : (
                      <CachedImage
                        media={toCacheableMedia(activeSharedPhoto.photo)}
                        alt={activeSharedPhoto.photo.title ?? activeSharedPhoto.photo.fileName}
                        className="max-h-[58vh] max-w-full rounded-xl object-contain"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        referrerPolicy="no-referrer"
                      />
                    )
                  ) : (
                    <div className="rounded-3xl bg-white/10 p-8 text-center">
                      <ImageIcon className="mx-auto mb-3 h-10 w-10 text-white/60" />
                      <p className="text-sm font-bold">照片暂时无法查看</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="mt-6 w-full max-w-md text-center">
              <h3 className="truncate text-xl font-black">
                {activeSharedPhoto.photo
                  ? getPhotoDetailTitle(
                      {
                        ...activeSharedPhoto.photo,
                        uploadedByName:
                          activeSharedPhoto.sharedById === currentUserId
                            ? '我'
                            : activeSharedPhoto.sharedBy?.displayName,
                      },
                      activeSpace?.title,
                    )
                  : '共享照片'}
              </h3>
              {activeSharedPhoto.photo && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-white/60">
                  {getPhotoDetailMeta({
                    ...activeSharedPhoto.photo,
                    uploadedByName:
                      activeSharedPhoto.sharedById === currentUserId
                        ? '我'
                        : activeSharedPhoto.sharedBy?.displayName,
                  }).map((item, index) => (
                    <span key={`${item}-${index}`}>{item}</span>
                  ))}
                </div>
              )}
            </div>
            </motion.div>
            <div className="absolute inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] mx-auto flex max-w-md items-center justify-center gap-3 rounded-[2rem] border border-white/15 bg-white/12 p-3 shadow-2xl backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={handleDownloadSharedPhoto}
                  disabled={isDownloadingSharedPhoto}
                  className="flex-1 rounded-full border border-white/30 bg-white/18 px-4 py-3 text-xs font-bold text-white shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Download className="h-4 w-4" />
                    {isDownloadingSharedPhoto ? '保存中...' : '下载'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleActiveSharedPhotoDelete()}
                  disabled={
                    isDeletingSharedPhotos ||
                    !canDeleteSharedSpacePhoto(activeSharedPhoto, currentUserId)
                  }
                  className="flex-1 rounded-full border border-white/30 bg-white/18 px-4 py-3 text-xs font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50"
                >
                  {canDeleteSharedSpacePhoto(activeSharedPhoto, currentUserId)
                    ? isDeletingSharedPhotos
                      ? '删除中...'
                      : '删除照片'
                    : '只能删除自己上传'}
                </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Invite Friends Modal BottomSheet */}
      <AnimatePresence>
        {isInviteOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end justify-center">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-background rounded-t-3xl max-w-lg w-full p-6 shadow-2xl border-t border-surface-container"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-bold text-lg text-on-surface">邀请好友加入当前空间</h3>
                <button 
                  type="button"
                  onClick={closeInviteDialog}
                  className="p-1.5 hover:bg-surface-container rounded-full text-on-surface-variant"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Friends List selection */}
              <div className="my-6 max-h-[350px] overflow-y-auto space-y-3 pr-2">
                <div className="p-3.5 bg-surface-container rounded-lg">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">通过用户 ID 邀请</label>
                  <input
                    type="text"
                    placeholder="输入任意用户 ID"
                    value={manualInviteUserId}
                    onChange={(event) => setManualInviteUserId(event.target.value)}
                    className="w-full px-4 py-2 bg-white text-on-surface rounded-xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>
                {contacts.filter(c => !c.isSuggested).map((friend) => {
                  const isChecked = invitedContactIds.includes(friend.id);
                  return (
                    <div 
                      key={friend.id}
                      onClick={() => toggleInviteContact(friend.id)}
                      className="flex items-center justify-between p-3.5 hover:bg-surface-container rounded-lg cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center font-bold text-secondary text-sm overflow-hidden">
                          {friend.avatarUrl ? (
                            <img src={friend.avatarUrl} className="w-full h-full object-cover" alt="好友头像" referrerPolicy="no-referrer" />
                          ) : (
                            friend.initials
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-on-surface block text-sm">{friend.name}</span>
                          <span className="text-xs text-on-surface-variant">{friend.status}</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                        isChecked ? 'bg-[#7a442f] border-[#7a442f] text-white' : 'border-outline-variant text-transparent'
                      }`}>
                        <CheckCircle2 className="w-4 h-4 fill-current" />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Dynamic submit or finish button */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-surface-container-high">
                <span className="text-xs font-semibold text-on-surface-variant">
                  已选择 {invitedContactIds.length} 位好友
                </span>
                <button
                  type="button"
                  disabled={!activeSpace || isSendingInvites}
                  onClick={() => {
                    if (!activeSpace) return;

                    const userIds = [
                      ...invitedContactIds,
                      ...(manualInviteUserId.trim() ? [manualInviteUserId.trim()] : []),
                    ];

                    setIsSendingInvites(true);
                    Promise.all(userIds.map((userId) => onInviteToSpace(activeSpace.id, userId)))
                      .then(() => {
                        closeInviteDialog();
                      })
                      .catch((error) => {
                        setErrorMessage(error instanceof Error ? error.message : '邀请成员失败');
                      })
                      .finally(() => setIsSendingInvites(false));
                  }}
                  className="px-6 py-2.5 bg-[#7a442f] text-white rounded-full text-xs font-bold hover:bg-[#88503a] transition-colors cursor-pointer"
                >
                  {isSendingInvites ? '发送中...' : '发送访问邀请'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Brand New Space Creator Modal Screen Form */}
      <AnimatePresence>
        {isNewSpaceOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-surface-container"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-bold text-lg text-on-surface">创建共享空间</h3>
                <button 
                  type="button"
                  onClick={closeNewSpaceDialog}
                  className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSpaceSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">空间名称</label>
                  <input
                    type="text"
                    required
                    placeholder="例如：周末露营"
                    value={newSpaceTitle}
                    onChange={(e) => setNewSpaceTitle(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-surface-container-lowest text-on-surface rounded-xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">描述</label>
                  <input
                    type="text"
                    placeholder="可选：写一句空间说明"
                    value={newSpaceDescription}
                    onChange={(e) => setNewSpaceDescription(e.target.value)}
                    className="w-full px-4.5 py-2.5 bg-surface-container-lowest text-on-surface rounded-xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1.5">选择封面主题</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: '瀑布', url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=200&q=80' },
                      { name: '自驾', url: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=200&q=80' },
                      { name: '海滩', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=80' }
                    ].map(themeItem => (
                      <button
                        key={themeItem.name}
                        type="button"
                        onClick={() => setNewSpaceCover(themeItem.url)}
                        className={`relative aspect-square rounded-md overflow-hidden border-2 cursor-pointer transition-all ${
                          newSpaceCover === themeItem.url ? 'border-[#7a442f] scale-102 ring-1 ring-[#ffb599]' : 'border-transparent opacity-80'
                        }`}
                      >
                        <img src={themeItem.url} alt={themeItem.name} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 left-1 bg-black/60 text-[8px] text-white font-bold p-0.5 rounded px-1">
                          {themeItem.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">邀请好友</label>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto mt-1 p-2 bg-surface-container rounded-xl">
                    {contacts.filter(c => !c.isSuggested).map(contact => {
                      const isChecked = selectedFriendIds.includes(contact.id);
                      return (
                        <button
                          key={contact.id}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              setSelectedFriendIds(selectedFriendIds.filter(id => id !== contact.id));
                            } else {
                              setSelectedFriendIds([...selectedFriendIds, contact.id]);
                            }
                          }}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                            isChecked 
                              ? 'bg-secondary text-white border-secondary' 
                              : 'bg-white border-surface-container-highest text-on-surface-variant hover:bg-surface-container'
                          }`}
                        >
                          {contact.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 border-t border-surface-container-high flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeNewSpaceDialog}
                    className="px-4 py-2 hover:bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingSpace}
                    className="px-5 py-2.5 bg-[#7a442f] text-white hover:bg-[#88503a] rounded-full text-xs font-bold cursor-pointer"
                  >
                    {isCreatingSpace ? '创建中...' : '立即创建'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRenameOpen && activeSpace && (
          <div className="fixed inset-0 z-[65] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-surface-container"
            >
              <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
                <h3 className="font-bold text-lg text-on-surface">修改共享相册名称</h3>
                <button
                  type="button"
                  onClick={closeRenameDialog}
                  className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleRenameSpaceSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">新名称</label>
                  <input
                    type="text"
                    required
                    value={renameTitle}
                    onChange={(event) => setRenameTitle(event.target.value)}
                    className="w-full px-4.5 py-2.5 bg-surface-container-lowest text-on-surface rounded-2xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div className="hidden">
                  <label className="block text-xs font-bold text-on-surface-variant uppercase mb-1">描述</label>
                  <input
                    type="text"
                    className="w-full px-4.5 py-2.5 bg-surface-container-lowest text-on-surface rounded-2xl border border-surface-container focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
                  />
                </div>
                <div className="pt-4 border-t border-surface-container-high flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeRenameDialog}
                    className="px-4 py-2 hover:bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isRenamingSpace}
                    className="px-5 py-2.5 bg-[#7a442f] text-white hover:bg-[#88503a] rounded-full text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    {isRenamingSpace ? '保存中...' : '保存'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSharedPhotoDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-sm rounded-3xl border border-white/70 bg-[#fffaf7] p-6 text-[#1e1b18] shadow-2xl"
            >
              <h3 className="text-xl font-extrabold tracking-tight">确认删除</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-on-surface-variant">
                确定把已选择的 {selectedSharedPhotoIds.length} 个照片/视频移入清理吗？只能删除你自己上传的内容。
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSharedPhotoDeleteConfirmOpen(false)}
                  className="flex-1 rounded-full bg-surface-container px-5 py-3 text-sm font-bold text-on-surface-variant"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSharedPhotoDeleteConfirmed}
                  disabled={isDeletingSharedPhotos}
                  className="flex-1 rounded-full bg-[#b42318] px-5 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60"
                >
                  {isDeletingSharedPhotos ? '删除中...' : '删除'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {errorMessage && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-sm rounded-3xl border border-white/70 bg-[#fffaf7] p-6 text-[#1e1b18] shadow-2xl"
            >
              <h3 className="text-xl font-extrabold tracking-tight">提示</h3>
              <p className="mt-3 text-sm font-semibold leading-relaxed text-on-surface-variant">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setErrorMessage('')}
                className="mt-6 w-full rounded-full bg-[#88503a] px-5 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#7a442f]"
              >
                知道了
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}






