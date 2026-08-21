/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trash2, RefreshCw, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { DeletedPhoto } from '../types';
import { CachedImage, CachedVideo } from './CachedMedia';
import { useAppDialog } from './AppDialog';
import { getNextDeletedPhotoAfterAction } from '../lib/cleanup-viewer';
import { getSwipeDirection, getWrappedPhotoIndex } from '../lib/photo-navigation';

interface CleanupTabProps {
  deletedPhotos: DeletedPhoto[];
  currentUserAvatarUrl: string;
  onRestorePhoto: (photoId: string) => Promise<void>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onEmptyBin: () => Promise<void>;
  onBackToAlbums?: () => void;
}

const toCacheableDeletedMedia = (
  photo?: Pick<DeletedPhoto, 'objectKey' | 'url' | 'mimeType'> | null,
) =>
  photo?.url
    ? {
        objectKey: photo.objectKey,
        url: photo.url,
        mimeType: photo.mimeType,
      }
    : null;

const isVideoDeletedPhoto = (photo?: Pick<DeletedPhoto, 'mimeType'> | null) =>
  photo?.mimeType?.toLowerCase().startsWith('video/') ?? false;

export default function CleanupTab({
  deletedPhotos,
  currentUserAvatarUrl,
  onRestorePhoto,
  onDeletePhoto,
  onEmptyBin,
  onBackToAlbums,
}: CleanupTabProps) {
  const dialog = useAppDialog();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showEmptyAlert, setShowEmptyAlert] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [activeDeletedPhotoId, setActiveDeletedPhotoId] = useState<string | null>(null);
  const [deletedPhotoTransitionDirection, setDeletedPhotoTransitionDirection] = useState(0);
  const longPressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);
  const activeDeletedPhoto =
    deletedPhotos.find((photo) => photo.id === activeDeletedPhotoId) ?? null;
  const activeDeletedPhotoIndex = activeDeletedPhoto
    ? deletedPhotos.findIndex((photo) => photo.id === activeDeletedPhoto.id)
    : -1;
  const deletedPhotoCount = deletedPhotos.length;

  const clearSelection = useCallback(() => {
    setSelectMode(false);
    setSelectedIds([]);
  }, []);

  const handleLocalBack = useCallback(() => {
    if (activeDeletedPhotoId) {
      setActiveDeletedPhotoId(null);
      return true;
    }

    if (isBulkDeleteConfirmOpen) {
      setIsBulkDeleteConfirmOpen(false);
      return true;
    }

    if (showEmptyAlert) {
      setShowEmptyAlert(false);
      return true;
    }

    if (selectMode) {
      clearSelection();
      return true;
    }

    return false;
  }, [activeDeletedPhotoId, clearSelection, isBulkDeleteConfirmOpen, selectMode, showEmptyAlert]);

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
    if (activeDeletedPhotoId && activeDeletedPhotoIndex < 0) {
      setActiveDeletedPhotoId(null);
    }
  }, [activeDeletedPhotoId, activeDeletedPhotoIndex]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Toggle single selection
  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleLongPressStart = (id: string) => {
    clearLongPressTimer();
    didLongPressRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      setSelectMode(true);
      setSelectedIds((current) => (current.includes(id) ? current : [...current, id]));
    }, 500);
  };

  const handleLongPressEnd = () => {
    clearLongPressTimer();
  };

  const showDeletedPhotoAtIndex = useCallback(
    (index: number, direction: number) => {
      if (deletedPhotos.length === 0) return;

      const nextIndex = getWrappedPhotoIndex(index, deletedPhotos.length);
      setDeletedPhotoTransitionDirection(direction);
      setActiveDeletedPhotoId(deletedPhotos[nextIndex]?.id ?? null);
    },
    [deletedPhotos],
  );

  const shiftDeletedPhoto = useCallback(
    (direction: number) => {
      if (activeDeletedPhotoIndex < 0) return;

      showDeletedPhotoAtIndex(activeDeletedPhotoIndex + direction, direction);
    },
    [activeDeletedPhotoIndex, showDeletedPhotoAtIndex],
  );

  const handleActiveDeletedPhotoDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
      const direction = getSwipeDirection(info.offset.x);
      if (direction !== 0) {
        shiftDeletedPhoto(direction);
      }
    },
    [shiftDeletedPhoto],
  );

  const handleActiveDeletedPhotoRestore = useCallback(async () => {
    if (!activeDeletedPhoto) return;

    const nextPhotoId = getNextDeletedPhotoAfterAction(
      deletedPhotos.map((photo) => photo.id),
      activeDeletedPhoto.id,
    );

    setIsWorking(true);
    try {
      await onRestorePhoto(activeDeletedPhoto.id);
      setActiveDeletedPhotoId(nextPhotoId);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '恢复照片失败');
    } finally {
      setIsWorking(false);
    }
  }, [activeDeletedPhoto, deletedPhotos, dialog, onRestorePhoto]);

  const handleActiveDeletedPhotoDelete = useCallback(async () => {
    if (!activeDeletedPhoto) return;

    const confirmed = await dialog.confirm({
      message: '确定要彻底删除这张照片吗？此操作无法撤销。',
      confirmText: '彻底删除',
    });

    if (!confirmed) {
      return;
    }

    const nextPhotoId = getNextDeletedPhotoAfterAction(
      deletedPhotos.map((photo) => photo.id),
      activeDeletedPhoto.id,
    );

    setIsWorking(true);
    try {
      await onDeletePhoto(activeDeletedPhoto.id);
      setActiveDeletedPhotoId(nextPhotoId);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '彻底删除照片失败');
    } finally {
      setIsWorking(false);
    }
  }, [activeDeletedPhoto, deletedPhotos, dialog, onDeletePhoto]);

  // Perform bulk restore
  const handleBulkRestore = async () => {
    setIsWorking(true);
    try {
      await Promise.all(selectedIds.map((id) => onRestorePhoto(id)));
      setSelectedIds([]);
      setSelectMode(false);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '恢复所选照片失败');
    } finally {
      setIsWorking(false);
    }
  };

  // Perform bulk permanent delete
  const handleBulkDelete = () => {
    setIsBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirmed = async () => {
    setIsWorking(true);
    try {
      await Promise.all(selectedIds.map((id) => onDeletePhoto(id)));
      setSelectedIds([]);
      setSelectMode(false);
      setIsBulkDeleteConfirmOpen(false);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '永久删除所选照片失败');
    } finally {
      setIsWorking(false);
    }
  };

  const handleEmptyBinConfirmed = async () => {
    setIsWorking(true);
    try {
      await onEmptyBin();
      setShowEmptyAlert(false);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '清空回收站失败');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="w-full pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 pb-4 pt-[calc(2.5rem+env(safe-area-inset-top))] glass-nav border-b border-surface-container-high">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">清理</h1>
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {selectMode && (
              <motion.div
                initial={{ opacity: 0, x: 8, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 8, scale: 0.92 }}
                className="rounded-full border border-[#88503a]/15 bg-[#fff5f0] px-3 py-1.5 text-xs font-bold text-[#88503a] shadow-sm"
              >
                已选 {selectedIds.length}
              </motion.div>
            )}
          </AnimatePresence>
          <img 
            src={currentUserAvatarUrl} 
            alt="个人头像" 
            className="w-10 h-10 rounded-full object-cover border border-secondary/10"
            referrerPolicy="no-referrer"
          />
        </div>
      </header>

      <div className="px-5 mt-6">
        {/* Dynamic Empty State */}
        {deletedPhotos.length === 0 ? (
          <div className="text-center py-20 bg-surface-low rounded-lg p-8 border border-dashed border-surface-container-highest">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-green-600 shadow-sm">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-on-surface">回收站很干净！</h3>
            <p className="text-sm text-on-surface-variant mt-2 max-w-sm mx-auto leading-relaxed">
              当前没有待清理照片。删除的回忆会在这里保留 30 天，然后再永久移除。
            </p>
            <button
              type="button"
              onClick={() => {
                if (onBackToAlbums) {
                  onBackToAlbums();
                  return;
                }
                window.history.back();
              }}
              className="mt-6 px-5 py-2 bg-secondary text-white rounded-full text-xs font-semibold hover:bg-secondary/90 transition-colors cursor-pointer"
            >
              返回相册
            </button>
          </div>
        ) : (
          <>
            {/* Storage/Banner Card */}
            <div className="flex items-center justify-between p-5 bg-[#7a442f] text-white rounded-lg mb-8 shadow-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
                <Trash2 className="w-48 h-48" />
              </div>
              <div className="space-y-1 relative z-10">
                <h3 className="text-lg font-bold tracking-tight">最近删除</h3>
                <p className="text-xs text-white/80 max-w-xs leading-normal">
                  项目会在 30 天后永久删除。你也可以现在清空来释放空间。
                </p>
              </div>
              <button
                onClick={() => setShowEmptyAlert(true)}
                className="px-5 py-3 bg-white text-[#7a442f] rounded-full text-xs font-bold hover:bg-white/90 transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                type="button"
              >
                清空回收站
              </button>
            </div>

            {/* Selection Options Submenu panel */}
            {selectMode && (
              <div className="flex items-center justify-between px-4 py-3 bg-surface-container rounded-lg mb-6 text-sm">
                <span className="font-semibold text-on-surface-variant">
                  已选择 {selectedIds.length} 张照片
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearSelection}
                    disabled={isWorking}
                    className="px-3 py-1.5 bg-white text-on-surface-variant rounded-full text-xs font-semibold hover:bg-surface-container-high disabled:opacity-50 transition-colors cursor-pointer"
                    type="button"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleBulkRestore}
                    disabled={selectedIds.length === 0 || isWorking}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-full text-xs font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors cursor-pointer"
                    type="button"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    恢复
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedIds.length === 0 || isWorking}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white rounded-full text-xs font-semibold hover:bg-red-800 disabled:opacity-50 transition-colors cursor-pointer"
                    type="button"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    删除
                  </button>
                </div>
              </div>
            )}

            {/* Deleted Photos Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" id="deleted-grid">
              {deletedPhotos.map((photo) => {
                const isSelected = selectedIds.includes(photo.id);
                return (
                  <motion.div
                    layout
                    key={photo.id}
                    className="relative rounded-lg group overflow-hidden bg-surface-low border border-surface-container-high aspect-[3/4] cursor-pointer select-none touch-callout-none"
                    onPointerDown={() => handleLongPressStart(photo.id)}
                    onPointerUp={handleLongPressEnd}
                    onPointerLeave={handleLongPressEnd}
                    onPointerCancel={handleLongPressEnd}
                    onContextMenu={(event) => event.preventDefault()}
                    onClick={() => {
                      if (didLongPressRef.current) {
                        didLongPressRef.current = false;
                        return;
                      }
                      if (selectMode) {
                        handleToggleSelect(photo.id);
                        return;
                      }
                      setDeletedPhotoTransitionDirection(0);
                      setActiveDeletedPhotoId(photo.id);
                    }}
                  >
                    <CachedImage
                      cacheMode="list"
                      media={toCacheableDeletedMedia(photo)}
                      alt="已删除的回忆"
                      className="w-full h-full object-cover transition-transform duration-500"
                      loading="lazy"
                      decoding="async"
                      fetchPriority="low"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Dark gradient blur covering */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />

                    {/* Left overlay badge indicating countdown status */}
                    <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
                      <span className="text-[10px] font-bold text-red-400 tracking-wider uppercase font-mono">
                        还剩 {photo.daysLeft} {photo.timeLeftUnit === 'hours' ? '小时' : '天'}
                      </span>

                      {!selectMode && (
                        <button
                          type="button"
                          onPointerDown={(event) => event.stopPropagation()}
                          onPointerUp={(event) => event.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onRestorePhoto(photo.id).catch((error) => {
                              void dialog.alert(error instanceof Error ? error.message : '恢复照片失败');
                            });
                          }}
                          className="p-1 px-3 bg-white/20 hover:bg-white text-white hover:text-on-surface rounded-full text-[10px] font-semibold transition-all backdrop-blur-md"
                          title="恢复回忆"
                        >
                          恢复
                        </button>
                      )}
                    </div>

                    {/* Checkbox overlay in edit mode */}
                    {selectMode && (
                      <div className="absolute inset-0 bg-black/30 flex items-start justify-end p-3 z-20">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
                          isSelected 
                            ? 'bg-secondary border-secondary text-white' 
                            : 'bg-white/40 border-white text-transparent'
                        }`}>
                          <CheckCircle2 className="w-4 h-4 fill-current" />
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Confirmation Modal to Permanently Delete Selected Items */}
      <AnimatePresence>
        {isBulkDeleteConfirmOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="bg-[#fff8f5] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/60 text-[#1e1b18]"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-on-surface">确认永久删除</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                确定要永久删除已选择的 {selectedIds.length} 个项目吗？此操作不可撤销。
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setIsBulkDeleteConfirmOpen(false)}
                  disabled={isWorking}
                  className="px-4 py-2 hover:bg-surface-container rounded-full text-xs font-semibold text-on-surface-variant cursor-pointer disabled:opacity-60"
                  type="button"
                >
                  取消
                </button>
                <button
                  onClick={handleBulkDeleteConfirmed}
                  disabled={isWorking || selectedIds.length === 0}
                  className="px-5 py-2 bg-red-700 text-white hover:bg-red-800 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-60"
                  type="button"
                >
                  {isWorking ? '删除中...' : '确认删除'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal to Clear All */}
      <AnimatePresence>
        {showEmptyAlert && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-surface-container"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-on-surface">确认清空回收站</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                你即将永久删除全部 {deletedPhotos.length} 个项目。此操作会释放空间，并且<span className="font-extrabold text-[#7a442f]">无法撤销</span>。
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowEmptyAlert(false)}
                  className="px-4 py-2 hover:bg-surface-container rounded-full text-xs font-semibold text-on-surface-variant cursor-pointer"
                  type="button"
                >
                  先保留
                </button>
                <button
                  onClick={handleEmptyBinConfirmed}
                  disabled={isWorking}
                  className="px-5 py-2 bg-red-700 text-white hover:bg-red-800 rounded-full text-xs font-semibold cursor-pointer"
                  type="button"
                >
                  确认清空
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {activeDeletedPhoto && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
            <div className="absolute left-6 top-[calc(1.25rem+env(safe-area-inset-top))] rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85">
              {activeDeletedPhotoIndex + 1} / {deletedPhotoCount}
            </div>
            <button
              type="button"
              className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-5 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              onClick={() => setActiveDeletedPhotoId(null)}
            >
              <X className="h-6 w-6" />
            </button>

            <motion.div
              drag={deletedPhotoCount > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragEnd={handleActiveDeletedPhotoDragEnd}
              className="flex w-full flex-1 touch-pan-y flex-col items-center justify-center"
            >
              <div className="relative flex max-h-[62vh] max-w-4xl items-center justify-center overflow-hidden">
                <AnimatePresence mode="wait" custom={deletedPhotoTransitionDirection}>
                  <motion.div
                    key={activeDeletedPhoto.id}
                    initial={{
                      opacity: 0,
                      x:
                        deletedPhotoTransitionDirection === 0
                          ? 0
                          : deletedPhotoTransitionDirection > 0
                            ? 90
                            : -90,
                      scale: 0.98,
                    }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{
                      opacity: 0,
                      x:
                        deletedPhotoTransitionDirection === 0
                          ? 0
                          : deletedPhotoTransitionDirection > 0
                            ? -90
                            : 90,
                      scale: 0.98,
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
                    className="flex max-h-[62vh] max-w-full touch-pan-y items-center justify-center"
                  >
                    {isVideoDeletedPhoto(activeDeletedPhoto) ? (
                      <CachedVideo
                        media={toCacheableDeletedMedia(activeDeletedPhoto)}
                        className="max-h-[62vh] max-w-full rounded-xl"
                        controls
                        playsInline
                      />
                    ) : (
                      <CachedImage
                        media={toCacheableDeletedMedia(activeDeletedPhoto)}
                        alt={activeDeletedPhoto.title ?? '已删除的回忆'}
                        className="max-h-[62vh] max-w-full rounded-xl object-contain"
                        loading="eager"
                        decoding="async"
                        fetchPriority="high"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-6 px-4 text-center text-white">
                <h3 className="text-xl font-bold">
                  {activeDeletedPhoto.title || '已删除的回忆'}
                </h3>
                <p className="mt-2 text-xs font-semibold text-white/70">
                  还剩 {activeDeletedPhoto.daysLeft}{' '}
                  {activeDeletedPhoto.timeLeftUnit === 'hours' ? '小时' : '天'} 自动清除
                </p>
              </div>
            </motion.div>

            <div className="absolute inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] mx-auto flex max-w-md items-center justify-center gap-3 rounded-[2rem] border border-white/15 bg-white/12 p-3 shadow-2xl backdrop-blur-2xl">
              <button
                type="button"
                onClick={() => void handleActiveDeletedPhotoRestore()}
                disabled={isWorking}
                className="flex-1 rounded-full border border-white/30 bg-white/18 px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60"
              >
                {isWorking ? '处理中...' : '恢复照片'}
              </button>
              <button
                type="button"
                onClick={() => void handleActiveDeletedPhotoDelete()}
                disabled={isWorking}
                className="flex-1 rounded-full border border-white/30 bg-white/18 px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60"
              >
                {isWorking ? '处理中...' : '彻底删除'}
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
