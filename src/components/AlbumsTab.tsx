/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, MapPin, Calendar, Play, Trash2, Tag, LayoutGrid, X, UploadCloud, Heart } from 'lucide-react';
import { CachedImage, CachedVideo } from './CachedMedia';
import { useCachedMediaSource } from '../hooks/useCachedMediaSource';
import { getAlbumCoverUrl, getRecentAlbumsByUploadTime, getSelectionOrder } from '../lib/album-display';
import { prefetchMediaAsset } from '../lib/media-cache';
import { getNextPhotoAfterDelete, getSwipeDirection, getWrappedPhotoIndex } from '../lib/photo-navigation';
import { getPhotoDetailMeta, getPhotoDetailTitle } from '../lib/photo-detail-display';
import type { Album, Photo, UploadPhotosResult } from '../types';
import { useAppDialog } from './AppDialog';

interface AlbumsTabProps {
  albums: Album[];
  currentUserAvatarUrl: string;
  onCreateAlbum: (input: { title: string; description?: string }) => Promise<void>;
  onUploadPhotos: (albumId: string, files: File[]) => Promise<UploadPhotosResult>;
  onDeletePhoto: (photoId: string) => Promise<void>;
  onUpdatePhotoFavorite: (photoId: string, isFavorite: boolean) => Promise<void>;
  onOpenProfile: () => void;
}

const isVideoPhoto = (photo?: Pick<Photo, 'mimeType'> | null) =>
  photo?.mimeType?.toLowerCase().startsWith('video/') ?? false;

const toCacheableMedia = (photo?: Pick<Photo, 'objectKey' | 'url' | 'mimeType'> | null) =>
  photo?.url
    ? {
        objectKey: photo.objectKey,
        url: photo.url,
        mimeType: photo.mimeType,
      }
    : null;

const mediaCountText = (count: number) => `${count} 个回忆`;

