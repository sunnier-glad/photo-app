import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';

const DEFAULT_FILE_NAME = 'shared-photo.jpg';
const DOWNLOAD_DIRECTORY = 'Memories';

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

export type SaveRemoteFileResult = {
  mode: 'native' | 'web';
  fileName: string;
  path?: string;
};

export function createDownloadFileName(
  inputFileName?: string | null,
  mimeType?: string | null,
) {
  const trimmed = inputFileName?.trim() || DEFAULT_FILE_NAME;
  const safeBase = trimmed
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim() || DEFAULT_FILE_NAME;

  if (/\.[a-z0-9]{2,5}$/i.test(safeBase)) {
    return safeBase;
  }

  const extension = mimeType ? MIME_EXTENSIONS[mimeType.toLowerCase()] : undefined;
  return extension ? `${safeBase}.${extension}` : safeBase;
}

export function getNativeDownloadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');

  if (/ENOENT|No such file or directory/i.test(message)) {
    return '保存目录创建失败，请重新打开应用后再试';
  }

  if (/denied|permission|not granted/i.test(message)) {
    return '没有本地存储权限，请允许权限后重试';
  }

  return '下载照片失败，请检查网络后重试';
}

const ensureDownloadDirectory = async () => {
  try {
    await Filesystem.mkdir({
      path: DOWNLOAD_DIRECTORY,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? '');

    if (!/exist|EEXIST|already/i.test(message)) {
      throw error;
    }
  }
};

function triggerWebBlobDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function saveRemoteFileToDevice({
  url,
  fileName,
  mimeType,
}: {
  url: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<SaveRemoteFileResult> {
  const safeFileName = createDownloadFileName(fileName, mimeType);

  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.requestPermissions().catch(() => undefined);
      await ensureDownloadDirectory();

      const path = `${DOWNLOAD_DIRECTORY}/${Date.now()}-${safeFileName}`;
      const result = await Filesystem.downloadFile({
        url,
        path,
        directory: Directory.Documents,
        recursive: true,
      });

      return {
        mode: 'native',
        fileName: safeFileName,
        path: result.path ?? path,
      };
    } catch (error) {
      throw new Error(getNativeDownloadErrorMessage(error));
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('下载照片失败，请检查网络后重试');
  }

  triggerWebBlobDownload(await response.blob(), safeFileName);

  return {
    mode: 'web',
    fileName: safeFileName,
  };
}
