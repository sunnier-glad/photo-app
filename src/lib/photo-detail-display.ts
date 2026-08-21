const rawFileNamePattern = /^[\w.-]+\.(jpe?g|png|webp|gif|heic|mp4|mov|avi)$/i;

type PhotoDetailSource = {
  title?: string | null;
  aiTitle?: string | null;
  location?: string | null;
  dateAdded?: string;
  createdAt?: string;
  uploadedByName?: string | null;
};

export const isRawMediaFileName = (value: string | null | undefined) => {
  const text = value?.trim();
  return Boolean(text && rawFileNamePattern.test(text));
};

export const getPhotoDetailTitle = (photo: PhotoDetailSource, contextTitle?: string) => {
  const aiTitle = photo.aiTitle?.trim();
  if (aiTitle) return aiTitle;

  const title = photo.title?.trim();
  if (title && !isRawMediaFileName(title)) return title;

  const fallback = contextTitle?.trim();
  return fallback ? `${fallback}的回忆` : '这一天的回忆';
};

export const getPhotoDetailMeta = (photo: PhotoDetailSource) => {
  const items: string[] = [];

  if (photo.location?.trim()) {
    items.push(photo.location.trim());
  }

  const dateAdded = photo.dateAdded?.trim() || photo.createdAt?.slice(0, 10);
  if (dateAdded) {
    items.push(dateAdded);
  }

  if (photo.uploadedByName?.trim()) {
    items.push(`${photo.uploadedByName.trim()} 上传`);
  }

  return items;
};