export default function AlbumsTab({
  albums,
  currentUserAvatarUrl,
  onCreateAlbum,
  onUploadPhotos,
  onDeletePhoto,
  onUpdatePhotoFavorite,
  onOpenProfile,
}: AlbumsTabProps) {
  const dialog = useAppDialog();
  const [activeFilter, setActiveFilter] = useState<'all' | 'recent' | 'shared'>('all');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<Photo | null>(null);
  const [isPhotoSelectMode, setIsPhotoSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [isBulkPhotoDeleteConfirmOpen, setIsBulkPhotoDeleteConfirmOpen] = useState(false);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = useState(false);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [photoTransitionDirection, setPhotoTransitionDirection] = useState(0);
  const [slideshowTransitionDirection, setSlideshowTransitionDirection] = useState(0);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState('');
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [favoritePhotoId, setFavoritePhotoId] = useState<string | null>(null);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const photoLongPressTimerRef = useRef<number | null>(null);
  const didPhotoLongPressRef = useRef(false);
  const selectedAlbumId = selectedAlbum?.id;
  const selectedAlbumPhotoCount = selectedAlbum?.photos.length ?? 0;
  const activePhotoIndex =
    selectedAlbum && activePhoto
      ? selectedAlbum.photos.findIndex((photo) => photo.id === activePhoto.id)
      : -1;

  const closeCreateAlbumDialog = useCallback(() => {
    setNewAlbumTitle('');
    setIsCreateAlbumOpen(false);
  }, []);

  const clearPhotoLongPressTimer = useCallback(() => {
    if (photoLongPressTimerRef.current) {
      window.clearTimeout(photoLongPressTimerRef.current);
      photoLongPressTimerRef.current = null;
    }
  }, []);

  const clearPhotoSelection = useCallback(() => {
    clearPhotoLongPressTimer();
    setIsPhotoSelectMode(false);
    setSelectedPhotoIds([]);
    setIsBulkPhotoDeleteConfirmOpen(false);
  }, [clearPhotoLongPressTimer]);

  const closeSelectedAlbum = useCallback(() => {
    setActivePhoto(null);
    setIsSlideshowPlaying(false);
    clearPhotoSelection();
    setSelectedAlbum(null);
  }, [clearPhotoSelection]);

  const toggleSelectedPhoto = useCallback((photoId: string) => {
    setSelectedPhotoIds((current) =>
      current.includes(photoId)
        ? current.filter((selectedId) => selectedId !== photoId)
        : [...current, photoId],
    );
  }, []);

  const handlePhotoLongPressStart = useCallback(
    (photoId: string) => {
      clearPhotoLongPressTimer();
      didPhotoLongPressRef.current = false;
      photoLongPressTimerRef.current = window.setTimeout(() => {
        didPhotoLongPressRef.current = true;
        setIsPhotoSelectMode(true);
        setSelectedPhotoIds((current) =>
          current.includes(photoId) ? current : [...current, photoId],
        );
      }, 500);
    },
    [clearPhotoLongPressTimer],
  );

  const handlePhotoLongPressEnd = useCallback(() => {
    clearPhotoLongPressTimer();
  }, [clearPhotoLongPressTimer]);

  const handlePhotoCardClick = useCallback(
    (photo: Photo) => {
      if (didPhotoLongPressRef.current) {
        didPhotoLongPressRef.current = false;
        return;
      }

      if (isPhotoSelectMode) {
        toggleSelectedPhoto(photo.id);
        return;
      }

      setPhotoTransitionDirection(0);
      setActivePhoto(photo);
    },
    [isPhotoSelectMode, toggleSelectedPhoto],
  );

  const handleLocalBack = useCallback(() => {
    if (isBulkPhotoDeleteConfirmOpen) {
      setIsBulkPhotoDeleteConfirmOpen(false);
      return true;
    }

    if (isPhotoSelectMode) {
      clearPhotoSelection();
      return true;
    }

    if (isSlideshowPlaying) {
      setIsSlideshowPlaying(false);
      return true;
    }

    if (activePhoto) {
      setActivePhoto(null);
      return true;
    }

    if (selectedAlbum) {
      closeSelectedAlbum();
      return true;
    }

    if (isCreateAlbumOpen) {
      closeCreateAlbumDialog();
      return true;
    }

    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
      return true;
    }

    return false;
  }, [
    activePhoto,
    clearPhotoSelection,
    closeCreateAlbumDialog,
    closeSelectedAlbum,
    isBulkPhotoDeleteConfirmOpen,
    isCreateAlbumOpen,
    isPhotoSelectMode,
    isSearchOpen,
    isSlideshowPlaying,
    selectedAlbum,
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
    if (!selectedAlbumId) return;

    const freshAlbum = albums.find((album) => album.id === selectedAlbumId);
    if (freshAlbum) {
      setSelectedAlbum(freshAlbum);
      if (activePhoto) {
        setActivePhoto(freshAlbum.photos.find((photo) => photo.id === activePhoto.id) ?? null);
      }
    }
  }, [activePhoto, albums, selectedAlbumId]);

  useEffect(() => {
    if (!selectedAlbum || activePhotoIndex < 0 || selectedAlbum.photos.length < 2) return;

    [0, -1, 1]
      .map((offset) => selectedAlbum.photos[getWrappedPhotoIndex(activePhotoIndex + offset, selectedAlbum.photos.length)])
      .filter((photo): photo is Photo => Boolean(photo?.url))
      .forEach((photo) => {
        void prefetchMediaAsset({
          objectKey: photo.objectKey,
          url: photo.url,
          mimeType: photo.mimeType,
        });
      });
  }, [activePhoto?.id, activePhotoIndex, selectedAlbum]);

  useEffect(() => {
    setUploadStatusText('');
    clearPhotoSelection();
  }, [selectedAlbumId]);

  // Filter albums
  const baseFilteredAlbums =
    activeFilter === 'recent'
      ? getRecentAlbumsByUploadTime(albums)
      : albums.filter((album) => (activeFilter === 'all' ? true : album.type === activeFilter));
  const filteredAlbums = baseFilteredAlbums.filter(album => {
    const matchesSearch = searchQuery === '' ? true : 
      album.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      album.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const handleDeletePhoto = async (photo: Photo) => {
    if (!selectedAlbum) return;

    const confirmed = await dialog.confirm({
      message: '要把这张回忆移入清理页吗？',
      confirmText: '移入清理',
    });

    if (!confirmed) {
      return;
    }

    setIsDeletingPhoto(true);
    try {
      const nextPhotoId = getNextPhotoAfterDelete(
        selectedAlbum.photos.map((albumPhoto) => albumPhoto.id),
        photo.id,
      );
      await onDeletePhoto(photo.id);
      if (activePhoto?.id === photo.id) {
        setActivePhoto(
          nextPhotoId
            ? selectedAlbum.photos.find((albumPhoto) => albumPhoto.id === nextPhotoId) ?? null
            : null,
        );
      }
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '删除照片失败');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleTogglePhotoFavorite = async (photo: Photo) => {
    setFavoritePhotoId(photo.id);
    try {
      await onUpdatePhotoFavorite(photo.id, !photo.isFavorite);
      setActivePhoto((current) =>
        current?.id === photo.id ? { ...current, isFavorite: !photo.isFavorite } : current,
      );
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '收藏照片失败');
    } finally {
      setFavoritePhotoId(null);
    }
  };

  const handleBulkPhotoDeleteConfirmed = async () => {
    if (selectedPhotoIds.length === 0) {
      return;
    }

    setIsDeletingPhoto(true);
    try {
      for (const photoId of selectedPhotoIds) {
        await onDeletePhoto(photoId);
      }
      clearPhotoSelection();
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '删除所选照片失败');
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const handleCreateAlbum = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = newAlbumTitle.trim();
    if (!title) {
      return;
    }

    setIsCreatingAlbum(true);
    try {
      await onCreateAlbum({
        title,
      });
      setNewAlbumTitle('');
      setIsCreateAlbumOpen(false);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '创建相册失败');
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleChoosePhotos = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
    event.currentTarget.value = '';

    if (!selectedAlbum || files.length === 0) {
      return;
    }

    setIsUploadingPhotos(true);
    setUploadStatusText('正在上传照片/视频...');
    try {
      const result = await onUploadPhotos(selectedAlbum.id, files);

      if (result.failedCount > 0) {
        await dialog.alert(result.firstError ?? (result.uploadedCount === 0 ? '上传失败' : '部分照片/视频上传失败'));
        setUploadStatusText(`已上传 ${result.uploadedCount} 个，失败 ${result.failedCount} 个`);
        return;
      }

      setUploadStatusText(`已上传 ${result.uploadedCount} 个照片/视频`);
    } catch (error) {
      await dialog.alert(error instanceof Error ? error.message : '上传照片/视频失败');
      setUploadStatusText('');
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const showPhotoAtIndex = useCallback(
    (index: number, direction: number) => {
      if (!selectedAlbum || selectedAlbum.photos.length === 0) return;

      const nextIndex = getWrappedPhotoIndex(index, selectedAlbum.photos.length);
      setPhotoTransitionDirection(direction);
      setActivePhoto(selectedAlbum.photos[nextIndex]);
    },
    [selectedAlbum],
  );

  const shiftActivePhoto = useCallback(
    (direction: number) => {
      if (activePhotoIndex < 0) return;

      showPhotoAtIndex(activePhotoIndex + direction, direction);
    },
    [activePhotoIndex, showPhotoAtIndex],
  );

  const handleActivePhotoDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
      const direction = getSwipeDirection(info.offset.x);
      if (direction !== 0) {
        shiftActivePhoto(direction);
      }
    },
    [shiftActivePhoto],
  );

  const showSlideshowAtIndex = useCallback(
    (index: number, direction: number) => {
      if (!selectedAlbum || selectedAlbum.photos.length === 0) return;

      setSlideshowTransitionDirection(direction);
      setSlideshowIndex(getWrappedPhotoIndex(index, selectedAlbum.photos.length));
    },
    [selectedAlbum],
  );

  const shiftSlideshowPhoto = useCallback(
    (direction: number) => {
      showSlideshowAtIndex(slideshowIndex + direction, direction);
    },
    [showSlideshowAtIndex, slideshowIndex],
  );

  const handleSlideshowDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
      const direction = getSwipeDirection(info.offset.x);
      if (direction !== 0) {
        shiftSlideshowPhoto(direction);
      }
    },
    [shiftSlideshowPhoto],
  );

  const handleStartSlideshow = () => {
    if (!selectedAlbum || selectedAlbum.photos.length === 0) return;
    setSlideshowTransitionDirection(1);
    setSlideshowIndex(0);
    setIsSlideshowPlaying(true);
  };

  useEffect(() => {
    if (!isSlideshowPlaying || selectedAlbumPhotoCount <= 1) return;

    const timer = window.setInterval(() => {
      setSlideshowTransitionDirection(1);
      setSlideshowIndex((currentIndex) =>
        getWrappedPhotoIndex(currentIndex + 1, selectedAlbumPhotoCount),
      );
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isSlideshowPlaying, selectedAlbumPhotoCount]);

  const activeSlideshowPhoto = selectedAlbum?.photos[slideshowIndex];
  const activeSlideshowMediaSrc = useCachedMediaSource(toCacheableMedia(activeSlideshowPhoto));

  return (
    <div className="w-full pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 pb-4 pt-[calc(2.5rem+env(safe-area-inset-top))] glass-nav border-b border-surface-container-high">
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={onOpenProfile}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-secondary/20 transition-all hover:scale-105 cursor-pointer"
          >
            <img 
              src={currentUserAvatarUrl} 
              alt="个人头像" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-on-surface">相册</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSearchOpen(!isSearchOpen)}
            className="p-2.5 rounded-full hover:bg-surface-container transition-colors text-on-surface/80"
            title="搜索相册"
            id="search-btn"
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Embedded Search Input */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-6 py-2 bg-surface-low border-b border-surface-container-high"
          >
            <input 
              type="text"
              placeholder="搜索相册和标签..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-surface-container-lowest text-on-surface placeholder-outline rounded-xl border border-surface-container-highest focus:outline-none focus:ring-1 focus:ring-secondary/50 text-sm"
              autoFocus
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-5 mt-6">
        {/* Pills Selector */}
        <div className="flex bg-surface-container p-1 rounded-full w-full max-w-sm mb-8" id="album-filters">
          {(['all', 'recent', 'shared'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`relative flex-1 py-2 text-sm font-medium rounded-full cursor-pointer transition-colors ${
                activeFilter === filter ? 'text-on-secondary' : 'text-on-surface-variant'
              }`}
              type="button"
            >
              {activeFilter === filter && (
                <motion.div
                  layoutId="activeAlbumFilterTab"
                  className="absolute inset-0 bg-secondary rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="relative z-10 capitalize">
                {filter === 'all' ? '全部相册' : filter === 'recent' ? '最近' : '共享'}
              </span>
            </button>
          ))}
        </div>

        {/* Albums Bento/Grid */}
        <motion.div 
          layout 
          className="grid grid-cols-2 md:grid-cols-3 gap-5"
          id="albums-grid"
        >
          {filteredAlbums.map((album) => {
            const coverUrl = getAlbumCoverUrl(album);
            const coverPhoto = album.photos[0];
            const coverMedia = coverPhoto ? toCacheableMedia(coverPhoto) : { url: coverUrl };

            return (
            <motion.div
              layout
              key={album.id}
            onClick={() => setSelectedAlbum(album)}
              whileHover={{ y: -4, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="group relative cursor-pointer overflow-hidden rounded-lg bg-surface-container-lowest border border-surface-container/30 shadow-sm transition-all"
            >
              {/* Cover Image */}
              <div className="aspect-[4/5] overflow-hidden bg-surface-container relative">
                {isVideoPhoto(coverPhoto) ? (
                  <CachedVideo
                    cacheMode="list"
                    media={coverMedia}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    muted
                    playsInline
                    preload="none"
                  />
                ) : (
                  <CachedImage
                    cacheMode="list"
                    media={coverMedia}
                    alt={album.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                
                {/* Dots ornament representing page/layers stack */}
                <span className="absolute top-3 right-3 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] uppercase tracking-widest text-white/90 font-semibold font-mono">
                  {album.type}
                </span>
                {coverPhoto?.isFavorite && (
                  <span className="absolute left-3 bottom-[5.25rem] flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#d85b73] shadow-lg">
                    <Heart className="h-4 w-4 fill-current" />
                  </span>
                )}

                {/* Cover Texts overlaid */}
                <div className="absolute bottom-4 left-4 right-4">
                  <h3 className="text-lg font-bold text-white tracking-tight leading-tight group-hover:underline">
                    {album.title}
                  </h3>
                  <div className="flex items-center justify-between mt-1 text-white/80 text-xs">
                    <span>{mediaCountText(album.photos.length)}</span>
                    {album.tags && album.tags.length > 0 && (
                      <span className="text-[10px] py-0.5 px-2 bg-white/20 rounded-full font-medium">#{album.tags[0]}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
            );
          })}

          {/* Create New Album Card */}
          <motion.div
            layout
            whileHover={{ y: -4 }}
            className="group relative border-2 border-dashed border-surface-container-highest rounded-lg aspect-[4/5] flex flex-col items-center justify-center gap-3 cursor-pointer p-4 hover:border-secondary/40 transition-colors bg-surface-low"
            onClick={() => setIsCreateAlbumOpen(true)}
          >
            <div className="p-3 bg-white rounded-full text-secondary group-hover:bg-secondary group-hover:text-white transition-all ambient-shadow">
              <Plus className="w-5 h-5" />
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-on-surface">
                {isCreatingAlbum ? '创建中...' : '新建相册'}
              </span>
              <p className="text-xs text-on-surface-variant mt-1">整理你的回忆</p>
            </div>
          </motion.div>
        </motion.div>

        {filteredAlbums.length === 0 && (
          <div className="text-center py-20">
            <LayoutGrid className="w-12 h-12 text-outline-variant mx-auto mb-3" />
            <h3 className="text-base font-semibold text-on-surface">没有匹配的相册</h3>
            <p className="text-sm text-on-surface-variant mt-1">试试重置筛选或清空搜索</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isCreateAlbumOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              className="w-full max-w-sm rounded-3xl border border-white/60 bg-[#fff8f5] p-6 text-[#1e1b18] shadow-2xl"
            >
              <h2 className="text-xl font-extrabold tracking-tight">请输入新相册名称</h2>
              <p className="mt-2 text-xs font-medium text-on-surface-variant">
                给这组回忆起一个好记的名字。
              </p>

              <form onSubmit={handleCreateAlbum} className="mt-5 space-y-5">
                <input
                  type="text"
                  required
                  autoFocus
                  value={newAlbumTitle}
                  onChange={(event) => setNewAlbumTitle(event.target.value)}
                  placeholder="例如：周末旅行"
                  className="w-full rounded-2xl border border-surface-container-high bg-white px-4 py-3 text-sm font-semibold text-on-surface placeholder:text-outline/70 shadow-xs outline-none focus:border-[#88503a] focus:ring-4 focus:ring-[#ffb599]/25"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeCreateAlbumDialog}
                    disabled={isCreatingAlbum}
                    className="rounded-full border border-surface-container-highest px-5 py-2.5 text-xs font-bold text-on-surface-variant disabled:opacity-60"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={isCreatingAlbum || !newAlbumTitle.trim()}
                    className="rounded-full bg-[#88503a] px-5 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
                  >
                    {isCreatingAlbum ? '创建中...' : '确定'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Album Detail Drawer Modal */}
      <AnimatePresence>
        {selectedAlbum && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-md flex justify-end"
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-2xl bg-background min-h-screen relative px-6 pb-6 pt-[calc(3rem+env(safe-area-inset-top))] shadow-2xl flex flex-col"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handlePhotoFilesSelected}
              />
              {/* Header */}
              <div className="flex items-center justify-end pb-4 border-b border-surface-container-high">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleChoosePhotos}
                    disabled={isUploadingPhotos}
                    className="flex items-center gap-1.5 px-4 py-2 bg-surface-container text-on-surface rounded-full text-xs font-semibold hover:bg-surface-container-high transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    {isUploadingPhotos ? '上传中...' : '上传照片/视频'}
                  </button>
                  <button
                    type="button"
                    onClick={handleStartSlideshow}
                    className="flex items-center gap-1.5 px-4 py-2 bg-secondary text-white rounded-full text-xs font-semibold hover:bg-secondary/90 transition-colors ambient-shadow cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    播放幻灯片
                  </button>
                  <button 
                    type="button"
                    onClick={closeSelectedAlbum}
                    className="p-1.5 rounded-full hover:bg-surface-container"
                  >
                    <X className="w-5 h-5 text-on-surface-variant" />
                  </button>
                </div>
              </div>

              {/* Title & Info Banner */}
              <div className="mt-6 mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-on-surface">{selectedAlbum.title}</h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                      已整理 {mediaCountText(selectedAlbum.photos.length)}
                    </p>
                    {uploadStatusText && (
                      <p className="text-xs font-medium text-secondary mt-2">{uploadStatusText}</p>
                    )}
                  </div>
                  {selectedAlbum.tags && (
                    <div className="flex flex-wrap gap-1.5 max-w-xs">
                      {selectedAlbum.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-[10px] font-semibold tracking-wide uppercase">
                          <Tag className="w-3 h-3" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isPhotoSelectMode && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-surface-container px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-on-surface-variant">
                      已选择 {selectedPhotoIds.length} 个回忆
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={clearPhotoSelection}
                        disabled={isDeletingPhoto}
                        className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-on-surface-variant disabled:opacity-60"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsBulkPhotoDeleteConfirmOpen(true)}
                        disabled={selectedPhotoIds.length === 0 || isDeletingPhoto}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        删除
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Photos Masonry layout Grid inside Album */}
              <div className="flex-1 overflow-y-auto pr-1">
                {selectedAlbum.photos.length === 0 ? (
                  <div className="text-center py-20 bg-surface-low rounded-lg p-6">
                    <Trash2 className="w-10 h-10 text-outline mx-auto mb-2" />
                    <p className="text-sm font-medium text-on-surface">这个相册暂时没有照片/视频</p>
                    <p className="text-xs text-on-surface-variant mt-1">内容可能已被移动到清理页。</p>
                    <button
                      type="button"
                      onClick={handleChoosePhotos}
                      disabled={isUploadingPhotos}
                      className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-full text-xs font-semibold hover:bg-secondary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                      {isUploadingPhotos ? '上传中...' : '从手机相册上传'}
                    </button>
                  </div>
                ) : (
                  <div className="columns-2 md:columns-3 gap-4 space-y-4">
                    {selectedAlbum.photos.map((photo) => {
                      const selectionOrder = getSelectionOrder(selectedPhotoIds, photo.id);
                      const isSelected = selectionOrder !== null;

                      return (
                      <motion.div
                        layout
                        key={photo.id}
                        className={`break-inside-avoid relative overflow-hidden rounded-lg group shadow-sm bg-surface-low cursor-pointer select-none touch-callout-none ${
                          isSelected ? 'ring-4 ring-[#ffb599]' : ''
                        }`}
                        onPointerDown={() => handlePhotoLongPressStart(photo.id)}
                        onPointerUp={handlePhotoLongPressEnd}
                        onPointerLeave={handlePhotoLongPressEnd}
                        onPointerCancel={handlePhotoLongPressEnd}
                        onContextMenu={(event) => event.preventDefault()}
                        onClick={() => handlePhotoCardClick(photo)}
                      >
                        {isVideoPhoto(photo) ? (
                          <CachedVideo
                            cacheMode="list"
                            media={toCacheableMedia(photo)}
                            className="w-full h-auto object-cover rounded-lg group-hover:opacity-95 transition-opacity"
                            muted
                            playsInline
                            preload="none"
                          />
                        ) : (
                          <CachedImage
                            cacheMode="list"
                            media={toCacheableMedia(photo)}
                            alt={photo.title || 'Photo'}
                            className="w-full h-auto object-cover rounded-lg group-hover:opacity-95 transition-opacity"
                            loading="lazy"
                            decoding="async"
                            fetchPriority="low"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {photo.isFavorite && (
                          <div className="absolute bottom-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#d85b73] shadow-lg">
                            <Heart className="h-4 w-4 fill-current" />
                          </div>
                        )}
                        {!isPhotoSelectMode && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                          <h4 className="text-white text-sm font-semibold">{photo.title || '精选照片'}</h4>
                          {photo.location && (
                            <span className="flex items-center gap-1 text-[10px] text-white/80 mt-1">
                              <MapPin className="w-2.5 h-2.5" />
                              {photo.location}
                            </span>
                          )}
                          <div className="flex justify-between items-center mt-2.5 pt-2 border-t border-white/20">
                            <span className="text-[9px] text-white/70">{photo.dateAdded}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDeletePhoto(photo);
                              }}
                              disabled={isDeletingPhoto}
                              className="p-1 rounded bg-red-600/80 text-white hover:bg-red-700 hover:scale-105 transition-all"
                              title="删除回忆"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        )}

                        {isPhotoSelectMode && (
                          <div className="absolute inset-0 z-20 flex items-start justify-end bg-black/25 p-3">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center border-2 shadow-sm ${
                                isSelected
                                  ? 'bg-[#88503a] border-[#88503a] text-white'
                                  : 'bg-white/50 border-white text-transparent'
                              }`}
                            >
                              {selectionOrder}
                            </div>
                          </div>
                        )}
                      </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isBulkPhotoDeleteConfirmOpen && (
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              className="bg-[#fff8f5] rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-white/60 text-[#1e1b18]"
            >
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-on-surface">确认删除照片/视频</h3>
              <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
                确定要把已选择的 {selectedPhotoIds.length} 个回忆移入清理页吗？之后可以在清理页恢复。
              </p>
              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setIsBulkPhotoDeleteConfirmOpen(false)}
                  disabled={isDeletingPhoto}
                  className="px-4 py-2 hover:bg-surface-container rounded-full text-xs font-semibold text-on-surface-variant cursor-pointer disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleBulkPhotoDeleteConfirmed}
                  disabled={isDeletingPhoto || selectedPhotoIds.length === 0}
                  className="px-5 py-2 bg-red-700 text-white hover:bg-red-800 rounded-full text-xs font-semibold cursor-pointer disabled:opacity-60"
                >
                  {isDeletingPhoto ? '删除中...' : '确认删除'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Individual Photo Modal Popup Viewer */}
      <AnimatePresence>
        {activePhoto && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]">
            <button 
              type="button"
              className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={() => setActivePhoto(null)}
            >
              <X className="w-6 h-6" />
            </button>

            <motion.div
              drag={selectedAlbumPhotoCount > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragEnd={handleActivePhotoDragEnd}
              className="flex w-full flex-1 touch-pan-y flex-col items-center justify-center"
            >
            <div className="max-w-4xl max-h-[62vh] relative flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait" custom={photoTransitionDirection}>
                <motion.div
                  key={activePhoto.id}
                  initial={{
                    opacity: 0,
                    x: photoTransitionDirection === 0 ? 0 : photoTransitionDirection > 0 ? 90 : -90,
                    scale: 0.98,
                  }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    x: photoTransitionDirection === 0 ? 0 : photoTransitionDirection > 0 ? -90 : 90,
                    scale: 0.98,
                  }}
                  transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
                  className="flex max-h-[62vh] max-w-full touch-pan-y items-center justify-center"
                >
              {isVideoPhoto(activePhoto) ? (
                <CachedVideo
                  media={toCacheableMedia(activePhoto)}
                  className="max-w-full max-h-[62vh] rounded-md"
                  controls
                  playsInline
                />
              ) : (
                <CachedImage
                  media={toCacheableMedia(activePhoto)}
                  alt={activePhoto.title || 'Photo'}
                  className="max-w-full max-h-[62vh] object-contain rounded-md"
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  referrerPolicy="no-referrer"
                />
              )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Info details banner at bottom */}
            <div className="mt-6 text-center max-w-md text-white px-4">
              <h3 className="text-xl font-bold">
                {getPhotoDetailTitle(activePhoto, selectedAlbum?.title)}
              </h3>
              <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-secondary-container">
                {getPhotoDetailMeta(activePhoto).map((item, index) => (
                  <span key={`${item}-${index}`} className="flex items-center gap-1">
                    {index === 0 && activePhoto.location ? (
                      <MapPin className="w-3.5 h-3.5" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5" />
                    )}
                    {item}
                  </span>
                ))}
              </div>
            </div>
            </motion.div>
            <div className="absolute inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] mx-auto flex max-w-md items-center justify-center gap-3 rounded-[2rem] border border-white/15 bg-white/12 p-3 shadow-2xl backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={() => void handleTogglePhotoFavorite(activePhoto)}
                  disabled={favoritePhotoId === activePhoto.id}
                  className="flex-1 rounded-full border border-white/30 bg-white/18 px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60"
                >
                  {favoritePhotoId === activePhoto.id
                    ? '收藏中...'
                    : activePhoto.isFavorite
                      ? '已收藏'
                      : '爱心收藏'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeletePhoto(activePhoto)}
                  disabled={isDeletingPhoto}
                  className="flex-1 rounded-full border border-white/30 bg-white/18 px-5 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-60"
                >
                  {isDeletingPhoto ? '删除中...' : '删除照片'}
                </button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Fullscreen Slideshow component */}
      <AnimatePresence>
        {isSlideshowPlaying && selectedAlbum && (
          <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
            {/* Exit/Close Button */}
            <button 
              type="button"
              onClick={() => setIsSlideshowPlaying(false)}
              className="absolute top-6 right-6 z-50 p-3 bg-black/40 hover:bg-black/80 rounded-full text-white/80 hover:text-white transition-all text-xs font-semibold flex items-center gap-2 border border-white/10"
            >
              <X className="w-4 h-4" />
              退出幻灯片
            </button>

            {/* Main Picture */}
            <motion.div
              drag={selectedAlbumPhotoCount > 1 ? 'x' : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.12}
              onDragEnd={handleSlideshowDragEnd}
              className="grid h-full w-full grid-rows-[auto_minmax(0,1fr)_auto] px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))]"
            >
              <div className="text-center text-white/60 text-xs font-mono">
                {slideshowIndex + 1} / {selectedAlbum.photos.length}
              </div>

              <div className="relative flex min-h-0 items-center justify-center overflow-hidden py-6">
                <AnimatePresence mode="wait">
                  {activeSlideshowPhoto && isVideoPhoto(activeSlideshowPhoto) ? (
                    <motion.video
                      key={activeSlideshowPhoto.id}
                      src={activeSlideshowMediaSrc}
                      drag={selectedAlbumPhotoCount > 1 ? 'x' : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.18}
                      onDragEnd={handleSlideshowDragEnd}
                      initial={{
                        opacity: 0,
                        x: slideshowTransitionDirection === 0 ? 0 : slideshowTransitionDirection > 0 ? 90 : -90,
                        scale: 0.98,
                      }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: slideshowTransitionDirection === 0 ? 0 : slideshowTransitionDirection > 0 ? -90 : 90,
                        scale: 0.98,
                      }}
                      transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
                      className="max-h-full max-w-full touch-pan-y cursor-grab rounded-lg object-contain shadow-2xl active:cursor-grabbing"
                      controls
                      playsInline
                    />
                  ) : (
                    <motion.img
                      key={activeSlideshowPhoto?.id ?? slideshowIndex}
                      src={activeSlideshowMediaSrc}
                      alt={activeSlideshowPhoto?.title}
                      drag={selectedAlbumPhotoCount > 1 ? 'x' : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.18}
                      onDragEnd={handleSlideshowDragEnd}
                      initial={{
                        opacity: 0,
                        x: slideshowTransitionDirection === 0 ? 0 : slideshowTransitionDirection > 0 ? 90 : -90,
                        scale: 0.98,
                      }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        x: slideshowTransitionDirection === 0 ? 0 : slideshowTransitionDirection > 0 ? -90 : 90,
                        scale: 0.98,
                      }}
                      transition={{ type: 'spring', stiffness: 260, damping: 30, mass: 0.8 }}
                      className="max-h-full max-w-full touch-pan-y cursor-grab rounded-lg object-contain shadow-2xl active:cursor-grabbing"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </AnimatePresence>
              </div>

              {/* Captions and Navigation Actions */}
              <div className="text-center max-w-lg mx-auto">
                <h4 className="text-white text-xl font-bold tracking-tight">
                  {selectedAlbum.photos[slideshowIndex]?.title || '安静回忆'}
                </h4>
                <p className="text-xs text-secondary-container mt-1 inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedAlbum.photos[slideshowIndex]?.location || '未标记地点'} &bull; {selectedAlbum.photos[slideshowIndex]?.dateAdded}
                </p>

                {/* Slideshow progress bullets */}
                <div className="flex items-center justify-center gap-1.5 mt-6">
                  {selectedAlbum.photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        showSlideshowAtIndex(
                          idx,
                          idx === slideshowIndex ? 0 : idx > slideshowIndex ? 1 : -1,
                        )
                      }
                      className={`h-1.5 rounded-full transition-all ${
                        idx === slideshowIndex ? 'w-6 bg-secondary-container' : 'w-1.5 bg-white/20'
                      }`}
                      type="button"
                    />
                  ))}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}





